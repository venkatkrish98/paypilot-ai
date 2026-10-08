// ==============================================================================
// PayPilot AI - Official PayPal Developer Platform & Sandbox Client
// Implements PayPal Orders v2 REST API & Strict Truthful Simulation vs Sandbox
// ==============================================================================

import { PayPalOrderResponse, PayPalCaptureResponse, ExecutionMode } from "../types";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  environment: "sandbox" | "production";
}

export class PayPalClient {
  private clientId: string;
  private clientSecret: string;
  private environment: "sandbox" | "production";
  private baseUrl: string;
  private cachedAccessToken: string = "";
  private tokenExpiresAt: number = 0;

  constructor(config?: Partial<PayPalConfig>) {
    this.clientId = (config?.clientId || process.env.PAYPAL_CLIENT_ID || "").trim();
    this.clientSecret = (config?.clientSecret || process.env.PAYPAL_CLIENT_SECRET || "").trim();
    this.environment = (config?.environment || process.env.PAYPAL_ENVIRONMENT || "sandbox") as
      | "sandbox"
      | "production";
    this.baseUrl =
      this.environment === "production"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
  }

  /**
   * Returns true only when valid non-placeholder credentials are provided.
   */
  public isConfigured(): boolean {
    return (
      Boolean(this.clientId) &&
      Boolean(this.clientSecret) &&
      !this.clientId.toLowerCase().includes("placeholder") &&
      !this.clientSecret.toLowerCase().includes("placeholder") &&
      this.clientId.length > 10 &&
      this.clientSecret.length > 10
    );
  }

  public getMode(): ExecutionMode {
    return this.isConfigured() ? "sandbox" : "simulation";
  }

  public getEnvironment(): "sandbox" | "production" {
    return this.environment;
  }

  /**
   * Safe public configuration status that never leaks secrets.
   */
  public getSafeConfig() {
    return {
      paypalConfigured: this.isConfigured(),
      paypalEnvironment: this.environment,
      mode: this.getMode(),
    };
  }

  /**
   * Obtain an OAuth 2.0 access token from PayPal (server-side only)
   */
  public async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("Cannot request real PayPal OAuth token: valid Sandbox credentials are not configured.");
    }

    if (this.cachedAccessToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedAccessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PayPal OAuth2 Authentication failed [${response.status}]: ${errorText}`);
    }

    const data = await response.json();
    this.cachedAccessToken = data.access_token || "";
    this.tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    return this.cachedAccessToken;
  }

  /**
   * Create a PayPal Order (Orders v2 API)
   * POST /v2/checkout/orders
   */
  public async createOrder(params: {
    amount: number;
    currency?: string;
    description?: string;
    customId?: string;
    returnUrl?: string;
    cancelUrl?: string;
    customerEmail?: string;
  }): Promise<PayPalOrderResponse> {
    const currency = params.currency || "USD";
    const amountVal = params.amount.toFixed(2);

    // 1. Simulation Path: Unmistakably labeled as simulated
    if (!this.isConfigured()) {
      const mockOrderId = `SIMULATED_ORD_${Date.now().toString(36).toUpperCase()}_${Math.floor(1000 + Math.random() * 9000)}`;
      return {
        id: mockOrderId,
        status: "CREATED",
        intent: "CAPTURE",
        isSimulated: true,
        mode: "simulation",
        create_time: new Date().toISOString(),
        links: [
          {
            href: `${this.baseUrl}/v2/checkout/orders/${mockOrderId}`,
            rel: "self",
            method: "GET",
          },
          {
            href: `https://www.sandbox.paypal.com/checkoutnow?token=${mockOrderId}&mode=simulation_preview`,
            rel: "approve",
            method: "GET",
          },
          {
            href: `${this.baseUrl}/v2/checkout/orders/${mockOrderId}/capture`,
            rel: "capture",
            method: "POST",
          },
        ],
        purchase_units: [
          {
            reference_id: params.customId || "default",
            description: `[SIMULATED] ${params.description || "PayPilot AI Payment Goal"}`,
            amount: {
              currency_code: currency,
              value: amountVal,
            },
          },
        ],
      };
    }

    // 2. Real PayPal Sandbox Path
    const token = await this.getAccessToken();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const payload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: params.customId || `goal_${Date.now()}`,
          description: params.description || "PayPilot AI Payment Goal",
          amount: {
            currency_code: currency,
            value: amountVal,
          },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            brand_name: "PayPilot AI",
            locale: "en-US",
            landing_page: "GUEST_CHECKOUT",
            user_action: "PAY_NOW",
            return_url: params.returnUrl || `${appUrl}/dashboard?payment=success`,
            cancel_url: params.cancelUrl || `${appUrl}/dashboard?payment=cancelled`,
          },
        },
      },
    };

    const response = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `paypilot_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`PayPal Create Order Error [${response.status}]: ${err}`);
    }

    const orderData = await response.json();
    return {
      ...orderData,
      isSimulated: false,
      mode: "sandbox",
    };
  }

  /**
   * Retrieve Order details
   * GET /v2/checkout/orders/{id}
   */
  public async getOrder(orderId: string): Promise<PayPalOrderResponse> {
    if (!this.isConfigured() || orderId.startsWith("SIMULATED_")) {
      return {
        id: orderId,
        status: "APPROVED",
        intent: "CAPTURE",
        isSimulated: true,
        mode: "simulation",
        create_time: new Date().toISOString(),
        links: [
          {
            href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}&mode=simulation_preview`,
            rel: "approve",
            method: "GET",
          },
        ],
      };
    }

    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`PayPal Get Order Error [${response.status}]: ${err}`);
    }

    const orderData = await response.json();
    return {
      ...orderData,
      isSimulated: false,
      mode: "sandbox",
    };
  }

  /**
   * Capture authorized PayPal order
   * POST /v2/checkout/orders/{id}/capture
   * 
   * Strict validation:
   * 1. Requires order status to be APPROVED in Sandbox before capture.
   * 2. Confirms capture response status is COMPLETED.
   * 3. Confirms captured amount and currency match expected values.
   */
  public async captureOrder(
    orderId: string,
    expectedAmount?: number,
    expectedCurrency: string = "USD"
  ): Promise<PayPalCaptureResponse> {
    // 1. Simulation Path: Explicitly simulated capture
    if (!this.isConfigured() || orderId.startsWith("SIMULATED_")) {
      const mockCaptureId = `SIMULATED_CAP_${Date.now().toString(36).toUpperCase()}_${Math.floor(1000 + Math.random() * 9000)}`;
      return {
        id: mockCaptureId,
        status: "COMPLETED",
        amount: {
          currency_code: expectedCurrency,
          value: expectedAmount ? expectedAmount.toFixed(2) : "1200.00",
        },
        final_capture: true,
        isSimulated: true,
        mode: "simulation",
        create_time: new Date().toISOString(),
      };
    }

    // 2. Real Sandbox Order Verification: Verify Buyer has Approved
    const currentOrder = await this.getOrder(orderId);
    if (currentOrder.status !== "APPROVED") {
      throw new Error(
        `PayPal Order ${orderId} cannot be captured because its status is "${currentOrder.status}". The buyer must approve the payment on PayPal Sandbox before capture.`
      );
    }

    // 3. Execute Real Sandbox Capture
    const token = await this.getAccessToken();
    const response = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `capture_${Date.now()}`,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`PayPal Capture Order Error [${response.status}]: ${err}`);
    }

    const data = await response.json();
    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];

    const captureStatus = capture?.status || data.status;
    if (captureStatus !== "COMPLETED") {
      throw new Error(`PayPal capture was not completed. Status returned: "${captureStatus}".`);
    }

    const capturedCurrency = capture?.amount?.currency_code || data.amount?.currency_code || expectedCurrency;
    const capturedValue = parseFloat(capture?.amount?.value || data.amount?.value || "0");

    // 4. Validate captured amount & currency
    if (expectedAmount !== undefined) {
      if (Math.abs(capturedValue - expectedAmount) > 0.01) {
        throw new Error(
          `Captured amount mismatch: expected $${expectedAmount.toFixed(2)}, but PayPal returned $${capturedValue.toFixed(2)}.`
        );
      }
      if (capturedCurrency.toUpperCase() !== expectedCurrency.toUpperCase()) {
        throw new Error(
          `Captured currency mismatch: expected ${expectedCurrency}, but PayPal returned ${capturedCurrency}.`
        );
      }
    }

    return {
      id: capture?.id || data.id,
      status: "COMPLETED",
      amount: {
        currency_code: capturedCurrency,
        value: capturedValue.toFixed(2),
      },
      final_capture: true,
      isSimulated: false,
      mode: "sandbox",
      create_time: capture?.create_time || new Date().toISOString(),
    };
  }

  /**
   * Generate checkout URL for payment
   */
  public getCheckoutUrl(order: PayPalOrderResponse): string {
    const approveLink = order.links.find((l) => l.rel === "approve");
    if (approveLink) {
      return approveLink.href;
    }
    const token = order.id;
    return `https://www.sandbox.paypal.com/checkoutnow?token=${token}${
      order.isSimulated ? "&mode=simulation_preview" : ""
    }`;
  }
}

export const defaultPayPalClient = new PayPalClient();

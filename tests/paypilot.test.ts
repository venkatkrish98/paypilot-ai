// ==============================================================================
// PayPilot AI - Comprehensive Test Suite
// Verifying correct transitions, idempotency, failure handling, and simulation truthfulness
// ==============================================================================

import { describe, it, expect, beforeEach, vi } from "vitest";
import { defaultOrchestrator } from "../src/packages/agent";
import { db } from "../src/packages/database";
import { defaultSafetyEngine } from "../src/packages/risk";
import { defaultPayPalClient, PayPalClient } from "../src/packages/paypal";
import { PaymentGoal, Customer } from "../src/packages/types";
import { getNextDayOfWeek, parseRelativeDate } from "../src/packages/agent/ai-planner";
import fs from "fs";

describe("PayPilot AI Test Suite", () => {
  beforeEach(() => {
    // Reset database to initial deterministic demo state before each test
    db.seedDemoData();
  });

  // 1. Create payment goal with valid structured parameters
  it("1. should create a payment goal with valid structured parameters", async () => {
    const goal: PaymentGoal = {
      id: "goal_test_1",
      goal: "Collect $500 from Sarah",
      goalType: "collection",
      customer: "Sarah Jenkins",
      amount: 500,
      currency: "USD",
      deadline: "2026-10-20",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [],
      requiresApproval: false,
      createdBy: "agent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };

    const saved = db.saveGoal(goal);
    expect(saved.id).toBe("goal_test_1");
    expect(db.getGoalById("goal_test_1")?.amount).toBe(500);
    expect(db.getGoalById("goal_test_1")?.isSimulated).toBe(true);
  });

  // 2. Customer lookup
  it("2. should lookup customer and retrieve context and history", () => {
    const sarah = db.findCustomerByName("Sarah");
    expect(sarah).toBeDefined();
    expect(sarah?.name).toBe("Sarah Jenkins");
    expect(sarah?.email).toContain("designcraft.io");
    expect(sarah?.paymentHistory.length).toBeGreaterThan(0);
  });

  // 3. Truthful Simulation vs Real PayPal order creation & In-App checkout URL
  it("3. should label simulated orders unmistakably and provide in-app simulation checkout link", async () => {
    const order = await defaultPayPalClient.createOrder({
      amount: 1200,
      currency: "USD",
      description: "Website Project Delivery",
    });

    expect(order.id).toBeDefined();
    expect(order.status).toBe("CREATED");
    // In unconfigured demo mode, order ID MUST start with SIMULATED_
    expect(order.id).toContain("SIMULATED_ORD_");
    expect(order.isSimulated).toBe(true);
    expect(order.mode).toBe("simulation");

    const checkoutUrl = defaultPayPalClient.getCheckoutUrl(order);
    // P0.2 requirement: In-app simulation checkout link, not sending to live paypal with fabricated token
    expect(checkoutUrl).toContain("/checkout/simulation");
    expect(checkoutUrl).toContain(order.id);
  });

  // 4. Live production environment blocking (P0.8)
  it("4. should strictly block live production PayPal environment to enforce hackathon sandbox safety", () => {
    expect(() => {
      new PayPalClient({ environment: "production" });
    }).toThrow(/CRITICAL SAFETY ENFORCEMENT/);
  });

  // 5. Capture validation: Amount and currency matching
  it("5. should capture payment and verify amount and currency match expected values in simulation", async () => {
    const order = await defaultPayPalClient.createOrder({ amount: 1200 });
    const capture = await defaultPayPalClient.captureOrder(order.id, 1200, "USD");

    expect(capture.id).toContain("SIMULATED_CAP_");
    expect(capture.status).toBe("COMPLETED");
    expect(parseFloat(capture.amount.value)).toBe(1200);
    expect(capture.amount.currency_code).toBe("USD");
  });

  // 6. Real Sandbox: Rejection when order is not approved
  it("6. should reject sandbox capture if order status is not APPROVED", async () => {
    const client = new PayPalClient({
      clientId: "TEST_CLIENT_ID_SANDBOX_12345",
      clientSecret: "TEST_CLIENT_SECRET_SANDBOX_12345",
      environment: "sandbox",
    });

    // Mock getOrder returning CREATED (not approved by buyer yet)
    vi.spyOn(client, "getOrder").mockResolvedValueOnce({
      id: "SANDBOX_ORD_UNAPPROVED",
      status: "CREATED",
      intent: "CAPTURE",
      isSimulated: false,
      mode: "sandbox",
      create_time: new Date().toISOString(),
      links: [],
    });

    await expect(
      client.captureOrder("SANDBOX_ORD_UNAPPROVED", 1200, "USD")
    ).rejects.toThrow(/buyer must approve the payment on PayPal Sandbox before capture/);
  });

  // 7. Amount mismatch rejection in Sandbox capture
  it("7. should reject sandbox capture if captured amount mismatches expected goal amount", async () => {
    const client = new PayPalClient({
      clientId: "TEST_CLIENT_ID_SANDBOX_12345",
      clientSecret: "TEST_CLIENT_SECRET_SANDBOX_12345",
      environment: "sandbox",
    });

    vi.spyOn(client, "getOrder").mockResolvedValueOnce({
      id: "SANDBOX_ORD_1",
      status: "APPROVED",
      intent: "CAPTURE",
      isSimulated: false,
      mode: "sandbox",
      create_time: new Date().toISOString(),
      links: [],
    });

    vi.spyOn(client, "getAccessToken").mockResolvedValueOnce("mock_access_token");

    // Mock global fetch to return capture with amount $500 instead of expected $1200
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "SANDBOX_CAP_MISMATCH",
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: "SANDBOX_CAP_MISMATCH",
                  status: "COMPLETED",
                  amount: { value: "500.00", currency_code: "USD" },
                },
              ],
            },
          },
        ],
      }),
    } as any);

    try {
      await expect(
        client.captureOrder("SANDBOX_ORD_1", 1200, "USD")
      ).rejects.toThrow(/Captured amount mismatch/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 8. Currency mismatch rejection in Sandbox capture
  it("8. should reject sandbox capture if captured currency mismatches expected currency", async () => {
    const client = new PayPalClient({
      clientId: "TEST_CLIENT_ID_SANDBOX_12345",
      clientSecret: "TEST_CLIENT_SECRET_SANDBOX_12345",
      environment: "sandbox",
    });

    vi.spyOn(client, "getOrder").mockResolvedValueOnce({
      id: "SANDBOX_ORD_2",
      status: "APPROVED",
      intent: "CAPTURE",
      isSimulated: false,
      mode: "sandbox",
      create_time: new Date().toISOString(),
      links: [],
    });

    vi.spyOn(client, "getAccessToken").mockResolvedValueOnce("mock_access_token");

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "SANDBOX_CAP_CURRENCY_MISMATCH",
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: "SANDBOX_CAP_CURRENCY_MISMATCH",
                  status: "COMPLETED",
                  amount: { value: "1200.00", currency_code: "EUR" },
                },
              ],
            },
          },
        ],
      }),
    } as any);

    try {
      await expect(
        client.captureOrder("SANDBOX_ORD_2", 1200, "USD")
      ).rejects.toThrow(/Captured currency mismatch/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 9. Non-completed capture status rejection in Sandbox
  it("9. should reject sandbox capture if PayPal returned non-completed status (e.g. PENDING or FAILED)", async () => {
    const client = new PayPalClient({
      clientId: "TEST_CLIENT_ID_SANDBOX_12345",
      clientSecret: "TEST_CLIENT_SECRET_SANDBOX_12345",
      environment: "sandbox",
    });

    vi.spyOn(client, "getOrder").mockResolvedValueOnce({
      id: "SANDBOX_ORD_3",
      status: "APPROVED",
      intent: "CAPTURE",
      isSimulated: false,
      mode: "sandbox",
      create_time: new Date().toISOString(),
      links: [],
    });

    vi.spyOn(client, "getAccessToken").mockResolvedValueOnce("mock_access_token");

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "SANDBOX_CAP_PENDING",
        status: "PENDING",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: "SANDBOX_CAP_PENDING",
                  status: "PENDING",
                  amount: { value: "1200.00", currency_code: "USD" },
                },
              ],
            },
          },
        ],
      }),
    } as any);

    try {
      await expect(
        client.captureOrder("SANDBOX_ORD_3", 1200, "USD")
      ).rejects.toThrow(/PayPal capture was not completed/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 10. Duplicate payment prevention (24h window)
  it("10. should detect duplicate payment requests created within 24 hours", () => {
    const recentGoal: PaymentGoal = {
      id: "goal_recent_sarah",
      goal: "Collect $1200 from Sarah",
      goalType: "collection",
      customer: "Sarah Jenkins",
      amount: 1200,
      currency: "USD",
      deadline: "2026-10-20",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [],
      requiresApproval: false,
      createdBy: "agent",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      timeline: [],
    };

    const evaluation = defaultSafetyEngine.evaluate({
      amount: 1200,
      currency: "USD",
      customerName: "Sarah Jenkins",
      existingGoals: [recentGoal],
    });

    const duplicateCheck = evaluation.checks.find((c) => c.id === "check_duplicate_payment");
    expect(duplicateCheck).toBeDefined();
    expect(duplicateCheck?.passed).toBe(false);
    expect(evaluation.riskScore).toBeGreaterThan(30);
  });

  // 11. Risk detection and approval pause
  it("11. should flag high-risk for unfamiliar recipient and amount exceeding threshold", () => {
    const evaluation = defaultSafetyEngine.evaluate({
      amount: 2500,
      currency: "USD",
      customerName: "Unknown Vendor X",
      customThreshold: 2000,
      isPayout: true,
    });

    expect(evaluation.riskLevel).toBe("high");
    expect(evaluation.requiresApproval).toBe(true);
    expect(evaluation.approvalReason).toContain("exceeds standard review threshold");
  });

  // 12. Payout review vs Inbound Collection separation
  it("12. should separate payout review from inbound collection flows without creating fake Orders checkout tokens", async () => {
    const mikeGoal = db.getGoalById("goal_mike_2500");
    expect(mikeGoal).toBeDefined();
    expect(mikeGoal?.goalType).toBe("payout_review");
    expect(mikeGoal?.status).toBe("pending_approval");
    // Before approval, does not have a PayPal orders checkout link
    expect(mikeGoal?.paypalOrderId).toBeUndefined();
  });

  // 13. Dynamic relative Friday calculation (no stale hardcoded dates)
  it("13. should calculate upcoming Friday dynamically without stale hardcoded dates", () => {
    const friday = getNextDayOfWeek(5);
    expect(friday).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const [year, month, day] = friday.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    expect(dateObj.getDay()).toBe(5); // 5 is Friday

    const parsedFriday = parseRelativeDate("by Friday");
    expect(parsedFriday).toBe(friday);
  });

  // 14. Customer ledger balance consistency after capture
  it("14. should update customer balance accurately and idempotently upon payment capture", () => {
    const sarahBefore = db.getCustomerById("cust_sarah");
    expect(sarahBefore?.outstandingAmount).toBe(1200);

    // Reconcile payment with capture ID
    const res = db.reconcilePayment("goal_sarah_1200", "SIMULATED_CAP_SARAH_1200", 1200, "USD", true);
    expect(res?.goal.status).toBe("paid");

    const sarahAfter = db.getCustomerById("cust_sarah");
    expect(sarahAfter?.outstandingAmount).toBe(0);
    expect(sarahAfter?.lastPaymentAmount).toBe(1200);

    // Repeated capture / reconcile on already paid goal should not deduct further (idempotent)
    const resAgain = db.reconcilePayment("goal_sarah_1200", "SIMULATED_CAP_SARAH_1200", 1200, "USD", true);
    expect(resAgain?.goal.status).toBe("paid");
    expect(db.getCustomerById("cust_sarah")?.outstandingAmount).toBe(0);
  });

  // 15. Safe Demo Reset: Preserves non-demo user data and restores canonical fixtures
  it("15. should restore canonical demo fixtures and customer balances without erasing non-demo user data", () => {
    // Add a genuine user-created custom goal
    const customUserGoal: PaymentGoal = {
      id: "user_goal_custom_999",
      goal: "Custom user invoice for consulting",
      goalType: "collection",
      customer: "Genuine Client Inc",
      amount: 450,
      currency: "USD",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      isDemoFixture: false,
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [],
      requiresApproval: false,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };
    db.saveGoal(customUserGoal);

    // Verify custom goal exists
    expect(db.getGoalById("user_goal_custom_999")).toBeDefined();

    // Perform safe reset
    db.resetDemoFixtures();

    // Verify canonical fixtures are present
    const goals = db.getGoals();
    expect(db.getGoalById("goal_sarah_1200")).toBeDefined();
    expect(db.getGoalById("goal_john_850")).toBeDefined();
    expect(db.getGoalById("goal_mike_2500")).toBeDefined();
    expect(db.getGoalById("goal_acme_600")).toBeDefined();

    // Verify non-demo user goal was safely preserved!
    expect(db.getGoalById("user_goal_custom_999")).toBeDefined();

    // Verify customer balances match canonical fixtures
    expect(db.getCustomerById("cust_sarah")?.outstandingAmount).toBe(1200);
    expect(db.getCustomerById("cust_john")?.outstandingAmount).toBe(0);
    expect(db.getCustomerById("cust_mike")?.outstandingAmount).toBe(2500);
    expect(db.getCustomerById("cust_acme")?.outstandingAmount).toBe(600);
  });

  // 16. Persistence failure surfacing
  it("16. should surface persistence errors when disk writes fail", () => {
    const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
      throw new Error("EACCES: permission denied, open 'paypilot_db.json'");
    });

    expect(() => {
      db.persistToDisk();
    }).toThrow(/EACCES: permission denied/);

    writeSpy.mockRestore();
  });

  // 17. Rejection of approval bypass via direct goal update (P0.5)
  it("17. should reject attempts to bypass human approval via direct status change to awaiting_payment", async () => {
    const { PATCH } = await import("../src/app/api/goals/[id]/route");
    const mikeGoal = db.getGoalById("goal_mike_2500");
    expect(mikeGoal?.status).toBe("pending_approval");

    const req = new Request("http://localhost:3000/api/goals/goal_mike_2500", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "awaiting_payment" }),
    });

    const res = await PATCH(req, { params: { id: "goal_mike_2500" } });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Cannot bypass approval workflow");
  });

  // 18. Rejection of capture on goals still pending approval (P0.4)
  it("18. should reject attempts to capture a payment goal that is still pending approval", async () => {
    const { POST: capturePost } = await import("../src/app/api/goals/[id]/capture/route");
    const req = new Request("http://localhost:3000/api/goals/goal_mike_2500/capture", {
      method: "POST",
    });

    const res = await capturePost(req, { params: { id: "goal_mike_2500" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("currently held in pending_approval");
  });

  // 19. Duplicate approval rejection (Idempotency) (P0.4)
  it("19. should reject duplicate approvals idempotently", async () => {
    const { POST: approvePost } = await import("../src/app/api/goals/[id]/approve/route");
    const req1 = new Request("http://localhost:3000/api/goals/goal_mike_2500/approve", {
      method: "POST",
    });

    // First approval
    const res1 = await approvePost(req1, { params: { id: "goal_mike_2500" } });
    expect(res1.status).toBe(200);

    // Second approval attempt should be rejected with 409 Conflict
    const req2 = new Request("http://localhost:3000/api/goals/goal_mike_2500/approve", {
      method: "POST",
    });
    const res2 = await approvePost(req2, { params: { id: "goal_mike_2500" } });
    expect(res2.status).toBe(409);
    const body = await res2.json();
    expect(body.isAlreadyApproved).toBe(true);
  });
});

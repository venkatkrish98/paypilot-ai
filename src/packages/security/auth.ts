// ==============================================================================
// PayPilot AI - API Write Protection & Authorization Guard
// Real authorization guard for production mutations and sandbox safety
// ==============================================================================

import crypto from "crypto";

export interface AuthCheckResult {
  authorized: boolean;
  isAdmin?: boolean;
  reason?: string;
  statusCode?: number;
  isSimulationOnly?: boolean;
}

export interface AuthTargetContext {
  isSimulated?: boolean;
  action?: "create" | "update" | "approve" | "capture" | "reset";
}

/**
 * Validates whether write mutations (create goal, update, approve, capture, demo reset)
 * are permitted for the incoming HTTP request.
 *
 * Security Policy:
 * 1. Admin Authorization: If PAYPILOT_ADMIN_KEY or PAYPILOT_API_KEY is configured,
 *    requests presenting a matching Bearer token or x-api-key receive full administrative access.
 * 2. Real Sandbox Isolation: Anonymous requests can NEVER approve or capture real PayPal Sandbox
 *    orders (isSimulated === false). Real Sandbox interactions strictly require administrative authorization.
 * 3. Public Demo Restriction: If the application runs a public demo without user accounts (DEMO_MODE !== "false"),
 *    anonymous mutations are strictly restricted to disposable simulation data (isSimulated === true).
 * 4. Production Fail-Closed: If demo mode is explicitly disabled (DEMO_MODE === "false") in production,
 *    all unauthenticated requests are denied.
 */
export function checkWriteAuthorization(
  req: Request,
  context?: AuthTargetContext
): AuthCheckResult {
  const configuredKey = (process.env.PAYPILOT_ADMIN_KEY || process.env.PAYPILOT_API_KEY || "").trim();
  const isProduction = process.env.NODE_ENV === "production";
  const demoModeDisabled = process.env.DEMO_MODE === "false";

  // Check for admin API key in Authorization header or x-api-key
  const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // 1. If an Admin API Key is configured and matches, grant admin authorization
  if (configuredKey && token) {
    const isMatch =
      token.length === configuredKey.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(configuredKey));

    if (isMatch) {
      return { authorized: true, isAdmin: true };
    }

    return {
      authorized: false,
      reason: "Unauthorized: Invalid API key provided for PayPilot mutation route.",
      statusCode: 401,
    };
  }

  // 2. If Demo Mode is explicitly disabled, fail closed immediately
  if (demoModeDisabled) {
    return {
      authorized: false,
      reason: "Forbidden: Demo mutations are disabled. Administrative authentication required.",
      statusCode: 403,
    };
  }

  // 3. CRITICAL SANDBOX SAFETY RULE:
  // Anonymous requests CANNOT approve or capture real PayPal Sandbox transactions!
  // Any real Sandbox operation strictly requires verified administrative credentials.
  if (context?.isSimulated === false) {
    return {
      authorized: false,
      reason: "Unauthorized: Real PayPal Sandbox operations require administrative authorization.",
      statusCode: 401,
    };
  }

  // 4. Production Environment
  if (isProduction) {
    // If an admin key is configured and no key was provided:
    if (configuredKey) {
      // If action is on a simulation goal and public demo is allowed, permit simulation-only mutation
      if (context?.isSimulated === true) {
        return { authorized: true, isAdmin: false, isSimulationOnly: true };
      }

      return {
        authorized: false,
        reason: "Unauthorized: Missing administrative credentials for PayPilot mutation route in production.",
        statusCode: 401,
      };
    }

    // In production without an admin key configured:
    // Only allow mutations if they are strictly disposable simulation operations
    if (context?.isSimulated === true) {
      return { authorized: true, isAdmin: false, isSimulationOnly: true };
    }

    return {
      authorized: false,
      reason: "Unauthorized: Missing administrative credentials for PayPilot mutation route in production.",
      statusCode: 401,
    };
  }

  // Permitted in simulation demo
  return { authorized: true, isAdmin: false, isSimulationOnly: true };
}

export interface ReadScopeResult {
  authorized: boolean;
  isAdmin: boolean;
  scope: "all" | "demo_only";
  reason?: string;
  statusCode?: number;
}

/**
 * Protects and scopes read access to customer profiles, payment history, memories, and goals.
 * - In production without admin key: Scopes reads to canonical demo fixtures and simulation goals.
 * - In production when DEMO_MODE=false: Fails closed (401).
 * - Authenticated admins: Full access to all records.
 * - Development/testing: Full access for developer/evaluator usability.
 */
export function checkReadAuthorization(req: Request): ReadScopeResult {
  const isProduction = process.env.NODE_ENV === "production";
  const demoModeDisabled = process.env.DEMO_MODE === "false";
  const isAdmin = isRequestAdmin(req);

  // 1. Authenticated admin has full read access across all environments
  if (isAdmin) {
    return { authorized: true, isAdmin: true, scope: "all" };
  }

  // 2. In production when demo mode is disabled, fail closed
  if (isProduction && demoModeDisabled) {
    return {
      authorized: false,
      isAdmin: false,
      scope: "demo_only",
      reason: "Unauthorized: Read access requires administrative authentication when demo mode is disabled.",
      statusCode: 401,
    };
  }

  // 3. In production with demo mode active, scope reads to canonical demo fixtures & simulation goals only
  if (isProduction) {
    return { authorized: true, isAdmin: false, scope: "demo_only" };
  }

  // 4. In development and test environments, allow full access for evaluator usability
  return { authorized: true, isAdmin: false, scope: "all" };
}

/**
 * Validates payment order provenance.
 * Rejects inconsistent states:
 * - Real PayPal order ID on a simulation goal
 * - Simulated order ID on a Sandbox goal
 */
export function validateOrderProvenance(goal: {
  isSimulated?: boolean;
  mode?: string;
  paypalOrderId?: string;
}): { valid: boolean; reason?: string; isRealSandbox: boolean } {
  const orderId = goal.paypalOrderId || "";
  const isSimOrderId = orderId.startsWith("SIMULATED_");

  if (orderId) {
    if ((goal.isSimulated || goal.mode === "simulation") && !isSimOrderId) {
      return {
        valid: false,
        reason: "Inconsistent payment provenance: Goal is flagged as simulation, but carries a real PayPal order ID.",
        isRealSandbox: true,
      };
    }
    if ((!goal.isSimulated || goal.mode === "sandbox") && isSimOrderId) {
      return {
        valid: false,
        reason: "Inconsistent payment provenance: Goal is flagged as PayPal Sandbox, but carries a simulated order ID.",
        isRealSandbox: false,
      };
    }
  }

  const isRealSandbox = !goal.isSimulated || goal.mode === "sandbox" || (orderId ? !isSimOrderId : false);
  return { valid: true, isRealSandbox };
}

/**
 * Checks whether the incoming request carries verified administrative credentials.
 */
export function isRequestAdmin(req: Request): boolean {
  const configuredKey = (process.env.PAYPILOT_ADMIN_KEY || process.env.PAYPILOT_API_KEY || "").trim();
  if (!configuredKey) return false;

  const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;

  return (
    token.length === configuredKey.length &&
    crypto.timingSafeEqual(Buffer.from(token), Buffer.from(configuredKey))
  );
}

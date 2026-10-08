// ==============================================================================
// PayPilot AI - API Write Protection & Authorization Guard
// Constrains mutation routes outside local demo mode to prevent unauthenticated tampering
// ==============================================================================

export interface AuthCheckResult {
  authorized: boolean;
  reason?: string;
  statusCode?: number;
}

/**
 * Validates whether write mutations (create goal, update, approve, capture, demo reset)
 * are permitted for the incoming HTTP request.
 *
 * Rules:
 * 1. If PAYPILOT_API_KEY or PAYPILOT_ADMIN_KEY is configured in the environment,
 *    incoming requests must present a matching Authorization: Bearer <token> or x-api-key header.
 * 2. If in production (NODE_ENV === "production") and DEMO_MODE === "false",
 *    unauthenticated write mutations are strictly blocked (401/403).
 * 3. In local development or labeled local demo mode (default), mutations are permitted
 *    to enable evaluation without mandatory key orchestration.
 */
export function checkWriteAuthorization(req: Request): AuthCheckResult {
  const configuredKey = (process.env.PAYPILOT_ADMIN_KEY || process.env.PAYPILOT_API_KEY || "").trim();
  const isProduction = process.env.NODE_ENV === "production";
  const demoModeDisabled = process.env.DEMO_MODE === "false";

  // If an API key is configured, strictly enforce it across all environments
  if (configuredKey) {
    const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (token === configuredKey) {
      return { authorized: true };
    }
    return {
      authorized: false,
      reason: "Unauthorized: Missing or invalid API key for PayPilot mutation route.",
      statusCode: 401,
    };
  }

  // If deployed in production with demo mode explicitly disabled, block unauthenticated writes
  if (isProduction && demoModeDisabled) {
    return {
      authorized: false,
      reason: "Forbidden: Mutation routes are locked in production mode without configured credentials.",
      statusCode: 403,
    };
  }

  // Local demo mode allowed
  return { authorized: true };
}

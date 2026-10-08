// ==============================================================================
// PayPilot AI - API Write Protection & Authorization Guard
// Fail-closed authorization guard for mutation routes
// ==============================================================================

export interface AuthCheckResult {
  authorized: boolean;
  reason?: string;
  statusCode?: number;
  isBrowserSession?: boolean;
}

// In-memory set of active browser demo session tokens (ephemeral, non-secret)
const validDemoSessions = new Set<string>();

/**
 * Generates an ephemeral demo session token for same-origin browser clients.
 * Never exposes the server API secret to the client.
 */
export function generateDemoSessionToken(): string {
  const token = `paypilot_sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
  validDemoSessions.add(token);
  // Cap set size to avoid unbounded memory growth
  if (validDemoSessions.size > 1000) {
    const oldest = Array.from(validDemoSessions).slice(0, 500);
    oldest.forEach((t) => validDemoSessions.delete(t));
  }
  return token;
}

/**
 * Validates whether an ephemeral session token was issued to a browser client.
 */
export function isValidDemoSessionToken(token: string): boolean {
  if (!token) return false;
  return validDemoSessions.has(token);
}

/**
 * Validates whether write mutations (create goal, update, approve, capture, demo reset)
 * are permitted for the incoming HTTP request.
 *
 * Security Policy:
 * 1. Fail Closed in Production: In production (NODE_ENV === "production"), unauthenticated
 *    requests are DENIED by default. We do NOT rely on DEMO_MODE=false being set.
 * 2. If PAYPILOT_ADMIN_KEY or PAYPILOT_API_KEY is configured, requests presenting a matching
 *    Bearer token or x-api-key are granted full administrative access.
 * 3. Hosted Browser UI Access: Same-origin browser requests presenting an ephemeral
 *    demo session token (or header x-paypilot-session / cookie) are permitted ONLY when
 *    DEMO_MODE is not explicitly disabled ("false"). Server secrets are NEVER exposed to the client.
 * 4. Local Development: In non-production environments without configured keys, mutations
 *    are permitted to enable local testing and inspection.
 */
export function checkWriteAuthorization(req: Request): AuthCheckResult {
  const configuredKey = (process.env.PAYPILOT_ADMIN_KEY || process.env.PAYPILOT_API_KEY || "").trim();
  const isProduction = process.env.NODE_ENV === "production";
  const demoModeDisabled = process.env.DEMO_MODE === "false";

  // Check for admin API key in Authorization header or x-api-key
  const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  // 1. If an Admin API Key is configured and matches, authorize
  if (configuredKey && token && token === configuredKey) {
    return { authorized: true };
  }

  // 2. If configuredKey is present but the provided token doesn't match
  if (configuredKey && token && token !== configuredKey) {
    return {
      authorized: false,
      reason: "Unauthorized: Invalid API key provided for PayPilot mutation route.",
      statusCode: 401,
    };
  }

  // 3. Check for Browser UI session token (via header or cookie)
  const sessionHeader = req.headers.get("x-paypilot-session") || "";
  const cookieHeader = req.headers.get("cookie") || "";
  const sessionFromCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("paypilot_session="))
    ?.split("=")[1];

  const clientSession = sessionHeader || sessionFromCookie || "";
  const isBrowserRequest =
    req.headers.get("sec-fetch-site") === "same-origin" ||
    req.headers.get("sec-fetch-mode") === "cors" ||
    Boolean(req.headers.get("user-agent")?.includes("Mozilla"));

  const hasValidDemoSession = clientSession && isValidDemoSessionToken(clientSession);

  // 4. Production Environment: FAIL CLOSED BY DEFAULT
  if (isProduction) {
    // If demo mode is explicitly disabled in production, block all non-admin requests
    if (demoModeDisabled) {
      return {
        authorized: false,
        reason: "Forbidden: Demo mutations are disabled in production. Admin authentication required.",
        statusCode: 403,
      };
    }

    // In production, unauthenticated requests fail closed by default.
    // Browser UI requests are permitted ONLY with a valid active session token issued by /api/auth/session.
    if (hasValidDemoSession) {
      return {
        authorized: true,
        isBrowserSession: true,
      };
    }

    // Unauthenticated production request fails closed
    return {
      authorized: false,
      reason: "Unauthorized: Missing authentication credentials for PayPilot mutation route in production.",
      statusCode: 401,
    };
  }

  // 5. Non-production / Local Development:
  // If an API key was configured, enforce it
  if (configuredKey && !token) {
    return {
      authorized: false,
      reason: "Unauthorized: API key required when PAYPILOT_ADMIN_KEY is configured.",
      statusCode: 401,
    };
  }

  // Local development demo allowed
  return { authorized: true };
}

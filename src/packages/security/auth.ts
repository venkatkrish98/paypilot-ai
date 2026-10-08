// ==============================================================================
// PayPilot AI - API Write Protection & Authorization Guard
// Real authorization guard for production mutations, session cookies, and sandbox safety
// ==============================================================================

import crypto from "crypto";
import {
  CANONICAL_DEMO_GOAL_IDS,
  CANONICAL_DEMO_CUSTOMER_IDS,
  CANONICAL_DEMO_MEMORY_IDS,
  CANONICAL_DEMO_RECOMMENDATION_IDS,
} from "../database/store";
import { PaymentGoal, Customer, MemoryItem, AIRecommendation } from "../types";

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

const SESSION_SECRET = process.env.PAYPILOT_SESSION_SECRET || "paypilot_internal_session_secret_2026";

/**
 * Returns the configured admin key.
 * In development and test environments, provides a documented default fallback ("paypal_sandbox_judge_2026")
 * if PAYPILOT_ADMIN_KEY is not explicitly set in .env.
 */
export function getConfiguredAdminKey(): string {
  const envKey = (process.env.PAYPILOT_ADMIN_KEY || process.env.PAYPILOT_API_KEY || "").trim();
  if (envKey) return envKey;
  if (process.env.NODE_ENV !== "production") {
    return "paypal_sandbox_judge_2026";
  }
  return "";
}

/**
 * Creates an HMAC signed session token for a verified admin session.
 */
export function createAdminSessionToken(adminKey: string): string {
  return crypto.createHmac("sha256", SESSION_SECRET).update(adminKey).digest("hex");
}

/**
 * Parses cookie string from Request headers into key-value map.
 */
export function parseCookies(req: Request): Record<string, string> {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies: Record<string, string> = {};
  cookieHeader.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx > 0) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  return cookies;
}

/**
 * Extracts sanitized visitor session ID from request headers or cookies.
 */
export function getVisitorId(req: Request): string {
  const headerId = (req.headers.get("x-paypilot-visitor-id") || "").trim();
  if (headerId && headerId.length <= 64) {
    return headerId.replace(/[^a-zA-Z0-9_-]/g, "");
  }
  const cookies = parseCookies(req);
  const cookieId = (cookies["paypilot_visitor_id"] || "").trim();
  if (cookieId && cookieId.length <= 64) {
    return cookieId.replace(/[^a-zA-Z0-9_-]/g, "");
  }
  return "";
}

/**
 * Checks whether the incoming request carries verified administrative credentials.
 * Supports:
 * 1. Authorization: Bearer <key> or x-api-key header
 * 2. httpOnly paypilot_admin_session cookie
 */
export function isRequestAdmin(req: Request): boolean {
  const configuredKey = getConfiguredAdminKey();
  if (!configuredKey) return false;

  // 1. Check header
  const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token && token.length === configuredKey.length) {
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(configuredKey))) {
      return true;
    }
  }

  // 2. Check httpOnly session cookie
  const cookies = parseCookies(req);
  const sessionToken = (cookies["paypilot_admin_session"] || "").trim();
  if (sessionToken) {
    const expectedToken = createAdminSessionToken(configuredKey);
    if (sessionToken.length === expectedToken.length) {
      if (crypto.timingSafeEqual(Buffer.from(sessionToken), Buffer.from(expectedToken))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validates whether write mutations (create goal, update, approve, capture, demo reset)
 * are permitted for the incoming HTTP request.
 */
export function checkWriteAuthorization(
  req: Request,
  context?: AuthTargetContext
): AuthCheckResult {
  const configuredKey = getConfiguredAdminKey();
  const isProduction = process.env.NODE_ENV === "production";
  const demoModeDisabled = process.env.DEMO_MODE === "false";
  const isAdmin = isRequestAdmin(req);

  // 1. If Admin credentials verified (header or session cookie), grant admin authorization
  if (isAdmin) {
    return { authorized: true, isAdmin: true };
  }

  // If a header key was provided but did not match:
  const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token && configuredKey) {
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
  if (context?.isSimulated === false) {
    return {
      authorized: false,
      reason: "Unauthorized: Real PayPal Sandbox operations require administrative authorization.",
      statusCode: 401,
    };
  }

  // 4. Production Environment
  if (isProduction) {
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
  visitorId: string;
  reason?: string;
  statusCode?: number;
}

/**
 * Protects and scopes read access to customer profiles, payment history, memories, and goals.
 */
export function checkReadAuthorization(req: Request): ReadScopeResult {
  const isProduction = process.env.NODE_ENV === "production";
  const demoModeDisabled = process.env.DEMO_MODE === "false";
  const isAdmin = isRequestAdmin(req);
  const visitorId = getVisitorId(req);

  if (isAdmin) {
    return { authorized: true, isAdmin: true, scope: "all", visitorId };
  }

  if (isProduction && demoModeDisabled) {
    return {
      authorized: false,
      isAdmin: false,
      scope: "demo_only",
      visitorId,
      reason: "Unauthorized: Read access requires administrative authentication when demo mode is disabled.",
      statusCode: 401,
    };
  }

  if (isProduction) {
    return { authorized: true, isAdmin: false, scope: "demo_only", visitorId };
  }

  // Development and test environments
  return { authorized: true, isAdmin: false, scope: "demo_only", visitorId };
}

/**
 * Validates payment order provenance.
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
 * Scopes goals: Admin sees all; anonymous sees canonical fixtures + this visitor's own goals.
 */
export function scopeGoalsForRequester(
  goals: PaymentGoal[],
  isAdmin: boolean,
  visitorId?: string
): PaymentGoal[] {
  if (isAdmin) return goals;
  return goals.filter((g) => {
    if (CANONICAL_DEMO_GOAL_IDS.has(g.id)) return true;
    if (g.isSimulated && visitorId && g.visitorId === visitorId) return true;
    return false;
  });
}

/**
 * Scopes customers: Admin sees all; anonymous sees canonical fixtures + this visitor's own customers.
 */
export function scopeCustomersForRequester(
  customers: Customer[],
  isAdmin: boolean,
  visitorId?: string
): Customer[] {
  if (isAdmin) return customers;
  return customers.filter((c) => {
    if (CANONICAL_DEMO_CUSTOMER_IDS.has(c.id)) return true;
    if (visitorId && c.visitorId === visitorId) return true;
    return false;
  });
}

/**
 * Scopes memories: Admin sees all; anonymous sees canonical fixtures + this visitor's own memories.
 */
export function scopeMemoriesForRequester(
  memories: MemoryItem[],
  isAdmin: boolean,
  visitorId?: string
): MemoryItem[] {
  if (isAdmin) return memories;
  return memories.filter((m) => {
    if (CANONICAL_DEMO_MEMORY_IDS.has(m.id)) return true;
    if (visitorId && m.visitorId === visitorId) return true;
    return false;
  });
}

/**
 * Scopes recommendations: Admin sees all; anonymous sees canonical fixtures.
 */
export function scopeRecommendationsForRequester(
  recommendations: AIRecommendation[],
  isAdmin: boolean,
  visitorId?: string
): AIRecommendation[] {
  if (isAdmin) return recommendations;
  return recommendations.filter((r) => {
    if (CANONICAL_DEMO_RECOMMENDATION_IDS.has(r.id)) return true;
    if (visitorId && r.visitorId === visitorId) return true;
    return false;
  });
}

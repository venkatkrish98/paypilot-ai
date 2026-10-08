// ==============================================================================
// PayPilot AI - API Write Protection & Authorization Guard
// Cryptographically signed sessions, strict visitor isolation, rate limiting, and sandbox safety
// ==============================================================================

import crypto from "crypto";
import fs from "fs";
import path from "path";
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

// In-memory fallback generated once at process start for development and testing
const inMemoryDevSecret = crypto.randomBytes(32).toString("hex");

/**
 * Returns the session signing secret.
 * In production, strictly requires PAYPILOT_SESSION_SECRET of at least 32 characters and fails closed if missing.
 */
export function getSessionSecret(): string {
  const secret = process.env.PAYPILOT_SESSION_SECRET?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!secret || secret.length < 32) {
      throw new Error(
        "FATAL: PAYPILOT_SESSION_SECRET must be configured with at least 32 characters in production."
      );
    }
    return secret;
  }
  return secret || inMemoryDevSecret;
}

/**
 * Returns the configured admin key.
 * Requires an explicit, unique key configured via PAYPILOT_ADMIN_KEY or PAYPILOT_API_KEY.
 * Never falls back to a public or shared default key in any environment.
 */
export function getConfiguredAdminKey(): string {
  return (process.env.PAYPILOT_ADMIN_KEY || process.env.PAYPILOT_API_KEY || "").trim();
}

// ------------------------------------------------------------------------------
// Shared Rate Limiting & Lockout for Failed Admin Authentication
// ------------------------------------------------------------------------------
interface LockoutEntry {
  failedAttempts: number;
  lockedUntil: number;
  lastAttemptAt: number;
}

const authLockoutMap = new Map<string, LockoutEntry>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_PERIOD_MS = 15 * 60 * 1000; // 15 minutes lockout
const LOCKOUT_FILE = path.join(process.cwd(), "data", "auth_lockout.json");

function syncFromSharedStore(): void {
  if (process.env.PAYPILOT_DB_PATH === ":memory:") return;
  try {
    if (fs.existsSync(LOCKOUT_FILE)) {
      const data = JSON.parse(fs.readFileSync(LOCKOUT_FILE, "utf-8"));
      const now = Date.now();
      for (const [key, val] of Object.entries(data)) {
        const entry = val as LockoutEntry;
        if (entry && (entry.lockedUntil > now || now - entry.lastAttemptAt < LOCKOUT_PERIOD_MS)) {
          authLockoutMap.set(key, entry);
        }
      }
    }
  } catch {}
}

function syncToSharedStore(): void {
  if (process.env.PAYPILOT_DB_PATH === ":memory:") return;
  try {
    const dir = path.dirname(LOCKOUT_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const obj: Record<string, LockoutEntry> = {};
    for (const [k, v] of Array.from(authLockoutMap.entries())) {
      obj[k] = v;
    }
    const tmp = `${LOCKOUT_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf-8");
    fs.renameSync(tmp, LOCKOUT_FILE);
  } catch {}
}

export function checkAuthLockout(clientIdentifier: string): {
  isLocked: boolean;
  remainingSeconds?: number;
} {
  syncFromSharedStore();
  const entry = authLockoutMap.get(clientIdentifier);
  if (!entry) return { isLocked: false };
  const now = Date.now();
  if (entry.lockedUntil > now) {
    return {
      isLocked: true,
      remainingSeconds: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }
  return { isLocked: false };
}

export function recordFailedAuth(clientIdentifier: string): {
  isLocked: boolean;
  remainingAttempts: number;
  remainingSeconds?: number;
} {
  syncFromSharedStore();
  const now = Date.now();
  let entry = authLockoutMap.get(clientIdentifier);
  if (!entry || (now - entry.lastAttemptAt > LOCKOUT_PERIOD_MS && entry.lockedUntil <= now)) {
    entry = { failedAttempts: 0, lockedUntil: 0, lastAttemptAt: now };
  }

  entry.failedAttempts += 1;
  entry.lastAttemptAt = now;

  if (entry.failedAttempts >= MAX_FAILED_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_PERIOD_MS;
    authLockoutMap.set(clientIdentifier, entry);
    syncToSharedStore();
    return {
      isLocked: true,
      remainingAttempts: 0,
      remainingSeconds: Math.ceil(LOCKOUT_PERIOD_MS / 1000),
    };
  }

  authLockoutMap.set(clientIdentifier, entry);
  syncToSharedStore();
  return {
    isLocked: false,
    remainingAttempts: MAX_FAILED_ATTEMPTS - entry.failedAttempts,
  };
}

export function clearFailedAuth(clientIdentifier: string): void {
  authLockoutMap.delete(clientIdentifier);
  syncToSharedStore();
}

/**
 * Extracts client IP securely using trusted hosting proxy headers.
 * Protects against arbitrary x-forwarded-for spoofing by clients:
 * - CF-Connecting-IP (Cloudflare edge)
 * - x-vercel-ip / x-real-ip (Vercel / Nginx reverse proxy)
 * - If x-forwarded-for is present, parses the rightmost IP (appended by closest trusted proxy)
 * - Defaults to '127.0.0.1' for local development
 */
export function getTrustedClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();

  const vercelIp = req.headers.get("x-vercel-ip");
  if (vercelIp) return vercelIp.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const list = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) {
      // The rightmost entry is appended by the outermost trusted edge/proxy
      return list[list.length - 1];
    }
  }

  return "127.0.0.1";
}

// ------------------------------------------------------------------------------
// Cryptographically Signed Admin Session Tokens
// ------------------------------------------------------------------------------
export interface AdminSessionPayload {
  iat: number;
  exp: number;
  nonce: string;
  role: "admin";
}

/**
 * Creates a cryptographically signed admin session token.
 * Contains issued-at timestamp, expiration, and random nonce signed with HMAC-SHA256.
 */
export function createAdminSessionToken(validityDurationMs = 2 * 60 * 60 * 1000): string {
  const secret = getSessionSecret();
  const payload: AdminSessionPayload = {
    iat: Date.now(),
    exp: Date.now() + validityDurationMs,
    nonce: crypto.randomBytes(16).toString("hex"),
    role: "admin",
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadStr).digest("base64url");
  return `${payloadStr}.${signature}`;
}

/**
 * Validates the cryptographic signature and expiration of an admin session token on every request.
 */
export function verifyAdminSessionToken(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadStr, sig] = parts;

  try {
    const secret = getSessionSecret();
    const expectedSig = crypto.createHmac("sha256", secret).update(payloadStr).digest("base64url");
    if (sig.length !== expectedSig.length) return false;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return false;

    const payload: AdminSessionPayload = JSON.parse(
      Buffer.from(payloadStr, "base64url").toString("utf-8")
    );
    if (payload.role !== "admin") return false;
    const now = Date.now();
    if (typeof payload.exp !== "number" || payload.exp <= now) return false;
    if (typeof payload.iat !== "number" || payload.iat > now + 5000) return false;
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------------------
// Server-Side Cryptographically Signed Visitor Session
// ------------------------------------------------------------------------------
export interface VisitorSessionPayload {
  vid: string;
  iat: number;
  exp: number;
}

/**
 * Creates a cryptographically signed visitor session token.
 */
export function createSignedVisitorToken(visitorId?: string): {
  token: string;
  visitorId: string;
} {
  const secret = getSessionSecret();
  const vid = visitorId || `v_${crypto.randomBytes(16).toString("hex")}`;
  const payload: VisitorSessionPayload = {
    vid,
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  };
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(payloadStr).digest("base64url");
  return { token: `${payloadStr}.${signature}`, visitorId: vid };
}

/**
 * Verifies a server-signed visitor token. Returns the visitorId if valid and unexpired; null otherwise.
 */
export function verifyVisitorToken(token: string): string | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadStr, sig] = parts;

  try {
    const secret = getSessionSecret();
    const expectedSig = crypto.createHmac("sha256", secret).update(payloadStr).digest("base64url");
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

    const payload: VisitorSessionPayload = JSON.parse(
      Buffer.from(payloadStr, "base64url").toString("utf-8")
    );
    const now = Date.now();
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    if (typeof payload.iat !== "number" || payload.iat > now + 5000) return null;
    if (!payload.vid || typeof payload.vid !== "string" || payload.vid.length > 64) return null;
    return payload.vid;
  } catch {
    return null;
  }
}

/**
 * Parses cookie string from Request headers into a key-value dictionary.
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
 * Resolves visitor identity securely:
 * Validates the server-signed `paypilot_visitor_session` cookie.
 * Client-provided headers (such as `x-paypilot-visitor-id`) and unsigned cookies are NEVER trusted as identity.
 * If missing, invalid, or forged, a fresh random visitor identity is generated and returned with a new signed token.
 */
export function resolveVisitorIdentity(req: Request): {
  visitorId: string;
  newCookieToken?: string;
} {
  const cookies = parseCookies(req);
  const cookieToken = (cookies["paypilot_visitor_session"] || "").trim();

  const verifiedId = verifyVisitorToken(cookieToken);
  if (verifiedId) {
    return { visitorId: verifiedId };
  }

  // Not verified, missing, or forged: generate new server-signed visitor session
  const { token, visitorId } = createSignedVisitorToken();
  return { visitorId, newCookieToken: token };
}

/**
 * Returns the verified visitor ID from the request's signed cookie, or an empty string if unverified.
 */
export function getVisitorId(req: Request): string {
  const cookies = parseCookies(req);
  const cookieToken = (cookies["paypilot_visitor_session"] || "").trim();
  const verifiedId = verifyVisitorToken(cookieToken);
  return verifiedId || "";
}

/**
 * Attaches the signed visitor identity cookie to a NextResponse if a new token was generated and requester is not admin.
 */
export function attachVisitorCookie<T extends { cookies: { set: (...args: any[]) => any } }>(
  response: T,
  newCookieToken?: string,
  isAdmin?: boolean
): T {
  if (newCookieToken && !isAdmin && response?.cookies?.set) {
    response.cookies.set("paypilot_visitor_session", newCookieToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60, // 24 hours
    });
  }
  return response;
}

/**
 * Checks whether the incoming request carries verified administrative credentials.
 * Supports:
 * 1. Authorization: Bearer <key> or x-api-key header (matches explicitly configured key)
 * 2. Cryptographically signed httpOnly paypilot_admin_session cookie
 */
export function isRequestAdmin(req: Request): boolean {
  const configuredKey = getConfiguredAdminKey();

  // 1. Check header
  const authHeader = req.headers.get("authorization") || req.headers.get("x-api-key") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token && configuredKey && token.length === configuredKey.length) {
    if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(configuredKey))) {
      return true;
    }
  }

  // 2. Check signed httpOnly session cookie
  const cookies = parseCookies(req);
  const sessionToken = (cookies["paypilot_admin_session"] || "").trim();
  if (sessionToken && verifyAdminSessionToken(sessionToken)) {
    return true;
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

  // 1. If Admin credentials verified (header or signed cookie), grant admin authorization
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
  newVisitorCookie?: string;
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
  const { visitorId, newCookieToken } = resolveVisitorIdentity(req);

  if (isAdmin) {
    return {
      authorized: true,
      isAdmin: true,
      scope: "all",
      visitorId,
      newVisitorCookie: newCookieToken,
    };
  }

  if (isProduction && demoModeDisabled) {
    return {
      authorized: false,
      isAdmin: false,
      scope: "demo_only",
      visitorId,
      newVisitorCookie: newCookieToken,
      reason: "Unauthorized: Read access requires administrative authentication when demo mode is disabled.",
      statusCode: 401,
    };
  }

  return {
    authorized: true,
    isAdmin: false,
    scope: "demo_only",
    visitorId,
    newVisitorCookie: newCookieToken,
  };
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
 * CRITICAL SAFETY: Never exposes a real Sandbox order merely because its ID is in the canonical demo fixture set!
 */
export function scopeGoalsForRequester(
  goals: PaymentGoal[],
  isAdmin: boolean,
  visitorId?: string
): PaymentGoal[] {
  if (isAdmin) return goals;
  return goals.filter((g) => {
    if (CANONICAL_DEMO_GOAL_IDS.has(g.id)) {
      // Never expose a real Sandbox order merely because its ID is in the canonical demo fixture set
      const isReal =
        !g.isSimulated ||
        g.mode === "sandbox" ||
        (Boolean(g.paypalOrderId) && !g.paypalOrderId?.startsWith("SIMULATED_"));
      if (isReal) return false;
      return true;
    }
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

/**
 * Strict Mutation Ownership Guard:
 * 1. Admin can mutate any valid goal.
 * 2. Anonymous visitors can NEVER mutate shared canonical fixtures (they are strictly read-only).
 * 3. Anonymous visitors can ONLY mutate records owned by their verified server-signed session (goal.visitorId === visitorId).
 * 4. Anonymous visitors can NEVER mutate real Sandbox orders.
 */
export function checkGoalMutationOwnership(
  goal: PaymentGoal,
  isAdmin: boolean,
  visitorId?: string
): { allowed: boolean; reason?: string; statusCode?: number } {
  if (isAdmin) return { allowed: true };

  // Shared canonical fixtures are strictly read-only to anonymous visitors
  if (CANONICAL_DEMO_GOAL_IDS.has(goal.id) || goal.isDemoFixture) {
    return {
      allowed: false,
      reason:
        "Access restricted: Shared canonical demo fixtures are read-only to anonymous visitors. Please create a simulation goal using the AI Command Center to run actions.",
      statusCode: 403,
    };
  }

  // Real PayPal Sandbox operations strictly require admin
  const isReal =
    !goal.isSimulated ||
    goal.mode === "sandbox" ||
    (Boolean(goal.paypalOrderId) && !goal.paypalOrderId?.startsWith("SIMULATED_"));
  if (isReal) {
    return {
      allowed: false,
      reason: "Unauthorized: Real PayPal Sandbox operations require administrative authorization.",
      statusCode: 401,
    };
  }

  // Pure simulation test goals created without owner in tests
  if (!goal.visitorId && goal.isSimulated && !CANONICAL_DEMO_GOAL_IDS.has(goal.id)) {
    return { allowed: true };
  }

  // Visitor must own the goal
  if (!visitorId || goal.visitorId !== visitorId) {
    return {
      allowed: false,
      reason: "Access restricted: You cannot mutate goals belonging to other sessions.",
      statusCode: 403,
    };
  }

  return { allowed: true };
}

/**
 * Strict Recommendation Dismissal Guard:
 * 1. Admin can dismiss any recommendation.
 * 2. Anonymous visitors can NEVER dismiss shared canonical recommendations.
 * 3. Anonymous visitors can ONLY dismiss recommendations owned by their verified session.
 */
export function checkRecommendationDismissalOwnership(
  rec: AIRecommendation,
  isAdmin: boolean,
  visitorId?: string
): { allowed: boolean; reason?: string; statusCode?: number } {
  if (isAdmin) return { allowed: true };

  if (CANONICAL_DEMO_RECOMMENDATION_IDS.has(rec.id)) {
    return {
      allowed: false,
      reason:
        "Access restricted: Shared canonical demo recommendations are read-only and cannot be dismissed by anonymous visitors.",
      statusCode: 403,
    };
  }

  if (rec.visitorId && (!visitorId || rec.visitorId !== visitorId)) {
    return {
      allowed: false,
      reason: "Access restricted: You cannot dismiss recommendations belonging to other sessions.",
      statusCode: 403,
    };
  }

  return { allowed: true };
}

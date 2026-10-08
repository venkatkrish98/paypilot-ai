import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  isRequestAdmin,
  getConfiguredAdminKey,
  createAdminSessionToken,
  checkAuthLockout,
  recordFailedAuth,
  clearFailedAuth,
  resolveVisitorIdentity,
  getTrustedClientIp,
} from "@/packages/security/auth";
import { defaultPayPalClient } from "@/packages/paypal";

export async function GET(req: Request) {
  const isAdmin = isRequestAdmin(req);
  const demoMode = process.env.DEMO_MODE !== "false";
  const paypalConfigured = defaultPayPalClient.isConfigured();
  const effectiveMode = paypalConfigured && isAdmin ? "sandbox" : "simulation";

  const { visitorId, newCookieToken } = resolveVisitorIdentity(req);

  const response = NextResponse.json({
    authenticated: isAdmin,
    role: isAdmin ? "admin" : "anonymous",
    mode: effectiveMode,
    paypalConfigured,
    demoMode,
    sandboxAccess: isAdmin,
    simulationAccess: true,
    visitorId: isAdmin ? undefined : visitorId,
    message: isAdmin
      ? paypalConfigured
        ? "Administrator credentials verified. PayPal Sandbox mode unlocked."
        : "Administrator credentials verified. (PayPal credentials not yet configured in .env)."
      : "Anonymous session. Operations strictly restricted to simulation demo mode.",
  });

  // Issue or refresh server-signed visitor identity cookie for anonymous sessions
  if (newCookieToken && !isAdmin) {
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

export async function POST(req: Request) {
  try {
    const clientIp = getTrustedClientIp(req);

    // 1. Check Rate Limit / Lockout
    const lockout = checkAuthLockout(clientIp);
    if (lockout.isLocked) {
      return NextResponse.json(
        {
          error: `Too many failed authentication attempts. Access locked out for ${lockout.remainingSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const adminKey = (body?.adminKey || "").trim();

    const configuredKey = getConfiguredAdminKey();
    if (!configuredKey) {
      return NextResponse.json(
        {
          error:
            "No administrator key configured on server. Please configure PAYPILOT_ADMIN_KEY in environment.",
        },
        { status: 500 }
      );
    }

    const isMatch =
      adminKey.length === configuredKey.length &&
      crypto.timingSafeEqual(Buffer.from(adminKey), Buffer.from(configuredKey));

    if (!isMatch) {
      const failStatus = recordFailedAuth(clientIp);
      const errorMsg = failStatus.isLocked
        ? "Invalid admin key provided. Maximum attempts exceeded. Locked out for 15 minutes."
        : `Invalid admin key provided. Remaining attempts before lockout: ${failStatus.remainingAttempts}.`;
      return NextResponse.json({ error: errorMsg }, { status: 401 });
    }

    // Authentication succeeded: clear lockout counter
    clearFailedAuth(clientIp);

    // Create cryptographically signed admin session token (2-hour validity)
    const sessionToken = createAdminSessionToken();
    const paypalConfigured = defaultPayPalClient.isConfigured();
    const effectiveMode = paypalConfigured ? "sandbox" : "simulation";

    const response = NextResponse.json({
      success: true,
      authenticated: true,
      role: "admin",
      mode: effectiveMode,
      paypalConfigured,
      message: paypalConfigured
        ? "Admin authentication successful. PayPal Sandbox mode active."
        : "Admin authentication successful. (Add PayPal Sandbox credentials to .env to execute live Orders v2).",
    });

    // Set secure, httpOnly, same-site signed session cookie
    response.cookies.set("paypilot_admin_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60, // 2 hours
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error processing authentication" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    authenticated: false,
    role: "anonymous",
    mode: "simulation",
    message: "Logged out to anonymous simulation demo session.",
  });

  // Clear httpOnly admin session cookie
  response.cookies.set("paypilot_admin_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}

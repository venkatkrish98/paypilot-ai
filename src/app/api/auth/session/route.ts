import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  isRequestAdmin,
  getConfiguredAdminKey,
  createAdminSessionToken,
} from "@/packages/security/auth";
import { defaultPayPalClient } from "@/packages/paypal";

export async function GET(req: Request) {
  const isAdmin = isRequestAdmin(req);
  const isProduction = process.env.NODE_ENV === "production";
  const demoMode = process.env.DEMO_MODE !== "false";
  const paypalConfigured = defaultPayPalClient.isConfigured();
  const effectiveMode = (paypalConfigured && isAdmin) ? "sandbox" : "simulation";

  return NextResponse.json({
    authenticated: isAdmin,
    role: isAdmin ? "admin" : "anonymous",
    mode: effectiveMode,
    paypalConfigured,
    demoMode,
    sandboxAccess: isAdmin,
    simulationAccess: true,
    message: isAdmin
      ? (paypalConfigured
          ? "Administrator credentials verified. PayPal Sandbox mode unlocked."
          : "Administrator credentials verified. (PayPal credentials not yet configured in .env).")
      : "Anonymous session. Operations strictly restricted to simulation demo mode.",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const adminKey = (body?.adminKey || "").trim();

    const configuredKey = getConfiguredAdminKey();
    if (!configuredKey) {
      return NextResponse.json(
        { error: "No admin key configured on server." },
        { status: 500 }
      );
    }

    const isMatch =
      adminKey.length === configuredKey.length &&
      crypto.timingSafeEqual(Buffer.from(adminKey), Buffer.from(configuredKey));

    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid admin key provided." },
        { status: 401 }
      );
    }

    const sessionToken = createAdminSessionToken(configuredKey);
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

    // Set secure httpOnly session cookie
    response.cookies.set("paypilot_admin_session", sessionToken, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 24 hours
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

  response.cookies.set("paypilot_admin_session", "", {
    httpOnly: true,
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });

  return response;
}

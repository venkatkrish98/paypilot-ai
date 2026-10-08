import { NextResponse } from "next/server";
import { isRequestAdmin } from "@/packages/security/auth";

export async function GET(req: Request) {
  const isAdmin = isRequestAdmin(req);
  const isProduction = process.env.NODE_ENV === "production";
  const demoMode = process.env.DEMO_MODE !== "false";

  // Truthful session status inspection: Never grants mutation authority to anonymous callers
  // and never returns an authorization token to anyone.
  return NextResponse.json({
    authenticated: isAdmin,
    role: isAdmin ? "admin" : "anonymous",
    mode: isProduction ? "production" : "development",
    demoMode,
    sandboxAccess: isAdmin,
    simulationAccess: demoMode,
    message: isAdmin
      ? "Administrator credentials verified."
      : "Anonymous session. Operations strictly restricted to simulation demo mode.",
  });
}

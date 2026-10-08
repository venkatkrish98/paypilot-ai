import { NextResponse } from "next/server";
import { defaultPayPalClient } from "@/packages/paypal";
import { defaultAIPlanner } from "@/packages/agent/ai-planner";
import { SafeSystemConfig } from "@/packages/types";

import { isRequestAdmin } from "@/packages/security/auth";

export async function GET(req: Request) {
  const isConfigured = defaultPayPalClient.isConfigured();
  const isAdmin = isRequestAdmin(req);
  const effectiveMode = (isConfigured && isAdmin) ? "sandbox" : "simulation";

  const envThreshold = process.env.PAYPILOT_REVIEW_THRESHOLD
    ? parseFloat(process.env.PAYPILOT_REVIEW_THRESHOLD)
    : 2000;

  const hasVerified = defaultAIPlanner.hasVerifiedGemini();
  const isAvailable = defaultAIPlanner.isAIAvailable();
  const hasAdminKey = Boolean(
    (process.env.PAYPILOT_ADMIN_KEY || process.env.PAYPILOT_API_KEY || "").trim()
  );
  const isProduction = process.env.NODE_ENV === "production";
  const demoModeDisabled = process.env.DEMO_MODE === "false";

  const writesProtected = hasAdminKey || isProduction;
  const protectionPolicy = hasAdminKey
    ? "admin_key_enforced"
    : demoModeDisabled
    ? "disabled_fail_closed"
    : isProduction
    ? "simulation_only_demo"
    : "development_permissive";

  const config: SafeSystemConfig = {
    paypalConfigured: isConfigured,
    paypalEnvironment: "sandbox",
    mode: effectiveMode,
    reviewThreshold: envThreshold,
    storageType: "local_durable_file",
    aiProvider: hasVerified
      ? "Google Gemini 3.8 Flash (Verified Live)"
      : isAvailable
      ? "Google Gemini 3.8 Flash (Configured, Fallback Ready)"
      : "Deterministic NLP Parser (Offline / Verified Fallback)",
    geminiLiveVerified: hasVerified,
    environmentEnforced: "sandbox",
    writesProtected,
    protectionPolicy,
    demoMode: !demoModeDisabled,
    adminAuthenticated: isAdmin,
    canExecuteSandbox: isConfigured && isAdmin,
  };

  return NextResponse.json(config);
}

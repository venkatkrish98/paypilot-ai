import { NextResponse } from "next/server";
import { defaultPayPalClient } from "@/packages/paypal";
import { defaultAIPlanner } from "@/packages/agent/ai-planner";
import { SafeSystemConfig } from "@/packages/types";

export async function GET() {
  const isConfigured = defaultPayPalClient.isConfigured();
  const envThreshold = process.env.PAYPILOT_REVIEW_THRESHOLD
    ? parseFloat(process.env.PAYPILOT_REVIEW_THRESHOLD)
    : 2000;

  const hasVerified = defaultAIPlanner.hasVerifiedGemini();
  const isAvailable = defaultAIPlanner.isAIAvailable();
  const writesProtected = Boolean(
    process.env.PAYPILOT_ADMIN_KEY ||
      process.env.PAYPILOT_API_KEY ||
      (process.env.NODE_ENV === "production" && process.env.DEMO_MODE === "false")
  );

  const config: SafeSystemConfig = {
    paypalConfigured: isConfigured,
    paypalEnvironment: "sandbox",
    mode: isConfigured ? "sandbox" : "simulation",
    reviewThreshold: envThreshold,
    storageType: "local_durable_file",
    aiProvider: hasVerified
      ? "Google Gemini 2.5 Flash (Verified Live)"
      : isAvailable
      ? "Google Gemini 2.5 Flash (Configured, Fallback Ready)"
      : "Deterministic NLP Parser (Offline / Verified Fallback)",
    geminiLiveVerified: hasVerified,
    environmentEnforced: "sandbox",
    writesProtected,
    demoMode: process.env.DEMO_MODE !== "false",
  };

  return NextResponse.json(config);
}

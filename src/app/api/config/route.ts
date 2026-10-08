import { NextResponse } from "next/server";
import { defaultPayPalClient } from "@/packages/paypal";
import { defaultAIPlanner } from "@/packages/agent/ai-planner";
import { SafeSystemConfig } from "@/packages/types";

export async function GET() {
  const isConfigured = defaultPayPalClient.isConfigured();
  const envThreshold = process.env.PAYPILOT_REVIEW_THRESHOLD
    ? parseFloat(process.env.PAYPILOT_REVIEW_THRESHOLD)
    : 2000;

  const config: SafeSystemConfig = {
    paypalConfigured: isConfigured,
    paypalEnvironment: defaultPayPalClient.getEnvironment(),
    mode: isConfigured ? "sandbox" : "simulation",
    reviewThreshold: envThreshold,
    storageType: "local_durable_file",
    aiProvider: defaultAIPlanner.isAIAvailable()
      ? "Google Gemini 2.5 Flash"
      : "Deterministic NLP Parser (Offline / Verified Fallback)",
    demoMode: process.env.DEMO_MODE !== "false",
  };

  return NextResponse.json(config);
}

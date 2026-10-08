import { NextResponse } from "next/server";
import { db } from "@/packages/database";

export async function POST() {
  try {
    // Protect demo-reset if explicitly disabled in production
    if (process.env.ALLOW_DEMO_RESET === "false") {
      return NextResponse.json(
        { error: "Demo reset is disabled in this environment." },
        { status: 403 }
      );
    }

    db.seedDemoData();
    return NextResponse.json({
      success: true,
      message: "Database reset to initial demo state",
      metrics: db.getMetrics(),
      goals: db.getGoals(),
      customers: db.getCustomers(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error resetting demo data" },
      { status: 500 }
    );
  }
}

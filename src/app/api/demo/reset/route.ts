import { NextResponse } from "next/server";
import { db } from "@/packages/database";
import { checkWriteAuthorization } from "@/packages/security/auth";

export async function POST(req: Request) {
  try {
    const auth = checkWriteAuthorization(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.reason || "Unauthorized" }, { status: auth.statusCode || 401 });
    }

    // Protect demo-reset if explicitly disabled in environment
    if (process.env.ALLOW_DEMO_RESET === "false") {
      return NextResponse.json(
        { error: "Demo reset is disabled in this environment." },
        { status: 403 }
      );
    }

    db.resetDemoFixtures();
    return NextResponse.json({
      success: true,
      message: "Database safely reset to canonical demo fixtures",
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

import { NextResponse } from "next/server";
import { db } from "@/packages/database";
import {
  checkWriteAuthorization,
  isRequestAdmin,
  resolveVisitorIdentity,
  attachVisitorCookie,
  scopeGoalsForRequester,
  scopeCustomersForRequester,
} from "@/packages/security/auth";

export async function POST(req: Request) {
  try {
    const auth = checkWriteAuthorization(req, {
      isSimulated: true,
      action: "reset",
    });
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

    const isAdmin = isRequestAdmin(req);
    const { visitorId, newCookieToken } = resolveVisitorIdentity(req);

    if (isAdmin) {
      db.resetDemoFixtures();
    } else {
      // Anonymous visitor resets only their own simulation records!
      // NEVER touches shared canonical fixtures or another visitor's records!
      db.resetVisitorRecords(visitorId);
    }

    const visibleGoals = scopeGoalsForRequester(db.getGoals(), isAdmin, visitorId);
    const visibleCustomers = scopeCustomersForRequester(db.getCustomers(), isAdmin, visitorId);
    const metrics = db.getMetrics(visibleGoals);

    const response = NextResponse.json({
      success: true,
      message: isAdmin
        ? "Database safely reset to canonical demo fixtures"
        : "Visitor session data reset to pristine demo baseline",
      metrics,
      goals: visibleGoals,
      customers: visibleCustomers,
    });
    return attachVisitorCookie(response, newCookieToken, isAdmin);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error resetting demo data" },
      { status: 500 }
    );
  }
}

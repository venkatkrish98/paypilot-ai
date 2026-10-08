import { NextResponse } from "next/server";
import { db } from "@/packages/database";
import { GoalStatus } from "@/packages/types";

import { checkWriteAuthorization } from "@/packages/security/auth";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!params.id || typeof params.id !== "string") {
      return NextResponse.json({ error: "Invalid Goal ID format" }, { status: 400 });
    }
    const goal = db.getGoalById(params.id);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    return NextResponse.json({ goal });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching goal" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = checkWriteAuthorization(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.reason || "Unauthorized" }, { status: auth.statusCode || 401 });
    }

    if (!params.id || typeof params.id !== "string") {
      return NextResponse.json({ error: "Invalid Goal ID format" }, { status: 400 });
    }

    const body = await req.json();
    const existing = db.getGoalById(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Immutable Terminal States
    if (existing.status === "paid") {
      return NextResponse.json(
        { error: "Cannot modify payment goal: reconciled paid transactions are immutable." },
        { status: 400 }
      );
    }
    if (existing.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot modify cancelled payment goal." },
        { status: 400 }
      );
    }

    // Whitelist allowed fields to prevent arbitrary field corruption
    const allowedFields = ["status", "notes", "deadline", "purpose"];
    const invalidFields = Object.keys(body).filter((k) => !allowedFields.includes(k));
    if (invalidFields.length > 0) {
      return NextResponse.json(
        { error: `Cannot overwrite protected fields: ${invalidFields.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate status transition if status is being updated
    if (body.status) {
      const validStatuses: GoalStatus[] = [
        "draft",
        "pending_approval",
        "payment_created",
        "awaiting_payment",
        "paid",
        "failed",
        "expired",
        "cancelled",
      ];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status: "${body.status}". Allowed values: ${validStatuses.join(", ")}` },
          { status: 400 }
        );
      }

      // CRITICAL: Prevent bypassing human approval
      if (existing.status === "pending_approval" && body.status === "awaiting_payment") {
        return NextResponse.json(
          { error: "Forbidden: Cannot bypass approval workflow. Goals pending approval must be authorized via the /approve endpoint." },
          { status: 403 }
        );
      }

      // Disallow manual skip to "paid" without capture validation
      if (body.status === "paid") {
        return NextResponse.json(
          { error: "Cannot manually transition goal to 'paid'. Use the /capture endpoint to confirm payment." },
          { status: 400 }
        );
      }
      existing.status = body.status;
    }

    if (body.notes !== undefined) existing.notes = String(body.notes).slice(0, 500);
    if (body.deadline !== undefined) existing.deadline = String(body.deadline).slice(0, 50);
    if (body.purpose !== undefined) existing.purpose = String(body.purpose).slice(0, 200);

    existing.updatedAt = new Date().toISOString();
    db.saveGoal(existing);

    return NextResponse.json({ goal: existing, metrics: db.getMetrics() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error updating goal" },
      { status: 500 }
    );
  }
}

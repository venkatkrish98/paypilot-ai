import { NextResponse } from "next/server";
import { db } from "@/packages/database";
import { GoalStatus } from "@/packages/types";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
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
    const body = await req.json();
    const existing = db.getGoalById(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
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

      // Disallow manual skip to "paid" without capture validation
      if (body.status === "paid" && existing.status !== "paid") {
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

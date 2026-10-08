import { NextResponse } from "next/server";
import { db } from "@/packages/database";
import { defaultPayPalClient } from "@/packages/paypal";
import { TimelineEvent } from "@/packages/types";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const goal = db.getGoalById(params.id);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Idempotency: Reject invalid transitions
    if (goal.status === "awaiting_payment" || goal.status === "paid") {
      return NextResponse.json(
        {
          error: "Goal has already been approved.",
          goal,
          isAlreadyApproved: true,
        },
        { status: 409 }
      );
    }

    if (goal.status !== "pending_approval") {
      return NextResponse.json(
        {
          error: `Cannot approve goal in "${goal.status}" status. Only pending_approval goals can be approved.`,
        },
        { status: 400 }
      );
    }

    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const isLiveSandbox = defaultPayPalClient.isConfigured() && !goal.isSimulated;

    // Create PayPal Order
    const paypalOrder = await defaultPayPalClient.createOrder({
      amount: goal.amount,
      currency: goal.currency,
      description: goal.purpose || goal.goal,
    });
    const checkoutUrl = defaultPayPalClient.getCheckoutUrl(paypalOrder);

    const approveEvent: TimelineEvent = {
      id: `t_appr_${Date.now()}`,
      timestamp: timeNow,
      stage: "order_created",
      title: isLiveSandbox ? "Payment Approved & PayPal Order Created" : "Payment Approved & Simulated Order Created",
      description: `Administrator approved disbursement of $${goal.amount.toLocaleString()}. Generated ${
        isLiveSandbox ? "PayPal Sandbox" : "Simulated"
      } order ${paypalOrder.id}.`,
      isSimulated: !isLiveSandbox,
    };

    goal.status = "awaiting_payment";
    goal.approvalStatus = "approved";
    goal.approvedAt = new Date().toISOString();
    goal.approvedBy = "Administrator (User)";
    goal.paypalOrderId = paypalOrder.id;
    goal.paypalPaymentLink = checkoutUrl;
    goal.timeline.push(approveEvent);

    db.saveGoal(goal);

    return NextResponse.json({
      success: true,
      goal,
      metrics: db.getMetrics(),
      message: `Payment of $${goal.amount.toLocaleString()} approved. ${
        isLiveSandbox ? "PayPal Sandbox" : "Simulated"
      } Order ${paypalOrder.id} generated.`,
      isSimulated: !isLiveSandbox,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error approving payment" },
      { status: 500 }
    );
  }
}

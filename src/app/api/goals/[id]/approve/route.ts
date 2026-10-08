import { NextResponse } from "next/server";
import { db } from "@/packages/database";
import { defaultPayPalClient } from "@/packages/paypal";
import { TimelineEvent } from "@/packages/types";
import { checkWriteAuthorization } from "@/packages/security/auth";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = checkWriteAuthorization(req);
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.reason || "Unauthorized" }, { status: auth.statusCode || 401 });
    }

    const goal = db.getGoalById(params.id);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Idempotency: Reject invalid transitions
    if (goal.status === "awaiting_payment" || goal.status === "paid" || goal.status === "payout_approved" || goal.approvalStatus === "approved") {
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

    // Distinct Flow 1: Payout / Vendor Disbursement Review
    if (goal.goalType === "payout_review") {
      const approveEvent: TimelineEvent = {
        id: `t_appr_${Date.now()}`,
        timestamp: timeNow,
        stage: "goal_completed",
        title: "Vendor Disbursement Approved (Simulation Review)",
        description: `Administrator authorized vendor disbursement of $${goal.amount.toLocaleString()} for ${
          goal.customer
        }. Internal safety sign-off completed (Simulation Review; PayPal Payouts API required for live external dispatch).`,
        isSimulated: true,
      };

      goal.status = "payout_approved";
      goal.approvalStatus = "approved";
      goal.approvedAt = new Date().toISOString();
      goal.approvedBy = "Administrator (User)";
      goal.timeline.push(approveEvent);

      db.saveGoal(goal);

      // Reconcile vendor balance
      if (goal.customerId) {
        const customer = db.getCustomerById(goal.customerId);
        if (customer) {
          customer.outstandingAmount = Math.max(0, customer.outstandingAmount - goal.amount);
          customer.lastPaymentDate = new Date().toISOString().split("T")[0];
          customer.lastPaymentAmount = goal.amount;
          customer.paymentHistory.push({
            id: `hist_payout_${Date.now()}`,
            date: customer.lastPaymentDate,
            amount: goal.amount,
            currency: goal.currency,
            paypalOrderId: `SIMULATED_PAYOUT_REV_${Date.now().toString(36).toUpperCase()}`,
            status: "completed",
            purpose: goal.purpose || goal.goal,
            isSimulated: true,
          });
          db.saveCustomer(customer);
        }
      }

      return NextResponse.json({
        success: true,
        goal,
        metrics: db.getMetrics(),
        message: `Vendor disbursement of $${goal.amount.toLocaleString()} for ${goal.customer} approved and recorded (Simulation Review).`,
        isSimulated: true,
      });
    }

    // Distinct Flow 2: Incoming Collection Order (held for threshold or new customer review)
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
      title: isLiveSandbox ? "Collection Approved & PayPal Sandbox Order Created" : "Collection Approved & Simulated Order Created",
      description: `Administrator authorized collection order of $${goal.amount.toLocaleString()}. Generated ${
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
      message: `Collection goal of $${goal.amount.toLocaleString()} approved. ${
        isLiveSandbox ? "PayPal Sandbox" : "Simulated"
      } Order ${paypalOrder.id} ready.`,
      isSimulated: !isLiveSandbox,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error approving payment" },
      { status: 500 }
    );
  }
}

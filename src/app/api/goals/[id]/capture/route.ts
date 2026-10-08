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
    const goal = db.getGoalById(params.id);
    if (!goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // 1. Simulation route safety check: Reject real sandbox orders from simulation route
    const isSimulationCheckout = req.headers.get("x-simulation-checkout") === "true";
    if (!goal.isSimulated && isSimulationCheckout) {
      return NextResponse.json(
        {
          error:
            "Rejection: Real PayPal Sandbox orders cannot be captured from the simulation checkout route. Please complete buyer checkout in PayPal Sandbox.",
        },
        { status: 400 }
      );
    }

    // 2. Real authorization check: Anonymous callers can NEVER capture real Sandbox orders
    const auth = checkWriteAuthorization(req, {
      isSimulated: goal.isSimulated,
      action: "capture",
    });
    if (!auth.authorized) {
      return NextResponse.json(
        { error: auth.reason || "Unauthorized" },
        { status: auth.statusCode || 401 }
      );
    }

    // 1. Idempotency & State Transition Validation
    if (goal.status === "paid") {
      return NextResponse.json(
        {
          error: "Payment goal has already been paid and reconciled.",
          goal,
          isAlreadyPaid: true,
        },
        { status: 409 }
      );
    }

    if (goal.status === "pending_approval") {
      return NextResponse.json(
        {
          error:
            "Payment goal is currently held in pending_approval. High-risk actions require human sign-off before capture can occur.",
        },
        { status: 400 }
      );
    }

    if (goal.status !== "awaiting_payment" && goal.status !== "payment_created") {
      return NextResponse.json(
        {
          error: `Invalid state transition: cannot capture a payment goal in "${goal.status}" status.`,
        },
        { status: 400 }
      );
    }

    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const isLiveSandbox = defaultPayPalClient.isConfigured() && !goal.isSimulated;

    let captureResult;

    // 2. Execution (Live PayPal Sandbox vs Simulation)
    if (isLiveSandbox) {
      if (!goal.paypalOrderId) {
        return NextResponse.json(
          { error: "Goal is missing a valid PayPal Order ID for capture." },
          { status: 400 }
        );
      }

      // Live capture with strict approval and amount verification
      try {
        captureResult = await defaultPayPalClient.captureOrder(
          goal.paypalOrderId,
          goal.amount,
          goal.currency
        );
      } catch (err) {
        // PRESERVE previous state; DO NOT mark paid on failure!
        const errorMsg = err instanceof Error ? err.message : "PayPal Sandbox capture failed";
        console.error("PayPal Capture Error:", errorMsg);

        // Record a non-fatal failure attempt on the timeline
        goal.timeline.push({
          id: `t_err_${Date.now()}`,
          timestamp: timeNow,
          stage: "payment_failed",
          title: "Capture attempt failed",
          description: errorMsg,
          isSimulated: false,
        });
        db.saveGoal(goal);

        return NextResponse.json(
          {
            error: errorMsg,
            goal,
          },
          { status: 502 }
        );
      }
    } else {
      // Truthful Simulation Mode Capture
      captureResult = await defaultPayPalClient.captureOrder(
        goal.paypalOrderId || `SIMULATED_ORD_${Date.now()}`,
        goal.amount,
        goal.currency
      );
    }

    // 3. Mark Paid Only After Confirmed Capture
    const captureId = captureResult.id;
    const capturedAmount = parseFloat(captureResult.amount.value);
    const capturedCurrency = captureResult.amount.currency_code;

    const ev1: TimelineEvent = {
      id: `t_rec_${Date.now()}`,
      timestamp: timeNow,
      stage: "payment_detected",
      title: isLiveSandbox ? "PayPal Sandbox Payment Verified" : "Simulated Payment Received",
      description: isLiveSandbox
        ? `PayPal Sandbox capture ${captureId} verified for $${capturedAmount.toLocaleString()} ${capturedCurrency}.`
        : `Simulated capture ${captureId} completed ($${capturedAmount.toLocaleString()} ${capturedCurrency}) in Simulation Mode.`,
      isSimulated: !isLiveSandbox,
    };

    const ev2: TimelineEvent = {
      id: `t_comp_${Date.now()}`,
      timestamp: timeNow,
      stage: "goal_completed",
      title: "Goal Completed",
      description: `Payment goal successfully reconciled and closed.`,
      isSimulated: !isLiveSandbox,
    };

    goal.timeline.push(ev1, ev2);
    db.saveGoal(goal);

    // Reconcile payment and customer ledger idempotently
    db.reconcilePayment(goal.id, captureId, capturedAmount, capturedCurrency, !isLiveSandbox);

    const pendingApprovalGoal = db.getGoals().find((g) => g.status === "pending_approval");
    const nextActionSuggestion = pendingApprovalGoal
      ? `${goal.customer}'s payment of $${goal.amount.toLocaleString()} has been ${isLiveSandbox ? "confirmed via PayPal Sandbox" : "recorded in Simulation Mode"}! The payment goal is complete.\n\nNext action: ${pendingApprovalGoal.customer}'s $${pendingApprovalGoal.amount.toLocaleString()} disbursement review requires your approval.`
      : `${goal.customer}'s payment of $${goal.amount.toLocaleString()} has been reconciled! All payment goals are up to date.`;

    return NextResponse.json({
      success: true,
      goal,
      metrics: db.getMetrics(),
      agentMessage: nextActionSuggestion,
      recommendedGoalId: pendingApprovalGoal?.id,
      isSimulated: !isLiveSandbox,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error processing payment capture" },
      { status: 500 }
    );
  }
}

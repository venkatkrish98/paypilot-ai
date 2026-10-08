import { NextResponse } from "next/server";
import { db } from "@/packages/database";
import {
  checkReadAuthorization,
  checkWriteAuthorization,
  isRequestAdmin,
  resolveVisitorIdentity,
  attachVisitorCookie,
  scopeGoalsForRequester,
} from "@/packages/security/auth";
import { defaultPayPalClient } from "@/packages/paypal";
import { defaultSafetyEngine } from "@/packages/risk";
import { parseRelativeDate } from "@/packages/agent/ai-planner";
import { PaymentGoal, TimelineEvent } from "@/packages/types";

export async function GET(req: Request) {
  try {
    const readScope = checkReadAuthorization(req);
    if (!readScope.authorized) {
      return NextResponse.json(
        { error: readScope.reason || "Unauthorized" },
        { status: readScope.statusCode || 401 }
      );
    }

    const allGoals = db.getGoals();
    const goals = scopeGoalsForRequester(allGoals, readScope.isAdmin, readScope.visitorId);
    const metrics = db.getMetrics(goals);
    const response = NextResponse.json({ goals, metrics });
    return attachVisitorCookie(response, readScope.newVisitorCookie, readScope.isAdmin);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching goals" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const isAdmin = isRequestAdmin(req);
    const { visitorId, newCookieToken } = resolveVisitorIdentity(req);
    const isLive = isAdmin && defaultPayPalClient.isConfigured();
    const isSimulated = !isLive;

    const auth = checkWriteAuthorization(req, {
      isSimulated,
      action: "create",
    });
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.reason || "Unauthorized" }, { status: auth.statusCode || 401 });
    }

    const body = await req.json();

    // 1. Strict validation
    if (!body.goal || typeof body.goal !== "string" || body.goal.trim().length < 3) {
      return NextResponse.json(
        { error: "Validation Error: 'goal' description (min 3 chars) is required." },
        { status: 400 }
      );
    }

    const amountNum = typeof body.amount === "number" ? body.amount : parseFloat(body.amount);
    if (isNaN(amountNum) || amountNum <= 0 || amountNum > 1000000) {
      return NextResponse.json(
        { error: "Validation Error: 'amount' must be a positive number between $0.01 and $1,000,000." },
        { status: 400 }
      );
    }

    if (!body.customer || typeof body.customer !== "string" || body.customer.trim().length === 0) {
      return NextResponse.json(
        { error: "Validation Error: 'customer' name is required." },
        { status: 400 }
      );
    }

    const goalType = body.goalType === "payout_review" ? "payout_review" : "collection";
    const currency = (body.currency || "USD").toString().trim().toUpperCase().slice(0, 3);
    const deadline = body.deadline ? String(body.deadline).slice(0, 50) : parseRelativeDate(body.goal);
    const purpose = body.purpose ? String(body.purpose).slice(0, 200) : body.goal.trim();

    // Resolve or create customer profile
    let customer = db.findCustomerByName(body.customer.trim());
    if (!customer) {
      customer = {
        id: `cust_${Date.now()}`,
        name: body.customer.trim(),
        email: `${body.customer.toLowerCase().replace(/[^a-z0-9]/g, "")}@example.com`,
        outstandingAmount: goalType === "collection" ? amountNum : 0,
        riskIndicators: [],
        isNewRecipient: true,
        notes: "Created via payment goal dispatch.",
        paymentHistory: [],
        isDemoFixture: false,
        visitorId: isAdmin ? undefined : visitorId,
      };
      db.saveCustomer(customer);
    }

    // Evaluate Risk Checks
    const riskEval = defaultSafetyEngine.evaluate({
      amount: amountNum,
      currency,
      customer,
      customerName: customer.name,
      existingGoals: db.getGoals(),
      isPayout: goalType === "payout_review",
    });

    const mode = isLive ? "sandbox" : "simulation";
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    let orderId: string | undefined;
    let paymentLink: string | undefined;

    if (goalType === "collection") {
      const order = await defaultPayPalClient.createOrder({
        amount: amountNum,
        currency,
        description: purpose,
        customerEmail: customer.email,
        forceSimulation: !isLive,
      });
      orderId = order.id;
      paymentLink = defaultPayPalClient.getCheckoutUrl(order);
    }

    const timeline: TimelineEvent[] = [
      {
        id: `t_${Date.now()}_1`,
        timestamp: timeNow,
        stage: "goal_received",
        title: goalType === "collection" ? "Collection Goal Created" : "Disbursement Review Created",
        description: `Objective to ${goalType === "collection" ? "collect" : "disburse"} $${amountNum.toLocaleString()} ${currency} for ${purpose}.`,
      },
      {
        id: `t_${Date.now()}_2`,
        timestamp: timeNow,
        stage: "safety_checked",
        title: `Safety rating: ${riskEval.riskLevel.toUpperCase()} Risk (${riskEval.riskScore}/100)`,
        description: riskEval.checks.map((c) => c.name).join(", "),
      },
    ];

    if (goalType === "collection" && orderId) {
      timeline.push({
        id: `t_${Date.now()}_3`,
        timestamp: timeNow,
        stage: "order_created",
        title: isLive ? "PayPal Sandbox Order Created" : "Simulated Order Created",
        description: `Order ${orderId} initialized (${mode} mode).`,
        isSimulated,
      });
    }

    const newGoal: PaymentGoal = {
      id: `goal_${Date.now()}`,
      goal: body.goal.trim(),
      goalType,
      customer: customer.name,
      customerId: customer.id,
      amount: amountNum,
      currency,
      deadline,
      purpose,
      status: riskEval.requiresApproval ? "pending_approval" : "awaiting_payment",
      mode,
      isSimulated,
      paypalOrderId: orderId,
      paypalPaymentLink: paymentLink,
      riskLevel: riskEval.riskLevel,
      riskScore: riskEval.riskScore,
      riskChecks: riskEval.checks,
      requiresApproval: riskEval.requiresApproval,
      approvalStatus: riskEval.requiresApproval ? "pending" : undefined,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline,
      isDemoFixture: false,
      visitorId: isAdmin ? undefined : visitorId,
    };

    db.saveGoal(newGoal);
    const visibleGoals = scopeGoalsForRequester(db.getGoals(), isAdmin, visitorId);
    const response = NextResponse.json({ goal: newGoal, metrics: db.getMetrics(visibleGoals) }, { status: 201 });
    return attachVisitorCookie(response, newCookieToken, isAdmin);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error creating goal" },
      { status: 500 }
    );
  }
}

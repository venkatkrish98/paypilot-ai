// ==============================================================================
// PayPilot AI - Agent Orchestrator & Specialized Agent Capabilities
// Multi-Agent Architecture for Agentic Commerce & PayPal Execution
// ==============================================================================

import {
  AgentStep,
  AgentOrchestratorResult,
  PaymentGoal,
  TimelineEvent,
  GoalType,
} from "../types";
import { db } from "../database";
import { defaultSafetyEngine } from "../risk";
import { defaultPayPalClient } from "../paypal";
import { defaultAIPlanner, AIPlanningOutput } from "./ai-planner";

export class AgentOrchestrator {
  /**
   * Main entrypoint: Processes user prompt through specialized capability agents
   */
  public async execute(
    userQuery: string,
    options?: { isSimulationOnly?: boolean }
  ): Promise<AgentOrchestratorResult> {
    const steps: AgentStep[] = [];
    const now = new Date();
    const timeNow = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    // --------------------------------------------------------------------------
    // 1. INTENT AGENT: Understand user goal & plan with AI / Deterministic Fallback
    // --------------------------------------------------------------------------
    steps.push({
      agentName: "Intent Agent",
      status: "in_progress",
      summary: "Extracting structured financial intent using AI planning engine...",
      timestamp: timeNow,
    });

    const plannedIntent = await defaultAIPlanner.plan(userQuery);

    steps[steps.length - 1].status = "completed";
    steps[steps.length - 1].summary = `Extracted intent (${plannedIntent.aiEngine === "gemini" ? "Google Gemini 2.5 Flash" : "Deterministic Fallback"}): ${this.formatIntentSummary(plannedIntent)}`;

    // --------------------------------------------------------------------------
    // Routing based on Intent
    // --------------------------------------------------------------------------

    // Case A: Customer History / Status Inquiry
    if (plannedIntent.action === "customer_inquiry" && plannedIntent.customerName) {
      return this.handleCustomerInquiry(plannedIntent.customerName, steps, userQuery, plannedIntent.aiEngine);
    }

    // Case B: Attention / Unpaid Query
    if (plannedIntent.action === "attention_inquiry" || plannedIntent.action === "status_inquiry") {
      return this.handleStatusInquiry(steps, userQuery, plannedIntent.aiEngine);
    }

    // Case C: Follow-up action
    if (plannedIntent.action === "followup_action" && plannedIntent.customerName) {
      return this.handleFollowUpAction(plannedIntent.customerName, steps, userQuery, plannedIntent.aiEngine);
    }

    // Case D: Memory Store
    if (plannedIntent.action === "memory_store") {
      return this.handleMemoryStore(userQuery, steps, plannedIntent.aiEngine);
    }

    // Case E: Payment Collection or Disbursement Review Workflow
    if (
      plannedIntent.action === "create_collection_goal" ||
      plannedIntent.action === "create_payout_review"
    ) {
      return this.handlePaymentWorkflow(plannedIntent, steps, userQuery, options?.isSimulationOnly);
    }

    // Fallback: Default intelligent guidance
    return this.handleFallbackWorkflow(userQuery, steps, plannedIntent.aiEngine);
  }

  private formatIntentSummary(parsed: AIPlanningOutput): string {
    switch (parsed.action) {
      case "create_collection_goal":
        return `Collect $${parsed.amount?.toLocaleString()} from ${parsed.customerName} (due: ${parsed.deadline})`;
      case "create_payout_review":
        return `Vendor disbursement review for $${parsed.amount?.toLocaleString()} to ${parsed.customerName}`;
      case "customer_inquiry":
        return `Query payment history for ${parsed.customerName}`;
      case "attention_inquiry":
        return "Audit payment goals needing immediate human attention";
      case "followup_action":
        return `Prepare payment follow-up for ${parsed.customerName}`;
      case "memory_store":
        return "Store agent operational memory preference";
      default:
        return "General payment advisory assistance";
    }
  }

  /**
   * Core Payment Workflow Handler (Collection or Outbound Review)
   */
  private async handlePaymentWorkflow(
    intent: AIPlanningOutput,
    steps: AgentStep[],
    userQuery: string,
    isSimulationOnly?: boolean
  ): Promise<AgentOrchestratorResult> {
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const amount = intent.amount || 1200;
    const currency = intent.currency || "USD";
    const customerName = intent.customerName || "Sarah Jenkins";
    const purpose = intent.purpose || "Professional Services";
    const deadline = intent.deadline || new Date().toISOString().split("T")[0];
    const isPayout = intent.action === "create_payout_review";
    const goalType: GoalType = isPayout ? "payout_review" : "collection";

    const isLiveSandbox = !isSimulationOnly && defaultPayPalClient.isConfigured();
    const mode = isLiveSandbox ? "sandbox" : "simulation";

    // 2. CUSTOMER AGENT: Lookup customer and retrieve historical context
    steps.push({
      agentName: "Customer Agent",
      status: "in_progress",
      summary: `Identifying recipient "${customerName}" and loading profile context...`,
      timestamp: timeNow,
    });

    let customer = db.findCustomerByName(customerName);
    if (!customer) {
      customer = {
        id: `cust_${Date.now()}`,
        name: customerName,
        email: `${customerName.toLowerCase().replace(/[^a-z0-9]/g, ".")}@example.com`,
        outstandingAmount: isPayout ? 0 : amount,
        paymentHistory: [],
        riskIndicators: ["New recipient"],
        isNewRecipient: true,
        notes: "Created by PayPilot AI agent upon natural language instruction.",
      };
      db.saveCustomer(customer);
      steps[steps.length - 1].summary = `Identified new recipient: "${customer.name}" (${customer.email})`;
    } else {
      steps[steps.length - 1].summary = `Identified existing customer "${customer.name}" (${customer.email}) • Prior transactions: ${customer.paymentHistory.length}`;
    }
    steps[steps.length - 1].status = "completed";

    // 3. RISK AGENT: Run 5-point Payment Safety Checks
    steps.push({
      agentName: "Risk Agent",
      status: "in_progress",
      summary: "Executing 5-point Payment Safety Checks...",
      timestamp: timeNow,
    });

    const safetyResult = defaultSafetyEngine.evaluate({
      amount,
      currency,
      customer,
      customerName: customer.name,
      existingGoals: db.getGoals(),
      isPayout,
    });

    steps[steps.length - 1].summary = `Safety check finished: ${safetyResult.riskLevel.toUpperCase()} Risk (${safetyResult.riskScore}/100) • Passed ${safetyResult.checks.filter((c) => c.passed).length}/5 checks`;
    steps[steps.length - 1].status = safetyResult.requiresApproval ? "flagged" : "completed";

    // 4. MEMORY AGENT: Recall relevant preferences
    steps.push({
      agentName: "Memory Agent",
      status: "completed",
      summary: `Recalled context: "${customer.preferences?.reminderChannel ? `Prefers ${customer.preferences.reminderChannel}` : 'Standard USD settlement rule active'}"`,
      timestamp: timeNow,
    });

    // If Approval is required (High risk or exceeds threshold or is a payout):
    if (safetyResult.requiresApproval) {
      const goalId = `goal_${Date.now()}`;
      const goal: PaymentGoal = {
        id: goalId,
        goal: userQuery,
        goalType,
        customer: customer.name,
        customerId: customer.id,
        amount,
        currency,
        deadline,
        purpose,
        status: "pending_approval",
        mode,
        isSimulated: !isLiveSandbox,
        riskLevel: safetyResult.riskLevel,
        riskScore: safetyResult.riskScore,
        riskChecks: safetyResult.checks,
        requiresApproval: true,
        approvalStatus: "pending",
        createdBy: "agent",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [
          {
            id: `t_${Date.now()}_1`,
            timestamp: timeNow,
            stage: "goal_received",
            title: isPayout ? "Disbursement intent received" : "Collection goal received",
            description: `Payment intent: ${userQuery}`,
          },
          {
            id: `t_${Date.now()}_2`,
            timestamp: timeNow,
            stage: "customer_identified",
            title: "Customer identified",
            description: `Recipient: ${customer.name}`,
          },
          {
            id: `t_${Date.now()}_3`,
            timestamp: timeNow,
            stage: "safety_checked",
            title: "Safety check flagged review",
            description: safetyResult.approvalReason || "Review threshold exceeded.",
          },
          {
            id: `t_${Date.now()}_4`,
            timestamp: timeNow,
            stage: "approval_requested",
            title: "Human approval required",
            description: "Waiting for administrator confirmation before execution.",
          },
        ],
      };

      db.saveGoal(goal);

      steps.push({
        agentName: "Notification Agent",
        status: "completed",
        summary: "Prepared Human Approval prompt with itemized safety report.",
        timestamp: timeNow,
      });

      const responseText = isPayout
        ? `Before I execute this vendor payout:\n\n• Recipient: ${customer.name}\n• Amount: $${amount.toLocaleString()} ${currency}\n• Nature: Outbound Vendor Disbursement\n• Safety Reason: ${safetyResult.approvalReason || "Amount exceeds review threshold."}\n\nNote: PayPal Orders v2 handles buyer collections. Outbound vendor disbursements require administrator approval before processing. Do you want to approve?`
        : `Before I execute this payment collection:\n\n• Recipient: ${customer.name}\n• Amount: $${amount.toLocaleString()} ${currency}\n• Safety Reason: ${safetyResult.approvalReason || "Amount exceeds review threshold."}\n\nDo you want to continue?`;

      return {
        success: true,
        userQuery,
        intent: intent.action,
        goalType,
        goal,
        steps,
        assistantResponse: responseText,
        requiresApproval: true,
        mode,
        isSimulated: !isLiveSandbox,
        aiEngine: intent.aiEngine,
      };
    }

    // 5. PAYMENT AGENT: Create PayPal Order (Sandbox or Simulation)
    steps.push({
      agentName: "Payment Agent",
      status: "in_progress",
      summary: isLiveSandbox
        ? "Creating live PayPal Sandbox Order (Orders v2 API)..."
        : "Creating Simulated PayPal Order (Simulation Mode)...",
      timestamp: timeNow,
    });

    const paypalOrder = await defaultPayPalClient.createOrder({
      amount,
      currency,
      description: purpose,
      customerEmail: customer.email,
      forceSimulation: !isLiveSandbox,
    });

    const checkoutUrl = defaultPayPalClient.getCheckoutUrl(paypalOrder);

    steps[steps.length - 1].summary = isLiveSandbox
      ? `PayPal Sandbox Order created: ${paypalOrder.id} • Status: ${paypalOrder.status}`
      : `Simulated PayPal Order created: ${paypalOrder.id} [Simulation Mode]`;
    steps[steps.length - 1].status = "completed";

    // 6. NOTIFICATION AGENT: Generate payment dispatch
    steps.push({
      agentName: "Notification Agent",
      status: "completed",
      summary: `Payment request link generated for ${customer.name}`,
      timestamp: timeNow,
    });

    // 7. FOLLOW-UP AGENT: Activate autonomous monitoring
    steps.push({
      agentName: "Follow-up Agent",
      status: "completed",
      summary: `Autonomous payment monitor active. Tracking order ${paypalOrder.id}`,
      timestamp: timeNow,
    });

    const goalId = `goal_${Date.now()}`;
    const goalTimeline: TimelineEvent[] = [
      {
        id: `t_${Date.now()}_1`,
        timestamp: timeNow,
        stage: "goal_received",
        title: "Goal received",
        description: `Identified collection objective of $${amount.toLocaleString()} for ${purpose}.`,
      },
      {
        id: `t_${Date.now()}_2`,
        timestamp: timeNow,
        stage: "customer_identified",
        title: "Customer identified",
        description: `Matched with ${customer.name} (${customer.email}).`,
      },
      {
        id: `t_${Date.now()}_3`,
        timestamp: timeNow,
        stage: "safety_checked",
        title: "Payment safety check completed",
        description: `Safety rating: ${safetyResult.riskLevel.toUpperCase()} Risk (${safetyResult.riskScore}/100). All checks passed.`,
      },
      {
        id: `t_${Date.now()}_4`,
        timestamp: timeNow,
        stage: "order_created",
        title: isLiveSandbox ? "PayPal Sandbox order created" : "Simulated PayPal order created",
        description: `${isLiveSandbox ? "PayPal Sandbox" : "Simulated"} order ${paypalOrder.id} initialized.`,
        isSimulated: !isLiveSandbox,
      },
      {
        id: `t_${Date.now()}_5`,
        timestamp: timeNow,
        stage: "link_generated",
        title: isLiveSandbox ? "Sandbox payment link generated" : "Simulated payment link generated",
        description: `Checkout URL ready: ${checkoutUrl}`,
        isSimulated: !isLiveSandbox,
      },
      {
        id: `t_${Date.now()}_6`,
        timestamp: timeNow,
        stage: "awaiting_payment",
        title: "Waiting for customer",
        description: isLiveSandbox
          ? "Waiting for buyer approval in PayPal Sandbox before capture."
          : "Simulation mode active. Ready for simulated customer payment capture.",
        isSimulated: !isLiveSandbox,
      },
    ];

    const newGoal: PaymentGoal = {
      id: goalId,
      goal: userQuery,
      goalType,
      customer: customer.name,
      customerId: customer.id,
      amount,
      currency,
      deadline,
      purpose,
      status: "awaiting_payment",
      mode,
      isSimulated: !isLiveSandbox,
      paypalOrderId: paypalOrder.id,
      paypalPaymentLink: checkoutUrl,
      riskLevel: safetyResult.riskLevel,
      riskScore: safetyResult.riskScore,
      riskChecks: safetyResult.checks,
      requiresApproval: false,
      createdBy: "agent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: goalTimeline,
    };

    db.saveGoal(newGoal);

    // Update customer outstanding amount for collections
    if (!isPayout) {
      customer.outstandingAmount += amount;
      db.saveCustomer(customer);
    }

    const modeLabel = isLiveSandbox ? "PayPal Sandbox" : "Simulated Mode";
    const assistantResponse = `I've created a payment goal and generated a ${modeLabel} order for ${customer.name}:\n\n• Amount: $${amount.toLocaleString()} ${currency}\n• Purpose: ${purpose}\n• Due Date: ${deadline}\n• Order ID: \`${paypalOrder.id}\`\n• Status: Awaiting Payment (${modeLabel})\n\n${
      isLiveSandbox
        ? "The buyer must approve the transaction on PayPal Sandbox before it can be captured."
        : "Simulation mode is active. You can simulate the customer payment capture to test the workflow."
    }`;

    return {
      success: true,
      userQuery,
      intent: intent.action,
      goalType,
      goal: newGoal,
      steps,
      assistantResponse,
      suggestedFollowUp: isLiveSandbox
        ? `Open Sandbox checkout to approve order ${paypalOrder.id}`
        : `Simulate payment capture for order ${paypalOrder.id}`,
      mode,
      isSimulated: !isLiveSandbox,
      aiEngine: intent.aiEngine,
    };
  }

  private handleCustomerInquiry(
    customerName: string,
    steps: AgentStep[],
    userQuery: string,
    aiEngine: "gemini" | "deterministic"
  ): AgentOrchestratorResult {
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    steps.push({
      agentName: "Customer Agent",
      status: "in_progress",
      summary: `Searching transaction ledger for "${customerName}"...`,
      timestamp: timeNow,
    });

    const customer = db.findCustomerByName(customerName);

    if (!customer) {
      steps[steps.length - 1].status = "completed";
      steps[steps.length - 1].summary = `No records found for "${customerName}".`;
      return {
        success: true,
        userQuery,
        intent: "customer_inquiry",
        steps,
        assistantResponse: `I couldn't find any existing customer records for "${customerName}". Would you like me to set up a new recipient profile?`,
        aiEngine,
      };
    }

    steps[steps.length - 1].status = "completed";
    steps[steps.length - 1].summary = `Found customer record for ${customer.name}`;

    steps.push({
      agentName: "Memory Agent",
      status: "completed",
      summary: `Retrieved customer notes: "${customer.notes}"`,
      timestamp: timeNow,
    });

    const pendingGoal = db
      .getGoals()
      .find((g) => g.customer.toLowerCase().includes(customerName.toLowerCase()) && g.status === "awaiting_payment");

    let response = "";
    if (customer.lastPaymentDate && customer.lastPaymentAmount) {
      response = `${customer.name}'s latest payment was $${customer.lastPaymentAmount.toLocaleString()} on ${customer.lastPaymentDate}.`;
    } else {
      response = `${customer.name} has no completed prior payments on record.`;
    }

    if (pendingGoal) {
      response += ` She currently has an active $${pendingGoal.amount.toLocaleString()} payment request pending (Order ID: ${pendingGoal.paypalOrderId}).`;
    } else if (customer.outstandingAmount > 0) {
      response += ` Current outstanding balance is $${customer.outstandingAmount.toLocaleString()}.`;
    } else {
      response += ` All payment goals for ${customer.name} are currently settled.`;
    }

    return {
      success: true,
      userQuery,
      intent: "customer_inquiry",
      steps,
      assistantResponse: response,
      aiEngine,
    };
  }

  private handleStatusInquiry(
    steps: AgentStep[],
    userQuery: string,
    aiEngine: "gemini" | "deterministic"
  ): AgentOrchestratorResult {
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    steps.push({
      agentName: "Follow-up Agent",
      status: "in_progress",
      summary: "Scanning active payment goals, deadlines, and approval queues...",
      timestamp: timeNow,
    });

    const attentionGoals = db
      .getGoals()
      .filter((g) => g.status === "pending_approval" || g.riskLevel === "high");
    const awaitingGoals = db.getGoals().filter((g) => g.status === "awaiting_payment");

    steps[steps.length - 1].status = "completed";
    steps[steps.length - 1].summary = `Found ${attentionGoals.length} goal(s) requiring attention and ${awaitingGoals.length} awaiting payment.`;

    let reply = "";
    if (attentionGoals.length > 0) {
      reply = `You have ${attentionGoals.length} payment goal requiring immediate attention:\n\n`;
      attentionGoals.forEach((g) => {
        reply += `• **${g.customer}** — $${g.amount.toLocaleString()} (${g.goal}) — *Status: Requires Approval*\n`;
      });
      reply += `\nWould you like me to open the approval details for review?`;
    } else if (awaitingGoals.length > 0) {
      reply = `All high-risk approvals are clear. Currently awaiting payment on:\n\n`;
      awaitingGoals.forEach((g) => {
        reply += `• **${g.customer}** — $${g.amount.toLocaleString()} (Due: ${g.deadline})\n`;
      });
    } else {
      reply = `All payment goals are currently up to date! No payments require your immediate attention.`;
    }

    return {
      success: true,
      userQuery,
      intent: "status_inquiry",
      steps,
      assistantResponse: reply,
      aiEngine,
    };
  }

  private handleFollowUpAction(
    customerName: string,
    steps: AgentStep[],
    userQuery: string,
    aiEngine: "gemini" | "deterministic"
  ): AgentOrchestratorResult {
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    steps.push({
      agentName: "Follow-up Agent",
      status: "in_progress",
      summary: `Locating unpaid goals for ${customerName}...`,
      timestamp: timeNow,
    });

    const goal = db
      .getGoals()
      .find((g) => g.customer.toLowerCase().includes(customerName.toLowerCase()) && g.status === "awaiting_payment");

    const customer = db.findCustomerByName(customerName);

    steps[steps.length - 1].status = "completed";
    steps[steps.length - 1].summary = goal
      ? `Found pending goal: $${goal.amount} (Order: ${goal.paypalOrderId})`
      : `No unpaid goal found for ${customerName}`;

    steps.push({
      agentName: "Notification Agent",
      status: "completed",
      summary: `Prepared polite follow-up draft (via ${customer?.preferences?.reminderChannel || "Email"})`,
      timestamp: timeNow,
    });

    if (goal) {
      db.addTimelineEvent(goal.id, {
        id: `t_${Date.now()}`,
        timestamp: timeNow,
        stage: "followup_prepared",
        title: "Follow-up prepared",
        description: `Automated payment reminder drafted for $${goal.amount.toLocaleString()}.`,
        isSimulated: goal.isSimulated,
      });
    }

    const reply = goal
      ? `I've prepared a follow-up reminder for **${customer?.name || customerName}** regarding the **$${goal.amount.toLocaleString()}** payment (Order \`${goal.paypalOrderId}\`):\n\n> "Hi ${customerName}, gentle reminder regarding the $${goal.amount.toLocaleString()} payment request for ${goal.purpose}. You can securely complete this here: ${goal.paypalPaymentLink}"\n\nWould you like me to send this reminder now?`
      : `There are no unpaid goals pending for ${customerName}.`;

    return {
      success: true,
      userQuery,
      intent: "followup_action",
      goal,
      steps,
      assistantResponse: reply,
      aiEngine,
    };
  }

  private handleMemoryStore(
    userQuery: string,
    steps: AgentStep[],
    aiEngine: "gemini" | "deterministic"
  ): AgentOrchestratorResult {
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    steps.push({
      agentName: "Memory Agent",
      status: "in_progress",
      summary: "Extracting preference and persisting to agent knowledge base...",
      timestamp: timeNow,
    });

    const clean = userQuery.replace(/^(?:remember\s+(?:that\s+)?)/i, "").trim();
    const mem = db.addMemory("user_rule", clean, "preference");

    steps[steps.length - 1].status = "completed";
    steps[steps.length - 1].summary = `Persisted preference [${mem.id}] to PayPilot Memory`;

    return {
      success: true,
      userQuery,
      intent: "memory_store",
      steps,
      assistantResponse: `I've stored this in my persistent memory:\n\n> "${clean}"\n\nI will automatically apply this rule in all future payment workflows.`,
      aiEngine,
    };
  }

  private handleFallbackWorkflow(
    userQuery: string,
    steps: AgentStep[],
    aiEngine: "gemini" | "deterministic"
  ): AgentOrchestratorResult {
    const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    steps.push({
      agentName: "Intent Agent",
      status: "completed",
      summary: "Interpreting general payment operations request...",
      timestamp: timeNow,
    });

    return {
      success: true,
      userQuery,
      intent: "general",
      steps,
      assistantResponse: `I can help you create payment goals, execute PayPal orders, run payment safety checks, and monitor transactions.\n\nTry asking me:\n• *"I need to collect $1,200 from Sarah for the website project by Friday."*\n• *"Has Sarah paid me recently?"*\n• *"Show payments needing attention."*\n• *"Pay vendor Mike $2,500 for cloud review."*`,
      aiEngine,
    };
  }
}

export const defaultOrchestrator = new AgentOrchestrator();

// ==============================================================================
// PayPilot AI - Durable File Database Store & Seed Data
// Persists Payment Goals, Customers, Memory, and Activity Logs to local JSON storage
// ==============================================================================

import fs from "fs";
import path from "path";
import { Customer, PaymentGoal, MemoryItem, AIRecommendation, TimelineEvent, DashboardMetrics } from "../types";

import { getNextDayOfWeek } from "../agent/ai-planner";

export const CANONICAL_DEMO_GOAL_IDS = new Set([
  "goal_sarah_1200",
  "goal_john_850",
  "goal_mike_2500",
  "goal_acme_600",
]);

export const CANONICAL_DEMO_CUSTOMER_IDS = new Set([
  "cust_sarah",
  "cust_john",
  "cust_mike",
  "cust_acme",
]);

export const CANONICAL_DEMO_MEMORY_IDS = new Set([
  "mem_1",
  "mem_2",
  "mem_3",
]);

export const CANONICAL_DEMO_RECOMMENDATION_IDS = new Set([
  "rec_1",
  "rec_2",
]);

export interface DatabaseSnapshot {
  version: number;
  lastUpdated: string;
  customers: Customer[];
  goals: PaymentGoal[];
  memories: MemoryItem[];
  recommendations: AIRecommendation[];
}

export class DatabaseStore {
  private customers: Map<string, Customer> = new Map();
  private goals: Map<string, PaymentGoal> = new Map();
  private memories: Map<string, MemoryItem> = new Map();
  private recommendations: Map<string, AIRecommendation> = new Map();
  private filePath: string;
  private isInMemory: boolean = false;
  private isPersisting: boolean = false;

  constructor(customFilePath?: string) {
    const envPath = process.env.PAYPILOT_DB_PATH;
    const targetPath = customFilePath || envPath;

    if (targetPath === ":memory:") {
      this.isInMemory = true;
      this.filePath = ":memory:";
      this.seedDemoData();
      return;
    }

    const dataDir = path.resolve(process.cwd(), "data");
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (e) {
        console.warn("Could not create data directory, using memory fallback:", e);
      }
    }
    this.filePath = targetPath || path.join(dataDir, "paypilot_db.json");
    this.loadFromDisk();
  }

  public getFilePath(): string {
    return this.filePath;
  }

  private loadFromDisk(): void {
    if (this.isInMemory || this.filePath === ":memory:") {
      this.seedDemoData();
      return;
    }

    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        const data: DatabaseSnapshot = JSON.parse(raw);
        this.customers.clear();
        this.goals.clear();
        this.memories.clear();
        this.recommendations.clear();

        data.customers?.forEach((c) => this.customers.set(c.id, c));
        data.goals?.forEach((g) => this.goals.set(g.id, g));
        data.memories?.forEach((m) => this.memories.set(m.id, m));
        data.recommendations?.forEach((r) => this.recommendations.set(r.id, r));
        return;
      }
    } catch (e) {
      console.warn("Error reading database file, reseeding defaults:", e);
    }
    this.seedDemoData();
  }

  public persistToDisk(): void {
    if (this.isInMemory || this.filePath === ":memory:") {
      return; // In-memory database does not touch filesystem
    }

    if (this.isPersisting) return;
    this.isPersisting = true;
    try {
      const snapshot: DatabaseSnapshot = {
        version: 1,
        lastUpdated: new Date().toISOString(),
        customers: Array.from(this.customers.values()),
        goals: Array.from(this.goals.values()),
        memories: Array.from(this.memories.values()),
        recommendations: Array.from(this.recommendations.values()),
      };
      const tmpPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(snapshot, null, 2), "utf-8");
      fs.renameSync(tmpPath, this.filePath);
    } catch (e) {
      console.error("Critical: Failed to persist database snapshot to disk:", e);
      throw new Error(`Persistence Error: Failed to write to disk at ${this.filePath} (${e instanceof Error ? e.message : String(e)})`);
    } finally {
      this.isPersisting = false;
    }
  }

  public seedDemoData(): void {
    this.customers.clear();
    this.goals.clear();
    this.memories.clear();
    this.recommendations.clear();

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const friday = getNextDayOfWeek(5, now);

    // 1. Seed Demo Customers
    const customerSarah: Customer = {
      id: "cust_sarah",
      name: "Sarah Jenkins",
      email: "sarah.jenkins@designcraft.io",
      outstandingAmount: 1200,
      lastPaymentDate: "2026-10-02",
      lastPaymentAmount: 800,
      riskIndicators: [],
      isNewRecipient: false,
      isDemoFixture: true,
      notes: "Senior Design Director. Prefers email payment reminders and clear milestone receipts.",
      paymentHistory: [
        {
          id: "hist_sarah_1",
          date: "2026-10-02",
          amount: 800,
          currency: "USD",
          paypalOrderId: "SIMULATED_ORD_SARAH_01",
          status: "completed",
          purpose: "UI/UX Milestone Phase 1",
          isSimulated: true,
        },
      ],
      preferences: {
        reminderChannel: "email",
        customNote: "Remind politely 24h prior to milestone cutoff.",
      },
    };

    const customerJohn: Customer = {
      id: "cust_john",
      name: "Johnathan Doe",
      email: "john.doe@techscale.com",
      outstandingAmount: 0,
      lastPaymentDate: todayStr,
      lastPaymentAmount: 850,
      riskIndicators: [],
      isNewRecipient: false,
      isDemoFixture: true,
      notes: "Operations Lead at TechScale. Consistently pays within 24 hours of PayPal order.",
      paymentHistory: [
        {
          id: "hist_john_1",
          date: todayStr,
          amount: 850,
          currency: "USD",
          paypalOrderId: "SIMULATED_ORD_JOHN_850",
          status: "completed",
          purpose: "Frontend Optimization Sprint",
          isSimulated: true,
        },
      ],
      preferences: {
        reminderChannel: "email",
      },
    };

    const customerMike: Customer = {
      id: "cust_mike",
      name: "Mike Reynolds",
      email: "mike.reynolds@apexconsulting.com",
      outstandingAmount: 2500,
      riskIndicators: ["New vendor", "Amount exceeds $2,000 threshold"],
      isNewRecipient: true,
      isDemoFixture: true,
      notes: "External Cloud Security Consultant. Newly onboarded contractor.",
      paymentHistory: [],
      preferences: {
        reminderChannel: "email",
        customNote: "High-value vendor disbursement requiring administrative sign-off.",
      },
    };

    const customerAcme: Customer = {
      id: "cust_acme",
      name: "Acme Studio",
      email: "billing@acmestudio.design",
      outstandingAmount: 600,
      lastPaymentDate: "2026-09-20",
      lastPaymentAmount: 1400,
      riskIndicators: [],
      isNewRecipient: false,
      isDemoFixture: true,
      notes: "Creative agency client. Net 30 terms.",
      paymentHistory: [
        {
          id: "hist_acme_1",
          date: "2026-09-20",
          amount: 1400,
          currency: "USD",
          paypalOrderId: "SIMULATED_ORD_ACME_1400",
          status: "completed",
          purpose: "Brand Identity Guideline",
          isSimulated: true,
        },
      ],
    };

    this.customers.set(customerSarah.id, customerSarah);
    this.customers.set(customerJohn.id, customerJohn);
    this.customers.set(customerMike.id, customerMike);
    this.customers.set(customerAcme.id, customerAcme);

    // 2. Seed Demo Payment Goals
    // Goal 1: Sarah — $1,200 — Awaiting Payment (Collection)
    const goalSarah: PaymentGoal = {
      id: "goal_sarah_1200",
      goal: "Collect payment from Sarah for the website project",
      goalType: "collection",
      customer: "Sarah Jenkins",
      customerId: "cust_sarah",
      amount: 1200,
      currency: "USD",
      deadline: friday,
      purpose: "Website Project - Phase 2 Final Delivery",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      isDemoFixture: true,
      paypalOrderId: "SIMULATED_ORD_SARAH_1200",
      paypalPaymentLink: "/checkout/simulation?orderId=SIMULATED_ORD_SARAH_1200",
      riskLevel: "low",
      riskScore: 10,
      riskChecks: [
        {
          id: "c1",
          name: "Threshold Review Check",
          passed: true,
          severity: "info",
          details: "Amount ($1,200) is within autonomous boundary ($2,000).",
        },
        {
          id: "c2",
          name: "Recipient Verification Check",
          passed: true,
          severity: "info",
          details: "Verified recipient with prior transaction history.",
        },
        {
          id: "c3",
          name: "Duplicate Payment Detection",
          passed: true,
          severity: "info",
          details: "No duplicate requests detected.",
        },
      ],
      requiresApproval: false,
      createdBy: "agent",
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          id: "t1",
          timestamp: "10:32 AM",
          stage: "goal_received",
          title: "Goal received",
          description: "Identified collection objective of $1,200 for Website Project.",
        },
        {
          id: "t2",
          timestamp: "10:32 AM",
          stage: "customer_identified",
          title: "Customer identified",
          description: "Matched with Sarah Jenkins (sarah.jenkins@designcraft.io).",
        },
        {
          id: "t3",
          timestamp: "10:33 AM",
          stage: "safety_checked",
          title: "Payment safety check completed",
          description: "All heuristic safety checks passed with Low Risk profile.",
        },
        {
          id: "t4",
          timestamp: "10:33 AM",
          stage: "order_created",
          title: "Simulated PayPal order created",
          description: "Orders v2 order SIMULATED_ORD_SARAH_1200 initialized in simulation mode.",
          isSimulated: true,
        },
        {
          id: "t5",
          timestamp: "10:33 AM",
          stage: "awaiting_payment",
          title: "Awaiting customer payment",
          description: "Active monitoring listening for sandbox/simulated capture event.",
        },
      ],
    };

    // Goal 2: John — $850 — Paid (Collection)
    const goalJohn: PaymentGoal = {
      id: "goal_john_850",
      goal: "Collect $850 for John's order",
      goalType: "collection",
      customer: "Johnathan Doe",
      customerId: "cust_john",
      amount: 850,
      currency: "USD",
      deadline: todayStr,
      purpose: "Frontend Optimization Sprint",
      status: "paid",
      mode: "simulation",
      isSimulated: true,
      isDemoFixture: true,
      paypalOrderId: "SIMULATED_ORD_JOHN_850",
      paypalCaptureId: "SIMULATED_CAP_JOHN_COMPLETED",
      paypalPaymentLink: "/checkout/simulation?orderId=SIMULATED_ORD_JOHN_850",
      capturedAmount: 850,
      capturedCurrency: "USD",
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [
        {
          id: "c1",
          name: "Threshold Review Check",
          passed: true,
          severity: "info",
          details: "Amount ($850) is within autonomous boundary ($2,000).",
        },
      ],
      requiresApproval: false,
      createdBy: "agent",
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      paidAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      timeline: [
        {
          id: "tj1",
          timestamp: "07:15 AM",
          stage: "goal_received",
          title: "Goal received",
          description: "Collect $850 for Johnathan Doe.",
        },
        {
          id: "tj2",
          timestamp: "07:16 AM",
          stage: "order_created",
          title: "Simulated PayPal order created",
          description: "Generated PayPal order SIMULATED_ORD_JOHN_850.",
          isSimulated: true,
        },
        {
          id: "tj3",
          timestamp: "11:05 AM",
          stage: "payment_detected",
          title: "Simulated payment received",
          description: "Simulated capture SIMULATED_CAP_JOHN_COMPLETED recorded.",
          isSimulated: true,
        },
        {
          id: "tj4",
          timestamp: "11:05 AM",
          stage: "goal_completed",
          title: "Goal completed",
          description: "Payment goal successfully reconciled.",
        },
      ],
    };

    // Goal 3: Mike — $2,500 — Needs Approval (Payout Review)
    const goalMike: PaymentGoal = {
      id: "goal_mike_2500",
      goal: "Pay vendor Mike $2,500 for cloud security review",
      goalType: "payout_review",
      customer: "Mike Reynolds",
      customerId: "cust_mike",
      amount: 2500,
      currency: "USD",
      deadline: friday,
      purpose: "Cloud Infrastructure Audit & Penetration Test",
      status: "pending_approval",
      mode: "simulation",
      isSimulated: true,
      isDemoFixture: true,
      riskLevel: "high",
      riskScore: 65,
      riskChecks: [
        {
          id: "c1",
          name: "Threshold Review Check",
          passed: false,
          severity: "warning",
          details: "Amount ($2,500) exceeds configured review threshold of $2,000.",
        },
        {
          id: "c2",
          name: "Recipient Verification Check",
          passed: false,
          severity: "warning",
          details: "Mike Reynolds is a new vendor with no prior completed payouts.",
        },
      ],
      requiresApproval: true,
      approvalStatus: "pending",
      createdBy: "user",
      createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          id: "tm1",
          timestamp: "10:18 AM",
          stage: "goal_received",
          title: "Disbursement intent received",
          description: "Vendor disbursement intent of $2,500 initiated.",
        },
        {
          id: "tm2",
          timestamp: "10:19 AM",
          stage: "safety_checked",
          title: "Payment safety check flagged",
          description: "Amount exceeds $2,000 threshold and recipient is unfamiliar.",
        },
        {
          id: "tm3",
          timestamp: "10:19 AM",
          stage: "approval_requested",
          title: "Human approval required",
          description: "Awaiting administrator sign-off before vendor disbursement.",
        },
      ],
    };

    // Goal 4: Acme Studio — $600 — Pending (Collection)
    const goalAcme: PaymentGoal = {
      id: "goal_acme_600",
      goal: "Collect $600 from Acme Studio for typography licensing",
      goalType: "collection",
      customer: "Acme Studio",
      customerId: "cust_acme",
      amount: 600,
      currency: "USD",
      deadline: friday,
      purpose: "Commercial Font License Extended Rights",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      isDemoFixture: true,
      paypalOrderId: "SIMULATED_ORD_ACME_600",
      paypalPaymentLink: "/checkout/simulation?orderId=SIMULATED_ORD_ACME_600",
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [
        {
          id: "c1",
          name: "Threshold Review Check",
          passed: true,
          severity: "info",
          details: "Amount ($600) is well within boundary ($2,000).",
        },
      ],
      requiresApproval: false,
      createdBy: "agent",
      createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          id: "ta1",
          timestamp: "Yesterday",
          stage: "order_created",
          title: "Simulated PayPal order created",
          description: "Order SIMULATED_ORD_ACME_600 generated.",
          isSimulated: true,
        },
        {
          id: "ta2",
          timestamp: "Yesterday",
          stage: "awaiting_payment",
          title: "Awaiting customer payment",
          description: "Payment link prepared for billing@acmestudio.design.",
        },
      ],
    };

    this.goals.set(goalSarah.id, goalSarah);
    this.goals.set(goalJohn.id, goalJohn);
    this.goals.set(goalMike.id, goalMike);
    this.goals.set(goalAcme.id, goalAcme);

    // 3. Seed Persistent Memories
    const mem1: MemoryItem = {
      id: "mem_1",
      key: "sarah_reminder_preference",
      value: "Sarah prefers email payment reminders with clear milestone receipts.",
      category: "preference",
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const mem2: MemoryItem = {
      id: "mem_2",
      key: "high_risk_threshold",
      value: "Payments and disbursements above $2,000 require human administrative approval.",
      category: "threshold",
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    };
    const mem3: MemoryItem = {
      id: "mem_3",
      key: "currency_preference",
      value: "Standard settlement currency is USD for all international client transactions.",
      category: "rule",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    };

    this.memories.set(mem1.id, mem1);
    this.memories.set(mem2.id, mem2);
    this.memories.set(mem3.id, mem3);

    // 4. Seed Proactive AI Recommendations
    const rec1: AIRecommendation = {
      id: "rec_1",
      title: "Pending Payment Follow-up",
      description: "Sarah's $1,200 payment has been awaiting payment for 2 days. Would you like me to prepare a friendly reminder?",
      actionLabel: "Prepare Follow-up",
      actionType: "prepare_followup",
      goalId: "goal_sarah_1200",
      urgency: "medium",
      createdAt: new Date().toISOString(),
    };
    const rec2: AIRecommendation = {
      id: "rec_2",
      title: "Vendor Disbursement Approval Required",
      description: "Mike Reynolds' $2,500 payout review is pending your safety sign-off before execution.",
      actionLabel: "Review Approval",
      actionType: "review_approval",
      goalId: "goal_mike_2500",
      urgency: "high",
      createdAt: new Date().toISOString(),
    };

    this.recommendations.set(rec1.id, rec1);
    this.recommendations.set(rec2.id, rec2);

    this.persistToDisk();
  }

  /**
   * Safe Demo Reset:
   * Restores only the 4 canonical demo fixtures (Sarah, John, Mike, Acme)
   * without deleting or overwriting genuine non-demo user data.
   * Cleans up test-generated duplicate goals created during agent evaluation sessions.
   * Restores customer ledger balances to match the canonical fixtures.
   */
  public resetDemoFixtures(): void {
    const CANONICAL_GOAL_IDS = new Set([
      "goal_sarah_1200",
      "goal_john_850",
      "goal_mike_2500",
      "goal_acme_600",
    ]);

    const CANONICAL_CUSTOMER_IDS = new Set([
      "cust_sarah",
      "cust_john",
      "cust_mike",
      "cust_acme",
    ]);

    const CANONICAL_MEMORY_IDS = new Set([
      "mem_1",
      "mem_2",
      "mem_3",
    ]);

    const CANONICAL_REC_IDS = new Set([
      "rec_1",
      "rec_2",
    ]);

    // 1. Identify non-demo user records to preserve.
    // Pure metadata & canonical ID matching — ZERO heuristic ID prefix checks!
    const nonDemoUserGoals: PaymentGoal[] = [];
    const nonDemoUserCustomers: Customer[] = [];
    const nonDemoUserMemories: MemoryItem[] = [];
    const nonDemoUserRecommendations: AIRecommendation[] = [];

    for (const goal of Array.from(this.goals.values())) {
      // If it is NOT one of the 4 canonical fixtures and NOT explicitly marked isDemoFixture === true, preserve it!
      // This preserves user goals with legacy or arbitrary IDs.
      if (!CANONICAL_GOAL_IDS.has(goal.id) && goal.isDemoFixture !== true) {
        nonDemoUserGoals.push(goal);
      }
    }

    for (const cust of Array.from(this.customers.values())) {
      // If it is NOT one of the 4 canonical customer fixtures and NOT explicitly marked isDemoFixture === true, preserve it!
      // This preserves normal cust_<id> user-created customers completely.
      if (!CANONICAL_CUSTOMER_IDS.has(cust.id) && cust.isDemoFixture !== true) {
        nonDemoUserCustomers.push(cust);
      }
    }

    for (const mem of Array.from(this.memories.values())) {
      if (!CANONICAL_MEMORY_IDS.has(mem.id)) {
        nonDemoUserMemories.push(mem);
      }
    }

    for (const rec of Array.from(this.recommendations.values())) {
      if (!CANONICAL_REC_IDS.has(rec.id)) {
        nonDemoUserRecommendations.push(rec);
      }
    }

    // 2. Re-seed demo fixtures (restores Sarah $1,200, John $850, Mike $2,500, Acme $600)
    this.seedDemoData();

    // 3. Re-attach preserved user goals, customers, memories, and recommendations
    nonDemoUserGoals.forEach((g) => this.goals.set(g.id, g));
    nonDemoUserCustomers.forEach((c) => this.customers.set(c.id, c));
    nonDemoUserMemories.forEach((m) => this.memories.set(m.id, m));
    nonDemoUserRecommendations.forEach((r) => this.recommendations.set(r.id, r));

    this.persistToDisk();
  }

  /**
   * Resets ONLY the simulation records belonging to a specific visitor session.
   * Leaves shared canonical fixtures and other visitors' data completely untouched!
   */
  public resetVisitorRecords(visitorId: string): void {
    if (!visitorId) return;

    for (const [id, goal] of Array.from(this.goals.entries())) {
      if (goal.visitorId === visitorId) {
        this.goals.delete(id);
      }
    }

    for (const [id, cust] of Array.from(this.customers.entries())) {
      if (cust.visitorId === visitorId) {
        this.customers.delete(id);
      }
    }

    for (const [id, mem] of Array.from(this.memories.entries())) {
      if (mem.visitorId === visitorId) {
        this.memories.delete(id);
      }
    }

    for (const [id, rec] of Array.from(this.recommendations.entries())) {
      if (rec.visitorId === visitorId) {
        this.recommendations.delete(id);
      }
    }

    this.persistToDisk();
  }

  /**
   * Clones a canonical demo fixture into a visitor-owned mutable simulation goal.
   */
  public cloneGoalForVisitor(canonicalGoalId: string, visitorId: string): PaymentGoal | undefined {
    const canonical = this.goals.get(canonicalGoalId);
    if (!canonical) return undefined;

    const clonedId = `goal_vis_${canonicalGoalId}_${visitorId.slice(-6)}_${Date.now()}`;
    const clonedGoal: PaymentGoal = {
      ...canonical,
      id: clonedId,
      visitorId,
      isDemoFixture: false,
      isSimulated: true,
      mode: "simulation",
      paypalOrderId: canonical.paypalOrderId ? `SIM_ORD_${clonedId}` : undefined,
      paypalPaymentLink: canonical.paypalPaymentLink
        ? `/checkout/simulation?orderId=SIM_ORD_${clonedId}`
        : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.goals.set(clonedId, clonedGoal);
    this.persistToDisk();
    return clonedGoal;
  }

  // Customers
  public getCustomers(): Customer[] {
    return Array.from(this.customers.values());
  }

  public getCustomerById(id: string): Customer | undefined {
    return this.customers.get(id);
  }

  public findCustomerByName(name: string): Customer | undefined {
    const clean = name.toLowerCase().trim();
    return Array.from(this.customers.values()).find((c) =>
      c.name.toLowerCase().includes(clean) || clean.includes(c.name.toLowerCase().split(" ")[0])
    );
  }

  public saveCustomer(customer: Customer): Customer {
    this.customers.set(customer.id, customer);
    this.persistToDisk();
    return customer;
  }

  public deleteCustomer(id: string): boolean {
    const deleted = this.customers.delete(id);
    if (deleted) this.persistToDisk();
    return deleted;
  }

  // Payment Goals
  public getGoals(): PaymentGoal[] {
    return Array.from(this.goals.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  public getGoalById(id: string): PaymentGoal | undefined {
    return this.goals.get(id);
  }

  public saveGoal(goal: PaymentGoal): PaymentGoal {
    goal.updatedAt = new Date().toISOString();
    this.goals.set(goal.id, goal);
    this.persistToDisk();
    return goal;
  }

  public deleteGoal(id: string): boolean {
    const deleted = this.goals.delete(id);
    if (deleted) this.persistToDisk();
    return deleted;
  }

  public updateGoalStatus(
    id: string,
    status: PaymentGoal["status"],
    timelineEvent?: TimelineEvent
  ): PaymentGoal | undefined {
    const goal = this.goals.get(id);
    if (!goal) return undefined;
    goal.status = status;
    goal.updatedAt = new Date().toISOString();
    if (status === "paid" && !goal.paidAt) {
      goal.paidAt = new Date().toISOString();
    }
    if (timelineEvent) {
      goal.timeline.push(timelineEvent);
    }
    this.goals.set(id, goal);
    this.persistToDisk();
    return goal;
  }

  /**
   * Reconciles a paid goal and updates customer ledger exactly once.
   * Idempotent: repeated calls on an already-paid goal will not mutate balances or history again.
   */
  public reconcilePayment(
    goalId: string,
    captureId: string,
    capturedAmount: number,
    capturedCurrency: string = "USD",
    isSimulated: boolean = true
  ): { goal: PaymentGoal; customer?: Customer } | undefined {
    const goal = this.goals.get(goalId);
    if (!goal) return undefined;

    // Idempotent safeguard: if already marked paid, return existing state
    if (goal.status === "paid") {
      return { goal, customer: goal.customerId ? this.getCustomerById(goal.customerId) : undefined };
    }

    goal.status = "paid";
    goal.paypalCaptureId = captureId;
    goal.capturedAmount = capturedAmount;
    goal.capturedCurrency = capturedCurrency;
    goal.paidAt = new Date().toISOString();
    goal.updatedAt = new Date().toISOString();

    let customer: Customer | undefined;
    if (goal.customerId) {
      customer = this.getCustomerById(goal.customerId);
      if (customer) {
        customer.outstandingAmount = Math.max(0, customer.outstandingAmount - goal.amount);
        customer.lastPaymentDate = new Date().toISOString().split("T")[0];
        customer.lastPaymentAmount = goal.amount;
        customer.paymentHistory.push({
          id: `hist_${Date.now()}`,
          date: customer.lastPaymentDate,
          amount: goal.amount,
          currency: goal.currency,
          paypalOrderId: goal.paypalOrderId || captureId,
          status: "completed",
          purpose: goal.purpose || goal.goal,
          isSimulated,
        });
        this.saveCustomer(customer);
      }
    }

    this.saveGoal(goal);
    return { goal, customer };
  }

  public addTimelineEvent(goalId: string, event: TimelineEvent): void {
    const goal = this.goals.get(goalId);
    if (goal) {
      goal.timeline.push(event);
      goal.updatedAt = new Date().toISOString();
      this.goals.set(goalId, goal);
      this.persistToDisk();
    }
  }

  // Memories
  public getMemories(): MemoryItem[] {
    return Array.from(this.memories.values());
  }

  public getMemoryById(id: string): MemoryItem | undefined {
    return this.memories.get(id);
  }

  public saveMemory(memory: MemoryItem): MemoryItem {
    this.memories.set(memory.id, memory);
    this.persistToDisk();
    return memory;
  }

  public addMemory(key: string, value: string, category: MemoryItem["category"] = "preference", visitorId?: string): MemoryItem {
    const id = `mem_${Date.now()}`;
    const mem: MemoryItem = {
      id,
      key,
      value,
      category,
      createdAt: new Date().toISOString(),
      visitorId,
    };
    this.memories.set(id, mem);
    this.persistToDisk();
    return mem;
  }

  public deleteMemory(id: string): boolean {
    const deleted = this.memories.delete(id);
    if (deleted) this.persistToDisk();
    return deleted;
  }

  // Recommendations
  public getRecommendations(): AIRecommendation[] {
    return Array.from(this.recommendations.values());
  }

  public getRecommendationById(id: string): AIRecommendation | undefined {
    return this.recommendations.get(id);
  }

  public saveRecommendation(rec: AIRecommendation): AIRecommendation {
    this.recommendations.set(rec.id, rec);
    this.persistToDisk();
    return rec;
  }

  public dismissRecommendation(id: string): void {
    this.recommendations.delete(id);
    this.persistToDisk();
  }

  // KPI Metrics
  public getMetrics(goals?: PaymentGoal[]): DashboardMetrics {
    const all = goals || this.getGoals();
    const awaiting = all.filter(
      (g) => (g.status === "awaiting_payment" || g.status === "payment_created") && g.goalType === "collection"
    );
    // CRITICAL: Collected incoming customer money ONLY
    const paid = all.filter((g) => g.status === "paid" && g.goalType === "collection");
    const attention = all.filter(
      (g) =>
        (g.status === "pending_approval" || (g.requiresApproval && g.approvalStatus === "pending")) &&
        g.status !== "payout_approved" &&
        g.status !== "paid" &&
        g.status !== "cancelled" &&
        g.approvalStatus !== "approved"
    );

    const awaitingAmount = awaiting.reduce((sum, g) => sum + g.amount, 0);
    const paidAmount = paid.reduce((sum, g) => sum + g.amount, 0);

    const sandboxPaid = paid.filter((g) => !g.isSimulated);
    const simulatedPaid = paid.filter((g) => g.isSimulated);

    // Dedicated Payout Review Metrics (Separate from incoming customer collections)
    const payoutReviews = all.filter((g) => g.goalType === "payout_review");
    const approvedPayouts = payoutReviews.filter(
      (g) => g.status === "payout_approved" || g.approvalStatus === "approved"
    );
    const approvedPayoutsAmount = approvedPayouts.reduce((sum, g) => sum + g.amount, 0);

    return {
      totalGoals: all.length,
      awaitingCount: awaiting.length,
      awaitingAmount,
      paidCount: paid.length,
      paidAmount,
      sandboxPaidCount: sandboxPaid.length,
      sandboxPaidAmount: sandboxPaid.reduce((sum, g) => sum + g.amount, 0),
      simulatedPaidCount: simulatedPaid.length,
      simulatedPaidAmount: simulatedPaid.reduce((sum, g) => sum + g.amount, 0),
      payoutApprovedCount: approvedPayouts.length,
      payoutApprovedAmount: approvedPayoutsAmount,
      attentionCount: attention.length,
    };
  }
}

// Global Singleton Store for in-process & file persistence
const globalStoreKey = Symbol.for("paypilot.database.store");
const globalObj = globalThis as unknown as { [globalStoreKey]?: DatabaseStore };

export function setGlobalDatabase(store: DatabaseStore): void {
  globalObj[globalStoreKey] = store;
}

export const db: DatabaseStore = new Proxy({} as DatabaseStore, {
  get(_target, prop) {
    if (!globalObj[globalStoreKey]) {
      globalObj[globalStoreKey] = new DatabaseStore();
    }
    const instance = globalObj[globalStoreKey]!;
    const val = Reflect.get(instance, prop);
    if (typeof val === "function") {
      return val.bind(instance);
    }
    return val;
  },
  set(_target, prop, value) {
    if (!globalObj[globalStoreKey]) {
      globalObj[globalStoreKey] = new DatabaseStore();
    }
    const instance = globalObj[globalStoreKey]!;
    return Reflect.set(instance, prop, value);
  },
});


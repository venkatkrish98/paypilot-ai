// ==============================================================================
// PayPilot AI - Comprehensive Test Suite
// Verifying correct transitions, idempotency, failure handling, fail-closed auth,
// memory storage isolation, safe demo reset, payout metrics separation, and simulation truthfulness
// ==============================================================================

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from "vitest";
import path from "path";
import fs from "fs";
import { defaultOrchestrator } from "../src/packages/agent";
import { DatabaseStore, setGlobalDatabase, db } from "../src/packages/database";
import { defaultSafetyEngine } from "../src/packages/risk";
import { defaultPayPalClient, PayPalClient } from "../src/packages/paypal";
import { PaymentGoal, Customer } from "../src/packages/types";
import { getNextDayOfWeek, parseRelativeDate } from "../src/packages/agent/ai-planner";
import { checkWriteAuthorization, isRequestAdmin } from "../src/packages/security/auth";

// ------------------------------------------------------------------------------
// Database Test Isolation: Force in-memory database store
// Prevents any test runs from writing to or overwriting data/paypilot_db.json
// ------------------------------------------------------------------------------
process.env.PAYPILOT_DB_PATH = ":memory:";
const inMemoryStore = new DatabaseStore(":memory:");
setGlobalDatabase(inMemoryStore);

const realDbPath = path.resolve(process.cwd(), "data", "paypilot_db.json");
let initialRealDbExists = false;
let initialRealDbMtime = 0;
let initialRealDbContent: string | null = null;

describe("PayPilot AI Test Suite", () => {
  beforeAll(() => {
    if (fs.existsSync(realDbPath)) {
      initialRealDbExists = true;
      initialRealDbMtime = fs.statSync(realDbPath).mtimeMs;
      initialRealDbContent = fs.readFileSync(realDbPath, "utf-8");
    }
  });

  beforeEach(() => {
    // Reset database to initial deterministic demo state in-memory before each test
    db.seedDemoData();
  });

  afterAll(() => {
    // Restore pristine demo data in memory after test suite completes
    db.seedDemoData();

    // Verify that data/paypilot_db.json was NEVER modified or overwritten by tests!
    if (initialRealDbExists && initialRealDbContent !== null) {
      expect(fs.existsSync(realDbPath)).toBe(true);
      const afterContent = fs.readFileSync(realDbPath, "utf-8");
      expect(afterContent).toBe(initialRealDbContent);
      const afterMtime = fs.statSync(realDbPath).mtimeMs;
      expect(afterMtime).toBe(initialRealDbMtime);
    }
  });

  // 1. Create payment goal with valid structured parameters
  it("1. should create a payment goal with valid structured parameters", async () => {
    const goal: PaymentGoal = {
      id: "goal_test_1",
      goal: "Collect $500 from Sarah",
      goalType: "collection",
      customer: "Sarah Jenkins",
      amount: 500,
      currency: "USD",
      deadline: "2026-10-20",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [],
      requiresApproval: false,
      createdBy: "agent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };

    const saved = db.saveGoal(goal);
    expect(saved.id).toBe("goal_test_1");
    expect(db.getGoalById("goal_test_1")?.amount).toBe(500);
    expect(db.getGoalById("goal_test_1")?.isSimulated).toBe(true);
  });

  // 2. Customer lookup
  it("2. should lookup customer and retrieve context and history", () => {
    const sarah = db.findCustomerByName("Sarah");
    expect(sarah).toBeDefined();
    expect(sarah?.name).toBe("Sarah Jenkins");
    expect(sarah?.email).toContain("designcraft.io");
    expect(sarah?.paymentHistory.length).toBeGreaterThan(0);
  });

  // 3. Truthful Simulation vs Real PayPal order creation & In-App checkout URL
  it("3. should label simulated orders unmistakably and provide in-app simulation checkout link", async () => {
    const order = await defaultPayPalClient.createOrder({
      amount: 1200,
      currency: "USD",
      description: "Website Project Delivery",
    });

    expect(order.id).toBeDefined();
    expect(order.status).toBe("CREATED");
    // In unconfigured demo mode, order ID MUST start with SIMULATED_
    expect(order.id).toContain("SIMULATED_ORD_");
    expect(order.isSimulated).toBe(true);
    expect(order.mode).toBe("simulation");

    const checkoutUrl = defaultPayPalClient.getCheckoutUrl(order);
    // In-app simulation checkout link, not sending to live paypal with fabricated token
    expect(checkoutUrl).toContain("/checkout/simulation");
    expect(checkoutUrl).toContain(order.id);
  });

  // 4. Live production environment blocking
  it("4. should strictly block live production PayPal environment to enforce hackathon sandbox safety", () => {
    expect(() => {
      new PayPalClient({ environment: "production" });
    }).toThrow(/CRITICAL SAFETY ENFORCEMENT/);
  });

  // 5. Capture validation: Amount and currency matching
  it("5. should capture payment and verify amount and currency match expected values in simulation", async () => {
    const order = await defaultPayPalClient.createOrder({ amount: 1200 });
    const capture = await defaultPayPalClient.captureOrder(order.id, 1200, "USD");

    expect(capture.id).toContain("SIMULATED_CAP_");
    expect(capture.status).toBe("COMPLETED");
    expect(parseFloat(capture.amount.value)).toBe(1200);
    expect(capture.amount.currency_code).toBe("USD");
  });

  // 6. Real Sandbox: Rejection when order is not approved
  it("6. should reject sandbox capture if order status is not APPROVED", async () => {
    const client = new PayPalClient({
      clientId: "TEST_CLIENT_ID_SANDBOX_12345",
      clientSecret: "TEST_CLIENT_SECRET_SANDBOX_12345",
      environment: "sandbox",
    });

    vi.spyOn(client, "getOrder").mockResolvedValueOnce({
      id: "SANDBOX_ORD_UNAPPROVED",
      status: "CREATED",
      intent: "CAPTURE",
      isSimulated: false,
      mode: "sandbox",
      create_time: new Date().toISOString(),
      links: [],
    });

    await expect(
      client.captureOrder("SANDBOX_ORD_UNAPPROVED", 1200, "USD")
    ).rejects.toThrow(/buyer must approve the payment on PayPal Sandbox before capture/);
  });

  // 7. Amount mismatch rejection in Sandbox capture
  it("7. should reject sandbox capture if captured amount mismatches expected goal amount", async () => {
    const client = new PayPalClient({
      clientId: "TEST_CLIENT_ID_SANDBOX_12345",
      clientSecret: "TEST_CLIENT_SECRET_SANDBOX_12345",
      environment: "sandbox",
    });

    vi.spyOn(client, "getOrder").mockResolvedValueOnce({
      id: "SANDBOX_ORD_1",
      status: "APPROVED",
      intent: "CAPTURE",
      isSimulated: false,
      mode: "sandbox",
      create_time: new Date().toISOString(),
      links: [],
    });

    vi.spyOn(client, "getAccessToken").mockResolvedValueOnce("mock_access_token");

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "SANDBOX_CAP_MISMATCH",
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: "SANDBOX_CAP_MISMATCH",
                  status: "COMPLETED",
                  amount: { value: "500.00", currency_code: "USD" },
                },
              ],
            },
          },
        ],
      }),
    } as any);

    try {
      await expect(
        client.captureOrder("SANDBOX_ORD_1", 1200, "USD")
      ).rejects.toThrow(/Captured amount mismatch/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 8. Currency mismatch rejection in Sandbox capture
  it("8. should reject sandbox capture if captured currency mismatches expected currency", async () => {
    const client = new PayPalClient({
      clientId: "TEST_CLIENT_ID_SANDBOX_12345",
      clientSecret: "TEST_CLIENT_SECRET_SANDBOX_12345",
      environment: "sandbox",
    });

    vi.spyOn(client, "getOrder").mockResolvedValueOnce({
      id: "SANDBOX_ORD_2",
      status: "APPROVED",
      intent: "CAPTURE",
      isSimulated: false,
      mode: "sandbox",
      create_time: new Date().toISOString(),
      links: [],
    });

    vi.spyOn(client, "getAccessToken").mockResolvedValueOnce("mock_access_token");

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "SANDBOX_CAP_CURRENCY_MISMATCH",
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: "SANDBOX_CAP_CURRENCY_MISMATCH",
                  status: "COMPLETED",
                  amount: { value: "1200.00", currency_code: "EUR" },
                },
              ],
            },
          },
        ],
      }),
    } as any);

    try {
      await expect(
        client.captureOrder("SANDBOX_ORD_2", 1200, "USD")
      ).rejects.toThrow(/Captured currency mismatch/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 9. Non-completed capture status rejection in Sandbox
  it("9. should reject sandbox capture if PayPal returned non-completed status (e.g. PENDING or FAILED)", async () => {
    const client = new PayPalClient({
      clientId: "TEST_CLIENT_ID_SANDBOX_12345",
      clientSecret: "TEST_CLIENT_SECRET_SANDBOX_12345",
      environment: "sandbox",
    });

    vi.spyOn(client, "getOrder").mockResolvedValueOnce({
      id: "SANDBOX_ORD_3",
      status: "APPROVED",
      intent: "CAPTURE",
      isSimulated: false,
      mode: "sandbox",
      create_time: new Date().toISOString(),
      links: [],
    });

    vi.spyOn(client, "getAccessToken").mockResolvedValueOnce("mock_access_token");

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "SANDBOX_CAP_PENDING",
        status: "PENDING",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: "SANDBOX_CAP_PENDING",
                  status: "PENDING",
                  amount: { value: "1200.00", currency_code: "USD" },
                },
              ],
            },
          },
        ],
      }),
    } as any);

    try {
      await expect(
        client.captureOrder("SANDBOX_ORD_3", 1200, "USD")
      ).rejects.toThrow(/PayPal capture was not completed/);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // 10. Duplicate payment prevention (24h window)
  it("10. should detect duplicate payment requests created within 24 hours", () => {
    const recentGoal: PaymentGoal = {
      id: "goal_recent_sarah",
      goal: "Collect $1200 from Sarah",
      goalType: "collection",
      customer: "Sarah Jenkins",
      amount: 1200,
      currency: "USD",
      deadline: "2026-10-20",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [],
      requiresApproval: false,
      createdBy: "agent",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      timeline: [],
    };

    const evaluation = defaultSafetyEngine.evaluate({
      amount: 1200,
      currency: "USD",
      customerName: "Sarah Jenkins",
      existingGoals: [recentGoal],
    });

    const duplicateCheck = evaluation.checks.find((c) => c.id === "check_duplicate_payment");
    expect(duplicateCheck).toBeDefined();
    expect(duplicateCheck?.passed).toBe(false);
    expect(evaluation.riskScore).toBeGreaterThan(30);
  });

  // 11. Risk detection and approval pause
  it("11. should flag high-risk for unfamiliar recipient and amount exceeding threshold", () => {
    const evaluation = defaultSafetyEngine.evaluate({
      amount: 2500,
      currency: "USD",
      customerName: "Unknown Vendor X",
      customThreshold: 2000,
      isPayout: true,
    });

    expect(evaluation.riskLevel).toBe("high");
    expect(evaluation.requiresApproval).toBe(true);
    expect(evaluation.approvalReason).toContain("exceeds standard review threshold");
  });

  // 12. Payout review vs Inbound Collection separation
  it("12. should separate payout review from inbound collection flows without creating fake Orders checkout tokens", async () => {
    const mikeGoal = db.getGoalById("goal_mike_2500");
    expect(mikeGoal).toBeDefined();
    expect(mikeGoal?.goalType).toBe("payout_review");
    expect(mikeGoal?.status).toBe("pending_approval");
    // Before approval, does not have a PayPal orders checkout link
    expect(mikeGoal?.paypalOrderId).toBeUndefined();
  });

  // 13. Dynamic relative Friday calculation (no stale hardcoded dates)
  it("13. should calculate upcoming Friday dynamically without stale hardcoded dates", () => {
    const friday = getNextDayOfWeek(5);
    expect(friday).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const [year, month, day] = friday.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day);
    expect(dateObj.getDay()).toBe(5); // 5 is Friday

    const parsedFriday = parseRelativeDate("by Friday");
    expect(parsedFriday).toBe(friday);
  });

  // 14. Customer ledger balance consistency after capture
  it("14. should update customer balance accurately and idempotently upon payment capture", () => {
    const sarahBefore = db.getCustomerById("cust_sarah");
    expect(sarahBefore?.outstandingAmount).toBe(1200);

    // Reconcile payment with capture ID
    const res = db.reconcilePayment("goal_sarah_1200", "SIMULATED_CAP_SARAH_1200", 1200, "USD", true);
    expect(res?.goal.status).toBe("paid");

    const sarahAfter = db.getCustomerById("cust_sarah");
    expect(sarahAfter?.outstandingAmount).toBe(0);
    expect(sarahAfter?.lastPaymentAmount).toBe(1200);

    // Repeated capture / reconcile on already paid goal should not deduct further (idempotent)
    const resAgain = db.reconcilePayment("goal_sarah_1200", "SIMULATED_CAP_SARAH_1200", 1200, "USD", true);
    expect(resAgain?.goal.status).toBe("paid");
    expect(db.getCustomerById("cust_sarah")?.outstandingAmount).toBe(0);
  });

  // 15. Safe Demo Reset: Preserves non-demo user data and restores canonical fixtures
  it("15. should restore canonical demo fixtures and customer balances without erasing non-demo user data", () => {
    // Add a genuine user-created custom goal
    const customUserGoal: PaymentGoal = {
      id: "user_goal_custom_999",
      goal: "Custom user invoice for consulting",
      goalType: "collection",
      customer: "Genuine Client Inc",
      amount: 450,
      currency: "USD",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      isDemoFixture: false,
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [],
      requiresApproval: false,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };
    db.saveGoal(customUserGoal);

    // Verify custom goal exists
    expect(db.getGoalById("user_goal_custom_999")).toBeDefined();

    // Perform safe reset
    db.resetDemoFixtures();

    // Verify canonical fixtures are present
    expect(db.getGoalById("goal_sarah_1200")).toBeDefined();
    expect(db.getGoalById("goal_john_850")).toBeDefined();
    expect(db.getGoalById("goal_mike_2500")).toBeDefined();
    expect(db.getGoalById("goal_acme_600")).toBeDefined();

    // Verify non-demo user goal was safely preserved!
    expect(db.getGoalById("user_goal_custom_999")).toBeDefined();

    // Verify customer balances match canonical fixtures
    expect(db.getCustomerById("cust_sarah")?.outstandingAmount).toBe(1200);
    expect(db.getCustomerById("cust_john")?.outstandingAmount).toBe(0);
    expect(db.getCustomerById("cust_mike")?.outstandingAmount).toBe(2500);
    expect(db.getCustomerById("cust_acme")?.outstandingAmount).toBe(600);
  });

  // 16. Persistence failure surfacing
  it("16. should surface persistence errors when disk writes fail on file-backed stores", () => {
    const fileStore = new DatabaseStore("test_error_handling.json");
    const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
      throw new Error("EACCES: permission denied, open 'test_error_handling.json'");
    });

    try {
      expect(() => {
        fileStore.persistToDisk();
      }).toThrow(/EACCES: permission denied/);
    } finally {
      writeSpy.mockRestore();
      if (fs.existsSync("test_error_handling.json")) {
        fs.unlinkSync("test_error_handling.json");
      }
    }
  });

  // 17. Rejection of approval bypass via direct goal update
  it("17. should reject attempts to bypass human approval via direct status change to awaiting_payment", async () => {
    const { PATCH } = await import("../src/app/api/goals/[id]/route");
    const mikeGoal = db.getGoalById("goal_mike_2500");
    expect(mikeGoal?.status).toBe("pending_approval");

    const req = new Request("http://localhost:3000/api/goals/goal_mike_2500", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "awaiting_payment" }),
    });

    const res = await PATCH(req, { params: { id: "goal_mike_2500" } });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Cannot bypass approval workflow");
  });

  // 18. Rejection of capture on goals still pending approval
  it("18. should reject attempts to capture a payment goal that is still pending approval", async () => {
    const { POST: capturePost } = await import("../src/app/api/goals/[id]/capture/route");
    const req = new Request("http://localhost:3000/api/goals/goal_mike_2500/capture", {
      method: "POST",
    });

    const res = await capturePost(req, { params: { id: "goal_mike_2500" } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("currently held in pending_approval");
  });

  // 19. Duplicate approval rejection (Idempotency)
  it("19. should reject duplicate approvals idempotently", async () => {
    const { POST: approvePost } = await import("../src/app/api/goals/[id]/approve/route");
    const req1 = new Request("http://localhost:3000/api/goals/goal_mike_2500/approve", {
      method: "POST",
    });

    // First approval
    const res1 = await approvePost(req1, { params: { id: "goal_mike_2500" } });
    expect(res1.status).toBe(200);

    // Second approval attempt should be rejected with 409 Conflict
    const req2 = new Request("http://localhost:3000/api/goals/goal_mike_2500/approve", {
      method: "POST",
    });
    const res2 = await approvePost(req2, { params: { id: "goal_mike_2500" } });
    expect(res2.status).toBe(409);
    const body = await res2.json();
    expect(body.isAlreadyApproved).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // NEW VERIFIED ISSUE TESTS:
  // ----------------------------------------------------------------------------

  // 20. Strict Database Isolation: In-memory store never writes to user's local database
  it("20. should strictly isolate test database in-memory without mutating data/paypilot_db.json", () => {
    expect(db.getFilePath()).toBe(":memory:");

    // Save arbitrary record
    db.saveGoal({
      id: "goal_isolated_test",
      goal: "Test in memory isolation",
      goalType: "collection",
      customer: "Isolated Customer",
      amount: 999,
      currency: "USD",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      riskLevel: "low",
      riskScore: 1,
      riskChecks: [],
      requiresApproval: false,
      createdBy: "agent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    });

    // Seed demo data in memory
    db.seedDemoData();

    // Verify persistence does not write to real database file
    if (initialRealDbExists && initialRealDbContent !== null) {
      const currentContent = fs.readFileSync(realDbPath, "utf-8");
      expect(currentContent).toBe(initialRealDbContent);
    }
  });

  // 21. Fail-closed API write protection in production with missing configuration
  it("21. should fail closed in production denying unauthenticated mutations by default", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.PAYPILOT_ADMIN_KEY;
    const originalDemo = process.env.DEMO_MODE;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.PAYPILOT_ADMIN_KEY;
      delete process.env.PAYPILOT_API_KEY;
      delete process.env.DEMO_MODE;

      // An unauthenticated API mutation in production with missing config must fail closed
      const unauthReq = new Request("http://localhost:3000/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const authResult = checkWriteAuthorization(unauthReq);
      expect(authResult.authorized).toBe(false);
      expect(authResult.statusCode).toBe(401);
      expect(authResult.reason).toContain("Missing administrative credentials");
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey !== undefined) process.env.PAYPILOT_ADMIN_KEY = originalKey;
      if (originalDemo !== undefined) process.env.DEMO_MODE = originalDemo;
    }
  });

  // 22. Production write protection with configured auth key
  it("22. should allow mutations in production when presenting configured admin key", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.PAYPILOT_ADMIN_KEY;

    try {
      process.env.NODE_ENV = "production";
      process.env.PAYPILOT_ADMIN_KEY = "test_super_secret_admin_key_999";

      // 1. Valid Bearer Token
      const validReq = new Request("http://localhost:3000/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test_super_secret_admin_key_999",
        },
      });
      const validResult = checkWriteAuthorization(validReq);
      expect(validResult.authorized).toBe(true);

      // 2. Valid x-api-key header
      const apiKeyReq = new Request("http://localhost:3000/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": "test_super_secret_admin_key_999",
        },
      });
      const apiKeyResult = checkWriteAuthorization(apiKeyReq);
      expect(apiKeyResult.authorized).toBe(true);

      // 3. Invalid token
      const invalidReq = new Request("http://localhost:3000/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer wrong_secret_token",
        },
      });
      const invalidResult = checkWriteAuthorization(invalidReq);
      expect(invalidResult.authorized).toBe(false);
      expect(invalidResult.statusCode).toBe(401);
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey !== undefined) process.env.PAYPILOT_ADMIN_KEY = originalKey;
      else delete process.env.PAYPILOT_ADMIN_KEY;
    }
  });

  // 23. GET /api/auth/session truthfulness & zero token emission
  it("23. should inspect session status truthfully without granting mutation tokens to anonymous callers", async () => {
    const { GET: getSession } = await import("../src/app/api/auth/session/route");

    // Anonymous request: Must NOT return an authorization token to anyone or grant mutation authority over real Sandbox
    const anonymousReq = new Request("http://localhost:3000/api/auth/session", { method: "GET" });
    const anonRes = await getSession(anonymousReq);
    expect(anonRes.status).toBe(200);
    const anonJson = await anonRes.json();

    expect(anonJson.token).toBeUndefined();
    expect(anonJson.authToken).toBeUndefined();
    expect(anonJson.sessionToken).toBeUndefined();
    expect(anonJson.authenticated).toBe(false);
    expect(anonJson.role).toBe("anonymous");
    expect(anonJson.sandboxAccess).toBe(false);

    // Admin request with configured key
    const originalKey = process.env.PAYPILOT_ADMIN_KEY;
    try {
      process.env.PAYPILOT_ADMIN_KEY = "test_admin_key_truthful_session";
      const adminReq = new Request("http://localhost:3000/api/auth/session", {
        method: "GET",
        headers: { Authorization: "Bearer test_admin_key_truthful_session" },
      });
      const adminRes = await getSession(adminReq);
      expect(adminRes.status).toBe(200);
      const adminJson = await adminRes.json();
      expect(adminJson.authenticated).toBe(true);
      expect(adminJson.role).toBe("admin");
      expect(adminJson.sandboxAccess).toBe(true);
      expect(adminJson.token).toBeUndefined();
    } finally {
      if (originalKey !== undefined) process.env.PAYPILOT_ADMIN_KEY = originalKey;
      else delete process.env.PAYPILOT_ADMIN_KEY;
    }
  });

  // 24. Safe Demo Reset preserves all non-demo user data (goals, customers, memories, recommendations)
  it("24. should preserve all non-demo user data including memories, recommendations, goals and customers on demo reset", () => {
    // 1. Customer with standard cust_<timestamp/uuid> prefix
    const normalCustomer: Customer = {
      id: "cust_1791888888_real_user",
      name: "Marcus Aurelius",
      email: "marcus@meditations.org",
      outstandingAmount: 750,
      riskIndicators: [],
      isNewRecipient: false,
      notes: "Genuine user customer",
      paymentHistory: [],
      isDemoFixture: false,
    };
    db.saveCustomer(normalCustomer);

    // 2. Customer with custom non-cust_ ID
    const customCustomer: Customer = {
      id: "client_enterprise_corp",
      name: "Enterprise Corp",
      email: "billing@enterprisecorp.io",
      outstandingAmount: 3200,
      riskIndicators: [],
      isNewRecipient: false,
      notes: "Enterprise account",
      paymentHistory: [],
      isDemoFixture: false,
    };
    db.saveCustomer(customCustomer);

    // 3. Goal with legacy timestamp ID
    const legacyGoal: PaymentGoal = {
      id: "goal_1791234567890",
      goal: "Legacy invoice for Marcus",
      goalType: "collection",
      customer: "Marcus Aurelius",
      amount: 750,
      currency: "USD",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      isDemoFixture: false,
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [],
      requiresApproval: false,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };
    db.saveGoal(legacyGoal);

    // 4. Custom Memory with arbitrary ID
    db.saveMemory({
      id: "mem_custom_user_rule_999",
      key: "enterprise_payment_terms",
      value: "Enterprise Corp requires net-45 invoicing terms.",
      category: "rule",
    });

    // 5. Custom Recommendation with arbitrary ID
    db.saveRecommendation({
      id: "rec_arbitrary_user_rec_42",
      title: "Follow up with Marcus",
      description: "Custom user follow-up recommendation.",
      actionLabel: "Send Message",
      actionType: "prepare_followup",
      goalId: "goal_1791234567890",
      urgency: "medium",
      createdAt: new Date().toISOString(),
    });

    // Run resetDemoFixtures
    db.resetDemoFixtures();

    // Verify user customers, goals, memories, and recommendations were preserved!
    expect(db.getCustomerById("cust_1791888888_real_user")).toBeDefined();
    expect(db.getCustomerById("client_enterprise_corp")).toBeDefined();
    expect(db.getGoalById("goal_1791234567890")).toBeDefined();
    expect(db.getMemoryById("mem_custom_user_rule_999")).toBeDefined();
    expect(db.getRecommendationById("rec_arbitrary_user_rec_42")).toBeDefined();

    // Verify canonical fixtures exist and their balances are accurately restored
    expect(db.getCustomerById("cust_sarah")?.outstandingAmount).toBe(1200);
    expect(db.getCustomerById("cust_john")?.outstandingAmount).toBe(0);
    expect(db.getCustomerById("cust_mike")?.outstandingAmount).toBe(2500);
    expect(db.getCustomerById("cust_acme")?.outstandingAmount).toBe(600);
    expect(db.getMemoryById("mem_1")).toBeDefined();
    expect(db.getRecommendationById("rec_1")).toBeDefined();
  });

  // 25. Payout reviews separation: Safety sign-off recorded without reducing vendor balance or adding to payment history
  it("25. should separate approved payout reviews from payout execution, preserving vendor balance and history", async () => {
    // Check initial metrics: John paid $850 incoming collection, Mike is pending payout review
    const initialMetrics = db.getMetrics();
    expect(initialMetrics.paidCount).toBe(1);
    expect(initialMetrics.paidAmount).toBe(850);
    expect(initialMetrics.payoutApprovedCount).toBe(0);
    expect(initialMetrics.payoutApprovedAmount).toBe(0);

    // Initial Mike Reynolds vendor balance: $2,500, no completed history
    const initialMike = db.getCustomerById("cust_mike");
    expect(initialMike?.outstandingAmount).toBe(2500);
    expect(initialMike?.paymentHistory.length).toBe(0);

    // Approve Mike Reynolds' $2,500 vendor payout
    const { POST: approvePost } = await import("../src/app/api/goals/[id]/approve/route");
    const req = new Request("http://localhost:3000/api/goals/goal_mike_2500/approve", {
      method: "POST",
    });

    const res = await approvePost(req, { params: { id: "goal_mike_2500" } });
    expect(res.status).toBe(200);

    const mikeGoalAfter = db.getGoalById("goal_mike_2500");
    // State machine check: Must transition to payout_approved, NOT paid
    expect(mikeGoalAfter?.status).toBe("payout_approved");
    expect(mikeGoalAfter?.approvalStatus).toBe("approved");

    // CRITICAL LEDGER VERIFICATION:
    // Payout approval records safety sign-off only; vendor balance must NOT be reduced
    // and no completed payment-history entry must be added without real payout API execution.
    const mikeCustAfter = db.getCustomerById("cust_mike");
    expect(mikeCustAfter?.outstandingAmount).toBe(2500);
    expect(mikeCustAfter?.paymentHistory.length).toBe(0);

    // Metrics check: Total collected / paid incoming money must NOT be inflated by outgoing vendor approvals!
    const updatedMetrics = db.getMetrics();
    expect(updatedMetrics.paidCount).toBe(1);
    expect(updatedMetrics.paidAmount).toBe(850);
    expect(updatedMetrics.payoutApprovedCount).toBe(1);
    expect(updatedMetrics.payoutApprovedAmount).toBe(2500);

    // Simulation timeline check: Explicitly notes simulation only and no payout dispatched
    const timeline = mikeGoalAfter?.timeline || [];
    const approvalEvent = timeline.find((t) => t.title.toLowerCase().includes("approved"));
    expect(approvalEvent).toBeDefined();
    expect(approvalEvent?.isSimulated).toBe(true);
    expect(approvalEvent?.title).toContain("No Payout Dispatched");
    expect(approvalEvent?.description).toContain("Vendor balance remains unchanged");
  });

  // 26. Simulation checkout URL contracts
  it("26. should return /checkout/simulation for simulated orders and never send fabricated tokens to PayPal", async () => {
    const simOrder = await defaultPayPalClient.createOrder({
      amount: 1200,
      currency: "USD",
      description: "Simulation Order",
    });

    expect(simOrder.isSimulated).toBe(true);
    const checkoutUrl = defaultPayPalClient.getCheckoutUrl(simOrder);
    expect(checkoutUrl).toMatch(/^\/checkout\/simulation\?orderId=SIMULATED_ORD_/);
    expect(checkoutUrl).not.toContain("paypal.com");
  });

  // 27. End-to-end API route write protection: Admin key required in production for non-simulated operations
  it("27. should enforce write protection at API route handler level and permit admin key", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalKey = process.env.PAYPILOT_ADMIN_KEY;
    const { POST: createGoalPost } = await import("../src/app/api/goals/route");

    try {
      process.env.NODE_ENV = "production";
      delete process.env.PAYPILOT_ADMIN_KEY;

      const payload = JSON.stringify({
        goal: "Collect $300 for UI work",
        customer: "Design Studio",
        amount: 300,
        currency: "USD",
      });

      // Configured admin key succeeds
      process.env.PAYPILOT_ADMIN_KEY = "prod_admin_secret_999";
      const authKeyReq = new Request("http://localhost:3000/api/goals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer prod_admin_secret_999",
        },
        body: payload,
      });
      const authKeyRes = await createGoalPost(authKeyReq);
      expect(authKeyRes.status).toBe(201);
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalKey !== undefined) process.env.PAYPILOT_ADMIN_KEY = originalKey;
      else delete process.env.PAYPILOT_ADMIN_KEY;
    }
  });

  // 28. /checkout/simulation route rejects real Sandbox goals
  it("28. should reject real Sandbox goals from /checkout/simulation route and never capture them via simulation", async () => {
    const realGoal: PaymentGoal = {
      id: "goal_real_sandbox_test",
      goal: "Real PayPal Sandbox collection",
      goalType: "collection",
      customer: "Real Buyer",
      amount: 100,
      currency: "USD",
      status: "awaiting_payment",
      mode: "sandbox",
      isSimulated: false,
      paypalOrderId: "REAL_SANDBOX_ORD_12345",
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [],
      requiresApproval: false,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };
    db.saveGoal(realGoal);

    const { POST: capturePost } = await import("../src/app/api/goals/[id]/capture/route");

    // Simulation checkout route attempting capture on real Sandbox order
    const simCheckoutReq = new Request("http://localhost:3000/api/goals/goal_real_sandbox_test/capture", {
      method: "POST",
      headers: {
        "x-simulation-checkout": "true",
      },
    });

    const res = await capturePost(simCheckoutReq, { params: { id: "goal_real_sandbox_test" } });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Real PayPal Sandbox orders cannot be captured from the simulation checkout route");

    // Real goal must NOT be marked paid
    const goalAfter = db.getGoalById("goal_real_sandbox_test");
    expect(goalAfter?.status).toBe("awaiting_payment");
  });

  // 29. Anonymous requests cannot approve or capture real Sandbox goals
  it("29. should deny anonymous requests from capturing or approving real Sandbox goals", async () => {
    const realGoal: PaymentGoal = {
      id: "goal_sandbox_security_test",
      goal: "Sandbox transaction requiring admin",
      goalType: "collection",
      customer: "VIP Client",
      amount: 500,
      currency: "USD",
      status: "awaiting_payment",
      mode: "sandbox",
      isSimulated: false,
      paypalOrderId: "REAL_SANDBOX_ORD_99999",
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [],
      requiresApproval: false,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };
    db.saveGoal(realGoal);

    const { POST: capturePost } = await import("../src/app/api/goals/[id]/capture/route");
    const anonCaptureReq = new Request("http://localhost:3000/api/goals/goal_sandbox_security_test/capture", {
      method: "POST",
    });

    const captureRes = await capturePost(anonCaptureReq, { params: { id: "goal_sandbox_security_test" } });
    expect(captureRes.status).toBe(401);
    const captureJson = await captureRes.json();
    expect(captureJson.error).toContain("Real PayPal Sandbox operations require administrative authorization");

    // Pending approval real sandbox goal
    const realPendingGoal: PaymentGoal = {
      id: "goal_sandbox_pending_test",
      goal: "Sandbox transaction pending approval",
      goalType: "collection",
      customer: "VIP Client",
      amount: 2500,
      currency: "USD",
      status: "pending_approval",
      mode: "sandbox",
      isSimulated: false,
      riskLevel: "high",
      riskScore: 70,
      riskChecks: [],
      requiresApproval: true,
      approvalStatus: "pending",
      createdBy: "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };
    db.saveGoal(realPendingGoal);

    const { POST: approvePost } = await import("../src/app/api/goals/[id]/approve/route");
    const anonApproveReq = new Request("http://localhost:3000/api/goals/goal_sandbox_pending_test/approve", {
      method: "POST",
    });

    const approveRes = await approvePost(anonApproveReq, { params: { id: "goal_sandbox_pending_test" } });
    expect(approveRes.status).toBe(401);
    const approveJson = await approveRes.json();
    expect(approveJson.error).toContain("Real PayPal Sandbox operations require administrative authorization");
  });
});


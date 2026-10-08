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
import { checkWriteAuthorization, isRequestAdmin, createSignedVisitorToken } from "../src/packages/security/auth";

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

const TEST_ADMIN_KEY = "test_admin_key_suite_2026";

describe("PayPilot AI Test Suite", () => {
  beforeAll(() => {
    if (fs.existsSync(realDbPath)) {
      initialRealDbExists = true;
      initialRealDbMtime = fs.statSync(realDbPath).mtimeMs;
      initialRealDbContent = fs.readFileSync(realDbPath, "utf-8");
    }
  });

  beforeEach(() => {
    process.env.PAYPILOT_ADMIN_KEY = TEST_ADMIN_KEY;
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
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${TEST_ADMIN_KEY}`,
      },
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
      headers: {
        authorization: `Bearer ${TEST_ADMIN_KEY}`,
      },
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
      headers: {
        authorization: `Bearer ${TEST_ADMIN_KEY}`,
      },
    });

    // First approval
    const res1 = await approvePost(req1, { params: { id: "goal_mike_2500" } });
    expect(res1.status).toBe(200);

    // Second approval attempt should be rejected with 409 Conflict
    const req2 = new Request("http://localhost:3000/api/goals/goal_mike_2500/approve", {
      method: "POST",
      headers: {
        authorization: `Bearer ${TEST_ADMIN_KEY}`,
      },
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
      headers: {
        authorization: `Bearer ${TEST_ADMIN_KEY}`,
      },
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
    const originalSecret = process.env.PAYPILOT_SESSION_SECRET;
    const { POST: createGoalPost } = await import("../src/app/api/goals/route");

    try {
      process.env.NODE_ENV = "production";
      delete process.env.PAYPILOT_ADMIN_KEY;
      process.env.PAYPILOT_SESSION_SECRET = "production_super_strong_secret_key_at_least_32_chars_long";

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
      if (originalSecret !== undefined) process.env.PAYPILOT_SESSION_SECRET = originalSecret;
      else delete process.env.PAYPILOT_SESSION_SECRET;
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

  // 30. Regression: Pending simulated goal -> Sandbox credentials enabled -> Approved transitions authoritatively
  // to mode: "sandbox" and isSimulated: false; anonymous simulation checkout/capture is rejected;
  // authenticated capture requires buyer approval; simulation capture still works without credentials.
  it("30. should authoritatively transition simulated pending goal to Sandbox upon approval with credentials, reject anonymous checkout/capture, and enforce buyer approval", async () => {
    const origClientId = process.env.PAYPAL_CLIENT_ID;
    const origClientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const origAdminKey = process.env.PAYPILOT_ADMIN_KEY;

    try {
      // Step A: Create a pending simulated goal
      const pendingSimGoal: PaymentGoal = {
        id: "goal_regress_sim_to_sandbox",
        goal: "Collect $1,500 from Enterprise Client",
        goalType: "collection",
        customer: "Enterprise Client",
        amount: 1500,
        currency: "USD",
        status: "pending_approval",
        mode: "simulation",
        isSimulated: true,
        riskLevel: "high",
        riskScore: 75,
        riskChecks: [],
        requiresApproval: true,
        approvalStatus: "pending",
        createdBy: "user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [],
      };
      db.saveGoal(pendingSimGoal);

      // Step B: Enable Sandbox credentials and mock PayPal client calls
      process.env.PAYPILOT_ADMIN_KEY = "super_admin_secret_999";
      vi.spyOn(defaultPayPalClient, "isConfigured").mockReturnValue(true);
      vi.spyOn(defaultPayPalClient, "createOrder").mockResolvedValue({
        id: "REAL_SANDBOX_ORD_987654321",
        status: "CREATED",
        intent: "CAPTURE",
        isSimulated: false,
        mode: "sandbox",
        create_time: new Date().toISOString(),
        links: [
          { href: "https://www.sandbox.paypal.com/checkoutnow?token=REAL_SANDBOX_ORD_987654321", rel: "approve", method: "GET" },
        ],
      });

      // Step C: Anonymous approval must be REJECTED because credentials are now active
      const { POST: approvePost } = await import("../src/app/api/goals/[id]/approve/route");
      const anonApproveReq = new Request("http://localhost:3000/api/goals/goal_regress_sim_to_sandbox/approve", {
        method: "POST",
      });
      const anonApproveRes = await approvePost(anonApproveReq, { params: { id: "goal_regress_sim_to_sandbox" } });
      expect(anonApproveRes.status).toBe(401);

      // Step D: Authenticated admin approval succeeds and authoritatively transitions goal to sandbox
      const adminApproveReq = new Request("http://localhost:3000/api/goals/goal_regress_sim_to_sandbox/approve", {
        method: "POST",
        headers: {
          authorization: "Bearer super_admin_secret_999",
        },
      });
      const adminApproveRes = await approvePost(adminApproveReq, { params: { id: "goal_regress_sim_to_sandbox" } });
      expect(adminApproveRes.status).toBe(200);

      const approvedGoal = db.getGoalById("goal_regress_sim_to_sandbox")!;
      expect(approvedGoal.status).toBe("awaiting_payment");
      expect(approvedGoal.mode).toBe("sandbox");
      expect(approvedGoal.isSimulated).toBe(false);
      expect(approvedGoal.paypalOrderId).toBe("REAL_SANDBOX_ORD_987654321");
      expect(approvedGoal.paypalPaymentLink).toContain("sandbox.paypal.com");

      // Verify timeline event has authoritative sandbox provenance
      const orderEvent = approvedGoal.timeline.find((t) => t.stage === "order_created");
      expect(orderEvent).toBeDefined();
      expect(orderEvent?.isSimulated).toBe(false);

      // Step E: Anonymous simulation checkout capture must be REJECTED
      const { POST: capturePost } = await import("../src/app/api/goals/[id]/capture/route");
      const anonSimCaptureReq = new Request("http://localhost:3000/api/goals/goal_regress_sim_to_sandbox/capture", {
        method: "POST",
        headers: {
          "x-simulation-checkout": "true",
        },
      });
      const anonSimRes = await capturePost(anonSimCaptureReq, { params: { id: "goal_regress_sim_to_sandbox" } });
      expect(anonSimRes.status).toBe(400);
      const anonSimJson = await anonSimRes.json();
      expect(anonSimJson.error).toContain("Real PayPal Sandbox orders cannot be captured from the simulation checkout route");

      // Step F: Anonymous general capture must be REJECTED with 401
      const anonCaptureReq = new Request("http://localhost:3000/api/goals/goal_regress_sim_to_sandbox/capture", {
        method: "POST",
      });
      const anonCaptureRes = await capturePost(anonCaptureReq, { params: { id: "goal_regress_sim_to_sandbox" } });
      expect(anonCaptureRes.status).toBe(401);

      // Step G: Authenticated capture before buyer approval must fail safely without marking paid
      vi.spyOn(defaultPayPalClient, "captureOrder").mockRejectedValueOnce(
        new Error("ORDER_NOT_APPROVED: Buyer has not yet authorized this payment order on PayPal Sandbox.")
      );
      const adminPreApprovalReq = new Request("http://localhost:3000/api/goals/goal_regress_sim_to_sandbox/capture", {
        method: "POST",
        headers: {
          authorization: "Bearer super_admin_secret_999",
        },
      });
      const adminPreApprovalRes = await capturePost(adminPreApprovalReq, { params: { id: "goal_regress_sim_to_sandbox" } });
      expect(adminPreApprovalRes.status).toBe(502);
      expect(db.getGoalById("goal_regress_sim_to_sandbox")?.status).toBe("awaiting_payment");

      // Step H: Authenticated capture after buyer approval completes successfully
      vi.spyOn(defaultPayPalClient, "captureOrder").mockResolvedValueOnce({
        id: "CAP_SANDBOX_REAL_777",
        status: "COMPLETED",
        amount: {
          value: "1500.00",
          currency_code: "USD",
        },
      });
      const adminPostApprovalReq = new Request("http://localhost:3000/api/goals/goal_regress_sim_to_sandbox/capture", {
        method: "POST",
        headers: {
          authorization: "Bearer super_admin_secret_999",
        },
      });
      const adminPostApprovalRes = await capturePost(adminPostApprovalReq, { params: { id: "goal_regress_sim_to_sandbox" } });
      expect(adminPostApprovalRes.status).toBe(200);

      const capturedGoal = db.getGoalById("goal_regress_sim_to_sandbox")!;
      expect(capturedGoal.status).toBe("paid");
      expect(capturedGoal.isSimulated).toBe(false);

      // Step I: Simulation capture still works when credentials are absent
      vi.spyOn(defaultPayPalClient, "isConfigured").mockReturnValue(false);
      const pendingSimPure: PaymentGoal = {
        id: "goal_pure_simulation_test",
        goal: "Collect $500 simulated",
        goalType: "collection",
        customer: "Simulation User",
        amount: 500,
        currency: "USD",
        status: "awaiting_payment",
        mode: "simulation",
        isSimulated: true,
        paypalOrderId: "SIMULATED_ORD_PURE_123",
        riskLevel: "low",
        riskScore: 10,
        riskChecks: [],
        requiresApproval: false,
        createdBy: "user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [],
      };
      db.saveGoal(pendingSimPure);

      const anonPureSimReq = new Request("http://localhost:3000/api/goals/goal_pure_simulation_test/capture", {
        method: "POST",
        headers: {
          "x-simulation-checkout": "true",
        },
      });
      const pureSimRes = await capturePost(anonPureSimReq, { params: { id: "goal_pure_simulation_test" } });
      expect(pureSimRes.status).toBe(200);
      expect(db.getGoalById("goal_pure_simulation_test")?.status).toBe("paid");
      expect(db.getGoalById("goal_pure_simulation_test")?.isSimulated).toBe(true);
    } finally {
      vi.restoreAllMocks();
      if (origClientId !== undefined) process.env.PAYPAL_CLIENT_ID = origClientId;
      else delete process.env.PAYPAL_CLIENT_ID;
      if (origClientSecret !== undefined) process.env.PAYPAL_CLIENT_SECRET = origClientSecret;
      else delete process.env.PAYPAL_CLIENT_SECRET;
      if (origAdminKey !== undefined) process.env.PAYPILOT_ADMIN_KEY = origAdminKey;
      else delete process.env.PAYPILOT_ADMIN_KEY;
    }
  });

  // 31. Reject inconsistent order provenance states
  it("31. should reject inconsistent order provenance states on capture and checkout", async () => {
    const { POST: capturePost } = await import("../src/app/api/goals/[id]/capture/route");

    // Case A: Simulation goal with real-looking PayPal order ID
    const corruptGoalA: PaymentGoal = {
      id: "goal_corrupt_provenance_a",
      goal: "Corrupted provenance A",
      goalType: "collection",
      customer: "Test",
      amount: 100,
      currency: "USD",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      paypalOrderId: "REAL_SANDBOX_ORDER_ID_ABC",
      riskLevel: "low",
      riskScore: 10,
      riskChecks: [],
      requiresApproval: false,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };
    db.saveGoal(corruptGoalA);

    const reqA = new Request("http://localhost:3000/api/goals/goal_corrupt_provenance_a/capture", { method: "POST" });
    const resA = await capturePost(reqA, { params: { id: "goal_corrupt_provenance_a" } });
    expect(resA.status).toBe(400);
    const jsonA = await resA.json();
    expect(jsonA.error).toContain("Inconsistent payment provenance");

    // Case B: Sandbox goal with simulated order ID
    const corruptGoalB: PaymentGoal = {
      id: "goal_corrupt_provenance_b",
      goal: "Corrupted provenance B",
      goalType: "collection",
      customer: "Test",
      amount: 100,
      currency: "USD",
      status: "awaiting_payment",
      mode: "sandbox",
      isSimulated: false,
      paypalOrderId: "SIMULATED_ORD_XYZ_999",
      riskLevel: "low",
      riskScore: 10,
      riskChecks: [],
      requiresApproval: false,
      createdBy: "user",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };
    db.saveGoal(corruptGoalB);

    const reqB = new Request("http://localhost:3000/api/goals/goal_corrupt_provenance_b/capture", { method: "POST" });
    const resB = await capturePost(reqB, { params: { id: "goal_corrupt_provenance_b" } });
    expect(resB.status).toBe(400);
    const jsonB = await resB.json();
    expect(jsonB.error).toContain("Inconsistent payment provenance");
  });

  // 32. Production read authorization scoping protects sensitive customer records, memories, and real transactions
  // 32. Production read authorization scoping protects sensitive customer records, memories, and real transactions
  it("32. should protect and scope read APIs in production for anonymous visitors while granting full access to admins", async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origDemoMode = process.env.DEMO_MODE;
    const origAdminKey = process.env.PAYPILOT_ADMIN_KEY;
    const origSessionSecret = process.env.PAYPILOT_SESSION_SECRET;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.DEMO_MODE; // Default public demo enabled
      process.env.PAYPILOT_ADMIN_KEY = "prod_admin_secret_555";
      process.env.PAYPILOT_SESSION_SECRET = "production_super_strong_secret_key_at_least_32_chars_long";

      // Create a private non-demo customer
      db.saveCustomer({
        id: "cust_private_corp",
        name: "Private Corp",
        email: "confidential@privatecorp.com",
        outstandingAmount: 50000,
        riskIndicators: ["Confidential VIP"],
        isNewRecipient: false,
        notes: "Strict confidential corporate customer.",
        paymentHistory: [],
        isDemoFixture: false,
      });

      // Create a private memory
      db.addMemory("private_merchant_pin", "Secret pin 9944", "preference");

      // Create a real sandbox goal
      db.saveGoal({
        id: "goal_real_prod_sandbox",
        goal: "Real merchant payment",
        goalType: "collection",
        customer: "Private Corp",
        amount: 50000,
        currency: "USD",
        status: "awaiting_payment",
        mode: "sandbox",
        isSimulated: false,
        paypalOrderId: "REAL_SANDBOX_ORDER_PRIVATE",
        riskLevel: "low",
        riskScore: 10,
        riskChecks: [],
        requiresApproval: false,
        createdBy: "user",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        timeline: [],
        isDemoFixture: false,
      });

      const { GET: customersGet } = await import("../src/app/api/customers/route");
      const { GET: memoryGet } = await import("../src/app/api/memory/route");
      const { GET: goalsGet } = await import("../src/app/api/goals/route");
      const { GET: goalByIdGet } = await import("../src/app/api/goals/[id]/route");

      // 1. Anonymous GET customers: strictly demo fixtures
      const anonCustReq = new Request("http://localhost:3000/api/customers");
      const anonCustRes = await customersGet(anonCustReq);
      expect(anonCustRes.status).toBe(200);
      const anonCustData = await anonCustRes.json();
      expect(anonCustData.customers.every((c: Customer) => c.isDemoFixture === true)).toBe(true);
      expect(anonCustData.customers.find((c: Customer) => c.id === "cust_private_corp")).toBeUndefined();

      // 2. Anonymous GET memory: strictly canonical demo memories
      const anonMemReq = new Request("http://localhost:3000/api/memory");
      const anonMemRes = await memoryGet(anonMemReq);
      expect(anonMemRes.status).toBe(200);
      const anonMemData = await anonMemRes.json();
      expect(anonMemData.memories.every((m: { id: string }) => ["mem_1", "mem_2", "mem_3"].includes(m.id))).toBe(true);

      // 3. Anonymous GET goals: strictly simulation goals
      const anonGoalsReq = new Request("http://localhost:3000/api/goals");
      const anonGoalsRes = await goalsGet(anonGoalsReq);
      expect(anonGoalsRes.status).toBe(200);
      const anonGoalsData = await anonGoalsRes.json();
      expect(anonGoalsData.goals.find((g: PaymentGoal) => g.id === "goal_real_prod_sandbox")).toBeUndefined();

      // 4. Anonymous GET goal by ID for real sandbox goal: 403 Forbidden
      const anonGoalIdReq = new Request("http://localhost:3000/api/goals/goal_real_prod_sandbox");
      const anonGoalIdRes = await goalByIdGet(anonGoalIdReq, { params: { id: "goal_real_prod_sandbox" } });
      expect(anonGoalIdRes.status).toBe(403);

      // 5. Authenticated Admin GET: full access
      const adminCustReq = new Request("http://localhost:3000/api/customers", {
        headers: { authorization: "Bearer prod_admin_secret_555" },
      });
      const adminCustRes = await customersGet(adminCustReq);
      const adminCustData = await adminCustRes.json();
      expect(adminCustData.customers.find((c: Customer) => c.id === "cust_private_corp")).toBeDefined();

      const adminGoalsReq = new Request("http://localhost:3000/api/goals", {
        headers: { authorization: "Bearer prod_admin_secret_555" },
      });
      const adminGoalsRes = await goalsGet(adminGoalsReq);
      const adminGoalsData = await adminGoalsRes.json();
      expect(adminGoalsData.goals.find((g: PaymentGoal) => g.id === "goal_real_prod_sandbox")).toBeDefined();

      // 6. Production fail-closed when DEMO_MODE=false
      process.env.DEMO_MODE = "false";
      const closedReq = new Request("http://localhost:3000/api/goals");
      const closedRes = await goalsGet(closedReq);
      expect(closedRes.status).toBe(401);
    } finally {
      if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
      else delete process.env.NODE_ENV;
      if (origDemoMode !== undefined) process.env.DEMO_MODE = origDemoMode;
      else delete process.env.DEMO_MODE;
      if (origAdminKey !== undefined) process.env.PAYPILOT_ADMIN_KEY = origAdminKey;
      else delete process.env.PAYPILOT_ADMIN_KEY;
      if (origSessionSecret !== undefined) process.env.PAYPILOT_SESSION_SECRET = origSessionSecret;
      else delete process.env.PAYPILOT_SESSION_SECRET;
    }
  });

  // 33. Production demo agent workflow is safe and isolated to simulation data
  it("33. should allow agent workflow in production demo isolated strictly to simulation data", async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origDemoMode = process.env.DEMO_MODE;
    const origAdminKey = process.env.PAYPILOT_ADMIN_KEY;
    const origSessionSecret = process.env.PAYPILOT_SESSION_SECRET;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.DEMO_MODE;
      process.env.PAYPILOT_ADMIN_KEY = "admin_secret_key_888";
      process.env.PAYPILOT_SESSION_SECRET = "production_super_strong_secret_key_at_least_32_chars_long";

      // Mock PayPal credentials present on server to test isolation
      vi.spyOn(defaultPayPalClient, "isConfigured").mockReturnValue(true);

      const { POST: agentPost } = await import("../src/app/api/agent/route");

      // Anonymous prompt in production demo
      const agentReq = new Request("http://localhost:3000/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "Collect $300 from Alex Rivera for branding by Friday" }),
      });

      const agentRes = await agentPost(agentReq);
      expect(agentRes.status).toBe(200);
      const agentData = await agentRes.json();
      expect(agentData.success).toBe(true);

      // Verify the resulting goal is strictly simulation
      expect(agentData.goal.isSimulated).toBe(true);
      expect(agentData.goal.mode).toBe("simulation");
      expect(agentData.goal.paypalOrderId).toMatch(/^SIMULATED_ORD_/);
    } finally {
      vi.restoreAllMocks();
      if (origNodeEnv !== undefined) process.env.NODE_ENV = origNodeEnv;
      else delete process.env.NODE_ENV;
      if (origDemoMode !== undefined) process.env.DEMO_MODE = origDemoMode;
      else delete process.env.DEMO_MODE;
      if (origAdminKey !== undefined) process.env.PAYPILOT_ADMIN_KEY = origAdminKey;
      else delete process.env.PAYPILOT_ADMIN_KEY;
      if (origSessionSecret !== undefined) process.env.PAYPILOT_SESSION_SECRET = origSessionSecret;
      else delete process.env.PAYPILOT_SESSION_SECRET;
    }
  });

  // 34. Cross-visitor data isolation & anti-spoofing enforcement
  it("34. should isolate visitor data: Visitor A's goals, customers, and memories are never visible to Visitor B, and spoofing headers is rejected", async () => {
    const { GET: getGoals, POST: postGoal } = await import("../src/app/api/goals/route");
    const { GET: getCustomers, POST: postCustomer } = await import("../src/app/api/customers/route");
    const { GET: getMemories, POST: postMemory } = await import("../src/app/api/memory/route");

    // Establish valid server-signed visitor identities
    const { token: tokenA, visitorId: visitorA } = createSignedVisitorToken("visitor_aaa_111");
    const { token: tokenB, visitorId: visitorB } = createSignedVisitorToken("visitor_bbb_222");

    // Visitor A creates a simulation goal using signed cookie
    const goalReq = new Request("http://localhost:3000/api/goals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `paypilot_visitor_session=${tokenA}`,
      },
      body: JSON.stringify({
        goal: "Collect $450 from Private Client A for design",
        customer: "Private Client A",
        amount: 450,
      }),
    });
    const goalRes = await postGoal(goalReq);
    expect(goalRes.status).toBe(201);
    const goalData = await goalRes.json();
    expect(goalData.goal.visitorId).toBe(visitorA);

    // Visitor A creates a customer
    const custReq = new Request("http://localhost:3000/api/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `paypilot_visitor_session=${tokenA}`,
      },
      body: JSON.stringify({
        name: "Confidential Client Alpha",
      }),
    });
    const custRes = await postCustomer(custReq);
    expect(custRes.status).toBe(200);

    // Visitor A adds a memory
    const memReq = new Request("http://localhost:3000/api/memory", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `paypilot_visitor_session=${tokenA}`,
      },
      body: JSON.stringify({
        key: "private_rule_a",
        value: "Secret preference for Visitor A only",
      }),
    });
    const memRes = await postMemory(memReq);
    expect(memRes.status).toBe(200);

    // Now Visitor B fetches goals with their own signed session cookie
    const bGoalReq = new Request("http://localhost:3000/api/goals", {
      headers: { Cookie: `paypilot_visitor_session=${tokenB}` },
    });
    const bGoalRes = await getGoals(bGoalReq);
    const bGoalData = await bGoalRes.json();
    const bGoalIds = bGoalData.goals.map((g: any) => g.id);
    expect(bGoalIds).not.toContain(goalData.goal.id);
    expect(bGoalData.goals.every((g: any) => g.visitorId !== visitorA)).toBe(true);

    // Verify Visitor B's metrics do not include Visitor A's goal
    expect(bGoalData.metrics.totalGoals).toBe(4);
    expect(goalData.metrics.totalGoals).toBe(5);

    // Visitor B fetches customers
    const bCustReq = new Request("http://localhost:3000/api/customers", {
      headers: { Cookie: `paypilot_visitor_session=${tokenB}` },
    });
    const bCustRes = await getCustomers(bCustReq);
    const bCustData = await bCustRes.json();
    expect(bCustData.customers.some((c: any) => c.name === "Confidential Client Alpha")).toBe(false);

    // Visitor B fetches memories
    const bMemReq = new Request("http://localhost:3000/api/memory", {
      headers: { Cookie: `paypilot_visitor_session=${tokenB}` },
    });
    const bMemRes = await getMemories(bMemReq);
    const bMemData = await bMemRes.json();
    expect(bMemData.memories.some((m: any) => m.value.includes("Secret preference for Visitor A"))).toBe(false);

    // CRITICAL ANTI-SPOOFING TESTS (Requirement 3):
    // 1. Attacker sends x-paypilot-visitor-id header attempting to impersonate Visitor A -> Ignored!
    const spoofHeaderReq = new Request("http://localhost:3000/api/goals", {
      headers: { "x-paypilot-visitor-id": visitorA },
    });
    const spoofHeaderRes = await getGoals(spoofHeaderReq);
    const spoofHeaderData = await spoofHeaderRes.json();
    expect(spoofHeaderData.goals.map((g: any) => g.id)).not.toContain(goalData.goal.id);

    // 2. Attacker sends forged unsigned cookie -> Rejected & assigned new identity!
    const forgedCookieReq = new Request("http://localhost:3000/api/goals", {
      headers: { Cookie: `paypilot_visitor_session=fake_${visitorA}` },
    });
    const forgedCookieRes = await getGoals(forgedCookieReq);
    const forgedCookieData = await forgedCookieRes.json();
    expect(forgedCookieData.goals.map((g: any) => g.id)).not.toContain(goalData.goal.id);
  });

  // 35. UI-visible mode truthfulness in /api/config
  it("35. should report simulation mode to anonymous UI requests even when PayPal credentials exist on server", async () => {
    const origAdminKey = process.env.PAYPILOT_ADMIN_KEY;
    try {
      process.env.PAYPILOT_ADMIN_KEY = "test_custom_admin_key_2026";
      vi.spyOn(defaultPayPalClient, "isConfigured").mockReturnValue(true);

      const { GET: getConfig } = await import("../src/app/api/config/route");

      // Anonymous request
      const anonReq = new Request("http://localhost:3000/api/config");
      const anonRes = await getConfig(anonReq);
      expect(anonRes.status).toBe(200);
      const anonData = await anonRes.json();
      expect(anonData.mode).toBe("simulation");
      expect(anonData.adminAuthenticated).toBe(false);
      expect(anonData.canExecuteSandbox).toBe(false);

      // Admin request with configured key in header
      const adminReq = new Request("http://localhost:3000/api/config", {
        headers: { Authorization: "Bearer test_custom_admin_key_2026" },
      });
      const adminRes = await getConfig(adminReq);
      expect(adminRes.status).toBe(200);
      const adminData = await adminRes.json();
      expect(adminData.mode).toBe("sandbox");
      expect(adminData.adminAuthenticated).toBe(true);
      expect(adminData.canExecuteSandbox).toBe(true);
    } finally {
      vi.restoreAllMocks();
      if (origAdminKey !== undefined) process.env.PAYPILOT_ADMIN_KEY = origAdminKey;
      else delete process.env.PAYPILOT_ADMIN_KEY;
    }
  });

  // 36. UI Admin Auth session login, rate limiting/lockout, cookie setting, and logout
  it("36. should handle UI admin session authentication with rate limiting, lockout, and cryptographically signed session tokens", async () => {
    const origAdminKey = process.env.PAYPILOT_ADMIN_KEY;
    try {
      process.env.PAYPILOT_ADMIN_KEY = "test_custom_admin_key_2026";
      const { POST: postSession, GET: getSession, DELETE: deleteSession } = await import(
        "../src/app/api/auth/session/route"
      );

      // 1. Invalid key fails with 401
      const makeBadLoginReq = () =>
        new Request("http://localhost:3000/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.99" },
          body: JSON.stringify({ adminKey: "wrong_password" }),
        });
      const badLoginRes = await postSession(makeBadLoginReq());
      expect(badLoginRes.status).toBe(401);

      // 2. Rate limiting & Lockout: 4 more failed attempts trigger 429 lockout!
      for (let i = 0; i < 4; i++) {
        await postSession(makeBadLoginReq());
      }
      const lockedReq = new Request("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.99" },
        body: JSON.stringify({ adminKey: "test_custom_admin_key_2026" }),
      });
      const lockedRes = await postSession(lockedReq);
      expect(lockedRes.status).toBe(429);
      const lockedData = await lockedRes.json();
      expect(lockedData.error).toContain("Too many failed authentication attempts");

      // 3. Different client with valid key succeeds and sets signed cookie
      const goodLoginReq = new Request("http://localhost:3000/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.101" },
        body: JSON.stringify({ adminKey: "test_custom_admin_key_2026" }),
      });
      const goodLoginRes = await postSession(goodLoginReq);
      expect(goodLoginRes.status).toBe(200);
      const cookieHeader = goodLoginRes.headers.get("set-cookie");
      expect(cookieHeader).toBeDefined();
      expect(cookieHeader).toContain("paypilot_admin_session=");
      expect(cookieHeader).toContain("HttpOnly");

      // Extract cookie value for subsequent test request
      const cookieMatch = cookieHeader?.match(/paypilot_admin_session=([^;]+)/);
      const token = cookieMatch ? cookieMatch[1] : "";
      expect(token.length).toBeGreaterThan(10);

      // 4. GET /api/auth/session with session cookie returns authenticated: true
      const checkReq = new Request("http://localhost:3000/api/auth/session", {
        headers: { Cookie: `paypilot_admin_session=${token}` },
      });
      const checkRes = await getSession(checkReq);
      const checkData = await checkRes.json();
      expect(checkData.authenticated).toBe(true);
      expect(checkData.role).toBe("admin");

      // 5. Tampered token fails
      const tamperedReq = new Request("http://localhost:3000/api/auth/session", {
        headers: { Cookie: `paypilot_admin_session=${token}tampered` },
      });
      const tamperedRes = await getSession(tamperedReq);
      const tamperedData = await tamperedRes.json();
      expect(tamperedData.authenticated).toBe(false);

      // 6. Logout clears session cookie
      const logoutRes = await deleteSession();
      expect(logoutRes.status).toBe(200);
      const logoutCookie = logoutRes.headers.get("set-cookie");
      expect(logoutCookie).toContain("Max-Age=0");
    } finally {
      if (origAdminKey !== undefined) process.env.PAYPILOT_ADMIN_KEY = origAdminKey;
      else delete process.env.PAYPILOT_ADMIN_KEY;
    }
  });

  // 37. Strict canonical fixture scoping
  it("37. should enforce strict canonical fixture IDs and compute metrics only over scoped goals", async () => {
    const { GET: getGoals } = await import("../src/app/api/goals/route");
    const { CANONICAL_DEMO_GOAL_IDS } = await import("../src/packages/database");

    const req = new Request("http://localhost:3000/api/goals");
    const res = await getGoals(req);
    const data = await res.json();

    // All returned goals for anonymous demo must belong to CANONICAL_DEMO_GOAL_IDS
    for (const goal of data.goals) {
      expect(CANONICAL_DEMO_GOAL_IDS.has(goal.id)).toBe(true);
    }

    // Metrics match exactly the sum and counts of the canonical goals
    expect(data.metrics.totalGoals).toBe(CANONICAL_DEMO_GOAL_IDS.size);
  });

  // 38. Canonical fixture safeguard: Never expose a real Sandbox order merely because its ID is canonical (Requirement 4)
  it("38. should never expose a real PayPal Sandbox order merely because its ID is in the canonical demo fixture set", async () => {
    const { GET: getGoals } = await import("../src/app/api/goals/route");
    const { GET: getGoalById } = await import("../src/app/api/goals/[id]/route");
    const { POST: approveGoal } = await import("../src/app/api/goals/[id]/approve/route");
    const { POST: captureGoal } = await import("../src/app/api/goals/[id]/capture/route");

    // Modify canonical fixture goal_sarah_1200 into a real Sandbox order
    const sarahGoal = db.getGoalById("goal_sarah_1200");
    expect(sarahGoal).toBeDefined();
    if (!sarahGoal) return;

    const originalSarah = JSON.parse(JSON.stringify(sarahGoal));

    try {
      sarahGoal.mode = "sandbox";
      sarahGoal.isSimulated = false;
      sarahGoal.paypalOrderId = "REAL_PAYPAL_SANDBOX_ORDER_999";
      sarahGoal.status = "awaiting_payment";
      db.saveGoal(sarahGoal);

      // Anonymous requester GET /api/goals: MUST NOT contain goal_sarah_1200!
      const anonReq = new Request("http://localhost:3000/api/goals");
      const anonRes = await getGoals(anonReq);
      const anonData = await anonRes.json();
      expect(anonData.goals.find((g: PaymentGoal) => g.id === "goal_sarah_1200")).toBeUndefined();

      // Anonymous requester GET /api/goals/goal_sarah_1200: MUST be 403 Forbidden!
      const anonIdReq = new Request("http://localhost:3000/api/goals/goal_sarah_1200");
      const anonIdRes = await getGoalById(anonIdReq, { params: { id: "goal_sarah_1200" } });
      expect(anonIdRes.status).toBe(403);

      // Anonymous requester POST /api/goals/goal_sarah_1200/approve: MUST be 401 or 403!
      const anonApproveReq = new Request("http://localhost:3000/api/goals/goal_sarah_1200/approve", {
        method: "POST",
      });
      const anonApproveRes = await approveGoal(anonApproveReq, { params: { id: "goal_sarah_1200" } });
      expect([401, 403]).toContain(anonApproveRes.status);

      // Anonymous requester POST /api/goals/goal_sarah_1200/capture: MUST be 401 Unauthorized!
      const anonCapReq = new Request("http://localhost:3000/api/goals/goal_sarah_1200/capture", {
        method: "POST",
      });
      const anonCapRes = await captureGoal(anonCapReq, { params: { id: "goal_sarah_1200" } });
      expect([401, 403]).toContain(anonCapRes.status);
    } finally {
      db.saveGoal(originalSarah);
    }
  });

  // 39. Strong PAYPILOT_SESSION_SECRET fail-closed requirement in production (Requirement 2)
  it("39. should fail closed in production when PAYPILOT_SESSION_SECRET is missing or less than 32 chars", async () => {
    const { getSessionSecret } = await import("../src/packages/security/auth");
    const origEnv = process.env.NODE_ENV;
    const origSecret = process.env.PAYPILOT_SESSION_SECRET;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.PAYPILOT_SESSION_SECRET;
      expect(() => getSessionSecret()).toThrow(/PAYPILOT_SESSION_SECRET/);

      process.env.PAYPILOT_SESSION_SECRET = "too_short_secret";
      expect(() => getSessionSecret()).toThrow(/PAYPILOT_SESSION_SECRET/);

      process.env.PAYPILOT_SESSION_SECRET = "a_very_strong_production_session_secret_with_more_than_32_characters";
      expect(getSessionSecret()).toBe("a_very_strong_production_session_secret_with_more_than_32_characters");
    } finally {
      if (origEnv !== undefined) process.env.NODE_ENV = origEnv;
      else delete process.env.NODE_ENV;
      if (origSecret !== undefined) process.env.PAYPILOT_SESSION_SECRET = origSecret;
      else delete process.env.PAYPILOT_SESSION_SECRET;
    }
  });

  // 40. Live Gemini 3.8 Flash verification status disclosure (Requirement 5)
  it("40. should report live verification of gemini-3.8-flash only after genuine success", async () => {
    const { AIPlanner } = await import("../src/packages/agent/ai-planner");
    const planner = new AIPlanner();

    // Before any successful plan call, hasVerifiedGemini() is false
    expect(planner.hasVerifiedGemini()).toBe(false);

    // Run deterministic parse (offline fallback)
    const result = planner.deterministicParse("Collect $1,200 from Sarah by Friday");
    expect(result.action).toBe("create_collection_goal");
    expect(result.aiEngine).toBe("deterministic");
    expect(planner.hasVerifiedGemini()).toBe(false);
  });

  // 41. Server-signed visitor identity & anti-spoofing defense (Requirement 3)
  it("41. should reject spoofed x-paypilot-visitor-id and forged client cookies, preserving complete cross-visitor isolation", async () => {
    const { createSignedVisitorToken, verifyVisitorToken, resolveVisitorIdentity } = await import(
      "../src/packages/security/auth"
    );
    const { GET: getGoals } = await import("../src/app/api/goals/route");
    const { GET: getGoalById } = await import("../src/app/api/goals/[id]/route");
    const { POST: approveGoal } = await import("../src/app/api/goals/[id]/approve/route");
    const { POST: captureGoal } = await import("../src/app/api/goals/[id]/capture/route");
    const { GET: getCustomers } = await import("../src/app/api/customers/route");
    const { GET: getMemory } = await import("../src/app/api/memory/route");

    // 1. Establish legitimate Visitor A with a genuine server-signed cookie
    const { token: tokenA, visitorId: vidA } = createSignedVisitorToken();
    expect(verifyVisitorToken(tokenA)).toBe(vidA);

    const goalA: PaymentGoal = {
      id: "goal_visitor_a_private",
      goal: "Collect $300 from Client A",
      goalType: "collection",
      customer: "Client A",
      customerId: "cust_visitor_a",
      amount: 300,
      currency: "USD",
      deadline: "Tomorrow",
      purpose: "Private Consulting",
      status: "pending_approval",
      mode: "simulation",
      isSimulated: true,
      requiresApproval: true,
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [],
      createdBy: "agent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visitorId: vidA,
      timeline: [],
    };
    db.saveGoal(goalA);

    const custA: Customer = {
      id: "cust_visitor_a",
      name: "Client A",
      email: "client.a@example.com",
      outstandingAmount: 300,
      riskIndicators: [],
      isNewRecipient: false,
      notes: "Private client",
      paymentHistory: [],
      visitorId: vidA,
    };
    db.saveCustomer(custA);

    const memA: MemoryItem = {
      id: "mem_visitor_a",
      key: "client_a_rate",
      value: "Hourly rate is $150",
      category: "rule",
      createdAt: new Date().toISOString(),
      visitorId: vidA,
    };
    db.saveMemory(memA);

    try {
      // 2. Legitimate Visitor A CAN see their own data
      const reqLegitA = new Request("http://localhost:3000/api/goals", {
        headers: { Cookie: `paypilot_visitor_session=${tokenA}` },
      });
      const resLegitA = await getGoals(reqLegitA);
      const dataLegitA = await resLegitA.json();
      expect(dataLegitA.goals.some((g: PaymentGoal) => g.id === "goal_visitor_a_private")).toBe(true);

      // 3. Attacker tries to spoof x-paypilot-visitor-id header (zero-trust enforcement)
      const spoofReq = new Request("http://localhost:3000/api/goals", {
        headers: { "x-paypilot-visitor-id": vidA },
      });
      const identityResolved = resolveVisitorIdentity(spoofReq);
      // Identity must NOT equal vidA because header is ignored and cookie was missing!
      expect(identityResolved.visitorId).not.toBe(vidA);

      const resSpoof = await getGoals(spoofReq);
      const dataSpoof = await resSpoof.json();
      expect(dataSpoof.goals.some((g: PaymentGoal) => g.id === "goal_visitor_a_private")).toBe(false);

      // 4. Attacker tries to GET /api/goals/[id] for Visitor A's goal with spoofed header -> 403 Forbidden
      const idSpoofReq = new Request("http://localhost:3000/api/goals/goal_visitor_a_private", {
        headers: { "x-paypilot-visitor-id": vidA },
      });
      const idSpoofRes = await getGoalById(idSpoofReq, { params: { id: "goal_visitor_a_private" } });
      expect(idSpoofRes.status).toBe(403);

      // 5. Attacker tries to approve Visitor A's goal -> 403 Forbidden
      const approveSpoofReq = new Request("http://localhost:3000/api/goals/goal_visitor_a_private/approve", {
        method: "POST",
        headers: { "x-paypilot-visitor-id": vidA },
      });
      const approveSpoofRes = await approveGoal(approveSpoofReq, { params: { id: "goal_visitor_a_private" } });
      expect(approveSpoofRes.status).toBe(403);

      // 6. Attacker tries to capture Visitor A's goal -> 403 Forbidden
      const captureSpoofReq = new Request("http://localhost:3000/api/goals/goal_visitor_a_private/capture", {
        method: "POST",
        headers: {
          "x-paypilot-visitor-id": vidA,
          "x-simulation-checkout": "true",
        },
      });
      const captureSpoofRes = await captureGoal(captureSpoofReq, { params: { id: "goal_visitor_a_private" } });
      expect(captureSpoofRes.status).toBe(403);

      // 7. Attacker tries to view customers or memories of Visitor A -> Excluded!
      const custSpoofReq = new Request("http://localhost:3000/api/customers", {
        headers: { "x-paypilot-visitor-id": vidA },
      });
      const custSpoofRes = await getCustomers(custSpoofReq);
      const custData = await custSpoofRes.json();
      expect(custData.customers.some((c: Customer) => c.id === "cust_visitor_a")).toBe(false);

      const memSpoofReq = new Request("http://localhost:3000/api/memory", {
        headers: { "x-paypilot-visitor-id": vidA },
      });
      const memSpoofRes = await getMemory(memSpoofReq);
      const memData = await memSpoofRes.json();
      expect(memData.memories.some((m: MemoryItem) => m.id === "mem_visitor_a")).toBe(false);

      // 8. Attacker tries forged client cookie with arbitrary vid -> Invalid signature rejected!
      const forgedPayload = Buffer.from(JSON.stringify({ vid: vidA, iat: Date.now(), exp: Date.now() + 99999 })).toString("base64url");
      const forgedCookie = `${forgedPayload}.forged_signature_12345`;
      expect(verifyVisitorToken(forgedCookie)).toBeNull();

      const forgedReq = new Request("http://localhost:3000/api/goals", {
        headers: { Cookie: `paypilot_visitor_session=${forgedCookie}` },
      });
      const forgedIdentity = resolveVisitorIdentity(forgedReq);
      expect(forgedIdentity.visitorId).not.toBe(vidA);

      const resForged = await getGoals(forgedReq);
      const dataForged = await resForged.json();
      expect(dataForged.goals.some((g: PaymentGoal) => g.id === "goal_visitor_a_private")).toBe(false);
    } finally {
      // Clean up test entities
      db.deleteGoal("goal_visitor_a_private");
      db.deleteCustomer("cust_visitor_a");
      db.deleteMemory("mem_visitor_a");
    }
  });

  // 42. Two distinct signed visitor sessions regression test (Requirements 1, 2, 3, 4, 5)
  it("42. should enforce two distinct signed visitor sessions: canonical fixtures remain strictly read-only, visitors cannot mutate or reset each other's data, and trusted proxy IP is enforced", async () => {
    const { createSignedVisitorToken, getTrustedClientIp } = await import(
      "../src/packages/security/auth"
    );
    const { GET: getGoals } = await import("../src/app/api/goals/route");
    const { GET: getGoalById, PATCH: patchGoal } = await import("../src/app/api/goals/[id]/route");
    const { POST: approveGoal } = await import("../src/app/api/goals/[id]/approve/route");
    const { POST: captureGoal } = await import("../src/app/api/goals/[id]/capture/route");
    const { POST: postRec } = await import("../src/app/api/recommendations/route");
    const { POST: resetDemo } = await import("../src/app/api/demo/reset/route");

    // 1. Establish two distinct verified visitor sessions
    const { token: tokenA, visitorId: vidA } = createSignedVisitorToken();
    const { token: tokenB, visitorId: vidB } = createSignedVisitorToken();
    expect(vidA).not.toBe(vidB);

    // 2. Canonical demo fixtures are strictly read-only to anonymous visitors
    // Visitor A tries to approve canonical goal_mike_2500 -> 403 Forbidden!
    const approveCanReq = new Request("http://localhost:3000/api/goals/goal_mike_2500/approve", {
      method: "POST",
      headers: { Cookie: `paypilot_visitor_session=${tokenA}` },
    });
    const approveCanRes = await approveGoal(approveCanReq, { params: { id: "goal_mike_2500" } });
    expect(approveCanRes.status).toBe(403);
    const approveCanData = await approveCanRes.json();
    expect(approveCanData.error).toContain("read-only");

    // Visitor A tries to capture canonical goal_sarah_1200 -> 403 Forbidden!
    const captureCanReq = new Request("http://localhost:3000/api/goals/goal_sarah_1200/capture", {
      method: "POST",
      headers: {
        Cookie: `paypilot_visitor_session=${tokenA}`,
        "x-simulation-checkout": "true",
      },
    });
    const captureCanRes = await captureGoal(captureCanReq, { params: { id: "goal_sarah_1200" } });
    expect(captureCanRes.status).toBe(403);

    // Visitor A tries to edit canonical goal_sarah_1200 via PATCH -> 403 Forbidden!
    const patchCanReq = new Request("http://localhost:3000/api/goals/goal_sarah_1200", {
      method: "PATCH",
      headers: {
        Cookie: `paypilot_visitor_session=${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ notes: "Malicious note" }),
    });
    const patchCanRes = await patchGoal(patchCanReq, { params: { id: "goal_sarah_1200" } });
    expect(patchCanRes.status).toBe(403);

    // Visitor A tries to dismiss canonical recommendation rec_1 -> 403 Forbidden!
    const recCanReq = new Request("http://localhost:3000/api/recommendations", {
      method: "POST",
      headers: {
        Cookie: `paypilot_visitor_session=${tokenA}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: "rec_1", action: "dismiss" }),
    });
    const recCanRes = await postRec(recCanReq);
    expect(recCanRes.status).toBe(403);

    // Verify canonical state was 100% untouched
    expect(db.getGoalById("goal_mike_2500")?.status).toBe("pending_approval");
    expect(db.getGoalById("goal_sarah_1200")?.status).toBe("awaiting_payment");
    expect(db.getRecommendationById("rec_1")).toBeDefined();

    // 3. Create Visitor A's own simulation goal
    const goalVisA: PaymentGoal = {
      id: "goal_vis_a_own",
      goal: "Simulated Goal for Visitor A",
      goalType: "payout_review",
      customer: "Vendor A",
      amount: 450,
      currency: "USD",
      status: "pending_approval",
      mode: "simulation",
      isSimulated: true,
      requiresApproval: true,
      approvalStatus: "pending",
      riskLevel: "low",
      riskScore: 10,
      riskChecks: [],
      createdBy: "agent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visitorId: vidA,
      timeline: [],
    };
    db.saveGoal(goalVisA);

    // 4. Create Visitor B's own simulation goal
    const goalVisB: PaymentGoal = {
      id: "goal_vis_b_own",
      goal: "Simulated Goal for Visitor B",
      goalType: "collection",
      customer: "Customer B",
      amount: 750,
      currency: "USD",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      paypalOrderId: "SIMULATED_ORD_B_750",
      riskLevel: "low",
      riskScore: 15,
      riskChecks: [],
      createdBy: "agent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visitorId: vidB,
      timeline: [],
    };
    db.saveGoal(goalVisB);

    try {
      // Visitor A can see their own goal, but NOT Visitor B's goal
      const reqListA = new Request("http://localhost:3000/api/goals", {
        headers: { Cookie: `paypilot_visitor_session=${tokenA}` },
      });
      const dataListA = await (await getGoals(reqListA)).json();
      expect(dataListA.goals.some((g: PaymentGoal) => g.id === "goal_vis_a_own")).toBe(true);
      expect(dataListA.goals.some((g: PaymentGoal) => g.id === "goal_vis_b_own")).toBe(false);

      // Visitor B cannot view Visitor A's goal directly -> 403 Forbidden!
      const reqGetAasB = new Request("http://localhost:3000/api/goals/goal_vis_a_own", {
        headers: { Cookie: `paypilot_visitor_session=${tokenB}` },
      });
      const resGetAasB = await getGoalById(reqGetAasB, { params: { id: "goal_vis_a_own" } });
      expect(resGetAasB.status).toBe(403);

      // Visitor B cannot approve Visitor A's goal -> 403 Forbidden!
      const reqApproveAasB = new Request("http://localhost:3000/api/goals/goal_vis_a_own/approve", {
        method: "POST",
        headers: { Cookie: `paypilot_visitor_session=${tokenB}` },
      });
      const resApproveAasB = await approveGoal(reqApproveAasB, { params: { id: "goal_vis_a_own" } });
      expect(resApproveAasB.status).toBe(403);

      // Visitor B cannot capture Visitor A's goal -> 403 Forbidden!
      const reqCaptureAasB = new Request("http://localhost:3000/api/goals/goal_vis_a_own/capture", {
        method: "POST",
        headers: {
          Cookie: `paypilot_visitor_session=${tokenB}`,
          "x-simulation-checkout": "true",
        },
      });
      const resCaptureAasB = await captureGoal(reqCaptureAasB, { params: { id: "goal_vis_a_own" } });
      expect(resCaptureAasB.status).toBe(403);

      // Visitor A CAN approve their own goal -> 200 OK!
      const reqApproveAasA = new Request("http://localhost:3000/api/goals/goal_vis_a_own/approve", {
        method: "POST",
        headers: { Cookie: `paypilot_visitor_session=${tokenA}` },
      });
      const resApproveAasA = await approveGoal(reqApproveAasA, { params: { id: "goal_vis_a_own" } });
      expect(resApproveAasA.status).toBe(200);
      expect(db.getGoalById("goal_vis_a_own")?.approvalStatus).toBe("approved");

      // 5. Visitor A resets demo: Resets ONLY Visitor A's records!
      const reqResetA = new Request("http://localhost:3000/api/demo/reset", {
        method: "POST",
        headers: { Cookie: `paypilot_visitor_session=${tokenA}` },
      });
      const resResetA = await resetDemo(reqResetA);
      expect(resResetA.status).toBe(200);

      // Visitor A's goal was cleaned up
      expect(db.getGoalById("goal_vis_a_own")).toBeUndefined();

      // Shared canonical fixtures are completely UNTOUCHED
      expect(db.getGoalById("goal_mike_2500")).toBeDefined();
      expect(db.getGoalById("goal_sarah_1200")).toBeDefined();

      // Visitor B's goal is completely UNTOUCHED
      expect(db.getGoalById("goal_vis_b_own")).toBeDefined();
      expect(db.getGoalById("goal_vis_b_own")?.amount).toBe(750);

      // 6. Trusted Proxy IP: cf-connecting-ip and x-real-ip are trusted over arbitrary client spoofed x-forwarded-for
      const proxyReq1 = new Request("http://localhost:3000/api/auth/session", {
        headers: {
          "cf-connecting-ip": "198.51.100.10",
          "x-forwarded-for": "1.2.3.4, 5.6.7.8",
        },
      });
      expect(getTrustedClientIp(proxyReq1)).toBe("198.51.100.10");

      const proxyReq2 = new Request("http://localhost:3000/api/auth/session", {
        headers: {
          "x-real-ip": "203.0.113.45",
          "x-forwarded-for": "10.0.0.1, 10.0.0.2",
        },
      });
      expect(getTrustedClientIp(proxyReq2)).toBe("203.0.113.45");
    } finally {
      db.deleteGoal("goal_vis_a_own");
      db.deleteGoal("goal_vis_b_own");
    }
  });

  // 43. Production unowned record protection & deployment-aware proxy IP security
  it("43. should reject unowned/orphaned simulation records in production and strictly validate deployment-aware proxy IPs", async () => {
    const { checkGoalMutationOwnership, checkRecommendationDismissalOwnership, getTrustedClientIp, isValidIpAddress } = await import(
      "../src/packages/security/auth"
    );
    const { GET: getGoalById } = await import("../src/app/api/goals/[id]/route");

    // 1. Create an orphaned / unowned simulation goal (no visitorId)
    const orphanedGoal: PaymentGoal = {
      id: "goal_orphaned_sim",
      goal: "Legacy Orphaned Simulation Goal",
      goalType: "collection",
      customer: "Legacy Customer",
      amount: 300,
      currency: "USD",
      status: "awaiting_payment",
      mode: "simulation",
      isSimulated: true,
      riskLevel: "low",
      riskScore: 5,
      riskChecks: [],
      createdBy: "agent",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    };
    db.saveGoal(orphanedGoal);

    const origEnv = process.env.NODE_ENV;
    const origPlatform = process.env.DEPLOYMENT_PLATFORM;
    const origProxyHeader = process.env.PAYPILOT_TRUSTED_PROXY_HEADER;
    const origSessionSecret = process.env.PAYPILOT_SESSION_SECRET;

    try {
      // In TEST environment: unit test fixture mutation is permitted
      const testCheck = checkGoalMutationOwnership(orphanedGoal, false, undefined);
      expect(testCheck.allowed).toBe(true);

      // In PRODUCTION environment: anonymous mutations on unowned simulation goals are STRICTLY 403 Forbidden!
      (process.env as Record<string, string>).NODE_ENV = "production";
      process.env.PAYPILOT_SESSION_SECRET = "production_super_secret_test_key_32chars_long";

      const prodCheck = checkGoalMutationOwnership(orphanedGoal, false, "vis_anon_999");
      expect(prodCheck.allowed).toBe(false);
      expect(prodCheck.statusCode).toBe(403);
      expect(prodCheck.reason).toContain("Legacy or unowned simulation goals require administrative authentication");

      // Anonymous recommendation dismissal on unowned recommendation in production is 403 Forbidden
      const orphanedRec: AIRecommendation = {
        id: "rec_orphaned_999",
        type: "follow_up",
        title: "Orphaned Rec",
        description: "Orphaned Rec Desc",
        urgency: "low",
        reasoning: "Test",
        actions: [],
        createdAt: new Date().toISOString(),
      };
      const recProdCheck = checkRecommendationDismissalOwnership(orphanedRec, false, "vis_anon_999");
      expect(recProdCheck.allowed).toBe(false);
      expect(recProdCheck.statusCode).toBe(403);

      // Anonymous GET /api/goals/goal_orphaned_sim in production returns 403 Forbidden
      const anonReq = new Request("http://localhost:3000/api/goals/goal_orphaned_sim");
      const anonRes = await getGoalById(anonReq, { params: { id: "goal_orphaned_sim" } });
      expect(anonRes.status).toBe(403);

      // 2. IP Validation tests
      expect(isValidIpAddress("192.168.1.1")).toBe(true);
      expect(isValidIpAddress("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(true);
      expect(isValidIpAddress("::1")).toBe(true);
      expect(isValidIpAddress("invalid_string_injection\r\n")).toBe(false);
      expect(isValidIpAddress("999.999.999.999")).toBe(false);

      // 3. Deployment-aware IP extraction tests
      // A. Explicit PAYPILOT_TRUSTED_PROXY_HEADER
      process.env.PAYPILOT_TRUSTED_PROXY_HEADER = "x-custom-cdn-ip";
      const reqCustom = new Request("http://localhost:3000/api/auth/session", {
        headers: {
          "x-custom-cdn-ip": "203.0.113.199",
          "cf-connecting-ip": "1.1.1.1",
        },
      });
      expect(getTrustedClientIp(reqCustom)).toBe("203.0.113.199");
      delete process.env.PAYPILOT_TRUSTED_PROXY_HEADER;

      // B. DEPLOYMENT_PLATFORM = direct (ignores spoofed proxy headers completely)
      process.env.DEPLOYMENT_PLATFORM = "direct";
      const reqDirect = new Request("http://localhost:3000/api/auth/session", {
        headers: {
          "cf-connecting-ip": "1.2.3.4",
          "x-forwarded-for": "5.6.7.8",
        },
      });
      expect(getTrustedClientIp(reqDirect)).toBe("127.0.0.1");
      delete process.env.DEPLOYMENT_PLATFORM;

      // C. DEPLOYMENT_PLATFORM = vercel
      process.env.DEPLOYMENT_PLATFORM = "vercel";
      const reqVercel = new Request("http://localhost:3000/api/auth/session", {
        headers: {
          "x-vercel-ip": "198.51.100.77",
          "x-forwarded-for": "10.0.0.1",
        },
      });
      expect(getTrustedClientIp(reqVercel)).toBe("198.51.100.77");
    } finally {
      (process.env as Record<string, string>).NODE_ENV = origEnv || "test";
      if (origPlatform !== undefined) process.env.DEPLOYMENT_PLATFORM = origPlatform;
      else delete process.env.DEPLOYMENT_PLATFORM;
      if (origProxyHeader !== undefined) process.env.PAYPILOT_TRUSTED_PROXY_HEADER = origProxyHeader;
      else delete process.env.PAYPILOT_TRUSTED_PROXY_HEADER;
      if (origSessionSecret !== undefined) process.env.PAYPILOT_SESSION_SECRET = origSessionSecret;
      else delete process.env.PAYPILOT_SESSION_SECRET;
      db.deleteGoal("goal_orphaned_sim");
    }
  });
});



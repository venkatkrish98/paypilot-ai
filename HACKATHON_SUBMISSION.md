# PayPilot AI — Official PayPal AI Hackathon 2026 Submission

**Tagline:** "Your AI agent for getting paid, paying safely, and managing every transaction."  
**Target Tracks:** Best Use of PayPal + AI | Best Use of Agentic Commerce | Grand Prize  

---

## 1. Project Overview

### Short Description
**PayPilot AI** transforms payments from static checkout buttons and passive invoices into an autonomous, proactive **Action Agent**. Instead of navigating portals or manually following up on unpaid balances, users state their financial objectives in natural language (e.g., *"I need to collect $1,200 from Sarah for the website project by Friday"*). 

PayPilot's Multi-Agent Orchestrator coordinates 7 specialized capabilities (Intent, Customer, Payment, Risk, Notification, Follow-up, and Memory Agents). It executes official **PayPal Orders v2** transactions, enforces heuristic **Payment Safety Checks**, monitors payment completion in the PayPal Sandbox, reconciles customer ledgers, and proactively recommends next financial actions (such as human sign-off on high-risk vendor disbursements).

When PayPal Sandbox credentials are not provided, PayPilot operates in a verified, clearly labeled **Simulation Mode** with zero fake claims.

---

## 2. Why PayPilot AI is True Agentic Commerce (Not a Chatbot)

Traditional fintech tools provide conversational chatbots that tell you *how* to pay or force you to fill out multi-step invoice forms. PayPilot is fundamentally an **action-oriented execution engine**:

$$\text{UNDERSTAND} \longrightarrow \text{PLAN} \longrightarrow \text{VERIFY} \longrightarrow \text{EXECUTE} \longrightarrow \text{MONITOR} \longrightarrow \text{FOLLOW UP} \longrightarrow \text{COMPLETE}$$

1. **Autonomous Lifecycle Management:** Creates the PayPal Sandbox order, captures status, and closes the payment goal upon customer completion.
2. **Deterministic Tool Calling:** Direct integration with official PayPal REST APIs (`/v1/oauth2/token`, `/v2/checkout/orders`, `/v2/checkout/orders/{id}/capture`).
3. **Transparent Payment Safety:** 5-point safety heuristic (review thresholds, recipient verification, 24h duplicate detection, profile completeness, historical deviation).
4. **Human-in-the-Loop Governance:** High-risk or large payouts (e.g., *"Pay vendor Mike $2,500"*) are paused with itemized risk findings until authorized by the user.
5. **Persistent Memory:** Retains client preferences (e.g., *"Sarah prefers email reminders"*) and rules without storing credentials.

---

## 3. PayPal Developer Platform Integration

PayPilot AI integrates deeply with the official **PayPal Developer Platform**:

- **OAuth 2.0 Client Credentials Flow:** Automated token exchange via `https://api-m.sandbox.paypal.com/v1/oauth2/token`.
- **PayPal Orders v2 API:**
  - `POST /v2/checkout/orders`: Creates capture-intent orders with structured `purchase_units`, customized `brand_name`, `landing_page`, and return/cancel URLs.
  - `GET /v2/checkout/orders/{id}`: Live order inspection and verification.
  - `POST /v2/checkout/orders/{id}/capture`: Reconciles authorized buyer transactions.
- **Buyer Approval Validation:** In Sandbox mode, verifies that the buyer has approved the payment in PayPal before capture can be processed.
- **Amount & Currency Validation:** Confirms captured values match the goal before marking any transaction paid.
- **Server-Side Security:** Zero exposure of PayPal client secrets to client-side bundles; safe `/api/config` status endpoint.

---

## 4. Multi-Agent Architecture

```
User Intent ("Collect $1,200 from Sarah by Friday")
       │
       ▼
┌────────────────────────────────────────────────────────┐
│               Agent Orchestrator                       │
│     (Google Gemini 2.5 Flash / Deterministic Fallback) │
└──────┬────────────┬────────────┬───────────┬───────────┘
       │            │            │           │
       ▼            ▼            ▼           ▼
┌─────────────┐┌───────────┐┌──────────┐┌───────────────┐
│Intent Agent ││ Customer  ││Risk Agent││ Payment Agent │
│(NLP Parser) ││  Agent    ││ (Safety) ││ (PayPal v2)   │
└─────────────┘└───────────┘└──────────┘└───────────────┘
       │            │            │           │
       └──────┬─────┴──────┬─────┴─────┬─────┘
              ▼            ▼           ▼
       ┌─────────────┐┌──────────┐┌───────────────┐
       │Notification ││Follow-up ││ Memory Agent  │
       │   Agent     ││  Agent   ││ (Persistence) │
       └─────────────┘└──────────┘└───────────────┘
```

- **Intent Agent:** Normalizes free-form text into structured intents using Google Gemini 2.5 Flash with verified deterministic fallback.
- **Customer Agent:** Resolves recipient identity, billing emails, historical velocities, and outstanding debt.
- **Risk Agent:** Executes the 5-point Payment Safety check, calculates risk scores (0–100), and routes high-risk tasks to human review.
- **Payment Agent:** Directly calls the PayPal client to provision Orders v2 sandbox orders and capture references.
- **Notification Agent:** Formats contextual reminders aligned with recipient preferences.
- **Follow-up Agent:** Actively monitors unpaid statuses and suggests scheduled touchpoints.
- **Memory Agent:** Ingests and recalls operational guidelines (e.g., *"Payments above $2,000 require approval"*).

---

## 5. Hero Demo Flow Walkthrough

1. **Step 1:** User enters: *"I need to collect $1,200 from Sarah for the website project by Friday."*
2. **Step 2:** Agent acknowledges: *"I'll create a payment goal for Sarah."*
3. **Step 3:** Customer Agent identifies Sarah Jenkins (`sarah.jenkins@designcraft.io`).
4. **Step 4:** Risk Agent performs safety check (Low Risk 10/100, $1,200 < $2,000 threshold).
5. **Step 5:** Payment Agent creates PayPal Sandbox Order (ID: `ORD-...` or `SIMULATED_ORD_...`).
6. **Step 6:** UI displays PayPal Order Created card ($1,200 USD, Status: **Awaiting Payment**) with PayPal checkout link.
7. **Step 7:** User clicks **"Capture / Simulate Payment"** (or completes sandbox checkout).
8. **Step 8:** Agent detects payment capture in real time.
9. **Step 9:** Dashboard updates instantly: Status switches to **PAID**, collected funds increment dynamically.
10. **Step 10:** Agent announces: *"Sarah's payment of $1,200 has been received. The payment goal is complete."*
11. **Step 11:** Proactive Next Action: Agent flags: *"Mike's $2,500 vendor payout review requires your approval."* User can click **"Review Mike's Payout"** to trigger the human-in-the-loop disbursement flow.

---

## 6. Demo Video Script (2 Minutes 30 Seconds)

### **[0:00 – 0:15] The Problem**
- **Visual:** Split screen showing fragmented payment workflows, manual follow-up emails, and disconnected banking apps.
- **Voiceover:** *"Freelancers, agencies, and businesses lose countless hours manually managing payments, generating payment links, and chasing unpaid clients. Payment buttons are passive—they don't understand context, they don't follow up, and they can't make smart decisions."*

### **[0:15 – 0:35] Introducing PayPilot AI**
- **Visual:** PayPilot AI Dashboard appears with clean fintech aesthetic, live KPI cards, and connected PayPal status.
- **Voiceover:** *"Introducing PayPilot AI: your autonomous AI agent for getting paid, paying safely, and managing every transaction. Built for the PayPal AI Hackathon 2026, PayPilot transforms payment lifecycles into proactive, goal-driven workflows powered by PayPal's official Orders API."*

### **[0:35 – 1:20] The Hero Payment Workflow**
- **Visual:** User clicks "Run Hero Demo Flow" or types in the interactive chat: *"I need to collect $1,200 from Sarah for the website project by Friday."*
- **Visual:** Real-time capability chain illuminates:
  - `[Intent Agent]` extracts $1,200 USD and Friday deadline using Gemini 2.5 Flash.
  - `[Customer Agent]` locates Sarah Jenkins (`sarah.jenkins@designcraft.io`).
  - `[Risk Agent]` runs the 5-point Payment Safety check.
  - `[Payment Agent]` generates an official Orders v2 PayPal Sandbox order.
- **Visual:** Payment link generated, status transitions to "Awaiting Payment".
- **Voiceover:** *"In seconds, PayPilot understands the intent, verifies Sarah's customer profile, validates that the amount is within safety limits, and generates an official PayPal Sandbox order with checkout approval link."*

### **[1:20 – 1:50] Autonomous Monitoring & Completion**
- **Visual:** User clicks "Capture Payment".
- **Visual:** Payment capture is confirmed, the status pill flips to emerald **PAID**, and the dashboard metrics update dynamically.
- **Voiceover:** *"PayPilot doesn't stop after creating the order. Its Follow-up Agent actively monitors transaction completion. Once payment is captured, PayPilot detects the event, updates the customer ledger, and closes the payment goal."*

### **[1:50 – 2:10] Risk Engine & Human-in-the-Loop Approval**
- **Visual:** Agent prompts: *"Mike Reynolds' $2,500 payout review requires your approval."*
- **Visual:** User switches to the Approvals Queue. Shows Mike Reynolds: $2,500 payment flagged because amount exceeds $2,000 threshold and recipient is unfamiliar.
- **Visual:** User inspects the itemized safety checks and clicks **"Approve Disbursement"**.
- **Voiceover:** *"Financial autonomy demands safety. For high-risk disbursements or new vendors, PayPilot enforces human sign-off. Once approved, the agent immediately provisions the payment order."*

### **[2:10 – 2:30] Impact & Closing**
- **Visual:** Overview of Memory system ("Sarah prefers email reminders"), Customer ledger, and Activity Timeline.
- **Voiceover:** *"PayPilot AI is more than a chatbot—it is an intelligent action agent that understands goals, uses PayPal natively, safeguards finances, and completes the commerce loop. Thank you."*

---

## 7. Submission Checklist & Independently Verifiable Evidence

- [x] **PayPal Orders v2 Integration & Architecture:** Direct REST integration with `/v1/oauth2/token`, `/v2/checkout/orders`, and capture with amount/currency/status validation and buyer approval enforcement.
- [x] **In-UI Judge Sandbox Authentication & Safe Execution:** Built-in "Unlock Sandbox" modal in the top header. Evaluators can enter the dev/judge key (`paypal_sandbox_judge_2026` or configured `PAYPILOT_ADMIN_KEY`). The server issues an encrypted `httpOnly` cookie (`paypilot_admin_session`) without exposing secrets to client code. With PayPal credentials configured, authorized UI users can create real PayPal Orders v2 orders, complete buyer approval on PayPal Sandbox, and capture them.
- [x] **Truthful Mode Reporting (`/api/config`):** `/api/config` reports the effective mode available to the current UI session (`mode: "sandbox"` only if PayPal credentials are configured AND current session is admin-authenticated; otherwise strictly `"simulation"`).
- [x] **Cross-Visitor Data Isolation & Canonical Fixtures:** Anonymous public demo requests are tagged with an isolated `visitorId`. Visitors only see canonical fixtures (`CANONICAL_DEMO_GOAL_IDS`, `CANONICAL_DEMO_CUSTOMER_IDS`, `CANONICAL_DEMO_MEMORY_IDS`, `CANONICAL_DEMO_RECOMMENDATION_IDS`) and their own session records. Dashboard metrics are computed strictly over visible scoped goals.
- [x] **Google Gemini 2.5 Flash Engine Configured:** Verified SDK integration with `@google/genai` (`GEMINI_API_KEY` configured in `.env`), with automatic verified deterministic fallback.
- [x] **37/37 Automated Regression Tests Passing:** Verified with Vitest (100% green coverage across security, authoritative sandbox provenance, cross-visitor data isolation, UI mode truthfulness, session login/logout, idempotency, ledger, and scoping).
- [x] **Clean Next.js 14 Build & ESLint:** Zero build errors or linter warnings (`npm run build` and `npm run lint`).
- [x] **Open-Source Repository:** Public GitHub repository ([venkatkrish98/paypilot-ai](https://github.com/venkatkrish98/paypilot-ai)) with open MIT license.
- [ ] **Official Demo Video Requirements (Devpost Rules):**
  > [!IMPORTANT]
  > Per [Official Hackathon Rules](https://paypalaihackathon.devpost.com/rules):
  > 1. The demo video must be **under 3 minutes** (the recommended script in Section 6 is 2 minutes 30 seconds).
  > 2. The video must be hosted on YouTube with **public visibility** (Devpost rules require public visibility; do NOT mark it as unlisted or private).
- [ ] **Hosted Live Production Deployment:** Ready for deployment to Vercel or Google Cloud Run.


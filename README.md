# PayPilot AI

> **"Your AI agent for getting paid, paying safely, and managing every transaction."**  
> *Built exclusively for the **PayPal AI Hackathon 2026**.*

[![PayPal Developer Platform](https://img.shields.io/badge/PayPal-Sandbox%20Orders%20v2-0070BA?logo=paypal&logoColor=white)](https://developer.paypal.com)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2%20App%20Router-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38BDF8?logo=tailwind-css)](https://tailwindcss.com)
[![Tests Passing](https://img.shields.io/badge/Tests-37%2F37%20Passing-brightgreen?logo=vitest)](https://vitest.dev)
[![ESLint Passing](https://img.shields.io/badge/ESLint-Clean-brightgreen?logo=eslint)](https://eslint.org)

---

## Table of Contents
1. [Problem](#problem)
2. [Solution](#solution)
3. [Truthful Demo Modes: Sandbox vs. Simulation](#truthful-demo-modes-sandbox-vs-simulation)
4. [Agentic Commerce vs. Chatbots](#agentic-commerce-vs-chatbots)
5. [Real AI Intent & Planning Engine](#real-ai-intent--planning-engine)
6. [PayPal Integration Architecture](#paypal-integration-architecture)
7. [Payment Safety Engine (Risk Checks)](#payment-safety-engine-risk-checks)
8. [Hero Demo Flow Walkthrough](#hero-demo-flow-walkthrough)
9. [UI & UX Features](#ui--ux-features)
10. [Local Durable Persistence](#local-durable-persistence)
11. [Setup & Environment Variables](#setup--environment-variables)
12. [Running Locally](#running-locally)
13. [Testing Suite](#testing-suite)
14. [Current Limitations & Submission Evidence](#current-limitations--submission-evidence)

---

## Problem

Freelancers, agency founders, and e-commerce operators lose dozens of hours every month dealing with payment friction:
- **Passive Invoicing:** Traditional payment links and invoices are static. They don't understand client relationships, deadlines, or project contexts.
- **Manual Chasing:** Following up with unpaid clients is awkward, slow, and repetitive.
- **Disjointed Tools:** Users bounce between conversational assistants, banking apps, and payment platforms just to check if an order cleared.
- **Blind Execution Risks:** Automated payment scripts lack contextual safety checks, accidentally creating duplicate payments or paying unvetted recipients without oversight.

---

## Solution

**PayPilot AI** is an autonomous **Action Agent** for financial operations built on top of the **PayPal Developer Platform**. Instead of filling out forms or manually managing invoices, users simply express their payment intent in natural language:

> *"I need to collect $1,200 from Sarah for the website project by Friday."*  
> *"Has Sarah paid me recently?"*  
> *"Pay vendor Mike $2,500 for the cloud security review."*

PayPilot transforms these goals into structured execution plans, provisions live **PayPal Sandbox Orders v2**, conducts transparent **5-Point Payment Safety Checks**, monitors transactions in real time, and alerts users with intelligent next-step recommendations.

---

## Truthful Demo Modes: Sandbox vs. Simulation

PayPilot AI never fabricates transaction legitimacy. It supports two clearly distinguished operational modes:

| Feature | Live PayPal Sandbox Mode | Truthful Simulation Mode |
|---|---|---|
| **Trigger** | Valid `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env` | Unconfigured or placeholder credentials in `.env` |
| **API Target** | Real `https://api-m.sandbox.paypal.com` | Verified local deterministic engine |
| **Order ID Format** | Official PayPal alphanumeric IDs (e.g. `8X...`) | Explicitly prefixed IDs: `SIMULATED_ORD_...` |
| **Buyer Approval** | **Required:** Buyer must log in to PayPal Sandbox to approve before capture | Sandbox simulated preview link |
| **Capture ID** | Verified PayPal Capture Reference | Explicitly prefixed IDs: `SIMULATED_CAP_...` |
| **Status Badges** | `Sandbox Paid` | `Simulated Paid` |
| **Failure Handling** | Preserves state on PayPal failure; throws clear error | Deterministic simulation execution |

---

## Agentic Commerce vs. Chatbots

$$\text{UNDERSTAND} \longrightarrow \text{PLAN} \longrightarrow \text{VERIFY} \longrightarrow \text{EXECUTE} \longrightarrow \text{MONITOR} \longrightarrow \text{FOLLOW UP} \longrightarrow \text{COMPLETE}$$

Most AI fintech implementations are **conversational wrappers**—they summarize FAQs or advise you to visit PayPal. PayPilot is an **Action Agent**:
1. **Autonomous Lifecycle Management:** Creates the PayPal Sandbox order, monitors status, and closes the payment goal upon confirmed capture.
2. **Deterministic Tool Calling:** Direct integration with official PayPal REST APIs (`/v1/oauth2/token`, `/v2/checkout/orders`, `/v2/checkout/orders/{id}/capture`).
3. **Transparent Payment Safety:** 5-point heuristic safety engine (review thresholds, recipient verification, 24h duplicate detection, profile completeness, historical deviation).
4. **Human-in-the-Loop Governance:** High-risk or large payouts (e.g., *"Pay vendor Mike $2,500"*) are paused with itemized risk findings until authorized by the user.
5. **Persistent Memory:** Retains client preferences (e.g., *"Sarah prefers email reminders"*) without storing secrets.

---

## Real AI Intent & Planning Engine

PayPilot AI integrates **Google Gemini 3.8 Flash** via `@google/genai` for structured intent extraction:
- **Bounded Inputs:** Queries are bounded to 500 characters and sanitized.
- **Strict JSON Schema:** Emits structured parameters: `action`, `amount`, `currency`, `customerName`, `deadline`, `purpose`.
- **Verified Deterministic Fallback:** When `GEMINI_API_KEY` is not present or network fails, PayPilot falls back to its deterministic rule-based NLP parser.
- **Safety Boundary:** AI planning only drafts parameters; deterministic safety engines and human approval strictly govern all execution. The AI never directly authorizes funds.

---

## PayPal Integration Architecture

PayPilot AI interacts directly with the **PayPal Developer Platform**:

- **OAuth 2.0 Client Credentials Authentication:**  
  `POST https://api-m.sandbox.paypal.com/v1/oauth2/token`
- **Orders v2 Order Creation:**  
  `POST https://api-m.sandbox.paypal.com/v2/checkout/orders`
- **Orders v2 Order Capture:**  
  `POST https://api-m.sandbox.paypal.com/v2/checkout/orders/{id}/capture`
- **Buyer Approval Validation:**  
  In Sandbox mode, the app verifies that `order.status === "APPROVED"` before executing capture. If the buyer has not approved, it preserves previous state and returns an actionable notice.
- **Amount & Currency Verification:**  
  Confirms captured amount and currency match expected values before marking any goal paid.

---

## Payment Safety Engine (Risk Checks)

PayPilot's Risk Engine enforces transparent, heuristic safety boundaries:

1. **Threshold Review Check:** Flags amounts exceeding the configured limit ($2,000 default).
2. **Recipient Verification Check:** Flags new or unfamiliar recipients with no prior transaction history.
3. **Duplicate Payment Detection:** Scans for identical amounts to the same recipient in a 24-hour window.
4. **Customer Profile Completeness:** Checks for verified email dispatch destinations.
5. **Historical Velocity Variance:** Flags amounts exceeding 3x the customer's average prior payment.

---

## Hero Demo Flow Walkthrough

1. **User Request:** *"I need to collect $1,200 from Sarah for the website project by Friday."*
2. **Understanding:** Intent Agent extracts $1,200 USD and Friday deadline.
3. **Identification:** Customer Agent locates Sarah Jenkins (`sarah.jenkins@designcraft.io`).
4. **Safety Check:** Risk Agent executes checks: Low Risk (10/100).
5. **Order Creation:** Payment Agent initializes PayPal Sandbox Order (`ORD-...` or `SIMULATED_ORD_...`).
6. **Live Link:** Status updates to **Awaiting Payment** with PayPal checkout URL.
7. **Simulation / Capture:** Customer payment is approved & captured in Sandbox or Simulation.
8. **Detection:** Follow-up Agent detects capture and updates status to **PAID**.
9. **Ledger Update:** Sarah's outstanding balance clears and transaction is added to history.
10. **Reconciliation:** Agent confirms completion: *"Sarah's payment of $1,200 has been received."*
11. **Next Action Recommendation:** Agent proactively alerts: *"Mike's $2,500 vendor disbursement review requires your approval."*

---

## UI & UX Features

- **Direct Dashboard Chat:** Interactive AI agent conversation directly on the main dashboard, sharing full state with the dedicated AI Command Center.
- **User-Controlled Theme Toggle:** Light and dark theme switch with `localStorage` persistence and high-contrast styling.
- **Accessible Design:** Semantic dialog roles (`role="dialog"`, `aria-modal="true"`), focus management, Escape key handling, visible focus indicators, and `aria-live` status announcements.
- **Responsive Layout:** Mobile navigation drawer with backdrop that never covers active content on mobile, tablet, or desktop.

---

## Local Durable Persistence

All goals, customer ledgers, and memories are written to **local durable JSON file storage** (`data/paypilot_db.json`). State survives server restarts and demo reset only resets demo data.

---

## Setup & Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Configure your environment variables:

```ini
# PayPal Sandbox Credentials (Leave empty or placeholder for verified Simulation Mode)
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id_here
PAYPAL_CLIENT_SECRET=your_paypal_sandbox_client_secret_here
PAYPAL_ENVIRONMENT=sandbox

# Optional Gemini API Key (Uses deterministic fallback if omitted)
GEMINI_API_KEY=your_gemini_api_key_here

# Payment Safety Threshold
PAYPILOT_REVIEW_THRESHOLD=2000

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
ALLOW_DEMO_RESET=true
```

---

## Running Locally

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing Suite

Run the automated test suite:

```bash
npm test
```

### Covered Test Cases (33/33 Passing):
1. `Create payment goal` — Parameter verification and storage.
2. `Customer lookup` — Profile resolution and payment history retrieval.
3. `Truthful Simulation labeling` — Orders marked `SIMULATED_ORD_...` with in-app simulation checkout preview.
4. `Live Production Blocked` — Strictly enforces PayPal Sandbox safety and rejects live production credentials.
5. `Capture validation` — Confirms amount and currency match expected values in simulation.
6. `Unapproved Order Rejection` — Confirms PayPal Sandbox capture requires buyer approval before capture.
7. `Amount mismatch rejection` — Rejection of invalid capture amounts returned by PayPal.
8. `Currency mismatch rejection` — Rejection of mismatched currencies returned by PayPal.
9. `Non-completed capture rejection` — Rejection of non-completed captures (e.g. `PENDING`, `FAILED`).
10. `Duplicate payment prevention` — 24-hour duplicate detection.
11. `Risk detection` — Threshold and new recipient flags.
12. `Payout vs Collection separation` — Distinguishes payout governance from inbound Orders checkout.
13. `Dynamic relative Friday dates` — Relative dates calculated dynamically without stale hardcoded values.
14. `Customer ledger balance consistency` — Idempotent reconciliation of customer balances upon capture.
15. `Safe Demo Reset` — Restores 4 canonical fixtures without erasing non-demo user records.
16. `Persistence failure error surfacing` — Errors thrown and surfaced when disk snapshot writes fail.
17. `Approval bypass prevention` — Prevents skipping human review via direct status mutations.
18. `Pending approval capture rejection` — Rejects capture attempts on goals awaiting approval.
19. `Idempotent approvals` — Rejects duplicate approvals and protects against double-processing.
20. `Fail-closed write protection when demo disabled` — Denies mutations when `DEMO_MODE=false`.
21. `Fail-closed write protection in production` — Missing administrative credentials denied by default.
22. `Production admin key validation` — Allows authenticated mutations with valid admin API key.
23. `Session inspection truthfulness` — `GET /api/auth/session` inspects auth status without minting mutation tokens.
24. `Safe Demo Reset data preservation` — Preserves arbitrary non-demo memories, recommendations, goals, and customers.
25. `Payout review approval separation` — Safety sign-off recorded without reducing vendor balance or adding fake history.
26. `Simulation checkout contracts` — In-app `/checkout/simulation` links generated; no fabricated tokens sent to PayPal.
27. `API route handler protection` — Admin authorization verified at the route handler level in production.
28. `Simulation route sandbox isolation` — Rejects real Sandbox goals from `/checkout/simulation` route.
29. `Sandbox mutation access denied to anonymous` — Anonymous callers strictly forbidden from approving or capturing real Sandbox orders.
30. `Authoritative Sandbox transition on approval` — Real PayPal Sandbox order creation authoritatively updates goal and timeline mode to sandbox (`isSimulated: false`); rejects anonymous simulation checkout/capture; enforces buyer approval before capture.
31. `Inconsistent order provenance rejection` — Rejects mismatched combinations (real PayPal ID on simulated goal or simulated order ID on Sandbox goal).
32. `Production read API scoping` — Protects customer profiles, notes, payment history, memories, and real sandbox goals from unauthenticated public visitors in production.
33. `Production demo agent workflow isolation` — Anonymous agent prompts in public demo mode execute safely isolated strictly to simulation data without exposing admin keys.
34. `Cross-visitor data isolation` — Anonymous public demo users' goals, customers, and memories are tagged by `visitorId` and isolated; visitors only see canonical demo fixtures and their own session records; metrics never leak other visitors' transaction volumes.
35. `UI-visible mode truthfulness` — `/api/config` truthfully reports `mode: "simulation"` for anonymous visitors even when server credentials exist; reports `mode: "sandbox"` only for authenticated admin sessions.
36. `UI Admin Auth session login/logout` — Evaluators authenticate securely via `/api/auth/session` setting an encrypted `httpOnly` cookie; secrets are never leaked to client bundles; logout safely reverts to anonymous simulation.
37. `Canonical fixture scoping & metric integrity` — Enforces exact canonical ID sets (`CANONICAL_DEMO_GOAL_IDS`, etc.) for public demo; metrics are calculated strictly over scoped records.

---

## Current Architecture, Persistence Limits & Submission Evidence

- **Runtime Mode:** Operates out of the box in verified **Simulation Mode** (deterministic local engine, zero external network dependency). Switches automatically to **Live PayPal Sandbox** and **Live Google Gemini** once credentials and an authorized session are established.
- **In-UI Administrator Sandbox Authentication:** Evaluators can click "Unlock Sandbox" in the dashboard header, enter the explicitly configured administrator key (`PAYPILOT_ADMIN_KEY`), and execute live PayPal Sandbox Orders v2 directly from the browser UI without terminal commands. Failed attempts are rate-limited with lockout protection.
- **Cross-Visitor Data Isolation:** Public demo visitors only see canonical fixtures (`goal_sarah_1200`, `goal_john_850`, `goal_mike_2500`, `goal_acme_600`) and their own isolated inputs.
- **Sandbox Security & Order Provenance:** Real PayPal Sandbox goals can only be approved and captured through official PayPal buyer approval with administrative authorization. Validated order provenance prevents stale simulation flags from exposing Sandbox orders to anonymous capture.
- **Truthful Payout Review Ledger:** Payout review approval records internal safety sign-off only; vendor balances remain unchanged and no completed payment records are added without real PayPal Payouts execution.
- **Required Submission Evidence (Owner Checklist):**
  - [x] Public GitHub repository with open-source MIT license (`https://github.com/venkatkrish98/paypilot-ai`).
  - [x] Complete automated test suite (37/37 passing) and clean production build.
  - [x] Live Google Gemini 3.8 Flash API Key configured in `.env`.
  - [x] In-UI evaluator auth workflow for testing live PayPal Sandbox execution.
  - [ ] Public YouTube demo video (must be publicly visible on YouTube, under 3 minutes per [Devpost rules](https://paypalaihackathon.devpost.com/rules)).
  - [ ] Publicly hosted deployment URL (e.g. Vercel / Cloud Run).

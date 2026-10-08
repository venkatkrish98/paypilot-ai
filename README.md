# PayPilot AI

> **"Your AI agent for getting paid, paying safely, and managing every transaction."**  
> *Built exclusively for the **PayPal AI Hackathon 2026**.*

[![PayPal Developer Platform](https://img.shields.io/badge/PayPal-Sandbox%20Orders%20v2-0070BA?logo=paypal&logoColor=white)](https://developer.paypal.com)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.2%20App%20Router-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38BDF8?logo=tailwind-css)](https://tailwindcss.com)
[![Tests Passing](https://img.shields.io/badge/Tests-10%2F10%20Passing-brightgreen?logo=vitest)](https://vitest.dev)
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

PayPilot AI integrates **Google Gemini 2.5 Flash** via `@google/genai` for structured intent extraction:
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

### Covered Test Cases:
1. `Create payment goal` — Parameter verification and storage.
2. `Customer lookup` — Profile resolution and payment history retrieval.
3. `Truthful Simulation labeling` — Orders unmistakably marked `SIMULATED_ORD_...`.
4. `Capture validation` — Confirms amount and currency match expected values.
5. `Amount mismatch rejection` — Rejection of invalid capture amounts.
6. `Duplicate payment prevention` — 24-hour duplicate detection.
7. `Risk detection` — Threshold and new recipient flags.
8. `Approval workflow & idempotency` — State holding in `pending_approval` until human authorization.
9. `Payment status update` — Transition to `paid` with timeline progression.
10. `Hero E2E flow` — Complete lifecycle with explicit simulation tags when unconfigured.

---

## Current Limitations & Submission Evidence

- **Outbound Notifications:** Reminders are drafted by the Notification Agent and logged on the audit timeline. Delivery through external email providers (e.g. SendGrid/Resend) is mocked for safe local testing.
- **Vendor Disbursements vs. Buyer Collections:** PayPal Orders v2 processes incoming customer collections. Outbound payments to vendors (like Mike Reynolds) represent disbursement review goals held for administrative sign-off.
- **Required Submission Evidence:**
  - Public GitHub repository with open-source license.
  - 2.5-minute demo video script provided in `HACKATHON_SUBMISSION.md`.
  - PayPal Sandbox Developer credentials for live end-to-end buyer checkout verification.

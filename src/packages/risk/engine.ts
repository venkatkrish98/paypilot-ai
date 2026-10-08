// ==============================================================================
// PayPilot AI - Payment Safety Checks Engine (Risk Engine)
// Transparent heuristic evaluation for agentic payment workflows
// ==============================================================================

import { Customer, PaymentGoal, RiskCheckResult } from "../types";

export interface RiskEvaluationInput {
  amount: number;
  currency: string;
  customer?: Customer | null;
  customerName: string;
  existingGoals?: PaymentGoal[];
  customThreshold?: number;
  isPayout?: boolean;
}

export interface RiskEvaluationOutput {
  riskScore: number; // 0 - 100
  riskLevel: "low" | "medium" | "high";
  requiresApproval: boolean;
  checks: RiskCheckResult[];
  approvalReason?: string;
}

export class PaymentSafetyEngine {
  private defaultThreshold: number;

  constructor(defaultThreshold = 2000) {
    const envThreshold = process.env.PAYPILOT_REVIEW_THRESHOLD;
    this.defaultThreshold = envThreshold ? parseFloat(envThreshold) : defaultThreshold;
  }

  public evaluate(input: RiskEvaluationInput): RiskEvaluationOutput {
    const checks: RiskCheckResult[] = [];
    let riskScore = 0;
    const threshold = input.customThreshold || this.defaultThreshold;
    const { amount, customer, customerName, existingGoals = [], isPayout = false } = input;

    // 1. Amount Threshold Check
    if (amount > threshold) {
      riskScore += 35;
      checks.push({
        id: "check_high_amount",
        name: "Threshold Review Check",
        passed: false,
        severity: "warning",
        details: `Amount ($${amount.toLocaleString()}) exceeds standard review threshold of $${threshold.toLocaleString()}.`,
      });
    } else {
      checks.push({
        id: "check_high_amount",
        name: "Threshold Review Check",
        passed: true,
        severity: "info",
        details: `Amount ($${amount.toLocaleString()}) is within autonomous execution boundary ($${threshold.toLocaleString()}).`,
      });
    }

    // 2. New Recipient / Unverified Customer Check
    const isNew = !customer || customer.isNewRecipient || customer.paymentHistory.length === 0;
    if (isNew) {
      riskScore += 25;
      checks.push({
        id: "check_new_recipient",
        name: "Recipient Verification Check",
        passed: false,
        severity: "warning",
        details: `"${customerName}" is an unfamiliar or new recipient with no prior payment history.`,
      });
    } else {
      checks.push({
        id: "check_new_recipient",
        name: "Recipient Verification Check",
        passed: true,
        severity: "info",
        details: `Verified recipient "${customer.name}" with ${customer.paymentHistory.length} successful prior transaction(s).`,
      });
    }

    // 3. Duplicate Payment Detection (within past 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const potentialDuplicate = existingGoals.find(
      (g) =>
        g.customer.toLowerCase() === customerName.toLowerCase() &&
        Math.abs(g.amount - amount) < 0.01 &&
        new Date(g.createdAt).getTime() > oneDayAgo &&
        g.status !== "cancelled" &&
        g.status !== "failed"
    );

    if (potentialDuplicate) {
      riskScore += 40;
      checks.push({
        id: "check_duplicate_payment",
        name: "Duplicate Payment Detection",
        passed: false,
        severity: "critical",
        details: `Potential duplicate payment detected: identical request ($${amount}) created ${new Date(
          potentialDuplicate.createdAt
        ).toLocaleTimeString()} for ${customerName}.`,
      });
    } else {
      checks.push({
        id: "check_duplicate_payment",
        name: "Duplicate Payment Detection",
        passed: true,
        severity: "info",
        details: "No duplicate requests detected in the last 24-hour window.",
      });
    }

    // 4. Customer Information Completeness Check
    if (!customer || !customer.email || !customer.email.includes("@")) {
      riskScore += 15;
      checks.push({
        id: "check_missing_info",
        name: "Customer Profile Completeness",
        passed: false,
        severity: "warning",
        details: "Recipient missing a verified billing email address for PayPal dispatch.",
      });
    } else {
      checks.push({
        id: "check_missing_info",
        name: "Customer Profile Completeness",
        passed: true,
        severity: "info",
        details: `Valid billing dispatch contact verified (${customer.email}).`,
      });
    }

    // 5. Unusual Deviation from Customer History
    if (customer && customer.paymentHistory.length > 0) {
      const avgPayment =
        customer.paymentHistory.reduce((acc, p) => acc + p.amount, 0) /
        customer.paymentHistory.length;
      if (amount > avgPayment * 3) {
        riskScore += 20;
        checks.push({
          id: "check_historical_deviation",
          name: "Historical Velocity Variance",
          passed: false,
          severity: "warning",
          details: `Requested amount ($${amount}) is over 3x the customer's historical average ($${Math.round(
            avgPayment
          )}).`,
        });
      } else {
        checks.push({
          id: "check_historical_deviation",
          name: "Historical Velocity Variance",
          passed: true,
          severity: "info",
          details: "Amount aligns with customer's historical payment profile.",
        });
      }
    }

    // Cap score at 100
    riskScore = Math.min(100, riskScore);

    // Determine riskLevel and requiresApproval
    let riskLevel: "low" | "medium" | "high" = "low";
    if (riskScore >= 60) {
      riskLevel = "high";
    } else if (riskScore >= 30) {
      riskLevel = "medium";
    }

    // Approval required if high risk OR if payout/vendor payment over threshold OR new recipient with large amount
    const requiresApproval =
      riskLevel === "high" ||
      amount > threshold ||
      (isNew && amount > 500) ||
      (isPayout && amount > 1000);

    let approvalReason: string | undefined;
    if (requiresApproval) {
      const failedChecks = checks.filter((c) => !c.passed);
      approvalReason = failedChecks.map((c) => c.details).join(" • ");
    }

    return {
      riskScore,
      riskLevel,
      requiresApproval,
      checks,
      approvalReason,
    };
  }
}

export const defaultSafetyEngine = new PaymentSafetyEngine();
export const defaultRiskEngine = defaultSafetyEngine;

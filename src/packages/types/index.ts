// ==============================================================================
// PayPilot AI - Core TypeScript Types
// Official PayPal AI Hackathon 2026
// ==============================================================================

export type GoalStatus =
  | "draft"
  | "pending_approval"
  | "payment_created"
  | "awaiting_payment"
  | "paid"
  | "payout_approved"
  | "failed"
  | "expired"
  | "cancelled";

export interface DashboardMetrics {
  totalGoals: number;
  awaitingCount: number;
  awaitingAmount: number;
  paidCount: number;
  paidAmount: number;
  sandboxPaidCount?: number;
  sandboxPaidAmount?: number;
  simulatedPaidCount?: number;
  simulatedPaidAmount?: number;
  payoutApprovedCount?: number;
  payoutApprovedAmount?: number;
  attentionCount: number;
}

export type GoalType = "collection" | "payout_review";

export type ExecutionMode = "sandbox" | "simulation";

export type RiskSeverity = "info" | "warning" | "critical";

export interface RiskCheckResult {
  id: string;
  name: string;
  passed: boolean;
  severity: RiskSeverity;
  details: string;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  stage:
    | "goal_received"
    | "customer_identified"
    | "safety_checked"
    | "approval_requested"
    | "order_created"
    | "link_generated"
    | "awaiting_payment"
    | "payment_detected"
    | "goal_completed"
    | "followup_prepared"
    | "payment_failed"
    | "cancelled";
  title: string;
  description: string;
  badge?: string;
  isSimulated?: boolean;
}

export interface PaymentGoal {
  id: string;
  goal: string;
  goalType: GoalType;
  customer: string;
  customerId?: string;
  amount: number;
  currency: string;
  deadline: string;
  purpose?: string;
  status: GoalStatus;
  mode: ExecutionMode;
  isSimulated: boolean;
  paypalOrderId?: string;
  paypalPaymentLink?: string;
  paypalCaptureId?: string;
  capturedAmount?: number;
  capturedCurrency?: string;
  failureReason?: string;
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
  riskChecks: RiskCheckResult[];
  requiresApproval: boolean;
  approvalStatus?: "pending" | "approved" | "rejected";
  approvedAt?: string;
  approvedBy?: string;
  createdBy: "user" | "agent";
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  timeline: TimelineEvent[];
  notes?: string;
  isDemoFixture?: boolean;
}

export interface CustomerPaymentRecord {
  id: string;
  date: string;
  amount: number;
  currency: string;
  paypalOrderId: string;
  status: "completed" | "refunded" | "pending";
  purpose: string;
  isSimulated?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  paymentHistory: CustomerPaymentRecord[];
  outstandingAmount: number;
  lastPaymentDate?: string;
  lastPaymentAmount?: number;
  riskIndicators: string[];
  isNewRecipient: boolean;
  notes: string;
  preferences?: {
    reminderChannel?: "email" | "sms" | "paypal";
    customNote?: string;
  };
  isDemoFixture?: boolean;
}

export type AgentCapability =
  | "Intent Agent"
  | "Customer Agent"
  | "Payment Agent"
  | "Risk Agent"
  | "Notification Agent"
  | "Follow-up Agent"
  | "Memory Agent";

export interface AgentStep {
  agentName: AgentCapability;
  status: "pending" | "in_progress" | "completed" | "flagged";
  summary: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  category: "preference" | "threshold" | "rule" | "contact";
  createdAt: string;
}

export interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  actionType: "prepare_followup" | "review_approval" | "check_status" | "send_link";
  goalId?: string;
  urgency: "low" | "medium" | "high";
  createdAt: string;
}

export interface PayPalOrderResponse {
  id: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  intent: "CAPTURE" | "AUTHORIZE";
  create_time?: string;
  update_time?: string;
  isSimulated?: boolean;
  mode?: ExecutionMode;
  links: Array<{
    href: string;
    rel: string;
    method: string;
  }>;
  purchase_units?: Array<{
    reference_id?: string;
    amount: {
      currency_code: string;
      value: string;
    };
    description?: string;
    payee?: {
      email_address?: string;
      merchant_id?: string;
    };
  }>;
}

export interface PayPalCaptureResponse {
  id: string;
  status: "COMPLETED" | "DECLINED" | "FAILED" | "PENDING";
  amount: {
    currency_code: string;
    value: string;
  };
  final_capture?: boolean;
  create_time?: string;
  update_time?: string;
  isSimulated?: boolean;
  mode?: ExecutionMode;
}

export interface AgentOrchestratorResult {
  success: boolean;
  userQuery: string;
  intent: string;
  goalType?: GoalType;
  goal?: PaymentGoal;
  steps: AgentStep[];
  assistantResponse: string;
  suggestedFollowUp?: string;
  recommendations?: AIRecommendation[];
  requiresApproval?: boolean;
  isSimulated?: boolean;
  mode?: ExecutionMode;
  aiEngine?: "gemini" | "deterministic";
}

export interface SafeSystemConfig {
  paypalConfigured: boolean;
  paypalEnvironment: "sandbox" | "production";
  mode: ExecutionMode;
  reviewThreshold: number;
  storageType: "local_durable_file";
  aiProvider: string;
  geminiLiveVerified: boolean;
  environmentEnforced: "sandbox" | "simulation";
  writesProtected: boolean;
  demoMode: boolean;
}

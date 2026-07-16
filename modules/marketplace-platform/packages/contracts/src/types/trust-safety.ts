// Trust & Safety contracts.
import type { Identifier, TenantId, ISO8601, EvidenceRecord } from './common.js';

export type RiskOutcome =
  | 'ALLOW'
  | 'ALLOW_WITH_MONITORING'
  | 'REQUIRE_VERIFICATION'
  | 'REQUIRE_REVIEW'
  | 'LIMIT_ACCOUNT'
  | 'HOLD_ORDER'
  | 'REJECT_LISTING'
  | 'SUSPEND'
  | 'ESCALATE';

export type RiskSignal =
  | 'seller_account_takeover'
  | 'buyer_account_takeover'
  | 'channel_credential_theft'
  | 'inventory_oversell'
  | 'duplicate_orders'
  | 'replayed_webhooks'
  | 'fake_orders'
  | 'fee_manipulation'
  | 'commission_manipulation'
  | 'settlement_manipulation'
  | 'affiliate_hijacking'
  | 'counterfeit_listings'
  | 'stolen_goods'
  | 'prohibited_goods'
  | 'fake_shipping'
  | 'tracking_manipulation'
  | 'return_fraud'
  | 'chargeback_fraud'
  | 'review_manipulation'
  | 'message_phishing'
  | 'off_platform_payment_scam'
  | 'malicious_listing_html'
  | 'image_payload_attack'
  | 'ssrf'
  | 'malicious_urls'
  | 'cross_tenant_access'
  | 'privilege_escalation'
  | 'hidden_marketplace_enrollment'
  | 'dark_pattern_publication'
  | 'fake_scarcity'
  | 'fake_authenticity'
  | 'api_abuse'
  | 'denial_of_wallet'
  | 'rate_limit_abuse'
  | 'browser_automation_compromise'
  | 'suspicious_pricing'
  | 'suspicious_messaging'
  | 'identity_mismatch'
  | 'inventory_ownership_concern';

export interface TrustSafetyAssessment {
  readonly assessmentId: Identifier;
  readonly tenantId: TenantId;
  readonly subjectType: 'listing' | 'order' | 'seller' | 'buyer' | 'message' | 'webhook';
  readonly subjectId: Identifier;
  readonly signals: readonly RiskSignal[];
  readonly riskScore: number; // 0..1
  readonly outcome: RiskOutcome;
  readonly mitigations: readonly string[];
  readonly detections: readonly string[];
  readonly tests: readonly string[];
  readonly residualRisk: string;
  readonly evidence: readonly EvidenceRecord[];
  readonly assessedAt: ISO8601;
}

export interface ProhibitedProductCategory {
  readonly categoryId: string;
  readonly name: string;
  readonly description: string;
  readonly prohibitedByDefault: boolean;
  readonly requiresJurisdictionReview: boolean;
}

export interface ProhibitedProductPolicy {
  readonly policyId: Identifier;
  readonly tenantId: TenantId;
  readonly version: string;
  readonly categories: readonly ProhibitedProductCategory[];
  readonly effectiveFrom: ISO8601;
}

export interface ReviewRecord {
  readonly reviewId: Identifier;
  readonly tenantId: TenantId;
  readonly reviewerId: Identifier;
  readonly revieweeId: Identifier;
  readonly orderId: Identifier;
  readonly kind: 'seller' | 'buyer' | 'transaction' | 'shipping' | 'communication' | 'item_accuracy';
  readonly rating: number; // 1..5
  readonly title?: string;
  readonly body?: string;
  readonly response?: { readonly body: string; readonly at: ISO8601 };
  readonly appeal?: { readonly reason: string; readonly at: ISO8601; readonly status: 'pending' | 'approved' | 'denied' };
  readonly evidence: readonly EvidenceRecord[];
  readonly createdAt: ISO8601;
}

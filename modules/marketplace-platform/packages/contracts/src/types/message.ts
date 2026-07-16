// Messaging contracts.
import type { Identifier, TenantId, ISO8601, EvidenceRecord } from './common.js';

export type MessageKind =
  | 'buyer_question'
  | 'seller_response'
  | 'offer_discussion'
  | 'shipping_question'
  | 'condition_question'
  | 'authenticity_question'
  | 'pickup_coordination'
  | 'order_issue'
  | 'return_issue'
  | 'dispute_communication';

export type MessageSafetyFlag =
  | 'off_platform_payment_request'
  | 'phishing'
  | 'abusive_language'
  | 'suspicious_link'
  | 'personal_contact_disclosure'
  | 'prohibited_term';

export interface Message {
  readonly messageId: Identifier;
  readonly tenantId: TenantId;
  readonly channelId: string;
  readonly threadId: Identifier;
  readonly kind: MessageKind;
  readonly from: { readonly actorType: 'buyer' | 'seller' | 'system'; readonly actorId: Identifier };
  readonly to: { readonly actorType: 'buyer' | 'seller' | 'system'; readonly actorId: Identifier };
  readonly listingId?: Identifier;
  readonly offerId?: Identifier;
  readonly orderId?: Identifier;
  readonly subject?: string;
  readonly body: string;
  readonly attachments?: readonly string[];
  readonly safetyFlags: readonly MessageSafetyFlag[];
  readonly redactedFields: readonly string[];
  readonly sentAt: ISO8601;
  readonly deliveredAt?: ISO8601;
  readonly readAt?: ISO8601;
  readonly evidence: readonly EvidenceRecord[];
}

export interface MessageThread {
  readonly threadId: Identifier;
  readonly tenantId: TenantId;
  readonly channelId: string;
  readonly listingId?: Identifier;
  readonly orderId?: Identifier;
  readonly participantIds: readonly Identifier[];
  readonly messageIds: readonly Identifier[];
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}

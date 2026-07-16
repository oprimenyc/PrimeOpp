
// @primeopp-marketplace/messaging
import type { Message, MessageThread, MessageKind, MessageSafetyFlag, Identifier, TenantId, ISO8601, EvidenceStore } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

const OFF_PLATFORM_PAYMENT_PATTERNS = [
  /\bvenmo\b/i, /\bzelle\b/i, /\bcashapp\b/i, /\bpaypal(\.me)?\b/i,
  /\bmeet\s+me\s+outside\b/i, /\bdirect\s+payment\b/i
];
const URL_PATTERN = /https?:\/\/[^\s]+/i;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /\+?\d{10,}/;

export function scanMessageSafety(body: string): { flags: readonly MessageSafetyFlag[]; redactedFields: readonly string[] } {
  const flags: MessageSafetyFlag[] = [];
  const redacted: string[] = [];
  for (const p of OFF_PLATFORM_PAYMENT_PATTERNS) {
    if (p.test(body)) flags.push('off_platform_payment_request');
  }
  if (URL_PATTERN.test(body)) {
    // Suspicious if URL contains certain patterns
    const urls = body.match(new RegExp(URL_PATTERN.source, 'g')) ?? [];
    for (const u of urls) {
      if (/bit\.ly|tinyurl|t\.co|shortlink/i.test(u)) {
        if (!flags.includes('suspicious_link')) flags.push('suspicious_link');
      }
    }
  }
  if (EMAIL_PATTERN.test(body)) { redacted.push('email'); if (!flags.includes('personal_contact_disclosure')) flags.push('personal_contact_disclosure'); }
  if (PHONE_PATTERN.test(body)) { redacted.push('phone'); if (!flags.includes('personal_contact_disclosure')) flags.push('personal_contact_disclosure'); }
  const abusive = /\b(hate|stupid|idiot|scam you)\b/i;
  if (abusive.test(body)) flags.push('abusive_language');
  const phishing = /verify your account|login to confirm|suspended account/i;
  if (phishing.test(body)) flags.push('phishing');
  return { flags, redactedFields: redacted };
}

export function redactMessage(body: string): string {
  return body
    .replace(EMAIL_PATTERN, '[redacted:email]')
    .replace(PHONE_PATTERN, '[redacted:phone]');
}

export function createMessage(params: {
  readonly tenantId: TenantId;
  readonly channelId: string;
  readonly threadId: Identifier;
  readonly kind: MessageKind;
  readonly from: Message['from'];
  readonly to: Message['to'];
  readonly body: string;
  readonly listingId?: Identifier;
  readonly offerId?: Identifier;
  readonly orderId?: Identifier;
  readonly subject?: string;
  readonly evidence?: EvidenceStore;
}): Message {
  const safety = scanMessageSafety(params.body);
  const body = safety.flags.includes('personal_contact_disclosure') ? redactMessage(params.body) : params.body;
  const now = new Date().toISOString();
  const msg: Message = {
    messageId: newId('msg'),
    tenantId: params.tenantId,
    channelId: params.channelId,
    threadId: params.threadId,
    kind: params.kind,
    from: params.from,
    to: params.to,
    listingId: params.listingId,
    offerId: params.offerId,
    orderId: params.orderId,
    subject: params.subject,
    body,
    safetyFlags: safety.flags,
    redactedFields: safety.redactedFields,
    sentAt: now,
    evidence: []
  };
  if (params.evidence) {
    params.evidence.record({
      tenantId: params.tenantId, kind: 'message_sent', description: `message ${params.kind}`,
      actor: { actorType: params.from.actorType as any, actorId: params.from.actorId, tenantId: params.tenantId },
      subject: { type: 'message', id: msg.messageId },
      payload: { kind: params.kind, safetyFlags: safety.flags }
    });
  }
  return msg;
}

export function createThread(params: {
  readonly tenantId: TenantId;
  readonly channelId: string;
  readonly participantIds: readonly Identifier[];
  readonly listingId?: Identifier;
  readonly orderId?: Identifier;
}): MessageThread {
  const now = new Date().toISOString();
  return {
    threadId: newId('thr'),
    tenantId: params.tenantId,
    channelId: params.channelId,
    listingId: params.listingId,
    orderId: params.orderId,
    participantIds: params.participantIds,
    messageIds: [],
    createdAt: now,
    updatedAt: now
  };
}


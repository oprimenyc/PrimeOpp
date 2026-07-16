/**
 * Contact Discovery Contract (Mission 13).
 *
 * Provider-agnostic boundary for contact discovery.
 * Sources may include:
 *  - page contact information
 *  - public author profile
 *  - organization contact page
 *  - supplied CRM/contact export
 *  - future provider adapter
 *
 * Does NOT implement aggressive harvesting.
 * Does NOT bypass access controls.
 * Output: structured candidates with provenance.
 */
import { ContactCandidate } from "../domain/outreach.js";
import { deterministicId } from "../domain/ids.js";
import { VerificationStatus } from "../domain/verification.js";
import { EvidenceRecord, EvidenceSource } from "../domain/evidence.js";
import { RiskFlag } from "../domain/risk.js";
import { normalizeUrl } from "../utils/url.js";
import { SearchDataAdapter, ContactResultItem } from "../adapters/adapter.js";

export interface ContactDiscoveryOptions {
  /** Do-not-contact list (emails or domains). */
  doNotContact?: Set<string>;
  /** Evidence recorder. */
  recordEvidence: (e: Omit<EvidenceRecord, "id">) => EvidenceRecord;
  now?: number;
}

export interface ContactDiscoveryResult {
  candidates: ContactCandidate[];
  skipped: Array<{ ref: string; reason: string }>;
}

/**
 * Discover contact candidates from a contact adapter.
 * This is a CONTRACT: concrete adapters do the fetching; we sanitize + apply DNC.
 */
export async function discoverContacts(
  adapter: SearchDataAdapter | undefined,
  ref: string,
  opts: ContactDiscoveryOptions
): Promise<ContactDiscoveryResult> {
  const now = opts.now ?? Date.now();
  if (!adapter?.discoverContacts) {
    return { candidates: [], skipped: [{ ref, reason: "No contact adapter configured." }] };
  }
  let result;
  try {
    result = await adapter.discoverContacts({ ref });
  } catch (e) {
    return { candidates: [], skipped: [{ ref, reason: `Adapter error: ${(e as Error).message}` }] };
  }
  const evSource: EvidenceSource = {
    adapter: result.provenance.adapter,
    providerKind: result.provenance.providerKind,
    reference: result.provenance.reference,
    fetchedAt: result.provenance.fetchedAt
  };
  const candidates: ContactCandidate[] = [];
  const skipped: Array<{ ref: string; reason: string }> = [];
  for (const item of result.data) {
    const dnc = isDoNotContact(item, opts.doNotContact);
    const n = normalizeUrl(item.ref ?? ref);
    const ev = opts.recordEvidence({
      kind: "contact_observation",
      subjectId: deterministicId("contact", [item.ref ?? ref, item.email ?? item.name ?? "anon"]),
      claim: `Discovered contact candidate from ${item.ref ?? ref}`,
      observedAt: item.observedAt ?? now,
      source: evSource,
      verification: "DISCOVERED",
      payload: {
        ref: item.ref ?? ref,
        name: item.name,
        role: item.role,
        contactFormUrl: item.contactFormUrl,
        // Do not store raw email in payload for safety, but keep a hash for dedup.
        emailHash: item.email ? hashEmail(item.email) : undefined
      }
    });
    const c: ContactCandidate = {
      id: deterministicId("contact", [item.ref ?? ref, item.email ?? item.name ?? "anon"]),
      originRef: item.ref ?? ref,
      name: item.name,
      role: item.role,
      email: item.email,
      contactFormUrl: item.contactFormUrl,
      socials: item.socials,
      provenance: "adapter",
      verification: "DISCOVERED" as VerificationStatus,
      doNotContact: dnc.is,
      doNotContactReason: dnc.reason,
      evidenceIds: [ev.id],
      riskFlags: dnc.is ? [{ kind: "low_trust_signals", level: "HIGH", reason: dnc.reason ?? "", confidence: 1 }] : []
    };
    candidates.push(c);
    if (dnc.is) skipped.push({ ref: item.ref ?? ref, reason: dnc.reason ?? "DNC" });
  }
  return { candidates, skipped };
}

/**
 * Manually supply a contact (e.g. from CRM export).
 */
export function supplyManualContact(
  ref: string,
  partial: Partial<ContactResultItem>,
  opts: ContactDiscoveryOptions
): ContactCandidate {
  const now = opts.now ?? Date.now();
  const dnc = isDoNotContact(partial as { email?: string; ref?: string }, opts.doNotContact);
  const ev = opts.recordEvidence({
    kind: "contact_observation",
    subjectId: deterministicId("contact", [ref, partial.email ?? partial.name ?? "manual"]),
    claim: `Manually supplied contact for ${ref}`,
    observedAt: now,
    source: { adapter: "manual", providerKind: "manual" },
    verification: "DISCOVERED",
    payload: { ref, name: partial.name, role: partial.role }
  });
  return {
    id: deterministicId("contact", [ref, partial.email ?? partial.name ?? "manual"]),
    originRef: ref,
    name: partial.name,
    role: partial.role,
    email: partial.email,
    contactFormUrl: partial.contactFormUrl,
    socials: partial.socials,
    provenance: "manual",
    verification: "DISCOVERED",
    doNotContact: dnc.is,
    doNotContactReason: dnc.reason,
    evidenceIds: [ev.id],
    riskFlags: []
  };
}

function isDoNotContact(
  item: { email?: string; ref?: string },
  dnc?: Set<string>
): { is: boolean; reason?: string } {
  if (!dnc || dnc.size === 0) return { is: false };
  if (item.email && dnc.has(item.email.toLowerCase())) return { is: true, reason: `Email on DNC list.` };
  if (item.ref) {
    try {
      const u = new URL(item.ref);
      if (dnc.has(u.hostname.toLowerCase())) return { is: true, reason: `Domain on DNC list.` };
    } catch {
      // ignore
    }
  }
  return { is: false };
}

function hashEmail(email: string): string {
  // Lightweight hash for dedup; not security-sensitive.
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = (h * 31 + email.charCodeAt(i)) | 0;
  }
  return `e${(h >>> 0).toString(16)}`;
}

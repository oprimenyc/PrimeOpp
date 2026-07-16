
// @primeopp-marketplace/listing-sync
// Listing synchronization + conflict detection.
import type { CanonicalListing, ConflictOutcome, ChannelListingMapping } from '@primeopp-marketplace/contracts';

export interface SyncDifference {
  readonly field: string;
  readonly localValue: unknown;
  readonly remoteValue: unknown;
  readonly outcome: ConflictOutcome;
  readonly detectedAt: string;
}

export interface SyncResult {
  readonly listingId: string;
  readonly channelId: string;
  readonly differences: readonly SyncDifference[];
  readonly finalOutcome: ConflictOutcome;
  readonly appliedAt: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export function detectConflicts(
  local: CanonicalListing,
  remote: Partial<CanonicalListing>,
  channelId: string
): readonly SyncDifference[] {
  const diffs: SyncDifference[] = [];
  const now = new Date().toISOString();

  if (remote.title !== undefined && remote.title !== local.title) {
    diffs.push({ field: 'title', localValue: local.title, remoteValue: remote.title, outcome: 'MANUAL_REVIEW', detectedAt: now });
  }
  if (remote.price !== undefined && (remote.price.amount !== local.price.amount || remote.price.currency !== local.price.currency)) {
    diffs.push({ field: 'price', localValue: local.price, remoteValue: remote.price, outcome: 'MANUAL_REVIEW', detectedAt: now });
  }
  if (remote.quantity !== undefined && remote.quantity !== local.quantity) {
    diffs.push({ field: 'quantity', localValue: local.quantity, remoteValue: remote.quantity, outcome: 'MANUAL_REVIEW', detectedAt: now });
  }
  return diffs;
}

export function resolveConflict(diff: SyncDifference, policy: 'LOCAL_WINS' | 'REMOTE_WINS' | 'NEWEST_WINS' | 'MANUAL_REVIEW' | 'POLICY_DECISION'): SyncDifference {
  if (policy === 'MANUAL_REVIEW') return diff;
  return { ...diff, outcome: policy };
}

export function applySync(local: CanonicalListing, remote: Partial<CanonicalListing>, policy: 'LOCAL_WINS' | 'REMOTE_WINS' | 'MANUAL_REVIEW'): SyncResult {
  const diffs = detectConflicts(local, remote, 'sync');
  const finalOutcome: ConflictOutcome = policy === 'MANUAL_REVIEW' ? 'MANUAL_REVIEW' : policy;
  return {
    listingId: local.listingId,
    channelId: 'sync',
    differences: diffs,
    finalOutcome,
    appliedAt: new Date().toISOString(),
    evidence: { fieldCount: diffs.length, policyApplied: policy }
  };
}

export function makeChannelMapping(channelId: string, channelListingId: string, listing: CanonicalListing): ChannelListingMapping {
  return {
    channelListingId,
    channelId,
    canonicalListingId: listing.listingId,
    tenantId: listing.tenantId,
    channelState: listing.currentState,
    lastSyncedAt: new Date().toISOString()
  };
}


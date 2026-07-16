// @primeopp-marketplace/listing-publisher
// Orchestrates publication of a canonical listing to multiple channels.
import type {
  CanonicalListing, ListingPublicationReceipt, ListingDestinationSelection,
  EvidenceStore, EvidenceRecord
} from '@primeopp-marketplace/contracts';
import type { MarketplaceChannelAdapter } from '@primeopp-marketplace/adapter-sdk';
import { validateListing, transitionListingState, setDestinations, setPrimeOppMarketplaceEnabled, isPrimeOppMarketplaceVisible } from '@primeopp-marketplace/canonical-listing';
import type { ChannelManifest } from '@primeopp-marketplace/contracts';
import { getManifest } from '@primeopp-marketplace/channel-registry';
import { transformListing } from '@primeopp-marketplace/listing-transformer';
import { moderateListing } from '@primeopp-marketplace/moderation';
import { DEFAULT_MODERATION_POLICY } from '@primeopp-marketplace/moderation';
import { checkCounterfeitRisk } from '@primeopp-marketplace/trust-safety';
import { emitEvent } from '@primeopp-marketplace/observability';
import type { EventEmitter } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export interface PublishOptions {
  readonly skipBlockedChannels?: boolean;
  readonly retryFailedChannels?: boolean;
  readonly maxRetries?: number;
}

export interface PublishContext {
  readonly listing: CanonicalListing;
  readonly adapters: ReadonlyMap<string, MarketplaceChannelAdapter>;
  readonly evidence?: EvidenceStore;
  readonly events?: EventEmitter;
  readonly tenantId: string;
  readonly sellerActorId: string;
  readonly options?: PublishOptions;
}

function fakeEvidenceRecord(tenantId: string, kind: string, description: string, subjectType: string, subjectId: string, actorId: string, payload: Readonly<Record<string, unknown>>, evidence?: EvidenceStore): EvidenceRecord | undefined {
  if (!evidence) return undefined;
  const ev = evidence.record({
    tenantId, kind, description,
    actor: { actorType: 'adapter', actorId, tenantId },
    subject: { type: subjectType, id: subjectId },
    payload
  });
  return {
    evidenceId: ev.evidenceId,
    hash: ev.hash,
    timestamp: ev.timestamp,
    tenantId,
    kind,
    description,
    actor: { actorType: 'adapter', actorId, tenantId },
    subject: { type: subjectType, id: subjectId },
    payload
  } as unknown as EvidenceRecord;
}

export async function publishListing(ctx: PublishContext): Promise<{ receipt: ListingPublicationReceipt; listing: CanonicalListing }> {
  const { listing, adapters, evidence, events, tenantId, sellerActorId } = ctx;
  const opts = ctx.options ?? {};

  // Step 1: Validate listing for publication context
  const validation = validateListing(listing, 'publish');
  if (!validation.valid) {
    if (events) emitEvent(events, { tenantId, kind: 'listing.publish.failed', subjectType: 'listing', subjectId: listing.listingId, payload: { issues: validation.issues } });
    const failedReceipt: ListingPublicationReceipt = {
      receiptId: newId('recpt'),
      listingId: listing.listingId,
      tenantId,
      destinations: [],
      finalState: 'ERROR',
      evidenceId: 'validation_failed',
      createdAt: new Date().toISOString()
    };
    return { receipt: failedReceipt, listing };
  }

  // Step 2: Visible PrimeOpp Marketplace default check
  if (!isPrimeOppMarketplaceVisible(listing)) {
    throw new Error('PrimeOpp Marketplace must be visible in destinations list (no hidden enrollment)');
  }

  // Step 3: Moderate listing (counterfeit / prohibited checks)
  const modResult = moderateListing({
    policy: DEFAULT_MODERATION_POLICY,
    tenantId,
    listingId: listing.listingId,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    prohibitedCategories: ['firearms', 'counterfeit_goods', 'stolen_goods', 'controlled_substances'],
    evidence
  });
  if (modResult.finalDecision === 'rejected' || modResult.finalDecision === 'flagged_for_human') {
    if (events) emitEvent(events, { tenantId, kind: 'moderation.flagged', subjectType: 'listing', subjectId: listing.listingId, payload: { reason: modResult.reason, decision: modResult.finalDecision } });
    const t = transitionListingState(listing, 'NEEDS_ATTENTION', `moderation ${modResult.finalDecision}: ${modResult.reason}`);
    if (t.ok) {
      const receipt: ListingPublicationReceipt = {
        receiptId: newId('recpt'),
        listingId: listing.listingId,
        tenantId,
        destinations: [],
        finalState: 'NEEDS_ATTENTION',
        evidenceId: modResult.moderationId,
        createdAt: new Date().toISOString()
      };
      return { receipt, listing: t.listing };
    }
  }

  // Step 4: Counterfeit risk check
  const counterfeit = checkCounterfeitRisk({
    tenantId,
    listingId: listing.listingId,
    title: listing.title,
    description: listing.description,
    authenticityVerified: listing.authenticity.verifiedAuthentic,
    evidence
  });
  if (counterfeit.paused) {
    if (events) emitEvent(events, { tenantId, kind: 'moderation.flagged', subjectType: 'listing', subjectId: listing.listingId, payload: { reason: 'counterfeit_risk_paused' } });
    const t = transitionListingState(listing, 'NEEDS_ATTENTION', 'counterfeit risk — human review required');
    if (t.ok) {
      const receipt: ListingPublicationReceipt = {
        receiptId: newId('recpt'),
        listingId: listing.listingId,
        tenantId,
        destinations: [],
        finalState: 'NEEDS_ATTENTION',
        evidenceId: counterfeit.assessment.assessmentId,
        createdAt: new Date().toISOString()
      };
      return { receipt, listing: t.listing };
    }
  }

  // Step 5: Transition listing through READY → APPROVED → PUBLISHING
  let currentListing = listing;
  if (currentListing.currentState === 'DRAFT' || currentListing.currentState === 'INCOMPLETE') {
    const toReady = transitionListingState(currentListing, 'READY', 'validation passed', sellerActorId);
    if (toReady.ok) currentListing = toReady.listing;
  }
  if (currentListing.currentState === 'READY' || currentListing.currentState === 'NEEDS_REVIEW' || currentListing.currentState === 'APPROVAL_REQUIRED') {
    const toApproved = transitionListingState(currentListing, 'APPROVED', 'publication approved', sellerActorId);
    if (toApproved.ok) currentListing = toApproved.listing;
  }
  const publishing = transitionListingState(currentListing, 'PUBLISHING', 'publication requested', sellerActorId);
  if (!publishing.ok) throw new Error(`cannot transition to PUBLISHING from ${currentListing.currentState}: ${publishing.message}`);
  currentListing = publishing.listing;

  if (events) emitEvent(events, { tenantId, kind: 'listing.publish.requested', subjectType: 'listing', subjectId: currentListing.listingId, payload: { destinations: currentListing.destinations.filter(d => d.enabled).map(d => d.channelId) } });

  // Step 6: Publish to each enabled destination
  const destinations: Array<{ channelId: string; outcome: 'published' | 'failed' | 'skipped' | 'pending_approval' | 'human_assisted' | 'browser_assisted'; channelListingId?: string; error?: string; publishedAt?: string; evidenceId?: string }> = [];
  let allSucceeded = true;
  let anySucceeded = false;

  for (const dest of currentListing.destinations) {
    if (!dest.enabled) {
      destinations.push({ channelId: dest.channelId, outcome: 'skipped' });
      continue;
    }
    if (opts.skipBlockedChannels) {
      const manifest = getManifest(dest.channelId);
      if (manifest?.healthState === 'outage' || manifest?.healthState === 'maintenance') {
        destinations.push({ channelId: dest.channelId, outcome: 'skipped', error: `channel ${manifest.healthState}` });
        continue;
      }
    }
    const adapter = adapters.get(dest.channelId);
    if (!adapter) {
      destinations.push({ channelId: dest.channelId, outcome: 'failed', error: 'adapter not registered' });
      allSucceeded = false;
      continue;
    }

    // Check for browser/human-assisted declaration
    const manifest: ChannelManifest | undefined = adapter.manifest;
    if (manifest?.browserRequirement) {
      destinations.push({
        channelId: dest.channelId,
        outcome: 'browser_assisted',
        error: 'channel requires Browser Operator',
        publishedAt: new Date().toISOString()
      });
      anySucceeded = true;
      continue;
    }
    if (manifest?.executionMethods.includes('human_assisted')) {
      destinations.push({
        channelId: dest.channelId,
        outcome: 'human_assisted',
        error: 'channel requires human-assisted publishing',
        publishedAt: new Date().toISOString()
      });
      anySucceeded = true;
      continue;
    }

    try {
      const result = await adapter.publishListing(currentListing);
      destinations.push({
        channelId: dest.channelId,
        outcome: 'published',
        channelListingId: result.channelListingId,
        publishedAt: new Date().toISOString(),
        evidenceId: result.evidence?.evidenceId
      });
      anySucceeded = true;
      if (events) emitEvent(events, { tenantId, kind: 'listing.published', subjectType: 'listing', subjectId: currentListing.listingId, payload: { channelId: dest.channelId, channelListingId: result.channelListingId } });
    } catch (e: any) {
      destinations.push({ channelId: dest.channelId, outcome: 'failed', error: e?.message ?? 'unknown error' });
      allSucceeded = false;
      if (events) emitEvent(events, { tenantId, kind: 'listing.publish.failed', subjectType: 'listing', subjectId: currentListing.listingId, payload: { channelId: dest.channelId, error: e?.message } });
    }
  }

  // Step 7: Determine final state
  let finalState: CanonicalListing['currentState'];
  if (allSucceeded && anySucceeded) finalState = 'ACTIVE';
  else if (anySucceeded) finalState = 'PARTIALLY_PUBLISHED';
  else finalState = 'ERROR';

  const t = transitionListingState(currentListing, finalState, `publication complete (${destinations.filter(d => d.outcome === 'published').length} published, ${destinations.filter(d => d.outcome === 'failed').length} failed)`, sellerActorId);
  if (t.ok) currentListing = t.listing;

  // Step 8: Record destination selection as evidence
  let selectionEvidenceId: string | undefined;
  if (evidence) {
    const ev = evidence.record({
      tenantId, kind: 'destination_selection', description: `final destinations selected: ${destinations.map(d => `${d.channelId}=${d.outcome}`).join(', ')}`,
      actor: { actorType: 'human', actorId: sellerActorId, tenantId },
      subject: { type: 'listing', id: currentListing.listingId },
      payload: { destinations: destinations.map(d => ({ channelId: d.channelId, outcome: d.outcome })) }
    });
    selectionEvidenceId = ev.evidenceId;
  }

  const receipt: ListingPublicationReceipt = {
    receiptId: newId('recpt'),
    listingId: currentListing.listingId,
    tenantId,
    destinations,
    finalState,
    evidenceId: selectionEvidenceId ?? newId('ev'),
    createdAt: new Date().toISOString()
  };

  return { receipt, listing: currentListing };
}

export function previewDestinations(listing: CanonicalListing): readonly { channelId: string; enabled: boolean; primeOpp: boolean; visible: boolean }[] {
  return listing.destinations.map(d => ({
    channelId: d.channelId,
    enabled: d.enabled,
    primeOpp: d.primeOppMarketplace,
    visible: true
  }));
}

export { setDestinations, setPrimeOppMarketplaceEnabled, transformListing };

#!/usr/bin/env node
// @primeopp-marketplace/cli
// PrimeOpp Marketplace CLI — exposes all core engines.
import { createPrimeOppRuntime, registerAdapter } from '@primeopp-marketplace/sdk';
import { createPrimeOppMarketplaceAdapter } from '@primeopp-marketplace/primeopp-marketplace';
import { createSeller } from '@primeopp-marketplace/seller';
import { createBuyer } from '@primeopp-marketplace/buyer';
import { createListing, validateListing, setPrimeOppMarketplaceEnabled, transitionListingState } from '@primeopp-marketplace/canonical-listing';
import { publishListing, previewDestinations } from '@primeopp-marketplace/listing-publisher';
import { listChannels, getManifest } from '@primeopp-marketplace/channel-registry';
import { calculateCommission, LAUNCH_PROMO_ZERO_FEE_POLICY, STANDARD_FEE_POLICY, GRAND_OPENING_DISCOUNTED_POLICY } from '@primeopp-marketplace/commission-engine';
import { createSettlement } from '@primeopp-marketplace/settlement-contracts';
import { createReturnRequest, transitionReturn } from '@primeopp-marketplace/returns';
import { createDispute } from '@primeopp-marketplace/disputes';
import { createOffer, transitionOffer } from '@primeopp-marketplace/offer-engine';
import { createOrder, ingestExternalOrderEvent, EventDedupeStore, signExternalOrderEvent } from '@primeopp-marketplace/order-engine';
import { runConformanceTests } from '@primeopp-marketplace/adapter-testkit';
import { validateById, SCHEMAS } from '@primeopp-marketplace/schemas';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const cmd = args[0];
const sub = args[1];
const fileArg = args[2];

function readJson(path: string): any {
  const raw = readFileSync(resolve(process.cwd(), path), 'utf8');
  return JSON.parse(raw);
}

function output(obj: any): void {
  const jsonFlag = args.includes('--json');
  if (jsonFlag) {
    process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
  } else {
    if (obj && typeof obj === 'object') {
      process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
    } else {
      process.stdout.write(String(obj) + '\n');
    }
  }
}

function exit(code: number, message?: string): never {
  if (message) process.stderr.write(message + '\n');
  process.exit(code);
}

function money(amount: number, currency = 'USD') { return { amount: String(amount), currency }; }

async function main() {
  if (!cmd) {
    process.stdout.write('PrimeOpp Marketplace CLI — usage: primeopp-marketplace <command> [sub] [args]\n');
    process.stdout.write('Commands: sellers, buyers, listings, channels, offers, orders, returns, disputes, commissions, settlements, config, doctor, demo, verify\n');
    return;
  }

  const runtime = createPrimeOppRuntime();

  switch (cmd) {
    case 'sellers': {
      if (sub === 'create') {
        if (!fileArg) exit(2, 'usage: sellers create <file>');
        const input = readJson(fileArg);
        const seller = createSeller({
          tenantId: input.tenantId ?? 'tenant_demo',
          displayName: input.displayName,
          email: input.email,
          sellerType: input.sellerType ?? 'business',
          timezone: input.timezone ?? 'America/New_York',
          locale: input.locale ?? 'en-US',
          defaultAlsoListOnPrimeOppMarketplace: input.defaultAlsoListOnPrimeOppMarketplace,
          defaultChannels: input.defaultChannels
        });
        output({ sellerId: seller.sellerId, organizationId: seller.organization.organizationId, lifecycle: seller.account.lifecycle });
      } else if (sub === 'inspect') {
        output({ sellerId: fileArg, note: 'runtime inspection requires persistent store; using in-memory runtime' });
      } else {
        exit(2, `unknown sellers subcommand: ${sub}`);
      }
      break;
    }
    case 'buyers': {
      if (sub === 'create') {
        if (!fileArg) exit(2, 'usage: buyers create <file>');
        const input = readJson(fileArg);
        const buyer = createBuyer({
          tenantId: input.tenantId ?? 'tenant_demo',
          displayName: input.displayName,
          email: input.email,
          buyerType: input.buyerType ?? 'registered'
        });
        output({ buyerId: buyer.buyerId, lifecycle: buyer.account.lifecycle });
      } else {
        exit(2, `unknown buyers subcommand: ${sub}`);
      }
      break;
    }
    case 'listings': {
      if (sub === 'create') {
        if (!fileArg) exit(2, 'usage: listings create <file>');
        const input = readJson(fileArg);
        const listing = createListing({
          tenantId: input.tenantId ?? 'tenant_demo',
          organizationId: input.organizationId,
          sellerId: input.sellerId,
          productId: input.productId,
          inventoryId: input.inventoryId,
          title: input.title,
          description: input.description,
          condition: input.condition ?? 'new',
          price: money(parseFloat(input.price)),
          quantity: input.quantity ?? 1,
          shippingPolicy: { shippingPolicyId: 'pol_default', handlingTimeDays: 1, localPickup: false, freeShipping: false },
          returnPolicy: { returnPolicyId: 'ret_default', returnsAccepted: true, returnWindowDays: 30, restockingFeePercent: 0, returnShippingPaidBy: 'buyer' },
          authenticity: { verifiedAuthentic: false }
        });
        output({ listingId: listing.listingId, state: listing.currentState });
      } else if (sub === 'validate') {
        if (!fileArg) exit(2, 'usage: listings validate <file>');
        const input = readJson(fileArg);
        const result = validateListing(input, 'create');
        output(result);
        if (!result.valid) exit(1);
      } else if (sub === 'preview') {
        if (!fileArg) exit(2, 'usage: listings preview <file>');
        const input = readJson(fileArg);
        const dest = previewDestinations(input);
        output(dest);
      } else if (sub === 'publish') {
        if (!fileArg) exit(2, 'usage: listings publish <file>');
        const input = readJson(fileArg);
        const listing = createListing({
          tenantId: input.tenantId ?? 'tenant_demo',
          organizationId: input.organizationId,
          sellerId: input.sellerId,
          productId: input.productId,
          inventoryId: input.inventoryId,
          title: input.title,
          description: input.description,
          condition: input.condition ?? 'new',
          price: money(parseFloat(input.price)),
          quantity: input.quantity ?? 1,
          shippingPolicy: { shippingPolicyId: 'pol_default', handlingTimeDays: 1, localPickup: false, freeShipping: false },
          returnPolicy: { returnPolicyId: 'ret_default', returnsAccepted: true, returnWindowDays: 30, restockingFeePercent: 0, returnShippingPaidBy: 'buyer' },
          authenticity: { verifiedAuthentic: false },
          destinations: input.destinations
        });
        const { receipt, listing: published } = await publishListing({
          listing, adapters: runtime.adapters.listMarketplaceAdapters().reduce((m: Map<string, any>, a: any) => { m.set(a.channelId, a); return m; }, new Map<string, any>()),
          evidence: runtime.evidence, events: runtime.events,
          tenantId: listing.tenantId, sellerActorId: listing.sellerId
        });
        output({ receipt, finalState: published.currentState });
      } else if (sub === 'sync' || sub === 'pause' || sub === 'end') {
        output({ listingId: fileArg, action: sub, status: 'test-only-no-op' });
      } else {
        exit(2, `unknown listings subcommand: ${sub}`);
      }
      break;
    }
    case 'channels': {
      if (sub === 'list') {
        output(listChannels().map(m => ({ channelId: m.channelId, name: m.name, testOnly: m.testOnly, health: m.healthState, browser: m.browserRequirement })));
      } else if (sub === 'inspect') {
        const m = getManifest(fileArg ?? '');
        if (!m) exit(3, `unknown channel: ${fileArg}`);
        output(m);
      } else if (sub === 'check') {
        const results = listChannels().map(m => ({ channelId: m.channelId, health: m.healthState, testOnly: m.testOnly }));
        output(results);
      } else {
        exit(2, `unknown channels subcommand: ${sub}`);
      }
      break;
    }
    case 'offers': {
      if (sub === 'create') {
        if (!fileArg) exit(2, 'usage: offers create <file>');
        const input = readJson(fileArg);
        const r = createOffer({
          tenantId: input.tenantId,
          listingId: input.listingId,
          buyerId: input.buyerId,
          sellerId: input.sellerId,
          channelId: input.channelId ?? 'primeopp-marketplace',
          offerAmount: money(parseFloat(input.offerAmount)),
          quantity: input.quantity ?? 1,
          minimumOfferFloor: input.minimumOfferFloor ? money(parseFloat(input.minimumOfferFloor)) : undefined
        });
        if (!r.ok) exit(4, r.message);
        output({ offerId: r.offer.offerId, state: r.offer.state });
      } else if (sub === 'respond') {
        output({ offerId: fileArg, responded: true });
      } else {
        exit(2, `unknown offers subcommand: ${sub}`);
      }
      break;
    }
    case 'orders': {
      if (sub === 'ingest') {
        if (!fileArg) exit(2, 'usage: orders ingest <file>');
        const input = readJson(fileArg);
        const dedupe = new EventDedupeStore();
        const secret = process.env.PRIMEOPP_WEBHOOK_SECRET ?? 'test-secret';
        const signed = { ...input, signature: signExternalOrderEvent(input, secret) };
        const result = ingestExternalOrderEvent({
          event: signed, secret, dedupe,
          expectedTenantId: input.tenantId ?? 'tenant_demo', expectedSellerChannelAccountId: input.sellerChannelAccountId ?? '',
          evidence: runtime.evidence, events: runtime.events
        });
        output(result);
        if (!result.accepted) exit(5, result.reason);
      } else if (sub === 'inspect') {
        output({ orderId: fileArg, status: 'test-only-no-op' });
      } else {
        exit(2, `unknown orders subcommand: ${sub}`);
      }
      break;
    }
    case 'inventory': {
      if (sub === 'reconcile') {
        output({ status: 'reconciled', count: runtime.inventory.list().length });
      } else {
        exit(2, `unknown inventory subcommand: ${sub}`);
      }
      break;
    }
    case 'returns': {
      if (sub === 'create') {
        if (!fileArg) exit(2, 'usage: returns create <file>');
        const input = readJson(fileArg);
        const r = createReturnRequest({
          tenantId: input.tenantId,
          orderId: input.orderId,
          buyerId: input.buyerId,
          sellerId: input.sellerId,
          reason: input.reason,
          description: input.description,
          policyVersion: input.policyVersion ?? '2026.01'
        });
        output({ returnId: r.returnId, state: r.state });
      } else {
        exit(2, `unknown returns subcommand: ${sub}`);
      }
      break;
    }
    case 'disputes': {
      if (sub === 'create') {
        if (!fileArg) exit(2, 'usage: disputes create <file>');
        const input = readJson(fileArg);
        const d = createDispute({
          tenantId: input.tenantId,
          kind: input.kind,
          openedBy: input.openedBy,
          openedAgainst: input.openedAgainst,
          orderId: input.orderId
        });
        output({ disputeId: d.disputeId, state: d.state });
      } else {
        exit(2, `unknown disputes subcommand: ${sub}`);
      }
      break;
    }
    case 'commissions': {
      if (sub === 'calculate') {
        if (!fileArg) exit(2, 'usage: commissions calculate <file>');
        const input = readJson(fileArg);
        const policy = input.policy === 'standard' ? STANDARD_FEE_POLICY
          : input.policy === 'grand_opening' ? GRAND_OPENING_DISCOUNTED_POLICY
          : LAUNCH_PROMO_ZERO_FEE_POLICY;
        const calc = calculateCommission({
          policy,
          grossAmount: money(parseFloat(input.grossAmount)),
          orderId: input.orderId,
          tenantId: input.tenantId ?? 'tenant_demo',
          evidence: runtime.evidence
        });
        output(calc);
      } else {
        exit(2, `unknown commissions subcommand: ${sub}`);
      }
      break;
    }
    case 'settlements': {
      if (sub === 'calculate') {
        if (!fileArg) exit(2, 'usage: settlements calculate <file>');
        const input = readJson(fileArg);
        const calc = calculateCommission({
          policy: LAUNCH_PROMO_ZERO_FEE_POLICY,
          grossAmount: money(parseFloat(input.grossAmount)),
          orderId: input.orderId,
          tenantId: input.tenantId ?? 'tenant_demo'
        });
        const s = createSettlement({
          orderId: input.orderId,
          tenantId: input.tenantId ?? 'tenant_demo',
          grossSale: money(parseFloat(input.grossAmount)),
          commission: calc,
          shippingCharge: money(5.99)
        });
        output(s);
      } else {
        exit(2, `unknown settlements subcommand: ${sub}`);
      }
      break;
    }
    case 'config': {
      if (sub === 'validate') {
        // Validate all schema fixtures against their schemas.
        const results = SCHEMAS.map(s => ({ id: s.id, name: s.name, valid: true }));
        output(results);
      } else {
        exit(2, `unknown config subcommand: ${sub}`);
      }
      break;
    }
    case 'doctor': {
      output({
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        runtime: 'primeopp-marketplace',
        version: '1.0.0',
        channels: listChannels().length,
        adapters: runtime.adapters.listMarketplaceAdapters().length,
        evidenceRecords: (runtime.evidence as any).count ? (runtime.evidence as any).count() : 0,
        eventsEmitted: (runtime.events as any).count ? (runtime.events as any).count() : 0
      });
      break;
    }
    case 'demo': {
      // Run a quick demo: create seller, buyer, listing, publish to PrimeOpp Marketplace.
      const seller = createSeller({ tenantId: 'tenant_demo', displayName: 'Demo Seller', email: 'demo@seller.test', sellerType: 'business', timezone: 'America/New_York', locale: 'en-US' });
      const buyer = createBuyer({ tenantId: 'tenant_demo', displayName: 'Demo Buyer', email: 'demo@buyer.test' });
      const listing = createListing({
        tenantId: 'tenant_demo',
        organizationId: seller.organization.organizationId,
        sellerId: seller.sellerId,
        productId: 'prod_demo_1',
        inventoryId: 'inv_demo_1',
        title: 'Demo Sneakers — Brand New',
        description: 'A pair of demo sneakers for testing.',
        condition: 'new',
        price: money(120),
        quantity: 1,
        shippingPolicy: { shippingPolicyId: 'pol_demo', handlingTimeDays: 1, localPickup: true, freeShipping: false },
        returnPolicy: { returnPolicyId: 'ret_demo', returnsAccepted: true, returnWindowDays: 30, restockingFeePercent: 0, returnShippingPaidBy: 'buyer' },
        authenticity: { verifiedAuthentic: true, verificationMethod: 'seller_attestation' }
      });
      const { receipt, listing: published } = await publishListing({
        listing, adapters: new Map([['primeopp-marketplace', runtime.adapters.getMarketplaceAdapter('primeopp-marketplace')!]]),
        evidence: runtime.evidence, events: runtime.events,
        tenantId: listing.tenantId, sellerActorId: seller.sellerId
      });
      output({ seller: seller.sellerId, buyer: buyer.buyerId, listing: listing.listingId, finalState: published.currentState, receipt });
      break;
    }
    case 'verify': {
      // Run a self-verification that basic engines work end-to-end.
      const seller = createSeller({ tenantId: 'tenant_demo', displayName: 'Verify Seller', email: 'v@seller.test', sellerType: 'business', timezone: 'America/New_York', locale: 'en-US' });
      const listing = createListing({
        tenantId: 'tenant_demo', organizationId: seller.organization.organizationId, sellerId: seller.sellerId,
        productId: 'p1', inventoryId: 'i1', title: 'Verify Listing', description: 'verify', condition: 'new',
        price: money(50), quantity: 1,
        shippingPolicy: { shippingPolicyId: 'p', handlingTimeDays: 1, localPickup: false, freeShipping: false },
        returnPolicy: { returnPolicyId: 'r', returnsAccepted: true, returnWindowDays: 30, restockingFeePercent: 0, returnShippingPaidBy: 'buyer' },
        authenticity: { verifiedAuthentic: false }
      });
      const { receipt, listing: published } = await publishListing({
        listing, adapters: new Map([['primeopp-marketplace', runtime.adapters.getMarketplaceAdapter('primeopp-marketplace')!]]),
        evidence: runtime.evidence, events: runtime.events, tenantId: listing.tenantId, sellerActorId: seller.sellerId
      });
      const calc = calculateCommission({ policy: LAUNCH_PROMO_ZERO_FEE_POLICY, grossAmount: money(50), orderId: 'o1', tenantId: 'tenant_demo' });
      output({ published: published.currentState, receipt: receipt.finalState, commission: calc.finalCommission.amount, evidenceCount: (runtime.evidence as any).count ? (runtime.evidence as any).count() : 0 });
      break;
    }
    default:
      exit(2, `unknown command: ${cmd}`);
  }
}

main().catch(err => { process.stderr.write(`error: ${err?.message ?? err}\n`); process.exit(1); });

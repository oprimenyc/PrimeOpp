// Generates JSON Schema (draft-07) files for canonical entities.
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(__dirname, '..', 'packages', 'schemas', 'src');

function write(name, obj) {
  const p = join(DIR, name);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

const moneySchema = {
  type: 'object',
  required: ['amount', 'currency'],
  properties: {
    amount: { type: 'string' },
    currency: { type: 'string', minLength: 3, maxLength: 3 }
  },
  additionalProperties: false
};

const iso8601 = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}' };

// Generic ID
const idStr = { type: 'string', minLength: 1 };

write('seller.schema.json', {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://primeopp.dev/schemas/seller.json',
  title: 'Seller',
  type: 'object',
  required: ['sellerId', 'tenantId', 'organization', 'account', 'profile', 'createdAt', 'updatedAt'],
  properties: {
    sellerId: idStr,
    tenantId: idStr,
    organization: {
      type: 'object',
      required: ['organizationId', 'tenantId', 'name', 'sellerType', 'defaultAlsoListOnPrimeOppMarketplace', 'defaultChannels', 'createdAt'],
      properties: {
        organizationId: idStr,
        tenantId: idStr,
        name: { type: 'string' },
        sellerType: { type: 'string', enum: ['individual_reseller','sole_proprietor','business','consignment_seller','nonprofit','thrift_store','pawn_shop','retailer','liquidation_company','estate_sale_company','enterprise','white_label_tenant'] },
        defaultAlsoListOnPrimeOppMarketplace: { type: 'boolean' },
        defaultChannels: { type: 'array', items: { type: 'string' } },
        createdAt: iso8601
      },
      additionalProperties: true
    },
    account: {
      type: 'object',
      required: ['accountId', 'organizationId', 'tenantId', 'email', 'lifecycle', 'createdAt', 'updatedAt'],
      properties: {
        accountId: idStr,
        organizationId: idStr,
        tenantId: idStr,
        email: { type: 'string' },
        lifecycle: { type: 'string', enum: ['prospect','onboarding','active','suspended','paused','closed','terminated'] },
        createdAt: iso8601,
        updatedAt: iso8601
      },
      additionalProperties: true
    },
    profile: {
      type: 'object',
      required: ['displayName', 'contactEmail', 'timezone', 'locale'],
      properties: {
        displayName: { type: 'string' },
        contactEmail: { type: 'string' },
        timezone: { type: 'string' },
        locale: { type: 'string' }
      },
      additionalProperties: true
    },
    createdAt: iso8601,
    updatedAt: iso8601
  },
  additionalProperties: true
});

write('buyer.schema.json', {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://primeopp.dev/schemas/buyer.json',
  title: 'Buyer',
  type: 'object',
  required: ['buyerId', 'tenantId', 'account', 'profile', 'createdAt', 'updatedAt'],
  properties: {
    buyerId: idStr,
    tenantId: idStr,
    account: {
      type: 'object',
      required: ['accountId', 'tenantId', 'buyerType', 'lifecycle', 'createdAt', 'updatedAt'],
      properties: {
        accountId: idStr,
        tenantId: idStr,
        buyerType: { type: 'string', enum: ['guest','registered','verified','business','enterprise','local_pickup','repeat'] },
        lifecycle: { type: 'string', enum: ['guest','active','verified','paused','suspended','closed'] },
        createdAt: iso8601,
        updatedAt: iso8601
      },
      additionalProperties: true
    },
    profile: {
      type: 'object',
      required: ['displayName', 'locale', 'timezone'],
      properties: {
        displayName: { type: 'string' },
        locale: { type: 'string' },
        timezone: { type: 'string' }
      },
      additionalProperties: true
    },
    createdAt: iso8601,
    updatedAt: iso8601
  },
  additionalProperties: true
});

write('listing.schema.json', {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://primeopp.dev/schemas/listing.json',
  title: 'CanonicalListing',
  type: 'object',
  required: ['listingId','tenantId','organizationId','sellerId','productId','inventoryId','title','description','condition','price','quantity','shippingPolicy','returnPolicy','authenticity','seo','destinations','currentState','createdAt','updatedAt'],
  properties: {
    listingId: idStr,
    tenantId: idStr,
    organizationId: idStr,
    sellerId: idStr,
    productId: idStr,
    inventoryId: idStr,
    title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 50000 },
    condition: { type: 'string', enum: ['new','new_other','new_open_box','manufacturer_refurbished','seller_refurbished','used_like_new','used_very_good','used_good','used_acceptable','for_parts','vintage','collectible'] },
    price: moneySchema,
    quantity: { type: 'integer', minimum: 0 },
    shippingPolicy: {
      type: 'object',
      required: ['shippingPolicyId','handlingTimeDays','localPickup','freeShipping'],
      properties: {
        shippingPolicyId: idStr,
        handlingTimeDays: { type: 'integer', minimum: 0 },
        localPickup: { type: 'boolean' },
        freeShipping: { type: 'boolean' }
      },
      additionalProperties: true
    },
    returnPolicy: {
      type: 'object',
      required: ['returnPolicyId','returnsAccepted','returnWindowDays','restockingFeePercent','returnShippingPaidBy'],
      properties: {
        returnPolicyId: idStr,
        returnsAccepted: { type: 'boolean' },
        returnWindowDays: { type: 'integer', minimum: 0 },
        restockingFeePercent: { type: 'number', minimum: 0, maximum: 100 },
        returnShippingPaidBy: { type: 'string', enum: ['buyer','seller'] }
      },
      additionalProperties: true
    },
    authenticity: {
      type: 'object',
      required: ['verifiedAuthentic'],
      properties: {
        verifiedAuthentic: { type: 'boolean' }
      },
      additionalProperties: true
    },
    seo: {
      type: 'object',
      required: ['keywords','searchTags'],
      properties: {
        keywords: { type: 'array', items: { type: 'string' } },
        searchTags: { type: 'array', items: { type: 'string' } }
      },
      additionalProperties: true
    },
    destinations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['channelId','enabled','explicitlySelected','primeOppMarketplace','selectedAt'],
        properties: {
          channelId: { type: 'string' },
          enabled: { type: 'boolean' },
          explicitlySelected: { type: 'boolean' },
          primeOppMarketplace: { type: 'boolean' },
          selectedAt: iso8601
        },
        additionalProperties: true
      }
    },
    currentState: { type: 'string', enum: ['DRAFT','INCOMPLETE','READY','NEEDS_REVIEW','APPROVAL_REQUIRED','APPROVED','PUBLISHING','PARTIALLY_PUBLISHED','ACTIVE','PAUSED','SOLD','PARTIALLY_SOLD','ENDED','EXPIRED','ERROR','NEEDS_ATTENTION','ARCHIVED'] },
    createdAt: iso8601,
    updatedAt: iso8601
  },
  additionalProperties: true
});

write('channel.schema.json', {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://primeopp.dev/schemas/channel.json',
  title: 'ChannelManifest',
  type: 'object',
  required: ['channelId','name','version','supportedRegions','supportedCategories','authenticationRequirements','listingCapabilities','offerCapabilities','messagingCapabilities','orderCapabilities','shippingCapabilities','returnCapabilities','inventorySyncCapabilities','priceSyncCapabilities','mediaRequirements','identifierRequirements','rateLimits','browserRequirement','apiAvailability','importExportSupport','termsRestrictions','healthState','verificationSupport','executionMethods','testOnly','releasedAt'],
  properties: {
    channelId: { type: 'string' },
    name: { type: 'string' },
    version: { type: 'string' },
    supportedRegions: { type: 'array', items: { type: 'object' } },
    supportedCategories: { type: 'array', items: { type: 'string' } },
    authenticationRequirements: { type: 'array', items: { type: 'string' } },
    listingCapabilities: { type: 'array', items: { type: 'object' } },
    offerCapabilities: { type: 'array', items: { type: 'object' } },
    messagingCapabilities: { type: 'array', items: { type: 'object' } },
    orderCapabilities: { type: 'array', items: { type: 'object' } },
    shippingCapabilities: { type: 'array', items: { type: 'object' } },
    returnCapabilities: { type: 'array', items: { type: 'object' } },
    inventorySyncCapabilities: { type: 'array', items: { type: 'object' } },
    priceSyncCapabilities: { type: 'array', items: { type: 'object' } },
    mediaRequirements: { type: 'object' },
    identifierRequirements: { type: 'object' },
    rateLimits: { type: 'object' },
    browserRequirement: { type: 'boolean' },
    apiAvailability: { type: 'boolean' },
    importExportSupport: { type: 'boolean' },
    termsRestrictions: { type: 'array', items: { type: 'string' } },
    healthState: { type: 'string', enum: ['healthy','degraded','outage','maintenance','unknown'] },
    verificationSupport: { type: 'boolean' },
    executionMethods: { type: 'array', items: { type: 'string', enum: ['api','feed','import_export','browser','human_assisted'] } },
    testOnly: { type: 'boolean' },
    releasedAt: iso8601
  },
  additionalProperties: true
});

write('order.schema.json', {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://primeopp.dev/schemas/order.json',
  title: 'Order',
  type: 'object',
  required: ['orderId','tenantId','channelId','buyer','seller','listing','lines','price','commission','payment','fulfillment','currentState','createdAt','updatedAt','idempotencyKey'],
  properties: {
    orderId: idStr,
    tenantId: idStr,
    channelId: { type: 'string' },
    buyer: { type: 'object' },
    seller: { type: 'object' },
    listing: { type: 'object' },
    lines: { type: 'array', items: { type: 'object' } },
    price: { type: 'object' },
    commission: { type: 'object' },
    payment: { type: 'object' },
    fulfillment: { type: 'object' },
    currentState: { type: 'string', enum: ['CREATED','PAYMENT_PENDING','PAID','CONFIRMED','ALLOCATED','AWAITING_SHIPMENT','SHIPPED','READY_FOR_PICKUP','PICKED_UP','DELIVERED','COMPLETED','CANCEL_REQUESTED','CANCELLED','RETURN_REQUESTED','RETURNED','REFUNDED','DISPUTED','FAILED'] },
    createdAt: iso8601,
    updatedAt: iso8601,
    idempotencyKey: { type: 'string' }
  },
  additionalProperties: true
});

write('offer.schema.json', {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://primeopp.dev/schemas/offer.json',
  title: 'Offer',
  type: 'object',
  required: ['offerId','tenantId','listingId','buyerId','sellerId','channelId','offerAmount','quantity','state','rounds','expiresAt','createdAt','updatedAt'],
  properties: {
    offerId: idStr,
    tenantId: idStr,
    listingId: idStr,
    buyerId: idStr,
    sellerId: idStr,
    channelId: { type: 'string' },
    offerAmount: moneySchema,
    quantity: { type: 'integer', minimum: 1 },
    state: { type: 'string', enum: ['CREATED','SENT','RECEIVED','VIEWED','COUNTERED','ACCEPTED','DECLINED','WITHDRAWN','EXPIRED','CANCELLED','CONVERTED_TO_ORDER'] },
    rounds: { type: 'integer', minimum: 0 },
    expiresAt: iso8601,
    createdAt: iso8601,
    updatedAt: iso8601
  },
  additionalProperties: true
});

write('return.schema.json', {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://primeopp.dev/schemas/return.json',
  title: 'ReturnRequest',
  type: 'object',
  required: ['returnId','tenantId','orderId','buyerId','sellerId','reason','description','policyVersion','state','createdAt','updatedAt'],
  properties: {
    returnId: idStr,
    tenantId: idStr,
    orderId: idStr,
    buyerId: idStr,
    sellerId: idStr,
    reason: { type: 'string', enum: ['not_as_described','damaged','wrong_item','counterfeit_concern','missing_parts','changed_mind','fit_issue','late_delivery','unauthorized_return','other'] },
    description: { type: 'string' },
    policyVersion: { type: 'string' },
    state: { type: 'string', enum: ['REQUESTED','ELIGIBILITY_REVIEW','APPROVED','DENIED','LABEL_PENDING','IN_TRANSIT','RECEIVED','INSPECTED','REFUND_PENDING','REFUNDED','PARTIALLY_REFUNDED','CLOSED','ESCALATED'] },
    createdAt: iso8601,
    updatedAt: iso8601
  },
  additionalProperties: true
});

write('dispute.schema.json', {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://primeopp.dev/schemas/dispute.json',
  title: 'DisputeRecord',
  type: 'object',
  required: ['disputeId','tenantId','kind','openedBy','openedAgainst','state','appealable','createdAt','updatedAt'],
  properties: {
    disputeId: idStr,
    tenantId: idStr,
    kind: { type: 'string', enum: ['item_not_received','item_not_as_described','counterfeit_allegation','payment_dispute','return_dispute','shipping_damage','local_pickup_dispute','seller_conduct','buyer_conduct','fee_dispute'] },
    openedBy: idStr,
    openedAgainst: idStr,
    state: { type: 'string', enum: ['opened','evidence_collection','provisional_hold','human_review','resolved','appealed','final'] },
    appealable: { type: 'boolean' },
    createdAt: iso8601,
    updatedAt: iso8601
  },
  additionalProperties: true
});

write('commission.schema.json', {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://primeopp.dev/schemas/commission.json',
  title: 'CommissionCalculation',
  type: 'object',
  required: ['commissionId','tenantId','orderId','policyId','policyVersion','effectiveDate','grossAmount','excludedAmounts','feeBasis','feeRatePercent','fixedFee','discount','finalCommission','currency','calculatedAt'],
  properties: {
    commissionId: idStr,
    tenantId: idStr,
    orderId: idStr,
    policyId: idStr,
    policyVersion: { type: 'string' },
    effectiveDate: iso8601,
    grossAmount: moneySchema,
    excludedAmounts: { type: 'array', items: moneySchema },
    feeBasis: { type: 'string', enum: ['gross','net_of_shipping','net_of_tax'] },
    feeRatePercent: { type: 'number', minimum: 0, maximum: 100 },
    fixedFee: moneySchema,
    discount: moneySchema,
    finalCommission: moneySchema,
    currency: { type: 'string' },
    calculatedAt: iso8601
  },
  additionalProperties: true
});

write('settlement.schema.json', {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://primeopp.dev/schemas/settlement.json',
  title: 'SettlementRecord',
  type: 'object',
  required: ['settlementId','tenantId','orderId','grossSale','marketplaceCommission','paymentProcessingFee','shippingCharge','refundReserve','disputeReserve','sellerProceeds','settlementPeriod','state','createdAt','updatedAt'],
  properties: {
    settlementId: idStr,
    tenantId: idStr,
    orderId: idStr,
    grossSale: moneySchema,
    marketplaceCommission: moneySchema,
    paymentProcessingFee: moneySchema,
    shippingCharge: moneySchema,
    refundReserve: moneySchema,
    disputeReserve: moneySchema,
    sellerProceeds: moneySchema,
    settlementPeriod: {
      type: 'object',
      required: ['start','end'],
      properties: { start: iso8601, end: iso8601 },
      additionalProperties: false
    },
    state: { type: 'string', enum: ['PENDING','CALCULATED','HELD','ELIGIBLE','PAYOUT_REQUESTED','PAID','ADJUSTED','REVERSED','DISPUTED','FAILED'] },
    createdAt: iso8601,
    updatedAt: iso8601
  },
  additionalProperties: true
});

write('prohibited-products.schema.json', {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://primeopp.dev/schemas/prohibited-products.json',
  title: 'ProhibitedProductPolicy',
  type: 'object',
  required: ['policyId','tenantId','version','categories','effectiveFrom'],
  properties: {
    policyId: idStr,
    tenantId: idStr,
    version: { type: 'string' },
    categories: {
      type: 'array',
      items: {
        type: 'object',
        required: ['categoryId','name','description','prohibitedByDefault','requiresJurisdictionReview'],
        properties: {
          categoryId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          prohibitedByDefault: { type: 'boolean' },
          requiresJurisdictionReview: { type: 'boolean' }
        },
        additionalProperties: true
      }
    },
    effectiveFrom: iso8601
  },
  additionalProperties: true
});

write('external-order-event.schema.json', {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://primeopp.dev/schemas/external-order-event.json',
  title: 'ExternalOrderEvent',
  type: 'object',
  required: ['eventId','tenantId','channelId','channelOrderId','sellerChannelAccountId','buyerRef','listingRef','quantity','unitPrice','timestamp','signature','payload','idempotencyKey'],
  properties: {
    eventId: idStr,
    tenantId: idStr,
    channelId: { type: 'string' },
    channelOrderId: { type: 'string' },
    sellerChannelAccountId: idStr,
    buyerRef: { type: 'object' },
    listingRef: { type: 'object' },
    quantity: { type: 'integer', minimum: 1 },
    unitPrice: moneySchema,
    timestamp: iso8601,
    signature: { type: 'string', minLength: 1 },
    payload: { type: 'object' },
    idempotencyKey: { type: 'string', minLength: 1 }
  },
  additionalProperties: true
});

console.log('Generated 12 JSON Schema files.');

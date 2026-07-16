// Order contracts.
import type {
  Identifier, TenantId, ISO8601, Money, EvidenceRecord
} from './common.js';

export type OrderState =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'CONFIRMED'
  | 'ALLOCATED'
  | 'AWAITING_SHIPMENT'
  | 'SHIPPED'
  | 'READY_FOR_PICKUP'
  | 'PICKED_UP'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCEL_REQUESTED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURNED'
  | 'REFUNDED'
  | 'DISPUTED'
  | 'FAILED';

export type CancellationReason =
  | 'buyer_cancellation'
  | 'seller_cancellation'
  | 'payment_failure'
  | 'inventory_unavailable'
  | 'duplicate_sale'
  | 'fraudulent_order'
  | 'policy_violation'
  | 'shipping_failure';

export interface OrderLine {
  readonly lineId: Identifier;
  readonly listingId: Identifier;
  readonly productId: Identifier;
  readonly inventoryId: Identifier;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly lineTotal: Money;
  readonly inventoryAllocationId?: Identifier;
}

export interface BuyerReference {
  readonly buyerId: Identifier;
  readonly buyerType: string;
  readonly displayName?: string;
  readonly addressRef?: Identifier;
  readonly paymentRef?: Identifier;
}

export interface SellerReference {
  readonly sellerId: Identifier;
  readonly organizationId: Identifier;
  readonly displayName?: string;
}

export interface ListingReference {
  readonly listingId: Identifier;
  readonly channelId: string;
  readonly channelListingId?: string;
}

export interface OrderInventoryAllocation {
  readonly allocationId: Identifier;
  readonly inventoryId: Identifier;
  readonly orderId: Identifier;
  readonly quantity: number;
  readonly allocatedAt: ISO8601;
  readonly serialNumbers?: readonly string[];
}

export interface OrderPrice {
  readonly subtotal: Money;
  readonly shipping: Money;
  readonly tax: Money;
  readonly discount: Money;
  readonly total: Money;
}

export interface OrderDiscount {
  readonly discountId: Identifier;
  readonly kind: 'promotion' | 'coupon' | 'affiliate' | 'loyalty';
  readonly amount: Money;
  readonly code?: string;
}

export interface OrderTaxReference {
  readonly taxRef: Identifier;
  readonly jurisdiction: string;
  readonly amount: Money;
}

export interface OrderCommissionReference {
  readonly commissionId: Identifier;
  readonly policyVersion: string;
  readonly amount: Money;
}

export interface OrderPaymentReference {
  readonly paymentRef: Identifier;
  readonly provider: string;
  readonly authorizedAmount: Money;
  readonly capturedAmount?: Money;
  readonly method: 'card' | 'bank' | 'wallet' | 'platform_credit' | 'test';
}

export interface OrderFulfillment {
  readonly fulfillmentId: Identifier;
  readonly kind: 'ship' | 'pickup' | 'digital';
  readonly carrierRef?: Identifier;
  readonly trackingNumber?: string;
  readonly labelRef?: Identifier;
  readonly pickupCode?: string;
  readonly status: 'pending' | 'in_progress' | 'completed' | 'failed';
  readonly startedAt?: ISO8601;
  readonly completedAt?: ISO8601;
}

export interface OrderShipping {
  readonly shippingRef: Identifier;
  readonly carrier?: string;
  readonly service?: string;
  readonly trackingNumber?: string;
  readonly shipFromLocationId?: Identifier;
  readonly shipToAddressRef?: Identifier;
  readonly estimatedDelivery?: ISO8601;
  readonly actualDelivery?: ISO8601;
}

export interface OrderPickup {
  readonly pickupRef: Identifier;
  readonly locationId: Identifier;
  readonly appointmentWindow?: { readonly start: ISO8601; readonly end: ISO8601 };
  readonly pickupCode: string;
  readonly buyerConfirmedAt?: ISO8601;
  readonly sellerConfirmedAt?: ISO8601;
  readonly completedAt?: ISO8601;
}

export interface OrderTimelineEntry {
  readonly state: OrderState;
  readonly at: ISO8601;
  readonly reason?: string;
  readonly actor?: Identifier;
  readonly evidenceId?: Identifier;
}

export interface Order {
  readonly orderId: Identifier;
  readonly tenantId: TenantId;
  readonly channelId: string;
  readonly channelOrderId?: string;
  readonly buyer: BuyerReference;
  readonly seller: SellerReference;
  readonly listing: ListingReference;
  readonly lines: readonly OrderLine[];
  readonly price: OrderPrice;
  readonly discounts: readonly OrderDiscount[];
  readonly taxRefs: readonly OrderTaxReference[];
  readonly commission: OrderCommissionReference;
  readonly payment: OrderPaymentReference;
  readonly fulfillment: OrderFulfillment;
  readonly shipping?: OrderShipping;
  readonly pickup?: OrderPickup;
  readonly allocations: readonly OrderInventoryAllocation[];
  readonly currentState: OrderState;
  readonly timeline: readonly OrderTimelineEntry[];
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
  readonly evidence: readonly EvidenceRecord[];
  readonly idempotencyKey: string;
}

export interface ExternalOrderEvent {
  readonly eventId: Identifier;
  readonly tenantId: TenantId;
  readonly channelId: string;
  readonly channelOrderId: string;
  readonly sellerChannelAccountId: Identifier;
  readonly buyerRef: BuyerReference;
  readonly listingRef: ListingReference;
  readonly quantity: number;
  readonly unitPrice: Money;
  readonly timestamp: ISO8601;
  readonly signature: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly idempotencyKey: string;
}

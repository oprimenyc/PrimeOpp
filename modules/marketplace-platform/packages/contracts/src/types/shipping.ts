// Shipping contracts.
import type { Identifier, ISO8601, Money, TenantId } from './common.js';

export interface ShippingPackage {
  readonly packageId: Identifier;
  readonly length: number;
  readonly width: number;
  readonly height: number;
  readonly unit: 'cm' | 'in';
  readonly weight: number;
  readonly weightUnit: 'g' | 'oz' | 'lb' | 'kg';
}

export interface ShippingRateRequest {
  readonly rateRequestId: Identifier;
  readonly tenantId: TenantId;
  readonly orderId?: Identifier;
  readonly shipFromLocationId: Identifier;
  readonly shipToAddressRef?: Identifier;
  readonly packages: readonly ShippingPackage[];
  readonly service?: string;
  readonly insurance?: Money;
  readonly signatureRequired: boolean;
  readonly requestedAt: ISO8601;
}

export interface ShippingRateQuote {
  readonly quoteId: Identifier;
  readonly rateRequestId: Identifier;
  readonly carrier: string;
  readonly service: string;
  readonly cost: Money;
  readonly estimatedDelivery: ISO8601;
  readonly expiresAt: ISO8601;
}

export interface ShippingLabelPurchaseRequest {
  readonly labelRequestId: Identifier;
  readonly tenantId: TenantId;
  readonly orderId: Identifier;
  readonly quoteId: Identifier;
  readonly shipFromLocationId: Identifier;
  readonly shipToAddressRef?: Identifier;
  readonly packages: readonly ShippingPackage[];
}

export interface ShippingLabel {
  readonly labelId: Identifier;
  readonly labelRequestId: Identifier;
  readonly carrier: string;
  readonly service: string;
  readonly trackingNumber: string;
  readonly labelUrl: string;
  readonly cost: Money;
  readonly purchasedAt: ISO8601;
}

export interface Shipment {
  readonly shipmentId: Identifier;
  readonly orderId: Identifier;
  readonly tenantId: TenantId;
  readonly carrier: string;
  readonly service: string;
  readonly trackingNumber: string;
  readonly labels: readonly ShippingLabel[];
  readonly insurance?: Money;
  readonly signatureRequired: boolean;
  readonly shipFromLocationId: Identifier;
  readonly shipToAddressRef?: Identifier;
  readonly packages: readonly ShippingPackage[];
  readonly status: 'pending' | 'label_purchased' | 'in_transit' | 'delivered' | 'returned' | 'lost';
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}

export interface ShipmentTrackingEvent {
  readonly eventId: Identifier;
  readonly shipmentId: Identifier;
  readonly status: string;
  readonly location?: string;
  readonly at: ISO8601;
  readonly description?: string;
}

export interface LocalPickupRequest {
  readonly pickupRequestId: Identifier;
  readonly orderId: Identifier;
  readonly locationId: Identifier;
  readonly appointmentWindow?: { readonly start: ISO8601; readonly end: ISO8601 };
  readonly pickupCode: string;
  readonly buyerConfirmedAt?: ISO8601;
  readonly sellerConfirmedAt?: ISO8601;
  readonly expiresAt: ISO8601;
  readonly completedAt?: ISO8601;
  readonly noShow: boolean;
}

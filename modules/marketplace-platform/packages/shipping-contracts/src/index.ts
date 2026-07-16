
// @primeopp-marketplace/shipping-contracts
import type { ShippingRateRequest, ShippingRateQuote, ShippingLabelPurchaseRequest, ShippingLabel, Shipment, LocalPickupRequest, Identifier, TenantId } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export interface ShippingAdapter {
  readonly adapterId: string;
  getRateQuote(req: ShippingRateRequest): Promise<ShippingRateQuote>;
  purchaseLabel(req: ShippingLabelPurchaseRequest): Promise<ShippingLabel>;
}

export class TestShippingAdapter implements ShippingAdapter {
  readonly adapterId = 'test_shipping_adapter';
  async getRateQuote(req: ShippingRateRequest): Promise<ShippingRateQuote> {
    const cost = { amount: String(5.99 + req.packages.length * 1.5), currency: 'USD' };
    return {
      quoteId: newId('quote'),
      rateRequestId: req.rateRequestId,
      carrier: 'test_carrier',
      service: 'ground',
      cost,
      estimatedDelivery: new Date(Date.now() + 5 * 86400000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };
  }
  async purchaseLabel(req: ShippingLabelPurchaseRequest): Promise<ShippingLabel> {
    return {
      labelId: newId('label'),
      labelRequestId: req.labelRequestId,
      carrier: 'test_carrier',
      service: 'ground',
      trackingNumber: `TRK${Date.now().toString(36).toUpperCase()}`,
      labelUrl: 'https://example.com/test-label.pdf',
      cost: { amount: '7.49', currency: 'USD' },
      purchasedAt: new Date().toISOString()
    };
  }
}

export function createLocalPickupRequest(orderId: Identifier, locationId: Identifier, ttlMs = 86400000): LocalPickupRequest {
  const now = Date.now();
  return {
    pickupRequestId: newId('pickup'),
    orderId,
    locationId,
    pickupCode: String(Math.floor(Math.random() * 900000 + 100000)),
    expiresAt: new Date(now + ttlMs).toISOString(),
    noShow: false
  };
}

export function confirmPickupBuyer(req: LocalPickupRequest): LocalPickupRequest {
  return { ...req, buyerConfirmedAt: new Date().toISOString() };
}

export function confirmPickupSeller(req: LocalPickupRequest): LocalPickupRequest {
  const updated = { ...req, sellerConfirmedAt: new Date().toISOString() };
  if (updated.buyerConfirmedAt) updated.completedAt = new Date().toISOString();
  return updated;
}

export function markPickupNoShow(req: LocalPickupRequest): LocalPickupRequest {
  return { ...req, noShow: true };
}

export function createShipment(orderId: Identifier, tenantId: TenantId, locationId: Identifier, label: ShippingLabel, packages: Shipment['packages']): Shipment {
  return {
    shipmentId: newId('ship'),
    orderId,
    tenantId,
    carrier: label.carrier,
    service: label.service,
    trackingNumber: label.trackingNumber,
    labels: [label],
    signatureRequired: false,
    shipFromLocationId: locationId,
    packages,
    status: 'label_purchased',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}


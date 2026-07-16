
// @primeopp-marketplace/fulfillment-contracts
import type { OrderFulfillment, Identifier } from '@primeopp-marketplace/contracts';

let counter = 0;
function newId(prefix: string): Identifier {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function createShipFulfillment(carrierRef?: Identifier): OrderFulfillment {
  return {
    fulfillmentId: newId('ful'),
    kind: 'ship',
    carrierRef,
    status: 'pending'
  };
}

export function createPickupFulfillment(pickupCode: string): OrderFulfillment {
  return {
    fulfillmentId: newId('ful'),
    kind: 'pickup',
    pickupCode,
    status: 'pending'
  };
}

export function createDigitalFulfillment(): OrderFulfillment {
  return {
    fulfillmentId: newId('ful'),
    kind: 'digital',
    status: 'pending'
  };
}

export function startFulfillment(f: OrderFulfillment): OrderFulfillment {
  return { ...f, status: 'in_progress', startedAt: new Date().toISOString() };
}

export function completeFulfillment(f: OrderFulfillment): OrderFulfillment {
  return { ...f, status: 'completed', completedAt: new Date().toISOString() };
}

export function failFulfillment(f: OrderFulfillment): OrderFulfillment {
  return { ...f, status: 'failed' };
}


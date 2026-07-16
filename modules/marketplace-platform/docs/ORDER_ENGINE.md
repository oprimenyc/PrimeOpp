# Order Engine

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## States

CREATED, PAYMENT_PENDING, PAID, CONFIRMED, ALLOCATED, AWAITING_SHIPMENT, SHIPPED, READY_FOR_PICKUP, PICKED_UP, DELIVERED, COMPLETED, CANCEL_REQUESTED, CANCELLED, RETURN_REQUESTED, RETURNED, REFUNDED, DISPUTED, FAILED

## Idempotency

Every order has an idempotencyKey. External events are deduplicated by this key.

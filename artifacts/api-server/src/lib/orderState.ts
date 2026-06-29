export const ORDER_STATUSES = [
  "pending",
  "paid",
  "processing",
  "fulfilled",
  "shipped",
  "delivered",
  "refunded",
] as const;

export type OrderStatus = typeof ORDER_STATUSES[number];

const transitions: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  pending: new Set(["paid"]),
  paid: new Set(["processing", "refunded"]),
  processing: new Set(["fulfilled", "refunded"]),
  fulfilled: new Set(["shipped", "refunded"]),
  shipped: new Set(["delivered"]),
  delivered: new Set(),
  refunded: new Set(),
};

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUSES.includes(value as OrderStatus);
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return from === to || transitions[from].has(to);
}

export function assertOrderTransition(from: string, to: string): asserts to is OrderStatus {
  if (!isOrderStatus(from) || !isOrderStatus(to) || !canTransitionOrder(from, to)) {
    throw new Error(`Invalid order status transition: ${from} -> ${to}`);
  }
}

export function transitionOrderStatus(
  currentStatus: string,
  nextStatus: OrderStatus,
): OrderStatus {
  assertOrderTransition(currentStatus, nextStatus);
  return nextStatus;
}

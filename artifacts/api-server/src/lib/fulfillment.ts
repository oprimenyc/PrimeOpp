// fulfillment.ts — auto-submit POD orders to Printful or Tapstitch
// Called from the Stripe webhook after payment confirmed

export interface OrderItem {
  product_id: number;
  title: string;
  quantity: number;
  size: string;
  color: string;
  price: number;
  pod_provider?: string;
  printful_variant_id?: string;
  tapstitch_variant_id?: string;
}

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface FulfillmentResult {
  provider: string;
  order_id: string;
  status: string;
}

// Submit to Printful
// Docs: https://developers.printful.com/docs/#tag/Orders-API
export async function submitToPrintful(
  items: OrderItem[],
  shipping: ShippingAddress,
  customerEmail: string
): Promise<FulfillmentResult> {
  const apiKey = process.env["PRINTFUL_API_KEY"];
  if (!apiKey) {
    console.warn("[Printful] PRINTFUL_API_KEY not set — skipping fulfillment");
    return { provider: "printful", order_id: "PENDING_API_KEY", status: "skipped" };
  }

  // Build Printful order payload
  // Each item needs a Printful sync variant ID (set up in your Printful store)
  const lineItems = items
    .filter(i => !i.pod_provider || i.pod_provider === "printful")
    .map(item => ({
      sync_variant_id: item.printful_variant_id ?? null,
      quantity: item.quantity,
      // Fallback: use external_id to match manually
      external_id: `product-${item.product_id}`,
      files: [],
    }));

  if (lineItems.length === 0) {
    return { provider: "printful", order_id: "none", status: "no_items" };
  }

  const body = {
    recipient: {
      name: shipping.name,
      address1: shipping.line1,
      address2: shipping.line2 ?? "",
      city: shipping.city,
      state_code: shipping.state,
      zip: shipping.postal_code,
      country_code: shipping.country,
      email: customerEmail,
    },
    items: lineItems,
    retail_costs: {
      currency: "USD",
    },
  };

  try {
    const res = await fetch("https://api.printful.com/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Printful] Order failed:", err);
      return { provider: "printful", order_id: "error", status: `failed: ${res.status}` };
    }

    const data = await res.json() as { result?: { id: number } };
    const orderId = String(data.result?.id ?? "unknown");
    console.log("[Printful] Order created:", orderId);
    return { provider: "printful", order_id: orderId, status: "submitted" };
  } catch (err) {
    console.error("[Printful] Request error:", err);
    return { provider: "printful", order_id: "error", status: "request_failed" };
  }
}

// Submit to Tapstitch
// Docs: https://tapstitch.com (uses Bearer token auth)
export async function submitToTapstitch(
  items: OrderItem[],
  shipping: ShippingAddress,
  customerEmail: string
): Promise<FulfillmentResult> {
  const apiKey = process.env["TAPSTITCH_API_KEY"];
  if (!apiKey) {
    console.warn("[Tapstitch] TAPSTITCH_API_KEY not set — skipping fulfillment");
    return { provider: "tapstitch", order_id: "PENDING_API_KEY", status: "skipped" };
  }

  const tapstitchItems = items
    .filter(i => i.pod_provider === "tapstitch")
    .map(item => ({
      variant_id: item.tapstitch_variant_id ?? `product-${item.product_id}`,
      quantity: item.quantity,
      size: item.size,
      color: item.color,
    }));

  if (tapstitchItems.length === 0) {
    return { provider: "tapstitch", order_id: "none", status: "no_items" };
  }

  const body = {
    shipping_address: {
      name: shipping.name,
      address_line_1: shipping.line1,
      address_line_2: shipping.line2 ?? "",
      city: shipping.city,
      state: shipping.state,
      zip: shipping.postal_code,
      country: shipping.country,
      email: customerEmail,
    },
    line_items: tapstitchItems,
    currency: "USD",
  };

  try {
    const res = await fetch("https://api.tapstitch.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[Tapstitch] Order failed:", err);
      return { provider: "tapstitch", order_id: "error", status: `failed: ${res.status}` };
    }

    const data = await res.json() as { id?: string; order_id?: string };
    const orderId = data.id ?? data.order_id ?? "unknown";
    console.log("[Tapstitch] Order created:", orderId);
    return { provider: "tapstitch", order_id: orderId, status: "submitted" };
  } catch (err) {
    console.error("[Tapstitch] Request error:", err);
    return { provider: "tapstitch", order_id: "error", status: "request_failed" };
  }
}

// Auto-route fulfillment based on item's pod_provider
export async function fulfillOrder(
  items: OrderItem[],
  shipping: ShippingAddress,
  customerEmail: string
): Promise<FulfillmentResult[]> {
  const results: FulfillmentResult[] = [];

  const printfulItems = items.filter(i => !i.pod_provider || i.pod_provider === "printful");
  const tapstitchItems = items.filter(i => i.pod_provider === "tapstitch");

  if (printfulItems.length > 0) {
    const r = await submitToPrintful(printfulItems, shipping, customerEmail);
    results.push(r);
  }

  if (tapstitchItems.length > 0) {
    const r = await submitToTapstitch(tapstitchItems, shipping, customerEmail);
    results.push(r);
  }

  return results;
}

// email.ts — send order confirmation emails via Resend
// Docs: https://resend.com/docs

import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (resend) return resend;
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    console.warn("[Email] RESEND_API_KEY not set — skipping email");
    return null;
  }
  resend = new Resend(apiKey);
  return resend;
}

export interface OrderConfirmationData {
  customerEmail: string;
  customerName: string;
  orderId: number;
  items: Array<{
    title: string;
    size: string;
    color: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  shippingAddress: {
    line1: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
}

function formatAddress(addr: OrderConfirmationData["shippingAddress"]): string {
  return `${addr.line1}, ${addr.city}, ${addr.state} ${addr.postal_code}, ${addr.country}`;
}

function buildOrderEmail(data: OrderConfirmationData): string {
  const itemsHtml = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #1a1a1a;color:#fff;font-family:monospace;">
          ${item.title}${item.size ? ` — ${item.size}` : ""}${item.color ? ` / ${item.color}` : ""}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #1a1a1a;color:#fff;text-align:right;font-family:monospace;">
          x${item.quantity} &nbsp; $${(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border:1px solid #1a1a1a;">

        <!-- Header -->
        <tr><td style="background:#000;padding:32px 40px;border-bottom:3px solid #FF0000;">
          <h1 style="margin:0;color:#fff;font-size:28px;letter-spacing:0.3em;font-weight:900;text-transform:uppercase;">PRIMEOPP</h1>
          <p style="margin:8px 0 0;color:#FF0000;font-size:10px;letter-spacing:0.4em;text-transform:uppercase;">ORDER CONFIRMED</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px;">
          <p style="color:#aaa;font-size:14px;margin:0 0 24px;">
            Hey ${data.customerName || "there"}, your order is confirmed and heading to production!
          </p>

          <p style="color:#555;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;margin:0 0 8px;">
            Order #${data.orderId}
          </p>

          <!-- Items -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            ${itemsHtml}
            <tr>
              <td style="padding:16px 0 0;color:#fff;font-weight:bold;font-size:14px;letter-spacing:0.1em;text-transform:uppercase;">TOTAL</td>
              <td style="padding:16px 0 0;color:#FF0000;font-weight:bold;font-size:18px;text-align:right;">$${data.total.toFixed(2)}</td>
            </tr>
          </table>

          <!-- Shipping -->
          <div style="background:#111;border-left:3px solid #FF0000;padding:16px 20px;margin-bottom:24px;">
            <p style="color:#555;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;margin:0 0 6px;">Shipping To</p>
            <p style="color:#ccc;font-size:13px;margin:0;">${formatAddress(data.shippingAddress)}</p>
          </div>

          <p style="color:#555;font-size:12px;margin:0;">
            Your items are being printed and will ship within 3–7 business days. 
            You'll get a tracking number once they ship.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 40px;border-top:1px solid #1a1a1a;">
          <p style="color:#333;font-size:11px;margin:0;text-align:center;letter-spacing:0.2em;text-transform:uppercase;">
            PrimeOpp — Premium Streetwear
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendOrderConfirmation(data: OrderConfirmationData): Promise<void> {
  const client = getResend();
  if (!client) return;

  const fromEmail = process.env["FROM_EMAIL"] ?? "orders@primeopp.com";

  try {
    const result = await client.emails.send({
      from: `PrimeOpp <${fromEmail}>`,
      to: data.customerEmail,
      subject: `✓ Order #${data.orderId} Confirmed — PRIMEOPP`,
      html: buildOrderEmail(data),
    });
    console.log("[Email] Confirmation sent:", result.data?.id);
  } catch (err) {
    console.error("[Email] Failed to send confirmation:", err);
    throw err;
  }
}

export async function sendAbandonedCartReminder(data: {
  customerEmail: string;
  recoveryUrl: string;
  subtotal: number;
  itemCount: number;
}): Promise<void> {
  const client = getResend();
  if (!client) return;

  const fromEmail = process.env["FROM_EMAIL"] ?? "orders@primeopp.com";
  const result = await client.emails.send({
    from: `PrimeOpp <${fromEmail}>`,
    to: data.customerEmail,
    subject: "Your PrimeOpp cart is still waiting",
    html: `
      <div style="background:#000;color:#fff;font-family:Arial,sans-serif;padding:32px">
        <h1 style="letter-spacing:.25em;text-transform:uppercase">PRIMEOPP</h1>
        <p style="color:#aaa">You left ${data.itemCount} item${data.itemCount === 1 ? "" : "s"} in your cart.</p>
        <p style="color:#ff0000;font-size:22px;font-weight:900">$${data.subtotal.toFixed(2)}</p>
        <a href="${data.recoveryUrl}" style="display:inline-block;background:#ff0000;color:#fff;padding:14px 22px;text-decoration:none;font-weight:900;text-transform:uppercase;letter-spacing:.15em">Return to cart</a>
      </div>
    `,
  });
  console.log("[Email] Abandoned cart reminder sent:", result.data?.id);
}

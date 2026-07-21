import { Router } from "express";
import { query } from "../lib/db.js";
import { contactMessageSchema, validateBody } from "../lib/validation.js";

const router = Router();

// Public contact-form submission. Writes a local record only — no live email
// send happens here. Support/staff read contact_messages directly (or via a
// future admin view) rather than this triggering a transactional email.
router.post("/contact", validateBody(contactMessageSchema), async (req, res) => {
  const { name, email, order_id, subject, message } = req.body as {
    name: string;
    email: string;
    order_id?: number | null;
    subject?: string | null;
    message: string;
  };

  try {
    await query(
      `INSERT INTO contact_messages (name, email, order_id, subject, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [name, email, order_id ?? null, subject ?? null, message],
    );
    res.status(201).json({ received: true });
  } catch (err) {
    console.error("POST /contact error:", err);
    res.status(500).json({ error: "Failed to submit message" });
  }
});

export default router;

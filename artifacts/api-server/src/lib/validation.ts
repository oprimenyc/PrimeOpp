import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const httpUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "URL must use http or https");

const dataImageSchema = z.string().refine((value) => {
  const match = /^data:(image\/(?:png|jpe?g|gif|webp));base64,([a-zA-Z0-9+/=]+)$/.exec(value);
  if (!match) return false;
  const sizeBytes = Math.floor(match[2].length * 0.75);
  return sizeBytes <= 2 * 1024 * 1024;
}, "Uploads must be png, jpg, gif, or webp data images under 2MB");

const imageReferenceSchema = z.union([httpUrlSchema, dataImageSchema]);

export const productSchema = z.object({
  type: z.enum(["pod", "affiliate"]),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  price: z.number().min(0).nullable().optional(),
  category: z.string().max(120).nullable().optional(),
  thumbnail_url: imageReferenceSchema.nullable().optional(),
  external_link: httpUrlSchema.nullable().optional(),
  stock_level: z.number().int().min(0).nullable().optional(),
  shipping_info: z.string().max(500).nullable().optional(),
  colors: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    price: z.number().min(0),
  })).max(50).optional(),
  sizes: z.array(z.string().trim().min(1).max(20)).max(50).optional(),
  pod_provider: z.enum(["printful", "tapstitch"]).nullable().optional(),
  printful_variant_id: z.string().max(120).nullable().optional(),
  tapstitch_variant_id: z.string().max(120).nullable().optional(),
});

export const checkoutSessionSchema = z.object({
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    title: z.string().min(1).max(200),
    quantity: z.number().int().min(1).max(20),
    size: z.string().max(40),
    color: z.string().max(80),
    price: z.number().min(0),
    pod_provider: z.string().optional(),
    printful_variant_id: z.string().nullable().optional(),
    tapstitch_variant_id: z.string().nullable().optional(),
  })).min(1).max(20),
  cancel_url: httpUrlSchema.optional(),
  discount_code: z.string().trim().max(80).optional(),
});

export const orderStatusSchema = z.object({
  status: z.enum(["pending", "paid", "processing", "fulfilled", "shipped", "delivered", "refunded"]),
});

export const loginSchema = z.object({
  username: z.string().email().optional(),
  email: z.string().email().optional(),
  password: z.string().min(1).max(500),
}).refine((value) => value.email || value.username, "Email is required");

export const passwordResetSchema = z.object({
  email: z.string().email(),
});

export const reviewCreateSchema = z.object({
  customer_email: z.string().email(),
  customer_name: z.string().trim().min(1).max(120),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(10).max(3000),
  photo_url: imageReferenceSchema.nullable().optional(),
});

export const reviewModerationSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]),
});

export const abandonedCartSchema = z.object({
  email: z.string().email().nullable().optional(),
  cart_token: z.string().trim().min(8).max(120),
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    title: z.string().min(1).max(200),
    quantity: z.number().int().min(1).max(20),
    size: z.string().max(40),
    color: z.string().max(80),
    price: z.number().min(0),
    thumbnail_url: imageReferenceSchema.nullable().optional(),
  })).max(50),
  subtotal: z.number().min(0),
});

export const discountQuoteSchema = z.object({
  code: z.string().trim().max(80).optional(),
  email: z.string().email().nullable().optional(),
  subtotal: z.number().min(0),
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    quantity: z.number().int().min(1).max(100),
    price: z.number().min(0),
  })).min(1).max(50),
});

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
      return;
    }
    req.body = parsed.data;
    next();
  };
}

export function validateParams<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_route_parameter", details: parsed.error.flatten() });
      return;
    }
    req.params = parsed.data as Record<string, string>;
    next();
  };
}

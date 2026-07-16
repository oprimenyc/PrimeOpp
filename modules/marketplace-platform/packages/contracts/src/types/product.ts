// Canonical Product model (deal-intelligence-friendly).
import type { Identifier, ISO8601, Money } from './common.js';

export type ProductCondition =
  | 'new'
  | 'new_other'
  | 'new_open_box'
  | 'manufacturer_refurbished'
  | 'seller_refurbished'
  | 'used_like_new'
  | 'used_very_good'
  | 'used_good'
  | 'used_acceptable'
  | 'for_parts'
  | 'vintage'
  | 'collectible';

export interface ProductIdentifier {
  readonly kind: 'UPC' | 'EAN' | 'ISBN' | 'GTIN' | 'MPN' | 'ASIN' | 'brand_sku';
  readonly value: string;
}

export interface ProductImage {
  readonly imageId: Identifier;
  readonly url: string;
  readonly alt?: string;
  readonly width?: number;
  readonly height?: number;
  readonly hash?: string;
}

export interface ProductAttribute {
  readonly namespace: string;
  readonly name: string;
  readonly value: string;
  readonly unit?: string;
  readonly confidence?: number; // 0..1
  readonly source?: 'canonical' | 'inferred' | 'ai_suggested' | 'seller_declared';
}

export interface ProductCategory {
  readonly categoryId: Identifier;
  readonly canonicalName: string;
  readonly path: readonly string[];
  readonly attributes: readonly ProductAttribute[];
}

export interface Product {
  readonly productId: Identifier;
  readonly title: string;
  readonly brand?: string;
  readonly manufacturer?: string;
  readonly model?: string;
  readonly description: string;
  readonly identifiers: readonly ProductIdentifier[];
  readonly attributes: readonly ProductAttribute[];
  readonly categories: readonly ProductCategory[];
  readonly images: readonly ProductImage[];
  readonly condition: ProductCondition;
  readonly msrp?: Money;
  readonly createdAt: ISO8601;
  readonly updatedAt: ISO8601;
}

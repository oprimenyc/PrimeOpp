/**
 * Product image reference. The module does NOT download or validate image
 * bytes by default — it only collects URLs and metadata. Downstream systems
 * are responsible for verifying usage rights and licenses.
 */
export interface ProductImage {
  url: string;
  sourceProviderId: string;
  width?: number;
  height?: number;
  /** Marker for the primary display image. Exactly one image should be primary. */
  isPrimary?: boolean;
  /** Per-image confidence 0.0 - 1.0. */
  confidence?: number;
}

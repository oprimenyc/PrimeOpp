/**
 * Safe deep-merge utility.
 *
 * Defensive against prototype pollution: rejects __proto__, constructor,
 * and prototype keys at every level. Does NOT mutate inputs.
 */

export function safeMerge<T extends Record<string, unknown>>(base: T, ...overrides: Partial<T>[]): T {
  let out: Record<string, unknown>;
  if (Array.isArray(base)) {
    out = [...(base as unknown as unknown[])] as unknown as Record<string, unknown>;
  } else if (isPlainObject(base)) {
    out = { ...(base as Record<string, unknown>) };
  } else {
    out = base as Record<string, unknown>;
  }

  for (const override of overrides) {
    if (!isPlainObject(override)) continue;
    for (const key of Object.keys(override)) {
      if (isUnsafeKey(key)) continue;
      const bv = out[key];
      const ov = (override as Record<string, unknown>)[key];
      if (isPlainObject(bv) && isPlainObject(ov)) {
        out[key] = safeMerge(
          bv as Record<string, unknown>,
          ov as Record<string, unknown>
        );
      } else if (ov !== undefined) {
        out[key] = ov;
      }
    }
  }
  return out as T;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== "object") return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function isUnsafeKey(key: string): boolean {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

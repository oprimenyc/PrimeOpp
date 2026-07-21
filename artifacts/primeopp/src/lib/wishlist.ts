// wishlist.ts — local wishlist (stored in localStorage)
//
// There is no customer account/session layer in this app (checkout is
// guest-only, "accounts" are just an email-keyed loyalty lookup — see
// AccountPage). With nothing server-side to attach a wishlist to, this is an
// honest browser-local fallback, same pattern as the guest cart and the
// "recently viewed" list. It does not sync across devices or browsers.

const WISHLIST_KEY = "primeopp_wishlist";

export function getWishlist(): number[] {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is number => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}

function saveWishlist(ids: number[]): void {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("wishlist-updated"));
}

export function isInWishlist(productId: number): boolean {
  return getWishlist().includes(productId);
}

export function addToWishlist(productId: number): number[] {
  const current = getWishlist();
  if (current.includes(productId)) return current;
  const next = [productId, ...current];
  saveWishlist(next);
  return next;
}

export function removeFromWishlist(productId: number): number[] {
  const next = getWishlist().filter((id) => id !== productId);
  saveWishlist(next);
  return next;
}

export function toggleWishlist(productId: number): { ids: number[]; added: boolean } {
  if (isInWishlist(productId)) {
    return { ids: removeFromWishlist(productId), added: false };
  }
  return { ids: addToWishlist(productId), added: true };
}

/**
 * @primeopp-deal-intelligence/promotion-engine
 *
 * Evaluates promotion types: percentage, fixed, BOGO, buy-more-save-more,
 * category, member, credit-card, gift-card, rebate, loyalty-points,
 * store-cash, clearance, markdown, bundle, free-shipping, first-order,
 * app-only, email-only, regional.
 */
import type { OfferPromotion, PromotionType, Money } from '@primeopp-deal-intelligence/contracts';
import { money, multiply, subtract, compare } from '@primeopp-deal-intelligence/contracts';

export interface PromotionContext {
  basePrice: Money;
  quantity: number;
  isMember?: boolean;
  paymentMethod?: string;
  isFirstOrder?: boolean;
  region?: string;
  channel?: 'web' | 'app' | 'email' | 'in-store';
  category?: string;
  brand?: string;
}

export interface PromotionEvaluation {
  promotion: OfferPromotion;
  applies: boolean;
  effectiveDiscount: Money;
  reasons: string[];
  requiresConfirmation: string[];
}

export function evaluatePromotion(p: OfferPromotion, ctx: PromotionContext): PromotionEvaluation {
  const reasons: string[] = [];
  const requiresConfirmation: string[] = [];
  let applies = true;
  let discount = money(0, ctx.basePrice.currency);

  if (p.minSpend && compare(ctx.basePrice, p.minSpend) < 0) {
    applies = false; reasons.push('minSpend not met');
  }
  if (p.membershipRequired && !ctx.isMember) {
    applies = false; reasons.push('membership required');
  }
  if (p.paymentRequired?.length && (!ctx.paymentMethod || !p.paymentRequired.includes(ctx.paymentMethod))) {
    applies = false; reasons.push('payment method not eligible');
  }
  if (p.categoryRestrictions?.length && (!ctx.category || !p.categoryRestrictions.includes(ctx.category))) {
    applies = false; reasons.push('category not eligible');
  }
  if (p.brandRestrictions?.length && (!ctx.brand || !p.brandRestrictions.includes(ctx.brand))) {
    applies = false; reasons.push('brand not eligible');
  }
  if (p.quantityRestrictions?.min && ctx.quantity < p.quantityRestrictions.min) {
    applies = false; reasons.push('quantity min not met');
  }
  if (p.quantityRestrictions?.max && ctx.quantity > p.quantityRestrictions.max) {
    applies = false; reasons.push('quantity max exceeded');
  }

  switch (p.type) {
    case 'percentage': {
      // Use p.effectiveDiscount if provided; else require discountValue semantics.
      if (p.effectiveDiscount) {
        discount = p.effectiveDiscount;
      } else {
        requiresConfirmation.push('percentage promotion missing explicit effectiveDiscount');
      }
      break;
    }
    case 'fixed': {
      discount = p.effectiveDiscount ?? money(0, ctx.basePrice.currency);
      break;
    }
    case 'BOGO': {
      // Buy one get one: effective discount = floor(quantity/2) * basePrice.
      const free = Math.floor(ctx.quantity / 2);
      discount = multiply(ctx.basePrice, free);
      requiresConfirmation.push('BOGO requires verifying eligible items in cart');
      break;
    }
    case 'buy-more-save-more': {
      // Tiered: every 3rd item 20% off (placeholder rule; deterministic).
      const tiers = Math.floor(ctx.quantity / 3);
      discount = multiply(multiply(ctx.basePrice, 0.2), tiers);
      requiresConfirmation.push('buy-more-save-more tier thresholds need confirmation');
      break;
    }
    case 'member': {
      if (!ctx.isMember) { applies = false; reasons.push('member-only'); }
      discount = p.effectiveDiscount ?? money(0, ctx.basePrice.currency);
      break;
    }
    case 'credit-card': {
      if (!ctx.paymentMethod || !p.paymentRequired?.includes(ctx.paymentMethod)) {
        applies = false; reasons.push('credit-card offer requires eligible card');
      }
      discount = p.effectiveDiscount ?? money(0, ctx.basePrice.currency);
      break;
    }
    case 'gift-card': {
      // Gift card promotions provide future value, not immediate discount.
      discount = money(0, ctx.basePrice.currency);
      requiresConfirmation.push('gift-card promo: value realized post-purchase');
      break;
    }
    case 'rebate': {
      discount = money(0, ctx.basePrice.currency);
      requiresConfirmation.push('rebate requires submission');
      break;
    }
    case 'loyalty-points':
    case 'store-cash': {
      discount = money(0, ctx.basePrice.currency);
      requiresConfirmation.push(`${p.type}: value realized on future purchase`);
      break;
    }
    case 'clearance':
    case 'markdown': {
      discount = p.effectiveDiscount ?? money(0, ctx.basePrice.currency);
      break;
    }
    case 'bundle': {
      discount = p.effectiveDiscount ?? money(0, ctx.basePrice.currency);
      requiresConfirmation.push('bundle: requires all bundled items in cart');
      break;
    }
    case 'free-shipping': {
      discount = money(0, ctx.basePrice.currency);
      requiresConfirmation.push('free-shipping: applied at checkout');
      break;
    }
    case 'first-order': {
      if (!ctx.isFirstOrder) { applies = false; reasons.push('first-order only'); }
      discount = p.effectiveDiscount ?? money(0, ctx.basePrice.currency);
      break;
    }
    case 'app-only': {
      if (ctx.channel !== 'app') { applies = false; reasons.push('app-only'); }
      discount = p.effectiveDiscount ?? money(0, ctx.basePrice.currency);
      break;
    }
    case 'email-only': {
      if (ctx.channel !== 'email') { applies = false; reasons.push('email-only'); }
      discount = p.effectiveDiscount ?? money(0, ctx.basePrice.currency);
      break;
    }
    case 'regional': {
      if (!ctx.region) { applies = false; reasons.push('regional: no region context'); }
      discount = p.effectiveDiscount ?? money(0, ctx.basePrice.currency);
      break;
    }
    case 'category': {
      if (!ctx.category) { applies = false; reasons.push('category: no category context'); }
      discount = p.effectiveDiscount ?? money(0, ctx.basePrice.currency);
      break;
    }
  }

  if (p.maxDiscount && compare(discount, p.maxDiscount) > 0) {
    discount = p.maxDiscount;
    reasons.push('discount capped at maxDiscount');
  }

  return { promotion: p, applies, effectiveDiscount: discount, reasons, requiresConfirmation };
}

export function applyPromotions(promos: OfferPromotion[], ctx: PromotionContext): {
  applied: OfferPromotion[];
  totalDiscount: Money;
  evaluations: PromotionEvaluation[];
} {
  const currency = ctx.basePrice.currency;
  let total = money(0, currency);
  const applied: OfferPromotion[] = [];
  const evaluations: PromotionEvaluation[] = [];
  for (const p of promos) {
    const ev = evaluatePromotion(p, ctx);
    evaluations.push(ev);
    if (ev.applies) {
      applied.push(p);
      total = subtract(total, money(-ev.effectiveDiscount.amountMinor, currency));
    }
  }
  return { applied, totalDiscount: total, evaluations };
}

export const ALL_PROMOTION_TYPES: PromotionType[] = [
  'percentage','fixed','BOGO','buy-more-save-more','category','member',
  'credit-card','gift-card','rebate','loyalty-points','store-cash',
  'clearance','markdown','bundle','free-shipping','first-order',
  'app-only','email-only','regional'
];

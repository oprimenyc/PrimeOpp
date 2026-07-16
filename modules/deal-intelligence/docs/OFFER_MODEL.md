# Canonical Offer Model

`offer-normalization` produces a `RetailOffer` with: prices (base, sale,
member, coupon, rebate, gift card, shipping), availability, promotions,
coupons, rebates, fulfillment, restrictions, expiration, confidence,
source, evidence, and observedAt.

`effectivePrice` precedence: coupon > sale > member > base.

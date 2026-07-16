# Commission Engine

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Policy Kinds

- percentage, fixed, category_fee, seller_tier
- launch_promotion, zero_fee_period, grand_opening
- first_n_sales, volume_tier, verified_seller_discount
- enterprise_contract, affiliate_adjustment, shipping_margin, custom_tenant

## Versioned Policies

- policyId, version, effectiveFrom, effectiveUntil
- Never hardcode launch pricing permanently

## Calculation Output

- policyVersion, effectiveDate, grossAmount, excludedAmounts
- feeBasis, feeRatePercent, fixedFee, discount, promotion
- finalCommission, currency, evidence

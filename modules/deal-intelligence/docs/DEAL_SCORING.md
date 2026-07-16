# Deal Scoring

`deal-scoring` produces a `DealScoreSet` with 8 sub-scores:
consumerValue, resellerOpportunity, affiliateOpportunity, scarcity,
confidence, urgency, contentPotential, overall.

Every score includes explainable factors (key, weight, raw, weighted,
rationale). Bands: EXCEPTIONAL (90+), STRONG (75+), GOOD (60+),
CONDITIONAL (45+), WATCH (30+), WEAK (15+), REJECT (<15),
INSUFFICIENT_DATA (5+ missing fields).

```mermaid
flowchart TD
  A[Offer + Product + History + Resale + Rarity] --> B[Compute factors]
  B --> C[Weighted sum]
  C --> D[Overall score 0-100]
  D --> E{Band}
  E -->|>=90| F[EXCEPTIONAL]
  E -->|>=75| G[STRONG]
  E -->|>=60| H[GOOD]
  E -->|>=45| I[CONDITIONAL]
  E -->|>=30| J[WATCH]
  E -->|>=15| K[WEAK]
  E -->|<15| L[REJECT]
```

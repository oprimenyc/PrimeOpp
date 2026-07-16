# Identifier Classification Rules

## Length-Based Classification

The classifier uses the length and character composition of the cleaned identifier to determine its type.

## Decision Flow

```
Input (cleaned string)
│
├─ 10 chars, matches \d{9}[\dXx] and passes ISBN-10 checksum?
│  └─ YES → ISBN_10 (HIGH confidence)
│  └─ NO, all digits → UNKNOWN (LOW confidence)
│       Alternative: ISBN_10, SKU
│  └─ NO, not all digits → SKU (MEDIUM confidence)
│       Alternative: ISBN_10
│
├─ Not all digits?
│  └─ YES → SKU (HIGH confidence)
│
├─ 8 digits → EAN_8 (HIGH), alternative: GTIN_8
├─ 12 digits → UPC_A (HIGH), alternative: GTIN_12
├─ 13 digits
│  ├─ Starts with 978 or 979 and passes ISBN-13 checksum?
│  │  └─ YES → ISBN_13 (HIGH), alternative: EAN_13, GTIN_13
│  │  └─ NO → EAN_13 (MEDIUM), alternative: ISBN_13, GTIN_13
│  └─ Otherwise → EAN_13 (HIGH), alternative: GTIN_13
├─ 14 digits → GTIN_14 (HIGH)
├─ < 6 digits → UNKNOWN (LOW)
├─ > 14 digits → UNKNOWN (LOW)
└─ 6-7 digits → UNKNOWN (LOW), alternative: SKU
```

## Checksum Algorithms

### GTIN Checksum (UPC-A, EAN-8, EAN-13, GTIN-8/12/13/14)

1. Counting from the LEFT (1-indexed, excluding check digit):
   - Odd total code length (8, 13): odd positions × 1, even positions × 3.
   - Even total code length (12, 14): odd positions × 3, even positions × 1.
2. Check digit = (10 − (sum mod 10)) mod 10.

### ISBN-10 Checksum

1. Weighted sum: digit[i] × (10 − i) for i = 0..8.
2. Add check digit value (X = 10).
3. Valid if total mod 11 == 0.

### ISBN-13 Checksum

Identical to GTIN/EAN-13 checksum.

## Ambiguity Notes

| Scenario | Primary | Alternatives | Why Ambiguous |
|----------|---------|-------------|---------------|
| 8 digits | EAN_8 | GTIN_8 | Structurally identical per GS1 |
| 12 digits | UPC_A | GTIN_12 | Structurally identical per GS1 |
| 13 digits (978/979 prefix) | ISBN_13 | EAN_13, GTIN_13 | All Bookland EANs are valid EAN-13s |
| 13 digits (other prefix) | EAN_13 | GTIN_13 | Structurally identical per GS1 |
| 10 digits, valid checksum | ISBN_10 | — | High confidence due to checksum |
| 10 digits, invalid checksum | UNKNOWN | ISBN_10, SKU | Cannot distinguish from numeric SKU |
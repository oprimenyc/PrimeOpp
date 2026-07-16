# Normalization Rules

This document describes the exact normalization rules applied by the module.

## Identifier Normalization

### Step 1: Trim Whitespace

All leading and trailing whitespace characters (spaces, tabs, newlines) are removed.

- `"  036000291452  "` → `"036000291452"`

### Step 2: Remove Safe Separators

The following characters are removed from the identifier string:

- Space (` `)
- Hyphen (`-`)
- Period/Dot (`.`)

These are considered "safe" because standard barcode representations commonly use them as visual grouping separators, and they carry no semantic meaning in the identifier value.

- `"03600-02914-52"` → `"036000291452"`
- `"590-123 412345.7"` → `"5901234123457"`
- `"978.0.306.40615.7"` → `"9780306406157"`

### Step 3: No Destructive Transformations

The module does NOT:

- Drop leading zeros (a leading zero in UPC-A is semantically significant).
- Pad short identifiers to a target length.
- Convert between formats (e.g., ISBN-10 to ISBN-13).
- Expand compressed formats (e.g., UPC-E to UPC-A).
- Strip check digits.

### Determinism Guarantee

The same raw input string will always produce the same normalized output. This is tested and verified.

## Manual Product Field Normalization

Each string field in `ManualProductData` is:

1. Trimmed of leading/trailing whitespace.
2. Returned as `undefined` if the result is an empty string or whitespace-only.
3. Not otherwise transformed (case is preserved, internal whitespace is preserved).

## Length Limits

| Field | Maximum Length | Action on Exceed |
|-------|---------------|------------------|
| Identifier (after normalization) | 50 characters | Rejected with `EXCEEDS_MAX_LENGTH` |
| Manual product title | 500 characters | Warning issue `EXCEEDS_MAX_LENGTH` |
| Manual product brand | 500 characters | Warning issue `EXCEEDS_MAX_LENGTH` |
| Manual product description | 500 characters | Warning issue `EXCEEDS_MAX_LENGTH` |
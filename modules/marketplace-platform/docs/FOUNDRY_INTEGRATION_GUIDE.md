# Foundry Integration Guide

**Package:** primeopp-marketplace-platform

**Last updated:** 2026-01-01

## Status

Future integration — NOT implemented. Foundry is the sole canonical execution runtime per VERIDIAN rules.

## Approach

When Foundry is available, wrap the publishListing / createOrder / calculateCommission functions as Foundry jobs. The current implementations are pure functions suitable for Foundry execution.

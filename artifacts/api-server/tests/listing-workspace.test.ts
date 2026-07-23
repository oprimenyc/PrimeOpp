import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateListingWorkspace, normalizeSelectedChannels } from "../src/lib/listingWorkspace.js";

describe("low-liability listing workspace generator", () => {
  it("creates one canonical listing package with local channel drafts and exports", () => {
    const workspace = generateListingWorkspace({
      source: "SCAN",
      identifier: "123456789012",
      product: {
        title: "Structured Test Product",
        description: "A local package used for draft generation.",
        category: "test-category",
        condition: "new",
        costBasis: 12,
        targetPrice: 30,
        shippingProfile: "standard",
      },
      selectedChannels: ["general-resale", "craft-market"],
      createExports: true,
    });

    expect(workspace.canonical.source_identifier).toBe("123456789012");
    expect(workspace.canonical.identifier_type).toBe("UPC");
    expect(workspace.canonical.margin).toBe(18);
    expect(workspace.canonical.status).toBe("APPROVAL_REQUIRED");
    expect(workspace.channelDrafts).toHaveLength(2);
    expect(workspace.exports).toHaveLength(2);
    expect(workspace.channelDrafts[0]?.channel_payload.title).toBe(workspace.canonical.title);
  });

  it("keeps provider publishing disabled and never returns fake publish success", () => {
    const workspace = generateListingWorkspace({
      source: "SEARCH",
      identifier: "SKU-LOCAL-1",
      product: { title: "Local Draft" },
      selectedChannels: ["social-commerce"],
      createExports: true,
    });

    expect(workspace.externalPublishEnabled).toBe(false);
    expect(workspace.approvalRequired).toBe(true);
    expect(workspace.liabilityMode).toBe("seller_publishes_on_own_accounts");
    expect(workspace.channelDrafts[0]?.channel_status).toBe("APPROVAL_REQUIRED");
    expect(workspace.channelDrafts[0]?.publish_disabled_reason).toMatch(/Direct publish requires connected account and explicit approval/);
    expect(workspace.exports[0]?.export_payload).toMatchObject({
      exportOnly: true,
      externalProviderMode: "DISABLED",
    });
  });

  it("allows configurable channel keys instead of a fixed-only list", () => {
    expect(normalizeSelectedChannels(["custom channel", "CUSTOM_channel", "custom channel"])).toEqual([
      "custom-channel",
      "custom_channel",
    ]);
  });

  it("keeps manual entry as a fallback source", () => {
    const workspace = generateListingWorkspace({
      source: "MANUAL_FALLBACK",
      identifier: "fallback-code",
      product: {},
      selectedChannels: ["local-pickup"],
      createExports: false,
    });

    expect(workspace.canonical.intake_source).toBe("MANUAL_FALLBACK");
    expect(workspace.exports).toHaveLength(0);
  });
});

describe("low-liability schema and UI guardrails", () => {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

  it("defaults account shells to monitoring-only and publish-authorized false", () => {
    const migration = readFileSync(
      path.join(repoRoot, "lib/db/migrations/0008_low_liability_listing_workspace.sql"),
      "utf8",
    );

    expect(migration).toContain("monitoring_only BOOLEAN NOT NULL DEFAULT TRUE");
    expect(migration).toContain("publish_authorized BOOLEAN NOT NULL DEFAULT FALSE");
    expect(migration).toContain("credential_plaintext_guard BOOLEAN NOT NULL DEFAULT FALSE");
  });

  it("includes the searchable channel picker and account connection shell in the operator UI", () => {
    const page = readFileSync(
      path.join(repoRoot, "artifacts/primeopp/src/pages/listing-workspace.tsx"),
      "utf8",
    );

    expect(page).toContain("Search or add channel");
    expect(page).toContain("Connect Existing Account");
    expect(page).toContain("Manual identifier");
    expect(page).toContain("External publish disabled");
    expect(page).toContain("Product Intake");
    expect(page).toContain("Start Camera Scan");
    expect(page).toContain("unsupported");
    expect(page).toContain("permission_denied");
    expect(page).toContain("decoded");
    expect(page).toContain("BarcodeDetector");
    expect(page).toContain("Identification Result");
    expect(page).toContain("Prefill source");
    expect(page).toContain("OAuth not configured yet. Draft/export mode available.");
    expect(page).toContain("PrimeOpp prepares listing packages and channel drafts");
  });

  it("keeps lookup prefill editable and publishing disabled in the operator UI", () => {
    const page = readFileSync(
      path.join(repoRoot, "artifacts/primeopp/src/pages/listing-workspace.tsx"),
      "utf8",
    );

    expect(page).toContain("Fields were prefilled from real local catalog data.");
    expect(page).toContain("All fields remain editable before draft/export creation.");
    expect(page).toContain("No fake product data was created.");
    expect(page).toContain("Provider calls:</span> NO");
    expect(page).toContain("Provider publish remains disabled.");
  });
});

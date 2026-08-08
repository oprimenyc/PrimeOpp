// IdentityCorrectionPanel — closes the Review Queue's identity dead-end.
//
// A scanned item that was never in PrimeOpp's own catalog reaches the queue
// as NOT_FOUND (a real identifier, no catalog match yet) or AMBIGUOUS (the
// local classifier itself isn't sure what format the code even is). Before
// this panel, the only way to attach a real product identity to that item
// was to leave the sourcing session entirely, re-enter the same identifier
// on the separate Listing Workspace page, and save a mapping there --
// with no link back to the item that started the trip.
//
// This reuses the EXISTING identifier-mapping architecture verbatim:
//   1. createProduct() (or an existing product ID the operator already
//      knows) -- the same product record Listing Workspace/admin use.
//   2. saveProductIdentifierMapping() -- the same POST /product-identifiers
//      endpoint Listing Workspace already calls, so the next time this
//      exact barcode is scanned (this session or any other), it resolves
//      automatically. No second identity system.
//   3. updateSourcingItem() with matchedProductId -- links THIS item to
//      that product immediately, so evidence/decision keep working without
//      leaving the page or recreating the item.
//
// Kept intentionally minimal: title is the only required field. Everything
// else is optional, matching "the minimum information necessary to
// establish a useful product identity."

import { useState } from "react";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { createProduct, saveProductIdentifierMapping, updateSourcingItem, type SourcingSessionItem } from "@/lib/api";

function mappingTypeFor(identifierType: string | null): "UPC" | "EAN" | "GTIN" | "SKU" | "STYLE_CODE" | "ISBN" | "OTHER" {
  if (identifierType === "UPC_A") return "UPC";
  if (identifierType === "EAN_13") return "EAN";
  if (identifierType === "GTIN") return "GTIN";
  if (identifierType === "SKU") return "SKU";
  if (identifierType === "STYLE_CODE") return "STYLE_CODE";
  if (identifierType === "ISBN") return "ISBN";
  return "OTHER";
}

export function IdentityCorrectionPanel({ item, onSaved, onCancel }: {
  item: SourcingSessionItem;
  onSaved: (updated: SourcingSessionItem) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(item.title ?? "");
  const [category, setCategory] = useState(item.category ?? "");
  const [existingProductId, setExistingProductId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const identifierValue = item.normalizedIdentifier ?? item.rawQuery;
  const canSave = title.trim().length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      let productId: number;
      if (existingProductId.trim()) {
        const parsed = Number(existingProductId.trim());
        if (!Number.isInteger(parsed) || parsed <= 0) {
          throw new Error("Existing Product ID must be a positive whole number.");
        }
        productId = parsed;
      } else {
        const created = await createProduct({
          type: "affiliate",
          title: title.trim(),
          category: category.trim() || null,
        });
        productId = created.id;
      }

      // Save the reusable mapping FIRST -- a human just verified this
      // identifier really is this product, which is exactly HIGH confidence,
      // not a guess. Future scans of the same barcode resolve automatically
      // from here on, in this session or any other.
      await saveProductIdentifierMapping({
        productId,
        identifier: identifierValue,
        identifierType: mappingTypeFor(item.identifierType),
        source: "MANUAL",
        confidence: "HIGH",
        isPrimary: true,
      });

      const updated = await updateSourcingItem(item.sessionId, item.id, {
        matchedProductId: productId,
        title: title.trim(),
        category: category.trim() || null,
      });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save corrected identity.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full border-t border-zinc-800 pt-2 mt-1 space-y-2">
      <p className="text-zinc-600 text-[10px] normal-case">
        Correcting this links <span className="text-zinc-400">{item.identifierType ?? "this identifier"}: {identifierValue}</span> to a real
        product -- the same identifier-mapping used in Listing Workspace, so this barcode resolves automatically next time too.
      </p>

      {error && (
        <p className="border-l-4 border-red-600 bg-black px-2 py-1.5 text-red-400 text-[11px] normal-case flex items-start gap-1.5">
          <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" /> {error}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[180px]">
          <label className="text-[9px] text-zinc-600 uppercase block">Product title *</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Nike Air Max 95"
            className="w-full bg-black border border-zinc-800 px-2 py-1.5 text-xs normal-case focus:border-red-600 outline-none"
          />
        </div>
        <div className="w-32">
          <label className="text-[9px] text-zinc-600 uppercase block">Category (optional)</label>
          <input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Footwear"
            className="w-full bg-black border border-zinc-800 px-2 py-1.5 text-xs normal-case focus:border-red-600 outline-none"
          />
        </div>
        <div className="w-36">
          <label className="text-[9px] text-zinc-600 uppercase block">or existing Product ID</label>
          <input
            value={existingProductId}
            onChange={(event) => setExistingProductId(event.target.value)}
            placeholder="if already in catalog"
            type="number"
            min="1"
            step="1"
            className="w-full bg-black border border-zinc-800 px-2 py-1.5 text-xs normal-case focus:border-red-600 outline-none"
          />
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={!canSave}
          className="bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-[9px] font-black uppercase px-3 py-1.5 flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save Identity
        </button>
        <button onClick={onCancel} className="border border-zinc-700 text-zinc-400 text-[9px] font-black uppercase px-3 py-1.5">
          Cancel
        </button>
      </div>
    </div>
  );
}

// BulkEvidenceImportPanel — CSV/spreadsheet bulk market-evidence import.
//
// This is an ingestion utility, not a spreadsheet application: paste or
// upload a CSV (a Helium10/Keepa/SellerAmp export, or anything else), map
// its columns to the same fields the single-row "+ Evidence" form already
// uses, preview + validate every row, then submit. It reuses
// POST /api/pricing/observations/manual verbatim — the exact same batch
// endpoint and schema the Review Queue's inline evidence entry uses — so
// imported rows land in platform_price_observations and flow straight into
// the existing evidence summary / BUY-PASS-WATCH decision engine with no
// separate code path.
//
// PrimeOpp never needs to know which tool a CSV came from. There is no
// provider-specific parsing here — only column-name matching to *suggest* a
// mapping, which the operator always reviews before anything is validated
// or sent. Nothing is ever fabricated: a row missing a required value is
// flagged invalid, never silently defaulted or dropped.

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, FileText, Loader2, Upload, X } from "lucide-react";
import { submitManualPriceObservations, type ManualPriceObservationInput } from "@/lib/api";
import {
  chunk,
  FIELD_DEFS,
  guessColumnMapping,
  MAX_OBSERVATIONS_PER_BATCH,
  toParsedCsv,
  validateRows,
  type ColumnMapping,
  type FieldKey,
  type ParsedCsv,
  type RowValidationResult,
} from "@/lib/csvImport";

type RowOutcome = { status: "pending" | "success" | "failed"; error?: string };

export function BulkEvidenceImportPanel({ onImported }: { onImported?: () => void }) {
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [outcomes, setOutcomes] = useState<Record<number, RowOutcome> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function parseNow(text: string, headerFlag: boolean) {
    const result = toParsedCsv(text, headerFlag);
    if (result.rows.length === 0) {
      setError("No data rows found. Check that the pasted/uploaded text is CSV and (if it has a header row) that the box below is checked correctly.");
      setParsed(null);
      setMapping({});
      return;
    }
    setError("");
    setParsed(result);
    setMapping(guessColumnMapping(result.headers));
    setOutcomes(null);
  }

  function handleFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setRawText(text);
      parseNow(text, hasHeader);
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  }

  function updateMapping(key: FieldKey, patch: Partial<{ column: number | null; fixed: string }>) {
    setMapping((current) => ({
      ...current,
      [key]: { column: current[key]?.column ?? null, fixed: current[key]?.fixed ?? "", ...patch },
    }));
    setOutcomes(null);
  }

  const results: RowValidationResult[] = useMemo(() => {
    if (!parsed) return [];
    return validateRows(parsed.rows, mapping);
  }, [parsed, mapping]);

  const validResults = useMemo(() => results.filter((r) => r.observation !== null), [results]);
  const invalidCount = results.length - validResults.length;

  async function handleSubmit() {
    if (validResults.length === 0) return;
    setSubmitting(true);
    setError("");
    const nextOutcomes: Record<number, RowOutcome> = {};
    for (const r of validResults) nextOutcomes[r.rowIndex] = { status: "pending" };
    setOutcomes({ ...nextOutcomes });

    const batches = chunk(validResults, MAX_OBSERVATIONS_PER_BATCH);
    for (const batch of batches) {
      try {
        await submitManualPriceObservations(batch.map((r) => r.observation as ManualPriceObservationInput));
        for (const r of batch) nextOutcomes[r.rowIndex] = { status: "success" };
      } catch (batchErr) {
        // The batch endpoint validates/inserts as a unit -- one bad row (or a
        // transient DB error) fails the whole call. Fall back to submitting
        // this batch's rows one at a time so we report a real, specific
        // outcome per row instead of guessing which one(s) failed.
        const batchMessage = batchErr instanceof Error ? batchErr.message : "Import failed";
        for (const r of batch) {
          try {
            await submitManualPriceObservations([r.observation as ManualPriceObservationInput]);
            nextOutcomes[r.rowIndex] = { status: "success" };
          } catch (rowErr) {
            nextOutcomes[r.rowIndex] = { status: "failed", error: rowErr instanceof Error ? rowErr.message : batchMessage };
          }
        }
      }
      setOutcomes({ ...nextOutcomes });
    }
    setSubmitting(false);
    onImported?.();
  }

  function reset() {
    setRawText("");
    setFileName(null);
    setParsed(null);
    setMapping({});
    setOutcomes(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const successCount = outcomes ? Object.values(outcomes).filter((o) => o.status === "success").length : 0;
  const failedCount = outcomes ? Object.values(outcomes).filter((o) => o.status === "failed").length : 0;
  const doneSubmitting = outcomes !== null && !submitting;

  return (
    <div className="border border-zinc-900 bg-zinc-950 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[10px] font-black tracking-[0.35em] uppercase text-zinc-500">Import Evidence (CSV)</h2>
        {parsed && (
          <button onClick={reset} className="text-zinc-500 hover:text-white text-[10px] uppercase tracking-widest flex items-center gap-1">
            <X className="w-3 h-3" /> Start over
          </button>
        )}
      </div>

      <p className="text-zinc-500 text-[11px] normal-case mb-3">
        Paste or upload a spreadsheet export of real prices you've observed (Helium10, Keepa, SellerAmp, a manual
        tracking sheet -- PrimeOpp doesn't need to know which). Map its columns below, review every row, then import.
        Nothing here is scraped and nothing is fabricated: a row with a missing or unrecognized value is flagged, not guessed.
      </p>

      {error && (
        <p className="border-l-4 border-red-600 bg-black px-3 py-2 text-red-400 text-xs normal-case mb-3 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> {error}
        </p>
      )}

      {!parsed && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="border border-zinc-700 text-[10px] font-black uppercase tracking-widest px-3 py-2 hover:bg-white hover:text-black transition-colors flex items-center gap-2"
            >
              <Upload className="w-3 h-3" /> Upload CSV
            </button>
            {fileName && <span className="text-zinc-500 text-[11px] normal-case flex items-center gap-1"><FileText className="w-3 h-3" /> {fileName}</span>}
            <input ref={fileInputRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handleFile(file);
            }} />
          </div>

          <div>
            <label className="text-[10px] tracking-widest uppercase text-zinc-500 block mb-1">...or paste CSV text</label>
            <textarea
              value={rawText}
              onChange={(event) => { setFileName(null); setRawText(event.target.value); }}
              placeholder={"platform,listing_type,price,identifier\nebay,SOLD,59.99,036000291452\nstockx,ACTIVE,75.00,036000291452"}
              rows={6}
              className="w-full bg-black border border-zinc-800 px-3 py-2 text-xs font-mono focus:border-red-600 outline-none normal-case"
            />
          </div>

          <label className="flex items-center gap-2 text-[11px] text-zinc-500 normal-case">
            <input type="checkbox" checked={hasHeader} onChange={(event) => setHasHeader(event.target.checked)} className="w-3.5 h-3.5 accent-red-600" />
            First row is a header row
          </label>

          <button
            onClick={() => parseNow(rawText, hasHeader)}
            disabled={!rawText.trim()}
            className="bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5"
          >
            Parse &amp; Map Columns
          </button>
        </div>
      )}

      {parsed && (
        <div className="space-y-4">
          {/* Column mapping */}
          <div>
            <h3 className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">
              Map columns ({parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"} found)
            </h3>
            <div className="border border-zinc-800 divide-y divide-zinc-800">
              {FIELD_DEFS.map((def) => {
                const current = mapping[def.key] ?? { column: null, fixed: "" };
                return (
                  <div key={def.key} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <div className="w-40 flex-shrink-0">
                      <span className="text-xs font-bold uppercase">{def.label}</span>
                      {def.required && <span className="text-red-500 ml-1">*</span>}
                      <p className="text-zinc-600 text-[10px] normal-case leading-tight">{def.hint}</p>
                    </div>
                    <select
                      value={current.column === null ? "" : String(current.column)}
                      onChange={(event) => updateMapping(def.key, { column: event.target.value === "" ? null : Number(event.target.value) })}
                      className="bg-black border border-zinc-800 px-2 py-1.5 text-xs"
                    >
                      <option value="">-- not in CSV --</option>
                      {parsed.headers.map((header, idx) => (
                        <option key={idx} value={idx}>{header || `Column ${idx + 1}`}</option>
                      ))}
                    </select>
                    {def.allowFixed && current.column === null && (
                      <input
                        value={current.fixed}
                        onChange={(event) => updateMapping(def.key, { fixed: event.target.value })}
                        placeholder="apply this value to every row (optional)"
                        className="flex-1 min-w-[160px] bg-black border border-zinc-800 px-2 py-1.5 text-xs normal-case"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Preview</h3>
              <span className="text-emerald-400 text-[10px] uppercase tracking-widest flex items-center gap-1"><Check className="w-3 h-3" /> {validResults.length} valid</span>
              {invalidCount > 0 && (
                <span className="text-red-400 text-[10px] uppercase tracking-widest flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {invalidCount} invalid</span>
              )}
            </div>
            <div className="border border-zinc-800 max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-zinc-900">
                  <tr className="text-left text-[9px] uppercase tracking-widest text-zinc-500">
                    <th className="px-2 py-1.5 w-6">#</th>
                    <th className="px-2 py-1.5">Platform</th>
                    <th className="px-2 py-1.5">Type</th>
                    <th className="px-2 py-1.5">Price</th>
                    <th className="px-2 py-1.5">Identifier / Product</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const outcome = outcomes?.[r.rowIndex];
                    return (
                      <tr key={r.rowIndex} className={`border-t border-zinc-900 ${r.observation === null ? "bg-red-950/20" : ""}`}>
                        <td className="px-2 py-1.5 text-zinc-600">{r.rowIndex + 1}</td>
                        <td className="px-2 py-1.5 normal-case">{r.observation?.platform ?? "--"}</td>
                        <td className="px-2 py-1.5 normal-case">{r.observation?.listingType ?? "--"}</td>
                        <td className="px-2 py-1.5 normal-case">{r.observation ? `$${r.observation.price.toFixed(2)}` : "--"}</td>
                        <td className="px-2 py-1.5 normal-case">{r.observation?.normalizedIdentifier ?? (r.observation?.productId ? `product #${r.observation.productId}` : "--")}</td>
                        <td className="px-2 py-1.5 normal-case">
                          {outcome ? (
                            outcome.status === "pending" ? (
                              <span className="text-zinc-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Submitting</span>
                            ) : outcome.status === "success" ? (
                              <span className="text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> Imported</span>
                            ) : (
                              <span className="text-red-400 flex items-center gap-1" title={outcome.error}><AlertTriangle className="w-3 h-3" /> {outcome.error ?? "Rejected"}</span>
                            )
                          ) : r.observation === null ? (
                            <span className="text-red-400">{r.errors.join(" ")}</span>
                          ) : (
                            <span className="text-zinc-600">Ready</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submit + results summary */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting || validResults.length === 0}
              className="bg-red-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2.5 flex items-center gap-2"
            >
              {submitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              Import {validResults.length} row{validResults.length === 1 ? "" : "s"}
            </button>
            {invalidCount > 0 && (
              <span className="text-zinc-500 text-[11px] normal-case">{invalidCount} invalid row{invalidCount === 1 ? "" : "s"} will be skipped -- fix them in your CSV and re-import if needed.</span>
            )}
          </div>

          {doneSubmitting && (
            <p className="text-zinc-300 text-sm normal-case border-l-4 border-red-600 bg-black px-3 py-2">
              {successCount} row{successCount === 1 ? "" : "s"} imported.
              {failedCount > 0 ? ` ${failedCount} rejected -- see the Status column above for why.` : " All submitted rows succeeded."}
              {" "}Imported evidence is already live in each item's evidence summary and decision below.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

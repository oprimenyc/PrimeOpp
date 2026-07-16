// Example D — Thrift Item Evaluation workflow.
import { createSdk } from '@primeopp/sdk';
import { LocalTestOCRAdapter, createOcrRequest, extractOcrFields } from '@primeopp/ocr-contracts';

async function main() {
  console.log('=== Workflow D: Thrift Item Evaluation ===');
  const sdk = createSdk({ tenantId: 'demo' });

  // Simulate OCR on a thrift-store label
  const ocrAdapter = new LocalTestOCRAdapter();
  ocrAdapter.register('thrift-label-img', { BRAND: ' Pendleton ', TITLE: 'Wool Shirt', CONDITION_NOTE: 'Worn' });
  const ocrResult = await ocrAdapter.extract(createOcrRequest('thrift-label-img', { tenantId: 'demo' }));
  const fields = extractOcrFields(ocrResult, { normalize: true, minConfidence: 0.5 });
  console.log(`OCR fields: ${JSON.stringify(fields)}`);

  // Resolve identity (will likely return REQUIRES_HUMAN_REVIEW or NO_MATCH)
  const identity = await sdk.resolveProductIdentity({ text: fields.TITLE ?? '', brand: fields.BRAND });
  console.log(`Identity state: ${identity.state} — ${identity.recommendedNextAction}`);

  // Condition assessment with limited data
  const cond = sdk.assessCondition({
    category: 'APPAREL',
    observedDefects: ['fading'],
    missingAccessories: [],
    cosmeticStatus: 'WORN',
    odorSmokeExposure: 'NONE',
    photoRefs: ['img1', 'img2'],
    evidenceRefs: [],
    scope: { tenantId: 'demo' },
  });
  console.log(`Condition: ${cond.assessment.condition} (confidence ${cond.confidence.toFixed(2)})`);
  console.log(`Warnings: ${cond.warnings.join('; ')}`);
}

main().catch(console.error);

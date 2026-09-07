import assert from "node:assert/strict";
import { test } from "node:test";
import { auditAiResponses, auditOcrFacts } from "../src/brands/balabala/ai-audit.js";

test("accepts only active enum AI candidates with evidence and confidence at least 0.7", () => {
  const result = auditAiResponses({ fields: [
    { fieldId: "style", fieldName: "风格", active: true, options: ["运动", "休闲"] },
    { fieldId: "price", fieldName: "价格", active: true, options: ["100"] },
  ] }, [
    { fieldId: "style", value: "运动", confidence: 0.9, evidence: ["flat-image"] },
    { fieldId: "style", value: "休闲", confidence: 0.69, evidence: ["flat-image"] },
    { fieldId: "price", value: "100", confidence: 0.9, evidence: ["flat-image"] },
  ]);
  assert.deepEqual(result.accepted.map((candidate) => candidate.fieldId), ["style"]);
  assert.equal(result.rejected.length, 2);
});

test("OCR only accepts traceable textual facts and does not invent missing image evidence", () => {
  const result = auditOcrFacts([{ path: "/tmp/tag.jpg", sha256: "tag", role: "hangtag" }], [
    { fieldName: "执行标准", value: "GB 31701", imageSha256: "tag", confidence: 0.95, text: "执行标准 GB 31701" },
    { fieldName: "执行标准", value: "GB 31701", imageSha256: "missing", confidence: 0.95, text: "执行标准 GB 31701" },
  ]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected.length, 1);
});

test("OCR facts are constrained to the current DeepDraw template when one is available", () => {
  const result = auditOcrFacts([{ path: "/tmp/tag.pdf", sha256: "tag", role: "hangtag", mimeType: "application/pdf" }], [
    { fieldId: "standard", fieldName: "执行标准", value: "Q/BALABALA 103-2021", imageSha256: "tag", confidence: 0.95, text: "执行标准：Q/BALABALA 103-2021" },
    { fieldName: "任意伪造字段", value: "x", imageSha256: "tag", confidence: 0.95, text: "x" },
  ], [{ fieldId: "standard", fieldName: "执行标准" }]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected[0]?.reason, "field_not_in_current_template");
});

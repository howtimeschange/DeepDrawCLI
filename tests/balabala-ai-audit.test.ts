import assert from "node:assert/strict";
import { test } from "node:test";
import { auditAiResponses, auditOcrFacts, buildLocalVisionReviewPlan } from "../src/brands/balabala/ai-audit.js";

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

test("local vision review selects at most four safe images and only unresolved enum candidates", () => {
  const plan = buildLocalVisionReviewPlan([
    { path: "/tmp/wash.jpg", sha256: "wash", role: "washlabel", mimeType: "image/jpeg", bytes: 10 },
    { path: "/tmp/flat.png", sha256: "flat", role: "flat_image", mimeType: "image/png", bytes: 10 },
    { path: "/tmp/reference.webp", sha256: "reference", role: "reference", mimeType: "image/webp", bytes: 10 },
    { path: "/tmp/tag.jpg", sha256: "tag", role: "hangtag", mimeType: "image/jpeg", bytes: 10 },
    { path: "/tmp/large.jpg", sha256: "large", role: "main_image", mimeType: "image/jpeg", bytes: 5 * 1024 * 1024 },
  ], [
    { fieldId: "style", fieldName: "风格", validationStatus: "missing", options: ["运动", "休闲"] },
    { fieldId: "price", fieldName: "价格", validationStatus: "missing", options: ["100"] },
    { fieldId: "done", fieldName: "适用季节", validationStatus: "valid", options: ["春季"] },
  ]);
  assert.deepEqual((plan.images as Array<Record<string, unknown>>).map((image) => image.sha256), ["flat", "reference", "tag", "wash"]);
  assert.deepEqual((plan.candidates as Array<Record<string, unknown>>).map((field) => field.fieldId), ["style"]);
});

test("AI suggestions tied to a vision plan must cite an included image", () => {
  const result = auditAiResponses({ images: [{ sha256: "flat" }], fields: [{ fieldId: "style", fieldName: "风格", active: true, options: ["运动"] }] }, [
    { fieldId: "style", value: "运动", confidence: 0.9, evidence: ["鞋面网布"], imageSha256: "other" },
    { fieldId: "style", value: "运动", confidence: 0.9, evidence: ["鞋面网布"], imageSha256: "flat" },
  ]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected[0]?.reason, "image_evidence_not_in_vision_plan");
});

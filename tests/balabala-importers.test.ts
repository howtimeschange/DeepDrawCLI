import assert from "node:assert/strict";
import { test } from "node:test";
import { physicalSheetRows, selectBalabalaRows } from "../src/brands/balabala/importers.js";

test("reads physical cells beyond a false A1 worksheet dimension", () => {
  const rows = physicalSheetRows({
    "!ref": "A1",
    A1: { w: "款号" }, B1: { w: "款色" },
    A173: { w: "204426140121" }, B173: { w: "20442614012100414" },
  });
  assert.deepEqual(rows, [
    { row: 1, values: { "款号": "款号", "款色": "款色" } },
    { row: 173, values: { "款号": "204426140121", "款色": "20442614012100414" } },
  ]);
});

test("selects a formal spu and its SKC rows without accepting a prefix collision", () => {
  const rows = [
    { row: 2, values: { "款号": "204426140121", "款色": "20442614012100414" } },
    { row: 3, values: { "款号": "2044261401219", "款色": "204426140121900414" } },
  ];
  assert.deepEqual(selectBalabalaRows(rows, "204426140121", ["款号"], ["款色"]), [rows[0]]);
});

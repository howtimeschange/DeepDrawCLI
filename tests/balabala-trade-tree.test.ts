import assert from "node:assert/strict";
import { test } from "node:test";
import { flattenTradeLeaves } from "../src/cli/run.js";

test("flattens the nested merchant trade tree to leaf candidates with an inherited path", () => {
  const leaves = flattenTradeLeaves([
    {
      id: 5,
      name: "童鞋/婴儿鞋/亲子鞋",
      children: [
        {
          id: 546,
          name: "运动鞋",
          children: [
            { id: 547, name: "儿童运动鞋", tradePath: "儿童运动鞋", sites: ["Alibaba"] },
          ],
        },
      ],
    },
  ]);

  assert.equal(leaves.length, 1);
  assert.equal(leaves[0].id, 547);
  assert.equal(leaves[0].tradePath, "童鞋/婴儿鞋/亲子鞋>>运动鞋>>儿童运动鞋");
  assert.equal("children" in leaves[0], false);
});

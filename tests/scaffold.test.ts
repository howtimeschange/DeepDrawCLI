import assert from "node:assert/strict";
import { test } from "node:test";
import { runCli } from "../src/cli/run.js";

test("deepdraw --help exposes the CLI name and core commands", async () => {
  const result = await runCli(["--help"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /deepdraw/);
  assert.match(result.stdout, /call <api-name>/);
  assert.match(result.stdout, /auth/);
  assert.equal(result.stderr, "");
});

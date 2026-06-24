import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runCli } from "../src/cli/run.js";

test("AGENTS.md requires approval before write and paid calls", () => {
  const text = readFileSync("AGENTS.md", "utf8");
  assert.match(text, /deepdraw call/);
  assert.match(text, /--plan/);
  assert.match(text, /--yes/);
  assert.match(text, /approval_required/);
  assert.doesNotMatch(text, /appSecret=.*[a-z0-9]{8}/i);
});

test("README documents cross-platform auth login", () => {
  const text = readFileSync("README.md", "utf8");
  assert.match(text, /deepdraw auth login/);
  assert.match(text, /deepdraw auth login --stdin-json/);
  assert.match(text, /Environment variables take priority/);
  assert.match(text, /%APPDATA%\\DeepDrawCli\\config\.json/);
  assert.match(text, /credentials\.json/);
});

test("README does not document nonexistent execute command", () => {
  const text = readFileSync("README.md", "utf8");
  assert.doesNotMatch(text, /deepdraw execute PLAN_ID --yes/);
});

test("README auth login example reaches implemented stdin-json branch", async () => {
  const result = await runCli(["auth", "login", "--stdin-json"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Invalid JSON from stdin/);
  assert.doesNotMatch(result.stderr, /Unknown command|Unknown auth login option/);
});

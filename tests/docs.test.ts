import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runCli } from "../src/cli/run.js";
import { apiRegistry } from "../src/core/api-registry.js";

test("AGENTS.md requires approval before write and paid calls", () => {
  const text = readFileSync("AGENTS.md", "utf8");
  assert.match(text, /deepdraw call/);
  assert.match(text, /--plan/);
  assert.match(text, /--yes/);
  assert.match(text, /approval_required/);
  assert.doesNotMatch(text, /appSecret=.*[a-z0-9]{8}/i);
});

test("AGENTS.md documents Chinese agent calling workflows", () => {
  const text = readFileSync("AGENTS.md", "utf8");
  assert.match(text, /深绘 CLI Agent 调用指南/);
  assert.match(text, /只读调用/);
  assert.match(text, /写入调用/);
  assert.match(text, /JSON 输入/);
  assert.match(text, /授权流程/);
  assert.match(text, /错误处理/);
  assert.match(text, /Windows\/macOS 配置检查/);
  assert.match(text, /deepdraw call dp\.colors\.get --dry-run/);
  assert.match(text, /deepdraw call dp\.product\.create --execute --plan/);
  assert.match(text, /--json-file product\.json/);
  assert.match(text, /deepdraw config doctor --dry-run/);
  assert.match(text, /%APPDATA%\\DeepDrawCli\\config\.json/);
});

test("AGENTS.md lists every registered API with calling metadata", () => {
  const text = readFileSync("AGENTS.md", "utf8");
  assert.match(text, /## 接口目录与调用方法/);

  for (const group of ["merchant", "trade", "product", "image", "common"]) {
    assert.match(text, new RegExp(`### ${group}`));
  }

  for (const api of apiRegistry) {
    assert.match(text, new RegExp(`\\| \`${api.apiName.replace(/\./g, "\\.")}\` \\|`), `${api.apiName} should be listed`);
    assert.match(text, new RegExp(`\\| \`${api.transport}\` \\|`), `${api.apiName} transport should be listed`);
    assert.match(text, new RegExp(`\\| \`${api.riskLevel}\` \\|`), `${api.apiName} risk should be listed`);
    assert.match(text, new RegExp(escapeRegExp(api.callSyntax)), `${api.apiName} callSyntax should be listed`);
    if (api.semanticCommand) {
      assert.match(text, new RegExp(escapeRegExp(api.semanticCommand)), `${api.apiName} semantic command should be listed`);
    }
  }
});

test("README documents cross-platform auth login", () => {
  const text = readFileSync("README.md", "utf8");
  assert.match(text, /deepdraw auth login/);
  assert.match(text, /deepdraw auth login --stdin-json/);
  assert.match(text, /环境变量优先/);
  assert.match(text, /%APPDATA%\\DeepDrawCli\\config\.json/);
  assert.match(text, /credentials\.json/);
});

test("README documents bundled DeepDraw SDK jars and runtime dependency jars", () => {
  const text = readFileSync("README.md", "utf8");
  assert.match(text, /vendor\/deepdraw-sdk/);
  assert.match(text, /dop-sdk-1\.6\.0\.jar/);
  assert.match(text, /sdk-core-java-1\.1\.0\.jar/);
  assert.match(text, /vendor\/deepdraw-sdk\/lib/);
  assert.match(text, /Java SDK 运行依赖 jar/);
  assert.match(text, /无需 Maven 下载/);
  assert.match(text, /Windows/);
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

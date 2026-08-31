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

test("reference tracks the 2026-08-27 PDF and SDK 1.6.24 contract", () => {
  const text = readFileSync("docs/reference/deepdraw-openapi.md", "utf8");
  assert.match(text, /深绘开放平台API接口文档20260827\.pdf/);
  assert.match(text, /PDF 页数: 96/);
  assert.match(text, /dop-sdk-1\.6\.24\.jar/);
  assert.match(text, /1\.6\.23/);
  assert.match(text, /1\.6\.24/);
  for (const field of [
    "dp.product.sku.color.incremental.update",
    "tags",
    "detailPageSite",
    "remark",
    "complete",
    "videos",
    "active",
    "templateWidth",
    "templateSites",
    "暂不支持的特殊格式字段",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(field)), `${field} should be documented`);
  }
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
  assert.match(text, /10494/);
  assert.match(text, /访问频率过高/);
  assert.match(text, /deepdraw call dp\.colors\.get --dry-run/);
  assert.match(text, /deepdraw call dp\.product\.create --execute --plan/);
  assert.match(text, /deepdraw product content --product-code 208326105214 --summary --assets --dry-run/);
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
  assert.match(text, /10494/);
  assert.match(text, /串行队列/);
  assert.match(text, /deepdraw product content --product-code 208326105214 --summary --assets --execute/);
});

test("README documents bundled DeepDraw SDK jars and runtime dependency jars", () => {
  const text = readFileSync("README.md", "utf8");
  assert.match(text, /vendor\/deepdraw-sdk/);
  assert.match(text, /dop-sdk-1\.6\.24\.jar/);
  assert.match(text, /sdk-core-java-1\.1\.0\.jar/);
  assert.match(text, /vendor\/deepdraw-sdk\/lib/);
  assert.match(text, /Java SDK 运行依赖 jar/);
  assert.match(text, /无需 Maven 下载/);
  assert.match(text, /Windows/);
  assert.match(text, /dp\.product\.sku\.color\.incremental\.update/);
  assert.match(text, /dop-sdk-1\.6\.24\.jar/);
  assert.match(text, /1cd9f7f37a76a16e8a2e102b0e78b19470319d743d66a5af93ab58bb87fb2ed8/);
  assert.match(text, /tags/);
  assert.match(text, /detailPageSite/);
  assert.match(text, /templateWidth/);
  assert.match(text, /templateSites/);
  assert.match(text, /active/);
  assert.match(text, /videos/);
  assert.match(text, /不支持/);
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

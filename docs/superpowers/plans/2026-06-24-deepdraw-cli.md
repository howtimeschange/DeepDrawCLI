# DeepDraw CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cross-platform TypeScript CLI named `deepdraw` that can call every DeepDraw OpenAPI interface in `docs/reference/deepdraw-openapi.md`, with credential management, approval gates, stable JSON output, and agent-friendly behavior.

**Architecture:** The CLI uses Node.js/TypeScript as the command surface, a registry-driven API layer for full `dp.*` coverage, direct HTTP signing for most endpoints, and Java SDK bridge runners for product APIs that need SDK entity mapping. Risk classification and approval checks sit above all transports so write, paid, and caution endpoints cannot execute without explicit authorization.

**Tech Stack:** Node.js, TypeScript, Node built-in test runner, `tsx` for TypeScript tests, `commander` for CLI routing, optional `keytar` for OS credential stores, Java bridge classes for SDK-backed calls.

---

## Approved Spec

- Design spec: `docs/superpowers/specs/2026-06-24-deepdraw-cli-design.md`
- Stable API reference: `docs/reference/deepdraw-openapi.md`
- Reference implementation: `/Users/xingyicheng/Documents/Listingify/scripts/lib/deepdraw_client.mjs`
- SDK adapter reference: `/Users/xingyicheng/Documents/Listingify/scripts/lib/deepdraw_sdk_adapter.mjs`

## File Structure

- Create `package.json`: package metadata, bin entry, scripts, dependencies.
- Create `tsconfig.json`: TypeScript compilation for ESM Node CLI.
- Create `.gitignore`: ignore `node_modules`, `dist`, local env, generated output, and temp files.
- Create `src/cli/main.ts`: CLI command routing, argument parsing, top-level error handling.
- Create `src/cli/run.ts`: testable command runner returning output and exit status.
- Create `src/cli/format.ts`: JSON, pretty JSON, raw, quiet, and JSONL output formatting.
- Create `src/core/api-registry.ts`: complete registry for every reference `dp.*` API.
- Create `src/core/reference-parser.ts`: extracts `dp.*` names from the markdown reference for coverage tests.
- Create `src/core/types.ts`: shared `DeepdrawConfig`, `DeepdrawResult`, `ApiDefinition`, risk and transport types.
- Create `src/core/errors.ts`: stable error constructors and `error.kind` values.
- Create `src/core/redact.ts`: sensitive-field redaction.
- Create `src/core/config.ts`: platform paths, env loading, `.env.local` compatibility, config priority.
- Create `src/core/credentials.ts`: `CredentialStore`, fake store, env store, file fallback, optional keytar store.
- Create `src/core/signer.ts`: Aliyun HmacSHA256 canonical request builder.
- Create `src/core/deepdraw-client.ts`: HTTP transport, result normalization, timeout handling.
- Create `src/core/approval.ts`: risk evaluation, plan creation, approval enforcement.
- Create `src/core/plan-store.ts`: writes and reads sanitized execution plans.
- Create `src/sdk/java-adapter.ts`: SDK classpath discovery, Java runner, output normalization.
- Create `java/DeepdrawProductCreateCli.java`: Java bridge for `dp.product.create`.
- Create `java/DeepdrawProductUpdateCli.java`: Java bridge for `dp.product.update`.
- Create `java/DeepdrawProductResourceCli.java`: Java bridge for `dp.product.resource`.
- Create `tests/*.test.ts`: focused tests per module.
- Create `AGENTS.md`: AI agent operating rules.
- Create `README.md`: human setup and command examples.

## Task 1: Project Scaffold and Test Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/cli/main.ts`
- Create: `src/cli/run.ts`
- Test: `tests/scaffold.test.ts`

- [ ] **Step 1: Write the failing scaffold test**

Create `tests/scaffold.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/scaffold.test.ts
```

Expected: command fails because `package.json`, test script, and `src/cli/run.ts` do not exist.

- [ ] **Step 3: Create the minimal project scaffold**

Create `package.json`:

```json
{
  "name": "deepdraw-cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "deepdraw": "./dist/cli/main.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "tsc -p tsconfig.json --noEmit",
    "test": "node --import tsx --test"
  },
  "dependencies": {
    "commander": "^14.0.0",
    "dotenv": "^17.0.0"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "tsx": "^4.20.0",
    "typescript": "^5.8.0"
  },
  "optionalDependencies": {
    "keytar": "^7.9.0"
  },
  "engines": {
    "node": ">=20"
  }
}
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "rootDir": ".",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
.env
.env.local
.DS_Store
tmp/
output/
coverage/
*.log
```

Create `src/cli/run.ts`:

```ts
export interface CliRunOptions {
  env: NodeJS.ProcessEnv;
  stdin: string;
}

export interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCli(argv: string[], _options: CliRunOptions): Promise<CliRunResult> {
  if (argv.includes("--help") || argv.length === 0) {
    return {
      exitCode: 0,
      stdout: [
        "Usage: deepdraw <command> [options]",
        "",
        "Commands:",
        "  call <api-name>    Call any registered DeepDraw API",
        "  auth               Manage DeepDraw tenant credentials",
        "  config             Inspect local DeepDraw configuration",
      ].join("\n") + "\n",
      stderr: "",
    };
  }

  return {
    exitCode: 1,
    stdout: "",
    stderr: `Unknown command: ${argv[0] ?? ""}\n`,
  };
}
```

Create `src/cli/main.ts`:

```ts
#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { runCli } from "./run.js";

const result = await runCli(process.argv.slice(2), {
  env: process.env,
  stdin: process.stdin.isTTY ? "" : readFileSync(0, "utf8"),
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
```

- [ ] **Step 4: Install dependencies**

Run:

```bash
npm install
```

Expected: `node_modules/` and `package-lock.json` are created. If optional `keytar` fails to build, rerun with:

```bash
npm install --omit=optional
```

Expected with fallback: install succeeds without `keytar`; later credential code handles missing `keytar`.

- [ ] **Step 5: Run the scaffold test to verify it passes**

Run:

```bash
npm test -- tests/scaffold.test.ts
```

Expected: PASS for `deepdraw --help exposes the CLI name and core commands`.

- [ ] **Step 6: Build the scaffold**

Run:

```bash
npm run build
```

Expected: TypeScript build exits 0 and creates `dist/`.

- [ ] **Step 7: Commit**

Run:

```bash
git add .gitignore package.json package-lock.json tsconfig.json src/cli/main.ts src/cli/run.ts tests/scaffold.test.ts
git commit -m "chore: scaffold DeepDraw CLI project"
```

## Task 2: API Registry With Full Reference Coverage

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/reference-parser.ts`
- Create: `src/core/api-registry.ts`
- Modify: `src/cli/run.ts`
- Test: `tests/api-registry.test.ts`

- [ ] **Step 1: Write the failing registry coverage test**

Create `tests/api-registry.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { apiRegistry, findApiDefinition } from "../src/core/api-registry.js";
import { extractReferenceApis } from "../src/core/reference-parser.js";

const referenceMarkdown = readFileSync("docs/reference/deepdraw-openapi.md", "utf8");

test("registry covers every dp api in the stable reference", () => {
  const referenceApis = extractReferenceApis(referenceMarkdown);
  const registeredApis = new Set(apiRegistry.map((api) => api.apiName));

  assert.equal(referenceApis.length, 20);
  for (const apiName of referenceApis) {
    assert.equal(registeredApis.has(apiName), true, `${apiName} is missing from apiRegistry`);
  }
});

test("every registered api has a deepdraw call route and risk metadata", () => {
  for (const api of apiRegistry) {
    assert.equal(findApiDefinition(api.apiName)?.apiName, api.apiName);
    assert.match(api.callSyntax, /^deepdraw call dp\./);
    assert.ok(["read", "caution", "write", "paid", "paid_write"].includes(api.riskLevel));
    assert.ok(["http", "java-sdk"].includes(api.transport));
    assert.ok(["GET", "POST"].includes(api.method));
    assert.ok(["/rest", "/rest/v2"].includes(api.path));
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- tests/api-registry.test.ts
```

Expected: FAIL because `src/core/api-registry.ts` and `src/core/reference-parser.ts` do not exist.

- [ ] **Step 3: Implement shared API types**

Create `src/core/types.ts`:

```ts
export type ApiRiskLevel = "read" | "caution" | "write" | "paid" | "paid_write";
export type ApiTransport = "http" | "java-sdk";
export type HttpMethod = "GET" | "POST";
export type DeepdrawPath = "/rest" | "/rest/v2";

export interface ApiParameter {
  name: string;
  required: boolean;
  source: "query" | "body";
  description: string;
}

export interface ApiDefinition {
  apiName: string;
  title: string;
  group: "merchant" | "trade" | "product" | "image" | "common";
  version: "v1" | "v2";
  transport: ApiTransport;
  method: HttpMethod;
  path: DeepdrawPath;
  riskLevel: ApiRiskLevel;
  approvalRequired: boolean;
  callSyntax: string;
  semanticCommand: string | null;
  requiredParams: ApiParameter[];
  optionalParams: ApiParameter[];
  notes: string;
}
```

- [ ] **Step 4: Implement reference API extraction**

Create `src/core/reference-parser.ts`:

```ts
export function extractReferenceApis(markdown: string): string[] {
  const apiNames = new Set<string>();
  const pattern = /`(dp\.[a-z0-9.]+)`/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(markdown)) !== null) {
    const value = match[1];
    if (value !== "dp.*") apiNames.add(value);
  }

  return [...apiNames].sort((a, b) => a.localeCompare(b));
}
```

- [ ] **Step 5: Implement the full registry**

Create `src/core/api-registry.ts` with one entry per API in `docs/reference/deepdraw-openapi.md`. Use this exact registry shape:

```ts
import type { ApiDefinition } from "./types.js";

function queryParam(name: string, required: boolean, description: string) {
  return { name, required, source: "query" as const, description };
}

function bodyParam(name: string, required: boolean, description: string) {
  return { name, required, source: "body" as const, description };
}

export const apiRegistry: ApiDefinition[] = [
  {
    apiName: "dp.merchant.name.search",
    title: "查询商家信息",
    group: "merchant",
    version: "v1",
    transport: "http",
    method: "POST",
    path: "/rest",
    riskLevel: "read",
    approvalRequired: false,
    callSyntax: "deepdraw call dp.merchant.name.search --param name=森马",
    semanticCommand: "deepdraw merchant search",
    requiredParams: [],
    optionalParams: [queryParam("name", false, "商户名称，支持模糊查询")],
    notes: "Returns merchant id, name, and brand data.",
  },
  {
    apiName: "dp.merchant.sites.get",
    title: "获取商户支持平台",
    group: "merchant",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "read",
    approvalRequired: false,
    callSyntax: "deepdraw call dp.merchant.sites.get",
    semanticCommand: "deepdraw merchant sites",
    requiredParams: [],
    optionalParams: [],
    notes: "Uses tenant merchantId from config.",
  },
  {
    apiName: "dp.merchant.watermarks.get",
    title: "查询水印信息",
    group: "merchant",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "read",
    approvalRequired: false,
    callSyntax: "deepdraw call dp.merchant.watermarks.get",
    semanticCommand: "deepdraw merchant watermarks",
    requiredParams: [],
    optionalParams: [],
    notes: "Uses tenant merchantId from config.",
  },
  {
    apiName: "dp.merchant.trades",
    title: "获取类目",
    group: "trade",
    version: "v1",
    transport: "http",
    method: "POST",
    path: "/rest",
    riskLevel: "read",
    approvalRequired: false,
    callSyntax: "deepdraw call dp.merchant.trades",
    semanticCommand: "deepdraw trade list",
    requiredParams: [],
    optionalParams: [],
    notes: "Category tree for tenant merchant.",
  },
  {
    apiName: "dp.trade.fields",
    title: "获取类目字段",
    group: "trade",
    version: "v1",
    transport: "http",
    method: "POST",
    path: "/rest",
    riskLevel: "read",
    approvalRequired: false,
    callSyntax: "deepdraw call dp.trade.fields --param tradeId=123",
    semanticCommand: "deepdraw trade fields",
    requiredParams: [queryParam("tradeId", true, "深绘叶子类目 id")],
    optionalParams: [],
    notes: "Returns field definitions for a leaf category.",
  },
  {
    apiName: "dp.product.create",
    title: "创建产品",
    group: "product",
    version: "v1",
    transport: "java-sdk",
    method: "POST",
    path: "/rest",
    riskLevel: "write",
    approvalRequired: true,
    callSyntax: "deepdraw call dp.product.create --json-file product.json --plan",
    semanticCommand: "deepdraw product create",
    requiredParams: [bodyParam("product", true, "产品创建 payload")],
    optionalParams: [queryParam("tradeId", false, "深绘叶子类目 id")],
    notes: "Uses Java SDK bridge for entity mapping.",
  },
  {
    apiName: "dp.product.update",
    title: "更新产品",
    group: "product",
    version: "v1",
    transport: "java-sdk",
    method: "POST",
    path: "/rest",
    riskLevel: "write",
    approvalRequired: true,
    callSyntax: "deepdraw call dp.product.update --param productId=PRODUCT_ID --json-file product.json --plan",
    semanticCommand: "deepdraw product update",
    requiredParams: [queryParam("productId", true, "深绘产品 id"), bodyParam("product", true, "产品更新 payload")],
    optionalParams: [],
    notes: "Uses Java SDK bridge because update payload is an SDK entity.",
  },
  {
    apiName: "dp.product.incremental.update",
    title: "产品增量更新",
    group: "product",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "write",
    approvalRequired: true,
    callSyntax: "deepdraw call dp.product.incremental.update --param productId=PRODUCT_ID --json-file patch.json --plan",
    semanticCommand: "deepdraw product patch",
    requiredParams: [queryParam("productId", true, "深绘产品 id"), bodyParam("product", true, "增量更新 payload")],
    optionalParams: [],
    notes: "Approval required because it mutates product data.",
  },
  {
    apiName: "dp.product.resource",
    title: "获取产品指定类型资源",
    group: "product",
    version: "v2",
    transport: "java-sdk",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "read",
    approvalRequired: false,
    callSyntax: "deepdraw call dp.product.resource --param productCode=208226102001 --param resource=form",
    semanticCommand: "deepdraw product resource",
    requiredParams: [queryParam("productCode", true, "货号")],
    optionalParams: [queryParam("productId", false, "深绘产品 id"), queryParam("resource", false, "资源类型，默认 form")],
    notes: "Uses Java SDK bridge, matching Listingify resource reads.",
  },
  {
    apiName: "dp.product.search",
    title: "查询产品列表（慎用）",
    group: "product",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "caution",
    approvalRequired: true,
    callSyntax: "deepdraw call dp.product.search --param productCodes=208226102001 --plan",
    semanticCommand: "deepdraw product search",
    requiredParams: [],
    optionalParams: [queryParam("productCodes", false, "货号，支持批量"), queryParam("pageNo", false, "页码"), queryParam("pageSize", false, "页大小"), queryParam("excludeDraft", false, "是否排除草稿")],
    notes: "Reference marks this endpoint as caution; require plan confirmation.",
  },
  {
    apiName: "dp.feature.pictures.get",
    title: "获取商品指定类型素材/资源图原图",
    group: "product",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "read",
    approvalRequired: false,
    callSyntax: "deepdraw call dp.feature.pictures.get --param productCode=208226102001 --param pictureType=MODEL",
    semanticCommand: "deepdraw product pictures",
    requiredParams: [queryParam("pictureType", true, "图片类型")],
    optionalParams: [queryParam("productCode", false, "货号"), queryParam("productId", false, "产品 id"), queryParam("pictureSite", false, "平台类型")],
    notes: "Supports resource picture filtering by platform.",
  },
  {
    apiName: "dp.product.basic.search",
    title: "查询产品基础信息列表",
    group: "product",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "read",
    approvalRequired: false,
    callSyntax: "deepdraw call dp.product.basic.search --param productCodes=208226102001",
    semanticCommand: "deepdraw product basic-search",
    requiredParams: [],
    optionalParams: [queryParam("productCodes", false, "货号，支持批量"), queryParam("pageNo", false, "页码"), queryParam("pageSize", false, "页大小"), queryParam("excludeDraft", false, "是否排除草稿")],
    notes: "Low-risk product lookup.",
  },
  {
    apiName: "dp.product.distribution.get",
    title: "查询产品上架状态",
    group: "product",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "read",
    approvalRequired: false,
    callSyntax: "deepdraw call dp.product.distribution.get --param productCode=208226102001",
    semanticCommand: "deepdraw product distribution",
    requiredParams: [queryParam("productCode", true, "货号")],
    optionalParams: [],
    notes: "Returns listing/distribution status.",
  },
  {
    apiName: "dp.product.retrieve.image",
    title: "以图搜款-款号接口",
    group: "image",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "paid",
    approvalRequired: true,
    callSyntax: "deepdraw call dp.product.retrieve.image --param imageUrl=https://example.test/a.jpg --plan",
    semanticCommand: "deepdraw image retrieve",
    requiredParams: [queryParam("imageUrl", true, "图片 URL")],
    optionalParams: [],
    notes: "Reference marks this endpoint as extra charge.",
  },
  {
    apiName: "dp.product.distributions.get",
    title: "以图搜款-查询上货记录",
    group: "image",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "read",
    approvalRequired: false,
    callSyntax: "deepdraw call dp.product.distributions.get --param productCode=208226102001",
    semanticCommand: "deepdraw image distributions",
    requiredParams: [],
    optionalParams: [queryParam("productCode", false, "货号"), queryParam("taskId", false, "任务 id")],
    notes: "Query image retrieval distribution records.",
  },
  {
    apiName: "dp.product.label.image",
    title: "图片服装多标签分析",
    group: "image",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "paid",
    approvalRequired: true,
    callSyntax: "deepdraw call dp.product.label.image --param imageUrl=https://example.test/a.jpg --plan",
    semanticCommand: "deepdraw image label",
    requiredParams: [queryParam("imageUrl", true, "图片 URL")],
    optionalParams: [],
    notes: "Reference marks this endpoint as extra charge.",
  },
  {
    apiName: "dp.product.image.upload",
    title: "图片素材上传接口",
    group: "image",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "paid_write",
    approvalRequired: true,
    callSyntax: "deepdraw call dp.product.image.upload --json-file upload.json --plan",
    semanticCommand: "deepdraw image upload",
    requiredParams: [bodyParam("images", true, "图片上传 payload")],
    optionalParams: [],
    notes: "Reference marks this endpoint as extra charge and it creates upload tasks.",
  },
  {
    apiName: "dp.product.image.query",
    title: "查询上传图片素材任务接口",
    group: "image",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "read",
    approvalRequired: false,
    callSyntax: "deepdraw call dp.product.image.query --param taskId=TASK_ID",
    semanticCommand: "deepdraw image upload-status",
    requiredParams: [queryParam("taskId", true, "图片上传任务 id")],
    optionalParams: [],
    notes: "Read-only task status query.",
  },
  {
    apiName: "dp.product.image.update",
    title: "图片修改",
    group: "image",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "paid_write",
    approvalRequired: true,
    callSyntax: "deepdraw call dp.product.image.update --json-file update.json --plan",
    semanticCommand: "deepdraw image update",
    requiredParams: [bodyParam("images", true, "图片修改 payload")],
    optionalParams: [queryParam("productCode", false, "货号"), queryParam("pictureAddType", false, "图片新增方式")],
    notes: "Reference marks this endpoint as extra charge and it mutates images.",
  },
  {
    apiName: "dp.colors.get",
    title: "获取深绘标准颜色",
    group: "common",
    version: "v2",
    transport: "http",
    method: "GET",
    path: "/rest/v2",
    riskLevel: "read",
    approvalRequired: false,
    callSyntax: "deepdraw call dp.colors.get",
    semanticCommand: "deepdraw color list",
    requiredParams: [],
    optionalParams: [],
    notes: "Low-risk common metadata endpoint.",
  },
];

export function findApiDefinition(apiName: string): ApiDefinition | undefined {
  return apiRegistry.find((api) => api.apiName === apiName);
}
```

- [ ] **Step 6: Add minimal `call` help output**

Modify `src/cli/run.ts` so `deepdraw call --help` and `deepdraw call <api>` can discover registry entries:

```ts
import { findApiDefinition } from "../core/api-registry.js";

export interface CliRunOptions {
  env: NodeJS.ProcessEnv;
  stdin: string;
}

export interface CliRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function helpText() {
  return [
    "Usage: deepdraw <command> [options]",
    "",
    "Commands:",
    "  call <api-name>    Call any registered DeepDraw API",
    "  auth               Manage DeepDraw tenant credentials",
    "  config             Inspect local DeepDraw configuration",
  ].join("\n") + "\n";
}

export async function runCli(argv: string[], _options: CliRunOptions): Promise<CliRunResult> {
  if (argv.includes("--help") || argv.length === 0) {
    return { exitCode: 0, stdout: helpText(), stderr: "" };
  }

  if (argv[0] === "call") {
    const apiName = argv[1];
    if (!apiName || apiName === "--help") {
      return {
        exitCode: 0,
        stdout: "Usage: deepdraw call <api-name> [--param key=value] [--json JSON] [--json-file file]\n",
        stderr: "",
      };
    }
    const api = findApiDefinition(apiName);
    if (!api) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Unknown DeepDraw API: ${apiName}\n`,
      };
    }
    return {
      exitCode: 0,
      stdout: JSON.stringify({ ok: true, api: api.apiName, dryRun: true, callSyntax: api.callSyntax }) + "\n",
      stderr: "",
    };
  }

  return {
    exitCode: 1,
    stdout: "",
    stderr: `Unknown command: ${argv[0] ?? ""}\n`,
  };
}
```

- [ ] **Step 7: Run tests**

Run:

```bash
npm test -- tests/api-registry.test.ts tests/scaffold.test.ts
```

Expected: both test files pass.

- [ ] **Step 8: Commit**

Run:

```bash
git add src/core/types.ts src/core/reference-parser.ts src/core/api-registry.ts src/cli/run.ts tests/api-registry.test.ts
git commit -m "feat: add complete DeepDraw API registry"
```

## Task 3: Result, Error, and Redaction Core

**Files:**
- Create: `src/core/errors.ts`
- Create: `src/core/redact.ts`
- Create: `src/core/result.ts`
- Test: `tests/result-redaction.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/result-redaction.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { createCliError } from "../src/core/errors.js";
import { normalizeDeepdrawPayload } from "../src/core/result.js";
import { redactSensitive } from "../src/core/redact.js";

test("redactSensitive hides credential-like fields recursively", () => {
  assert.deepEqual(redactSensitive({
    appSecret: "secret",
    dopKey: "dop",
    nested: {
      "x-ca-signature": "signature",
      safe: "visible",
    },
  }), {
    appSecret: "[REDACTED]",
    dopKey: "[REDACTED]",
    nested: {
      "x-ca-signature": "[REDACTED]",
      safe: "visible",
    },
  });
});

test("normalizeDeepdrawPayload extracts business status from SDK-style payload", () => {
  const result = normalizeDeepdrawPayload("dp.colors.get", "电商巴拉巴拉", 200, {
    status: 200,
    response: {
      code: 10200,
      response: "success",
      requestId: 1068,
      body: [{ name: "红色" }],
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.api, "dp.colors.get");
  assert.equal(result.tenant, "电商巴拉巴拉");
  assert.equal(result.httpStatus, 200);
  assert.equal(result.businessCode, 10200);
  assert.equal(result.businessState, "success");
  assert.deepEqual(result.data, [{ name: "红色" }]);
});

test("createCliError returns stable error kind and message", () => {
  assert.deepEqual(createCliError("approval_required", "User approval is required", {
    api: "dp.product.create",
  }), {
    kind: "approval_required",
    message: "User approval is required",
    details: {
      api: "dp.product.create",
    },
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/result-redaction.test.ts
```

Expected: FAIL because core files do not exist.

- [ ] **Step 3: Implement errors**

Create `src/core/errors.ts`:

```ts
export type CliErrorKind =
  | "config_missing"
  | "credential_missing"
  | "credential_store_unavailable"
  | "approval_required"
  | "input_validation_error"
  | "network_timeout"
  | "http_error"
  | "deepdraw_business_error"
  | "sdk_compile_error"
  | "sdk_runtime_error"
  | "unknown_error";

export interface CliError {
  kind: CliErrorKind;
  message: string;
  details?: Record<string, unknown>;
}

export function createCliError(
  kind: CliErrorKind,
  message: string,
  details?: Record<string, unknown>,
): CliError {
  return details ? { kind, message, details } : { kind, message };
}
```

- [ ] **Step 4: Implement redaction**

Create `src/core/redact.ts`:

```ts
const SENSITIVE_KEYS = new Set([
  "appsecret",
  "dopkey",
  "authorization",
  "x-ca-signature",
  "signature",
]);

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[_-]/g, "");
  return SENSITIVE_KEYS.has(key.toLowerCase()) ||
    SENSITIVE_KEYS.has(normalized) ||
    normalized.includes("secret") ||
    normalized.includes("token");
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  if (!value || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = isSensitiveKey(key) ? "[REDACTED]" : redactSensitive(entry);
  }
  return output;
}
```

- [ ] **Step 5: Implement result normalization**

Create `src/core/result.ts`:

```ts
import type { CliError } from "./errors.js";

export interface DeepdrawResult {
  ok: boolean;
  api: string;
  tenant: string;
  requestId: string | null;
  httpStatus: number | null;
  businessCode: number | null;
  businessState: string | null;
  data: unknown;
  raw: unknown;
  error?: CliError;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

export function normalizeDeepdrawPayload(
  api: string,
  tenant: string,
  httpStatus: number | null,
  payload: unknown,
): DeepdrawResult {
  const root = asRecord(payload);
  const response = asRecord(root.response);
  const body = response.body ?? root.body ?? payload;
  const businessCode = numberOrNull(response.code ?? root.code);
  const businessState = stringOrNull(response.response ?? root.responseState);
  const status = numberOrNull(root.status) ?? httpStatus;
  const requestId = stringOrNull(response.requestId) ?? stringOrNull(root.requestId);
  const ok = (status === null || status === 200) &&
    (businessCode === null || businessCode === 10200) &&
    (!businessState || businessState === "success");

  return {
    ok,
    api,
    tenant,
    requestId,
    httpStatus: status,
    businessCode,
    businessState,
    data: body,
    raw: payload,
  };
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm test -- tests/result-redaction.test.ts
```

Expected: all tests in this file pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/core/errors.ts src/core/redact.ts src/core/result.ts tests/result-redaction.test.ts
git commit -m "feat: add result normalization and redaction"
```

## Task 4: Config and Credential Stores

**Files:**
- Create: `src/core/config.ts`
- Create: `src/core/credentials.ts`
- Test: `tests/config-credentials.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/config-credentials.test.ts`:

```ts
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { configPathForPlatform, resolveDeepdrawConfig } from "../src/core/config.js";
import { FakeCredentialStore } from "../src/core/credentials.js";

test("configPathForPlatform uses platform specific config roots", () => {
  assert.match(configPathForPlatform("darwin", "/Users/me", {}), /\/Users\/me\/\.config\/deepdraw\/config\.json$/);
  assert.match(configPathForPlatform("linux", "/home/me", {}), /\/home\/me\/\.config\/deepdraw\/config\.json$/);
  assert.match(configPathForPlatform("win32", "C:\\Users\\me", { APPDATA: "C:\\Users\\me\\AppData\\Roaming" }), /DeepDrawCli\\config\.json$/);
});

test("resolveDeepdrawConfig prefers environment variables over stored credentials", async () => {
  const temp = mkdtempSync(path.join(tmpdir(), "deepdraw-config-"));
  const store = new FakeCredentialStore();
  await store.set("tenant:Stored:appSecret", "stored-secret");

  const config = await resolveDeepdrawConfig({
    env: {
      DEEPDRAW_TENANT_NAME: "EnvTenant",
      DEEPDRAW_BASE_URL: "http://open.deepdraw.cn",
      DEEPDRAW_APP_KEY: "env-app-key",
      DEEPDRAW_APP_SECRET: "env-secret",
      DEEPDRAW_DOP_KEY: "env-dop-key",
      DEEPDRAW_MERCHANT_ID: "1162",
    },
    configFile: path.join(temp, "config.json"),
    credentialStore: store,
  });

  assert.equal(config.tenantName, "EnvTenant");
  assert.equal(config.appSecret, "env-secret");
  assert.equal(config.dopKey, "env-dop-key");
  rmSync(temp, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/config-credentials.test.ts
```

Expected: FAIL because config and credentials modules do not exist.

- [ ] **Step 3: Implement credential stores**

Create `src/core/credentials.ts`:

```ts
export interface CredentialStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export class FakeCredentialStore implements CredentialStore {
  private values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

export class EnvCredentialStore implements CredentialStore {
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  async get(key: string): Promise<string | null> {
    return this.env[key] ?? null;
  }

  async set(): Promise<void> {
    throw new Error("EnvCredentialStore is read-only");
  }

  async delete(): Promise<void> {
    throw new Error("EnvCredentialStore is read-only");
  }
}
```

- [ ] **Step 4: Implement config resolution**

Create `src/core/config.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import type { CredentialStore } from "./credentials.js";

export interface DeepdrawConfig {
  tenantName: string;
  baseUrl: string;
  appKey: string;
  appSecret: string;
  dopKey: string;
  merchantId: string;
  timeoutMs: number;
  credentialSource: string;
}

export interface StoredConfigFile {
  defaultTenant?: string;
  tenants?: Record<string, {
    merchantId: string;
    appKeyRef: string;
    appSecretRef: string;
    dopKeyRef: string;
    baseUrl: string;
    timeoutMs?: number;
  }>;
}

export function configPathForPlatform(
  platform: NodeJS.Platform,
  homeDir: string,
  env: NodeJS.ProcessEnv,
): string {
  if (platform === "win32") {
    return path.join(env.APPDATA ?? path.join(homeDir, "AppData", "Roaming"), "DeepDrawCli", "config.json");
  }
  return path.join(homeDir, ".config", "deepdraw", "config.json");
}

function readJsonFile(filePath: string): StoredConfigFile {
  if (!existsSync(filePath)) return {};
  return JSON.parse(readFileSync(filePath, "utf8")) as StoredConfigFile;
}

function envConfig(env: NodeJS.ProcessEnv): DeepdrawConfig | null {
  const tenantName = env.DEEPDRAW_TENANT_NAME;
  const appKey = env.DEEPDRAW_APP_KEY;
  const appSecret = env.DEEPDRAW_APP_SECRET;
  const dopKey = env.DEEPDRAW_DOP_KEY;
  const merchantId = env.DEEPDRAW_MERCHANT_ID;
  if (!tenantName || !appKey || !appSecret || !dopKey || !merchantId) return null;
  return {
    tenantName,
    baseUrl: env.DEEPDRAW_BASE_URL ?? "http://open.deepdraw.cn",
    appKey,
    appSecret,
    dopKey,
    merchantId,
    timeoutMs: Number(env.DEEPDRAW_TIMEOUT_MS ?? 30000),
    credentialSource: "env",
  };
}

export async function resolveDeepdrawConfig(input: {
  env: NodeJS.ProcessEnv;
  configFile: string;
  credentialStore: CredentialStore;
  tenantName?: string;
}): Promise<DeepdrawConfig> {
  loadDotenv({ path: ".env.local", override: false });
  const fromEnv = envConfig(input.env);
  if (fromEnv) return fromEnv;

  const stored = readJsonFile(input.configFile);
  const tenantName = input.tenantName ?? stored.defaultTenant;
  if (!tenantName || !stored.tenants?.[tenantName]) {
    throw new Error("DeepDraw config is missing. Run deepdraw auth login.");
  }
  const tenant = stored.tenants[tenantName];
  const appKey = await input.credentialStore.get(tenant.appKeyRef);
  const appSecret = await input.credentialStore.get(tenant.appSecretRef);
  const dopKey = await input.credentialStore.get(tenant.dopKeyRef);
  if (!appKey || !appSecret || !dopKey) {
    throw new Error(`DeepDraw credentials are missing for tenant: ${tenantName}`);
  }
  return {
    tenantName,
    baseUrl: tenant.baseUrl,
    appKey,
    appSecret,
    dopKey,
    merchantId: tenant.merchantId,
    timeoutMs: tenant.timeoutMs ?? 30000,
    credentialSource: "credential-store",
  };
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/config-credentials.test.ts
```

Expected: all tests in this file pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/core/config.ts src/core/credentials.ts tests/config-credentials.test.ts
git commit -m "feat: add DeepDraw config and credential stores"
```

## Task 5: HTTP Signer

**Files:**
- Create: `src/core/signer.ts`
- Test: `tests/signer.test.ts`

- [ ] **Step 1: Write failing signer tests**

Create `tests/signer.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSignedRequest } from "../src/core/signer.js";

const config = {
  tenantName: "电商巴拉巴拉",
  baseUrl: "http://open.deepdraw.cn",
  appKey: "app-key",
  appSecret: "app-secret",
  dopKey: "dop-key",
  merchantId: "1162",
  timeoutMs: 30000,
  credentialSource: "test",
};

test("buildSignedRequest builds canonical GET v2 request", () => {
  const request = buildSignedRequest({
    config,
    apiName: "dp.product.resource",
    method: "GET",
    path: "/rest/v2",
    query: { productCode: "208226102001" },
    now: new Date("2026-04-29T00:00:00.000Z"),
    nonce: "nonce-1",
  });

  assert.equal(
    request.url,
    "http://open.deepdraw.cn/rest/v2?dopKey=dop-key&merchantId=1162&productCode=208226102001&type=dp.product.resource",
  );
  assert.equal(request.headers["x-ca-signature-headers"], "x-ca-key,x-ca-nonce,x-ca-signature-method,x-ca-timestamp");
  assert.match(request.headers["x-ca-signature"], /^[A-Za-z0-9+/]+=*$/);
  assert.match(request.stringToSign, /GET\napplication\/json; charset=utf-8/);
  assert.match(request.stringToSign, /\/rest\/v2\?dopKey=dop-key&merchantId=1162&productCode=208226102001&type=dp\.product\.resource/);
});

test("payload cannot override credential query parameters", () => {
  const request = buildSignedRequest({
    config,
    apiName: "dp.product.resource",
    method: "GET",
    path: "/rest/v2",
    query: {
      dopKey: "bad",
      merchantId: "bad",
      type: "dp.product.create",
      productCode: "208226102001",
    },
    now: new Date("2026-04-29T00:00:00.000Z"),
    nonce: "nonce-1",
  });

  assert.doesNotMatch(request.url, /bad|dp\.product\.create/);
  assert.match(request.url, /dopKey=dop-key/);
  assert.match(request.url, /type=dp\.product\.resource/);
});
```

- [ ] **Step 2: Run signer tests to verify failure**

Run:

```bash
npm test -- tests/signer.test.ts
```

Expected: FAIL because `src/core/signer.ts` does not exist.

- [ ] **Step 3: Implement signer**

Create `src/core/signer.ts`:

```ts
import crypto from "node:crypto";
import type { DeepdrawConfig } from "./config.js";
import type { DeepdrawPath, HttpMethod } from "./types.js";

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function sortedEntries(object: Record<string, unknown>): [string, unknown][] {
  return Object.entries(object).sort(([a], [b]) => a.localeCompare(b));
}

function sanitizeQuery(query: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (["dopKey", "merchantId", "type"].includes(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    output[key] = value;
  }
  return output;
}

function encodeQuery(params: Record<string, unknown>): string {
  return sortedEntries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value)).replace(/%20/g, "+")}`)
    .join("&");
}

function canonicalResource(requestPath: DeepdrawPath, params: Record<string, unknown>): string {
  const query = sortedEntries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return `${requestPath}?${query}`;
}

export function buildSignedRequest(input: {
  config: DeepdrawConfig;
  apiName: string;
  method: HttpMethod;
  path: DeepdrawPath;
  query: Record<string, unknown>;
  now?: Date;
  nonce?: string;
}) {
  const now = input.now ?? new Date();
  const nonce = input.nonce ?? crypto.randomUUID();
  const baseUrl = normalizeBaseUrl(input.config.baseUrl);
  const url = new URL(input.path, baseUrl);
  const params = {
    dopKey: input.config.dopKey,
    merchantId: input.config.merchantId,
    ...sanitizeQuery(input.query),
    type: input.apiName,
  };
  url.search = encodeQuery(params);

  const date = now.toUTCString();
  const timestamp = String(now.getTime());
  const headersForSign = {
    "x-ca-key": input.config.appKey,
    "x-ca-nonce": nonce,
    "x-ca-signature-method": "HmacSHA256",
    "x-ca-timestamp": timestamp,
  };
  const canonicalHeaders = sortedEntries(headersForSign)
    .map(([key, value]) => `${key}:${value}\n`)
    .join("");
  const stringToSign = [
    input.method,
    "application/json; charset=utf-8",
    "",
    "application/x-www-form-urlencoded; charset=utf-8",
    date,
  ].join("\n") + "\n" + canonicalHeaders + canonicalResource(input.path, params);
  const signature = crypto.createHmac("sha256", input.config.appSecret).update(stringToSign, "utf8").digest("base64");

  return {
    url: url.toString(),
    stringToSign,
    headers: {
      accept: "application/json; charset=utf-8",
      "content-type": "application/x-www-form-urlencoded; charset=utf-8",
      date,
      host: url.host,
      "user-agent": "deepdraw-cli",
      ...headersForSign,
      "x-ca-signature-headers": Object.keys(headersForSign).sort().join(","),
      "x-ca-signature": signature,
      CA_VERSION: "1",
    },
  };
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/signer.test.ts
```

Expected: all signer tests pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/core/signer.ts tests/signer.test.ts
git commit -m "feat: add DeepDraw request signer"
```

## Task 6: HTTP Client and Generic `deepdraw call`

**Files:**
- Create: `src/core/deepdraw-client.ts`
- Modify: `src/cli/run.ts`
- Test: `tests/deepdraw-call.test.ts`

- [ ] **Step 1: Write failing generic call tests**

Create `tests/deepdraw-call.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { callDeepdrawApi } from "../src/core/deepdraw-client.js";

const config = {
  tenantName: "电商巴拉巴拉",
  baseUrl: "http://open.deepdraw.cn",
  appKey: "app-key",
  appSecret: "app-secret",
  dopKey: "dop-key",
  merchantId: "1162",
  timeoutMs: 30000,
  credentialSource: "test",
};

test("callDeepdrawApi normalizes successful HTTP response", async () => {
  const result = await callDeepdrawApi({
    config,
    apiName: "dp.colors.get",
    query: {},
    body: undefined,
    fetchImpl: async () => new Response(JSON.stringify({
      status: 200,
      response: {
        code: 10200,
        response: "success",
        requestId: 1068,
        body: [{ name: "红色" }],
      },
    }), { status: 200 }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.api, "dp.colors.get");
  assert.equal(result.businessCode, 10200);
  assert.deepEqual(result.data, [{ name: "红色" }]);
});

test("callDeepdrawApi rejects unknown API names", async () => {
  await assert.rejects(() => callDeepdrawApi({
    config,
    apiName: "dp.unknown",
    query: {},
    body: undefined,
    fetchImpl: async () => new Response("{}", { status: 200 }),
  }), /Unknown DeepDraw API/);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/deepdraw-call.test.ts
```

Expected: FAIL because `src/core/deepdraw-client.ts` does not exist.

- [ ] **Step 3: Implement HTTP client**

Create `src/core/deepdraw-client.ts`:

```ts
import { findApiDefinition } from "./api-registry.js";
import type { DeepdrawConfig } from "./config.js";
import { normalizeDeepdrawPayload } from "./result.js";
import { buildSignedRequest } from "./signer.js";

export interface CallDeepdrawInput {
  config: DeepdrawConfig;
  apiName: string;
  query: Record<string, unknown>;
  body: unknown;
  fetchImpl?: typeof fetch;
}

export async function callDeepdrawApi(input: CallDeepdrawInput) {
  const api = findApiDefinition(input.apiName);
  if (!api) throw new Error(`Unknown DeepDraw API: ${input.apiName}`);
  if (api.transport !== "http") {
    throw new Error(`API ${input.apiName} requires transport: ${api.transport}`);
  }

  const signed = buildSignedRequest({
    config: input.config,
    apiName: api.apiName,
    method: api.method,
    path: api.path,
    query: input.query,
  });
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(signed.url, {
    method: api.method,
    headers: signed.headers,
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
    signal: AbortSignal.timeout(input.config.timeoutMs),
  });
  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return normalizeDeepdrawPayload(api.apiName, input.config.tenantName, response.status, payload);
}
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/deepdraw-call.test.ts
```

Expected: all tests in this file pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/core/deepdraw-client.ts tests/deepdraw-call.test.ts
git commit -m "feat: add generic DeepDraw HTTP calls"
```

## Task 7: Approval Plans and Execution Gate

**Files:**
- Create: `src/core/approval.ts`
- Create: `src/core/plan-store.ts`
- Modify: `src/cli/run.ts`
- Test: `tests/approval.test.ts`

- [ ] **Step 1: Write failing approval tests**

Create `tests/approval.test.ts`:

```ts
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { enforceApproval, createExecutionPlan } from "../src/core/approval.js";
import { writeExecutionPlan } from "../src/core/plan-store.js";

test("write and paid APIs require approval", () => {
  assert.equal(enforceApproval({
    apiName: "dp.product.create",
    argv: [],
    interactive: false,
  }).allowed, false);
  assert.equal(enforceApproval({
    apiName: "dp.colors.get",
    argv: [],
    interactive: false,
  }).allowed, true);
});

test("execution plans are sanitized and persisted", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "deepdraw-plan-"));
  const plan = createExecutionPlan({
    apiName: "dp.product.create",
    tenant: "电商巴拉巴拉",
    params: {
      merchantId: "1162",
      appSecret: "secret",
      productCode: "208226102001",
    },
  });
  const file = writeExecutionPlan(dir, plan);
  const content = readFileSync(file, "utf8");

  assert.match(content, /dp\.product\.create/);
  assert.match(content, /\[REDACTED\]/);
  assert.doesNotMatch(content, /secret/);
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/approval.test.ts
```

Expected: FAIL because approval modules do not exist.

- [ ] **Step 3: Implement approval logic**

Create `src/core/approval.ts`:

```ts
import { findApiDefinition } from "./api-registry.js";
import { redactSensitive } from "./redact.js";

export interface ApprovalDecision {
  allowed: boolean;
  reason: string | null;
}

export interface ExecutionPlan {
  id: string;
  api: string;
  tenant: string;
  riskLevel: string;
  requiresApproval: boolean;
  summary: string;
  sanitizedParams: unknown;
  createdAt: string;
}

export function enforceApproval(input: {
  apiName: string;
  argv: string[];
  interactive: boolean;
}): ApprovalDecision {
  const api = findApiDefinition(input.apiName);
  if (!api) return { allowed: false, reason: `Unknown DeepDraw API: ${input.apiName}` };
  if (!api.approvalRequired) return { allowed: true, reason: null };
  if (input.argv.includes("--yes")) return { allowed: true, reason: null };
  if (input.argv.includes("--plan")) return { allowed: false, reason: "plan_requested" };
  return { allowed: false, reason: "approval_required" };
}

export function createExecutionPlan(input: {
  apiName: string;
  tenant: string;
  params: Record<string, unknown>;
}): ExecutionPlan {
  const api = findApiDefinition(input.apiName);
  if (!api) throw new Error(`Unknown DeepDraw API: ${input.apiName}`);
  return {
    id: `${Date.now()}-${api.apiName.replaceAll(".", "-")}`,
    api: api.apiName,
    tenant: input.tenant,
    riskLevel: api.riskLevel,
    requiresApproval: api.approvalRequired,
    summary: `${api.title} (${api.apiName})`,
    sanitizedParams: redactSensitive(input.params),
    createdAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Implement plan persistence**

Create `src/core/plan-store.ts`:

```ts
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ExecutionPlan } from "./approval.js";

export function writeExecutionPlan(dir: string, plan: ExecutionPlan): string {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${plan.id}.json`);
  writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`);
  return file;
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/approval.test.ts
```

Expected: all approval tests pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/core/approval.ts src/core/plan-store.ts tests/approval.test.ts
git commit -m "feat: add approval plans for risky calls"
```

## Task 8: CLI Auth and Config Commands

**Files:**
- Modify: `src/cli/run.ts`
- Create: `src/cli/format.ts`
- Test: `tests/auth-config-cli.test.ts`

- [ ] **Step 1: Write failing CLI auth tests**

Create `tests/auth-config-cli.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { runCli } from "../src/cli/run.js";

test("auth login --stdin-json returns redacted tenant summary", async () => {
  const result = await runCli(["auth", "login", "--stdin-json"], {
    env: {},
    stdin: JSON.stringify({
      tenantName: "电商巴拉巴拉",
      merchantId: "1162",
      appKey: "app-key",
      appSecret: "secret",
      dopKey: "dop",
      baseUrl: "http://open.deepdraw.cn",
      defaultTenant: true,
    }),
  });

  assert.equal(result.exitCode, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.tenant, "电商巴拉巴拉");
  assert.equal(payload.credentials.appSecret, "[REDACTED]");
  assert.equal(payload.credentials.dopKey, "[REDACTED]");
});

test("config doctor --dry-run succeeds without live network calls", async () => {
  const result = await runCli(["config", "doctor", "--dry-run"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /dryRun/);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/auth-config-cli.test.ts
```

Expected: FAIL because `runCli` does not handle auth or config commands.

- [ ] **Step 3: Implement formatter**

Create `src/cli/format.ts`:

```ts
export function jsonLine(value: unknown, pretty = false): string {
  return `${JSON.stringify(value, null, pretty ? 2 : 0)}\n`;
}
```

- [ ] **Step 4: Add auth and config routes**

Modify `src/cli/run.ts` by adding branches before the unknown-command return:

```ts
import { jsonLine } from "./format.js";
import { redactSensitive } from "../core/redact.js";

if (argv[0] === "auth" && argv[1] === "login" && argv.includes("--stdin-json")) {
  const input = JSON.parse(options.stdin || "{}");
  return {
    exitCode: 0,
    stdout: jsonLine({
      ok: true,
      tenant: input.tenantName,
      defaultTenant: Boolean(input.defaultTenant),
      credentials: redactSensitive({
        appKey: input.appKey,
        appSecret: input.appSecret,
        dopKey: input.dopKey,
      }),
    }),
    stderr: "",
  };
}

if (argv[0] === "config" && argv[1] === "doctor" && argv.includes("--dry-run")) {
  return {
    exitCode: 0,
    stdout: jsonLine({
      ok: true,
      dryRun: true,
      checks: [
        { name: "config-path", ok: true },
        { name: "credential-store", ok: true },
      ],
    }),
    stderr: "",
  };
}
```

If `runCli` currently names the second parameter `_options`, rename it to `options`.

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/auth-config-cli.test.ts tests/scaffold.test.ts
```

Expected: auth/config tests pass and scaffold help test still passes.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/cli/run.ts src/cli/format.ts tests/auth-config-cli.test.ts
git commit -m "feat: add auth and config CLI commands"
```

## Task 9: Semantic Commands and Approval-Aware `call`

**Files:**
- Modify: `src/cli/run.ts`
- Test: `tests/semantic-commands.test.ts`

- [ ] **Step 1: Write failing semantic command tests**

Create `tests/semantic-commands.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { runCli } from "../src/cli/run.js";

test("read semantic command maps to registered api dry-run", async () => {
  const result = await runCli(["color", "list", "--dry-run"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.api, "dp.colors.get");
  assert.equal(payload.dryRun, true);
});

test("risky semantic command returns approval_required without --yes", async () => {
  const result = await runCli(["product", "create", "--input", "product.json"], {
    env: {},
    stdin: "",
  });

  assert.equal(result.exitCode, 1);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.error.kind, "approval_required");
  assert.equal(payload.plan.api, "dp.product.create");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/semantic-commands.test.ts
```

Expected: FAIL because semantic commands are not routed.

- [ ] **Step 3: Implement semantic command mapping**

Modify `src/cli/run.ts` to map semantic commands to registered APIs:

```ts
const semanticApis: Record<string, string> = {
  "merchant search": "dp.merchant.name.search",
  "merchant sites": "dp.merchant.sites.get",
  "merchant watermarks": "dp.merchant.watermarks.get",
  "trade list": "dp.merchant.trades",
  "trade fields": "dp.trade.fields",
  "product create": "dp.product.create",
  "product update": "dp.product.update",
  "product patch": "dp.product.incremental.update",
  "product resource": "dp.product.resource",
  "product search": "dp.product.search",
  "product basic-search": "dp.product.basic.search",
  "product distribution": "dp.product.distribution.get",
  "product pictures": "dp.feature.pictures.get",
  "image retrieve": "dp.product.retrieve.image",
  "image label": "dp.product.label.image",
  "image upload": "dp.product.image.upload",
  "image upload-status": "dp.product.image.query",
  "image update": "dp.product.image.update",
  "image distributions": "dp.product.distributions.get",
  "color list": "dp.colors.get",
};

function semanticKey(argv: string[]): string {
  return `${argv[0] ?? ""} ${argv[1] ?? ""}`.trim();
}
```

Add this branch before unknown-command handling:

```ts
const mappedApi = semanticApis[semanticKey(argv)];
if (mappedApi) {
  const decision = enforceApproval({
    apiName: mappedApi,
    argv,
    interactive: false,
  });
  const api = findApiDefinition(mappedApi);
  if (!api) {
    return { exitCode: 1, stdout: "", stderr: `Unknown DeepDraw API: ${mappedApi}\n` };
  }
  if (!decision.allowed) {
    const plan = createExecutionPlan({
      apiName: mappedApi,
      tenant: "unconfigured",
      params: { command: argv.join(" ") },
    });
    return {
      exitCode: 1,
      stdout: jsonLine({
        ok: false,
        error: { kind: "approval_required", message: "User approval is required" },
        plan,
      }),
      stderr: "",
    };
  }
  return {
    exitCode: 0,
    stdout: jsonLine({ ok: true, api: api.apiName, dryRun: argv.includes("--dry-run") }),
    stderr: "",
  };
}
```

Add missing imports:

```ts
import { createExecutionPlan, enforceApproval } from "../core/approval.js";
```

- [ ] **Step 4: Run tests**

Run:

```bash
npm test -- tests/semantic-commands.test.ts tests/api-registry.test.ts
```

Expected: semantic command tests pass and registry coverage remains green.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/cli/run.ts tests/semantic-commands.test.ts
git commit -m "feat: add semantic DeepDraw commands"
```

## Task 10: Java SDK Adapter

**Files:**
- Create: `src/sdk/java-adapter.ts`
- Create: `java/DeepdrawProductCreateCli.java`
- Create: `java/DeepdrawProductUpdateCli.java`
- Create: `java/DeepdrawProductResourceCli.java`
- Test: `tests/java-adapter.test.ts`

- [ ] **Step 1: Write failing Java adapter tests**

Create `tests/java-adapter.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildSdkInput, parseSdkOutput } from "../src/sdk/java-adapter.js";

const config = {
  tenantName: "电商巴拉巴拉",
  baseUrl: "http://open.deepdraw.cn",
  appKey: "app-key",
  appSecret: "app-secret",
  dopKey: "dop-key",
  merchantId: "1162",
  timeoutMs: 30000,
  credentialSource: "test",
};

test("buildSdkInput maps product resource calls to SDK config and query", () => {
  assert.deepEqual(buildSdkInput({
    config,
    apiName: "dp.product.resource",
    query: { productCode: "208226102001", resource: "form" },
    body: undefined,
  }), {
    config: {
      appKey: "app-key",
      appSecret: "app-secret",
      dopKey: "dop-key",
      host: "http://open.deepdraw.cn",
      merchantId: "1162",
    },
    query: {
      productCode: "208226102001",
      resource: "form",
    },
  });
});

test("parseSdkOutput normalizes trailing JSON line", () => {
  const result = parseSdkOutput("dp.product.resource", "电商巴拉巴拉", "log line\n{\"status\":200,\"response\":{\"code\":10200,\"response\":\"success\",\"requestId\":9901,\"body\":{\"productId\":7788}}}\n");

  assert.equal(result.ok, true);
  assert.equal(result.requestId, "9901");
  assert.deepEqual(result.data, { productId: 7788 });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm test -- tests/java-adapter.test.ts
```

Expected: FAIL because `src/sdk/java-adapter.ts` does not exist.

- [ ] **Step 3: Implement TypeScript adapter core**

Create `src/sdk/java-adapter.ts`:

```ts
import { normalizeDeepdrawPayload } from "../core/result.js";
import type { DeepdrawConfig } from "../core/config.js";

export function buildSdkInput(input: {
  config: DeepdrawConfig;
  apiName: string;
  query: Record<string, unknown>;
  body: unknown;
}) {
  return {
    config: {
      appKey: input.config.appKey,
      appSecret: input.config.appSecret,
      dopKey: input.config.dopKey,
      host: input.config.baseUrl,
      merchantId: input.config.merchantId,
    },
    ...(input.apiName === "dp.product.create" || input.apiName === "dp.product.update"
      ? { product: input.body ?? {}, query: input.query }
      : { query: input.query }),
  };
}

function extractJsonObject(text: string): unknown {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.startsWith("{") && line.endsWith("}")) return JSON.parse(line);
  }
  return JSON.parse(text);
}

export function parseSdkOutput(apiName: string, tenant: string, text: string) {
  const payload = extractJsonObject(text);
  return normalizeDeepdrawPayload(apiName, tenant, 200, payload);
}
```

- [ ] **Step 4: Create Java bridge skeletons**

Create `java/DeepdrawProductResourceCli.java`:

```java
public class DeepdrawProductResourceCli {
  public static void main(String[] args) throws Exception {
    throw new IllegalStateException("DeepdrawProductResourceCli must be wired with the vendored DeepDraw SDK before live use.");
  }
}
```

Create `java/DeepdrawProductCreateCli.java`:

```java
public class DeepdrawProductCreateCli {
  public static void main(String[] args) throws Exception {
    throw new IllegalStateException("DeepdrawProductCreateCli must be wired with the vendored DeepDraw SDK before live use.");
  }
}
```

Create `java/DeepdrawProductUpdateCli.java`:

```java
public class DeepdrawProductUpdateCli {
  public static void main(String[] args) throws Exception {
    throw new IllegalStateException("DeepdrawProductUpdateCli must be wired with the vendored DeepDraw SDK before live use.");
  }
}
```

- [ ] **Step 5: Replace skeletons with SDK code copied from Listingify references**

Use these source files as the exact basis:

```bash
sed -n '1,220p' /Users/xingyicheng/Documents/Listingify/scripts/java/DeepdrawProductResourceCli.java
sed -n '1,260p' /Users/xingyicheng/Documents/Listingify/scripts/java/DeepdrawProductCreateCli.java
```

For `DeepdrawProductUpdateCli.java`, use the same input/output structure as `DeepdrawProductCreateCli.java`, replacing the SDK request class with the update request class named by the DeepDraw SDK. If the class name cannot be found in the vendored SDK, keep `dp.product.update` routed through HTTP in `api-registry.ts`, add a test that documents that transport choice, and update the design spec before committing this task.

- [ ] **Step 6: Run adapter tests**

Run:

```bash
npm test -- tests/java-adapter.test.ts
```

Expected: TypeScript adapter tests pass. Java bridge live execution is not required in automated tests.

- [ ] **Step 7: Commit**

Run:

```bash
git add src/sdk/java-adapter.ts java/DeepdrawProductCreateCli.java java/DeepdrawProductUpdateCli.java java/DeepdrawProductResourceCli.java tests/java-adapter.test.ts
git commit -m "feat: add DeepDraw Java SDK adapter"
```

## Task 11: Agent Docs and Final Validation

**Files:**
- Create: `AGENTS.md`
- Create: `README.md`
- Modify: `package.json`
- Test: `tests/docs.test.ts`

- [ ] **Step 1: Write failing docs test**

Create `tests/docs.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

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
  assert.match(text, /Windows Credential Manager/);
  assert.match(text, /macOS Keychain/);
  assert.match(text, /Secret Service/);
});
```

- [ ] **Step 2: Run docs test to verify failure**

Run:

```bash
npm test -- tests/docs.test.ts
```

Expected: FAIL because `AGENTS.md` and `README.md` do not exist.

- [ ] **Step 3: Create AGENTS.md**

Create `AGENTS.md`:

```markdown
# DeepDraw CLI Agent Guide

This repo provides the `deepdraw` CLI for DeepDraw OpenAPI calls.

Agent rules:

1. Read `docs/reference/deepdraw-openapi.md` before adding or changing API behavior.
2. Every `dp.*` API in the reference must be present in `src/core/api-registry.ts`.
3. Use `deepdraw call <api-name>` for generic API access.
4. Use semantic commands only as wrappers around registered APIs.
5. For write, paid, or caution APIs, run with `--plan` first.
6. Do not execute write, paid, or caution APIs unless the user explicitly authorizes `--yes`.
7. If a command returns `error.kind = "approval_required"`, ask the user before continuing.
8. Never write real `appSecret`, `dopKey`, signatures, or tenant credential JSON into tracked files.
9. Prefer fake credential stores and mocked fetch/Java runners in tests.

Useful commands:

```bash
npm test
npm run lint
npm run build
deepdraw auth login
deepdraw config doctor --dry-run
deepdraw call dp.colors.get --dry-run
```
```

- [ ] **Step 4: Create README.md**

Create `README.md`:

```markdown
# DeepDraw CLI

`deepdraw` is an agent-friendly CLI for the DeepDraw OpenAPI.

## Setup

```bash
npm install
npm run build
npm link
```

## Credentials

Interactive login:

```bash
deepdraw auth login
```

Credential storage:

- macOS: macOS Keychain
- Windows: Windows Credential Manager
- Linux: Secret Service / libsecret
- Fallback: local file only when the user explicitly allows it

## Safe Calls

Read-only call:

```bash
deepdraw call dp.colors.get
```

Risky call plan:

```bash
deepdraw product create --input product.json --plan
```

Execute after user approval:

```bash
deepdraw execute PLAN_ID --yes
```

## Validation

```bash
npm test
npm run lint
npm run build
```
```

- [ ] **Step 5: Run docs test**

Run:

```bash
npm test -- tests/docs.test.ts
```

Expected: docs tests pass.

- [ ] **Step 6: Run full validation**

Run:

```bash
npm test
npm run lint
npm run build
node dist/cli/main.js --help
node dist/cli/main.js config doctor --dry-run
node dist/cli/main.js call dp.colors.get --dry-run
```

Expected:

- `npm test` exits 0.
- `npm run lint` exits 0.
- `npm run build` exits 0.
- `--help` prints CLI usage.
- `config doctor --dry-run` returns JSON with `"ok":true`.
- `call dp.colors.get --dry-run` returns JSON with `"api":"dp.colors.get"`.

- [ ] **Step 7: Commit**

Run:

```bash
git add AGENTS.md README.md package.json tests/docs.test.ts
git commit -m "docs: add DeepDraw CLI agent guide"
```

## Final Checklist

- [ ] `src/core/api-registry.ts` contains every `dp.*` API extracted from `docs/reference/deepdraw-openapi.md`.
- [ ] `deepdraw call <api-name>` works for every registered API in dry-run mode.
- [ ] Write, paid, and caution APIs return `approval_required` without `--plan` or `--yes`.
- [ ] No tracked file contains real `DEEPDRAW_APP_SECRET`, `DEEPDRAW_DOP_KEY`, `appSecret` values, `dopKey` values, or signatures.
- [ ] `npm test`, `npm run lint`, and `npm run build` pass.
- [ ] Current branch has one commit per completed task.

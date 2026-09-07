# 巴拉完整本地上新流程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在深绘 CLI 中交付可恢复、可审计、品牌可扩展的巴拉巴拉上新工作流，并以本地资料和受控测试款完成真实回读验证。

**Architecture:** 新增与品牌无关的本地工作流状态层，负责状态、源快照、模板、执行计划、远端回读和原子 JSON 写入。巴拉插件只实现表格列映射、类目选择、字段/尺码/SKU/平台规则及 AI/OCR 候选校验；CLI 入口组合插件和已注册的 `dp.*` 接口，始终经过现有授权与 api-registry。

**Tech Stack:** TypeScript、Node.js、现有 Java SDK bridge、`xlsx` 只读解析、Node `crypto`、Node test runner。

## Global Constraints

- 不访问或持久化 MDM、PLM、Listingify 数据库；业务事实只从本地输入文件导入。
- `.deepdraw-workflows/`、`.codex-tmp/`、原始 Excel/图片、DeepDraw 凭据和签名都不得提交。
- `204426140121` 只做本地组装和 DeepDraw 只读调用；任何真实写入仅允许 `204426140121-test`。
- 所有 `dp.*` 行为必须保留在 `src/core/api-registry.ts` 的已注册接口之内；语义化命令只能薄封装。
- 写入必须遵守 `--execute --plan` 后由用户授权的 `--execute --yes`；计划不是授权。写后必须 `resource=form` 回读。
- `dp.product.update` 维持覆盖式语义，完整更新必须携带完整颜色、销售尺码、商家 SKU、主尺码表和适用平台尺码表。
- 动态 `dp.trade.fields` 是字段 ID、枚举、必填、销售属性与子字段激活的唯一实时权威；不得维护过期静态 fieldId 清单。
- 测试先行。每项变更执行其 focused tests，最终执行 `npm test && npm run lint && npm run build`。

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/workflow/types.ts` | 通用状态、字段证据、模板、执行、回读、插件的 TypeScript 契约。 |
| `src/workflow/store.ts` | 原子 JSON 状态读写、哈希、状态转换、执行/回读证据落盘。 |
| `src/workflow/engine.ts` | import/assemble/template/review/plan/publish/readback 的通用编排与写入白名单。 |
| `src/brands/types.ts` | 未来品牌可实现的 `BrandPlugin` 接口。 |
| `src/brands/balabala/index.ts` | 巴拉插件组合入口。 |
| `src/brands/balabala/importers.ts` | XLSX/目录只读导入、真实 XML 行扫描回退、来源定位和 SHA-256。 |
| `src/brands/balabala/trade-selection.ts` | 上市计划上下文、平台覆盖与 SKU 尺码兼容的 DeepDraw 类目评分。 |
| `src/brands/balabala/fields.ts` | 模板过滤、字段优先级、颜色、SKU、通用/平台字段、子字段激活。 |
| `src/brands/balabala/size-charts.ts` | 鞋品、服饰、鞋型/凉鞋、主尺码和多平台尺码表。 |
| `src/brands/balabala/ai-audit.ts` | AI/OCR 外部结果审计、阈值和不可推断事实字段保护。 |
| `src/brands/balabala/readback.ts` | 现有商品保护、SKU 交集、回读比较与 UI 核验边界。 |
| `src/cli/run.ts` | `deepdraw balabala` 的新状态型子命令和旧 `--input` 兼容适配。 |
| `src/core/deepdraw-client.ts` | 仅在需要时暴露读取/调用适配，复用 api-registry 与批准流程。 |
| `tests/workflow-*.test.ts` | 核心状态、发布、回读的单元和流程回归。 |
| `tests/balabala-*.test.ts` | 导入、类目、字段、鞋服尺码、AI/OCR 的品牌规则回归。 |
| `README.md`, `AGENTS.md`, `.gitignore` | 用户指南、运行约束与本地状态忽略规则。 |

### Task 1: 建立可恢复工作流状态与品牌插件接口

**Files:**
- Create: `src/workflow/types.ts`
- Create: `src/workflow/store.ts`
- Create: `src/brands/types.ts`
- Create: `tests/workflow-store.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces `WorkflowStore.open(brand, spu, root): WorkflowStore`、`read(): WorkflowSnapshot`、`write(next): Promise<WorkflowSnapshot>`、`recordExecution(entry): Promise<void>`。
- Produces `BrandPlugin`，包含 `importSources`、`selectTrade`、`buildFields`、`buildSizeTables`、`buildAiPlan`、`buildPayload`、`prepareExistingUpdate`、`compareReadback`。

- [ ] **Step 1: Write failing atomic-state and no-secret tests**

```ts
test("workflow store atomically persists state and never serializes credentials", async () => {
  const store = WorkflowStore.open("balabala", "204426140121", sandbox);
  await store.write({ ...emptySnapshot("balabala", "204426140121"), credentials: { appSecret: "secret" } } as never);
  const raw = await readFile(join(sandbox, ".deepdraw-workflows/balabala/204426140121/state.json"), "utf8");
  assert.equal(raw.includes("secret"), false);
  assert.equal((await store.read()).state, "imported");
});
```

- [ ] **Step 2: Run focused test to verify it fails**

Run: `npm test -- workflow-store.test.ts`

Expected: FAIL because workflow modules do not exist.

- [ ] **Step 3: Implement the types, redacted state serializer, SHA-256 source fingerprint and rename-based atomic writer**

```ts
export interface WorkflowStore {
  read(): Promise<WorkflowSnapshot | undefined>;
  write(snapshot: WorkflowSnapshot): Promise<WorkflowSnapshot>;
  recordExecution(entry: ExecutionRecord): Promise<void>;
}

export function redactedSnapshot(snapshot: WorkflowSnapshot): WorkflowSnapshot {
  return JSON.parse(JSON.stringify(snapshot, (key, value) => /secret|dopkey|signature/i.test(key) ? undefined : value));
}
```

- [ ] **Step 4: Run focused test to verify it passes**

Run: `npm test -- workflow-store.test.ts`

Expected: PASS.

- [ ] **Step 5: Ignore local state**

Add exactly `.deepdraw-workflows/` and `.codex-tmp/` to `.gitignore`; then run `git check-ignore -v .deepdraw-workflows/balabala/204426140121/state.json`.

### Task 2: 实现本地资料导入与异常工作表行扫描

**Files:**
- Create: `src/brands/balabala/importers.ts`
- Create: `tests/balabala-importers.test.ts`
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Produces `importBalabalaSources(input): Promise<ImportedSources>` where `input` has `spu`, `mdmPath`, `launchPlanPath`, `copywritingPath`, optional `shoeSizeChartPath`, optional `imagesPath`.
- Produces rows with `sourceRef: { path, sheet, row, sha256 }`, normalized fields and no raw workbook binary.

- [ ] **Step 1: Write fixtures and failing import tests**

```ts
test("imports all MDM colors and SKUs while inheriting launch-plan facts from one color", async () => {
  const imported = await importBalabalaSources({ spu: "204426140121", ...fixturePaths });
  assert.deepEqual(imported.skus.map((sku) => sku.color).sort(), ["白绿色调00414", "蓝色调00388"]);
  assert.equal(imported.launchPlan.tradeCategory, "童鞋/婴儿鞋/亲子鞋>>运动鞋");
});

test("scans O2O physical rows when worksheet dimension falsely reports A1", async () => {
  const imported = await importBalabalaSources({ spu: "204426140121", ...dimensionFixturePaths });
  assert.equal(imported.copywriting.rows[0].sourceRef.sheet, "O2O");
  assert.equal(imported.copywriting.rows[0].sourceRef.row, 173);
});
```

- [ ] **Step 2: Run import tests to verify they fail**

Run: `npm test -- balabala-importers.test.ts`

Expected: FAIL because the importer is absent.

- [ ] **Step 3: Add the smallest audited XLSX reader and image manifest importer**

Use a pinned, production dependency supported by this CLI. Read only source rows matching `spu` or `spu + SKC`; inspect worksheet XML `sheetData/row` rather than trusting `!ref`; hash inputs; record only role/path/hash/extension for images; normalize headers with aliases and preserve row references.

- [ ] **Step 4: Run focused import tests**

Run: `npm test -- balabala-importers.test.ts`

Expected: PASS.

- [ ] **Step 5: Test the supplied real files in a disposable workflow root**

Run: `node dist/cli/main.js balabala import --spu 204426140121 --mdm '/Users/xingyicheng/Downloads/商品SKU表.xlsx' --launch-plan '/Users/xingyicheng/Downloads/426上市计划表-6.0版本 20260821.xlsx' --copywriting '/Users/xingyicheng/Downloads/426巴拉鞋品文案期货+全域7P（两张表）(2).xlsx' --shoe-size-chart '/Users/xingyicheng/Downloads/巴拉鞋品尺码表.xlsx' --images '/Users/xingyicheng/Downloads/深绘吊牌洗唛平铺图_混合款实验_20260903/深绘吊牌洗唛平铺图_混合款实验_20260903/204426140121' --workflow-root "$TMPDIR/deepdraw-real-204426140121"`

Expected: local state shows 30 MDM SKUs, 2 colors, and no DeepDraw write.

### Task 3: 实现动态类目模板、评分与字段构建框架

**Files:**
- Create: `src/brands/balabala/trade-selection.ts`
- Create: `src/brands/balabala/fields.ts`
- Create: `src/brands/balabala/index.ts`
- Create: `tests/balabala-trade-selection.test.ts`
- Modify: `src/core/balabala-field-rules.ts`

**Interfaces:**
- Produces `selectBalabalaTrade(context, trades): TradeDecision` with ranking, platform coverage, size compatibility and `manualSelectionRequired`.
- Produces `buildBalabalaFields(context, template): FieldDecision[]` where each decision has provenance and one of `direct|derived|structured|evidence_candidate|manual_required|skipped`.

- [ ] **Step 1: Write failing selection and template tests**

```ts
test("prefers an exact direct child-shoe sports leaf that covers platforms and actual SKU sizes", () => {
  const result = selectBalabalaTrade(shoeContext, tradeCandidates);
  assert.equal(result.selected?.tradeId, "546");
  assert.equal(result.manualSelectionRequired, false);
});

test("does not select a tied or platform-incomplete category", () => {
  const result = selectBalabalaTrade(shoeContext, tiedCandidates);
  assert.equal(result.selected, undefined);
  assert.equal(result.manualSelectionRequired, true);
});

test("drops inactive child fields and invalid enum AI candidates", () => {
  const fields = buildBalabalaFields(context, templateWithChildAndEnums);
  assert.equal(fields.some((field) => field.fieldName === "未激活子字段"), false);
  assert.equal(fields.find((field) => field.fieldName === "风格")?.valueText, undefined);
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm test -- balabala-trade-selection.test.ts balabala-field-rules.test.ts`

Expected: FAIL because plugin components are absent.

- [ ] **Step 3: Implement ranked decision and field decision construction**

Implement Listingify evidence order, direct child-shoe preference, sport/outdoor/board/snow/boot/learning-walk/sandal and apparel subtype context terms. Require source conflict/tie/platform/size failures to return a manual decision. Use current template IDs/options only; activate children only when matching `parentAttr` and `parentAttrValue`; preserve valid manual override; record stale reason for invalidated override or derived value.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npm test -- balabala-trade-selection.test.ts balabala-field-rules.test.ts`

Expected: PASS.

- [ ] **Step 5: Implement colors, SKU rows and common platform fields under template intersection**

Add tests and code that construct all MDM colors as `标准色,原始颜色`, retain raw unmatched color for manual confirmation, use final sales color + size as merchant-SKU keys, set PDD list/group price to tag price - 1/-2, use `1*price` for 1688, and leave unsupported platform/SKU special fields as `manual_required`.

### Task 4: 实现鞋品和服饰主尺码表、多平台尺码表及细类规则

**Files:**
- Create: `src/brands/balabala/size-charts.ts`
- Create: `tests/balabala-size-charts.test.ts`
- Modify: `src/core/product-payload.ts`
- Modify: `tests/product-payload.test.ts`

**Interfaces:**
- Produces `buildBalabalaSizeTables(context, template): FieldDecision[]`.
- Produces canonical `SizeOption` containing `salesValue`, `displayValue`, `tableKey`, and platform aliases.

- [ ] **Step 1: Write failing shoe-size tests**

```ts
test("builds sports-shoe tables only for actual integer MDM sizes", () => {
  const fields = buildBalabalaSizeTables(sportShoeContext, shoeTemplate);
  assert.deepEqual(tableRows(fields, "尺码表").map((row) => row.key), ["26码", "27码"]);
  assert.equal(tableValue(fields, "唯品会尺码表", "26", "欧洲码"), "26");
  assert.equal(tableValue(fields, "多平台尺码", "26码", "京东"), "26");
});

test("blocks sandals without visual structural evidence", () => {
  assert.equal(buildBalabalaSizeTables(unknownSandalContext, shoeTemplate).some((x) => x.code === "needs_visual_classification"), true);
});
```

- [ ] **Step 2: Write failing apparel-size tests**

```ts
test("builds an upper-garment table with blank missing measurements and kg reference", () => {
  const fields = buildBalabalaSizeTables(apparelContext, apparelTemplate);
  assert.equal(tableValue(fields, "尺码表", "140cm", "尺码"), "140");
  assert.equal(tableValue(fields, "尺码表", "140cm", "体重"), "31kg");
  assert.equal(tableValue(fields, "尺码表", "140cm", "袖长"), "");
});
```

- [ ] **Step 3: Run focused tests to verify they fail**

Run: `npm test -- balabala-size-charts.test.ts product-payload.test.ts`

Expected: FAIL because the multi-domain size builder is absent.

- [ ] **Step 4: Implement shoe and apparel table builders**

Implement shoe groups `sport_leisure|casual|snow_boot|toddler|open_sandal|closed_sandal`, main/VIP/Tmall/Douyin/Taobao/multi-platform tables and template column intersection. Implement apparel `top|jeans|bottom|dress|set|underwear|homewear|bodysuit|accessory` headers; PLM long/wide normalization; alias, half-girth and unit conversion; 52–180 reference age/weight/VIP type; no generated third size column and no synthetic zero. Preserve create/update send policy and shoe Taobao warning.

- [ ] **Step 5: Run focused tests to verify they pass**

Run: `npm test -- balabala-size-charts.test.ts product-payload.test.ts`

Expected: PASS.

### Task 5: 实现 AI/OCR 审计、发布编排、已有商品保护与回读比较

**Files:**
- Create: `src/brands/balabala/ai-audit.ts`
- Create: `src/brands/balabala/readback.ts`
- Create: `src/workflow/engine.ts`
- Create: `tests/balabala-ai-audit.test.ts`
- Create: `tests/workflow-engine.test.ts`
- Modify: `src/core/deepdraw-client.ts`

**Interfaces:**
- Produces `auditAiResponses(plan, responses): AuditResult` and `auditOcrFacts(images, facts): AuditResult`.
- Produces `prepareExistingUpdate(local, remote): ProtectedPayload` and `compareBalabalaReadback(expected, resource): ReadbackComparison`.
- Produces `WorkflowEngine.publish(spu, stage, options): Promise<WorkflowResult>`.

- [ ] **Step 1: Write failing AI/OCR and protection tests**

```ts
test("accepts only active template enum AI candidates with evidence and confidence >= 0.7", () => {
  const result = auditAiResponses(plan, [acceptedCandidate, lowConfidence, factFieldCandidate]);
  assert.deepEqual(result.accepted.map((item) => item.fieldId), ["style"]);
  assert.equal(result.rejected.length, 2);
});

test("blocks full update when remote and local SKU key sets do not intersect", () => {
  assert.equal(prepareExistingUpdate(local, remoteWithoutOverlap).blocking[0].code, "sku_intersection_required");
});
```

- [ ] **Step 2: Run focused tests to verify they fail**

Run: `npm test -- balabala-ai-audit.test.ts workflow-engine.test.ts`

Expected: FAIL because audit, protection and engine modules are absent.

- [ ] **Step 3: Implement auditable providers and stage orchestration**

AI only plans candidate enum fields; never makes network calls by itself. Reject inactive/invalid/no-evidence/<0.7 values and all fact fields. OCR can submit textual fact candidates with path/hash/role/bounding evidence. The engine must call existing registered APIs, save plan/requestId/readback, derive numeric product ID after create, automatically run post-create full update when required, transition only after strict comparison, and record `transport_unknown` rather than retrying an uncertain write.

- [ ] **Step 4: Implement readback and field comparison assertions**

Compare scalar fields, colors, sales sizes, canonical color-size SKU keys, main/platform table rows/columns/values and aliases. Mark incomplete provider tables as `needs_ui_verification`, not success. Existing full update merges remote scalar fields only when the local source is absent and does not allow remote data to invent SKU/size facts.

- [ ] **Step 5: Run focused tests to verify they pass**

Run: `npm test -- balabala-ai-audit.test.ts workflow-engine.test.ts`

Expected: PASS.

### Task 6: 接入 CLI、兼容旧草稿输入并完善文档

**Files:**
- Modify: `src/cli/run.ts`
- Modify: `tests/balabala-workflow.test.ts`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `tests/docs.test.ts`

**Interfaces:**
- Adds `balabala import|assemble|template|review|plan|publish|readback` with `--spu` and `--workflow-root`.
- Retains `balabala review|create|full-update|incremental --input` and adapts them through an ephemeral compatible workflow snapshot.

- [ ] **Step 1: Write failing command contract tests**

```ts
test("balabala import is local-only and writes a source snapshot", async () => {
  const result = await runCli(["balabala", "import", "--spu", "204426140121", ...sourceArgs], cwd);
  assert.equal(result.exitCode, 0);
  assert.equal(JSON.parse(result.stdout).state, "imported");
});

test("balabala publish rejects a live-write code outside the allowlist", async () => {
  const result = await runCli(["balabala", "publish", "incremental", "--spu", "204426140121", "--execute", "--yes"], cwd);
  assert.match(result.stderr, /only permitted for configured test code/);
});
```

- [ ] **Step 2: Run CLI tests to verify they fail**

Run: `npm test -- balabala-workflow.test.ts docs.test.ts`

Expected: FAIL because stateful commands are absent.

- [ ] **Step 3: Implement the thin command parser and stateful output**

Use the engine for all stateful commands. Keep `--execute` required for all remote read/write stages. Enforce write allowlist only at execute path. Return workflow, action, spu, state, template hash, source summary, blocking/manual items and next safe action. Never read credentials for import/assemble/review. Retain `--fields` scalar-only incremental boundary and automatic color/size carrier fields.

- [ ] **Step 4: Update README and AGENTS operational guidance**

Document local input command sequence, expected files, plugin boundary, AI/OCR input contract, dynamic template process, create→automatic full-update→readback, existing update protection, readback status meanings and test-code-only external write boundary.

- [ ] **Step 5: Run CLI and docs tests to verify they pass**

Run: `npm test -- balabala-workflow.test.ts docs.test.ts`

Expected: PASS.

### Task 7: 全量验证、真实资料本地/只读联调与受控真实增量复测

**Files:**
- Create (ignored): `.deepdraw-workflows/balabala/204426140121/*`
- Create (ignored): `.deepdraw-workflows/balabala/204426140121-test/*`
- Create (ignored): `.codex-tmp/dont-stop/balabala-full-listing/checkpoint.json`

**Interfaces:**
- Demonstrates release workflow through exact CLI commands and saved state evidence, not a test-only mock.

- [ ] **Step 1: Run complete local validation**

Run: `npm test && npm run lint && npm run build && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 2: Import and assemble the formal supplied product locally**

Run the Task 2 real import followed by `balabala assemble`, then inspect state for 30 SKUs, two MDM colors, sport/leisure shoe sizing and an image-evidence gap for `00388`.

Expected: no write call; state contains sources/audit/draft artifacts.

- [ ] **Step 3: Read and template-sync only the formal product**

Run `deepdraw balabala query --product-code 204426140121 --execute` and `deepdraw balabala template --spu 204426140121 --execute` serially with 3–5 second spacing.

Expected: resource/template evidence only; if rate-limited, stop and record cooldown rather than retrying the batch.

- [ ] **Step 4: Capture the test product pre-state and produce a plan**

Run `deepdraw balabala query --product-code 204426140121-test --execute`, import or sync required test state, select one safe ordinary scalar field, then run `deepdraw balabala plan incremental --spu 204426140121-test --fields <field> --execute --plan`.

Expected: saved pre-state, explicit selected field/old/new value, plan whose payload includes colors and sales sizes and excludes size charts/SKU changes.

- [ ] **Step 5: Execute exactly one planned test update and verify persistence**

After the user-provided authorization already recorded in task scope, run only `deepdraw balabala publish incremental --spu 204426140121-test --fields <field> --execute --yes`, record response/requestId, wait if needed, then run `deepdraw balabala readback --spu 204426140121-test --execute`.

Expected: field change and carrier color/size integrity confirmed by resource/form; HTTP status alone is insufficient.

- [ ] **Step 6: Restore original test value through the same plan/write/readback protocol**

Rebuild patch with only the original field value, make a new plan, execute once, read back and compare against pre-state. If write response is uncertain, do not resend; first read back.

Expected: original scalar value restored; saved final readback proves the external test boundary is clean.

### Task 8: 交付审查、本地提交与 GitHub 推送

**Files:**
- Modify: only implementation, tests, README, AGENTS, `.gitignore`, and the committed plan/spec files.

**Interfaces:**
- Produces one local commit and GitHub remote ref evidence for that exact commit.

- [ ] **Step 1: Perform final source and secret review**

Run: `git status --short && git diff --check && rg -n --hidden --glob '!.git/**' 'd8cff435354cfdfcdaecc08a5703f862|946011f1dd5c4be994e8d1f02540ce6e' .`

Expected: no sensitive credential in tracked changes; ignored state is unstaged.

- [ ] **Step 2: Inspect only intended staged files**

Run: `git add -- <exact changed source/test/doc paths> && git diff --cached --check && git diff --cached --stat`

Expected: no unrelated or ignored file staged.

- [ ] **Step 3: Commit and push**

Run: `git commit -m "feat: add complete Balabala listing workflow" && git push origin main && git ls-remote origin refs/heads/main`

Expected: local HEAD and remote `refs/heads/main` match exactly.

- [ ] **Step 4: Record delivery evidence in the durable checkpoint**

Save commit SHA, remote SHA, test/build results and actual request/readback IDs without recording secrets.

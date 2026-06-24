# 深绘 CLI 客户端设计

## 背景

本项目要做一个面向 AI agent 和开发者的深绘开放平台 CLI 客户端。它需要把深绘开放平台 API 文档中的所有 `dp.*` 接口封装成稳定、可脚本化、可审计的本地命令，同时避免 agent 误触发写入、收费或慎用接口。

设计依据：

- 稳定接口参考：`docs/reference/deepdraw-openapi.md`
- 源 PDF：`/Users/xingyicheng/Downloads/深绘开放平台API接口文档202603010.pdf`
- Listingify 参考实现：`/Users/xingyicheng/Documents/Listingify/scripts/lib/deepdraw_client.mjs`
- Listingify SDK 适配参考：`/Users/xingyicheng/Documents/Listingify/scripts/lib/deepdraw_sdk_adapter.mjs`

## 目标

1. 提供统一命令入口 `deepdraw`，让 AI agent 能以 JSON 输入输出调用深绘开放平台。
2. 覆盖参考文档中的所有开放平台接口调用方式：`docs/reference/deepdraw-openapi.md` 的 API 快速索引和正文“接口名称”小节中出现的每个 `dp.*` 接口都必须进入 CLI 接口注册表，并且至少能通过 `deepdraw call <api>` 调用；高频接口再额外提供语义化命令。
3. 支持多租户凭据管理，不要求用户手写 `.env.local`。
4. 对写入、收费、慎用接口默认先生成执行计划，必须获得用户授权后才真正请求深绘。
5. 默认脱敏敏感信息，避免日志、终端输出和仓库文件泄露 `appSecret`、`dopKey` 或签名。
6. 在 macOS、Windows、Linux 上都能完成交互式配置和命令调用。

## 非目标

1. v1 不做图形界面。
2. v1 不把复杂产品字段都做成人类表单；复杂 payload 先通过 JSON 文件输入。
3. v1 不默认真实调用写入或收费接口做自动化测试。
4. v1 不把用户提供的真实密钥写入仓库、设计文档、示例文件或测试夹具。

## 架构方案

采用混合架构：

- Node/TypeScript 作为 CLI 主体，负责命令解析、配置、凭据加载、签名、授权闸门、输出归一、日志和测试。
- 直接 HTTP transport 覆盖商家、类目、基础查询、图片任务查询、颜色等接口。
- Java SDK adapter 覆盖深绘 SDK 映射更复杂的产品创建、产品更新、产品资源读取等接口。
- 所有 transport 对外返回统一 `DeepdrawResult`，上层命令不暴露底层差异。

模块边界：

```text
src/
  cli/
    main.ts
    commands/
  core/
    api-registry.ts
    approval.ts
    config.ts
    credentials.ts
    deepdraw-client.ts
    errors.ts
    result.ts
    signer.ts
  sdk/
    java-adapter.ts
java/
  DeepdrawProductCreateCli.java
  DeepdrawProductResourceCli.java
docs/
  reference/deepdraw-openapi.md
  superpowers/specs/
vendor/
  deepdraw-sdk/
tests/
```

## 命令形态

统一入口：

```bash
deepdraw --help
deepdraw call <api-name> [options]
```

语义化命令：

```bash
deepdraw merchant search --name 森马
deepdraw merchant sites
deepdraw merchant watermarks

deepdraw trade list
deepdraw trade fields --trade-id 123

deepdraw product create --input product.json
deepdraw product update --product-id xxx --input product.json
deepdraw product patch --product-id xxx --input patch.json
deepdraw product resource --code 208226102001 --resource form
deepdraw product search --codes 208226102001,208226103201
deepdraw product basic-search --codes 208226102001
deepdraw product distribution --code 208226102001

deepdraw image retrieve --image-url ...
deepdraw image label --image-url ...
deepdraw image upload --input upload.json
deepdraw image upload-status --task-id ...
deepdraw image update --input update.json

deepdraw color list
```

万能命令：

```bash
deepdraw call dp.product.basic.search --json '{"productCodes":"208226102001"}'
deepdraw call dp.trade.fields --param tradeId=123
deepdraw call dp.product.resource --json-file query.json
```

## 接口注册表

所有参考文档接口必须先进入 `api-registry.ts`。这是 v1 的硬性范围，不允许只实现高频接口，也不允许把文档接口留在“以后补”的状态。

覆盖规则：

1. 以 `docs/reference/deepdraw-openapi.md` 为稳定来源。
2. 从 API 快速索引和正文“接口名称”小节提取全部 `dp.*` 接口。
3. 每个接口必须有注册表条目、风险等级、调用路径、参数定义和 transport 选择。
4. 每个接口必须至少支持 `deepdraw call <api-name>` 调用。
5. 高频接口可以在 `deepdraw call` 之外增加语义化命令，但语义化命令不能替代注册表覆盖。
6. 文档新增接口时，接口覆盖测试必须失败，直到注册表补齐该接口。

每个条目声明：

- `apiName`：例如 `dp.product.basic.search`
- `group`：merchant、trade、product、image、common
- `version`：文档中的 v1/v2
- `transport`：`http` 或 `java-sdk`
- `method`：GET/POST，由当前实现和深绘调用行为决定
- `path`：`/rest` 或 `/rest/v2`
- `riskLevel`：read、caution、write、paid
- `semanticCommand`：可选
- `requiredParams` / `optionalParams`
- `approvalRequired`
- `notes`

初始覆盖：

| 接口 | 语义化命令 | 风险 | 默认 transport |
| --- | --- | --- | --- |
| `dp.merchant.name.search` | `merchant search` | read | http |
| `dp.merchant.sites.get` | `merchant sites` | read | http |
| `dp.merchant.watermarks.get` | `merchant watermarks` | read | http |
| `dp.merchant.trades` | `trade list` | read | http |
| `dp.trade.fields` | `trade fields` | read | http |
| `dp.product.create` | `product create` | write | java-sdk |
| `dp.product.update` | `product update` | write | java-sdk |
| `dp.product.incremental.update` | `product patch` | write | http 或 java-sdk |
| `dp.product.resource` | `product resource` | read | java-sdk |
| `dp.product.search` | `product search` | caution | http |
| `dp.feature.pictures.get` | `product pictures` | read | http |
| `dp.product.basic.search` | `product basic-search` | read | http |
| `dp.product.distribution.get` | `product distribution` | read | http |
| `dp.product.retrieve.image` | `image retrieve` | paid | http |
| `dp.product.distributions.get` | `image distributions` | read | http |
| `dp.product.label.image` | `image label` | paid | http |
| `dp.product.image.upload` | `image upload` | paid/write | http |
| `dp.product.image.query` | `image upload-status` | read | http |
| `dp.product.image.update` | `image update` | paid/write | http |
| `dp.colors.get` | `color list` | read | http |

`deepdraw call` 必须能调用注册表中的全部接口。语义化命令只是更友好的薄封装，不能成为唯一调用入口。

## 配置与凭据

默认不要求用户手写 `.env.local`，而是提供交互式登录：

```bash
deepdraw auth login
```

交互字段：

```text
租户名称
merchantId
appKey
appSecret
dopKey
baseUrl
是否设为默认租户
```

敏感字段输入时隐藏。真实值不得出现在示例、日志或设计文档中。

跨平台凭据存储：

- macOS：Keychain
- Windows：Windows Credential Manager
- Linux：Secret Service / libsecret
- 通用 fallback：仅在用户明确允许时使用本地文件存储敏感字段，并提示安全风险

非敏感配置存储：

- macOS/Linux：`~/.config/deepdraw/config.json`
- Windows：`%APPDATA%\DeepDrawCli\config.json`

推荐存储内容：

```json
{
  "defaultTenant": "电商巴拉巴拉",
  "tenants": {
    "电商巴拉巴拉": {
      "merchantId": "1162",
      "appKeyRef": "deepdraw-cli:tenant:电商巴拉巴拉:appKey",
      "appSecretRef": "deepdraw-cli:tenant:电商巴拉巴拉:appSecret",
      "dopKeyRef": "deepdraw-cli:tenant:电商巴拉巴拉:dopKey",
      "baseUrl": "http://open.deepdraw.cn",
      "timeoutMs": 30000
    }
  }
}
```

配置优先级：

1. 命令行参数
2. 当前进程环境变量
3. 系统凭据仓库和用户配置
4. `.env.local` 兼容 fallback

管理命令：

```bash
deepdraw auth login
deepdraw auth login --stdin-json
deepdraw auth list
deepdraw auth show --tenant 电商巴拉巴拉 --redact
deepdraw auth switch 电商巴拉巴拉
deepdraw auth remove 电商巴拉巴拉
deepdraw auth import-env
deepdraw config doctor
```

`auth login --stdin-json` 用于 agent 或 CI 非交互配置，输入仍不得写入仓库。

## 授权闸门

接口风险分级：

- `read`：只读查询，默认可执行。
- `caution`：查询可能返回大量数据或文档标注慎用，默认要求 `--plan` 或确认。
- `write`：创建、更新、修改数据，默认要求授权。
- `paid`：文档标注额外收费，默认要求授权。

高风险接口默认先生成计划：

```bash
deepdraw product create --input product.json --plan
deepdraw execute <plan-id> --yes
```

交互式终端中可直接提示：

```text
即将调用 dp.product.create，为租户“电商巴拉巴拉”创建产品档案。
风险：写入深绘产品数据。
是否继续？输入 yes 执行：
```

非交互环境中，如果缺少 `--yes`：

- 不调用深绘。
- 退出码为非 0。
- 输出 `error.kind = "approval_required"`。
- 返回脱敏的执行计划，供 agent 向用户请求授权。

计划内容示例：

```json
{
  "action": "deepdraw.product.create",
  "api": "dp.product.create",
  "tenant": "电商巴拉巴拉",
  "riskLevel": "write",
  "requiresApproval": true,
  "summary": "创建产品档案 208226102001",
  "sanitizedParams": {
    "merchantId": "1162",
    "productCode": "208226102001"
  }
}
```

计划文件只保存脱敏摘要和 payload 文件引用，不保存密钥。

## 输出协议

默认输出 JSON。成功结构：

```json
{
  "ok": true,
  "api": "dp.product.basic.search",
  "tenant": "电商巴拉巴拉",
  "requestId": "1068",
  "httpStatus": 200,
  "businessCode": 10200,
  "businessState": "success",
  "data": {}
}
```

失败结构：

```json
{
  "ok": false,
  "api": "dp.product.create",
  "tenant": "电商巴拉巴拉",
  "error": {
    "kind": "deepdraw_business_error",
    "message": "DeepDraw dp.product.create failed",
    "httpStatus": 200,
    "businessCode": 10404,
    "requestId": "..."
  }
}
```

输出选项：

- `--pretty`：格式化 JSON。
- `--raw`：输出深绘原始响应。
- `--out <file>`：保存完整响应。
- `--jsonl`：批量调用时一行一个结果。
- `--quiet`：只输出机器结果，不输出人类提示。

## 错误模型

稳定错误类型：

- `config_missing`
- `credential_missing`
- `credential_store_unavailable`
- `approval_required`
- `input_validation_error`
- `network_timeout`
- `http_error`
- `deepdraw_business_error`
- `sdk_compile_error`
- `sdk_runtime_error`
- `unknown_error`

深绘业务成功判断：

- HTTP 层成功：外层 `status` 或 HTTP status 为 200。
- 业务层成功：`response.code === 10200` 且 `response.response === "success"`。
- 若 SDK 和 HTTP 返回结构不同，先归一为统一 `DeepdrawResult` 再判断。

## 日志与脱敏

日志目录：

- macOS/Linux：`~/.local/state/deepdraw/logs`
- Windows：`%LOCALAPPDATA%\DeepDrawCli\logs`

日志内容：

- 命令名称、接口名、租户名、风险等级
- 脱敏请求参数摘要
- HTTP status、业务 code、requestId
- 错误类型和错误摘要
- 可选输出文件路径

必须脱敏：

- `appSecret`
- `dopKey`
- `x-ca-signature`
- `Authorization`
- 任何包含 `secret`、`token`、`key` 且被标记为 sensitive 的字段

默认不保存完整请求 payload。只有用户显式 `--save-request` 时才保存，并仍然脱敏敏感字段。

## HTTP 签名

HTTP 签名逻辑参考 Listingify 已验证实现：

- GET v2 默认请求 `/rest/v2`
- POST 元数据类接口默认请求 `/rest`
- 公共 query 包含 `dopKey`、`merchantId`、`type`
- header 包含 `x-ca-key`、`x-ca-nonce`、`x-ca-signature-method`、`x-ca-timestamp`、`x-ca-signature-headers`、`x-ca-signature`
- 签名方法为 HmacSHA256，输出 base64
- query 参数按 key 排序并编码
- query 中的 `dopKey`、`merchantId`、`type` 不允许被 payload 覆盖

这些规则必须用单元测试锁住，避免 agent 后续改坏。

## Java SDK Adapter

SDK adapter 的职责：

1. 把 CLI JSON 输入映射成 Java SDK 需要的请求对象。
2. 编译并执行小型 Java bridge。
3. 把 SDK 输出归一为 `DeepdrawResult`。

v1 需要保留两个 bridge：

- `DeepdrawProductCreateCli.java`
- `DeepdrawProductResourceCli.java`

后续如发现 `dp.product.update` 或其他接口直接 HTTP 不稳定，再补对应 Java bridge。

SDK 依赖：

- `vendor/deepdraw-sdk/dop-sdk-*.jar`
- `vendor/deepdraw-sdk/sdk-core-java-*.jar`
- Maven 本地依赖或项目内说明的 runtime jar

如果本机没有 Java 或 SDK jar，相关命令必须给出明确错误，不能静默失败。

## Agent 使用规范

仓库提供 `AGENTS.md`，写明 AI agent 默认行为：

1. 先运行 `deepdraw --help` 或读取 `docs/reference/deepdraw-openapi.md`。
2. 查询类接口可以直接执行。
3. 写入、收费、慎用接口必须先 `--plan`。
4. 只有用户明确授权后才使用 `execute <plan-id> --yes` 或直接带 `--yes`。
5. 读取 `ok`、`error.kind`、`businessCode`、`requestId` 判断结果。
6. 不把真实凭据写入文件、commit、PR 描述或日志。

## 测试策略

单元测试：

- 签名 canonical string 和 header。
- 参数排序、编码、敏感 query 防覆盖。
- 接口注册表包含参考文档 API 快速索引和正文“接口名称”小节中的全部 `dp.*` 接口。
- 覆盖测试从 `docs/reference/deepdraw-openapi.md` 提取接口名，并断言每个接口都有注册表条目和 `deepdraw call` 调用路径。
- 风险分级和授权拦截。
- 输出归一和错误类型。
- 配置优先级。
- 脱敏函数。

凭据测试：

- 使用 fake credential store，不读写真正 Keychain/Credential Manager。
- 验证 `auth login --stdin-json` 能写入 fake store。
- 验证 `auth show --redact` 不泄露敏感字段。

SDK adapter 测试：

- runner mock，不真实调用深绘。
- Java 输出解析。
- SDK input shape。
- SDK 缺失时错误类型。

集成烟测：

- `deepdraw config doctor --dry-run`
- `deepdraw call dp.colors.get --dry-run`
- 有真实凭据时，允许手动执行低风险读接口。
- 写入和收费接口只验证 plan/approval gate，不默认真实请求。

推荐验证命令：

```bash
npm test
npm run lint
npm run build
```

## 交付方式

开发期：

```bash
npm install
npm run build
npm test
npm link
deepdraw --help
```

包交付：

- `package.json` 声明 bin：`deepdraw`
- TypeScript 编译到 `dist/`
- Java bridge 和 SDK jar 路径随包说明明确
- `.env.local` 只作为兼容配置，不作为默认 onboarding

## 实施顺序

1. 初始化 TypeScript CLI 项目、测试框架、构建脚本和 `.gitignore`。
2. 建立 `api-registry.ts`，从 `docs/reference/deepdraw-openapi.md` 固化全部接口条目。
3. 实现配置和跨平台 `CredentialStore` 抽象，先用 fake/file store 测试，再接系统凭据仓库。
4. 实现 HTTP signer、HTTP client、结果归一和错误模型。
5. 实现授权计划、交互确认、`execute <plan-id>`。
6. 接入 Java SDK adapter。
7. 实现语义化命令和 `deepdraw call`。
8. 写 `AGENTS.md` 和使用示例。
9. 运行测试、build、一次低风险 dry-run 验证。

## 风险与处理

| 风险 | 处理 |
| --- | --- |
| 深绘文档和实际 SDK 行为不一致 | 以 Listingify 已验证实现和真实联调结果为准，注册表保留 notes |
| Windows/Linux 凭据仓库不可用 | 提供明确错误和用户确认后的 fallback |
| agent 误触发写入或收费接口 | 风险分级 + 默认 plan + 非交互必须 `--yes` |
| 日志泄露密钥 | 全局脱敏层，测试覆盖敏感字段 |
| SDK jar 或 Java 环境缺失 | SDK 命令启动前做 doctor 检查，错误类型稳定 |
| 产品创建字段复杂 | v1 允许 JSON payload 输入，后续再做高层模板 |

## 验收标准

1. `docs/reference/deepdraw-openapi.md` 是项目内稳定 API 参考。
2. `deepdraw call` 能覆盖 `docs/reference/deepdraw-openapi.md` 中 API 快速索引和正文“接口名称”小节列出的全部 `dp.*` 接口。
3. 高频接口有语义化命令。
4. `auth login` 支持交互式配置，且 macOS、Windows、Linux 有明确凭据策略。
5. 写入、收费、慎用接口在没有授权时不会请求深绘。
6. 成功和失败输出结构稳定，适合 AI agent 解析。
7. 单元测试覆盖签名、配置、授权、输出、错误和接口注册表。
8. 不提交任何真实密钥。

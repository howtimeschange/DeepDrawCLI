# DeepDraw CLI

`deepdraw` 是面向公司内部开发者和 AI agent 的深绘开放平台 OpenAPI 命令行客户端。它把深绘接口调用做成一层可 dry-run、可生成执行计划、可显式授权、可审计的本地工具，避免 agent 或脚本直接拼签名、直接写入、直接触发付费接口。

这个项目目前服务于 Listingify / 深绘上新自动化一类工作流：读取商家、类目、字段模板、商品资料，创建或更新深绘商品，并把商品内容包整理成更适合 AI agent 消费的结构化摘要。

## 项目背景

深绘开放平台的接口有几类现实问题：

- 接口数量多，`dp.*` 参数、版本、风险级别不容易靠记忆维护。
- 部分接口是只读查询，部分接口会写入商品、消耗付费能力或需要谨慎调用。
- 商品创建和更新依赖深绘 Java SDK 的 entity mapping，手写 JSON 容易出现后端序列化问题。
- AI agent 需要一个稳定入口，能先确认参数和风险，再决定是否真实执行。
- Listingify 的上新链路需要兼顾 Node HTTP 签名请求和 Java SDK readback。

因此这个仓库提供一个统一 CLI：

- 所有参考文档里的 `dp.*` 接口都注册在 `src/core/api-registry.ts`。
- 低风险只读接口可以 dry-run 后执行。
- 写入、付费和慎用接口必须先生成执行计划，用户明确授权后才允许执行。
- 商品创建、更新、商品资源读取走 DeepDraw Java SDK bridge。
- 简单元数据和查询接口走 TypeScript HTTP 签名请求。

## 能实现什么效果

使用这个 CLI 后，agent 或开发者可以做到：

- 用一条 `deepdraw call <api-name>` 调用任意已注册深绘接口。
- 先用 `--dry-run` 检查接口和参数，不产生网络请求。
- 对高风险接口先生成计划，看到接口名、租户、参数摘要和风险级别。
- 只有加上 `--execute --yes` 后才真正执行写入、付费或慎用接口。
- 通过 `deepdraw product content` 直接拿到商品摘要、SKU 摘要、商品图片 URL、详情页 URL 和详情模块 URL。
- 在 macOS / Windows 上通过同一套 SDK bundle 运行 Java bridge，无需 Maven 下载。
- 避免把真实 `appSecret`、`dopKey`、签名和租户凭据写入 tracked files。

## 快速上手

### 1. 安装依赖

```bash
npm install
```

### 2. 构建并链接本地命令

```bash
npm run build
npm link
```

链接后可以直接使用：

```bash
deepdraw --help
```

也可以不 link，直接运行构建产物：

```bash
node dist/cli/main.js --help
```

### 3. 检查本地环境

调用真实接口前，先跑：

```bash
deepdraw config doctor --dry-run
```

`doctor` 不联网，也不调用深绘接口。它会检查：

- `java` 是否可用
- `javac` 是否可用
- `vendor/deepdraw-sdk/dop-sdk-1.6.0.jar`
- `vendor/deepdraw-sdk/sdk-core-java-1.1.0.jar`
- `vendor/deepdraw-sdk/lib/*.jar`

### 4. 配置凭据

推荐通过 stdin JSON 写入凭据，避免密钥留在 shell history 里：

```bash
deepdraw auth login --stdin-json < credentials.json
```

示例 `credentials.json`：

```json
{
  "tenantName": "租户名称",
  "merchantId": "1162",
  "appKey": "APP_KEY",
  "appSecret": "APP_SECRET",
  "dopKey": "DOP_KEY",
  "defaultTenant": true
}
```

`credentials.json` 只能保留在本地，不要提交。

默认配置路径：

- macOS/Linux: `~/.config/deepdraw/config.json`
- Windows: `%APPDATA%\DeepDrawCli\config.json`

环境变量优先于本地配置。完整 `DEEPDRAW_*` 环境变量存在时，CLI 会直接使用环境变量：

```bash
export DEEPDRAW_TENANT_NAME="租户名称"
export DEEPDRAW_BASE_URL="http://open.deepdraw.cn"
export DEEPDRAW_MERCHANT_ID="1162"
export DEEPDRAW_APP_KEY="APP_KEY"
export DEEPDRAW_APP_SECRET="APP_SECRET"
export DEEPDRAW_DOP_KEY="DOP_KEY"
```

## 运行依赖

### Node.js

项目要求 Node.js 20 或更高版本。核心脚本：

```bash
npm test
npm run lint
npm run build
```

### Java 和 DeepDraw SDK

以下接口通过 Java SDK bridge 执行：

- `dp.product.create`
- `dp.product.update`
- `dp.product.resource`

这些接口需要本机可用的 `java` 和 `javac`。仓库已经内置 DeepDraw SDK jar 和 Java SDK 运行依赖 jar：

- `vendor/deepdraw-sdk/dop-sdk-1.6.0.jar`
- `vendor/deepdraw-sdk/sdk-core-java-1.1.0.jar`
- `vendor/deepdraw-sdk/lib/*.jar`

`vendor/deepdraw-sdk/lib` 目录必须保留，因为 `sdk-core-java-1.1.0.jar` 会引用 FastJSON、Apache HttpClient、OkHttp、Guava、SLF4J 等依赖。公司内部正常使用时无需 Maven 下载。

如需指定另一套 SDK 目录：

```bash
export DEEPDRAW_SDK_DIR=/absolute/path/to/deepdraw-sdk
```

或直接指定完整 classpath：

```bash
export DEEPDRAW_SDK_CLASSPATH="/absolute/path/deepdraw-sdk/*:/absolute/path/deepdraw-sdk/lib/*"
```

Windows PowerShell：

```powershell
$env:DEEPDRAW_SDK_DIR="C:\deepdraw-sdk"
$env:DEEPDRAW_SDK_CLASSPATH="C:\deepdraw-sdk\*;C:\deepdraw-sdk\lib\*"
```

第一次执行 Java SDK 接口时，CLI 会把 Java bridge class 编译到 `.deepdraw-sdk/classes`。这是本地生成目录，已被 git 忽略。

## 常用命令

### 查看帮助

```bash
deepdraw --help
deepdraw call --help
```

### 通用 dry-run

```bash
deepdraw call dp.colors.get --dry-run
deepdraw call dp.product.resource --param productCode=208226102001 --param resource=form --dry-run
```

不加 `--execute` 时，`deepdraw call` 默认也是 dry-run，不会联网。

### 执行只读接口

```bash
deepdraw call dp.colors.get --execute
deepdraw call dp.product.basic.search --execute --param merchantId=1162 --param productCodes=208226102001
```

部分接口如果 `merchantId` 是必填项，CLI 可以从已解析配置里补默认商户。

### 抽取商品内容包

Listingify 常用的商品资料读取，优先用：

```bash
deepdraw product content --product-code 208326105214 --summary --assets --dry-run
deepdraw product content --product-code 208326105214 --summary --assets --execute
```

`deepdraw product content` 底层通过 Java SDK 调用 `dp.product.resource`，但不会直接输出完整原始大 JSON，而是抽取：

- `summary`: 款号、DeepDraw productId、标题、品牌、类目、颜色数、尺码数、SKU 数、图片数、详情页资源数。
- `skus`: 颜色、尺码、商家编码、条形码、SKU 编码、价格、数量。
- `assets.pictures`: 商品图片 URL，含 `place`、`pictureType`、`skc`、颜色、尺寸、水印标记。
- `assets.detailPages`: 详情页图片版 URL、截图切片 URL。
- `assets.detailModules`: 详情模块 URL。

也支持资源过滤参数：

```bash
deepdraw product content \
  --product-code 208326105214 \
  --resource form \
  --skc skc01,skc02 \
  --material 1 \
  --video 1 \
  --detail-page-site TMALL \
  --exclude-detail-page-modules usemap,尺码表 \
  --summary \
  --assets \
  --execute
```

### 高风险接口先生成计划

写入、付费和慎用接口不能直接真实调用。先生成计划：

```bash
deepdraw call dp.product.create \
  --execute \
  --plan \
  --param merchantId=1162 \
  --param tradeId=TRADE_ID \
  --json-file product.json
```

用户确认后，才允许执行：

```bash
deepdraw call dp.product.create \
  --execute \
  --yes \
  --param merchantId=1162 \
  --param tradeId=TRADE_ID \
  --json-file product.json
```

不要把 `--plan` 当成执行授权。`--plan` 只代表生成计划，不代表用户同意真实调用。

### JSON 输入

小 payload 可以直接用 `--json`：

```bash
deepdraw call dp.product.image.update \
  --execute \
  --plan \
  --param merchantId=1162 \
  --json '{"images":[]}'
```

复杂 payload 推荐用 `--json-file`：

```bash
deepdraw call dp.product.update \
  --execute \
  --plan \
  --param productId=PRODUCT_ID \
  --json-file product.json
```

Java SDK bridge 接口会把 `--json-file product.json` 作为 SDK entity payload 输入，例如 `dp.product.create` 和 `dp.product.update`。

## 已支持接口

完整接口目录以 `src/core/api-registry.ts` 为准。当前按业务域分为：

| 领域 | 代表接口 | 说明 |
| --- | --- | --- |
| merchant | `dp.merchant.name.search`, `dp.merchant.sites.get`, `dp.merchant.watermarks.get` | 查询商家和商户平台信息 |
| trade | `dp.merchant.trades`, `dp.trade.fields` | 同步类目树和类目字段模板 |
| product | `dp.product.create`, `dp.product.update`, `dp.product.resource`, `dp.product.basic.search` | 商品创建、更新、查重、readback 和基础查询 |
| image | `dp.product.retrieve.image`, `dp.product.label.image`, `dp.product.image.upload` | 以图搜款、图片标签、素材上传和图片修改 |
| common | `dp.colors.get` | 深绘标准颜色 |

transport 策略：

- `http`: TypeScript 手写签名请求，适合简单查询、元数据同步和轻量接口。
- `java-sdk`: Java SDK bridge，适合商品创建、商品更新、商品资源读取等和 SDK entity mapping 强相关的接口。

风险策略：

- `read`: 低风险只读接口。
- `caution`: 慎用接口，执行前要计划和授权。
- `write`: 写入接口，执行前要计划和授权。
- `paid`: 付费接口，执行前要计划和授权。
- `paid_write`: 付费且写入接口，执行前要计划和授权。

## 项目架构

```text
.
├── src/
│   ├── cli/
│   │   ├── main.ts              # CLI 入口
│   │   ├── run.ts               # 命令解析、授权、执行分发
│   │   └── format.ts            # JSON 输出格式
│   ├── core/
│   │   ├── api-registry.ts      # dp.* 接口注册表
│   │   ├── approval.ts          # 风险分级、执行计划和授权判断
│   │   ├── config.ts            # 配置和租户解析
│   │   ├── credentials.ts       # 凭据存取抽象
│   │   ├── deepdraw-client.ts   # HTTP transport 调用
│   │   ├── signer.ts            # DeepDraw HTTP 签名
│   │   ├── result.ts            # 响应归一化
│   │   ├── product-content.ts   # 商品内容包抽取
│   │   ├── redact.ts            # 敏感字段脱敏
│   │   └── reference-parser.ts  # 文档接口索引解析
│   └── sdk/
│       └── java-adapter.ts      # Java SDK bridge 编译与调用
├── java/
│   ├── DeepdrawProductCreateCli.java
│   ├── DeepdrawProductUpdateCli.java
│   └── DeepdrawProductResourceCli.java
├── vendor/deepdraw-sdk/         # SDK jar 和 Java 运行依赖
├── docs/reference/
│   └── deepdraw-openapi.md      # 深绘 OpenAPI agent-readable 参考文档
├── tests/                       # node:test 测试
├── AGENTS.md                    # AI agent 调用规范
└── README.md
```

## 实现方式

### 1. 接口注册表驱动

所有接口先进入 `apiRegistry`，声明：

- `apiName`
- 标题和业务分组
- 版本、路径、HTTP method
- transport: `http` 或 `java-sdk`
- riskLevel 和 approvalRequired
- requiredParams / optionalParams
- 通用调用命令和语义化命令

CLI 根据注册表统一处理 dry-run、参数校验、风险授权和 transport 分发。语义化命令只能是注册接口的薄封装，不能绕过 `api-registry`。

### 2. HTTP transport

`src/core/deepdraw-client.ts` 负责执行 HTTP 接口。它会：

- 读取 `apiRegistry` 中的 method、path、apiName。
- 通过 `src/core/signer.ts` 构造 DeepDraw 签名 URL 和请求头。
- 禁止 GET/HEAD 携带 body。
- 解析 JSON 或原始文本响应。
- 用 `normalizeDeepdrawPayload` 规整为统一结果结构。

### 3. Java SDK transport

`src/sdk/java-adapter.ts` 负责 Java SDK bridge：

- 根据接口名选择 Java class。
- 解析 SDK classpath。
- 首次执行时编译 `java/*.java` 到 `.deepdraw-sdk/classes`。
- 将配置、query 和 payload 通过 stdin JSON 传给 Java CLI。
- 解析 Java 输出并归一化为 CLI 结果。

当前 Java bridge：

- `DeepdrawProductCreateCli`: 调用 `ProductPostCreateProductRequest`。
- `DeepdrawProductUpdateCli`: 调用 `ProductPostUpdateProductByIdRequest`。
- `DeepdrawProductResourceCli`: 调用 `ProductGetByIdRequest`，并额外保留 SDK 没有显式 setter 的新版 query 参数。

### 4. 授权和计划

`src/core/approval.ts` 根据 `apiRegistry` 的风险级别判断是否允许执行：

- 低风险只读接口可以直接 `--execute`。
- `write`、`paid`、`paid_write`、`caution` 必须走计划和 `--yes`。
- `--plan` 会生成计划，但不会执行真实调用。
- 计划中的敏感字段会通过 `redactSensitive` 脱敏。

### 5. 商品内容包抽取

`src/core/product-content.ts` 把 `dp.product.resource` 的大 JSON 抽成 agent 更容易处理的结构：

- 商品摘要
- SKU 摘要
- 图片资源
- 详情页资源
- 详情模块资源

这让后续 agent 不需要直接遍历完整深绘原始响应。

## AI agent 使用规则

Agent 调用本项目时应遵守：

1. 先 `deepdraw config doctor --dry-run`，确认本地 Java 和 SDK 依赖可用。
2. 只读接口先 dry-run，再按需 `--execute`。
3. 写入、付费、慎用接口先 `--execute --plan`。
4. 等用户明确授权后，才加 `--execute --yes`。
5. 如果返回 `error.kind = "approval_required"`，必须停下来问用户，不要自行补 `--yes`。
6. 不要把真实 `appSecret`、`dopKey`、签名、租户凭据 JSON 写入 tracked files。
7. 批量读取深绘接口必须串行队列，不要并发打同一租户。

## 调用频率与退避

深绘会对部分接口做频控。实测 `dp.product.resource` 连续矩阵调用后返回过 `10494` / `访问频率过高，请稍后重试`，并且冷却 120 秒后仍可能未恢复。

建议：

- 商品资料拉取放进串行队列。
- 常规读取至少间隔 3-5 秒。
- 批量拉取 `dp.product.resource` 从 5 秒间隔起步。
- 遇到 `10494` 后停止当前批次，冷却 3-5 分钟。
- 恢复后使用指数退避：5 秒、10 秒、20 秒。

## 常见错误

| 错误 | 含义 | 处理方式 |
| --- | --- | --- |
| `approval_required` | 接口需要用户授权 | 展示计划和风险，等待用户确认 |
| `Cannot combine --dry-run and --execute` | 参数冲突 | 移除其中一个参数 |
| `Invalid JSON` | `--json` 或 stdin JSON 格式错误 | 修正 JSON，或改用 `--json-file` |
| `Missing required parameters` | 缺少必填参数 | 查看 `docs/reference/deepdraw-openapi.md` 和 `src/core/api-registry.ts` |
| `10494` / `访问频率过高` | 深绘侧频控 | 停止并发，冷却后单次探测 |
| `Failed to compile DeepDraw Java SDK bridge` | JDK 或 SDK jar 配置异常 | 先跑 `deepdraw config doctor --dry-run` |

如果返回包含 `requestId`，反馈给用户或深绘侧排查时要保留。

## 开发与验证

修改 CLI、接口注册表、Java bridge 或 agent 文档后，至少运行：

```bash
npm test
npm run lint
npm run build
```

常用 smoke test：

```bash
deepdraw config doctor --dry-run
deepdraw call dp.colors.get --dry-run
deepdraw call dp.product.resource --dry-run
```

如果改了 Java bridge，可以额外用本机 JDK 编译：

```bash
mkdir -p .deepdraw-sdk/check-classes
javac -encoding UTF-8 \
  -cp "vendor/deepdraw-sdk/*:vendor/deepdraw-sdk/lib/*" \
  -d .deepdraw-sdk/check-classes \
  java/DeepdrawProductCreateCli.java \
  java/DeepdrawProductUpdateCli.java \
  java/DeepdrawProductResourceCli.java
```

也可以用 `DEEPDRAW_SDK_DUMP_REQUEST=1` 检查 Java SDK 最终生成的 request query，避免新版参数被静默丢弃。

## 参考文档

- 深绘接口参考：[docs/reference/deepdraw-openapi.md](docs/reference/deepdraw-openapi.md)
- Agent 调用指南：[AGENTS.md](AGENTS.md)
- 接口注册表：[src/core/api-registry.ts](src/core/api-registry.ts)

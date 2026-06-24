# 深绘 CLI Agent 调用指南

本项目提供 `deepdraw` CLI，用于让 AI agent 和内部开发者以可审计、可 dry-run、可授权的方式调用深绘开放平台 OpenAPI。

## 基本原则

1. 调整或新增接口行为前，先阅读 `docs/reference/deepdraw-openapi.md`。
2. 参考文档里的每个 `dp.*` 接口都必须注册到 `src/core/api-registry.ts`，并至少支持 `deepdraw call <api-name>` 调用。
3. 语义化命令只能作为注册接口的薄封装，不能绕过 `api-registry`。
4. 写入、付费、慎用接口必须先生成执行计划，不能直接真实调用。
5. 用户明确授权 `--execute --yes` 之后，才允许真正执行写入、付费或慎用接口。
6. 如果 CLI 返回 `error.kind = "approval_required"`，必须停下来询问用户，不能自行补 `--yes`。
7. 不要把真实 `appSecret`、`dopKey`、签名、租户凭据 JSON 写入 tracked files。
8. 测试里优先使用 fake credential store、mock fetch 和 mock Java runner。

## 接口目录与调用方法

下表来自 `src/core/api-registry.ts`，是 agent 选择接口和命令的第一入口。`riskLevel` 为 `write`、`paid`、`paid_write` 或 `caution` 的接口，真实执行前必须先走 `--execute --plan` 和用户授权流程。

### merchant

| 接口 | 说明 | 风险级别 | transport | 通用调用命令 | 语义化命令 |
| --- | --- | --- | --- | --- | --- |
| `dp.merchant.name.search` | 查询商家信息 | `read` | `http` | `deepdraw call dp.merchant.name.search --param name=森马` | `deepdraw merchant search` |
| `dp.merchant.sites.get` | 获取商户支持平台 | `read` | `http` | `deepdraw call dp.merchant.sites.get` | `deepdraw merchant sites` |
| `dp.merchant.watermarks.get` | 查询水印信息 | `read` | `http` | `deepdraw call dp.merchant.watermarks.get` | `deepdraw merchant watermarks` |

### trade

| 接口 | 说明 | 风险级别 | transport | 通用调用命令 | 语义化命令 |
| --- | --- | --- | --- | --- | --- |
| `dp.merchant.trades` | 获取类目 | `read` | `http` | `deepdraw call dp.merchant.trades --param merchantId=MERCHANT_ID` | `deepdraw trade list` |
| `dp.trade.fields` | 获取类目字段 | `read` | `http` | `deepdraw call dp.trade.fields --param merchantId=MERCHANT_ID --param tradeId=123` | `deepdraw trade fields` |

### product

| 接口 | 说明 | 风险级别 | transport | 通用调用命令 | 语义化命令 |
| --- | --- | --- | --- | --- | --- |
| `dp.product.create` | 创建产品 | `write` | `java-sdk` | `deepdraw call dp.product.create --param merchantId=MERCHANT_ID --param tradeId=TRADE_ID --json-file product.json --plan` | `deepdraw product create` |
| `dp.product.update` | 更新产品 | `write` | `java-sdk` | `deepdraw call dp.product.update --param productId=PRODUCT_ID --json-file product.json --plan` | `deepdraw product update` |
| `dp.product.incremental.update` | 产品增量更新 | `write` | `http` | `deepdraw call dp.product.incremental.update --param productId=PRODUCT_ID --json-file patch.json --plan` | `deepdraw product patch` |
| `dp.product.resource` | 获取产品指定类型资源 | `read` | `java-sdk` | `deepdraw call dp.product.resource --param productCode=208226102001 --param resource=form` | `deepdraw product resource` |
| `dp.product.search` | 查询产品列表（慎用） | `caution` | `http` | `deepdraw call dp.product.search --param merchantId=MERCHANT_ID --param productCodes=208226102001 --plan` | `deepdraw product search` |
| `dp.feature.pictures.get` | 获取商品指定类型素材/资源图原图 | `read` | `http` | `deepdraw call dp.feature.pictures.get --param productCode=208226102001 --param pictureType=MODEL` | `deepdraw product pictures` |
| `dp.product.basic.search` | 查询产品基础信息列表 | `read` | `http` | `deepdraw call dp.product.basic.search --param merchantId=MERCHANT_ID --param productCodes=208226102001` | `deepdraw product basic-search` |
| `dp.product.detail.get` | 查询产品详情页 | `read` | `http` | `deepdraw call dp.product.detail.get --param productId=PRODUCT_ID` | - |
| `dp.product.distribution.get` | 查询产品上架状态 | `read` | `http` | `deepdraw call dp.product.distribution.get --param productId=PRODUCT_ID` | `deepdraw product distribution` |

### image

| 接口 | 说明 | 风险级别 | transport | 通用调用命令 | 语义化命令 |
| --- | --- | --- | --- | --- | --- |
| `dp.product.retrieve.image` | 以图搜款-款号接口 | `paid` | `http` | `deepdraw call dp.product.retrieve.image --param merchantId=MERCHANT_ID --param url=https://example.test/a.jpg --plan` | `deepdraw image retrieve` |
| `dp.product.distributions.get` | 以图搜款-查询上货记录 | `read` | `http` | `deepdraw call dp.product.distributions.get --param productId=PRODUCT_ID` | `deepdraw image distributions` |
| `dp.product.label.image` | 图片服装多标签分析 | `paid` | `http` | `deepdraw call dp.product.label.image --param url=https://example.test/a.jpg --plan` | `deepdraw image label` |
| `dp.product.image.upload` | 图片素材上传接口 | `paid_write` | `http` | `deepdraw call dp.product.image.upload --json-file upload.json --plan` | `deepdraw image upload` |
| `dp.product.image.query` | 查询上传图片素材任务接口 | `paid` | `http` | `deepdraw call dp.product.image.query --param taskId=TASK_ID` | `deepdraw image upload-status` |
| `dp.product.image.update` | 图片修改 | `paid_write` | `http` | `deepdraw call dp.product.image.update --json-file update.json --plan` | `deepdraw image update` |

### common

| 接口 | 说明 | 风险级别 | transport | 通用调用命令 | 语义化命令 |
| --- | --- | --- | --- | --- | --- |
| `dp.colors.get` | 获取深绘标准颜色 | `read` | `http` | `deepdraw call dp.colors.get` | `deepdraw color list` |

## Windows/macOS 配置检查

调用任何真实接口前，先检查本地配置、JDK、SDK jar 和 Java 运行依赖是否齐全：

```bash
deepdraw config doctor --dry-run
```

`doctor` 不会联网，也不会调用深绘接口。它会检查：

- `java` 和 `javac` 是否可用
- `vendor/deepdraw-sdk/dop-sdk-1.6.0.jar`
- `vendor/deepdraw-sdk/sdk-core-java-1.1.0.jar`
- `vendor/deepdraw-sdk/lib/*.jar`

默认配置路径：

- macOS/Linux: `~/.config/deepdraw/config.json`
- Windows: `%APPDATA%\DeepDrawCli\config.json`

如果需要手动指定 SDK 路径：

```bash
export DEEPDRAW_SDK_DIR=/absolute/path/to/deepdraw-sdk
```

Windows PowerShell 使用：

```powershell
$env:DEEPDRAW_SDK_DIR="C:\deepdraw-sdk"
```

## 凭据配置

推荐让 agent 通过 stdin JSON 写入凭据，避免在 shell history 里留下密钥：

```bash
deepdraw auth login --stdin-json < credentials.json
```

`credentials.json` 可以包含当前租户需要的字段，但该文件只能保留在本地，不能提交：

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

环境变量仍然优先于本地配置；当完整 `DEEPDRAW_*` 环境变量存在时，CLI 会使用环境变量。

## 只读调用

只读接口可以先 dry-run，确认 CLI 解析到正确接口和参数：

```bash
deepdraw call dp.colors.get --dry-run
```

确认无误后，低风险只读接口可以真实执行：

```bash
deepdraw call dp.colors.get --execute
```

Listingify 常用的商品内容包读取，优先用语义化命令直接抽取整体资料、商品图片 URL、详情页 URL 和 SKU 摘要：

```bash
deepdraw product content --product-code 208326105214 --summary --assets --dry-run
deepdraw product content --product-code 208326105214 --summary --assets --execute
```

`deepdraw product content` 底层通过 Java SDK 调用 `dp.product.resource`，输出 `summary`、`skus`、`assets.pictures`、`assets.detailPages` 和 `assets.detailModules`，避免 AI agent 处理完整原始大 JSON。

带参数的只读接口示例：

```bash
deepdraw call dp.product.basic.search --dry-run --param merchantId=1162 --param productCodes=208226102001
```

## 写入调用

写入接口必须先生成执行计划，给用户确认影响范围：

```bash
deepdraw call dp.product.create --execute --plan --param merchantId=1162 --param tradeId=TRADE_ID --json-file product.json
```

用户确认后，才允许加 `--yes` 执行：

```bash
deepdraw call dp.product.create --execute --yes --param merchantId=1162 --param tradeId=TRADE_ID --json-file product.json
```

不要把 `--plan` 当成执行授权。`--plan` 只生成计划，不代表用户同意真实调用。

## JSON 输入

小 payload 可以直接用 `--json`：

```bash
deepdraw call dp.product.image.update --execute --plan --param merchantId=1162 --json '{"images":[]}'
```

复杂商品 payload 使用 `--json-file`，便于审查和复用：

```bash
deepdraw call dp.product.update --execute --plan --param productId=PRODUCT_ID --json-file product.json
```

对于 Java SDK bridge 接口，`--json-file product.json` 会作为 SDK entity payload 输入，例如：

- `dp.product.create`
- `dp.product.update`

## 授权流程

Agent 执行高风险接口时必须遵守这个顺序：

1. 先运行 `--dry-run` 或 `--execute --plan`。
2. 把计划摘要、接口名、关键参数和风险说明给用户看。
3. 等用户明确同意执行。
4. 只有在用户授权后，才运行带 `--execute --yes` 的命令。

如果用户只说“看看”“检查一下”“生成计划”，不要执行真实调用。

## 调用频率

深绘会对部分读取接口做频控。实测 `dp.product.resource` 在连续矩阵调用后返回过 `10494` / `访问频率过高，请稍后重试`，并且 120 秒后仍可能未恢复。Agent 必须按串行队列调用深绘接口：

- 商品资料拉取优先排队执行，不并发请求同一租户。
- 常规读取建议至少间隔 3-5 秒；批量商品资料拉取建议从 5 秒间隔起步。
- 一旦遇到 `10494`，停止当前批次，至少冷却 3-5 分钟，再用单次请求探测恢复。
- 恢复后使用指数退避：5 秒、10 秒、20 秒；再次出现 `10494` 就重新进入冷却。

## 错误处理

常见错误和处理方式：

| 错误 | 含义 | Agent 应对 |
| --- | --- | --- |
| `approval_required` | 接口需要用户授权 | 停止执行，把计划或风险说明发给用户，等待确认 |
| `Cannot combine --dry-run and --execute` | 参数冲突 | 移除其中一个参数后重试 |
| `Invalid JSON` | `--json` 或 stdin JSON 无法解析 | 让用户修正 JSON，或改用 `--json-file` |
| `Missing required param` | 缺少必填参数 | 查 `docs/reference/deepdraw-openapi.md` 和 `src/core/api-registry.ts` 后补参数 |
| `10494` / `访问频率过高` | 深绘侧频控 | 停止并发和批量调用，等待 3-5 分钟后单次重试 |
| `Failed to compile DeepDraw Java SDK bridge` | JDK 或 SDK jar 配置异常 | 先运行 `deepdraw config doctor --dry-run`，再检查 JDK 和 `vendor/deepdraw-sdk` |

如果返回里包含 `requestId`，需要在反馈给用户时保留它，方便深绘侧排查。

## 开发与验证命令

修改 CLI、接口注册表或 agent 文档后，至少运行：

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

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
| `dp.product.incremental.update` | 产品增量更新 | `write` | `java-sdk` | `deepdraw call dp.product.incremental.update --param productId=PRODUCT_ID --json-file patch.json --plan` | `deepdraw product patch` |
| `dp.product.sku.color.incremental.update` | 产品颜色与 SKU 增量更新（特殊用户定制需求） | `write` | `java-sdk` | `deepdraw call dp.product.sku.color.incremental.update --param productId=PRODUCT_ID --json-file product.json --plan` | - |
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
- `vendor/deepdraw-sdk/dop-sdk-1.6.24.jar`
- `vendor/deepdraw-sdk/sdk-core-java-1.1.0.jar`
- `vendor/deepdraw-sdk/lib/*.jar`

当前 vendor SDK 固定为 `dop-sdk-1.6.24.jar`，SHA-256 为 `1cd9f7f37a76a16e8a2e102b0e78b19470319d743d66a5af93ab58bb87fb2ed8`；`sdk-core-java-1.1.0.jar` 和 `lib/*.jar` 是配套运行依赖。来源、校验值和目录布局见 `vendor/deepdraw-sdk/README.md`。

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

新版 1.6.24 读回还会保留 `summary.remark`、`summary.complete`、`summary.tags`，以及详情页的 `templateWidth`、`templateSites`、`active` 和 `assets.videos`。其中 `complete=false` 表示草稿，`active=false` 表示详情页禁用；这些状态必须在后续人工确认中保留，不能因为 HTTP 200 就当作已完成上架。

商品内容包需要按标签过滤时，可传 `--tags 标签1,标签2`；该参数最终对应 `dp.product.resource` 的 `tags` 查询条件。

## 本地构建巴拉巴拉商品 payload

`deepdraw product payload` 是纯本地的 payload 构建器，不属于一个新的 `dp.*` 接口：它不读取凭据、不联网、不调用 Java，也不会发布商品。默认租户是 `电商巴拉巴拉`，默认 `merchantId` 是 `1162`，可用 `--tenant` 和 `--merchant-id` 覆盖显示参数。

```bash
deepdraw product payload --input draft.json --stage create --pretty
deepdraw product payload --input draft.json --stage update --pretty
```

输入可以是草稿对象，也可以包在 `product`、`draft` 或 `payload` 下。字段数组支持 `value`、`value_text`、`value_json` 三种常见形态：

```json
{
  "code": "204426140121",
  "title": "巴拉巴拉儿童运动鞋",
  "tradeId": "546",
  "productId": "6518125",
  "productType": "shoe",
  "date": "2026-09-04",
  "retailPrice": 359.9,
  "sizeRemarks": { "26码": "脚长15.8-16.2/内长17" },
  "fields": [
    { "field_name": "颜色", "field_type": "TEXT", "value_text": "蓝色,蓝色调00388" },
    { "field_name": "尺码", "field_type": "MULTI_CHOICE", "value_text": "26;27" },
    {
      "field_name": "尺码表",
      "field_type": "MULTI_TEXT",
      "value_json": { "title": "尺码,适合脚长,内长", "26": "15.8,17", "27": "16.3,17.7" }
    }
  ],
  "skus": [
    { "skuCode": "sku-26", "skcCode": "skc-00388", "color": "蓝色调00388", "size": "26", "sellerCode": "seller-26", "price": 359.9 }
  ]
}
```

输出字段含义：

- `sdkInput.product` 是 Java SDK bridge 实际消费的商品实体；顶层审查结果不是 `deepdraw call` 的直接 body。
- `sdkInput.query` 在 create 阶段是 `merchantId + tradeId`，在 update 阶段是 `productId`；`sdkInput.config` 不包含 appSecret、dopKey 或签名。
- `fields` 是当前阶段的审查字段；`legacyUpdateFields` 是完整更新字段集。`dp.product.update` 是覆盖式更新，update 输入必须带完整商品字段、颜色、销售尺码、商家 SKU、主表和已有平台尺码表，不能用小 patch 代替。
- `sizes.options` 是规范尺码，`sizes.optionAliases` 是规范尺码到展示尺码的映射，`sizes.texts` 使用 `s<尺码>,<展示值>,<平台>` 形式输出；这些内容与 `sdkInput.product.fields` 一起用于审查。

巴拉巴拉最新字段组装规则：

- 鞋品内部销售尺码只允许整数规范值，例如 `26`、`27`，不生成半码；展示 alias 为 `26码`、`27码`。销售尺码备注使用 `尺码*备注`，例如 `26码*脚长15.8-16.2/内长17`。
- 鞋品主表固定为 `尺码,脚长,鞋内长`；传给 SDK 的商品字段去掉重复的销售尺码列，实际为 `脚长,鞋内长`。唯品会欧洲码传裸数字。
- 鞋品多平台尺码固定六列 `天猫,京东,拼多多,微信视频小店,小红书,快手`；天猫/快手留空，京东填裸数字，拼多多/微信视频小店/小红书填带备注展示值。
- 服饰销售尺码使用 `140cm` 这类展示值，主表第二个尺码列使用裸数字 `140`；上装、牛仔裤使用固定表头；缺失测量值留空而不是 `0`；巴拉巴拉服饰尺码会使用内置体重参考，例如 `140 -> 31kg`。
- create 阶段发送主尺码表和多平台尺码；update 阶段发送主表、唯品会、天猫、抖音及多平台尺码，避免覆盖式更新导致已有 SKU 或尺码表消失。鞋品 `淘宝尺码表` 会省略并记录 warning。

这个命令只负责本地构建和审查。真实创建/更新仍须对注册的 `dp.product.create` 或 `dp.product.update` 先执行 `--execute --plan`，获得用户明确授权后才能执行 `--execute --yes`；`10200` 或 HTTP 200 也不能替代资源回读。

## 巴拉上新流程

新增状态型流程优先于手写 `draft.json`：

```bash
deepdraw balabala import --spu SPU --mdm SKU.xlsx --launch-plan PLAN.xlsx --copywriting COPY.xlsx
deepdraw balabala template --spu SPU --execute
deepdraw balabala review --spu SPU [--ai-responses AI.json] [--ocr-facts OCR.json]
deepdraw balabala sync --spu SPU --execute
deepdraw balabala override --spu SPU --field FIELD --value VALUE
deepdraw balabala plan create|full-update|incremental --spu SPU --execute --plan
deepdraw balabala publish create|full-update|incremental --spu 204426140121-test --execute --yes
deepdraw balabala readback --spu SPU --execute
```

- `.deepdraw-workflows/balabala/<spu>/` 是本地且 Git 忽略的审计缓存；绝不写入原始表格/图片、凭据、签名或 token。
- `import` 不读取凭据、不联网；XLSX 必须扫描真实单元格，不能信任 worksheet dimension。颜色/SKU 永远以 MDM 完整集合为准。
- `template` 串行调用 `dp.merchant.trades` 与 `dp.trade.fields`。后者是当前字段 ID、枚举、必填、销售属性和子字段激活的唯一权威。
- AI/OCR 只审计调用方提供的本地 JSON。AI 必须满足当前枚举、字段激活、证据和 `>=0.7` 置信度；AI 不可填价格、条码、合规、SKU 或真实尺码事实。OCR 必须引用图片 SHA-256 和原文。
- `sync` 从 `resource=form` 保存原始远端快照，并将远端字段、颜色别名、销售尺码、数值写入 `productId` 与 UUID 回读 `resourceId` 分别保存。`override` 仅本地修改已同步的普通标量字段并记录人工覆盖；不能改颜色、尺码、商家 SKU 或尺码表。
- `full-update` 先回读并要求商家 SKU 的规范颜色+尺码交集。普通 `incremental` 只可改标量并自动携带颜色与尺码；尺码表、商家 SKU、颜色/SKU 改动禁止走普通增量。
- 真实 `publish` 在 CLI 内仅允许 `204426140121-test`。所有写入先 `--execute --plan`，再由用户明确 `--execute --yes`；写后必须 `resource=form` 回读。`10200`、HTTP 200 或丢失响应不能跳过回读。

优先使用 `deepdraw balabala` 将巴拉巴拉字段组装、查重/回读、创建和全量更新串在同一命令空间。该流程始终通过 `api-registry` 的注册接口执行，并在输出中标记 `workflow: "balabala-listing"`：

```bash
# 纯本地审查当前类目模板、输入证据、AI 候选和尺码表
deepdraw balabala review --input draft.json

# 以 resource=form 查询款号，先 dry-run；确认后才读取真实资源
deepdraw balabala query --product-code 204426140121
deepdraw balabala query --product-code 204426140121 --execute

# 创建：先计划，用户明确批准后才允许 --yes
deepdraw balabala create --input draft.json --execute --plan
deepdraw balabala create --input draft.json --execute --yes

# 创建返回 productId 后，完整更新稳定尺码表、颜色与 SKU
deepdraw balabala full-update --input draft.json --execute --plan
deepdraw balabala full-update --input draft.json --execute --yes

# 增量更新：指定普通变动字段；颜色与尺码会自动随请求携带
deepdraw balabala incremental --input draft.json --fields 商品展示标题 --execute --plan
deepdraw balabala incremental --input draft.json --fields 商品展示标题 --execute --yes
```

- `create` 使用创建阶段字段：主尺码表和多平台尺码；创建成功后必须以资源回读取得/确认 `productId`，再决定是否执行 `full-update`。
- `full-update` 使用覆盖式完整字段集，包含颜色、销售尺码、商家 SKU、主表和稳定的平台尺码表；不能把小 patch 当作全量 body。
- 增量更新（`incremental`）只可更新当前模板中的普通字段，必须用 `--fields` 写明本次变动字段；CLI 自动携带完整的 `颜色` 与 `尺码`，不能省略。
- 已使用 `204426140121-test` 完成“展示标题 → 资源回读 → 恢复 → 资源回读”联调：两次业务码均为 `10200`，恢复后颜色 2、尺码 15、SKU 30，且主表、唯品会、天猫、抖音四张各 15 行尺码表均在。
- `尺码表`、`唯品会尺码表`、`天猫尺码表`、`抖音尺码表`、`多平台尺码` 和 `商家SKU` 禁止走巴拉增量流程，统一使用全量更新（`full-update`）并资源回读；多平台尺码尚无安全的增量写入结论。

`review`、`create`、`full-update` 和 `incremental` 的草稿输入必须有 `templateFields`：它必须是本次 `merchantId + tradeId` 的最新 `dp.trade.fields` 返回，不能用历史类目白名单。`templateFields` 支持 API 原始的 `id/name/type/options/required/isSaleProp/attributes` 和 snake_case 字段。CLI 会只保留当前模板中的字段，并在 `attributes.isChildAttr=true` 时依据 `parentAttr + parentAttrValue` 激活子字段。

先用 `deepdraw call dp.trade.fields --execute --param merchantId=1162 --param tradeId=TRADE_ID` 读取当前模板，再把响应 body 放进 `templateFields`。读取不是写入授权，仍要遵守本文件的频控要求。

输入证据按事实来源传入：`mdm`（类目、SKU 颜色和销售尺码）、`launchPlan`（日期/价格）、`copywriting`（标题/材质/卖点）、`ocrEvidence`（吊牌/洗唛文本），字段必须用 `source_type` 表明来源。传了 SKU、尺码表或商家 SKU 后，当前模板中全部 `isSaleProp=true` 的字段都是必填，缺失会阻断计划。

鞋品需要 `sizeChart.source=shoe_size_chart` 且每个 SKU 尺码有对应行；服饰需要 `sizeChart.source=plm_size_chart`。尺码表只接受这两类可追溯来源，绝不能让 AI 或图片生成；服饰缺 PLM 量点时留空并阻断，不能填 `0`。输出仍按鞋品整数销售尺码/六码多平台列，以及服饰 `cm` 展示尺码/裸数字量点来组装。

AI 只可填 `review.aiCandidates` 中、具有当前模板枚举的字段。将建议作为 `aiResponses`（`fieldName/value/confidence/evidence`）传入；仅置信度 `>= 0.7`、命中枚举、有证据、未覆盖人工字段的建议会被接纳。最多 4 张 jpeg/png/webp 参考图，每张不超过 4MB，排序为平铺图、主图、模特图、参考图、吊牌、洗唛。AI 不得填价格、产地、条码、生产/合规事实、SKU、销售尺码或真实尺码表。

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

## 1.6.24 字段与建档边界

- `dp.product.resource`、`dp.product.search`、`dp.feature.pictures.get`、`dp.product.basic.search` 都支持可选查询条件 `tags`；多个标签使用英文逗号分隔。
- `dp.product.detail.get` 支持可选 `detailPageSite`，用于按平台过滤详情页；`excludeDetailPageModules` 仍用于按模块过滤。
- 新版读回字段包括 `remark`、`complete`、`tags`、详情页 `active`、`templateWidth`、`templateSites` 和 `videos`。`complete=false` 是草稿，`active=false` 是禁用详情页，必须交给人工确认。
- 创建或颜色/SKU 增量更新时，尺码表、商家 SKU、颜色和销售属性之间必须满足参考文档约束；颜色、SKU、尺码不完整时不要提交。
- 特殊格式字段的分隔符必须使用英文标点：多选用 `;`，多文本用 `*`，材质成分用 `材质,占比;`，所在地用 `省,市`，得物日期用 `1*日期`/`2*月份`/`3*年份*季度`，售后服务承诺用 `选项索引_天数`。
- 暂不支持的特殊格式字段包括 `淘宝 SKU 参数`、`天猫 SKU 参数`、`天猫导购标题`、`京东规格子属性`、`京东自营子属性`、`淘宝导购标题`、`颜色备注` 等；遇到这些字段应停止自动建档并转人工确认。

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

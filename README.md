# DeepDraw CLI

`deepdraw` 是面向公司内部用户和 AI agent 的深绘开放平台 CLI 客户端。它默认支持 dry-run、执行计划和显式授权，方便在真正调用深绘接口前先确认参数、风险和调用方式。

## 安装

```bash
npm install
npm run build
npm link
```

## Java SDK Runtime

大多数 `dp.*` 接口会直接使用 TypeScript 发起 HTTP 签名请求；下面这些商品接口会通过 DeepDraw Java SDK bridge 执行，以便和 Listingify 的创建、查重、readback 链路保持一致，并避免 SDK entity mapping 或新版查询参数出现序列化偏差：

- `dp.product.create`
- `dp.product.update`
- `dp.product.resource`

使用前需要安装一个同时提供 `java` 和 `javac` 的 JDK。内部发行版已经把 DeepDraw SDK jar 和 Java SDK 运行依赖 jar 放在 `vendor/deepdraw-sdk`，正常公司内部使用时无需 Maven 下载：

- `vendor/deepdraw-sdk/dop-sdk-1.6.0.jar`
- `vendor/deepdraw-sdk/sdk-core-java-1.1.0.jar`
- `vendor/deepdraw-sdk/lib/*.jar`

`lib` 目录必须保留，因为 `sdk-core-java-1.1.0.jar` 会引用 FastJSON、Apache HttpClient、OkHttp、Guava、SLF4J 等第三方 runtime class。把这些依赖固定在项目里，可以避免 Windows 和 macOS 用户因为本机 Maven cache 不完整而运行失败。

如果需要替换或测试另一套 SDK bundle，可以用环境变量指定 SDK 位置：

```bash
export DEEPDRAW_SDK_DIR=/absolute/path/to/deepdraw-sdk
# 或者直接提供完整 classpath
export DEEPDRAW_SDK_CLASSPATH="/absolute/path/deepdraw-sdk/*:/absolute/path/deepdraw-sdk/lib/*"
```

Windows 环境下，classpath 项之间使用 `;` 分隔：

```powershell
$env:DEEPDRAW_SDK_CLASSPATH="C:\deepdraw-sdk\*;C:\deepdraw-sdk\lib\*"
```

第一次执行 Java-SDK 接口时，CLI 会把 Java bridge class 编译到 `.deepdraw-sdk/classes`。这个目录是本地生成目录，已被 git 忽略。

## 凭据配置

推荐用 stdin JSON 写入租户凭据：

```bash
deepdraw auth login --stdin-json < credentials.json
```

凭据读取和存储规则：

- 如果环境变量里已经提供完整的 `DEEPDRAW_*` 配置，环境变量优先。
- `auth login --stdin-json` 会把非密钥租户配置写入平台配置路径：
  - macOS/Linux: `~/.config/deepdraw/config.json`
  - Windows: `%APPDATA%\DeepDrawCli\config.json`
- `appSecret`、`dopKey` 等密钥会按 credential reference 单独存储。当前内置默认实现会把密钥写到配置文件旁边的本地 `credentials.json`；测试里使用注入的 fake store。不要提交这些本地凭据文件。
- Java SDK 执行时会按顺序使用 `DEEPDRAW_SDK_CLASSPATH`、`DEEPDRAW_SDK_DIR` 或内置 `vendor/deepdraw-sdk` jars。本机 Listingify SDK 路径只作为开发机 fallback。

## 安全调用

只读接口可以直接 dry-run 或执行：

```bash
deepdraw call dp.colors.get
```

AI agent 如果只想拿 Listingify 常用的“整体资料 + 商品图片 + 详情页 URL + SKU 摘要”，优先使用语义化命令：

```bash
deepdraw product content --product-code 208326105214 --summary --assets --dry-run
deepdraw product content --product-code 208326105214 --summary --assets --execute
```

该命令底层调用 `dp.product.resource` 的 Java SDK 链路，不输出完整原始大 JSON，而是抽取：

- `summary`：款号、DeepDraw productId、标题、品牌、类目、颜色数、尺码数、SKU 数、图片数、详情页资源数。
- `skus`：颜色、尺码、商家编码、条形码、SKU 编码、价格、数量。
- `assets.pictures`：商品图片 URL，含 `place`、`pictureType`、`skc`、颜色、尺寸、水印标记。
- `assets.detailPages` / `assets.detailModules`：详情页图片版 URL、截图切片 URL、模块 URL。

有写入、付费或慎用风险的接口，建议先生成执行计划：

```bash
deepdraw call dp.product.search --execute --plan --param merchantId=MERCHANT_ID
```

用户明确授权后，再加 `--yes` 真正执行：

```bash
deepdraw call dp.product.search --execute --yes --param merchantId=MERCHANT_ID
```

## 调用频率与退避

深绘会对部分接口做频控。实测商品资料拉取在连续矩阵调用后返回过 `10494` / `访问频率过高，请稍后重试`，并且冷却 120 秒后仍可能未恢复。

建议把真实调用放进串行队列：

- 常规读取接口至少间隔 3-5 秒。
- 批量拉取 `dp.product.resource` 时从 5 秒间隔起步，不要并发请求同一租户。
- 遇到 `10494` 后停止当前批次，冷却 3-5 分钟，再用单次请求探测。
- 恢复后使用指数退避，例如 5 秒、10 秒、20 秒；再次触发 `10494` 就重新冷却。

## 验证

```bash
npm test
npm run lint
npm run build
deepdraw config doctor --dry-run
deepdraw call dp.colors.get --dry-run
deepdraw call dp.product.resource --dry-run
```

# 深绘开放平台接口文档（2026-08-27 source snapshot）

> 本文件依据新版 PDF 全文提取并整理，面向 AI agent 检索和调用参考。
> 原始文件: `/Users/xingyicheng/Downloads/深绘开放平台API接口文档20260827.pdf`
> PDF 页数: 96
> PDF 创建时间: 2026-08-27 16:15:38 CST
> PDF 作者: DEEPDRAW-DANNY
> 对应 SDK: `dop-sdk-1.6.24.jar`
> SDK SHA-256: `1cd9f7f37a76a16e8a2e102b0e78b19470319d743d66a5af93ab58bb87fb2ed8`
> 提取与核验: 使用 pdfplumber 提取 96 页文本，并使用 Poppler `pdftoppm` 渲染 96 页检查版面；PDF 内容只用于接口事实核对，不构成真实接口执行授权。

> 版本提示：PDF 封面仍显示“当前版本号 1.2 / 最后更新时间 2023.08.10”；本参考以 PDF 的修改历史为准，已纳入 1.6.23、1.6.24 及 2026.08.03 文档补充。仓库 vendor 使用的 SDK 版本为 1.6.24。

## Agent 读取提示

- 公共接口地址在文档中给出为 `http://open.deepdraw.cn`。
- SDK 调用通常需要 `appKey`、`appSecret`、`dopKey`、`host` 等公共参数。
- 响应示例中外层 `status` 是 HTTP 状态码；`response.body` 或响应对象中的 `body` 才是业务数据。
- 下方“API 快速索引”按接口名列出 `dp.*` 方法，正文继续保留请求参数、响应参数、Java 示例和 JSON 示例。
- 文档中的写入、付费和慎用示例仅用于说明请求形状；CLI 必须先生成计划，并在用户明确授权后才可真实执行。
- `dp.product.resource`、`dp.product.search`、`dp.feature.pictures.get`、`dp.product.basic.search` 支持按 `tags` 过滤产品标签。
- `dp.product.detail.get` 支持 `detailPageSite` 平台过滤；详情读回还应关注 `active`、`templateWidth`、`templateSites`、`remark`、`complete` 和 `videos` 等字段。

## API 快速索引

| 章节 | 接口主题 | 接口名 | 版本 | PDF页 |
| --- | --- | --- | --- | --- |
| 2.1 | 查询商家信息 | `dp.merchant.name.search` | v1 | 9 |
| 2.2 | 获取商户支持平台 | `dp.merchant.sites.get` | v2 | 10 |
| 2.3 | 查询水印信息 | `dp.merchant.watermarks.get` | v2 | 11 |
| 3.1 | 获取类目 | `dp.merchant.trades` | v1 | 14 |
| 3.2 | 获取类目字段 | `dp.trade.fields` | v1 | 16 |
| 4.1 | 创建产品 | `dp.product.create` | v1 | 19 |
| 4.2 | 更新产品 | `dp.product.update` | v1 | 22 |
| 4.3 | 产品增量更新 | `dp.product.incremental.update` | v2 | 25 |
| 4.4 | 获取产品指定类型资源 | `dp.product.resource` | v2 | 27 |
| registry supplement | 查询产品详情页 | `dp.product.detail.get` | v1 | PDF 修改历史 / registry |
| 4.5 | 查询产品列表（慎用） | `dp.product.search` | v2 | 29 |
| 4.6 | 获取商品指定类型素材/资源图原图 | `dp.feature.pictures.get` | v2 | 32 |
| 4.7 | 查询产品基础信息列表 | `dp.product.basic.search` | v2 | 36 |
| 4.8 | 查询产品上架状态 | `dp.product.distribution.get` | v2 | 38 |
| 4.9 | 产品颜色与 SKU 增量更新（特殊用户定制需求） | `dp.product.sku.color.incremental.update` | v2 | 40 |
| 5.1 | 以图搜款-款号接口（额外收费） | `dp.product.retrieve.image` | v2 | 42 |
| 5.2 | 以图搜款-查询上货记录 | `dp.product.distributions.get` | v2 | 44 |
| 5.3 | 图片服装多标签分析（额外收费） | `dp.product.label.image` | v2 | 46 |
| 5.4 | 图片素材上传接口（额外收费） | `dp.product.image.upload` | v2 | 49 |
| 5.5 | 查询上传图片素材任务接口（额外收费） | `dp.product.image.query` | v2 | 50 |
| 5.6 | 图片修改（额外收费） | `dp.product.image.update` | v2 | 51 |
| 6.1 | 获取深绘标准颜色 | `dp.colors.get` | v2 | 54 |
| 附录一 | AllInOneProduct | - | - | 55 |
| 附录二 | DpProductPictures | - | - | 76 |
| 附录三 | DpDetalPage | - | - | 88 |
| 附录四 | DpProductVideos | - | - | 90 |

## 正文

深绘开放平台接口文档

| 名称 | 说明 |
| --- | --- |
| 当前版本号 | 1.2 |
| 最后更新时间 | 2023.08.10 |
| 最后更新人 | 李 星 |
| 作者 | 胡利伟 |
| 创建时间 | 2020.4.10 |

## 修改历史

| 版本号 | 修改人 | 更新时间 | 更新内容 |
| --- | --- | --- | --- |
| 1.0 | 胡利伟 | 2020.4.10 | 创建文档 |
| 1.1 | 李 星 | 2021.05.13 | 1. 更改host地址<br>2. 完善部分细节 |
| 1.2 | 李 星 | 2021.06.23 | 1. 接口dp.trade.fields响应增加isSaleProp（是<br>否是销售属性）<br>2. 完善dp.product.create接口部分描述 |
|  |  | 2021.10.29 | 新增 5.4 图片素材上传接口<br>新增 5.5 查询上传图片速任务接口 |
| 1.6.9 | 胡凡 | 2023.08.10 | 1、接口dp.product.search根据货号<br>(productCodes)批量查询<br>2、接口dp.product.resource的详情页<br>detalPages返回模版宽(templateWidth)和平台<br>(templateSites)<br>3、接口dp.product.resource返回短视频(videos)<br>4、接口dp.product.resource返回产品ID<br>（productId）以及是否草稿箱(complete）false<br>草稿状态；true非草稿，完成状态<br>5、产品新增dp.product.create增加备注<br>(remark);产品详情dp.product.resource返回产<br>品备注(remark) |
| 1.6.10 | 胡凡 | 2023.10.27 | 1、产品详情dp.product.resource返回图片id和<br>资源图 类型为ALL<br>2、新增5.6图片修改接口 |
| 1.6.11 | 胡凡 | 2024.03.12 | 5.6 dp.product.image.update<br>图片修改接口新增参数productCode和labels |
| 1.6.12 | 胡凡 | 2024.06.21 | 4.6 dp.feature.pictures.get<br>原来不支持资源图主图查询，现在新增了一个参<br>数 pictureSite支持传平台类型如：TMALL<br>平台值参考<br>cn.deepdraw.api.model.dp.basic.DpPlace |
| - | 谭卓 | 2024.11.18 | 4.1 dp.product.create 、4.2 dp.product.update<br>产品创建接口，新增'多平台尺码字段'，具体<br>传参数在文档下方 |
| - | 胡凡 | 2025.03.20 | 添加附录字段说明 |
| 1.6.13 | 胡凡 | 2025.04.01 | 图片支持skc查询<br>4.4dp.product.resource<br>4.6 dp.feature.pictures.get |
| 1.6.14 | 胡凡 | 2025.04.03 | 1、新增接口 4.7dp.product.basic.search<br>2、4.4dp.product.resource |

| 版本号 | 修改人 | 更新时间 | 更新内容 |
| --- | --- | --- | --- |
|  |  |  | 4.5dp.product.search支持素材图和视频查询 |
| - | 胡凡 | 2025.04.16 | 5.6dp.product.image.update字段说明 |
| 1.6.16 | 胡凡 | 2025.06.16 | 5.6dp.product.image.update支持url传视频 |
| 1.6.17 | 胡凡 | 2025.05.27 | 特殊版本：用户sdk-core-java-1.1.0.jar版本冲<br>突，仅当前1.6.17.jar版本升级到<br>sdk-core-java-1.1.7.jar |
| 1.6.18 | 胡凡 | 2025.08.08 | 4.5dp.product.search、<br>4.7dp.product.basic.search<br>新增参数-是否排除草稿状态货号 excludeDraft<br>默认true排除 |
| 1.6.19 | 胡凡 | 2025.08.21 | 详情页支持按平台过滤截图<br>4.4dp.product.resource<br>4.5dp.product.search<br>新增参数：detailPageSite |
| 1.6.20 | 胡凡 | 2025.10.29 | 5.6新增参数pictureAddType 图片新增方式:支<br>持追加、按文件名更新、全量覆盖 |
| - | 胡凡 | 2025.12.16 | 补充接口4.8 查询产品上架状态 |
| 1.6.22 | 胡凡 | 2026.03.10 | 1、详情页支持按模块名称过滤详情页<br>4.4dp.product.resource<br>4.5dp.product.search<br>dp.product.detail.get<br>新增参数：excludeDetailPageModules<br>2、上货接口返回水印、详情页、是否启用视频主<br>图<br>4.8dp.product.distribution.get<br>5.2dp.product.distributions.get |
| 1.6.23 | 胡凡 | 2026.03.27 | 4.9 `dp.product.sku.color.incremental.update`：特殊用户新增接口，支持产品颜色与 SKU 增量更新 |
| 1.6.24 | 胡凡 | 2026.06.16 | 支持产品标签搜索，新增查询条件 `tags`：4.4 `dp.product.resource`、4.5 `dp.product.search`、4.6 `dp.feature.pictures.get`、4.7 `dp.product.basic.search` |
| - | 胡凡 | 2026.08.03 | 文档说明更新：`AllInOneProduct` 补充 `remark` 备注；`DpDetalPage` 补充 `active` 启用状态；4.1.2 补充特殊格式说明 |

## 目录

原 PDF 目录页内容较长；本文开头已生成 API 快速索引，正文按章节保留完整接口内容。

## 1 基本情况介绍

### 1.1 关于 SDK

深绘提供了 Java 环境下的 SDK。SDK 依赖下列的包：
fastjson-1.1.41，commons-lang3-3.8.1，httpclient-4.5.3，commons-io-2.5，httpcore-4.4.6，commons-collections-3.2.2。
另外 SDK 需要依赖 sdk-core-java-1.1.0.jar，请联系深绘在提供 SDK 的时候同时提供这个包。

本仓库固定使用 `vendor/deepdraw-sdk/dop-sdk-1.6.24.jar`，其 SHA-256 为 `1cd9f7f37a76a16e8a2e102b0e78b19470319d743d66a5af93ab58bb87fb2ed8`；同时保留 `sdk-core-java-1.1.0.jar` 与 `vendor/deepdraw-sdk/lib/*.jar` 运行依赖。不要把真实凭据写入 SDK 或参考文档。

### 1.2 公共参数

| 名称 | 含义 | 说明 |
| --- | --- | --- |
| host | 接口地址 | 地址为http://open.deepdraw.cn |
| appKey | 阿里云授权信息 | 作为header传到深绘 |
| appSecret | 阿里云授权信息 | 用于签名，对应的签名在header中 |
| dopKey | 深绘分配的授权信息 | 作为query传给深绘 |

以上公共参数请联系深绘提供

### 1.3 调用说明

第一步：使用 SDK 中 cn.deepdraw.api.rest.request.v2 包中的请求类，比如：
GpusProductCreateCheckRequest request = new GpusProductCreateCheckRequest(appKey, appSecret, dopKey, host);
第二步：请求类在执行请求之前，需要设置参数，针对例子中的这个类，需要 taskId 这个参数：
request.setTaskId(taskId);
第三步：执行请求：
Reply reply = request.execute();
Reply 是封装好的响应类。通过解析其中的数据获取请求数据。

### 1.4 返回数据说明

下面是个示例（以上方接口为例）：

```json
{
"response": {
"body": {
"productId": "adfd6bf542964ac5b3e77ec3e43d6bf0"
},
"code": 10200,
"reason": "访问成功！",
"requestId": 1068,
"response": "success",
"timestamp": 1554287919254
},
"status": 200
}
```

其中，外层的 status 是 HTTP 状态码，200 的时候表示请求成功。response 是真正的返回数据：

| 名称 | 说明 |
| --- | --- |
| code | 请求的状态码，一般是10开头 |
| reason | 成功或失败的具体描述 |
| response | 请求是成功还是失败 |
| requestId | 请求id |
| timestamp | 时间戳 |
| body | 真正的请求数据 |

以下接口中响应参数的描述都是针对 body 中的数据而言。

## 2 商家 API

### 2.1 查询商家信息

#### 2.1.1 接口名称

**接口名:** `dp.merchant.name.search`

**版本:** v1

#### 2.1.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| name | String | 否 | 商户名称 | 商户名称（公司名称）。填写该参数可以模糊查<br>询一个商户信息 |

#### 2.1.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| name | String | 商户名称 | 商户名称（公司名称） |
| id | Long | 12 | 商户id，商户在深绘美工机器人下的账号id。上传商品信息及获取商<br>品信息需要提供商id。 |
| brand | String | 品牌 | 商户品牌名称 |

#### 2.1.4 请求示例

```java
MerchantPostFindByNameRequestrequest =new MerchantPostFindByNameRequest(appKey, appSecret, dopKey, host).
setName("test");
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 2.1.5 响应示例

```json
{
"body": [
{
"name": "商户名称",
"id": "12",
"brand": "品牌"
},
...
],
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 2.2 获取商户支持平台

#### 2.2.1 接口名称

**接口名:** `dp.merchant.sites.get`

**版本:** v2

#### 2.2.2 请求参数

| 名称 | 类型 | 必填 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| merchantId | Long | 是 | 123456 | 商户在深绘系统内的id，作为query发给接口 |

#### 2.2.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| code | String | TAOBAO | 平台编码 |
| name | String | 淘宝 | 平台名称 |

#### 2.2.4 请求示例

```java
MerchantSitesGetRequestrequest = new MerchantSitesGetRequest(appKey, appSecret, dopKey, host);
request.setMerchantId(merchantId);
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 2.2.5 响应示例

```json
{
"body": [
{
"code": "TAOBAO",
"name": "淘宝"
},
{
"code": "ALIBABA",
"name": "1688"
},
{
"code": "TMALL",
"name": "天猫"
},
{
"code": "JD",
"name": "京东"
}
],
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 2.3 查询水印信息

#### 2.3.1 接口名称

**接口名:** `dp.merchant.watermarks.get`

**版本:** v2

#### 2.3.2 请求参数

| 名称 | 类型 | 必填 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| merchantId | Long | 是 | 123456 | 商户在深绘系统内的id，作为query发给接口 |

#### 2.3.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| name | String | 资源图水印 | 水印规则名称 |
| id | String | 0637824b801b4115b87dd8e0ccbbd6c6 | 水印规则id |
| items | items | - | 水印规则所包含的所有打水印细节，其中包括资<br>源图、详情页、智能拼图。 |

#### 2.3.4 请求示例

```java
MerchantWatermarkGetRequestrequest = new MerchantWatermarkGetRequest(appKey, appSecret, dopKey, host);
request.setMerchantId(merchantId);
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 2.3.5 响应示例

```json
{
"body": [
{
"name": "资源图水印",
"id": "0637824b801b4115b87dd8e0ccbbd6c6",
"items": [
{
"img": "//upload.soomey.net/watermark/15102075277688974.png",
"h": 159,
"index": [
"1"
],
"type": "PRIMARY",
"platform": [
"JD"
],
"colorType": "COLOUR",
"target": [
"HOME"
],
"transparency": 1,
"w": 177,
"name": "水印",
"x": 64,
"y": 96,
"base": "LEFT_TOP"
}
]
},
{
"name": "多平台带天猫水印",
"id": "dc44549c264841cb9a47ce55ef28713b",
"items": [
{
"img": "//upload.soomey.net/watermark/15112301454737751.png",
"h": 142.4,
"index": [
"1,3,5"
],
"type": "PRIMARY",
"platform": [
"TAOBAO"
],
"colorType": "COLOUR",
"target": [
"HOME"
],
"transparency": 1,
"w": 160,
"name": "淘宝水印_TAOBAO_HOME 测试",
"x": 64,
"y": 64,
"base": "LEFT_TOP"
},
{
"img": "//upload.soomey.net/watermark/15112301454737751.png",
"h": 143.72881355932205,
"index": [
"1,3,5"
],
"type": "PRIMARY",
"platform": [
"TMALL"
],
"colorType": "COLOUR",
"target": [
"TRANSPARENCY"
],
"transparency": 1,
"w": 158.52075471698114,
"name": "天猫水印",
"x": 64,
"y": 64,
"base": "LEFT_TOP"
}
]
}
],
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

## 3 类目 API

### 3.1 获取类目

#### 3.1.1 接口名称

**接口名:** `dp.merchant.trades`

**版本:** v1

#### 3.1.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| merchantId | Long | 是 | 123 | 商户id |

#### 3.1.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| level | Long | 1 | 类目层级 |
| name | String | 衬衫 | 类目名称 |

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| id | Long | 187 | 类目id |
| children | Children[] |  | 子类目集 |

#### 3.1.4 请求示例

```java
MerchantPostFindTradeByIdRequest request = new MerchantPostFindTradeByIdRequest(appKey, appSecret, dopKey,
host).setMerchantId(merchantId);
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
Object body = reply.getResponse().getBody();
System.out.println(JSON.toJSONString(body));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 3.1.5 响应示例

```json
{
"body"[
{
"children": [
{
"children": [],
"level": 3,
"name": "小背心",
"id": 16
},{
"children": [],
"level": 3,
"name": "T 恤(短)",
"id": 9009
}
...
],
"level": 2,
"name": "女装",
"id": 5
},{
"children": [
{
"children": [],
"level": 3,
"name": "T 恤",
"id": 39
},{
"children": [],
"level": 3,
"name": "衬衫(短)",
"id": 9019
}
...
],
"level": 2,
"name": "男装",
"id": 6
}
...
],
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 3.2 获取类目字段

#### 3.2.1 接口名称

**接口名:** `dp.trade.fields`

**版本:** v1

#### 3.2.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| merchantId | Long | 是 | 123 | 商户id |
| tradeId | Long | 是 | 123 | 深绘叶子类目id |

#### 3.2.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| name | String | 质量等级 | 商品属性名称 |
| id | Long | 2749 | 商品属性id |

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| type | String | TEXT | 商品属性类型（文本型：TEXT，多文字型：MULTI_TEXT，单选型：<br>SINGLE_CHOICE，多选型：MULTI_CHOICE） |
| options | Options[] |  | 商品属性值（一般文本型和多文本型默认值为空，单选和多选型会有默<br>认值返回） |
| attributes | Attributes{} |  | 商品属性特性，isThird（是否为第三方平台字段）、thirdPlatform（第<br>三方平台）、isAccountRelated（是否用户自定义属性字段） |
| isSaleProp | boolean | true | 是否是销售属性，当创建产品时传入尺码表、唯品会尺码表或商家SK<br>U，那么此项为true的必填 |

#### 3.2.4 请求示例

```java
TradePostFindFieldByIdRequestrequest = new TradePostFindFieldByIdRequest(appKey, appSecret, dopKey, host).setM
erchantId(merchantId).setTradeId(tradeId);
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
Object body = reply.getResponse().getBody();
System.out.println(JSON.toJSONString(body));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 3.2.5 响应示例

```json
{
"body": [
{
"type": "TEXT",
"options": [],
"name": "货源地",
"id": 222,
"attributes": {
"isThird": false,
"isRequired": false,
"isAccountRelated": false,
"isChildAttr": false
}
},
{
"type": "MULTI_TEXT",
"options": [],
"name": "材质成分",
"id": 4567,
"attributes": {
"isThird": false,
"isRequired": true,
"isAccountRelated": false,
"isChildAttr": false
}
},
{
"type": "SINGLE_CHOICE",
"options": [
{
"id": 67,
"value": "微弹力"
},
{
"id": 68,
"value": "小弹力"
},
{
"id": 69,
"value": "中弹力"
},
{
"id": 70,
"value": "大弹力"
},
{
"id": 71,
"value": "特大弹力"
}
],
"name": "弹力",
"id": 4,
"attributes": {
"isThird": false,
"isRequired": false,
"isAccountRelated": false,
"isChildAttr": false
}
},
{
"type": "MULTI_CHOICE",
"options": [
{
"id": 700,
"value": "亮丝"
},
{
"id": 710,
"value": "镶钻"
}
],
"name": "服装款式细节",
"id": 412,
"attributes": {
"isThird": false,
"isRequired": false,
"isAccountRelated": false,
"isChildAttr": false
}
}
],
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

## 4 产品 API

### 4.1 创建产品

#### 4.1.1 接口名称

**接口名:** `dp.product.create`

**版本:** v1

#### 4.1.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| tradeId | Long | 是 | 1 | 深绘叶子id（可通过类目API<br>获取） |
| merchantId | Long | 是 | 2 | 商户id(可通过商户API获取) |

产品信息作为 entity 上传，json 格式
注意：当创建产品时若传入尺码表、唯品会尺码表或商家 SKU，那么销售属性必填（接口 dp.trade.fields 中 isSaleProp 为 tru
e 的字段）

#### 4.1.2.1 支持的特殊字段格式

以下格式来自新版 PDF 的特殊格式说明，分隔符必须使用英文标点：

- 多选按钮：使用分号 `;` 分隔，例如 `青年;大码人群;中年`。
- 多文本框或多文本域：使用星号 `*` 分隔，例如 `ABC*EFG`。
- 材质成分：使用“材质,占比;”格式，例如 `聚酯纤维,64.7;粘胶纤维(粘纤),26.0`。
- 所在地：两个下拉框使用“省,市”格式，例如 `广东,深圳`。
- 得物发售日期：使用 `1*YYYY-MM-DD`（年月日）、`2*YYYY-MM`（年月）或 `3*YYYY*季度`（年/季度）。
- 颜色色码：颜色别名部分与色码部分以 `*` 分隔，颜色条目用 `;` 分隔，例如 `黑色,黑色A01;深灰,奶奶灰*黑色,A01;深灰,B02`。
- 自定义洗涤图标：支持 PDF 中列出的三种 `<img ...>` 组合格式；其中图标、配置名和配置 ID 应保持成对。
- 售后服务承诺：格式为 `选项索引_天数`；不设置为 `0`，寄修为 `1`，延保为 `2`，例如 `1_1825`、`2_90`。

暂不支持的特殊格式字段包括：`淘宝 SKU 参数`、`天猫 SKU 参数`、`天猫导购标题`、`京东规格子属性`、`京东自营子属性`、`淘宝导购标题`、`颜色备注` 等。遇到这些字段时应停止自动建档并交由人工确认，不要把不支持格式当作普通字符串强行提交。

#### 4.1.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| productId | Long | 1111 | 商品id |

#### 4.1.4 请求示例

```java
Product product = new Product();
product.setTitle("2017 冬装新品女中长款毛呢大衣 可拆卸帽子外套女");
product.setCode("37940602");
product.setRetailPrice("399");
product.setDate("2017-11-11");
product.setRemark("备注"); //非必填
//以上为基础属性，以下为某类目可能支持上传的属性。
product.addProductField("无线短标题", "2017 冬装新品女中长款毛呢大衣");
product.addProductField("宝贝卖点", "2017 新款");
product.addProductField("天猫商品卖点", "2017 新款");
product.addProductField("商家编码", "3794060201");
product.addProductField("商家条形码", "379406020123");
product.addProductField("颜色", "黑色,纯黑;深灰,奶奶灰"); // 注意标点符号
product.addProductField("尺码", "XS;S;M");
product.addProductField("尺码表", createSizeTable());
product.addProductField("多平台尺码", createMultiPlatformSizes());
product.addProductField("商家 SKU", createSKU(product.getCode()));
product.addProductField("是否新品", "是");
product.addProductField("销售渠道类型 ", "商场同款(线上线下都销售)");
product.addProductField("材质成分","纯棉,50%;麻,50%");
product.addProductField("成分及含量","30%及以下");
product.addProductField("详情页面料","毛呢");
product.addProductField("风格","毛呢");
product.addProductField("裙型","西装裙 ");
product.addProductField("流行元素","露背,做旧,亮丝");
product.addProductField("适用年龄","25-29 周岁");
product.addProductField("年份/季节","2017 年秋季");
product.addProductField("所在地 ","福建,厦门");
product.addProductField("柔软度 ","小柔软度");
product.addProductField("透气度","小透气度");
product.addProductField("介绍","本款为经典款式*款式优雅");
private Object createSizeTable() {
JSONObject object = new JSONObject();
object.put("title", "领口,肩宽,胸围,腰围,下摆,袖长,袖口,衣长,尺码表");
object.put("XS", "1,2,3,4,5,6,7,8,9");
object.put("S", "5,6,7,8,9,1,2,3,4");
object.put("M", "8,9,1,2,3,4,5,6,7");
return object;
}
//多平台尺码支持的平台 喵街、京东、得物
private Object createMultiPlatformSizes() {
JSONObject object = new JSONObject();
object.put("title", "MIAOJIE,JD,DEWU");
object.put("XS", "xs,xs,S");
object.put("S", "S,S1,dw-S");
object.put("M", "mj-m,jd-m,dw-m");
return object;
}
private Object createSKU(String code) {
JSONObject object = new JSONObject();
object.put("title", "价格,货号,上市时间,数量,商家编码,条形码,零售价,供货价,唯品会货号,唯品会条形码");
object.put("纯黑", createSizeSKU(code));
object.put("奶奶灰", createSizeSKU(code));
return object;
}
private JSONObject createSizeSKU(String code) {
JSONObject object = new JSONObject();
object.put("XS", "999," + code + ",2017-12,35,merchant_code,2837465,899,499,vip_code,1982387");
object.put("S", "999," + code + ",2017-12,35,merchant_code,2837465,899,499,vip_code,1982387");
object.put("M", "999," + code + ",2017-12,35,merchant_code,2837465,899,499,vip_code,1982387");
return object;
}
ProductPostCreateProductRequest request = new ProductPostCreateProductRequest(appKey, appSecret, dopKey, host)
.setMerchantId(merchantId).setTradeId(tradeId).setProduct(product));
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 4.1.5 响应示例

```json
{
"body": {
"productId": 306542
},
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 4.2 更新产品

#### 4.2.1 接口名称

**接口名:** `dp.product.update`

**版本:** v1

#### 4.2.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| productId | Long | 是 | 1 | 产品id |

产品信息作为 entity 上传，json 格式

#### 4.2.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| productId | Long | 1111 | 商品id |

#### 4.2.4 请求示例

```java
Product product = new Product();
product.setTitle("2017 冬装新品女中长款毛呢大衣 可拆卸帽子外套女");
product.setCode("37940602");
product.setRetailPrice("399");
product.setDate("2017-11-11");
product.setRemark("备注"); //非必填
//以上为基础属性，以下为某类目可能支持上传的属性。
product.addProductField("无线短标题", "2017 冬装新品女中长款毛呢大衣");
product.addProductField("宝贝卖点", "2017 新款");
product.addProductField("天猫商品卖点", "2017 新款");
product.addProductField("商家编码", "3794060201");
product.addProductField("商家条形码", "379406020123");
product.addProductField("颜色", "黑色,纯黑;深灰,奶奶灰"); // 注意标点符号
product.addProductField("尺码", "XS;S;M");
product.addProductField("尺码表", createSizeTable());
product.addProductField("多平台尺码", createMultiPlatformSizes());
product.addProductField("商家 SKU", createSKU(product.getCode()));
product.addProductField("是否新品", "是");
product.addProductField("销售渠道类型 ", "商场同款(线上线下都销售)");
product.addProductField("库存计数 ","买家拍下减库存");
product.addProductField("会员打折","参与会员打折");
product.addProductField("材质成分","纯棉,50%;麻,50%");
product.addProductField("面料名称","毛呢");
product.addProductField("成分及含量","30%及以下");
product.addProductField("详情页面料","毛呢");
product.addProductField("淘宝天猫风格","优雅");
product.addProductField("流行元素","露背,做旧,亮丝");
product.addProductField("图案","人物");
product.addProductField("适用年龄","25-29 周岁");
product.addProductField("年份/季节","2017 年秋季");
product.addProductField("所在地 ","福建,厦门");
product.addProductField("透气度","小透气度");
product.addProductField("长度","小长度");
product.addProductField("介绍","本款为经典款式*款式优雅");
//多平台尺码支持的平台 喵街、京东、得物
private Object createSizeTable() {
JSONObject object = new JSONObject();
object.put("title", "MIAOJIE,JD,DEWU");
object.put("XS", "xs,xs,S");
object.put("S", "S,S1,dw-S");
object.put("M", "mj-m,jd-m,dw-m");
return object;
}
private Object createMultiPlatformSizes() {
JSONObject object = new JSONObject();
object.put("title", "领口,肩宽,胸围,腰围,下摆,袖长,袖口,衣长,尺码表");
object.put("XS", "1,2,3,4,5,6,7,8,9");
object.put("S", "5,6,7,8,9,1,2,3,4");
object.put("M", "8,9,1,2,3,4,5,6,7");
return object;
}
private Object createSKU(String code) {
JSONObject object = new JSONObject();
object.put("title", "价格,货号,上市时间,数量,商家编码,条形码,零售价,供货价,唯品会货号,唯品会条形码");
object.put("纯黑", createSizeSKU(code));
object.put("奶奶灰", createSizeSKU(code));
return object;
}
private JSONObject createSizeSKU(String code) {
JSONObject object = new JSONObject();
object.put("XS", "999," + code + ",2017-12,35,merchant_code,2837465,899,499,vip_code,1982387");
object.put("S", "999," + code + ",2017-12,35,merchant_code,2837465,899,499,vip_code,1982387");
object.put("M", "999," + code + ",2017-12,35,merchant_code,2837465,899,499,vip_code,1982387");
return object;
}
ProductPostUpdateProductByIdRequestrequest = new ProductPostUpdateProductByIdRequest(appKey, appSecret, dop
Key, host).setProductId(productId).setProduct(product);
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 4.2.5 响应示例

```json
{
"body": {
"productId": 306542
},
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 4.3 产品增量更新

#### 4.3.1 接口名称

**接口名:** `dp.product.incremental.update`

**版本:** v2

#### 4.3.2 请求参数

| 名称 | 类型 | 必填 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| productId | String | 是 | 519b97a3bb5e451595c9ff5cdd13e40d | 产品在深绘系统内的id，作为query发给接口 |

| 名称 | 类型 | 必填 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| product | Product | 是 | cn.deepdraw.api.rest.entity.Product | 作为post的entity发给接口 |

需要注意的是，增量更新接口不能用于更新货号，期数，产品类目。

#### 4.3.3 注意事项-重要

在组装 Product 的时候，需要特别注意数据的内容和格式，在这这里特别说明以下几类信息：
尺码表（唯品会尺码表也是同样的原则）：如果更新数据中有尺码表，那么数据中必须同时包含尺码，并且，尺码表中的尺码
必须在尺码中能够找到，否则不能更新，错误提示为尺码表错误。
商家 SKU：如果更新数据中有商家 sku，那么数据中必须同时包含尺码和颜色数据。其中，sku 中的尺码必须在尺码中能够找
到，否则不能更新，错误提示为 sku 错误。颜色字段本身也会检查是否合规，规则见下面说的颜色。sku 中的颜色必须在颜色字段
的颜色别名中能够找到，否则不能更新，错误提示为 sku 错误。
颜色：颜色字段由两部分组成，格式是这样的"颜色 1,别名 1;颜色 2,别名 2*颜色 1,色码 1;颜色 2,色码 2"。色码部分是选填
的。其中涉及到的标点，必须是英文标点。颜色检查的时候，颜色名，别名，色码都不能有重复的，而且，色码部分的颜色名必须
是颜色别名部分出现过的

#### 4.3.4 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| id | String | 1c150d3ed75a49d1aa3a8f3439db3ecf | 更新的产品id |
| updates | List | ["标题","平台"] | 更新成功的字段 |

#### 4.3.5 请求示例

```java
ProductIncrementalUpdateRequest request = new ProductIncrementalUpdateRequest(appKey, appSecret, dopKey, host)
;
request.setProductId(productId);
request.setProduct(product);
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 4.3.6 响应示例

```json
更新失败的响应：
{
"code": 10497,
"reason": "参数错误：sku",
"requestId": 872,
"response": "fail",
"timestamp": 1555665110209
}
更新成功的响应：
{
"body": {
"id": "1c150d3ed75a49d1aa3a8f3439db3ecf",
"updates": [
"标题",
"平台"
]
},
"code": 10200,
"reason": "访问成功！",
"requestId": 1616,
"response": "success",
"timestamp": 1555982680755
}
```

### 4.4 获取产品指定类型资源

#### 4.4.1 接口名称

**接口名:** `dp.product.resource`

**版本:** v2

#### 4.4.2 请求参数

| 名称 | 类型 | 是否<br>必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| productId | String | 否 | 519b97a3bb5e451595c9ff5cdd13e40d | 产品在深绘系统内的id |
| merchantId | Long | 否 | 123 | 客户在深绘系统内的id |
| productCode | String | 否 | huohao | 产品的货号 |
| resource | String | 否 | picture | 资源的类型，有3种：picture，资源图；d<br>etail，详情页；form，表单数据。不填的<br>话，默认获取全部的资源。（如果只查询<br>视频 类型设置为video） |
| wgId | String | 否 | dc44549c264841cb9a47ce55ef28713b | 如果需要为获取的图片打水印，请提供水<br>印规则id，id可通过水印接口获取（详见<br>2.3章节）。 |
| skc | String | 否 | skc01,skc02 | 产品的skc，如果有多个用逗号分割 |
| material | bit | 否 | 0 | 是否返回素材图信息，1或0，默认0不返 |

| 名称 | 类型 | 是否<br>必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
|  |  |  |  | 回。如果是1，则会返回素材图（模特图<br>、静物图、细节图等），返回结果中plac<br>e=ALL是素材图 |
| video | bit | 否 | 0 | 是否返回视频信息，1或0，默认0不返回<br>。天猫淘宝平台可以存在多个视频 |
| detailPageSite | String | 否 | TMALL | 查询指定平台的详情页图（某些情况不同<br>平台展示的详情图不一样）<br>会过滤详情页modules和screenShotSec<br>tionUrls的返回结果 |
| excludeDetailPageModules | String | 否 | usemap,推荐搭配,尺码表 | 详情页过滤掉指定的详情页模块(存在搭<br>配链接的用usemap其他按模块名过滤，<br>多个用,分隔)<br>会过滤详情页modules和screenShotSec<br>tionUrls的返回结果 |
| tags | String | 否 | 标签1,标签2 | 产品标签，如果有多个用逗号分割 |

需要注意的是，既可以通过 productId 也可以通过 merchantId 和 productCode 的组合来查询商品，如果两者都填了，则默认会
通过 productId 来查询，不管这个 productId 是否正确。

#### 4.4.3 响应参数

不同类型的 resource，响应类型是不一样的。
picture 资源的响应类型是 DpProductPictures 对象。
detail 资源的响应类型是一个 DpDetalPage 对象的 list（也可以是 set）。
video 资源的响应类型是 DpProductVideos 对象。
如果不指定资源类型，或者资源类型为 form，响应类型是 AllInOneProduct 对象。

#### 4.4.4 请求示例

```java
ProductGetByIdRequestrequest = new ProductGetByIdRequest(appKey, appSecret, dopKey, host);
request.setProductId(productId);
request.setResource(resource)
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 4.4.5 响应示例

```json
资源类型为 picture：
{
"body": {
// 返回一个 DpProductPictures 对象，具体见附录二
},
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
资源类型为 detail：
{
"body": [
// 返回一个 DpDetalPage 的 list 或 set，见附录三
],
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
资源类型为 video：
{
"body": {
// 返回一个 DpProductVideos 对象，具体见附录四
},
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
资源类型为 form 或者是不填：
{
"body": {
// 这是一个 AllInOneProduct 对象。具体这个类的结构，见附录一
},
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 4.4A 查询产品详情页（CLI registry supplement）

`dp.product.detail.get` 在 PDF 的 1.6.22 修改历史中与详情页模块过滤一起被引用；CLI registry 对该只读接口提供以下可检索参数，以便与新版 SDK/运行时保持一致。

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| productId | Long | 是 | 123 | 深绘产品 id |
| quality | String | 否 | high | 详情页质量筛选 |
| detailPageSite | String | 否 | TMALL | 查询指定平台的详情页图 |
| excludeDetailPageModules | String | 否 | usemap,推荐搭配,尺码表 | 过滤详情页模块，多个用逗号分隔 |

该补充项使用 CLI registry 中的 HTTP POST `/rest` 路径；只读不代表无须检查返回业务码，响应仍应按外层 HTTP `status` 和 DeepDraw 业务 `code` 双层判断。

### 4.5 查询产品列表（慎用）

#### 4.5.1 接口名称

**接口名:** `dp.product.search`

**版本:** v2

只查询产品基础信息，可以使用 4.7 dp.product.basic.search

#### 4.5.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| merchantId | Long | 是 | 123 | 商户id |
| date | String | 否 | 2019-4-4 | 深绘内部定义的产品期数，每个产品都有所属期<br>数。 |
| pageNo | Integer | 否 | 1 | 不填的情况下，默认是1，分页大小是10，不可<br>调整。主要是产品数据很大，如果分页过大，会<br>造成请求延时 |
| startTime | Long | 否 | 1553529600000 | 查询的起始时间，单位是毫秒 |
| endTime | Long | 否 | 1553616000000 | 查询的结束时间，单位是毫秒 |
| form | bit | 否 | 1 | 1或0，默认0。如果是1，则会查询这个时间段<br>内表单变化的产品 |
| picture | bit | 否 | 1 | 1或0，默认0。如果是1，则会查询这个时间段<br>内资源图变化的产品 |
| detail | bit | 否 | 1 | 1或0，默认0。如果是1，则会查询这个时间段<br>内详情页变化的产品 |
| productCodes | String | 否 | 货号1,货号2 | 货号，多个货号用逗号拼接 |
| material | bit | 否 | 0 | 是否返回素材图信息，1或0，默认0不返回。如<br>果是1，则会返回素材图（模特图、静物图、细节<br>图等），返回结果中place=ALL是素材图 |
| video | bit | 否 | 0 | 是否返回视频信息，1或0，默认0不返回。天猫<br>淘宝平台可以存在多个视频 |
| excludeDraft | bit | 否 | 1 | 是否排除草稿状态货号，1或0，默认1排除。 |
| detailPageSite | String | 否 | TMALL | 查询指定平台的详情页图（某些情况不同平台展<br>示的详情图不一样）<br>会过滤详情页modules和screenShotSectionUrl<br>s的返回结果 |
| excludeDetailPageModules | String | 否 | usemap,推荐搭配,<br>尺码表 | 详情页过滤掉指定的详情页模块(存在搭配链接的<br>用usemap其他按模块名过滤，多个用,分隔)<br>会过滤详情页modules和screenShotSectionUrl<br>s的返回结果 |
| tags | String | 否 | 标签1,标签2 | 产品标签，如果有多个用逗号分割 |

#### 4.5.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| count | Integer | 601 | 符合要求的产品总数 |
| pageNo | Integer | 1 | 当前查询的产品分页 |
| pageSize | Integer | 10 | 这里当前是固定10个 |
| products | List<AllInOneProduct> | - | AllInOneProduct这个类在SDK中有提供。具体可以看<br>SDK中这个类的信息 |

#### 4.5.4 请求示例

```java
ProductSearchByDateRangeRequest request = new ProductSearchByDateRangeRequest(appKey, appSecret, dopKey,
host);
request.setMerchantId(this.merchantId);
request.setDate(date);
request.setPageNo(pageNo);
request.setStartTime(startTime);
request.setEndTime(endTime);
request.setForm(true);
request.setPicture(true);
request.setDetail(true);
request.setProductCodes("test1,test2");
request.setExcludeDraft(true);
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
JSONObject body = (JSONObject) reply.getResponse().getBody();
System.out.println("count : " + body.getIntValue("count"));
System.out.println("pageNo : " + body.getIntValue("pageNo"));
System.out.println("pageSize : " + body.getIntValue("pageSize"));
List<AllInOneProduct> allInOneProducts
= JSON.parseArray(JSON.toJSONString(body.getJSONArray("products")), AllInOneProduct.class);
System.out.println("products : " + JSON.toJSONString(allInOneProducts));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 4.5.5 响应示例

```json
{
"body": {
"count": 601,
"pageNo": 1,
"pageSize": 10,
"products": [
// 这是一个 AllInOneProduct 的 list，具体这个类的结构，见附录一
]
},
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 4.6 获取商品指定类型素材/资源图原图

#### 4.6.1 接口名称

**接口名:** `dp.feature.pictures.get`

**版本:** v2

#### 4.6.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| productId | String | 否 | 519b97a3bb5e451595c9ff5cdd13e40d | 产品在深绘系统内的id |
| merchantId | Long | 否 | 123 | 客户在深绘系统内的id |
| productCode | String | 否 | huohao | 产品的货号 |
| pictureType | String | 是 | MODEL | 图片类型，从下面的图片类型中选择：<br>参考枚举：cn.deepdraw.api.model.dp.b<br>asic.PictureType<br>素材图<br>MODEL(模特图),<br>STILL_LIFE(静物图),<br>DETAIL(细节图),<br>FABRIC(面料图),<br>HANGTAG(吊牌图),<br>PERMANENT_LABEL(洗唛图),<br>SHOW(展示图),<br>SUMMARY(列表图),<br>UNKNOWN( 未知图),<br>OTHER(自定义图),<br>RESERVED(搭配图Y),<br>MATCH(搭配图M),<br>COMBINE_COLOR( 拼色图), |

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
|  |  |  |  | FOLDED(折叠图)<br>资源图<br>HOME(主图),<br>HOME_SUBSIDIARY(主图辅助图),<br>WIRELESS_HOME(无线主图),<br>COLOR(颜色图),<br>VERTICAL(竖图),<br>QUALIFICATION(资质图),<br>TRANSPARENCY(透明图),<br>VIDEO_HOME(视频主图),<br>LONG_HOME(长主图),<br>TRY_REPORT(试穿报告图),<br>RECOMMEND_SIZE(尺码推荐图),<br>CERTIFICATE(价格凭证图),<br>WHITE_BACKGROUND(白底图),<br>COLOR_SPEC(颜色规格图),<br>SUBSIDIARY(辅助识别图),<br>BVRC(智能拼图),<br>SCENE_IMAGE(场景图),<br>SELLING_POINT(卖点图) |
| pictureSite | String | 否 | ALL | 默认只查询素材图<br>参考枚举：cn.deepdraw.api.model.dp.b<br>asic.DpPlace<br>TAOBAO(淘宝),<br>PAIPAI(拍拍),<br>ALIBABA(1688),<br>TMALL(天猫),<br>JD(京东),<br>YHD(一号店),<br>GOME(国美),<br>JUMEI(聚美优品),<br>SUNING(苏宁),<br>VIP(唯品会),<br>YIXUN(易迅),<br>STANDALONE(自营站点),<br>OTHER(其他),<br>XIUPIN(网易秀品),<br>YISHANG(伊尚时尚),<br>XIKE(细刻),<br>ALIEXPRESS(速卖通),<br>SANFU(三福),<br>KAOLA(考拉),<br>GUXING(古星), |

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
|  |  |  |  | YOUZAN(有赞),<br>PDD(拼多多),<br>WEIMOB(微盟),<br>CLOUDSHOP(云店),<br>KBOXINGIES(劲霸商城),<br>KBOXINGCS(劲霸圆周率),<br>DANGDANG(当当),<br>BEIBEI(贝贝),<br>YUNJI(云集),<br>XIAOHONGSHU(小红书),<br>MOGUJIE(蘑菇街),<br>RUISHA(锐鲨),<br>CONNECT(数致),<br>SEMAGENTO(SE麦进斗),<br>SHOPEESG(Shopee新加坡),<br>SHOPEEID(Shopee印尼),<br>SHOPEEVN(Shopee越南),<br>SHOPEETW(Shopee台湾),<br>SHOPEEMY(Shopee马来),<br>SHOPEETH(Shopee泰国),<br>SHOPEEPH(Shopee菲律宾),<br>SSG(SSG),<br>LAZADASG(Lazada新加坡),<br>LAZADAID(Lazada印尼),<br>LAZADAVN(Lazada越南),<br>LAZADAMY(Lazada马来),<br>LAZADATH(Lazada泰国),<br>LAZADAPH(Lazada菲律宾),<br>DOUYIN(抖音),<br>KUAISHOU(快手),<br>YIKE(驿氪),<br>AIKUCUN(爱库存),<br>YOUPIN(小米优品),<br>YANXUAN(网易严选),<br>DEWU(得物),<br>HUIJU(惠聚),<br>ZALORATW(Zalora台湾),<br>ZALORAHK(Zalora香港),<br>ZALORAMY(Zalora马来西亚),<br>ZALORASG(Zalora新加坡),<br>LAZADACB(Lazada全球),<br>WEIDIAN(微店),<br>DIANJIA(店加),<br>MIAOJIE(喵街), |

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
|  |  |  |  | MOMO(MOMO),<br>SHANGOU(美团闪购),<br>AIMER(爱慕),<br>KUKAMALL(顾家商城),<br>ELEME(饿了么),<br>SHANSHAN(杉杉奥莱),<br>HAOYK(好衣库),<br>JDDAOJIA(京东到家),<br>WEIXINXIAODIAN(微信视频小店),<br>XIAOYOU(晓柚),<br>DOUYINXSG(抖音小时达),<br>BBC(澜海企业购),<br>ALL(通用素材图); |
| width | Integer | 否 | 300 | 图片宽度，可以不填，1-4096范围内的<br>整数 |
| body_facing | String | 否 | back | 主体朝向，可选值：back(背)，front(正)<br>，side(侧)。主体朝向仅适用模特图。 |
| body_part | String | 否 | whole | 人体位置，可选值：whole(全身)，uppe<br>r(上半身)，lower(下半身)。人体位置仅<br>适用模特图。 |
| body_orientation | String | 否 | front | 主体正反，可选值：back(背)，front(正)<br>，主体正反仅适用挂拍图。 |
| skc | String | 否 | skc01,skc02 | 产品的skc，如果有多个用逗号分割 |
| tags | String | 否 | 标签1,标签2 | 产品标签，如果有多个用逗号分割 |

需要注意的是，既可以通过 productId 也可以通过 merchantId 和 productCode 的组合来查询，如果两者都填了，则默认会通过
productId 来查询，不管这个 productId 是否正确。

#### 4.6.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| color | String | 游隐褐 | 图片颜色 |
| skc | String | A000101 | 产品可能的skc（根据sku推测出的值） |
| url | url[] | - | 素材图集合 |

#### 4.6.4 请求示例

```java
ProductPictureByFeatureGetRequest request = new ProductPictureByFeatureGetRequest(appKey, appSecret, dopKey,
host);
request.setProductId(productId);
request.setPictureType("MODEL"); // 模特图
request.setPictureSite("ALL"); // 不填，默认素材图 ALL
request.addFeature("body_part", "whole"); // 取全身，注意图片特性参数的加入方式
request.addFeature("body_facing", "back"); // 背面
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 4.6.5 响应示例

```json
{
"body": [
{
"color": "游隐褐",
"skc": "A000101",
"url": [
"//product.resources.deepdraw.biz/BJ/testcount/b0021071c5114ba48c0af261a78a75da/original/de56578014414
62b98f8c8d257c44b26.jpg?x-oss-process=image/resize,limit_0,w_300",
"//product.resources.deepdraw.biz/BJ/testcount/b0021071c5114ba48c0af261a78a75da/original/cd0b75389eb74
035b7d6e2cf97c55efc.jpg?x-oss-process=image/resize,limit_0,w_300",
"//product.resources.deepdraw.biz/BJ/testcount/b0021071c5114ba48c0af261a78a75da/original/a1f6bcae80c542
2c86d6602603b7e396.jpg?x-oss-process=image/resize,limit_0,w_300",
"//product.resources.deepdraw.biz/BJ/testcount/b0021071c5114ba48c0af261a78a75da/original/389095662f6c46
73995084ba6d84aaf6.adjustment.20190710221719.jpg?x-oss-process=image/resize,limit_0,w_300"
]
}
],
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 4.7 查询产品基础信息列表

#### 4.7.1 接口名称

**接口名:** `dp.product.basic.search`

**版本:** v2

#### 4.7.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| merchantId | Long | 是 | 123 | 商户id |

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| date | String | 否 | 2019-4-4 | 深绘内部定义的产品期数，每个产品都有所属期<br>数。 |
| pageNo | Integer | 否 | 1 | 不填的情况下，默认是1 |
| pageSize | Integer | 否 | 20 | 分页大小，默认20，最大200 |
| startTime | Long | 否 | 1553529600000 | 查询的起始时间，单位是毫秒 |
| endTime | Long | 否 | 1553616000000 | 查询的结束时间，单位是毫秒 |
| form | bit | 否 | 1 | 1或0，默认0。如果是1，则会查询这个时间段<br>内表单变化的产品 |
| picture | bit | 否 | 1 | 1或0，默认0。如果是1，则会查询这个时间段<br>内资源图变化的产品 |
| detail | bit | 否 | 1 | 1或0，默认0。如果是1，则会查询这个时间段<br>内详情页变化的产品 |
| productCodes | String | 否 | 货号1,货号2 | 货号，多个货号用逗号拼接 |
| excludeDraft | bit | 否 | 1 | 是否排除草稿状态货号，1或0，默认1排除。 |
| tags | String | 否 | 标签1,标签2 | 产品标签，如果有多个用逗号分割 |

#### 4.7.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| count | Integer | 601 | 符合要求的产品总数 |
| pageNo | Integer | 1 | 当前查询的产品分页 |
| pageSize | Integer | 20 | 当前查询的产品分页大小，默认20 |
| products | List<AllInOneProduct> | - | AllInOneProduct这个类在SDK中有提供。具体可以看<br>SDK中这个类的信息 |

#### 4.7.4 请求示例

```java
ProductBasicSearchByDateRangeRequest request = new ProductBasicSearchByDateRangeRequest(appKey, appSecr
et, dopKey, host);
request.setMerchantId(merchantId);
request.setDate(date);
request.setPageNo(pageNo);
request.setPageSize(pageSize);
request.setStartTime(startTime);
request.setEndTime(endTime);
request.setForm(true);
request.setPicture(true);
request.setDetail(true);
request.setProductCodes("test001");
request.setExcludeDraft(true);
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
JSONObject body = (JSONObject) reply.getResponse().getBody();
System.out.println("count : " + body.getIntValue("count"));
System.out.println("pageNo : " + body.getIntValue("pageNo"));
System.out.println("pageSize : " + body.getIntValue("pageSize"));
List<AllInOneProduct> allInOneProducts
= JSON.parseArray(JSON.toJSONString(body.getJSONArray("products")), AllInOneProduct.class);
System.out.println("products : " + JSON.toJSONString(allInOneProducts));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 4.7.5 响应示例

```json
{
"body": {
"count": 601,
"pageNo": 1,
"pageSize": 10,
"products": [
// 这是一个 AllInOneProduct 的 list，具体这个类的结构，见附录一
]
},
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 4.8 查询产品上架状态

#### 4.8.1 接口名称

**接口名:** `dp.product.distribution.get`

**版本:** v2

#### 4.8.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| productId | Long | 是 | 123 | 深绘产品id，可以通过4.4、4.5接口获取 |

#### 4.8.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| site | String | TMALL | 上货成功平台<br>平台含义参考附录二 DpProductPictures的plac<br>e |
| time | date | 1765793044000 | 最新上货成功时间 |
| url | String | https://detail.tmall.com/item.htm?i<br>d=59843336234 | 商品线上链接 |
| shopNick | String | xx专卖店 | 上货店铺 |
| videoHomeEnable | Boolean | true | 是否启用视频主图（天猫、淘宝平台根据这个使<br>用主图或者视频主图） |
| detailTemplateCode | String | PSAA4747 | 上货详情页模版编码 |
| detailTemplateCode | String | 2025秋冬详情 | 上货详情页模版名称 |
| watermarkId | String | a7bb2cf448d84e6781259a23d6087bde | 水印id |
| watermarkName | String | 白水印 | 水印名 |

#### 4.8.4 请求示例

```java
ProductPostFindDistributionByIdRequest request = new ProductPostFindDistributionByIdRequest(appKey, appSecret,
dopKey, host);
request.setProductId(productId);
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 4.8.5 响应示例

```json
{
"body": [
{
"time": 1772679568000,
"shop": "天猫专卖店",
"site": "TMALL",
"url": "https://detail.tmall.com/item.htm?id=10271",
"videoHomeEnable": true,
"watermarkId": "a7bb2cf448d84e6781259a23d6087bde",
"watermarkName": "白水印测试",
"detailTemplateName": "25 秋冬详情",
"detailTemplateCode": "PSAA4747"
},
{
"time": 1761099738000,
"shop": "淘宝专卖店",
"site": "TAOBAO",
"url": "https://item.taobao.com/item.htm?id=948218412"
}
],
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 4.9 产品颜色与 SKU 增量更新（特殊用户定制需求）

#### 4.9.1 接口名称

**接口名:** `dp.product.sku.color.incremental.update`

**版本:** v2

**传输:** 仅 HTTP；仓库 CLI 通过 1.6.24 SDK bridge 的对应 request class 调用。

#### 4.9.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| productId | String（PDF）/ Long（SDK setter） | 是 | 519b97a3bb5e451595c9ff5cdd13e40d | 产品在深绘系统内的 id，作为 query 参数发送；CLI bridge 接受可解析为十进制 Long 的产品 id |
| product | Product | 是 | `cn.deepdraw.api.rest.entity.Product` | 作为 POST entity 发送的产品增量 payload |

> 版本边界：PDF 将 `productId` 示例写作 String/十六进制样式，而 1.6.24 SDK request setter 为 `Long`。CLI 不会把 PDF 示例当作真实授权或在线探测；使用 CLI 时应提供 SDK 可解析的十进制产品 id。

#### 4.9.3 注意事项-重要

- 这是颜色、SKU、尺码的增量更新接口，颜色、SKU、尺码必填。
- 尺码表（包括唯品会尺码表）存在时，更新数据必须同时包含尺码；尺码表中的每个尺码必须能在尺码字段中找到，否则会返回“尺码表错误”。
- 商家 SKU 存在时，更新数据必须同时包含尺码和颜色；SKU 中的尺码必须能在尺码字段中找到，SKU 中的颜色必须能在颜色字段的颜色别名中找到，否则会返回“sku 错误”。
- 颜色字段由“颜色名,别名;...”与可选的“颜色别名,色码;...”两部分组成，使用英文标点。颜色名、别名、色码不能重复；色码部分的颜色名必须已出现在颜色别名部分。
- 该接口会修改产品，CLI 必须先生成 `--plan`，只有用户明确授权后才能用 `--execute --yes`；文档中的示例不等于授权。

#### 4.9.4 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| id | String | 1c150d3ed75a49d1aa3a8f3439db3ecf | 更新的产品 id |
| updates | List | `["标题","平台"]` | 更新成功的字段 |

#### 4.9.5 请求示例

```java
ProductPostIncrementalUpdateProductSkuColorByIdRequest request =
    new ProductPostIncrementalUpdateProductSkuColorByIdRequest(appKey, appSecret, dopKey, host);
request.setProductId(productId);
request.setProduct(product);
Reply reply = request.execute();
```

#### 4.9.6 响应示例

```json
{
  "body": {
    "id": "1c150d3ed75a49d1aa3a8f3439db3ecf",
    "updates": ["颜色", "平台"]
  },
  "code": 10200,
  "reason": "访问成功！",
  "requestId": 1616,
  "response": "success",
  "timestamp": 1555982680755
}
```

## 5 图片分析 API

### 5.1 以图搜款-款号接口（额外收费）

#### 5.1.1 接口名称

**接口名:** `dp.product.retrieve.image`

**版本:** v2

#### 5.1.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| merchantId | Long | 是 | 12345 | 商户在深绘系统中的id |
| url | String | 否 | https://img.alicdn.com/imgextra/i2/1865<br>094882/O1CN01QQFYVP1lw06OADz2<br>f_!!2-item_pic.png | 图片地址 |
| outline | String | 否 | 0.1,1.0,1.0,0.1 | 主体九宫格(x1,x2,x3,x4)，可设定上传图<br>片中搜相似的主体位置。参数分别代表<br>主体上、右、下、左边在所属图片上边<br>、左边、上边、左边的比例（详见示意<br>图）。 |

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| img | String | 否 | data:image/jpg;base64,/9j/4AAQ<br>SkZJRgABAQEA.... | 图片的base64编码 |

注意：url 和 img 必填一个，如果传了 url，会忽略 img。

#### 5.1.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| img | String | //product.resources.deepdraw.biz/zj/testaccount/64172334d7aa40b09ff6dd75f8107118/original/9e9a007d5b3e45dd8fd220dc0b6684fe.jpg | 相似图 |
| code | String | MW7007 | 相似图对应的货号 |
| productId | String | 64172334d7aa40b09ff6dd75f810718 | 相似款对应的深绘商品id |
| type | String | upper | 相似款所属的类别。目前的区分类别有：上装(u<br>pper)、下装(down)、裙装(skirt)、内衣(under<br>clothes)、箱包(bag)、鞋子(shoes)、配饰(acc<br>essories) |
| colorCode | String | 01 | 相似图色码 |

#### 5.1.4 请求示例

```java
ProductImageRetrievalRequestrequest = new ProductImageRetrievalRequest(appKey, appSecret, dopKey, host);
request.setMerchantId(merchantId);
request.setUrl(url);// 如果使用图片的 base64 编码，这样传：request.setImg(getImgBase64())
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 5.1.5 响应示例

```json
{
"body": [
{
"img": "//product.resources.deepdraw.biz/zj/testaccount/64172334d7aa40b09ff6dd75f8107118/original/9e9a007d5
b3e45dd8fd220dc0b6684fe.jpg",
"code": "MW7007",
"productId": "64172334d7aa40b09ff6dd75f810718",
"type": "upper"
},
{
"img": "//product.resources.deepdraw.biz/zj/testaccount/f8c5daff67ae4bd9b912242b27718c62/original/dd858b1dd
63f4e4591b5b1df98751a25.jpg",
"code": "MW8769",
"productId": "f8c5daff67ae4bd9b91224227718c62",
"type": "upper"
},
{
"img": "//product.resources.deepdraw.biz/zj/testaccount/1d2aa5ffb1fb43398af10881c604c56a/original/5fcb71a104
744f18ba360371a002a488.jpg",
"code": "WG640W",
"productId": "1d2aa5ffb1fb43398a0881c604c56a",
"type": "down"
}
],
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 5.2 以图搜款-查询上货记录

#### 5.2.1 接口名称

**接口名:** `dp.product.distributions.get`

**版本:** v2

#### 5.2.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| productId | String | 是 | 519b97a3bb5e451595c9ff5cdd13e40d | 产品在深绘系统内的id |

#### 5.2.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| url | String | https://detail.tmall.com/item.htm?id<br>=59843336234 | 商品线上链接 |
| shop | String | - | 商品线上对应的店铺名称 |
| site | String | TMALL | 商品上货的平台 |
| time | date | 1765793044000 | 最新上货成功时间 |
| videoHomeEnable | Boolean | true | 是否启用视频主图（天猫、淘宝平台根据这个使<br>用主图或者视频主图） |
| detailTemplateCode | String | PSAA4747 | 上货详情页模版编码 |
| detailTemplateCode | String | 2025秋冬详情 | 上货详情页模版名称 |
| watermarkId | String | a7bb2cf448d84e6781259a23d6087bde | 水印id |
| watermarkName | String | 白水印 | 水印名 |

#### 5.2.4 请求示例

```java
ProductDistributionsGetRequest request = new ProductDistributionsGetRequest(appKey, appSecret, dopKey, host);
request.setProductId(productId);
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 5.2.5 响应示例

```json
{
"body": [
{
"time": 1772679568000,
"shop": "天猫专卖店",
"site": "TMALL",
"videoHomeEnable": true,
"url": "https://detail.tmall.com/item.htm?id=10271",
"watermarkId": "a7bb2cf448d84e6781259a23d6087bde",
"watermarkName": "白水印测试",
"detailTemplateName": "25 秋冬详情",
"detailTemplateCode": "PSAA4747"
},
{
"time": 1761099738000,
"shop": "淘宝专卖店",
"site": "TAOBAO",
"url": "https://item.taobao.com/item.htm?id=948218412"
},
{
"time": 1761099722000,
"shop": "淘宝旗舰店",
"site": "TAOBAO",
"url": "https://item.taobao.com/item.htm?id=9482181"
}
],
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}}
```

### 5.3 图片服装多标签分析（额外收费）

#### 5.3.1 接口名称

**接口名:** `dp.product.label.image`

**版本:** v2

#### 5.3.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| url | String | 否 | https://img.alicdn.com/imgextra/i2/1865<br>094882/O1CN01QQFYVP1lw06OADz2<br>f_!!2-item_pic.png | 图片地址 |
| img | String | 否 | data:image/jpg;base64,/9j/4AAQ<br>SkZJRgABAQEA.... | 图片的base64编码 |

注意：url 和 img 必填一个，如果传了 url，会忽略 img。

#### 5.3.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| outline | Sring | 0.4338,0.8387,0.9988,0.4037 | 服装分析九宫格（x1,x2,x3,x4），参数分别代表 |

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
|  |  |  | 主体上、右、下、左边在所属图片上边、左边、<br>上边、左边的比例（详见示意图）。 |
| _species | String | 女装 | 服装类型 |
| _body_part | String | 上装 | 适合部分 |
| _category | String | 半身裙 | 类目 |
| _cloth_orientation | String | 正面 | 服装朝向 |
| _hem | String | 常规 | 下摆,多个值以下划线分隔 |
| _fabric | String | 牛仔 | 面料,多个值以下划线分隔 |
| _color_items | List | ["蓝_A6C2D5_0.7","白_FAFBFC_0.3"] | 颜色，每个List元素为颜色名称+颜色值+颜色占<br>比的组合 |
| _craft | String | 绣花_褶皱 | 服装工艺，多个值以下划线分隔 |
| _style | String | 百搭_休闲_甜美 | 风格,多个值以下划线分隔 |
| _collar | String | 圆领 | 领型,多个值以下划线分隔 |
| _sleeve_type | String | 喇叭袖 | 袖型,多个值以下划线分隔 |
| _texture | String | 拼色 | 色彩花纹,多个值以下划线分隔 |
| _coat_length | String | 正常 | 衣长,多个值以下划线分隔 |
| _sleeve_length | String | 长袖 | 袖长,多个值以下划线分隔 |
| _pant_length | String | 九分裤 | 裤长,多个值以下划线分隔 |
| _skirt_length | String | 不可见 | 裙长,多个值以下划线分隔 |
| _pattern | String | 植物花卉_文字 | 图案,多个值以下划线分隔 |
| _placket | String | 套头 | 门襟,多个值以下划线分隔 |

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| _pants_contour | String | 锥子裤 | 裤型,多个值以下划线分隔 |
| _upper_dress_contour | String | H型 | 廓形,多个值以下划线分隔 |
| _type_version | String | 修身 | 版型,多个值以下划线分隔 |
| _suit | String | 西服套装 | 套装类型,多个值以下划线分隔 |
| _pocket | String | 贴袋 | 口袋,多个值以下划线分隔 |
| _accessories | String | 流苏 | 辅料,多个值以下划线分隔 |
| _waist | String | 高腰 | 腰部,多个值以下划线分隔 |
| _season | String | 春秋 | 适用季节 |

#### 5.3.4 请求示例

```java
ProductImageLabelRequestrequest = new ProductImageLabelRequest(appKey, appSecret, dopKey, host);
request.setUrl(url);// 如果使用图片的 base64 编码，这样传：request.setImg(getImgBase64())
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 5.3.5 响应示例

```json
{
"body": [
{
"_body_part": "全身装",
"_category": "夹克",
"_coat_length": "正常",
"_collar": "直线领",
"_color_items": [
{
"RGB": "211,196,182",
"name_zh": "橙",
"prob": 0.722
},
{
"RGB": "131,108,89",
"name_zh": "橙",
"prob": 0.278
}
],
"_crafts": [
"褶皱"
],
"_fabric": "雪纺",
"_hem": "常规",
"_outline": "0.4338,0.8387,0.9988,0.4037",
"_patterns": [
"无图案"
],
"_placket": "单排扣",
"_sleeve_length": "七分袖",
"_sleeve_type": "喇叭袖",
"_species": "女装",
"_styles": [
"甜美",
"淑女"
],
"_texture": "拼色",
"_type_version": "宽松",
"_upper_dress_contour": "A 型",
"id": "0"
}
],
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 5.4 图片素材上传接口（额外收费）

#### 5.4.1 接口名称

**接口名:** `dp.product.image.upload`

**版本:** v2

#### 5.4.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| merchantId | Long | 是 | 2011010101 | 商户ID |
| productId | Long | 是 | 20124010331 | 产品ID |
| images | List | 是 | ["url地址1",""url地址2"] | 要上传的图片集合 |

注意：images 不能大于 100 条记录

#### 5.4.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| productId | Long | 1111 | 商品id |
| taskId | Long | 2222 | 任务id |

#### 5.4.4 请求示例

```java
ProductImageUploadRequest request = new ProductImageUploadRequest(appKey, appSecret, dopKey, host);
request.setProductId(123L);
request.setMerchantId(123L);
List<String> list = new ArrayList<>();
list.add("http://e.hiphotos.baidu.com/image/pic/item/a1ec08fa513d2697e542494057fbb2fb4316d81e.jpg");
list.add("http://c.hiphotos.baidu.com/image/pic/item/30adcbef76094b36de8a2fe5a1cc7cd98d109d99.jpg");
list.add("http://h.hiphotos.baidu.com/image/pic/item/7c1ed21b0ef41bd5f2c2a9e953da81cb39db3d1d.jpg");
request.setImages(list);
Reply result = request.execute();
```

#### 5.4.5 响应示例

```json
{
"body": {
"taskId": "123456",
"productId": "123456"
},
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 5.5 查询上传图片素材任务接口（额外收费）

#### 5.5.1 接口名称

**接口名:** `dp.product.image.query`

**版本:** v2

#### 5.5.2 请求参数

| 名称 | 类型 | 是否必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| taskId | Long | 是 | 1001 | 任务id |
| merchantId | Long | 是 | 2011010101 | 商户id |

#### 5.5.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| status | Long | 1 | 结果：0未完成 1完成 2超时失败 |

#### 5.5.4 请求示例

```java
ProductImageUploadTaskQueryRequest request = new ProductImageUploadTaskQueryRequest(appKey, appSecret,
dopKey, host);
request.setTaskId(23825L);
request.setMerchantId(391L);
Reply result = request.execute()
```

#### 5.5.5 响应示例

```json
{
"body": {
"status": "1" //0 未完成 1 完成 2 超时失败
},
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

### 5.6 图片修改（额外收费）

#### 5.6.1 接口名称

**接口名:** `dp.product.image.update`

**版本:** v2

#### 5.6.2 请求参数

注意：images 不能大于 100 条记录，productId 和 productCode 必须填一个

| 名称 | 类型 | 是否<br>必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| merchantId | Long | 是 | 2011010101 | 商户ID |

| 名称 | 类型 | 是否<br>必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
| productId | Long | 否 | 20124010331 | 产品ID |
| productCode | String | 否 | 测试货号 | 产品货号 |
| pictureAddType | PictureAddType | 否 | APPEND | 图片新增方式（默认追加，特殊场景使<br>用，非必填）<br>APPEND: 追加<br>UPDATE_BY_FILE_NAME：根据文件<br>名覆盖<br>FULL_UPDATE：全量覆盖 |
| images | DpImages | 是 | {<br>"addImages":[<br>{<br>"id":2592590,<br>"url":<br>"http://c.hiphotos.baidu.com/ima<br>ge/pic/item/30adcbef76094b36de<br>8a2fe5a1cc7cd98d109d99.jpg",<br>"name":"模特222.jpg",<br>"labels":["yz","ys"]<br>},<br>{<br>"id":2592591,<br>"url":<br>"http://h.hiphotos.baidu.com/ima<br>ge/pic/item/7c1ed21b0ef41bd5f2<br>c2a9e953da81cb39db3d1d.jpg",<br>"name":"模特333.jpg"<br>},<br>{<br>"id":1333,<br>"url":<br>"http://h.hiphotos.baidu.com/ima<br>ge/pic/item/a.mp4",<br>"name":"视频.mp4"<br>}<br>],<br>"updateImages":[<br>{<br>"id":2592594,<br>"url":<br>"https://product.resources.leyclo<br>ud.cn/HuN/mx001/a467e6b85e4a<br>4e8b831dce914d288d30/original/ | addImages、updateImages、del<br>eteImages：要新增、修改、删除的图<br>片集合。<br>id：对接方图片id/视频id<br>url：图片地址或视频地址<br>name：图片名称或视频名称<br>labels：图片分组标签(非必填)<br>color：图片颜色(非必填，可自动识别)<br>site：图片平台(非必填，默认自动识别素<br>材类型ALL)<br>pictureType：图片类型(非必填，默认自<br>动识别素材图如模特图、静物图等)<br>sortNum：图片排序（非必填，默认按新<br>增顺序设置） |

| 名称 | 类型 | 是否<br>必须 | 示例值 | 描述 |
| --- | --- | --- | --- | --- |
|  |  |  | 8f3765491aa8404ca117adccedd<br>ced47.jpg",<br>"name":"测试新增.jpg",<br>"color":"蓝色2",<br>"site":"ALL",<br>"pictureType":"MODEL",<br>"sortNum":6<br>},<br>{<br>"id":2588626,<br>"url":<br>"//product.resources.leycloud.cn/<br>HuN/mx001/a467e6b85e4a4e8b8<br>31dce914d288d30/original/09b01<br>72c57ed4e8dac94d3b30030ae5c<br>.20231009160616235.jpg",<br>"name":"image001.jpg",<br>"color":"米白(批次3)",<br>"site":"ALL",<br>"pictureType":"MODEL",<br>"sortNum":1<br>},<br>{<br>"id":2592547,<br>"url":<br>"http://e.hiphotos.baidu.com/ima<br>ge/pic/item/a1ec08fa513d2697e5<br>42494057fbb2fb4316d81e.jpg",<br>"name":"文件名.jpg",<br>"color":"黑色",<br>"site":"XIAOHONGSHU",<br>"pictureType":"HOME",<br>"sortNum":2<br>}<br>],<br>"deleteImages":[<br>2592593<br>]<br>} |  |

#### 5.6.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| taskId | Long | 2222 | 任务id，-1时表示不涉及图片上传，操作成功 |

#### 5.6.4 请求示例

```java
ProductImageUpdateRequest request = new ProductImageUpdateRequest(APP_KEY, APP_SECRET, DOP_KEY, HOS
T);
request.setMerchantId(merchantId);
request.setProductId(productId);
// request.setProductCode(productCode);
DpImages images = new DpImages();
images.setAddImages(addImages);
images.setUpdateImages(updateImages);
images.setDeleteImages(deleteImageIds);
request.setImages(images);
Reply result = request.execute();
System.out.println(JSON.toJSONString(result));
```

#### 5.6.5 响应示例

```json
{
"response": {
"body": {
"taskId": 30010933
},
"code": 10200,
"reason": "访问成功！",
"requestId": -1,
"response": "success",
"timestamp": 1698389908216
},
"status": 200
}
```

## 6 通用信息 API

### 6.1 获取深绘标准颜色

#### 6.1.1 接口名称

**接口名:** `dp.colors.get`

**版本:** v2

#### 6.1.2 请求参数

无。

#### 6.1.3 响应参数

| 名称 | 类型 | 示例值 | 描述 |
| --- | --- | --- | --- |
| code | String | black | 色系编码 |
| name | String | 黑白灰系 | 色系名称 |
| colors | colors[] | - | 当前色系下具体标准色的集合。color代表标准<br>色值，enAlias代表标准色英文名称，name标准<br>色名称 |

#### 6.1.4 请求示例

```java
DeepdrawColorsRequestrequest = new DeepdrawColorsRequest(appKey, appSecret, dopKey, host);
Reply reply = request.execute();
if (200 == reply.getStatus()) {// 第一层判断请求成功与否
DopResponse response = reply.getResponse();
if (reply.getResponse().getCode() == 10200) {// 第二层判断从深绘调用的结果，10200 表示获取成功
System.out.println(JSON.toJSONString(reply.getResponse().getBody()));
} else {
System.out.println(JSON.toJSONString(reply.getResponse()));
}
} else {
System.out.println("请求失败");
}
```

#### 6.1.5 响应示例

```json
{
"body": [
{
"code": "black",
"name": "黑白灰系",
"colors": [
{
"color": "#f9f9f9",
"enAlias": "Beige",
"name": "米白"
},
{
"color": "#ffffff",
"enAlias": "White",
"name": "白色"
}
]
},
{
"code": "transparent",
"name": "透明系",
"colors": [
{
"color": "#ffffff",
"enAlias": "Clear",
"name": "透明"
}
]
}
],
"code": 10200,
"reason": "访问成功！",
"requestId": 1066,
"response": "success",
"timestamp": 1554286782459
}
```

## 附录一 AllInOneProduct：

AllInOneProduct
字段说明

| 字段 | 列2 | 说明 |
| --- | --- | --- |
| id |  | 产品uuid |
| productId |  | 产品id |
| code |  | 产品货号 |
| version |  | 产品当前更新版本 |
| createDate |  | 创建时间 |
| lastUpdateDate |  | 更新时间 |
| title |  | 产品名 |
| brandName |  | 品牌名 |
| remark |  | 产品备注 |
| complete |  | 草稿状态：`false` 为草稿，`true` 为完成 |
| primaryColor |  | 产品主色 |
| places |  | 产品配置的电商平台 |
| retailPrice |  | 标准价格 |
| onsaleDate |  | 期数 |
| trade |  | 产品类目信息 |
| colors | optionAliases：深绘标准色和sku颜色<br>别名映射关系<br>options：深绘标准色<br>texts:颜色备注 | 产品颜色信息 |

| 字段 | 列2 | 说明 |
| --- | --- | --- |
| sizes | field：所有颜色类型和选项<br>optionAliases：已选尺码和别名<br>Options：已选尺码<br>Texts：尺码备注 | 尺码信息 |
| skus | field：所有sku类型和选项<br>optionAliases：sku和别名<br>options：sku表头<br>skuItems：sku具体值（注意：sku颜<br>色为标准色，需要和colors里的option<br>Aliases做转换） | sku信息 |

| 字段 | 列2 | 说明 |
| --- | --- | --- |
| sizeTables | field:尺码字段基础信息<br>optionAliases：标准尺码和尺码别名<br>options：已选尺码表头<br>sizeTableItems：尺码详细内容(显示的<br>标准尺码，需要根据optionAliases的标<br>准尺码获取实际尺码别名) | 尺码表信息 |
| pictures |  | 产品图片信息（包括对应平台，类型），见附录二 |
| detalPages |  | 产品详情页信息，见附录三 |
| videos |  | 产品视频信息，见附录四 |
| tags |  | 产品标签集合 |

```json
{
"brandName": "丽丽",
"code": "VIPTEST+PIC6",
"colors": {
"field": {
"id": "1",
"name": "颜色",
"options": [
"黑色",
"深灰",
"浅黄",
"西瓜红",
"浅绿",
"深紫",
"紫红",
"粉红",
"青绿",
"卡其"
],
"type": "MULTI_CHOICE"
},
"optionAliases": {
"卡其": "卡其",
"粉红": "pink",
"黑色": "黑色"
},
"options": [
"黑色",
"粉红",
"卡其"
],
"texts": [
]
},
"createDate": 1554106032000,
"detalPages": [
{
"htmlPageUrl": "http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/html.20190
4081126419307.html",
"imagePageUrl": "http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/image.20
1904081126419307.html",
"mixedPageUrl": "http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/mixed.201
904081126419307.html",
"modules": {
"产品图": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
1264193071.jpg"
],
"尺寸及试穿": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
1264193072.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
1264193073.png",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
1264193074.png",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
1264193075.jpg"
],
"模特效果图": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
1264193076.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
1264193077.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
1264193078.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
1264193079.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12641930710.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12641930711.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12641930712.jpg"
],
"细节图": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12641930713.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12641930714.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12641930715.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12641930716.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12641930717.jpg"
]
},
"screenShotSectionUrls": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112
64193071.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112
64193072.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112
64193073.png",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112
64193074.png",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112
64193075.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112
64193076.jpg"
],
"templateName": "_t 颜色循环",
"time": 1554694045000
},
{
"htmlPageUrl": "http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/html.20190
40811254366324.html",
"imagePageUrl": "http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/image.20
19040811254366324.html",
"mixedPageUrl": "http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/mixed.201
9040811254366324.html",
"modules": {
"产品图": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12543663241.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12543663242.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12543663243.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12543663244.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12543663245.jpg"
],
"尺寸及试穿": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12543663246.png",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12543663247.png"
],
"模特效果图": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12543663248.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
12543663249.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
125436632410.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
125436632411.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
125436632412.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
125436632413.jpg"
],
"细节图": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
125436632414.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
125436632415.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
125436632416.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
125436632417.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.201904081
125436632418.jpg"
]
},
"screenShotSectionUrls": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112
543663241.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112
543663242.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112
543663243.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112
543663244.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112
543663245.jpg"
],
"templateName": " 夏装韩版淑女几何图形鲜艳明丽无袖连衣裙",
"time": 1554694015000
}
],
"fields": [
{
"field": {
"id": "33078",
"name": "京东销售价",
"options": [
],
"type": "TEXT"
},
"optionAliases": {
},
"options": [
],
"texts": [
]
},
{
"field": {
"id": "31052",
"name": "商品重量",
"options": [
],
"type": "TEXT"
},
"optionAliases": {
},
"options": [
],
"texts": [
]
}
],
"id": "1c150d3ed75a49d1aa3a8f3439db3ecf",
"productId": 111444,
"complete": true,
"remark": "备注",
"lastUpdateDate": 1554705745000,
"onsaleDate": 1554134400000,
"pictures": {
"pictures": {
"ALIBABA": {
"pictures": {
"COLOR": [
{
"id": 122222,
"color": "黑色",
"height": "800",
"name": "f94a8de1440749f5aea29ec59aa42dde.jpg",
"size": "187613",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/fd505a8c14484ee
5ab4d3c8cd773f1d1.jpg",
"width": "800"
},
{
"id": 122223,
"color": "pink",
"height": "800",
"name": "eeb952465dab4844bfabfc2ba9ba0899.jpg",
"size": "161008",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/077ba6d5e5f64cc
99612db2e797e6b6a.jpg",
"width": "800"
},
{
"id": 122224,
"color": "卡其",
"height": "800",
"name": "f6983375c2df4cb081afebdcb4636ef6.jpg",
"size": "183669",
"sortNum": 3,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/eee3a1947890442
cada16cdec6fe60df.jpg",
"width": "800"
}
]
},
"place": "ALIBABA"
},
"TAOBAO": {
"pictures": {
"COLOR": [
{
"id": 122225,
"color": "黑色",
"height": "800",
"name": "f94a8de1440749f5aea29ec59aa42dde.jpg",
"size": "187613",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/ffeb2ab0917b49cd
985685efdd526154.jpg",
"width": "800"
},
{
"id": 122226,
"color": "pink",
"height": "800",
"name": "eeb952465dab4844bfabfc2ba9ba0899.jpg",
"size": "161008",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/0094696d71c044a
b8cc6cf637742de9c.jpg",
"width": "800"
},
{
"id": 122227,
"color": "卡其",
"height": "800",
"name": "f6983375c2df4cb081afebdcb4636ef6.jpg",
"size": "183669",
"sortNum": 3,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/5b047230f32946c
d8c02cb21e29920e4.jpg",
"width": "800"
}
],
"HOME": [
{
"id": 122228,
"color": "卡其",
"height": "800",
"name": "6629bd83a9b047d8add4a9e8f8e189a7.jpg",
"size": "195472",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/6f2352a8c852462
38ed542b6ac80787c.jpg",
"width": "800"
},
{
"id": 122229,
"color": "卡其",
"height": "800",
"name": "74066a49bc6a4d8faadcc576d44c760b.jpg",
"size": "187613",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/6a3a8c688bb34de
bb5d705c0b16140c8.jpg",
"width": "800"
}
]
},
"place": "TAOBAO"
},
"TMALL": {
"pictures": {
"COLOR": [
{
"id": 1222230,
"color": "黑色",
"height": "800",
"name": "Y513505Q10 (14).jpg",
"size": "187613",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/f94a8de1440749f5
aea29ec59aa42dde.jpg",
"width": "800"
},
{
"id": 122231,
"color": "pink",
"height": "800",
"name": "90d307e9de2340e391eae5cfbd35ea6f.jpg",
"size": "161008",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/eeb952465dab484
4bfabfc2ba9ba0899.jpg",
"width": "800"
},
{
"id": 122232,
"color": "卡其",
"height": "800",
"name": "0cb7b5a90f6c4745b5f3817e385464a3.jpg",
"size": "183669",
"sortNum": 3,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/f6983375c2df4cb0
81afebdcb4636ef6.jpg",
"width": "800"
}
],
"HOME": [
{
"id": 122233,
"color": "卡其",
"height": "800",
"name": "23b88e45186442398b61b29d75fdeffb.jpg",
"size": "195472",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/6629bd83a9b047d
8add4a9e8f8e189a7.jpg",
"width": "800"
},
{
"id": 122234,
"color": "卡其",
"height": "800",
"name": "dbe2b295954244cbb8c9d08400d61d08.jpg",
"size": "187613",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/74066a49bc6a4d8
faadcc576d44c760b.jpg",
"width": "800"
}
],
"QUALIFICATION": [
{
"id": 122235,
"color": "黑色",
"height": "800",
"md5": "",
"name": "wahaxi(9).jpg",
"size": "466912",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/184863f967e0457
1bd05833fa7a540aa.adjustment.20190408105402.jpg",
"width": "800"
},
{
"id": 122236,
"color": "黑色",
"height": "800",
"md5": "",
"name": "wahaxi(10).jpg",
"size": "535189",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/2c7e6d291fe545d
99d3cfff5bc02847e.adjustment.20190408105406.jpg",
"width": "800"
}
],
"VIDEO_HOME": [
{
"id": 122237,
"color": "卡其",
"height": "1000",
"name": "23b88e45186442398b61b29d75fdeffb.9b88a37f-d9fc-4016-a19f-221b886731ba.adjustment.201904081
43550.jpg",
"size": "244249",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/3807b4f75434406
ab043c5f25a3ebbdc.jpg",
"width": "750"
}
],
"WIRELESS_HOME": [
{
"id": 122238,
"color": "卡其",
"height": "800",
"name": "23b88e45186442398b61b29d75fdeffb.9b88a37f-d9fc-4016-a19f-221b886731ba.adjustment.201904081
43550.jpg",
"size": "195472",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/08000f375a3a4fea
84f93e9e1cf0c00a.jpg",
"width": "800"
},
{
"color": "黑色",
"height": "800",
"name": "aec4453a37174c9fb8d9bc863afccea7.15f93954-5699-40e5-863c-0e3d853c3496.adjustment.20190408
143559.JPG",
"size": "280298",
"sortNum": 5,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/8262a71a5204466
b98d2cc7fd4e8b5e9.JPG",
"width": "800"
}
]
},
"place": "TMALL"
}
}
},
"videos": {
"videos": {
"TMALL": {
"place": "TMALL",
"videos": {
"VIDEO": [
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/1.mp
4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/CXxaGZD6aP.jpg",
"feature": "{\"detail\":true,\"miniDetail\":true,\"videoDisplayType\":\"chuandazhanshi\"}",
"height": 800,
"id": 155114,
"proportion": "3:4",
"size": 1401352,
"sortNum": 1,
"template": "UPLOAD",
"thirdPartyAddress": "",
"width": 800
},
{
"feature": "{\"detail\":false,\"miniDetail\":true,\"videoDisplayType\":\"other_minidetail\"}",
"id": -1,
"proportion": "3:4",
"sortNum": 2,
"template": "THIRD_PARTY",
"thirdPartyAddress": "222"
},
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/1.mp
4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/CXxaGZD6aP.jpg",
"feature": "{\"detail\":true,\"miniDetail\":true,\"videoDisplayType\":\"baobeizhanshi\"}",
"height": 800,
"id": 155114,
"proportion": "3:4",
"size": 1401352,
"sortNum": 3,
"template": "THIRD_PARTY",
"thirdPartyAddress": "3333",
"width": 800
},
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/2.mp
4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/KtwsOvwJWd.jpg",
"feature": "{\"detail\":true,\"miniDetail\":true,\"videoDisplayType\":\"chuandazhanshi\"}",
"height": 1000,
"id": 155111,
"proportion": "9:16",
"size": 2292491,
"sortNum": 1,
"template": "THIRD_PARTY",
"thirdPartyAddress": "444",
"width": 750
},
{
"feature": "{\"detail\":true,\"miniDetail\":true,\"videoDisplayType\":\"default_baobei\"}",
"id": -1,
"proportion": "9:16",
"sortNum": 2,
"template": "THIRD_PARTY",
"thirdPartyAddress": "555"
},
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/tm91
6e(2).mp4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/1gWEe81IBM.jpg",
"feature": "{\"detail\":false,\"miniDetail\":true,\"videoDisplayType\":\"baobeizhanshi\"}",
"height": 1280,
"id": 157659,
"proportion": "9:16",
"size": 3522054,
"sortNum": 3,
"template": "THIRD_PARTY",
"thirdPartyAddress": "6666",
"width": 720
}
]
}
},
"TAOBAO": {
"place": "TAOBAO",
"videos": {
"VIDEO": [
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/2.mp
4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/KtwsOvwJWd.jpg",
"feature": "{}",
"height": 1000,
"id": 155111,
"size": 2292491,
"sortNum": 1,
"template": "UPLOAD",
"width": 750
}
]
}
},
"JDDAOJIA": {
"place": "JDDAOJIA",
"videos": {
"VIDEO": [
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/1.mp
4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/CXxaGZD6aP.jpg",
"feature": "{}",
"height": 800,
"id": 155114,
"size": 1401352,
"sortNum": 1,
"template": "UPLOAD",
"width": 800
}
]
}
},
"HAOYK": {
"place": "HAOYK",
"videos": {
"VIDEO": [
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/2.mp
4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/KtwsOvwJWd.jpg",
"feature": "{}",
"height": 1000,
"id": 155111,
"size": 2292491,
"sortNum": 1,
"template": "UPLOAD",
"width": 750
}
]
}
}
}
},
"places": [
"JD",
"TMALL",
"TAOBAO",
"VIP"
],
"primaryColor": "黑色",
"retailPrice": "128",
"sizeTables": [
{
"field": {
"id": "20",
"name": "尺码表",
"options": [
"体重",
"腰围",
"裙长",
"下摆围",
"臀围 1",
"身高"
],
"type": "MULTI_TEXT"
},
"optionAliases": {
"下摆围": "下摆围",
"体重": "体重",
"腰围": "腰围",
"臀围 1": "臀围",
"裙长": "裙长",
"身高": "身高"
},
"options": [
"体重",
"腰围",
"裙长",
"下摆围",
"臀围 1",
"身高"
],
"sizeTableItems": [
{
"size": "155",
"values": {
"体重": "5",
"腰围": "5",
"臀围 1": "4",
"身高": "4"
}
}
]
},
{
"field": {
"id": "35793",
"name": "唯品会尺码表",
"options": [
"体积",
"宽",
"长"
],
"type": "MULTI_TEXT"
},
"optionAliases": {
"体积": "体积",
"宽": "宽",
"长": "长"
},
"options": [
"体积",
"宽",
"长"
],
"sizeTableItems": [
]
}
],
"sizes": {
"field": {
"id": "782",
"name": "尺码",
"options": [
"10XL",
"170",
"L",
"M",
"均码",
"155",
"XXS",
"S",
"单一码",
"32",
"33",
"34",
"165",
"XL",
"XS"
],
"type": "MULTI_CHOICE"
},
"optionAliases": {
"155": "s"
},
"options": [
"155"
],
"texts": [
"33861,s"
]
},
"skus": {
"field": {
"id": "35792",
"name": "商家 sku",
"options": [
"速卖通零售价",
"货号",
"唯品会条形码",
"价格",
"拼多多单买价",
"商家编码",
"条形码",
"上市时间",
"sku 码",
"数量",
"拼多多团购价",
"京东价",
"供货价",
"速卖通商家编码",
"唯品会货号",
"零售价"
],
"type": "MULTI_TEXT"
},
"optionAliases": {
},
"options": [
"商家编码",
"条形码",
"货号",
"上市时间",
"数量",
"唯品会条形码",
"京东价",
"供货价",
"价格",
"唯品会货号",
"零售价"
],
"skuItems": [
{
"color": "卡其",
"size": "155",
"values": {
"上市时间": "2019-03",
"京东价": "128",
"价格": "128",
"供货价": "128",
"数量": "1",
"货号": "VIPTEST+PIC6",
"零售价": "128"
}
},
{
"color": "粉红",
"size": "155",
"values": {
"上市时间": "2019-03",
"京东价": "128",
"价格": "128",
"供货价": "128",
"数量": "1",
"货号": "VIPTEST+PIC6",
"零售价": "128"
}
},
{
"color": "黑色",
"size": "155",
"values": {
"上市时间": "2019-03",
"京东价": "128",
"价格": "128",
"供货价": "128",
"数量": "1",
"货号": "VIPTEST+PIC6",
"零售价": "128"
}
}
]
},
"title": "2019 半身裙深绘测试产品请勿上架/购买(可删除)",
"trade": {
"id": "34",
"name": "半身裙",
"path": "所有行业.服装.女装.半身裙"
},
"version": 19
}
```


## 附录二 DpProductPictures：

DpProductPictures
字段说明

| 字段 | 说明 |
| --- | --- |
| pictures | 图片集合 |
| place/平台类型 | 参考枚举：cn.deepdraw.api.model.dp.basic.DpPlace<br>TAOBAO(淘宝),<br>PAIPAI(拍拍),<br>ALIBABA(1688),<br>TMALL(天猫), |

| 字段 | 说明 |
| --- | --- |
|  | JD(京东),<br>YHD(一号店),<br>GOME(国美),<br>JUMEI(聚美优品),<br>SUNING(苏宁),<br>VIP(唯品会),<br>YIXUN(易迅),<br>STANDALONE(自营站点),<br>OTHER(其他),<br>XIUPIN(网易秀品),<br>YISHANG(伊尚时尚),<br>XIKE(细刻),<br>ALIEXPRESS(速卖通),<br>SANFU(三福),<br>KAOLA(考拉),<br>GUXING(古星),<br>YOUZAN(有赞),<br>PDD(拼多多),<br>WEIMOB(微盟),<br>CLOUDSHOP(云店),<br>KBOXINGIES(劲霸商城),<br>KBOXINGCS(劲霸圆周率),<br>DANGDANG(当当),<br>BEIBEI(贝贝),<br>YUNJI(云集),<br>XIAOHONGSHU(小红书),<br>MOGUJIE(蘑菇街),<br>RUISHA(锐鲨),<br>CONNECT(数致),<br>SEMAGENTO(SE麦进斗),<br>SHOPEESG(Shopee新加坡),<br>SHOPEEID(Shopee印尼),<br>SHOPEEVN(Shopee越南),<br>SHOPEETW(Shopee台湾),<br>SHOPEEMY(Shopee马来),<br>SHOPEETH(Shopee泰国),<br>SHOPEEPH(Shopee菲律宾),<br>SSG(SSG),<br>LAZADASG(Lazada新加坡),<br>LAZADAID(Lazada印尼),<br>LAZADAVN(Lazada越南),<br>LAZADAMY(Lazada马来),<br>LAZADATH(Lazada泰国),<br>LAZADAPH(Lazada菲律宾), |

| 字段 | 说明 |
| --- | --- |
|  | DOUYIN(抖音),<br>KUAISHOU(快手),<br>YIKE(驿氪),<br>AIKUCUN(爱库存),<br>YOUPIN(小米优品),<br>YANXUAN(网易严选),<br>DEWU(得物),<br>HUIJU(惠聚),<br>ZALORATW(Zalora台湾),<br>ZALORAHK(Zalora香港),<br>ZALORAMY(Zalora马来西亚),<br>ZALORASG(Zalora新加坡),<br>LAZADACB(Lazada全球),<br>WEIDIAN(微店),<br>DIANJIA(店加),<br>MIAOJIE(喵街),<br>MOMO(MOMO),<br>SHANGOU(美团闪购),<br>AIMER(爱慕),<br>KUKAMALL(顾家商城),<br>ELEME(饿了么),<br>SHANSHAN(杉杉奥莱),<br>HAOYK(好衣库),<br>JDDAOJIA(京东到家),<br>WEIXINXIAODIAN(微信视频小店),<br>XIAOYOU(晓柚),<br>DOUYINXSG(抖音小时达),<br>BBC(澜海企业购),<br>ALL(通用素材图); |
| 图片类型 | 图片类型，从下面的图片类型中选择：<br>参考枚举：cn.deepdraw.api.model.dp.basic.PictureType<br>素材图<br>MODEL(模特图),<br>STILL_LIFE(静物图),<br>DETAIL(细节图),<br>FABRIC(面料图),<br>HANGTAG(吊牌图),<br>PERMANENT_LABEL(洗唛图),<br>SHOW(展示图),<br>SUMMARY(列表图),<br>UNKNOWN( 未知图),<br>OTHER(自定义图),<br>RESERVED(搭配图Y),<br>MATCH(搭配图M), |

| 字段 | 说明 |
| --- | --- |
|  | COMBINE_COLOR( 拼色图),<br>FOLDED(折叠图)<br>资源图<br>HOME(主图),<br>HOME_SUBSIDIARY(主图辅助图，3:4主图，9:16主图),<br>WIRELESS_HOME(无线主图),<br>COLOR(颜色图),<br>VERTICAL(竖图/列表图),<br>QUALIFICATION(资质图),<br>TRANSPARENCY(透明图),<br>VIDEO_HOME(视频主图),<br>LONG_HOME(长主图),<br>TRY_REPORT(试穿报告图),<br>RECOMMEND_SIZE(尺码推荐图),<br>CERTIFICATE(价格凭证图),<br>WHITE_BACKGROUND(白底图),<br>COLOR_SPEC(颜色规格图),<br>SUBSIDIARY(辅助识别图),<br>BVRC(智能拼图),<br>SCENE_IMAGE(场景图),<br>SELLING_POINT(卖点图) |
| id | 深绘图片id |
| color | 颜色别名 |
| name | 文件名 |
| size | 文件大小 |
| sortNum | 图片排序 |
| url | 图片地址 |
| width | 宽 |
| height | 高 |
| skc | 图片颜色可能的skc（根据sku内容推测出的skc，没匹配上没有就是空的<br>） |

```json
{
"pictures": {
"ALIBABA": {
"pictures": {
"COLOR": [
{
"id": 212222,
"color": "黑色",
"height": "800",
"name": "f94a8de1440749f5aea29ec59aa42dde.jpg",
"size": "187613",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/fd505a8c14484ee5a
b4d3c8cd773f1d1.jpg",
"width": "800",
"skc": "skc01"
},
{
"id": 212223,
"color": "pink",
"height": "800",
"name": "eeb952465dab4844bfabfc2ba9ba0899.jpg",
"size": "161008",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/077ba6d5e5f64cc99
612db2e797e6b6a.jpg",
"width": "800"
},
{
"id": 212224,
"color": "卡其",
"height": "800",
"name": "f6983375c2df4cb081afebdcb4636ef6.jpg",
"size": "183669",
"sortNum": 3,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/eee3a1947890442c
ada16cdec6fe60df.jpg",
"width": "800"
}
]
},
"place": "ALIBABA"
},
"TAOBAO": {
"pictures": {
"COLOR": [
{
"id": 212225,
"color": "黑色",
"height": "800",
"name": "f94a8de1440749f5aea29ec59aa42dde.jpg",
"size": "187613",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/ffeb2ab0917b49cd9
85685efdd526154.jpg",
"width": "800"
},
{
"id": 212226,
"color": "pink",
"height": "800",
"name": "eeb952465dab4844bfabfc2ba9ba0899.jpg",
"size": "161008",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/0094696d71c044ab
8cc6cf637742de9c.jpg",
"width": "800"
},
{
"id": 212227,
"color": "卡其",
"height": "800",
"name": "f6983375c2df4cb081afebdcb4636ef6.jpg",
"size": "183669",
"sortNum": 3,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/5b047230f32946cd8
c02cb21e29920e4.jpg",
"width": "800"
}
],
"HOME": [
{
"id": 212228,
"color": "卡其",
"height": "800",
"name": "6629bd83a9b047d8add4a9e8f8e189a7.jpg",
"size": "195472",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/6f2352a8c85246238
ed542b6ac80787c.jpg",
"width": "800"
},
{
"id": 212229,
"color": "卡其",
"height": "800",
"name": "74066a49bc6a4d8faadcc576d44c760b.jpg",
"size": "187613",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/6a3a8c688bb34deb
b5d705c0b16140c8.jpg",
"width": "800"
},
{
"id": 212230,
"color": "卡其",
"height": "800",
"name": "d872444d8e3547079dbe4ab8ecf1f254.jpg",
"size": "198908",
"sortNum": 3,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/6ff3fe2fc08349188d
0b7117c55ede78.jpg",
"width": "800"
},
{
"id": 212231,
"color": "黑色",
"height": "800",
"name": "5cfd6bb2768144198c00db069276a475.JPG",
"size": "68226",
"sortNum": 4,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/7a0bd40da4264fda8
294a1b8068a7997.JPG",
"width": "800"
},
{
"id": 212232,
"color": "黑色",
"height": "800",
"name": "bb56f94e98fb44c69aeab32e0f101c6d.JPG",
"size": "280298",
"sortNum": 5,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/229325d7e2794b6f8
82aa5b3a0e91bf0.JPG",
"width": "800"
}
]
},
"place": "TAOBAO"
},
"TMALL": {
"pictures": {
"COLOR": [
{
"id": 212233,
"color": "黑色",
"height": "800",
"name": "Y513505Q10 (14).jpg",
"size": "187613",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/f94a8de1440749f5a
ea29ec59aa42dde.jpg",
"width": "800"
},
{
"id": 212234,
"color": "pink",
"height": "800",
"name": "90d307e9de2340e391eae5cfbd35ea6f.jpg",
"size": "161008",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/eeb952465dab4844
bfabfc2ba9ba0899.jpg",
"width": "800"
},
{
"id": 212235,
"color": "卡其",
"height": "800",
"name": "0cb7b5a90f6c4745b5f3817e385464a3.jpg",
"size": "183669",
"sortNum": 3,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/f6983375c2df4cb081
afebdcb4636ef6.jpg",
"width": "800"
}
],
"HOME": [
{
"id": 212236,
"color": "卡其",
"height": "800",
"name": "23b88e45186442398b61b29d75fdeffb.jpg",
"size": "195472",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/6629bd83a9b047d8
add4a9e8f8e189a7.jpg",
"width": "800"
},
{
"id": 212237,
"color": "卡其",
"height": "800",
"name": "dbe2b295954244cbb8c9d08400d61d08.jpg",
"size": "187613",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/74066a49bc6a4d8fa
adcc576d44c760b.jpg",
"width": "800"
},
{
"id": 212238,
"color": "卡其",
"height": "800",
"name": "42af976e41b842dfb3192b82babbfb4e.jpg",
"size": "198908",
"sortNum": 3,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/d872444d8e354707
9dbe4ab8ecf1f254.jpg",
"width": "800"
},
{
"id": 212239,
"color": "黑色",
"height": "800",
"name": "f69b8a2f5fa5442d8cb20b5a5ad9247e.JPG",
"size": "68226",
"sortNum": 4,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/5cfd6bb2768144198
c00db069276a475.JPG",
"width": "800"
},
{
"id": 212240,
"color": "黑色",
"height": "800",
"name": "aec4453a37174c9fb8d9bc863afccea7.JPG",
"size": "280298",
"sortNum": 5,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/bb56f94e98fb44c69
aeab32e0f101c6d.JPG",
"width": "800"
}
],
"QUALIFICATION": [
{
"id": 212241,
"color": "黑色",
"height": "800",
"md5": "",
"name": "wahaxi(9).jpg",
"size": "466912",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/184863f967e04571b
d05833fa7a540aa.adjustment.20190408105402.jpg",
"width": "800"
},
{
"id": 212242,
"color": "黑色",
"height": "800",
"md5": "",
"name": "wahaxi(10).jpg",
"size": "535189",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/2c7e6d291fe545d99
d3cfff5bc02847e.adjustment.20190408105406.jpg",
"width": "800"
}
],
"VIDEO_HOME": [
{
"id": 212243,
"color": "卡其",
"height": "1000",
"name": "23b88e45186442398b61b29d75fdeffb.9b88a37f-d9fc-4016-a19f-221b886731ba.adjustment.2019040814
3550.jpg",
"size": "244249",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/3807b4f75434406ab
043c5f25a3ebbdc.jpg",
"width": "750"
},
{
"id": 212244,
"color": "卡其",
"height": "1000",
"name": "dbe2b295954244cbb8c9d08400d61d08.e1441154-93a5-4afc-bfb6-56f0981aaa4f.adjustment.2019040814
3553.jpg",
"size": "231512",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/52e77b52be8f4242b
108c628c946a8f4.jpg",
"width": "750"
},
{
"id": 212245,
"color": "卡其",
"height": "1000",
"name": "42af976e41b842dfb3192b82babbfb4e.c310212d-7b8a-41ce-bbf7-0e85ec00f1c0.adjustment.2019040814
3555.jpg",
"size": "237992",
"sortNum": 3,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/471bf9ee41bb45b0a
d7fc8696a389789.jpg",
"width": "750"
},
{
"id": 212246,
"color": "黑色",
"height": "1000",
"name": "f69b8a2f5fa5442d8cb20b5a5ad9247e.82f97870-33da-40fc-a8f0-340e2f81837e.adjustment.20190408143
557.JPG",
"size": "119206",
"sortNum": 4,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/33885c424b8b4d67
a8f77786d6eac51b.JPG",
"width": "750"
},
{
"id": 212247,
"color": "黑色",
"height": "1000",
"name": "aec4453a37174c9fb8d9bc863afccea7.15f93954-5699-40e5-863c-0e3d853c3496.adjustment.201904081
43559.JPG",
"size": "415495",
"sortNum": 5,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/3dc421d5cb964a25a
5863c424e60a51d.JPG",
"width": "750"
}
],
"WIRELESS_HOME": [
{
"id": 212248,
"color": "卡其",
"height": "800",
"name": "23b88e45186442398b61b29d75fdeffb.9b88a37f-d9fc-4016-a19f-221b886731ba.adjustment.2019040814
3550.jpg",
"size": "195472",
"sortNum": 1,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/08000f375a3a4fea8
4f93e9e1cf0c00a.jpg",
"width": "800"
},
{
"id": 212249,
"color": "卡其",
"height": "800",
"name": "dbe2b295954244cbb8c9d08400d61d08.e1441154-93a5-4afc-bfb6-56f0981aaa4f.adjustment.2019040814
3553.jpg",
"size": "187613",
"sortNum": 2,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/3f2a138b62dc4bad9
69149453abab8f5.jpg",
"width": "800"
},
{
"id": 212250,
"color": "卡其",
"height": "800",
"name": "42af976e41b842dfb3192b82babbfb4e.c310212d-7b8a-41ce-bbf7-0e85ec00f1c0.adjustment.2019040814
3555.jpg",
"size": "198908",
"sortNum": 3,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/fc8f4788839e4c689a
94372fdd1fbebd.jpg",
"width": "800"
},
{
"id": 212251,
"color": "黑色",
"height": "800",
"name": "f69b8a2f5fa5442d8cb20b5a5ad9247e.82f97870-33da-40fc-a8f0-340e2f81837e.adjustment.20190408143
557.JPG",
"size": "68226",
"sortNum": 4,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/e792f835579a49f2b
cf025abba389ba9.JPG",
"width": "800"
},
{
"id": 212252,
"color": "黑色",
"height": "800",
"name": "aec4453a37174c9fb8d9bc863afccea7.15f93954-5699-40e5-863c-0e3d853c3496.adjustment.201904081
43559.JPG",
"size": "280298",
"sortNum": 5,
"url": "//product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/original/8262a71a5204466b
98d2cc7fd4e8b5e9.JPG",
"width": "800"
}
]
},
"place": "TMALL"
}
}
}
```


## 附录三 DpDetalPage：

DpDetalPage
字段说明

| 字段 | 说明 |
| --- | --- |
| htmlPageUrl | html版本地址（原始版本） |
| mixedPageUrl | 代码版地址（代码+部分截图） |
| imagePageUrl | 图片版地址（纯图版，modules和screenShotSectionUrls通过这个版本解<br>析处理） |
| modules | 按一级模块分的图片集合 |
| screenShotSectionUrls | 所有详情页截图集合 |
| templateName | 详情页模板名称（同一个货号，可以存在多个详情页模版，用户可按需取图<br>，最新修改详情页排序在前） |
| templateWidth | 详情页模板宽度（如750px，790px，1200px宽） |
| templateSites | 详情页支持的上货平台集合 |
| time | 修改时间 |
| active | 详情页启用状态（`true` 启用，`false` 禁用） |

```json
{
"htmlPageUrl": "http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/html.201904081
126419307.html",
"imagePageUrl": "http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/image.201904
081126419307.html",
"mixedPageUrl": "http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/mixed.201904
081126419307.html",
"modules": {
"产品图": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
193071.jpg"
],
"尺寸及试穿": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
193072.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
193073.png",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
193074.png",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
193075.jpg"
],
"模特效果图": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
193076.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
193077.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
193078.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
193079.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
1930710.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
1930711.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
1930712.jpg"
],
"细节图": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
1930713.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
1930714.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
1930715.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
1930716.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.2019040811264
1930717.jpg"
]
},
"screenShotSectionUrls": [
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
93071.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
93072.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
93073.png",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
93074.png",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
93075.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
93076.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
93077.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
93078.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
93079.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
930710.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
930711.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
930712.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
930713.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
930714.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
930715.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
930716.jpg",
"http://product.resources.soomey.net/zj/demo/1c150d3ed75a49d1aa3a8f3439db3ecf/template/screenshot.20190408112641
930717.jpg"
],
"templateName": "_t 颜色循环",
"templateWidth": 790,
"templateSites": ["TAOBAO","JD","VIP"],
"time": 1554694045000,
"active": true
}
```


## 附录四 DpProductVideos：

DpProductVideos
字段说明

| 字段 | 说明 |
| --- | --- |
| videos | 视频集合 |
| place/平台类型 | 参考枚举：cn.deepdraw.api.model.dp.basic.DpPlace<br>TAOBAO(淘宝),<br>PAIPAI(拍拍),<br>ALIBABA(1688),<br>TMALL(天猫),<br>JD(京东),<br>YHD(一号店),<br>GOME(国美),<br>JUMEI(聚美优品),<br>SUNING(苏宁),<br>VIP(唯品会),<br>YIXUN(易迅),<br>STANDALONE(自营站点),<br>OTHER(其他),<br>XIUPIN(网易秀品),<br>YISHANG(伊尚时尚),<br>XIKE(细刻),<br>ALIEXPRESS(速卖通),<br>SANFU(三福),<br>KAOLA(考拉),<br>GUXING(古星),<br>YOUZAN(有赞),<br>PDD(拼多多),<br>WEIMOB(微盟),<br>CLOUDSHOP(云店),<br>KBOXINGIES(劲霸商城),<br>KBOXINGCS(劲霸圆周率),<br>DANGDANG(当当),<br>BEIBEI(贝贝),<br>YUNJI(云集),<br>XIAOHONGSHU(小红书),<br>MOGUJIE(蘑菇街),<br>RUISHA(锐鲨),<br>CONNECT(数致),<br>SEMAGENTO(SE麦进斗),<br>SHOPEESG(Shopee新加坡),<br>SHOPEEID(Shopee印尼),<br>SHOPEEVN(Shopee越南), |

| 字段 | 说明 |
| --- | --- |
|  | SHOPEETW(Shopee台湾),<br>SHOPEEMY(Shopee马来),<br>SHOPEETH(Shopee泰国),<br>SHOPEEPH(Shopee菲律宾),<br>SSG(SSG),<br>LAZADASG(Lazada新加坡),<br>LAZADAID(Lazada印尼),<br>LAZADAVN(Lazada越南),<br>LAZADAMY(Lazada马来),<br>LAZADATH(Lazada泰国),<br>LAZADAPH(Lazada菲律宾),<br>DOUYIN(抖音),<br>KUAISHOU(快手),<br>YIKE(驿氪),<br>AIKUCUN(爱库存),<br>YOUPIN(小米优品),<br>YANXUAN(网易严选),<br>DEWU(得物),<br>HUIJU(惠聚),<br>ZALORATW(Zalora台湾),<br>ZALORAHK(Zalora香港),<br>ZALORAMY(Zalora马来西亚),<br>ZALORASG(Zalora新加坡),<br>LAZADACB(Lazada全球),<br>WEIDIAN(微店),<br>DIANJIA(店加),<br>MIAOJIE(喵街),<br>MOMO(MOMO),<br>SHANGOU(美团闪购),<br>AIMER(爱慕),<br>KUKAMALL(顾家商城),<br>ELEME(饿了么),<br>SHANSHAN(杉杉奥莱),<br>HAOYK(好衣库),<br>JDDAOJIA(京东到家),<br>WEIXINXIAODIAN(微信视频小店),<br>XIAOYOU(晓柚),<br>DOUYINXSG(抖音小时达),<br>BBC(澜海企业购),<br>ALL(通用素材图); |
| 视频类型 | VIDEO(短视频); |
| id | 视频id |
| address | 视频地址 |
| coverAddress | 视频封面 |

| 字段 | 说明 |
| --- | --- |
| feature | 视频特征<br>(主要天猫、淘宝平台使用<br>detail-详情；<br>miniDetail-微详情；<br>videoDisplayType-视频展示类型code；<br>videoDisplayTypeName-视频展示类型中文) |
| width | 宽 |
| height | 高 |
| size | 大小 |
| sortNum | 视频排序（主要用于天猫、淘宝这种存在多个视频的平台） |
| proportion | 比例（主要天猫、淘宝平台使用，1:1、3:4、9:16） |
| template | 视频模版来源<br>NEW_PATH-深绘NEW_PATH模版生成<br>FLOWING-深绘FLOWING模版生成<br>POSTER-深绘海报模版生成<br>UPLOAD-用户上传<br>THIRD_PARTY-用户录入第三方id<br>COPY-深绘产品视频复制 |
| thirdPartyAddress | 第三方视频地址（主要天猫、淘宝平台使用，录入平台视频id） |

```json
{
"videos": {
"videos": {
"TMALL": {
"place": "TMALL",
"videos": {
"VIDEO": [
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/1.mp
4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/CXxaGZD6aP.jpg",
"feature": "{\"detail\":true,\"miniDetail\":true,\"videoDisplayType\":\"chuandazhanshi\"}",
"height": 800,
"id": 155114,
"proportion": "3:4",
"size": 1401352,
"sortNum": 1,
"template": "UPLOAD",
"thirdPartyAddress": "",
"width": 800
},
{
"feature": "{\"detail\":false,\"miniDetail\":true,\"videoDisplayType\":\"other_minidetail\"}",
"id": -1,
"proportion": "3:4",
"sortNum": 2,
"template": "THIRD_PARTY",
"thirdPartyAddress": "222"
},
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/1.mp
4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/CXxaGZD6aP.jpg",
"feature": "{\"detail\":true,\"miniDetail\":true,\"videoDisplayType\":\"baobeizhanshi\"}",
"height": 800,
"id": 155114,
"proportion": "3:4",
"size": 1401352,
"sortNum": 3,
"template": "THIRD_PARTY",
"thirdPartyAddress": "3333",
"width": 800
},
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/2.mp
4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/KtwsOvwJWd.jpg",
"feature": "{\"detail\":true,\"miniDetail\":true,\"videoDisplayType\":\"chuandazhanshi\"}",
"height": 1000,
"id": 155111,
"proportion": "9:16",
"size": 2292491,
"sortNum": 1,
"template": "THIRD_PARTY",
"thirdPartyAddress": "444",
"width": 750
},
{
"feature": "{\"detail\":true,\"miniDetail\":true,\"videoDisplayType\":\"default_baobei\"}",
"id": -1,
"proportion": "9:16",
"sortNum": 2,
"template": "THIRD_PARTY",
"thirdPartyAddress": "555"
},
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/tm91
6e(2).mp4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/1gWEe81IBM.jpg",
"feature": "{\"detail\":false,\"miniDetail\":true,\"videoDisplayType\":\"baobeizhanshi\"}",
"height": 1280,
"id": 157659,
"proportion": "9:16",
"size": 3522054,
"sortNum": 3,
"template": "THIRD_PARTY",
"thirdPartyAddress": "6666",
"width": 720
}
]
}
},
"TAOBAO": {
"place": "TAOBAO",
"videos": {
"VIDEO": [
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/2.mp
4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/KtwsOvwJWd.jpg",
"feature": "{}",
"height": 1000,
"id": 155111,
"size": 2292491,
"sortNum": 1,
"template": "UPLOAD",
"width": 750
}
]
}
},
"JDDAOJIA": {
"place": "JDDAOJIA",
"videos": {
"VIDEO": [
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/1.mp
4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/CXxaGZD6aP.jpg",
"feature": "{}",
"height": 800,
"id": 155114,
"size": 1401352,
"sortNum": 1,
"template": "UPLOAD",
"width": 800
}
]
}
},
"HAOYK": {
"place": "HAOYK",
"videos": {
"VIDEO": [
{
"address": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template/2.mp
4",
"coverAddress": "http://product.resources.deepdraw.biz/BJ/molly/8d047bcf7492492ea98580e77e0953ef/template
/KtwsOvwJWd.jpg",
"feature": "{}",
"height": 1000,
"id": 155111,
"size": 2292491,
"sortNum": 1,
"template": "UPLOAD",
"width": 750
}
]
}
}
}
}
}
```

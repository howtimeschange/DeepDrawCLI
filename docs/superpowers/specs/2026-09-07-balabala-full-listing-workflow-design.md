# 巴拉上新流程：完整 Listingify 规则迁移设计

## 决策与目标

本设计把深绘 CLI 现有的巴拉 payload 审查器升级为可恢复、可审计的本地上新工作流。业务资料始终从用户提供的本地文件导入，不连接 MDM、PLM 或 Listingify 数据库；深绘类目树、当前类目模板和既有商品资料则在需要时通过已注册的 DeepDraw API 读取。

目标是迁移 Listingify 当前巴拉商品档案的行为规则，而非复制其 PostgreSQL 表、Web UI、队列或凭据配置。每次运行必须根据当前 trade 的 dp.trade.fields 模板决定可填字段、枚举、销售属性、子字段和必填状态，避免维护过期的 fieldId 静态清单。

正式款号 204426140121 只允许本地导入和只读验证。任何 DeepDraw 写入联调只能针对 204426140121-test，并继续遵循 CLI 的 execute + plan + yes 授权顺序。

## 当前证据基线

迁移以 Listingify main 的 d016a90 为代码基线，主要对照：

- web/server/services/product-archive-drafts.ts
- web/server/services/shoe-size-chart-matching.ts
- scripts/lib/product_archive_size_chart.mjs
- scripts/lib/deepdraw_sdk_adapter.mjs
- product archive、shoe size chart 与 SDK adapter 的回归测试

本地资料输入适配以下业务交付方式：

- MDM 商品 SKU 表：按 款号 + SKC 编码 + SKU 编码 识别唯一 SKU。
- 上市计划表：同一款可能只有部分颜色行；款级类目、发布日期、价格和平台类目可继承到该款全部 MDM 颜色，但颜色与 SKU 只能取 MDM。
- 标准文案表：支持 期货、O2O 等 sheet；解析器不得信任 XLSX worksheet dimension，必须扫描真实工作表行。
- 鞋品尺码表：按产品线、品类和鞋型选择尺码组。
- PLM 服饰尺码表：支持长表、宽表及量点别名。
- 图片包：平铺、主图、吊牌、洗唛按角色入审计；图片只能成为 OCR/视觉证据，不能替代 MDM、SKU 或尺码事实。

## 方案选择

选择“通用本地工作流引擎 + 巴拉品牌插件”：

~~~text
workflow core
  ├─ 本地状态、哈希快照、计划、执行日志、回读与比较
  ├─ 当前 DeepDraw 模板/资源读写适配
  └─ BrandPlugin
      └─ balabala
          ├─ 导入列别名与来源优先级
          ├─ 类目候选与选择规则
          ├─ 字段构造、枚举归一、条件字段
          ├─ 鞋品/服饰尺码表
          ├─ AI/OCR 审计和候选校验
          └─ 分阶段 payload 与回读比较
~~~

不采用单一巴拉大模块：它会再次把通用状态和品牌规则耦合。也不导入 Listingify 数据库或 SQLite：这会违背已确认的本地文件输入和无数据库依赖边界。

## 本地状态与资料快照

每个款号都在工作目录保存可追溯、可原子更新的状态：

~~~text
.deepdraw-workflows/
  balabala/
    <spu-code>/
      state.json
      sources.json
      normalized.json
      template.json
      draft.json
      audit.json
      plans/
      executions/
      readbacks/
~~~

原始 Excel 与图片不复制进工作目录，也不提交。sources.json 只记录绝对路径、SHA-256、导入时间、sheet、行号、筛选键和最小必要的标准化快照。状态目录加入 .gitignore；不得写入 appSecret、dopKey、签名或请求授权令牌。

状态中的每个字段都记录 fieldId、fieldName、fieldType、template hash、valueText/valueJson、sourceType、sourceRef、证据、置信度、manualOverride、激活状态、校验结果和失效原因。人工覆盖在重建时保留，除非模板已删除该字段、父字段不再激活、值不再合法，或该值属于已过期的 AI/结构化尺码派生值。

状态机为：

~~~text
imported -> assembled -> template_ready -> review_required | ready
ready -> planned -> publishing -> post_create_update -> readback_verified
                                  \-> failed | readback_mismatch | transport_unknown
~~~

已有商品全量更新从 readback_verified 或 ready 开始，先生成远端资料保护与 SKU 交集判断，再进入 planned。

## 品牌插件边界

核心层只处理文件状态、模板获取、DeepDraw API 调用、批准计划、原子写入和通用执行日志。品牌插件提供以下能力：

~~~ts
interface BrandPlugin {
  id: string
  importSources(input): ImportedSources
  selectTrade(context, trades): TradeDecision
  buildFields(context, template): FieldDecision[]
  buildSizeTables(context, template): FieldDecision[]
  buildAiPlan(context, fields): AiPlan
  buildPayload(context, stage): ProductPayload
  prepareExistingUpdate(context, resource): ProtectedPayload
  compareReadback(context, resource, expected): ReadbackComparison
}
~~~

插件不得直接调用网络、读取凭据或绕过 api-registry。未来品牌可替换来源别名、类目策略、字段规则、尺码算法和平台策略，而不改动核心层。

## 巴拉资料优先级与字段判定

字段按以下优先级确定：

1. 有效人工覆盖。
2. 已审核的 PLM 尺码映射、OCR 事实和结构化尺码结果。
3. MDM SPU/SKC/SKU：款号、全量颜色、SKU、销售尺码、条码、商家编码、吊牌价。
4. 最新上市计划、标准文案和其同款来源行。
5. 巴拉固定业务规则。
6. 合格 AI 候选。

字段重建遍历“当前模板字段 ∪ 巴拉规则目标字段”。每个字段只能得到以下结果之一：

- direct：从来源列别名直接读取。
- derived：由巴拉规则、SKU、价格、类目或尺码表构造。
- structured：主尺码表、平台尺码表或商家 SKU。
- evidence_candidate：可交给 OCR/AI 的枚举候选。
- manual_required：证据或映射不足，阻断或要求人工确认。
- skipped：类目不适用、子字段未激活或明确业务留空。

模板 required、销售属性和业务 blocking 必须分开记录。attributes.isChildAttr 的子字段只有在 parentAttr 和 parentAttrValue 被当前父字段命中后才激活；未激活字段不发送且不计缺失。

不能自动填写的特殊字段包括淘宝 SKU 参数、天猫 SKU 参数、天猫导购标题、京东规格子属性、京东自营子属性、淘宝导购标题和颜色备注。遇到它们必须留为人工确认，而不是生成看似可用的值。

## 类目选择

类目输入按以下顺序取证：官方发布类目、唯品发布类目、唯品四级主款式、抖音发布类目、上市计划品类/小类，必要时以文案品类和 MDM 产品线、品类、小类、性别、年龄段、尺码段补证。

候选 DeepDraw trade 的选择规则：

1. 巴拉优先级根：童装婴幼儿服装、童鞋/亲子鞋、寝具服饰；其次母婴/寝具/玩具根；blbl&mini 只作最终兜底。
2. 官方末级类目精确匹配优先；随后比较路径、上下文、品类别名和路径层级。
3. 候选必须覆盖上市计划所需平台：官方类目要求 Alibaba、PDD、Taobao、Kuaishou；唯品要求 VIP；抖音要求 Douyin 或 DouyinXsg。
4. 候选销售尺码模板必须覆盖 MDM 的实际 SKU 尺码。
5. 鞋品优先直接童鞋叶子；仅在没有直接叶子时才结合性别走男/女童鞋分支。
6. 运动、户外、板鞋、雪地靴、靴子、学步鞋及服饰的 T 恤、卫衣、衬衫、羽绒服、裤装、裙装、套装等使用当前 Listingify 的上下文加权决胜规则。
7. 来源冲突、同分并列、平台不全或尺码不兼容必须生成 manual_selection_required，不可暗自挑选 trade。

每次决策保存命中来源列、评分、必需/已覆盖平台、尺码兼容性、置信度和人工确认信息。

## 通用字段、颜色与商家 SKU

通用字段覆盖款号、型号、品牌、价格/吊牌价、价格区间、上市时间、产品季、产地、所在地、销售渠道、是否商场同款、标题、卖点、材质、洗护、库存、物流、限购、包装与平台经营字段。

标题和内容规则包括搜索/展示标题、唯品标题、天猫推荐理由、天猫导购标题、抖音/小红书/视频号标题、快手标题、短导购标题、商品详情、主图 4 文案和细节文案。拼多多标题类、平台模板元数据字段和无可信实测的重量/包装字段按当前业务规则保留为空。

价格规则包括：

- 吊牌价、市场价、京东价等来自 MDM 吊牌价。
- 拼多多单买价为吊牌价减 1，团购价为吊牌价减 2。
- 商家 SKU 的交易价使用 SKU 价或吊牌价；非交易平台价使用吊牌价。
- 1688 价格区间使用 1:价格 的文本格式。

颜色必须按完整 MDM SKU 去重，构造成“深绘标准色,原始颜色名”。标准色按颜色族和当前模板 options 匹配；无法合法匹配不由 AI 默认选择。卡其、浅灰、中灰、深灰和粉色使用现有巴拉归一规则。羽绒服仅在结构化颜色字段中按洗唛/文案可信证据追加填充物颜色；文本颜色字段保持原色。

商家 SKU 的行键始终是最终销售颜色与最终销售尺码。字段列取当前模板 options 与巴拉允许列的交集，覆盖价格、货号、上市月、数量、商家编码、条码、唯品货号、平台价、拼多多价、小红书商家编码和天猫 SKU 搜索标题。SKU 键与颜色别名、尺码别名必须在 payload 前统一；羽绒颜色装饰不得破坏商家 SKU 颜色键匹配。

## 鞋品规则

支持运动鞋、休闲鞋、板鞋、雪地靴、学步鞋、凉鞋、靴子和户外鞋。固定 trade 映射仍以当前模板为准：16608/546 为运动-轻跑，533 为休闲，534 为雪地靴，538 为婴童；其他类目由路径与品类判断。

凉鞋必须先根据图像证据分类：

- 前后空凉鞋：open_sandal，25 鞋子尺码表为凉鞋。
- 中空/前后包鞋面：closed_sandal，25 鞋子尺码表为镂空或包头凉鞋。
- 运动公主鞋：sport_leisure，对应运动公主鞋。
- 图片不充分：needs_visual_classification，阻止自动使用鞋码表。

鞋品销售尺码仅使用真实整数鞋码，展示别名为 N码。半码、图片推测尺码和非 SKU 尺码一律阻断。鞋品尺码表只保留 MDM SKU 实际尺码行：

| 字段 | 表头与值 |
|---|---|
| 尺码表 | 脚长、鞋内长；行键 N码；脚长以 cm，鞋内长以 cm。 |
| 唯品会尺码表 | 欧洲码为裸数字；脚长、鞋内长来自鞋码标准表。 |
| 天猫尺码表 | 脚长、鞋内长，单位 cm。 |
| 抖音尺码表 | 脚长(cm)、备注；备注优先标准映射文本，否则为脚长范围/内长。 |
| 淘宝尺码表 | 脚长范围；适用时构造，但 SDK 发布策略明确控制。 |
| 多平台尺码 | 仅取当前模板允许的天猫、京东、拼多多、微信视频小店、小红书、快手列；京东裸数字，拼多多/视频号/小红书为 N码加脚长/内长备注，天猫和快手为空。 |

鞋品还要构造适用年龄、尺码段、尺码类型、25 鞋子模板类型、25 鞋子尺码表、22Q4 童鞋尺码表，以及帮面、里料、鞋底、鞋垫、闭合方式、鞋帮/靴筒高度、流行元素、风格、功能和执行标准。材料需分部位取证，不得由图片猜成分。

## 服饰规则

支持 T 恤、卫衣、衬衫、针织衫、外套、夹克、呢大衣、棉服、羽绒服、长裤、休闲裤、牛仔裤、连衣裙、半身裙、套装，以及当前模板可识别的内衣、家居服、连体衣和配饰分支。

服饰销售尺码由 MDM SKU 规范为 Ncm。PLM 量点必须先规范化为 款号、款色、尺码、量点、数值，并只保留当前 SKU 与上市计划交集中的尺码。高置信映射覆盖领口、衣长、裙长、肩宽、胸围、裤长、腰围、臀围、脚口、下摆围和体重；中置信映射覆盖袖长、前后浪、大腿围和袖笼围。人工审核后的量点映射优先于内置规则。

主尺码表使用以下固定列：

- 上装：尺码、衣长、肩宽、胸围、袖长、身高、体重。
- 牛仔裤：尺码、裤长、腰围、臀围、脚口、身高、体重。
- 其他下装：尺码加当前模板中非重复尺码列。

表内尺码列为裸数字；行键保持 Ncm。缺失量点留空，不能写 0、不能以旧远端值或 AI 补齐、不能生成第三个尺码列。

内置巴拉服饰参考表覆盖 52 至 180：年龄、kg、抖音斤、男/女/中性上装号型和下装号型。该表仅补年龄、体重和唯品会号型，不能替代 PLM 实测量点。唯品会按上/下装选择号型并排除下装前后浪/大腿围等不适用列；抖音体重必须是斤；天猫、淘宝、好衣库按各自模板单位生成。

普通服饰的 25 服装尺码推荐为婴童，文胸为文胸；鞋品相关尺码字段在服饰中跳过。羽绒服额外处理填充物、含绒量、充绒量和尺码备注：成分分段读取吊牌/洗唛/文案，充绒量按每尺码可追溯事实构造，不能由视觉模型推断。

## 平台尺码表与阶段发送

每张尺码表先与当前模板 options 取交集。多平台尺码的默认列仅是无模板时的回退，不能作为任意 trade 的字段定义。

创建阶段发送主尺码表及经策略允许的多平台尺码。创建后进行自动全量更新，以防覆盖式 API 漏掉稳定平台表；全量更新携带完整颜色、销售尺码、商家 SKU、主表、唯品会、天猫、抖音和受控多平台表。鞋品淘宝尺码表保持已知 SDK 风险边界，不作为自动全量更新字段。

多平台尺码更新必须显式纳入计划。回读 API 有时缺失多平台行，比较结果应标记 needs_ui_verification，不能把该情况误报为已验证或直接当作成功。

## AI、OCR 与人工覆盖

OCR provider 接口输出吊牌/洗唛原文、文件哈希、图片角色、提取字段、置信度和定位信息。OCR 只能补充执行标准、成分、填充物、生产/洗护等有可追溯文本的事实。

AI provider 只接收当前模板中待补的单选/多选候选字段。候选输出必须包含字段 ID、模板原枚举值、置信度、简短理由和证据引用；低于 0.7、值不在枚举中、字段不再激活或无证据的候选一律丢弃。

AI 分为三档：

- P0：款式结构、图案、领型、门襟、帽子、腰带、套件、闭合方式、鞋型和凉鞋结构。
- P1：年龄/人群/性别/季节/风格、材质观感、厚薄、弹力、柔软度、功能、鞋垫材质。
- P2：详情页 AI 标注和图像运营标记。

执行标准、安全等级、生产/溯源、日期、编码、条码、价格、重量、包装尺寸、销售尺码、主尺码量点和充绒量属于事实字段，禁止通用 AI 填写。AI 不得覆盖人工覆盖、可信 OCR、PLM 或 MDM 值。

## 发布、全量更新、增量更新与回读

创建前先运行本地审查、类目模板同步、查重和执行计划。创建成功后自动抽取数值 productId 并执行必要的 post-create full update，不再要求用户手写回输入文件。

已有商品的全量更新先读取 resource=form，保留可信且本地没有新值的远端标量字段；再确认远端 SKU 与本地 SKU 至少有一个规范化颜色/尺码交集。没有交集时停止覆盖。全量更新始终是覆盖语义，绝不以小 patch 代替。

普通字段增量更新仅允许当前模板中的标量字段，自动随 patch 带完整颜色和销售尺码。尺码表、商家 SKU、颜色或 SKU 增删改不使用普通增量；颜色/SKU 专用接口必须带完整颜色、尺码和商家 SKU；尺码表变化走全量更新。所有写入仍需要 execute + plan，且只有用户明确 yes 后执行。

每次创建、全量更新或增量更新后读取 resource=form，比对：

- 标题和标量字段。
- 标准颜色、销售尺码及颜色-尺码 SKU 集合。
- 实际发送的主尺码表和平台尺码表行、列和值。
- 尺码别名、欧洲码、京东裸数字、多平台文本和尺码备注。

状态只在严格比较成功后改为 readback_verified；资源读回不完整时写明 UI 复核项；网络异常为 transport_unknown；业务成功码或 HTTP 200 本身不代表持久化成功。

## CLI 命令与用户体验

保留 deepdraw balabala 作为入口，并补足本地驱动阶段：

~~~text
deepdraw balabala import --spu 204426140121 --mdm ... --launch-plan ... --copywriting ... --shoe-size-chart ... --images ...
deepdraw balabala assemble --spu 204426140121
deepdraw balabala template --spu 204426140121 --execute
deepdraw balabala review --spu 204426140121
deepdraw balabala plan create --spu 204426140121 --execute --plan
deepdraw balabala publish create --spu 204426140121 --execute --yes
deepdraw balabala plan full-update --spu 204426140121 --execute --plan
deepdraw balabala publish full-update --spu 204426140121 --execute --yes
deepdraw balabala readback --spu 204426140121 --execute
~~~

兼容现有 --input draft.json 命令，但它会被转换为同一状态模型。每条输出都包含 workflow、action、spu、state、template hash、来源摘要、阻断项、待人工项和下一个安全动作。

## 验收与测试

实现必须覆盖：

1. 四类本地资料导入、异常 XLSX dimension、同款多色、缺少某色文案与完整 MDM SKU 的合并。
2. 类目评分、平台覆盖、尺码模板兼容、冲突和并列人工确认。
3. 上述全部鞋品分支，特别是凉鞋图像证据不足时的阻断。
4. 上述全部服饰细类、上装/下装/牛仔裤主表、PLM 量点别名、半围转换和单位换算。
5. 颜色别名、羽绒颜色装饰与商家 SKU 键一致性。
6. 当前模板字段、子字段激活、非法枚举剔除、业务 skip、人工覆盖及过期派生值重建。
7. 创建、post-create full update、已有商品保护、普通增量限制、SKU 无交集阻止及 readback 比较。
8. 正式款 204426140121 的纯本地导入/组装/只读资料验证；真实写入只使用 204426140121-test，并保留原有增量恢复边界。

每个规则组均用本地 fixture 和 mock DeepDraw/AI/OCR provider 做单元及流程测试。代码修改后运行 npm test、npm run lint、npm run build；真实写入仅在单独计划和用户确认后进行。

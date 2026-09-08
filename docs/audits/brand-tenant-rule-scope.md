# 品牌与租户规则快照隔离

规则快照显式声明三个独立维度：品牌 `brandId`、租户 `tenantName`、商家 `merchantId`。品牌不是租户名的别名；同一品牌可配置多个租户，同一租户下不同品牌也不能共享规则，除非显式提供对应快照。

当前快照：

```json
{
  "schemaVersion": 1,
  "id": "balabala/ecommerce-balabala/1162",
  "scope": {
    "brandId": "balabala",
    "tenantName": "电商巴拉巴拉",
    "merchantId": "1162"
  },
  "version": "2026-09-08T08:59:45.522Z",
  "source": "listingify.deepdraw_field_mapping_rule"
}
```

- `src/brands/rule-snapshot.ts`：共享元数据及三维精确匹配。没有默认品牌、通配符或跨租户回退。
- `src/brands/balabala/database-rules.ts`：巴拉专属快照和209条规则。兼容历史巴拉入口缺省上下文的默认值只保留在此专属模块；显式其他品牌、其他租户、其他商家或空字符串均不匹配。
- `BrandPlugin.ruleSnapshot`：插件可选的快照元数据接口。未来品牌提供自己的快照及构建实现，无需把租户信息硬编码进工作流引擎。
- 工作流校验存储品牌、快照品牌、输入品牌与插件ID一致，再将品牌传给构建器。审计只记录插件实际选中的快照；未命中为null，不冒称应用了巴拉规则。
- CLI导入持久化非敏感品牌/租户/商家上下文，不保存密钥。

本次是规则快照的隔离与扩展接口，不代表已实现其他品牌的字段构建，也不是动态下载的DLC。209条规则值未改变。后续增加品牌/租户需要独立快照、对应插件和回归验证；当前既有巴拉业务派生规则仍位于巴拉插件。

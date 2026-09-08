/** A brand can have multiple tenants; a tenant can contain multiple brands. */
export interface RuleScope {
  brandId: string;
  tenantName: string;
  merchantId: string;
}

export interface RuleSnapshotMetadata {
  schemaVersion: 1;
  id: string;
  scope: RuleScope;
  version: string;
  source: string;
}

/** Shared matching has no default brand, tenant, wildcard or cross-tenant fallback. */
export function matchesRuleScope(metadata: RuleSnapshotMetadata, scope: RuleScope): boolean {
  return metadata.scope.brandId === scope.brandId
    && metadata.scope.tenantName === scope.tenantName
    && metadata.scope.merchantId === scope.merchantId;
}

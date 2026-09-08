import {test} from 'node:test';
import assert from 'node:assert/strict';
import { matchesRuleScope, type RuleSnapshotMetadata } from '../src/brands/rule-snapshot.js';
import { databaseRuleSnapshot } from '../src/brands/balabala/database-rules.js';
const metadata:RuleSnapshotMetadata={schemaVersion:1,id:'example',version:'1',source:'test',scope:{brandId:'b',tenantName:'tenant',merchantId:'1'}};
test('brand, tenant and merchant are independent exact-match dimensions',()=>{
 assert.equal(matchesRuleScope(metadata,{...metadata.scope}),true);
 for(const field of ['brandId','tenantName','merchantId']) assert.equal(matchesRuleScope(metadata,{...metadata.scope,[field]:'other'}),false);
});
test('audit metadata exists only for the selected snapshot',()=>{
 assert.equal(databaseRuleSnapshot({brandId:'semir',tenantName:'电商巴拉巴拉',merchantId:'1162'}),undefined);
 assert.equal(databaseRuleSnapshot({brandId:'balabala',tenantName:'another',merchantId:'1162'}),undefined);
 assert.deepEqual(databaseRuleSnapshot({})?.scope,{brandId:'balabala',tenantName:'电商巴拉巴拉',merchantId:'1162'});
});

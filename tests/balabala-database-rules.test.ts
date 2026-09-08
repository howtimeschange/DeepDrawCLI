import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBalabalaFields } from '../src/brands/balabala/fields.js';
import { DATABASE_RULES, databaseRule } from '../src/brands/balabala/database-rules.js';
const context = { launchPlan: { productLine: '中童', category: '卫衣' }, skus: [] };
const definitions = [
  ['发货方式','快递发货',['无需快递','快递发货']], ['是否新品','是',['否','是']],
  ['尺寸推荐表','禁用',[]], ['试穿报告表','禁用',[]], ['平车针距12~14针/3cm','否',['是','否']],
  ['AQL抽检标准','无',['2.5','无']], ['货源类别','现货',['订货','现货']],
] as const;
const template = { fields: definitions.map(([fieldName,,options])=>({fieldName,fieldType:'TEXT',required:true,options:[...options]})) };
test('online tenant fixed rules resolve all seven previously missing fields against current enums',()=>{
 const fields=buildBalabalaFields(context,template);
 definitions.forEach(([,expected],index)=>{assert.equal(fields[index]?.valueText,expected);assert.equal(fields[index]?.validationStatus,'valid');});
});
test('snapshot contains 209 enabled rules and selects later applicable domain rule',()=>{
 assert.equal(DATABASE_RULES.length,209);
 assert.equal(databaseRule('里料材质(多选)',context,'apparel')?.id,'175');
 assert.equal(databaseRule('25产品名称',{launchPlan:{productLine:'幼童'}},'apparel'),undefined);
 assert.equal(databaseRule('25产品名称',context,'apparel')?.id,'200');
 assert.equal(databaseRule('25产品名称',context,'shoe')?.id,'200'); // Listingify filters product domains independently.
});
test('tenant and merchant isolation keep Balabala defaults out of other contexts',()=>{
 for(const other of [{tenantName:'其他租户'},{merchantId:'999'}]){
  const fields=buildBalabalaFields({...context,...other},{fields:[{fieldName:'AQL抽检标准',required:true}]});
  assert.equal(fields[0]?.valueText,'');assert.equal(fields[0]?.validationStatus,'missing');
 }
});
test('manual preservation and template requirements remain authoritative',()=>{
 const manual=buildBalabalaFields({...context,manualOverrides:{是否新品:{valueText:'否'}}},template);
 assert.equal(manual.find(f=>f.fieldName==='是否新品')?.valueText,'否');
 const invalid=buildBalabalaFields(context,{fields:[{fieldName:'AQL抽检标准',required:true,options:['2.5']}]});
 assert.equal(invalid[0]?.validationStatus,'invalid');
 const safety=buildBalabalaFields(context,{fields:[{fieldName:'安全等级',required:true,options:['A类','B类']}]});
 assert.equal(safety[0]?.validationStatus,'missing');
});
test('business blank and source-derived exceptions precede database skip and instruction defaults',()=>{
 const fields=buildBalabalaFields({launchPlan:{productLine:'鞋品',category:'运动鞋'}},{fields:[{fieldName:'试穿报告表',required:true},{fieldName:'尺码类型',options:['欧码（童鞋）']},{fieldName:'包装种类'}]});
 assert.equal(fields[0]?.active,false);assert.equal(fields[1]?.valueText,'欧码（童鞋）');assert.equal(fields[2]?.valueText,'');
 const lining=buildBalabalaFields({...context,copywriting:{rows:[{raw:{面料成分:'面料:100%棉\n里料:100%聚酯纤维'}}]}},{fields:[{fieldName:'里料'}]});
 assert.equal(lining[0]?.valueText,'100%聚酯纤维');
});

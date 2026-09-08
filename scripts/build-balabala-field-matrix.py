"""Build a historical inventory, not an executable DeepDraw template, from Listingify's whitepaper."""
import argparse,csv,re,hashlib
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('whitepaper');p.add_argument('--output',default='docs/audits/balabala-field-matrix.csv');a=p.parse_args()
s=Path(a.whitepaper).read_text();category='';trade='';rows=[]
for number,line in enumerate(s.splitlines(),1):
 if line.startswith('### '):category=line[4:];trade=''
 m=re.search(r'trade_id(?:[:：]\s*|\s+`)(\d+)' ,line)
 if m:trade=m[1]
 if not trade or not line.startswith('| ') or 'field_id=' not in line:continue
 c=[x.strip() for x in line.strip('| ').split('|')]
 if len(c)==13:
  _,name,typ,req,sale,opts,source,example,headers,rule,missing,forbid,notes=c
 elif len(c)==12:
  name,typ,req,sale,opts,headers,source,example,rule,missing,forbid,notes=c
 else:raise ValueError((number,len(c)))
 fid=re.search(r'field_id=(\d+)',notes)
 if not fid:continue
 adapted=source.replace('MDM_SPU','本地 MDM 导出 SPU 信息').replace('MDM_SKU','本地 SKU Excel').replace('LAUNCH_PLAN','本地上市计划 Excel').replace('COPYWRITING','本地文案 Excel').replace('OCR_HANGTAG/OCR_WASHLABEL','本地图包/PDF 的可追溯 OCR').replace('REFERENCE_IMAGE','本地参考图')
 status='待逐字段确认';evidence='src/brands/balabala/fields.ts';create='当前模板激活且合法时写入';full='完整字段集覆盖；先合并远端快照';inc='仅普通标量，显式 --fields；携带颜色/尺码'
 if re.search(r'吊牌价|专柜价|零售价|市场价|京东价|划线价|拼多多.*(?:单买|团购)价|1688.*价格区间|^价格$',name):
  adapted='本地 SKU Excel 挂牌单价；全部 SKU 有效且同款一致';missing='缺失、非正数或同款冲突阻断；不回退上市计划价';status='本次修复公共价格规则；逐模板待验';evidence='src/brands/balabala/prices.ts; tests/balabala-publish-safety.test.ts'
 structured_table = ('尺码表' in name and typ in ['MULTI_TEXT','多行/结构文本']) or name=='多平台尺码'
 if structured_table or name in ['多平台尺码','商家SKU','商家 SKU','颜色','尺码']:
  inc='禁止普通增量；颜色/尺码仅作完整伴随字段'
  if structured_table:
   adapted='鞋：内置鞋表或显式本地鞋表；服饰：本地 PLM 量点 + 内置 balabala 参考表';status='公共尺码规则有回归；逐模板待验';evidence='src/brands/balabala/size-charts.ts; src/brands/balabala/size-reference-data.ts'
   create='主表/多平台在 create；其他支持平台表在建档回读后的 full-update';missing='鞋半码/缺行/凉鞋结构不明阻断；服饰 PLM 缺量点留空并阻断'
 if name in ['充绒量','充绒量文本']:
  adapted='本地逐尺码克重事实：文案/MDM/OCR；OCR 需原文与图片 SHA256';missing='已给克重但缺码、冲突、百分比或范围无法分配时阻断';inc='禁止普通增量；经 review 联动后 full-update';status='本次修复联动；逐模板待验';evidence='src/brands/balabala/down-fill.ts; tests/balabala-publish-safety.test.ts'
 rows.append([category,trade,fid[1],name,typ,req,sale,source,adapted,rule,missing,create,full,inc,status,evidence,f'{Path(a.whitepaper).name}:{number}'])
with open(a.output,'w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f,lineterminator="\n");w.writerow(['品类','历史tradeId','历史fieldId','字段','类型','历史必填','历史saleProp','Listingify基线来源','CLI本地来源','Listingify基线判断逻辑','CLI缺失处理','create阶段','full-update阶段','incremental阶段','确认状态','CLI代码/验证入口','基线证据']);w.writerows(rows)
print({'rows':len(rows),'categories':len(set(r[0] for r in rows)),'baselineSha256':hashlib.sha256(s.encode()).hexdigest()})

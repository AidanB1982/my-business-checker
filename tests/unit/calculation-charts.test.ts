import { describe,it,expect } from 'vitest';
import { barDomain,barGeometry,chartGroups,comparisonGroups } from '../../src/lib/reports/charts';
import { buildSnapshot,moneyMetric,type CalculationSnapshot } from '../../src/lib/reports/calculations';
const snapshot=(toolSlug:CalculationSnapshot['toolSlug'],metrics:CalculationSnapshot['metrics']):CalculationSnapshot=>({toolSlug,metrics,taxYear:'2026/27',ruleSetVersion:'test',title:'Test',review:'Test',assumptions:[],sources:[]});
describe('honest chart scales and preserved result figures',()=>{
 it('puts losses left of one shared zero baseline without absolute-value labels',()=>{
  const domain=barDomain([{label:'Shortfall',value:-200,unit:'money'},{label:'Available',value:600,unit:'money'}]);
  expect(domain).toMatchObject({min:-200,max:600,zero:25,span:800});
  expect(barGeometry(-200,domain)).toEqual({left:0,width:25});
  expect(barGeometry(600,domain)).toEqual({left:25,width:75});
 });
 it('keeps zero-only and wholly negative results finite',()=>{
  const zero=barDomain([{label:'Zero',value:0,unit:'money'}]);expect(barGeometry(0,zero)).toEqual({left:0,width:0});
  const negative=barDomain([{label:'Loss',value:-500,unit:'money'}]);expect(negative.zero).toBe(100);expect(barGeometry(-500,negative)).toEqual({left:0,width:100});
 });
 it('uses annual salary amounts once without adding employer pension or monthly figures',()=>{
  const result=buildSnapshot({toolSlug:'salary-take-home-calculator',taxYear:'2026/27',inputs:{salary:44160,region:'scotland',employeePercent:5,employerPercent:10,pensionMethod:'salary-sacrifice',pensionBasis:'full-salary',studentPlan:'plan4'}});
  const group=chartGroups(result)[0];expect(group.rows.map(row=>row.value)).toEqual([3290893,596099,235008,220800,0,73200,0]);
  expect(group.rows.reduce((total,row)=>total+row.value,0)).toBe(4416000);
  expect(result.metrics.find(metric=>metric.key==='monthlyTakeHome')?.value).toBe(274241);
 });
 it('separates percentage yields from money and mortgage scenarios',()=>{
  const groups=chartGroups(snapshot('rental-yield-mortgage-planner',[moneyMetric('annualCash','Cash',-20000),{key:'grossYield',label:'Gross yield',value:6,unit:'percentage'},{key:'netYield',label:'Net yield',value:4,unit:'percentage'},moneyMetric('stressCash','Stressed cash',-80000)]));
  expect(groups).toHaveLength(3);for(const group of groups)expect(new Set(group.rows.map(row=>row.unit)).size).toBe(1);
  expect(groups[2].rows.map(row=>row.value)).toEqual([-20000,-80000]);
 });
 it('keeps the two VAT tests separate and does not chart headroom as extra turnover',()=>{
  const groups=chartGroups(snapshot('vat-threshold-checker',[moneyMetric('turnover','Turnover',8000000),moneyMetric('threshold','Threshold',9000000),moneyMetric('forecast','Forecast',2000000),moneyMetric('headroom','Headroom',1000000)]));
  expect(groups.map(group=>group.rows.map(row=>row.value))).toEqual([[8000000,9000000],[2000000,9000000]]);
 });
 it('supports older saved results without fabricating missing metrics',()=>{
  expect(chartGroups(snapshot('business-mileage-calculator',[moneyMetric('allowance','Expense',550000)]))).toEqual([]);
  expect(chartGroups(snapshot('salary-take-home-calculator',[moneyMetric('annualTakeHome','Take-home',123)]))[0].rows).toHaveLength(1);
 });
 it('compares matching measures in the same unit and leaves source snapshots untouched',()=>{
  const left=snapshot('sole-trader-working-sheet',[moneyMetric('receipts','Receipts',10000),moneyMetric('surplus','Surplus',-2000)]);
  const right={...left,taxYear:'2025/26',metrics:[moneyMetric('receipts','Receipts',20000),{key:'surplus',label:'Surplus unavailable',unit:'text' as const,value:'Unknown'}]};
  const before=JSON.stringify([left,right]);const groups=comparisonGroups(left,right,'First','Second');expect(groups).toHaveLength(1);expect(groups[0].rows.map(row=>row.value)).toEqual([10000,20000]);expect(groups[0].rows[1].label).toContain('2025/26');expect(JSON.stringify([left,right])).toBe(before);
  expect(comparisonGroups(left,{...right,toolSlug:'mtd-checker'},'First','Second')).toEqual([]);
 });
});

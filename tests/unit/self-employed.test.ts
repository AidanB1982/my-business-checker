import { describe, expect, it } from 'vitest';
import { calculateSelfEmployed, calculateIncomeTax } from '../../src/lib/calculators/self-employed';
import { selfEmployedRules } from '../../src/rules/self-employed';
const input={income:72000,expenses:14000,otherIncome:0,region:'england' as const};
for(const year of ['2025/26','2026/27'] as const) {
 const rules=selfEmployedRules[year];
 describe(`self-employed ${year} — draft rules`,()=>{
  it('matches the £72,000 income and £14,000 expense fixture',()=>{
   expect(calculateSelfEmployed(input,rules)).toMatchObject({profitPence:5800000,businessIncomeTaxPence:1063200,class4Pence:241660,businessTaxPence:1304860,takeHomePence:4495140,monthlyTakeHomePence:374595,monthlySetAsidePence:108739,taxYear:year,ruleSetVersion:'draft-1',sourceReview:'pending'});
  });
  it.each([[0,0,0],[12570,0,0],[50270,754000,226200],[100000,2743200,325660],[125140,4251600,375940],[150000,5370300,425660]])('checks profit £%s at band boundaries',(income,taxPence,niPence)=>{
   const result=calculateSelfEmployed({...input,income,expenses:0},rules);
   expect(result.businessIncomeTaxPence).toBe(taxPence);expect(result.class4Pence).toBe(niPence);
  });
  it('applies the allowance taper, including the 60% marginal band',()=>{
   expect(calculateIncomeTax(10000100,rules).allowancePence).toBe(1256950);
   expect(calculateIncomeTax(10000100,rules).totalPence).toBe(2743260);
   expect(calculateIncomeTax(12514000,rules).allowancePence).toBe(0);
  });
  it('calculates only incremental income tax for the business',()=>{
   const result=calculateSelfEmployed({...input,income:28000,expenses:0,otherIncome:30000},rules);
   expect(result.incomeTax.totalPence).toBe(1063200);
   expect(result.otherIncomeTaxPence).toBe(348600);
   expect(result.businessIncomeTaxPence).toBe(714600);
   expect(result.class4Pence).toBe(92580);
   expect(result.takeHomePence).toBe(1992820);
  });
  it('does not charge Class 4 on other income or tax it twice',()=>{
   const result=calculateSelfEmployed({...input,income:10000,expenses:0,otherIncome:125140},rules);
   expect(result.businessIncomeTaxPence).toBe(450000);
   expect(result.class4Pence).toBe(0);expect(result.takeHomePence).toBe(550000);
  });
  it('does not invent loss relief and preserves negative business cash flow',()=>{
   const result=calculateSelfEmployed({...input,income:1000,expenses:2500},rules);
   expect(result.profitPence).toBe(0);expect(result.lossPence).toBe(150000);
   expect(result.businessTaxPence).toBe(0);expect(result.takeHomePence).toBe(-150000);
  });
  it('keeps penny inputs and total/result reconciliation',()=>{
   const result=calculateSelfEmployed({...input,income:58000.31,expenses:0},rules);
   expect(result.incomePence).toBe(5800031);
   expect(result.businessTaxPence+result.takeHomePence).toBe(result.profitPence);
   expect(result.monthlySetAsidePence*12).toBeGreaterThanOrEqual(result.businessTaxPence);
  });
 });
}
describe('input limits and rule isolation',()=>{
 it.each([-1,NaN,Infinity,10000001,100.001])('rejects invalid amount %s',income=>{
  expect(()=>calculateSelfEmployed({...input,income},selfEmployedRules['2026/27'])).toThrow();
 });
 it('rejects an unsupported Scottish calculation',()=>{
  expect(()=>calculateSelfEmployed({...input,region:'scotland' as 'england'},selfEmployedRules['2026/27'])).toThrow();
 });
 it.each(['wales','northern-ireland'] as const)('supports %s',region=>{
  expect(calculateSelfEmployed({...input,region},selfEmployedRules['2026/27']).businessIncomeTaxPence).toBe(1063200);
 });
 it('uses supplied rates and keeps snapshots separate',()=>{
  expect(selfEmployedRules['2025/26']).not.toBe(selfEmployedRules['2026/27']);
  const result=calculateSelfEmployed({...input,income:30000,expenses:0},{...selfEmployedRules['2026/27'],basicRate:0.1});
  expect(result.businessIncomeTaxPence).toBe(174300);
 });
 it('does not mutate inputs or rules',()=>{
  const frozen=Object.freeze({...input});
  expect(()=>calculateSelfEmployed(frozen,selfEmployedRules['2026/27'])).not.toThrow();
 });
});

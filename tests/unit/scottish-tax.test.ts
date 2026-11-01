import { describe, expect, it } from 'vitest';
import { calculateIncomeTax, calculateSelfEmployed } from '../../src/lib/calculators/self-employed';
import { selfEmployedRules, type TaxYear } from '../../src/rules/self-employed';
const input={income:72000,expenses:14000,otherIncome:0,region:'scotland' as const};
const fixtures:Record<TaxYear,{boundaries:number[][];tax:number;net:number;baseline:number;nextPound:number[][]}>={
 '2025/26':{boundaries:[[0,0],[12570,0],[15397,53713],[27491,295593],[43662,635184],[75000,1951380],[100000,3076380],[125140,4773330],[150000,5966610]],tax:1237380,net:4320960,baseline:348282,nextPound:[[12570,19],[15397,20],[27491,21],[43662,42],[75000,45],[125140,48]]},
 '2026/27':{boundaries:[[0,0],[12570,0],[16537,75373],[29526,335153],[43662,632009],[75000,1948205],[100000,3073205],[125140,4770155],[150000,5963435]],tax:1234205,net:4324135,baseline:345107,nextPound:[[12570,19],[16537,20],[29526,21],[43662,42],[75000,45],[125140,48]]},
};
for(const year of ['2025/26','2026/27'] as const){
 const rules=selfEmployedRules[year];const fixture=fixtures[year];
 describe(`Scottish non-savings Income Tax — ${year}`,()=>{
  it.each(fixture.boundaries)('checks income £%s at Scottish boundaries',(income,tax)=>{
   expect(calculateIncomeTax(income*100,rules,'scotland').totalPence).toBe(tax);
  });
  it('taxes the next pound at each following rate',()=>{
   for(const [income,rate] of fixture.nextPound){
    expect(calculateIncomeTax((income+1)*100,rules,'scotland').totalPence-calculateIncomeTax(income*100,rules,'scotland').totalPence).toBe(rate);
   }
  });
  it('shows six Scottish bands and the regional example result',()=>{
   const result=calculateSelfEmployed(input,rules);
   expect(result.incomeTax.bands.map(band=>band.label)).toEqual(['Starter rate','Basic rate','Intermediate rate','Higher rate','Advanced rate','Top rate']);
   expect(result).toMatchObject({businessIncomeTaxPence:fixture.tax,class4Pence:241660,businessTaxPence:fixture.tax+241660,takeHomePence:fixture.net,region:'scotland',taxYear:year,ruleSetVersion:'draft-2'});
   expect(rules.scottishSourceReview).toBe('provided-hmrc-extract');
  });
  it('uses the UK-wide NI rates for Scotland',()=>{
   for(const income of [12570,43662,50270,58000,75000,100000,150000]){
    const scottish=calculateSelfEmployed({...input,income,expenses:0},rules);
    const english=calculateSelfEmployed({...input,income,expenses:0,region:'england'},rules);
    expect(scottish.class4Pence).toBe(english.class4Pence);
   }
  });
  it('uses the 67.5% Scottish marginal tax in the allowance taper',()=>{
   // A £2 increase removes £1 of allowance; the extra £3 is taxed at 45%.
   expect(calculateIncomeTax(10000200,rules,'scotland').totalPence-calculateIncomeTax(10000000,rules,'scotland').totalPence).toBe(135);
  });
  it('deducts Scottish baseline tax when attributing business liability',()=>{
   const result=calculateSelfEmployed({...input,income:28000,expenses:0,otherIncome:30000},rules);
   expect(result.otherIncomeTaxPence).toBe(fixture.baseline);
   expect(result.businessIncomeTaxPence).toBe(889098);
   expect(result.class4Pence).toBe(92580);
  });
  it('fails closed if a year has no Scottish rates',()=>{
   expect(()=>calculateSelfEmployed(input,{...rules,scottishBands:undefined})).toThrow(/awaiting verification/);
  });
  it('does not leak the Scottish region into later calculations',()=>{
   calculateSelfEmployed(input,rules);
   expect(calculateSelfEmployed({...input,region:'england'},rules).businessIncomeTaxPence).toBe(1063200);
  });
  it('honours the supplied Scottish band rates',()=>{
   const custom={...rules,scottishBands:rules.scottishBands?.map((band,index)=>index===0?{...band,rate:0.1}:band)};
   expect(calculateIncomeTax(1539700,custom,'scotland').totalPence).toBe(28270);
  });
 });
}

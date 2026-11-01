import { describe, expect, it } from 'vitest';
import { calculateMileage, mileageRuleSets } from '../../src/lib/calculators/mileage';
import { hasAdvanced } from '../../src/lib/entitlements';
const mileageRules=mileageRuleSets['2025/26'];
describe('mileage expense calculation — draft rules',()=>{
 it.each([[0,0],[100,4500],[10000,450000],[10001,450025],[12000,500000],[0.1,5]])('calculates %s miles as %s pence',(miles,pence)=>{expect(calculateMileage(miles,mileageRules).allowancePence).toBe(pence);});
 it.each([-1,NaN,Infinity,1000001])('rejects invalid miles %s',miles=>{expect(()=>calculateMileage(miles,mileageRules)).toThrow();});
 it('receives its rules rather than hardcoding rates',()=>{expect(calculateMileage(12000,{...mileageRules,firstBandPence:50,additionalPence:30}).allowancePence).toBe(560000);});
 it('retains the rule version and tax year',()=>{expect(calculateMileage(10,mileageRules)).toMatchObject({ruleSetVersion:'draft-1',taxYear:'2025/26'});});
});
describe('2026/27 mileage update from supplied HMRC guidance',()=>{
 const rules=mileageRuleSets['2026/27'];
 it.each([[0,0],[100,5500],[8000,440000],[10000,550000],[10001,550025],[12000,600000]])('calculates %s miles as %s pence',(miles,pence)=>{expect(calculateMileage(miles,rules).allowancePence).toBe(pence);});
 it('preserves the historical snapshot',()=>{expect(calculateMileage(12000,mileageRuleSets['2025/26']).allowancePence).toBe(500000);});
 it('records effective date and supplied HMRC provenance',()=>{expect(rules).toMatchObject({effectiveFrom:'2026-04-06',sourceReview:'provided-hmrc-extract',taxYear:'2026/27',sourceUrl:'https://www.gov.uk/government/publications/rates-and-allowances-travel-mileage-and-fuel-allowances/travel-mileage-and-fuel-rates-and-allowances'});});
});
describe('advanced access fails closed',()=>{
 const now=new Date('2026-11-01T12:00:00Z');
 it.each(['active','trialing'])('accepts a current %s subscription',status=>{expect(hasAdvanced({status,current_period_end:'2026-12-01T12:00:00Z'},now)).toBe(true);});
 it.each(['inactive','past_due','canceled','unpaid','unknown'])('rejects %s',status=>{expect(hasAdvanced({status,current_period_end:'2026-12-01T12:00:00Z'},now)).toBe(false);});
 it.each([null,'invalid','2026-10-31T12:00:00Z','2026-11-01T12:00:00Z'])('rejects missing, invalid or expired period %s',current_period_end=>{expect(hasAdvanced({status:'active',current_period_end},now)).toBe(false);});
 it('rejects missing subscription',()=>{expect(hasAdvanced(null,now)).toBe(false);});
});

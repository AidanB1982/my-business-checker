import { describe,it,expect } from 'vitest';
import { calculateSoleTraderWorking,calculateRentWorking,calculatePropertyReserve } from '../../src/lib/calculators/business-records';
import { buildSnapshot,snapshotSchema } from '../../src/lib/reports/calculations';
const sole={period:'2026-11',income:3100,refunds:100,unpaidInvoices:800,drawings:500,savingsPercent:25,expenses:[{description:'Materials',amount:300,businessPercent:100},{description:'Phone',amount:60,businessPercent:50}]};
const rent={period:'2026-11',openingArrears:200,rentDue:1000,rentReceived:900,advanceReceived:300,agentFees:120,agentCosts:80,openingAgentBalance:100,agentRemitted:1000,closingAgentBalance:100};
const reserve={asOfYear:2026,horizon:5 as const,reserve:1000,monthlyContribution:100,inflationPercent:0,contingencyPercent:0,components:[{name:'Roof',currentCost:4000,firstDueYear:2026,repeatYears:0}]};
describe('sole-trader monthly working',()=>{
 it('separates business/private costs, drawings, reserve and unpaid invoices',()=>{const r=calculateSoleTraderWorking(sole);expect(r).toMatchObject({receipts:300000,businessCosts:33000,totalCashCosts:36000,privateCosts:3000,operatingSurplus:267000,plannedReserve:66750,cashAfter:147250,unpaidInvoices:80000,drawings:50000});});
 it('does not count unpaid invoices or drawings as income/operating costs',()=>{const a=calculateSoleTraderWorking(sole),b=calculateSoleTraderWorking({...sole,drawings:900,unpaidInvoices:0});expect(b.operatingSurplus).toBe(a.operatingSurplus);expect(b.cashAfter).toBe(a.cashAfter-40000);});
 it('does not create a negative savings transfer from a loss',()=>{const r=calculateSoleTraderWorking({...sole,income:0});expect(r.operatingSurplus).toBeLessThan(0);expect(r.plannedReserve).toBe(0);});
 it.each([-1,101,NaN,Infinity])('rejects an invalid business percentage (%s)',businessPercent=>expect(()=>calculateSoleTraderWorking({...sole,expenses:[{description:'Phone',amount:60,businessPercent}]})).toThrow());
 it('accepts no expenses and handles refunds exceeding current receipts',()=>expect(calculateSoleTraderWorking({...sole,income:0,refunds:100,expenses:[]}).receipts).toBe(-10000));
});
describe('landlord rent and agent controls',()=>{
 it('separates arrears/advances and reconciles gross collections to net remittance',()=>{expect(calculateRentWorking(rent)).toMatchObject({totalDue:120000,closingArrears:30000,grossReceipts:120000,advanceReceived:30000,deductions:20000,expectedAgentBalance:10000,difference:0});});
 it('keeps unexplained differences visible',()=>expect(calculateRentWorking({...rent,closingAgentBalance:55}).difference).toBe(4500));
 it('rejects over-allocation of collections to existing rent obligations',()=>expect(()=>calculateRentWorking({...rent,rentReceived:1300})).toThrow(/future periods/));
 it('supports a debit agent balance without disguising it as an expense',()=>expect(calculateRentWorking({...rent,openingAgentBalance:0,rentReceived:0,advanceReceived:0,agentRemitted:0,closingAgentBalance:-200}).difference).toBe(0));
});
describe('property reserve timing',()=>{
 it('shows immediate funding need even if contributions eventually cover the work',()=>{const r=calculatePropertyReserve(reserve);expect(r).toMatchObject({totalSpend:400000,immediateNeed:300000,shortfall:300000,averageMonthly:5000,endingReserve:300000});expect(r.points[0].afterWorkPence).toBe(-300000);});
 it('does not count current-year contributions before a start-of-year bill',()=>{const r=calculatePropertyReserve({...reserve,components:[{...reserve.components[0],firstDueYear:2027}]});expect(r.requiredMonthly).toBe(25000);expect(r.shortfall).toBe(180000);expect(r.immediateNeed).toBe(0);});
 it('applies inflation and contingency once per event',()=>{const r=calculatePropertyReserve({...reserve,inflationPercent:10,contingencyPercent:20,components:[{name:'Boiler',currentCost:1000,firstDueYear:2027,repeatYears:0}]});expect(r.totalSpend).toBe(132000);});
 it('repeats within the inclusive horizon and excludes work beyond it',()=>{const r=calculatePropertyReserve({...reserve,components:[{name:'Service',currentCost:100,firstDueYear:2026,repeatYears:2},{name:'Later roof',currentCost:5000,firstDueYear:2031,repeatYears:0}]});expect(r.events.map(event=>event.year)).toEqual([2026,2028,2030]);expect(r.totalSpend).toBe(30000);});
 it('requires no new contribution where opening funds cover all work',()=>{const r=calculatePropertyReserve({...reserve,reserve:5000});expect(r.averageMonthly).toBe(0);expect(r.requiredMonthly).toBe(0);expect(r.shortfall).toBe(0);});
 it('tells the user to deal explicitly with overdue work',()=>expect(()=>calculatePropertyReserve({...reserve,components:[{...reserve.components[0],firstDueYear:2025}]})).toThrow(/overdue/));
 it('does not manufacture spending where no event falls in the horizon',()=>expect(calculatePropertyReserve({...reserve,components:[{...reserve.components[0],firstDueYear:2035}]}).totalSpend).toBe(0));
 it('rounds required monthly funding up to a penny',()=>{const r=calculatePropertyReserve({...reserve,reserve:0,components:[{name:'Check',currentCost:1,firstDueYear:2027,repeatYears:0}]});expect(r.requiredMonthly).toBe(9);});
});
describe('records snapshots and supported dates',()=>{
 it.each([['sole-trader-working-sheet',sole],['landlord-rent-reconciliation',rent],['property-maintenance-reserve',reserve]] as const)('builds a validated report snapshot for %s',(toolSlug,inputs)=>{const result=buildSnapshot({toolSlug,taxYear:'2026/27',inputs});expect(snapshotSchema.safeParse(result).success).toBe(true);expect(result.assumptions.length).toBeGreaterThan(2);});
 it('rejects a mismatched monthly reference year',()=>expect(()=>buildSnapshot({toolSlug:'sole-trader-working-sheet',taxYear:'2025/26',inputs:sole})).toThrow(/year/));
 it.each(['2026-00','2026-13','not-a-month'])('rejects invalid working months (%s)',period=>expect(()=>calculateSoleTraderWorking({...sole,period})).toThrow());
 it('rejects excessive precision and unsupported row counts',()=>{expect(()=>calculateSoleTraderWorking({...sole,income:1.001})).toThrow();expect(()=>calculatePropertyReserve({...reserve,components:Array(21).fill(reserve.components[0])})).toThrow();});
});

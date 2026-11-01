import { z } from 'zod';
import { pounds,pence } from './validation';
const signedMoney=z.number().finite().min(-10_000_000).max(10_000_000).refine(value=>Math.abs(value*100-Math.round(value*100))<0.00001,'Use no more than two decimal places.');
const line=z.object({description:z.string().trim().min(1).max(100),amount:pounds,businessPercent:z.number().finite().min(0).max(100)}).strict();
export const soleTraderWorkingInput=z.object({period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),income:pounds,refunds:pounds,unpaidInvoices:pounds,drawings:pounds,savingsPercent:z.number().finite().min(0).max(100),expenses:z.array(line).max(30)}).strict();
export function calculateSoleTraderWorking(raw:z.input<typeof soleTraderWorkingInput>){
 const input=soleTraderWorkingInput.parse(raw);
 const receipts=pence(input.income)-pence(input.refunds);
 const costs=input.expenses.map(item=>({description:item.description,cashPence:pence(item.amount),businessPence:Math.round(pence(item.amount)*item.businessPercent/100)}));
 const totalCashCosts=costs.reduce((sum,item)=>sum+item.cashPence,0),businessCosts=costs.reduce((sum,item)=>sum+item.businessPence,0);
 const operatingSurplus=receipts-businessCosts,plannedReserve=Math.round(Math.max(0,operatingSurplus)*input.savingsPercent/100);
 return {receipts,businessCosts,totalCashCosts,privateCosts:totalCashCosts-businessCosts,operatingSurplus,plannedReserve,cashAfter:receipts-totalCashCosts-pence(input.drawings)-plannedReserve,unpaidInvoices:pence(input.unpaidInvoices),drawings:pence(input.drawings),costs};
}
export const rentWorkingInput=z.object({period:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),rentDue:pounds,openingArrears:pounds,rentReceived:pounds,advanceReceived:pounds,agentFees:pounds,agentCosts:pounds,openingAgentBalance:signedMoney,agentRemitted:pounds,closingAgentBalance:signedMoney}).strict();
export function calculateRentWorking(raw:z.input<typeof rentWorkingInput>){
 const input=rentWorkingInput.parse(raw);const outstanding=pence(input.openingArrears)+pence(input.rentDue);
 if(pence(input.rentReceived)>outstanding)throw new Error('Rent applied to this period and earlier arrears cannot exceed the total due. Record rent for future periods separately as advance rent.');
 const grossReceipts=pence(input.rentReceived)+pence(input.advanceReceived);
 const expectedAgentBalance=pence(input.openingAgentBalance)+grossReceipts-pence(input.agentFees)-pence(input.agentCosts)-pence(input.agentRemitted);
 return {totalDue:outstanding,closingArrears:outstanding-pence(input.rentReceived),grossReceipts,advanceReceived:pence(input.advanceReceived),deductions:pence(input.agentFees)+pence(input.agentCosts),remitted:pence(input.agentRemitted),expectedAgentBalance,closingAgentBalance:pence(input.closingAgentBalance),difference:expectedAgentBalance-pence(input.closingAgentBalance)};
}
export const propertyReserveInput=z.object({asOfYear:z.number().int().min(2025).max(2100),horizon:z.union([z.literal(5),z.literal(15),z.literal(30)]),reserve:pounds,monthlyContribution:pounds,inflationPercent:z.number().finite().min(0).max(15),contingencyPercent:z.number().finite().min(0).max(100),components:z.array(z.object({name:z.string().trim().min(1).max(100),currentCost:pounds,firstDueYear:z.number().int().min(2025).max(2200),repeatYears:z.number().int().min(0).max(100)}).strict()).min(1).max(20)}).strict();
export function calculatePropertyReserve(raw:z.input<typeof propertyReserveInput>){
 const input=propertyReserveInput.parse(raw),end=input.asOfYear+input.horizon-1;
 if(input.components.some(item=>item.firstDueYear<input.asOfYear))throw new Error('A component is overdue. Move its first due year to the planning start year to budget for it now.');
 const spending=new Map<number,number>();const events:{name:string;year:number;costPence:number}[]=[];
 for(const component of input.components){
  for(let year=component.firstDueYear;year<=end;year+=component.repeatYears){
   const costPence=Math.round(pence(component.currentCost)*(1+input.inflationPercent/100)**(year-input.asOfYear)*(1+input.contingencyPercent/100));
   if(!Number.isSafeInteger(costPence))throw new Error('The projected costs are outside the supported range.');
   events.push({name:component.name,year,costPence});spending.set(year,(spending.get(year)??0)+costPence);
   if(component.repeatYears===0)break;
  }
 }
 const opening=pence(input.reserve),monthly=pence(input.monthlyContribution),months=input.horizon*12;
 const totalSpend=events.reduce((sum,event)=>sum+event.costPence,0);
 const averageMonthly=Math.max(0,Math.ceil((totalSpend-opening)/months));
 // Conservative timing: all work is paid at the start of its year, before that year's contributions.
 let balance=opening,cumulative=0,requiredMonthly=0,minimumBalance=opening,immediateNeed=0;
 const points=[];
 for(let offset=0;offset<input.horizon;offset++){
  const year=input.asOfYear+offset,cost=spending.get(year)??0;cumulative+=cost;
  const beforeWork=balance;balance-=cost;minimumBalance=Math.min(minimumBalance,balance);
  if(offset===0)immediateNeed=Math.max(0,cumulative-opening);
  else requiredMonthly=Math.max(requiredMonthly,Math.max(0,Math.ceil((cumulative-opening)/(offset*12))));
  const afterWork=balance;balance+=monthly*12;points.push({year,openingPence:beforeWork,spendPence:cost,afterWorkPence:afterWork,closingPence:balance});
 }
 return {events:events.sort((a,b)=>a.year-b.year||a.name.localeCompare(b.name)),points,totalSpend,averageMonthly,requiredMonthly,immediateNeed,endingReserve:balance,minimumBalance,shortfall:Math.max(0,-minimumBalance),contributions:monthly*months};
}

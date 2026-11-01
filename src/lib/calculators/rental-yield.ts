import { z } from 'zod';
import { pounds,pence } from './validation';
const twoDecimals=(maximum:number)=>z.number().finite().min(0).max(maximum).refine(value=>Math.abs(value*100-Math.round(value*100))<0.00001,'Use at most two decimal places.').transform(value=>Math.round(value*100)/100);
export const rentalYieldInput=z.object({
 valueBasis:z.enum(['purchase-price','current-value']),propertyValue:pounds.refine(value=>value>0,'Enter a property value greater than zero.'),rentFrequency:z.enum(['monthly','weekly']),rent:pounds,voidWeeks:z.number().finite().min(0).max(52).refine(value=>Math.abs(value*10-Math.round(value*10))<0.00001,'Use at most one decimal place for void weeks.').transform(value=>Math.round(value*10)/10),managementPercent:twoDecimals(100),maintenance:pounds,insurance:pounds,serviceCharges:pounds,otherCosts:pounds,
 purchaseCosts:pounds,cashFundedWorks:pounds,existingCashInvested:pounds,mortgageBalance:pounds,mortgageType:z.enum(['interest-only','repayment']),annualRate:twoDecimals(25),remainingYears:z.number().int().min(1).max(40),stressIncrease:twoDecimals(10),
}).strict();
export type RentalYieldInput=z.input<typeof rentalYieldInput>;
export function mortgageIllustration(balancePence:number,annualRate:number,years:number,type:'interest-only'|'repayment'){
 const months=years*12,rate=annualRate/1200;
 const monthlyPayment=balancePence===0?0:type==='interest-only'?Math.round(balancePence*rate):Math.max(1,Math.round(rate===0?balancePence/months:balancePence*rate/(-Math.expm1(-months*Math.log1p(rate)))));
 let balance=balancePence,totalInterest=0,totalPayments=0,firstYearPayments=0,firstYearInterest=0,firstYearPrincipal=0,balanceAfterYear=balance;
 const schedule:{year:number;payments:number;interest:number;principal:number;balance:number}[]=[];
 for(let year=1;year<=years;year++){
  let payments=0,interest=0,principal=0;
  for(let month=0;month<12;month++){
   if(balance===0)continue;
   const monthlyInterest=Math.round(balance*rate);
   const payment=type==='interest-only'?monthlyInterest:Math.min(balance+monthlyInterest,(year===years&&month===11)?balance+monthlyInterest:monthlyPayment);
   const repaid=type==='interest-only'?0:payment-monthlyInterest;
   balance-=repaid;payments+=payment;interest+=monthlyInterest;principal+=repaid;
  }
  totalInterest+=interest;totalPayments+=payments;
  if(year===1){firstYearPayments=payments;firstYearInterest=interest;firstYearPrincipal=principal;balanceAfterYear=balance;}
  schedule.push({year,payments,interest,principal,balance});
 }
 return {monthlyPayment,firstYearPayments,firstYearInterest,firstYearPrincipal,balanceAfterYear,totalInterest,totalPayments,termEndBalance:balance,schedule};
}
export function calculateRentalYield(raw:RentalYieldInput){
 const input=rentalYieldInput.parse(raw),propertyValue=pence(input.propertyValue),loan=pence(input.mortgageBalance);
 const scheduledRent=pence(input.rent)*(input.rentFrequency==='weekly'?52:12);
 const voidLoss=Math.round(scheduledRent*input.voidWeeks/52),collectedRent=scheduledRent-voidLoss;
 const management=Math.round(collectedRent*input.managementPercent/100);
 const fixedCosts=pence(input.maintenance)+pence(input.insurance)+pence(input.serviceCharges)+pence(input.otherCosts);
 const operatingCosts=management+fixedCosts,operatingIncome=collectedRent-operatingCosts;
 const cashInvested=input.valueBasis==='purchase-price'?(loan<=propertyValue?propertyValue-loan+pence(input.purchaseCosts)+pence(input.cashFundedWorks):null):pence(input.existingCashInvested);
 const mortgage=mortgageIllustration(loan,input.annualRate,input.remainingYears,input.mortgageType);
 const alternative=mortgageIllustration(loan,input.annualRate,input.remainingYears,input.mortgageType==='interest-only'?'repayment':'interest-only');
 const stressRate=input.annualRate+input.stressIncrease,stress=mortgageIllustration(loan,stressRate,input.remainingYears,input.mortgageType);
 const annualCashFlow=operatingIncome-mortgage.firstYearPayments,stressCashFlow=operatingIncome-stress.firstYearPayments;
 const occupancy=1-input.voidWeeks/52,retainedRent=1-input.managementPercent/100,requiredIncome=fixedCosts+mortgage.firstYearPayments;
 const breakEvenMonthly=occupancy*retainedRent>0?Math.ceil(requiredIncome/(occupancy*retainedRent)/12):requiredIncome===0?0:null;
 const breakEvenOccupancy=scheduledRent*retainedRent>0?requiredIncome/(scheduledRent*retainedRent)*100:requiredIncome===0?0:null;
 const cashReturn=cashInvested!==null&&cashInvested>0?annualCashFlow/cashInvested*100:null;
 const interestCover=mortgage.firstYearInterest>0?collectedRent/mortgage.firstYearInterest:null;
 return {cashInvested,cashReturn,breakEvenMonthly,breakEvenOccupancy,interestCover,alternative,alternativeCashFlow:operatingIncome-alternative.firstYearPayments,propertyValue,loan,scheduledRent,voidLoss,collectedRent,management,fixedCosts,operatingCosts,operatingIncome,grossYield:scheduledRent/propertyValue*100,effectiveGrossYield:collectedRent/propertyValue*100,netYield:operatingIncome/propertyValue*100,ltv:loan/propertyValue*100,equity:propertyValue-loan,mortgage,stress,stressRate,annualCashFlow,monthlyCashFlow:Math.round(annualCashFlow/12),stressCashFlow,stressMonthlyCashFlow:Math.round(stressCashFlow/12),rateCashFlowChange:stressCashFlow-annualCashFlow};
}

import { z } from 'zod';
import { businessRules } from '../../rules/business';
import { pounds,pence } from './validation';
export const vatInput=z.object({months:z.array(pounds).length(12),periodEnd:z.string().regex(/^20[0-9]{2}-(0[1-9]|1[0-2])$/).refine(value=>value>='2024-04'&&value<='2027-03','This preview supports periods ending April 2024 to March 2027.'),next30Days:pounds,alreadyRegistered:z.boolean().default(false)}).strict();
export type VatInput=z.input<typeof vatInput>;
export function calculateVAT(raw:VatInput){
 const input=vatInput.parse(raw);const turnoverPence=input.months.reduce((sum,value)=>sum+pence(value),0);
 const next30DaysPence=pence(input.next30Days);const historicTest=turnoverPence>businessRules.vatThresholdPence;
 const futureTest=next30DaysPence>businessRules.vatThresholdPence;
 return {turnoverPence,next30DaysPence,thresholdPence:businessRules.vatThresholdPence,headroomPence:businessRules.vatThresholdPence-turnoverPence,historicTest,futureTest,
 status:input.alreadyRegistered?'already-registered':historicTest||futureTest?'registration-check-required':'below-threshold',ruleSetVersion:businessRules.version};
}

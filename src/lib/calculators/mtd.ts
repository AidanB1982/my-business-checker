import { z } from 'zod';
import { mtdSchedule,businessRules } from '../../rules/business';
import { pounds,pence } from './validation';
export const mtdInput=z.object({referenceYear:z.enum(['2024/25','2025/26','2026/27']),businessIncome:pounds,propertyIncome:pounds,possibleExemption:z.boolean().default(false),alreadyInMtd:z.boolean().default(false)}).strict();
export type MtdInput=z.input<typeof mtdInput>;
export function calculateMTD(raw:MtdInput){
 const input=mtdInput.parse(raw);const schedule=mtdSchedule[input.referenceYear];
 const qualifyingIncomePence=pence(input.businessIncome)+pence(input.propertyIncome);const aboveThreshold=qualifyingIncomePence>schedule.thresholdPence;
 return {qualifyingIncomePence,thresholdPence:schedule.thresholdPence,aboveThreshold,startDate:aboveThreshold?schedule.startDate:null,
 status:input.alreadyInMtd?'already-in-mtd':input.possibleExemption?'check-exemption':aboveThreshold?'may-be-required':'below-this-test',referenceYear:input.referenceYear,ruleSetVersion:businessRules.version};
}

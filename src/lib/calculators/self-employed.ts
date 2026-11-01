import { z } from "zod";
import type { SelfEmployedRules } from "../../rules/self-employed";
const amount = z.number().finite().min(0).max(10_000_000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Use no more than two decimal places.");
export const selfEmployedInput = z.object({
  income: amount,
  expenses: amount,
  otherIncome: amount,
  region: z.enum(["england", "wales", "northern-ireland"]),
});
export type SelfEmployedInput = z.infer<typeof selfEmployedInput>;
export function calculateIncomeTax(incomePence: number, rules: SelfEmployedRules) {
  const allowancePence = Math.max(0, rules.personalAllowancePence - Math.floor(Math.max(0, incomePence - rules.allowanceTaperStartPence) / 2));
  const taxablePence = Math.max(0, incomePence - allowancePence);
  const basicPence = Math.min(taxablePence, rules.basicBandPence);
  const higherBandPence = Math.max(0, rules.additionalRateThresholdPence - allowancePence - rules.basicBandPence);
  const higherPence = Math.min(Math.max(0, taxablePence - basicPence), higherBandPence);
  const additionalPence = Math.max(0, taxablePence - basicPence - higherPence);
  const bands = [
    { label: "Basic rate", taxablePence: basicPence, rate: rules.basicRate, taxPence: Math.round(basicPence * rules.basicRate) },
    { label: "Higher rate", taxablePence: higherPence, rate: rules.higherRate, taxPence: Math.round(higherPence * rules.higherRate) },
    { label: "Additional rate", taxablePence: additionalPence, rate: rules.additionalRate, taxPence: Math.round(additionalPence * rules.additionalRate) },
  ];
  return { allowancePence, taxablePence, bands, totalPence: bands.reduce((sum, band) => sum + band.taxPence, 0) };
}
export function calculateSelfEmployed(raw: SelfEmployedInput, rules: SelfEmployedRules) {
  const input = selfEmployedInput.parse(raw);
  const incomePence = Math.round(input.income * 100);
  const expensesPence = Math.round(input.expenses * 100);
  const otherIncomePence = Math.round(input.otherIncome * 100);
  const profitPence = Math.max(0, incomePence - expensesPence);
  const incomeTax = calculateIncomeTax(profitPence + otherIncomePence, rules);
  const otherIncomeTax = calculateIncomeTax(otherIncomePence, rules);
  // Incremental liability: the difference between tax with and without business profit.
  const businessIncomeTaxPence = incomeTax.totalPence - otherIncomeTax.totalPence;
  const mainClass4Pence = Math.round(Math.max(0, Math.min(profitPence, rules.class4UpperPence) - rules.class4LowerPence) * rules.class4MainRate);
  const upperClass4Pence = Math.round(Math.max(0, profitPence - rules.class4UpperPence) * rules.class4UpperRate);
  const class4Pence = mainClass4Pence + upperClass4Pence;
  const businessTaxPence = businessIncomeTaxPence + class4Pence;
  return {
    incomePence, expensesPence, profitPence,
    lossPence: Math.max(0, expensesPence - incomePence),
    incomeTax, otherIncomeTaxPence: otherIncomeTax.totalPence,
    businessIncomeTaxPence, class4Pence, mainClass4Pence, upperClass4Pence,
    businessTaxPence, takeHomePence: incomePence - expensesPence - businessTaxPence,
    monthlyTakeHomePence: Math.round((incomePence - expensesPence - businessTaxPence) / 12),
    monthlySetAsidePence: Math.ceil(businessTaxPence / 12),
    taxYear: rules.taxYear, ruleSetVersion: rules.version, sourceReview: rules.sourceReview,
  };
}

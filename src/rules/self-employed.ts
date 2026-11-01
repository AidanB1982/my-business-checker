export type TaxYear = "2025/26" | "2026/27";
export type SelfEmployedRules = Readonly<{
  taxYear: TaxYear;
  version: string;
  personalAllowancePence: number;
  allowanceTaperStartPence: number;
  basicBandPence: number;
  additionalRateThresholdPence: number;
  basicRate: number;
  higherRate: number;
  additionalRate: number;
  class4LowerPence: number;
  class4UpperPence: number;
  class4MainRate: number;
  class4UpperRate: number;
  sourceReview: "pending";
}>;
// Do not overwrite published snapshots. New rules require a new version and fixtures.
const common = {
  version: "draft-1", personalAllowancePence: 1257000,
  allowanceTaperStartPence: 10000000, basicBandPence: 3770000,
  additionalRateThresholdPence: 12514000, basicRate: 0.2,
  higherRate: 0.4, additionalRate: 0.45,
  class4LowerPence: 1257000, class4UpperPence: 5027000,
  class4MainRate: 0.06, class4UpperRate: 0.02,
  sourceReview: "pending" as const,
};
export const selfEmployedRules: Readonly<Record<TaxYear, SelfEmployedRules>> = Object.freeze({
  "2025/26": Object.freeze({ ...common, taxYear: "2025/26" }),
  "2026/27": Object.freeze({ ...common, taxYear: "2026/27" }),
});
export const selfEmployedSources = [
  { label: "Income Tax rates and allowances", url: "https://www.gov.uk/income-tax-rates" },
  { label: "Personal Allowance over £100,000", url: "https://www.gov.uk/income-tax-rates/income-over-100000" },
  { label: "Self-employed National Insurance", url: "https://www.gov.uk/self-employed-national-insurance-rates" },
  { label: "National Insurance rates and thresholds", url: "https://www.gov.uk/government/publications/rates-and-allowances-national-insurance-contributions" },
  { label: "Self Assessment payments on account", url: "https://www.gov.uk/understand-self-assessment-bill/payments-on-account" },
] as const;

export type TaxYear = "2025/26" | "2026/27";
export type IncomeTaxBand = Readonly<{label: string; upperTaxablePence: number | null; rate: number}>;
export type TaxRegion = "england" | "wales" | "northern-ireland" | "scotland";
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
  scottishBands?: readonly IncomeTaxBand[];
  scottishSourceReview?: "provided-hmrc-extract";
}>;
// Draft-3 retains Scottish regional bands from the GOV.UK extract supplied on
// 1 November 2026. Upper bounds are taxable-income limits after the standard
// allowance, not gross-income labels. Class 4 NI is UK-wide. New published
// snapshots require a new version and fixtures; live source retrieval is not claimed.
const common = {
  version: "draft-3", personalAllowancePence: 1257000,
  allowanceTaperStartPence: 10000000, basicBandPence: 3770000,
  additionalRateThresholdPence: 12514000, basicRate: 0.2,
  higherRate: 0.4, additionalRate: 0.45,
  class4LowerPence: 1257000, class4UpperPence: 5027000,
  class4MainRate: 0.06, class4UpperRate: 0.02,
  sourceReview: "pending" as const,
};
export const selfEmployedRules: Readonly<Record<TaxYear, SelfEmployedRules>> = Object.freeze({
  "2025/26": Object.freeze({ ...common, taxYear: "2025/26", scottishSourceReview: "provided-hmrc-extract", scottishBands: Object.freeze([
    Object.freeze({label:"Starter rate",upperTaxablePence:282700,rate:0.19}),
    Object.freeze({label:"Basic rate",upperTaxablePence:1492100,rate:0.20}),
    Object.freeze({label:"Intermediate rate",upperTaxablePence:3109200,rate:0.21}),
    Object.freeze({label:"Higher rate",upperTaxablePence:6243000,rate:0.42}),
    Object.freeze({label:"Advanced rate",upperTaxablePence:12514000,rate:0.45}),
    Object.freeze({label:"Top rate",upperTaxablePence:null,rate:0.48}),
  ]) }),
  "2026/27": Object.freeze({ ...common, taxYear: "2026/27", scottishSourceReview: "provided-hmrc-extract", scottishBands: Object.freeze([
    Object.freeze({label:"Starter rate",upperTaxablePence:396700,rate:0.19}),
    Object.freeze({label:"Basic rate",upperTaxablePence:1695600,rate:0.20}),
    Object.freeze({label:"Intermediate rate",upperTaxablePence:3109200,rate:0.21}),
    Object.freeze({label:"Higher rate",upperTaxablePence:6243000,rate:0.42}),
    Object.freeze({label:"Advanced rate",upperTaxablePence:12514000,rate:0.45}),
    Object.freeze({label:"Top rate",upperTaxablePence:null,rate:0.48}),
  ]) }),
});
export const selfEmployedSources = [
  { label: "Scottish Income Tax rates and taxpayer status", url: "https://www.gov.uk/scottish-income-tax" },
  { label: "Scottish Income Tax 2025/26", url: "https://www.gov.scot/publications/scottish-income-tax-2025-2026/" },
  { label: "Income Tax rates and allowances", url: "https://www.gov.uk/income-tax-rates" },
  { label: "Personal Allowance over £100,000", url: "https://www.gov.uk/income-tax-rates/income-over-100000" },
  { label: "Self-employed National Insurance", url: "https://www.gov.uk/self-employed-national-insurance-rates" },
  { label: "National Insurance rates and thresholds", url: "https://www.gov.uk/government/publications/rates-and-allowances-national-insurance-contributions" },
  { label: "Self Assessment payments on account", url: "https://www.gov.uk/understand-self-assessment-bill/payments-on-account" },
] as const;

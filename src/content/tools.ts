export const tools = [
  { slug: "self-employed-tax-calculator", name: "Self-employed tax", category: "Tax", description: "Understand your profit, tax and take-home pay.", guide: "self-employed-tax", status: "Preview" },
  { slug: "vat-threshold-checker", name: "VAT threshold", category: "VAT", description: "Check your rolling turnover and registration position.", guide: "vat-registration", status: "Preview" },
  { slug: "mtd-checker", name: "Making Tax Digital", category: "Planning", description: "Understand which MTD requirements may apply to you.", guide: "making-tax-digital", status: "Preview" },
  { slug: "salary-dividend-calculator", name: "Salary vs dividends", category: "Tax", description: "Explore how you take money from your limited company.", guide: "salary-and-dividends", status: "Preview" },
  { slug: "business-mileage-calculator", name: "Business mileage", category: "Expenses", description: "Estimate an allowance for qualifying business journeys.", guide: "business-mileage", status: "Preview" },
  { slug: "salary-take-home-calculator", name: "Salary take-home", category: "Tax", description: "Check your salary after tax, student loans and pension deductions.", guide: "salary-take-home", status: "Preview" },
  { slug: "pension-pot-predictor", name: "Pension pot predictor", category: "Planning", description: "Project your pension from current salary and contribution percentages.", guide: "pension-planning", status: "Preview" },
  { slug: "sole-trader-working-sheet", name: "Sole trader monthly working", category: "Records", description: "Separate receipts, costs, drawings and your planned reserve.", guide: "sole-trader-working", status: "Preview" },
  { slug: "landlord-rent-reconciliation", name: "Landlord rent reconciliation", category: "Property", description: "Track arrears and advance rent, and reconcile your agent statement.", guide: "landlord-rent-records", status: "Preview" },
  { slug: "property-maintenance-reserve", name: "Property maintenance reserve", category: "Property", description: "Plan component replacements and see when your reserve needs funding.", guide: "property-maintenance-planning", status: "Preview" },
] as const;
export const categories = ["Tax", "VAT", "Expenses", "Planning", "Property", "Records"] as const;

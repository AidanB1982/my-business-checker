import Link from "next/link";
import { Icon,toolIcon } from "@/components/ui-icon";
import { notFound } from "next/navigation";
import { tools } from "@/content/tools";
import { RentalYieldPlanner } from "@/components/rental-yield-planner";
import { RecordsWorkbench } from "@/components/records-workbench";
import { EmploymentCalculator } from "@/components/employment-calculators";
import { SelfEmployedCalculator } from "@/components/self-employed-calculator";
import { PlanningCalculator } from "@/components/planning-calculators";
import { MileageCalculator } from "@/components/mileage-calculator";
export function generateStaticParams() { return tools.map(t=>({slug:t.slug})); }
export async function generateMetadata({params}:{params:Promise<{slug:string}>}) {const {slug}=await params;return {title:tools.find(t=>t.slug===slug)?.name||"Tool not found"};}
export default async function Tool({params}:{params:Promise<{slug:string}>}) {
 const {slug}=await params; const t=tools.find(t=>t.slug===slug);if(!t) notFound();
 return <div className="wrap section tool-page"><Link className="text-link" href="/tools">← All tools</Link><div className="calculator-heading"><span className={`tool-symbol category-${t.category.toLowerCase()}`}><Icon name={toolIcon(t.slug)} size={22}/></span><p className="eyebrow">{t.category} calculator</p><span className="tag">{t.status}</span></div><h1>{t.name}.</h1><p className="lead">{t.description}</p>{slug==="rental-yield-mortgage-planner"?<RentalYieldPlanner/>:slug==="sole-trader-working-sheet"||slug==="landlord-rent-reconciliation"||slug==="property-maintenance-reserve"?<RecordsWorkbench kind={slug}/>:slug==="salary-take-home-calculator"||slug==="pension-pot-predictor"?<EmploymentCalculator kind={slug}/>:slug==="self-employed-tax-calculator"?<SelfEmployedCalculator/>:slug==="business-mileage-calculator"?<><div className="notice">Development preview for 2025/26 and 2026/27. Choose the tax year for your journeys. The rates match the supplied HMRC guidance, updated 21 May 2026. Vehicle eligibility and the choice of expenses method affect whether you can use it.</div><MileageCalculator/></>:<PlanningCalculator kind={slug as "vat-threshold-checker"|"mtd-checker"|"salary-dividend-calculator"}/>}<div className="section-heading section"><Link className="text-link" href={`/guides/${t.guide}`}>Understand how this works →</Link><Link className="text-link" href="/methodology">Methodology and sources →</Link></div><h2>What should I check next?</h2><div className="guide-grid">{tools.filter(other=>other.slug!==slug).slice(0,2).map(other=><Link className="guide-card" key={other.slug} href={`/tools/${other.slug}`}><h3>{other.name} →</h3><p>{other.description}</p></Link>)}</div></div>;
}

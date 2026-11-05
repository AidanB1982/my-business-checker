import Link from 'next/link';
import { pageMetadata } from '@/lib/seo';
import { ToolFinder } from "@/components/tool-finder";
export const metadata=pageMetadata('Free UK business, tax, salary and property calculators','Explore free calculators for UK salary, pensions, self-employed tax, VAT and landlord planning, with workings and source guidance.','/tools');
export default function Tools() { return <div className="wrap section"><p className="eyebrow">Tax · VAT · Expenses · Planning</p><h1>Your business toolbox.</h1><p className="lead">Find a clearer answer to your next business question.</p><p><Link className="text-link" href="/learn">Not sure where to begin? Choose a short learning path →</Link></p><ToolFinder/></div>; }

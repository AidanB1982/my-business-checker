import { topics } from '@/content/topics';
import { pageMetadata } from '@/lib/seo';
import Link from "next/link";
import { guides } from "@/content/guides";
export const metadata=pageMetadata('UK business and personal finance guides','Plain English guides to sole-trader accounts, landlord records, salary deductions and pension planning, linked to free practical tools.','/guides');
export default function Guides() { return <div className="wrap section"><p className="eyebrow">Understand the numbers</p><h1>A little explanation<br/>goes a long way.</h1><p><Link className="button secondary" href="/learn">Follow a guided learning path →</Link></p><h2>Explore a topic</h2><div className="guide-grid">{topics.map(t=><Link className="guide-card" key={t.slug} href={`/topics/${t.slug}`}><h3>{t.title}</h3><p>{t.description}</p></Link>)}</div><h2>Answer a specific question</h2><div className="guide-grid">{guides.map(g => <Link className="guide-card" href={`/guides/${g.slug}`} key={g.slug}><h2>{g.title}</h2><p>{g.summary}</p><span className="text-link">Read the guide →</span></Link>)}</div></div>; }

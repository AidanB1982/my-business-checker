import Link from "next/link";
import { guides } from "@/content/guides";
export const metadata = { title: "Business guides" };
export default function Guides() { return <div className="wrap section"><p className="eyebrow">Understand the numbers</p><h1>A little explanation<br/>goes a long way.</h1><div className="guide-grid">{guides.map(g => <Link className="guide-card" href={`/guides/${g.slug}`} key={g.slug}><h2>{g.title}</h2><p>{g.summary}</p><span className="text-link">Read the guide →</span></Link>)}</div></div>; }

"use client";
import { useState } from "react";
import Link from "next/link";
import { tools } from "@/content/tools";
export function ToolFinder() {
  const [search, setSearch] = useState("");
  const filtered = tools.filter(tool => `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(search.toLowerCase()));
  return <><label className="search-label" htmlFor="tool-search">What would you like to check?</label><input id="tool-search" type="search" placeholder="Try tax, VAT or mileage…" value={search} onChange={e => setSearch(e.target.value)} /><p className="muted" role="status">{filtered.length} tools</p><div className="tool-grid">{filtered.map((tool, i) => <Link className="tool-card" key={tool.slug} href={`/tools/${tool.slug}`}><div className="card-top"><span className="number">0{i + 1}</span><span className="tag">{tool.category}</span></div><h3>{tool.name} <span aria-hidden="true">→</span></h3><p>{tool.description}</p><span className="status">{tool.status}</span></Link>)}</div>{filtered.length === 0 && <p>No matching tools. Try another search.</p>}</>;
}

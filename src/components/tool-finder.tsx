"use client";
import { useState } from "react";
import Link from "next/link";
import { tools } from "@/content/tools";
import { Icon,toolIcon } from './ui-icon';
const filters=['All tools','Tax','VAT','Expenses','Planning','Property','Records'] as const;
export function ToolFinder(){
 const [search,setSearch]=useState(''),[category,setCategory]=useState('All tools');
 const filtered=tools.filter(tool=>(category==='All tools'||tool.category===category)&&`${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(search.toLowerCase()));
 return <><div className="tool-toolbar"><div className="search-field"><label className="search-label" htmlFor="tool-search">What would you like to check?</label><div className="search-input"><Icon name="search"/><input id="tool-search" type="search" placeholder="Search tax, salary, pensions…" value={search} onChange={event=>setSearch(event.target.value)}/></div></div><span className="tool-count" role="status">{filtered.length} {filtered.length===1?'calculator':'calculators'} to explore</span></div><div className="filter-tabs" role="group" aria-label="Filter tools by category">{filters.map(filter=><button key={filter} type="button" aria-pressed={category===filter} onClick={()=>setCategory(filter)}>{filter}</button>)}</div><div className="tool-grid">{filtered.map(tool=><Link className="tool-card" key={tool.slug} href={`/tools/${tool.slug}`}><div className="card-top"><span className={`tool-symbol category-${tool.category.toLowerCase()}`}><Icon name={toolIcon(tool.slug)} size={23}/></span><span className="tag">{tool.category}</span></div><h3>{tool.name}<Icon name="arrow" size={19}/></h3><p>{tool.description}</p><div className="card-foot"><span>Open calculator</span><span className="status">{tool.status}</span></div></Link>)}</div>{!filtered.length&&<div className="empty-state"><Icon name="search" size={30}/><h3>No tools found</h3><p>Try a different search or choose another category.</p><button className="button secondary" onClick={()=>{setSearch('');setCategory('All tools');}}>Show all tools</button></div>}</>;
}

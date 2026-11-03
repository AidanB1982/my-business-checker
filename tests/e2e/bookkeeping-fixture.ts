import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { entrySchema,guidedPosting,openingPosting,type BookData,type Posting } from '../../src/lib/bookkeeping/engine';
const bookId='22222222-2222-4222-8222-222222222222';let bundle:Promise<string>|undefined;
function script(){return bundle??=build({stdin:{contents:"import React from 'react';import{createRoot}from'react-dom/client';import{BookkeepingWorkspace}from'./src/components/bookkeeping-workspace';createRoot(document.getElementById('root')).render(<BookkeepingWorkspace/>);",resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'test-link',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:"import React from'react';export default function Link({children,...props}){return React.createElement('a',props,children);}",loader:'jsx',resolveDir:process.cwd()}));}}]}).then(r=>r.outputFiles[0].text);}
export async function bookkeepingFixture(page:Page,{paid=true,opening=true,empty=false}={}){
 let exists=!empty;
 const data:BookData={book:{id:bookId,name:'My rental property',type:'landlord',start_date:'2026-01-01',locked_through:null,opening_set:opening,created_at:'2026-01-01'},journals:[],lines:[],reconciliations:[],canWrite:paid};
 const mutations:Record<string,unknown>[]=[];
 function add(kind:string,lines:Posting[],description:string,date:string,document:string|null=null){const id=crypto.randomUUID();data.journals.push({id,book_id:bookId,entry_date:date,description,kind,document_id:['invoice','bill'].includes(kind)?id:document,counterparty:'Customer',reference:'TEST',reversal_of:null,created_at:new Date().toISOString(),request_id:crypto.randomUUID()});data.lines.push(...lines.map(line=>({...line,journal_id:id,book_id:bookId})));return id;}
 if(opening&&!empty)add('opening',[{account:'bank',debit:1000000,credit:0},{account:'property',debit:20000000,credit:0},{account:'mortgage',debit:0,credit:15000000},{account:'capital',debit:0,credit:6000000}],'Opening balances',data.book.start_date);
 const [js,css]=await Promise.all([script(),readFile('src/app/globals.css','utf8')]);
 await page.route('http://localhost:4180/**',async route=>{const url=new URL(route.request().url());const json=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/fixture.js')return route.fulfill({contentType:'application/javascript',body:js});
  if(!url.pathname.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`});
  if(route.request().method()==='GET')return json(url.pathname==='/api/bookkeeping'?{books:exists?[data.book]:[],canWrite:paid}:data);
  const input=route.request().postDataJSON();mutations.push(input);
  if(!paid)return json({error:'Advanced required.'},402);
  if(url.pathname==='/api/bookkeeping'){data.book={...data.book,...input,opening_set:false};exists=true;return json({id:bookId},201);}
  if(input.action==='opening'){const lines=openingPosting(input.data.balances);if(lines.length)add('opening',lines,'Opening balances',data.book.start_date);data.book.opening_set=true;}
  if(input.action==='entry'){const entry=entrySchema.parse(input.data);add(entry.kind,guidedPosting(entry,data.book,data.journals.find(j=>j.id===entry.document_id)),entry.description,entry.date,entry.document_id);}
  if(input.action==='reconcile')data.reconciliations.push({id:crypto.randomUUID(),statement_date:input.date,opening_balance:input.opening,closing_balance:input.closing,journal_ids:input.journal_ids,created_at:new Date().toISOString()});
  if(input.action==='lock')data.book.locked_through=input.date;
  return json({ok:true});
 });
 await page.goto('http://localhost:4180/bookkeeping');return {data,mutations};
}

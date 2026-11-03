import { accountingReports,documentOutstanding,type AccountCode } from './engine';
import { contactControlCheck } from './contacts';
import { invoicePosition,type InvoiceData } from './invoices';
export type HealthTarget='owed'|'invoices'|'customers'|'suppliers'|'bank'|'ledger'|'reports'|'settings';
export type HealthIssue={id:string;title:string;detail:string;count:number;amount?:number;target:HealthTarget;action:string;account?:AccountCode;level:'attention'|'review'};
export function monthPeriod(month:string,today:string){
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Choose a valid month.');
 const [year,m]=month.split('-').map(Number);return {from:month+'-01',to:[new Date(Date.UTC(year,m,0)).toISOString().slice(0,10),today].sort()[0]};
}
export function upcomingPayments(data:InvoiceData,asOf:string,days=30){
 const end=new Date(Date.parse(asOf+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
 return (data.invoices??[]).filter(i=>i.kind==='supplier'&&i.status==='posted'&&i.invoice_date<=asOf&&i.due_date>=asOf&&i.due_date<=end).flatMap(i=>{const j=data.journals.find(j=>j.id===i.journal_id);if(!j)return [];const position=invoicePosition(j,data,i.due_date,asOf);return position.balance>0&&position.status!=='Reversed'?[{invoice:i,balance:position.balance,contact:data.contacts?.find(c=>c.id===i.contact_id)?.name??'Supplier'}]:[];});
}
export function healthCheck(data:InvoiceData,asOf:string):HealthIssue[]{
 const issues:HealthIssue[]=[];const reports=accountingReports(data,data.book.start_date,asOf);
 const posted=data.journals.filter(j=>j.entry_date<=asOf);
 for(const kind of ['customer','supplier'] as const){
  const overdue=(data.invoices??[]).filter(d=>d.kind===kind&&d.status==='posted'&&d.invoice_date<=asOf&&d.due_date<asOf).flatMap(d=>{const j=posted.find(j=>j.id===d.journal_id);if(!j)return [];const p=invoicePosition(j,data,d.due_date,asOf);return p.status!=='Reversed'&&p.balance>0?[p]:[];});
  if(overdue.length)issues.push({id:`overdue-${kind}`,title:kind==='customer'?'Customer invoices past due':'Supplier invoices past due',detail:'Based on recorded due dates and payments, not on your bank feed. Check the records before following up.',count:overdue.length,amount:overdue.reduce((n,p)=>n+p.balance,0),target:'invoices',action:'Review overdue invoices',level:'attention'});
  if(Array.isArray(data.contacts)){const c=contactControlCheck(data,kind,asOf);if(c.unassigned!==0)issues.push({id:`unassigned-${kind}`,title:kind==='customer'?'Customer balances need assigning':'Supplier balances need assigning',detail:'Named accounts do not yet match the control total. Allocate existing opening amounts or link older entries; do not post the debt again.',count:1,amount:c.unassigned,target:kind==='customer'?'customers':'suppliers',action:'Resolve account assignments',level:'attention'});}
 }
 const cleared=new Set(data.reconciliations.filter(r=>r.statement_date<=asOf).flatMap(r=>r.journal_ids));
 const unMatched=posted.filter(j=>j.kind!=='opening'&&!cleared.has(j.id)&&data.lines.some(l=>l.journal_id===j.id&&l.account==='bank'));
 if(unMatched.length)issues.push({id:'unmatched-bank',title:'Bank entries not matched by this date',detail:'These may be legitimate outstanding items. Check them against the actual bank statement before treating them as missing or incorrect.',count:unMatched.length,target:'bank',action:'Match bank statement entries',level:'review'});
 const last=data.reconciliations.filter(r=>r.statement_date<=asOf).at(-1);
 if(data.book.opening_set&&(!last||last.statement_date<asOf))issues.push({id:'bank-review',title:'Bank check not confirmed through this date',detail:last?`Latest signed-off statement: ${last.statement_date}. Confirm the next statement when available.`:'No bank statement has been signed off yet.',count:1,target:'bank',action:'Complete a bank check',level:'review'});
 for(const row of reports.trial){
  const unusual=(['cash','equipment','property','receivable'].includes(row.code)&&row.balance<0)||(['payable','loan','mortgage','deposits'].includes(row.code)&&row.balance>0);
  if(unusual)issues.push({id:`negative-${row.code}`,title:`Review ${row.label.toLowerCase()}`,detail:'This account has a balance in the unusual direction. A credit, overpayment or reversal may explain it; check the underlying entries.',count:1,amount:['payable','loan','mortgage','deposits'].includes(row.code)?-row.balance:row.balance,target:'ledger',account:row.code,action:'Inspect account entries',level:'review'});
 }
 if(reports.balanceDifference!==0||reports.trialDifference!==0)issues.push({id:'balance',title:'Accounting totals do not balance',detail:'Stop posting and have the ledger reviewed. A zero balance check alone does not prove all entries are correct.',count:1,amount:reports.balanceDifference,target:'reports',action:'Inspect financial reports',level:'attention'});
 const native=new Set((data.invoices??[]).flatMap(d=>d.journal_id?[d.journal_id]:[]));
 const undated=posted.filter(j=>['invoice','bill'].includes(j.kind)&&!native.has(j.id)&&documentOutstanding(j,posted,data.lines)>0&&data.lines.some(l=>l.journal_id===j.id&&['receivable','payable'].includes(l.account)));
 if(undated.length)issues.push({id:'missing-due-dates',title:'Older invoice records have no due dates',detail:'Overdue checks cannot assess these ledger-only records. Review them in Money owed; do not enter the same invoices again.',count:undated.length,target:'owed',action:'Review older invoice records',level:'review'});
 return issues;
}
export function setupProgress(data:InvoiceData){return [{id:'book',title:'Create your business or property books',done:true},{id:'opening',title:'Confirm your starting balances',done:data.book.opening_set},{id:'entry',title:'Record your first checked transaction',done:data.journals.some(j=>j.kind!=='opening')}];}
export function monthlyTrend(data:InvoiceData,from:string,to:string){
 const start=from.slice(0,7)+'-01';const end=to.slice(0,7)+'-01';let current=new Date(end+'T00:00:00Z');const months:string[]=[];
 for(let i=0;i<12&&current.toISOString().slice(0,10)>=start;i++){months.unshift(current.toISOString().slice(0,7));current=new Date(Date.UTC(current.getUTCFullYear(),current.getUTCMonth()-1,1));}
 return months.map(month=>{const p=monthPeriod(month,to),r=accountingReports(data,[p.from,from].sort().at(-1)!,p.to);return {month,profit:r.profit,cashMovement:r.cashMovement};});
}

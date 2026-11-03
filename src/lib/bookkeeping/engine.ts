import { z } from 'zod';
export const accounts=[
 ['bank','Bank','asset'],['cash','Cash in hand','asset'],['receivable','Money customers or tenants owe','asset'],['equipment','Equipment at book value','asset'],['property','Property at book value','asset'],['construction','Assets under construction','asset'],['accumulated_depreciation','Accumulated depreciation (asset reduction)','asset'],
 ['payable','Unpaid supplier bills','liability'],['loan','Business loan outstanding','liability'],['mortgage','Mortgage outstanding','liability'],['deposits','Refundable tenant deposits held','liability'],
 ['capital','Owner’s money invested','equity'],['drawings','Money taken for personal use','equity'],
 ['sales','Business sales','income'],['rent','Rental income','income'],
 ['general','Other business costs','expense'],['repairs','Repairs and maintenance','expense'],['insurance','Insurance','expense'],['fees','Professional and agent fees','expense'],['utilities','Utilities','expense'],['travel','Business travel','expense'],['interest','Loan and mortgage interest','expense'],['depreciation','Depreciation','expense'],
] as const;
export type AccountCode=typeof accounts[number][0];
export const expenseCodes=['general','repairs','insurance','fees','utilities','travel','interest'] as const;
const day=z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).refine(s=>{const date=new Date(`${s}T00:00:00Z`);return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===s;});
const money=z.number().int().min(0).max(100000000000); // Integer pence, not floating-point pounds.
const name=z.string().trim().min(1).max(160);
export const createBookSchema=z.object({name,type:z.enum(['sole-trader','landlord']),start_date:day}).strict();
export const entrySchema=z.object({request_id:z.uuid(),contact_id:z.uuid().nullable().default(null),date:day,description:name,kind:z.enum(['income','expense','owner-in','drawings','loan-in','mortgage-in','opening-receipt','opening-bill-payment','loan-payment','mortgage-payment','equipment','property','deposit-in','deposit-out','invoice','bill','invoice-payment','bill-payment','transfer','depreciation']),amount:money.refine(n=>n>0),category:z.enum(expenseCodes).default('general'),bank:z.enum(['bank','cash']).default('bank'),interest:money.default(0),document_id:z.uuid().nullable().default(null),counterparty:z.string().trim().max(120).default(''),reference:z.string().trim().max(80).default('')}).strict();
export const openingSchema=z.object({request_id:z.uuid(),balances:z.object({bank:z.number().int().min(-100000000000).max(100000000000),cash:money,receivable:money,equipment:money,property:money,payable:money,loan:money,mortgage:money,deposits:money}).strict()}).strict();
export type Book={id:string;name:string;type:'sole-trader'|'landlord';start_date:string;locked_through:string|null;created_at:string;opening_set:boolean};
export type Journal={id:string;book_id:string;entry_date:string;description:string;kind:string;document_id:string|null;counterparty:string;reference:string;reversal_of:string|null;created_at:string;request_id:string};
export type Line={journal_id:string;book_id:string;account:AccountCode;debit:number;credit:number};
export type Posting={account:AccountCode;debit:number;credit:number};
export type BookData={book:Book;journals:Journal[];lines:Line[];reconciliations:Reconciliation[];canWrite:boolean};
export type Reconciliation={id:string;statement_date:string;opening_balance:number;closing_balance:number;journal_ids:string[];created_at:string};
const debit=(account:AccountCode,amount:number):Posting=>({account,debit:amount,credit:0});
const credit=(account:AccountCode,amount:number):Posting=>({account,debit:0,credit:amount});
export function guidedPosting(input:z.infer<typeof entrySchema>,book:Book,document?:Journal):Posting[]{
 const {amount,bank,kind}=input;const income=book.type==='landlord'?'rent':'sales';
 if(input.date<book.start_date)throw new Error('Use a date on or after this book’s start date.');
 if(input.interest>amount)throw new Error('Interest cannot exceed the total payment.');
 switch(kind){
  case 'income':return [debit(bank,amount),credit(income,amount)];
  case 'expense':return [debit(input.category,amount),credit(bank,amount)];
  case 'owner-in':return [debit(bank,amount),credit('capital',amount)];
  case 'drawings':return [debit('drawings',amount),credit(bank,amount)];
  case 'loan-in':case 'mortgage-in':return [debit(bank,amount),credit(kind==='mortgage-in'?'mortgage':'loan',amount)];
  case 'opening-receipt':return [debit(bank,amount),credit('receivable',amount)];
  case 'opening-bill-payment':return [debit('payable',amount),credit(bank,amount)];
  case 'loan-payment':case 'mortgage-payment':return [debit(kind==='loan-payment'?'loan':'mortgage',amount-input.interest),debit('interest',input.interest),credit(bank,amount)].filter(line=>line.debit||line.credit);
  case 'equipment':case 'property':return [debit(kind,amount),credit(bank,amount)];
  case 'deposit-in':return [debit(bank,amount),credit('deposits',amount)];
  case 'deposit-out':return [debit('deposits',amount),credit(bank,amount)];
  case 'invoice':return [debit('receivable',amount),credit(income,amount)];
  case 'bill':return [debit(input.category,amount),credit('payable',amount)];
  case 'invoice-payment':case 'bill-payment':{
   if(!document||document.kind!==(kind==='invoice-payment'?'invoice':'bill'))throw new Error('Choose the matching unpaid invoice or supplier bill.');
   if(input.date<document.entry_date)throw new Error('The payment cannot be earlier than the invoice or bill.');
   return kind==='invoice-payment'?[debit(bank,amount),credit('receivable',amount)]:[debit('payable',amount),credit(bank,amount)];
  }
  case 'transfer':return [debit(bank==='bank'?'cash':'bank',amount),credit(bank,amount)];
  case 'depreciation':return [debit('depreciation',amount),credit('equipment',amount)];
 }
}
export function openingPosting(balances:z.infer<typeof openingSchema>['balances']):Posting[]{
 const result:Posting[]=[];let net=0;
 for(const [code,amount] of Object.entries(balances)){if(!amount)continue;const asset=['bank','cash','receivable','equipment','property'].includes(code);const signed=asset?amount:-amount;net+=signed;result.push(signed>0?debit(code as AccountCode,signed):credit(code as AccountCode,-signed));}
 if(net)result.push(net>0?credit('capital',net):debit('capital',-net));
 return result;
}
export function documentOutstanding(document:Journal,journals:Journal[],lines:Line[]){const ids=new Set(journals.filter(j=>j.id===document.id||j.document_id===document.id).map(j=>j.id));return lines.filter(l=>ids.has(l.journal_id)&&l.account===(document.kind==='invoice'?'receivable':'payable')).reduce((sum,line)=>sum+(document.kind==='invoice'?line.debit-line.credit:line.credit-line.debit),0);}
export function accountingReports(data:Pick<BookData,'journals'|'lines'>,from:string,to:string){
 const journals=data.journals.filter(j=>j.entry_date<=to),ids=new Map(journals.map(j=>[j.id,j]));
 const balances=new Map<string,number>(),period=new Map<string,number>();
 for(const line of data.lines){const j=ids.get(line.journal_id);if(!j)continue;const signed=line.debit-line.credit;balances.set(line.account,(balances.get(line.account)??0)+signed);if(j.kind!=='opening'&&j.entry_date>=from)period.set(line.account,(period.get(line.account)??0)+signed);}
 const trial=accounts.map(([code,label,type])=>({code,label,type,balance:balances.get(code)??0}));
 const income=accounts.filter(a=>a[2]==='income').map(([code,label])=>({code,label,value:-(period.get(code)??0)}));
 const expenses=accounts.filter(a=>a[2]==='expense').map(([code,label])=>({code,label,value:period.get(code)??0}));
 const incomeTotal=income.reduce((n,r)=>n+r.value,0),expenseTotal=expenses.reduce((n,r)=>n+r.value,0);
 const allProfit=-trial.filter(r=>r.type==='income'||r.type==='expense').reduce((n,r)=>n+r.balance,0);
 const assets=trial.filter(r=>r.type==='asset'&&!(r.code==='bank'&&r.balance<0)).map(r=>({label:r.label,value:r.balance}));
 const liabilities:{label:string;value:number}[]=trial.filter(r=>r.type==='liability').map(r=>({label:r.label,value:-r.balance}));
 const bank=balances.get('bank')??0;if(bank<0)liabilities.push({label:'Bank overdraft',value:-bank});
 const equity=[...trial.filter(r=>r.type==='equity').map(r=>({label:r.label,value:-r.balance})),{label:'Accumulated bookkeeping profit / loss',value:allProfit}];
 const assetTotal=assets.reduce((n,r)=>n+r.value,0),liabilityTotal=liabilities.reduce((n,r)=>n+r.value,0),equityTotal=equity.reduce((n,r)=>n+r.value,0);
 const cashJournals=journals.filter(j=>j.kind!=='opening'&&j.entry_date>=from);const cashIds=new Set(cashJournals.map(j=>j.id));
 const cashLines=data.lines.filter(l=>cashIds.has(l.journal_id)&&['bank','cash'].includes(l.account));
 // Net each journal first so transfers between bank and cash are not new receipts/spending.
 const cashTotals=new Map<string,number>();for(const l of cashLines)cashTotals.set(l.journal_id,(cashTotals.get(l.journal_id)??0)+l.debit-l.credit);
 const movements=cashJournals.map(j=>({journal:j,amount:cashTotals.get(j.id)??0}));
 const moneyIn=movements.filter(r=>r.amount>0).reduce((n,r)=>n+r.amount,0),moneyOut=Math.abs(movements.filter(r=>r.amount<0).reduce((n,r)=>n+r.amount,0));
 return {income,expenses,incomeTotal,expenseTotal,profit:incomeTotal-expenseTotal,assets,liabilities,equity,assetTotal,liabilityTotal,equityTotal,balanceDifference:assetTotal-liabilityTotal-equityTotal,trial,trialDifference:trial.reduce((n,r)=>n+r.balance,0),moneyIn,moneyOut,cashMovement:moneyIn-moneyOut,movements};
}
export function accountingCSV(data:BookData){const cell=(s:unknown)=>{const text=String(s??'');return '"'+(/^[\s]*[=+\-@]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';};const rows=[['Date','Description','Type','Reference','Account','Debit GBP','Credit GBP','Journal ID'],...data.lines.map(l=>{const j=data.journals.find(j=>j.id===l.journal_id)!;return [j?.entry_date,j?.description,j?.kind,j?.reference,accounts.find(a=>a[0]===l.account)?.[1],(l.debit/100).toFixed(2),(l.credit/100).toFixed(2),l.journal_id];})];return '\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n');}

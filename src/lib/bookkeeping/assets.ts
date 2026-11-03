import { z } from 'zod';
import { invoiceDay,type InvoiceData } from './invoices';
export type CostProject={id:string;book_id:string;parent_id:string|null;name:string;description:string;planning_project_id:string|null;status:'open'|'complete';version:number;created_at:string};
export type ProjectCost={id:string;book_id:string;project_id:string;source_journal_id:string;posting_journal_id:string|null;amount:number;classification:'capital'|'expense';source_account:string;allocated_on?:string;voided:boolean;voided_on?:string|null;reversal_journal_id:string|null};
export type BookAsset={id:string;book_id:string;project_id:string;name:string;account:'equipment'|'property';cost:number;available_date:string;life_months:number;residual:number;depreciated:number;depreciated_through:string|null;completion_journal_id:string};
export type AssetData=InvoiceData&{cost_projects?:CostProject[];project_costs?:ProjectCost[];assets?:BookAsset[];asset_charges?:{id:string;book_id:string;asset_id:string;journal_id:string;through_date:string;amount:number}[]};
const base={id:z.uuid(),request_id:z.uuid(),date:invoiceDay};
export const assetAction=z.discriminatedUnion('action',[
 z.object({action:z.literal('project.save'),id:z.uuid(),name:z.string().trim().min(1).max(160),description:z.string().trim().max(3000).default(''),parent_id:z.uuid().nullable().default(null),planning_project_id:z.uuid().nullable().default(null),version:z.number().int().min(1).optional()}).strict(),
 z.object({action:z.literal('cost.add'),...base,description:z.string().trim().max(160).default(''),amount:z.number().int().min(1).max(100000000000),bank:z.enum(['bank','cash'])}).strict(),
 z.object({action:z.literal('cost.allocate'),...base,source_journal_id:z.uuid(),classification:z.enum(['capital','expense'])}).strict(),
 z.object({action:z.literal('cost.reverse'),...base}).strict(),
 z.object({action:z.literal('project.close'),...base}).strict(),
 z.object({action:z.literal('asset.complete'),...base,account:z.enum(['equipment','property']),life_months:z.number().int().min(0).max(1200),residual:z.number().int().min(0).max(100000000000),confirmed:z.literal(true)}).strict(),
 z.object({action:z.literal('asset.depreciate'),...base}).strict(),
]);
export function depreciationPreview(asset:BookAsset,through:string){
 if(!invoiceDay.safeParse(through).success)return {amount:0,months:0,target:asset.depreciated};
 const monthEnd=new Date(Date.UTC(Number(through.slice(0,4)),Number(through.slice(5,7)),0)).toISOString().slice(0,10);
 if(through!==monthEnd||through<=asset.available_date||!asset.life_months||(asset.depreciated_through&&through<=asset.depreciated_through))return {amount:0,months:0,target:asset.depreciated};
 const months=Math.max(0,Math.min(asset.life_months,(Number(through.slice(0,4))-Number(asset.available_date.slice(0,4)))*12+Number(through.slice(5,7))-Number(asset.available_date.slice(5,7))));
 const target=Math.round((asset.cost-asset.residual)*months/asset.life_months);return {amount:Math.max(0,target-asset.depreciated),months,target};
}
export function projectPosition(data:AssetData,id:string,includeChildren=true){
 const ids=new Set((data.cost_projects??[]).filter(p=>p.id===id||(includeChildren&&p.parent_id===id)).map(p=>p.id));
 const costs=(data.project_costs??[]).filter(c=>ids.has(c.project_id)&&!c.voided),assets=(data.assets??[]).filter(a=>ids.has(a.project_id));
 const capital=costs.filter(c=>c.classification==='capital').reduce((n,c)=>n+c.amount,0),expense=costs.filter(c=>c.classification==='expense').reduce((n,c)=>n+c.amount,0),completed=assets.reduce((n,a)=>n+a.cost,0),depreciation=assets.reduce((n,a)=>n+a.depreciated,0);
 return {capital,expense,total:capital+expense,construction:capital-completed,completed,depreciation,bookValue:completed-depreciation};
}
export function checkAssetRegister(data:AssetData){
 const balances=new Map<string,number>();for(const l of data.lines)balances.set(l.account,(balances.get(l.account)??0)+l.debit-l.credit);
 const construction=(data.cost_projects??[]).filter(p=>!p.parent_id).reduce((n,p)=>n+projectPosition(data,p.id).construction,0),assets=data.assets??[];
 if(construction!==(balances.get('construction')??0))throw new Error('Construction projects do not match the ledger.');
 if(assets.reduce((n,a)=>n+a.depreciated,0)!==-(balances.get('accumulated_depreciation')??0))throw new Error('Asset depreciation does not match the ledger.');
 for(const account of ['equipment','property']){const registered=assets.filter(a=>a.account===account).reduce((n,a)=>n+a.cost,0);if(registered>0&&registered>(balances.get(account)??0))throw new Error('Registered gross asset costs exceed the ledger.');}
 for(const asset of assets){const lines=data.lines.filter(l=>l.journal_id===asset.completion_journal_id);if(lines.filter(l=>l.account===asset.account).reduce((n,l)=>n+l.debit-l.credit,0)!==asset.cost||lines.filter(l=>l.account==='construction').reduce((n,l)=>n+l.credit-l.debit,0)!==asset.cost)throw new Error('Completed asset does not match its transfer.');}
 for(const charge of data.asset_charges??[]){if(!assets.some(a=>a.id===charge.asset_id))throw new Error('Asset charge has no asset.');const lines=data.lines.filter(l=>l.journal_id===charge.journal_id);if(lines.filter(l=>l.account==='depreciation').reduce((n,l)=>n+l.debit-l.credit,0)!==charge.amount||lines.filter(l=>l.account==='accumulated_depreciation').reduce((n,l)=>n+l.credit-l.debit,0)!==charge.amount)throw new Error('Asset charge does not match the ledger.');}
}

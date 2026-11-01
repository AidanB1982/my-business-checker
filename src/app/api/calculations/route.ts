import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated,checkOrigin,readJson,apiError,ApiError } from '@/lib/api';
import { hasAdvanced } from '@/lib/entitlements';
import { calculationDraft,buildSnapshot } from '@/lib/reports/calculations';
const bodySchema=z.object({title:z.string().trim().min(1).max(150),calculation:calculationDraft,expectedRuleSetVersion:z.string().min(1).max(50),consent:z.literal(true)}).strict();
export async function POST(request:Request){try{
 checkOrigin(request);const {supabase,user}=await authenticated();
 const {data:plan,error:planError}=await supabase.from('subscriptions').select('status,current_period_end').eq('user_id',user.id).maybeSingle();
 if(planError)throw new ApiError(503,'Your plan could not be checked.');if(!hasAdvanced(plan))throw new ApiError(402,'An active Advanced subscription is required to save new calculations.');
 const parsed=bodySchema.safeParse(await readJson(request));if(!parsed.success)throw new ApiError(400,'Check the calculation title, figures and consent.');
 let snapshot;try{snapshot=buildSnapshot(parsed.data.calculation);}catch{throw new ApiError(400,'These figures or tax year are not supported. Recalculate and try again.');}
 if(snapshot.ruleSetVersion!==parsed.data.expectedRuleSetVersion)throw new ApiError(409,'The rules changed. Recalculate before saving.');
 const {data,error}=await supabase.from('saved_calculations').insert({user_id:user.id,title:parsed.data.title,tool_slug:snapshot.toolSlug,tax_year:snapshot.taxYear,rule_set_version:snapshot.ruleSetVersion,inputs:parsed.data.calculation.inputs,result:snapshot}).select('id').single();
 if(error)throw new ApiError(503,'The calculation could not be saved. Check that your subscription is still active.');
 return NextResponse.json({id:data.id},{status:201,headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return apiError(error);}}

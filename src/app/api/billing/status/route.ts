import { NextResponse } from 'next/server';
import { authenticated,ApiError,apiError } from '@/lib/api';
import { hasAdvanced } from '@/lib/entitlements';
export async function GET(){try{
 const {supabase,user}=await authenticated();
 const {data,error}=await supabase.from('subscriptions').select('status,current_period_end').eq('user_id',user.id).maybeSingle();
 if(error)throw new ApiError(503,'Your payment confirmation could not be checked.');
 return NextResponse.json({advanced:hasAdvanced(data)},{headers:{'Cache-Control':'private, no-store'}});
}catch(error){return apiError(error);}}

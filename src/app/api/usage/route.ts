import { NextResponse } from 'next/server';
import { authenticated,checkOrigin,readJson,ApiError,apiError } from '@/lib/api';
import { validUsagePage } from '@/lib/usage';
const ok = () => new NextResponse(null,{status:204,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request) {
 try {
  checkOrigin(request);
  const {supabase,user} = await authenticated();
  if(user.is_anonymous) throw new ApiError(403,'Sign in to record optional usage.');
  const body = await readJson(request);
  if(!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['page','consent'].includes(k)) || body.consent !== true || !validUsagePage(body.page)) throw new ApiError(400,'Choose whether to share usage and use a recognised page.');
  const {error} = await supabase.rpc('record_app_activity',{p_page:body.page});
  if(error) throw new ApiError(503,'Usage recording is unavailable.');
  return ok();
 } catch(error) { return apiError(error); }
}
export async function DELETE(request:Request) {
 try {
  checkOrigin(request);const {supabase} = await authenticated();
  const {error} = await supabase.rpc('delete_my_app_activity');
  if(error) throw new ApiError(503,'Your usage history could not be deleted. Try again.');
  return ok();
 } catch(error) { return apiError(error); }
}

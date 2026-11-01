import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from './supabase/server';
import { isSupabaseConfigured } from './config';
export class ApiError extends Error {constructor(public status:number,message:string){super(message);}}
export async function authenticated(){
 if(!isSupabaseConfigured())throw new ApiError(503,'Accounts are not configured.');
 const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)throw new ApiError(401,'Sign in to use your account.');
 return {supabase,user};
}
export function checkOrigin(request:Request){
 const origin=request.headers.get('origin');
 try{
  if(!origin)throw new Error();const parsed=new URL(origin);
  const host=request.headers.get('host')??new URL(request.url).host;
  const loopback=['localhost','127.0.0.1','[::1]'].includes(parsed.hostname);
  if(parsed.origin!==origin||parsed.host.toLowerCase()!==host.toLowerCase()||(parsed.protocol!=='https:'&&!(parsed.protocol==='http:'&&loopback)))throw new Error();
 }catch{throw new ApiError(403,'Use this app to submit the request.');}
}
export async function readJson(request:Request){const text=await request.text();if(new TextEncoder().encode(text).length>16384)throw new ApiError(413,'Calculation is too large.');try{return JSON.parse(text);}catch{throw new ApiError(400,'Invalid JSON.');}}
export function apiError(error:unknown){return NextResponse.json({error:error instanceof ApiError?error.message:'The request could not be completed. Try again later.'},{status:error instanceof ApiError?error.status:500,headers:{'Cache-Control':'private, no-store'}});}

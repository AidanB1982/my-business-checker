import { beforeEach,describe,it,expect,vi } from 'vitest';
import { NextRequest } from 'next/server';
const state=vi.hoisted(()=>({returnTo:'/pricing',setCalls:[] as unknown[],deleted:false,otp:null as unknown,error:false}));
vi.mock('server-only',()=>({}));
vi.mock('next/navigation',()=>({redirect:(url:string)=>{throw new Error(`REDIRECT ${url}`);}}));
vi.mock('next/headers',()=>({cookies:async()=>({get:()=>({value:state.returnTo}),set:(name:string,value:string,options:unknown)=>{state.setCalls.push([name,value,options]);},delete:()=>{state.deleted=true;}})}));
vi.mock('@/lib/config',()=>({SITE_URL:'https://app.test',isSupabaseConfigured:()=>true}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{signInWithOtp:async(value:unknown)=>{state.otp=value;return {error:state.error?{message:'fixture failure'}:null};},exchangeCodeForSession:async()=>({error:state.error?{message:'expired'}:null})}})}));
import { AUTH_RETURN_COOKIE,authReturnPath } from '../../src/lib/auth-navigation';
import { signIn } from '../../src/app/auth/actions';
import { GET } from '../../src/app/auth/callback/route';
beforeEach(()=>{state.returnTo='/pricing';state.setCalls=[];state.deleted=false;state.otp=null;state.error=false;});
describe('pricing sign-in continuation',()=>{
 it.each(['https://evil.test','//evil.test','/pricing?next=evil','/admin','/learn/../admin','/learn/%2f%2fevil','/learn/example?next=evil','/learn/\\evil',undefined])('does not accept untrusted redirect %s',value=>{expect(authReturnPath(value)).toBe('/account');});
 it('records a safe pricing return without changing the allowed Supabase callback URL',async()=>{
  const form=new FormData();form.set('email','fixture@example.test');form.set('returnTo','/pricing');
  await expect(signIn(form)).rejects.toThrow('status=sent&next=%2Fpricing');
  expect(state.setCalls[0]).toEqual([AUTH_RETURN_COOKIE,'/pricing',expect.objectContaining({httpOnly:true,secure:true,sameSite:'lax',path:'/'})]);
  expect(state.otp).toMatchObject({options:{emailRedirectTo:'https://app.test/auth/callback'}});
 });
 it('preserves an internal lesson destination through sign-in',async()=>{state.returnTo='/learn/sole-trader-bank-review';const response=await GET(new NextRequest('https://app.test/auth/callback?code=fixture'));expect(response.headers.get('location')).toBe('https://app.test/learn/sole-trader-bank-review');});
 it('returns a successful email sign-in directly to pricing',async()=>{
  const response=await GET(new NextRequest('https://app.test/auth/callback?code=fixture'));
  expect(response.headers.get('location')).toBe('https://app.test/pricing');expect(state.deleted).toBe(true);
 });
 it('ignores a forged cookie and untrusted callback query',async()=>{
  state.returnTo='https://evil.test';const response=await GET(new NextRequest('https://app.test/auth/callback?code=fixture&next=https://evil.test'));
  expect(response.headers.get('location')).toBe('https://app.test/account');
 });
 it('preserves the pricing destination when requesting a replacement expired link',async()=>{
  state.error=true;const response=await GET(new NextRequest('https://app.test/auth/callback?code=expired'));
  expect(response.headers.get('location')).toBe('https://app.test/sign-in?status=expired&next=%2Fpricing');
 });
 it('keeps sign-in failures on the intended pricing flow',async()=>{
  state.error=true;const form=new FormData();form.set('email','fixture@example.test');form.set('returnTo','/pricing');await expect(signIn(form)).rejects.toThrow('status=error&next=%2Fpricing');
 });
});

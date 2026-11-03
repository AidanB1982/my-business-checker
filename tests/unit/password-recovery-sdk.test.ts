import { it,expect } from 'vitest';
import { createServerClient } from '@supabase/ssr';
it('preserves the installed Supabase SDK recovery discriminator across server cookie clients',async()=>{
 const jar=new Map<string,string>();const calls:string[]=[];
 const fetcher:typeof fetch=async input=>{const url=String(input);calls.push(url);if(url.includes('/recover'))return Response.json({});if(url.includes('/token'))return Response.json({access_token:'header.payload.signature',refresh_token:'example-refresh-token',expires_in:3600,token_type:'bearer',user:{id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'fixture@example.test',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}});throw new Error('Unexpected SDK request');};
 const create=()=>createServerClient('https://supabase.example.test','example-publishable-key',{global:{fetch:fetcher},cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>{for(const c of values)if(c.options.maxAge===0)jar.delete(c.name);else jar.set(c.name,c.value);}}});
 expect((await create().auth.resetPasswordForEmail('fixture@example.test',{redirectTo:'https://app.test/auth/callback'})).error).toBeNull();expect(jar.size).toBeGreaterThan(0);
 const result=await create().auth.exchangeCodeForSession('example-code');expect(result.error).toBeNull();expect(result.data).toHaveProperty('redirectType','recovery');expect(result.data.user?.id).toBe('11111111-1111-4111-8111-111111111111');expect(calls.some(url=>url.includes('/token'))).toBe(true);
});

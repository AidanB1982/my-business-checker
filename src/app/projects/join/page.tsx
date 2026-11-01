import { cookies } from 'next/headers';
import { isSupabaseConfigured } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';
import { ProjectJoin } from '@/components/project-join';
export const metadata={title:'Join a project workspace',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default async function Join(){let signedIn=false,displayName='';if(isSupabaseConfigured())try{const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();signedIn=Boolean(user);displayName=user?.email?.split('@')[0]??'';}catch{/* The invitation remains available while sign-in is retried. */}const store=await cookies();const token=store.get('mbc_project_invite')?.value;return <ProjectJoin signedIn={signedIn} displayName={displayName} hasInvite={Boolean(token&&/^[a-f0-9]{64}$/.test(token))}/>;}

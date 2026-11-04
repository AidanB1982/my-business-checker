import { notFound,redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/config';
import { OwnerDashboard } from '@/components/owner-dashboard';
import type { OwnerStats } from '@/lib/usage';
export const dynamic='force-dynamic';
export const metadata={title:'App owner dashboard',robots:{index:false,follow:false}};
export default async function OwnerPage() {
 if(!isSupabaseConfigured())redirect('/sign-in');
 const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)redirect('/sign-in');
 const owner=await supabase.rpc('is_app_owner');
 if(owner.error||owner.data!==true)notFound();
 const {data,error:statsError}=await supabase.rpc('owner_dashboard_stats');
 if(statsError||!data)return <div className="wrap section" role="alert"><h1>Statistics could not load.</h1><p>Please reload this page to try again.</p><Link className="text-link" href="/account">← My workspace</Link></div>;
 return <OwnerDashboard stats={data as OwnerStats}/>;
}

import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/config';
import { shopifyConfigurationIssues } from '@/lib/shopify/config';
export const dynamic='force-dynamic';
export async function GET(){
 const configurationIssues=shopifyConfigurationIssues();
 return NextResponse.json({application:'my-business-checker',status:'ok',revision:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,7)??null,supabase:{configured:isSupabaseConfigured(),connection:'not-checked'},billing:{provider:'shopify',configured:configurationIssues.length===0,configurationIssues,connection:'not-checked'}},{headers:{'Cache-Control':'no-store'}});
}

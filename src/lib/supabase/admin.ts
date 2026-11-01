import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/config';
export function createAdmin(){const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!key)throw new Error('Server billing configuration is missing.');return createClient(SUPABASE_URL,key,{auth:{persistSession:false,autoRefreshToken:false}});}

import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
export async function GET() {return NextResponse.json({application:"my-business-checker",status:"ok",supabase:{configured:isSupabaseConfigured(),connection:"not-checked"},billing:"not-configured"},{headers:{"Cache-Control":"no-store"}});}

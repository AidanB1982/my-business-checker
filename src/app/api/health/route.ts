import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/config";
import { billingAvailable } from "@/lib/shopify/config";
export async function GET(){return NextResponse.json({application:"my-business-checker",status:"ok",supabase:{configured:isSupabaseConfigured(),connection:"not-checked"},billing:{provider:"shopify",configured:billingAvailable(),connection:"not-checked"}},{headers:{"Cache-Control":"no-store"}});}

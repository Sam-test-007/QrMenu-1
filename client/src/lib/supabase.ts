import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function currency(n: number) {
  return Number(n).toLocaleString(undefined, { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

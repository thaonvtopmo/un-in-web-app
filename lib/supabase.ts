import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Chưa có khoá Supabase thì app chạy ở chế độ dùng thử (dữ liệu mẫu, không đăng nhập) */
export const isSupabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!url || !key) throw new Error("Chưa cấu hình Supabase");
  client ??= createBrowserClient(url, key);
  return client;
}

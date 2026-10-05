import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Làm mới phiên đăng nhập ở máy chủ mỗi lần mở trang. Cookie đăng nhập do máy chủ đặt (lệnh Set-Cookie) sống tới 400 ngày,
 * còn cookie do trình duyệt tự ghi bị Safari trên iPhone xoá sau khoảng 7 ngày không dùng. Nhờ vậy mở app sau vài ngày vẫn còn đăng nhập.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let response = NextResponse.next({ request });
  if (!url || !key) return response;
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    await supabase.auth.getSession(); // chỉ gọi mạng khi mã đăng nhập sắp hết hạn, khi đó tự đổi mã mới và ghi lại cookie
  } catch {
    // Lỗi mạng thoáng qua: cứ để trang tải, phía trình duyệt sẽ tự thử lại
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icon-.*|apple-touch-icon.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico|js|css|map|txt)$).*)"],
};

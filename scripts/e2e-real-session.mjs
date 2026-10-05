// Kiểm tra làm mới phiên đăng nhập ở máy chủ (proxy.ts): node scripts/e2e-real-session.mjs <thư mục dự án> <địa chỉ trang>
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
const root = process.argv[2] || fileURLToPath(new URL('..', import.meta.url)), base = process.argv[3] || 'http://localhost:3000';
const env = Object.fromEntries(fs.readFileSync(root + '/.env.local', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL, anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ref = new URL(url).hostname.split('.')[0], name = `sb-${ref}-auth-token`;
let fails = 0;
const check = (c, n, x = '') => { if (!c) { fails++; console.log('  FAIL', n, x); } else console.log('  ok  ', n); };
const email = `un-session-${Date.now()}@example.com`, pw = 'Test-' + Math.random().toString(36).slice(2) + 'Aa1!';
const { data: u } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
try {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: s } = await c.auth.signInWithPassword({ email, password: pw });
  const enc = (sess) => name + '=base64-' + Buffer.from(JSON.stringify(sess)).toString('base64url');
  const get = (cookie) => fetch(base + '/', { headers: { cookie }, redirect: 'manual' });
  const setCookies = (r) => r.headers.getSetCookie();
  const decode = (sc) => JSON.parse(Buffer.from(sc.split(';')[0].split('=').slice(1).join('=').replace(/^base64-/, ''), 'base64url').toString());

  console.log('== Phiên còn hạn: không đổi gì');
  const ok = await get(enc(s.session));
  check(ok.status === 200, 'trang tải bình thường', String(ok.status));
  check(setCookies(ok).filter((x) => x.startsWith(name)).length === 0, 'không ghi lại cookie khi chưa cần');

  console.log('== Mã đăng nhập hết hạn: máy chủ tự đổi mã mới và ghi cookie');
  const expired = { ...s.session, expires_at: Math.floor(Date.now() / 1000) - 120, expires_in: 0 };
  const r = await get(enc(expired));
  const sc = setCookies(r).filter((x) => x.startsWith(name));
  check(r.status === 200, 'trang vẫn tải', String(r.status));
  check(sc.length >= 1, 'máy chủ đặt lại cookie đăng nhập (Set-Cookie)', JSON.stringify(setCookies(r)).slice(0, 120));
  if (sc.length) {
    const fresh = decode(sc[0]);
    check(fresh.access_token && fresh.access_token !== s.session.access_token && fresh.refresh_token !== s.session.refresh_token, 'có mã mới (cả mã làm mới được đổi)');
    check(/Max-Age=\d{6,}/i.test(sc[0]) && Number(sc[0].match(/Max-Age=(\d+)/i)[1]) > 86400 * 100, 'cookie sống rất lâu (hàng trăm ngày)', sc[0].split(';').slice(1).join(';'));
    check(/SameSite=lax/i.test(sc[0]), 'SameSite=Lax');
    const again = await c.auth.setSession({ access_token: fresh.access_token, refresh_token: fresh.refresh_token });
    check(!again.error, 'mã mới dùng được', again.error?.message);
  }

  console.log('== Phiên hỏng: trang vẫn tải, không lỗi');
  const broken = await get(enc({ ...s.session, access_token: 'x.y.z', refresh_token: 'khong-hop-le', expires_at: 1 }));
  check(broken.status === 200, 'phiên hỏng không làm trang lỗi', String(broken.status));
  const nocookie = await get('a=b');
  check(nocookie.status === 200, 'không có cookie vẫn tải bình thường');
} finally {
  await admin.auth.admin.deleteUser(u.user.id);
}
console.log(fails ? `\n${fails} LỖI` : '\nTẤT CẢ ĐẠT');
process.exit(fails ? 1 : 0);

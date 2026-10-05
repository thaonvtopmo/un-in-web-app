// Kiểm thử trang /admin thật: node scripts/e2e-real-admin.mjs <thư mục dự án> <thư mục ảnh> <địa chỉ trang>
import fs from 'fs';
import os from 'os';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
const root = process.argv[2] || fileURLToPath(new URL('..', import.meta.url)), out = process.argv[3] || os.tmpdir(), base = process.argv[4] || 'http://localhost:3000';
const env = Object.fromEntries(fs.readFileSync(root + '/.env.local', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL, anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const ref = new URL(url).hostname.split('.')[0];
let fails = 0;
const check = (c, n, x = '') => { if (!c) { fails++; console.log('  FAIL', n, x); } else console.log('  ok  ', n); };
const stamp = Date.now();
const mk = async (email) => {
  const pw = 'Test-' + Math.random().toString(36).slice(2) + 'Aa1!';
  const { data: u, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
  if (error) throw error;
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: s, error: e2 } = await c.auth.signInWithPassword({ email, password: pw });
  if (e2) throw e2;
  return { id: u.user.id, c, cookie: 'base64-' + Buffer.from(JSON.stringify(s.session)).toString('base64url') };
};
const A = await mk(`un-admin-${stamp}-a@example.com`), N = await mk(`un-admin-${stamp}-n@example.com`);
const emailA = `un-admin-${stamp}-a@example.com`;
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', headless: true });
try {
  await A.c.rpc('create_family', { p_name: 'Nhà Quản Trị Thử', p_pin: '1234', p_members: [
    { name: 'Bố', role: 'parent', color: '#FFB27A', initial: 'Bố' }, { name: 'Bé Kín', role: 'kid', color: '#3DD6B5', initial: 'B' }] });
  await admin.from('app_admins').insert({ email: emailA, role: 'owner' });

  const page = async (who) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    if (who) await ctx.addCookies([{ name: `sb-${ref}-auth-token`, value: who.cookie, url: base }]);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    return { p, errs, ctx };
  };

  console.log('== Chưa đăng nhập');
  { const { p, ctx } = await page(null);
    await p.goto(base + '/admin');
    await p.getByRole('button', { name: /Đăng nhập với Google/ }).waitFor({ timeout: 20000 });
    check(true, 'chưa đăng nhập thì thấy nút đăng nhập, không thấy số liệu');
    check(await p.getByText('Gia đình', { exact: true }).count() === 0, 'không lộ số liệu');
    await ctx.close(); }

  console.log('== Tài khoản thường');
  { const { p, ctx } = await page(N);
    await p.goto(base + '/admin');
    await p.getByText('Không có quyền quản trị').waitFor({ timeout: 20000 });
    check(true, 'tài khoản thường bị từ chối');
    check(await p.getByRole('tab', { name: 'Tổng quan' }).count() === 0, 'không thấy các mục quản trị');
    await ctx.close(); }

  console.log('== Admin');
  const { p, errs, ctx } = await page(A);
  await p.goto(base + '/admin');
  await p.getByRole('heading', { name: 'Quản trị Ủn Ỉn' }).waitFor({ timeout: 25000 });
  check(await p.getByText('Chủ', { exact: true }).isVisible(), 'hiện vai trò Chủ');
  await p.getByText('Đồng hồ gói miễn phí').waitFor({ timeout: 20000 });
  check(await p.getByText('Dung lượng database').first().isVisible(), 'có đồng hồ dung lượng database');
  check(await p.getByText('ước tính').first().isVisible(), 'số ước tính được đánh dấu rõ');
  check(await p.getByText('Dữ liệu chiếm chỗ nhiều nhất').isVisible(), 'có bảng dữ liệu lớn nhất');
  await p.screenshot({ path: `${out}/admin-1-overview.png`, fullPage: true });
  await p.getByRole('button', { name: 'Chụp số liệu ngay' }).click();
  await p.getByText(/Số liệu được chụp mỗi đêm|Xu hướng 30 ngày/).first().waitFor();
  check(true, 'bấm chụp số liệu ngay không lỗi');

  await p.getByRole('tab', { name: 'Gia đình' }).click();
  await p.getByLabel('Tìm gia đình').fill('Quản Trị Thử');
  await p.getByRole('button', { name: 'Tìm', exact: true }).click();
  await p.getByRole('row', { name: /Mở Nhà Quản Trị Thử/ }).waitFor({ timeout: 15000 });
  check(true, 'tìm thấy nhà thử theo tên');
  check(await p.getByText(emailA).first().isVisible(), 'hiện email chủ nhà');
  await p.getByRole('row', { name: /Mở Nhà Quản Trị Thử/ }).click();
  await p.getByRole('region', { name: /Chi tiết Nhà Quản Trị Thử/ }).waitFor({ timeout: 15000 });
  check(await p.getByText('Chỉ hiện số liệu.').isVisible(), 'chi tiết nói rõ chỉ có số liệu');
  check(await p.getByText('Bé Kín').count() === 0, 'tên con KHÔNG hiện trong chi tiết');
  await p.screenshot({ path: `${out}/admin-2-family.png`, fullPage: true });
  await p.getByRole('button', { name: 'Đóng' }).click();

  await p.getByRole('tab', { name: 'Nhật ký' }).click();
  await p.getByText('Xem chi tiết nhà').first().waitFor({ timeout: 15000 });
  check(await p.getByText(emailA).first().isVisible(), 'nhật ký ghi đúng admin');
  check(await p.getByText('Nhà Quản Trị Thử').first().isVisible(), 'nhật ký ghi nhà đã xem');
  await p.screenshot({ path: `${out}/admin-3-audit.png`, fullPage: true });

  await p.setViewportSize({ width: 390, height: 844 });
  await p.getByRole('tab', { name: 'Tổng quan' }).click();
  await p.getByText('Đồng hồ gói miễn phí').waitFor();
  check(!(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'điện thoại: không tràn ngang');
  await p.screenshot({ path: `${out}/admin-4-phone.png`, fullPage: true });
  check(errs.length === 0, 'không có lỗi JavaScript', errs.join('|'));
  await ctx.close();
} finally {
  await browser.close();
  await admin.from('admin_audit').delete().eq('admin_email', emailA);
  await admin.from('app_admins').delete().eq('email', emailA);
  await admin.auth.admin.deleteUser(A.id); await admin.auth.admin.deleteUser(N.id);
  await admin.rpc('admin_snapshot');
  console.log('đã dọn tài khoản thử');
}
console.log(fails ? `\n${fails} LỖI` : '\nTẤT CẢ ĐẠT');
process.exit(fails ? 1 : 0);

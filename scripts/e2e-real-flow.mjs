import fs from 'fs';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import os from 'os';
const root = process.argv[2] || fileURLToPath(new URL('..', import.meta.url)), out = process.argv[3] || os.tmpdir(), base = process.argv[4] || 'http://localhost:3300';
const env = Object.fromEntries(fs.readFileSync(root + '/.env.local', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL, anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fails = 0;
const check = (c, n, x = '') => { if (!c) { fails++; console.log('  FAIL', n, x); } else console.log('  ok  ', n); };

const email = `un-ui-${Date.now()}@example.com`, pw = 'Test-' + Math.random().toString(36).slice(2) + 'Aa1!';
const { data: cu, error: ce } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
if (ce) throw ce;
const sbc = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: sess, error: se } = await sbc.auth.signInWithPassword({ email, password: pw });
if (se) throw se;
const ref = new URL(url).hostname.split('.')[0];
const cookieVal = 'base64-' + Buffer.from(JSON.stringify(sess.session)).toString('base64url');
console.log('cookie length', cookieVal.length);

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addCookies([{ name: `sb-${ref}-auth-token`, value: cookieVal, url: base }]);
  const errors = [];
  const hook = (p) => { p.on('pageerror', e => errors.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text().slice(0, 300)); }); };

  console.log('== Tạo gia đình qua giao diện');
  const kid = await ctx.newPage(); hook(kid);
  await kid.goto(base);
  await kid.getByText('Lập gia đình trên Ủn Ỉn').waitFor({ timeout: 20000 });
  check(true, 'tài khoản mới → màn tạo gia đình');
  await kid.screenshot({ path: `${out}/real-1-setup.png`, fullPage: true });
  await kid.getByPlaceholder('Ví dụ: Nhà Gấu Bông').fill('Nhà Thử Nghiệm');
  await kid.getByLabel('Bố mẹ 1').fill('Bố');
  await kid.getByLabel('Bố mẹ 2').fill('Mẹ');
  await kid.getByLabel('Các con 1').fill('Bin');
  await kid.getByRole('button', { name: 'Thêm bé' }).click();
  await kid.getByLabel('Các con 2').fill('Na');
  await kid.getByLabel('Nhập PIN', { exact: true }).fill('1234');
  await kid.getByLabel('Nhập lại').fill('9999');
  await kid.getByRole('button', { name: 'Tạo gia đình' }).click();
  check(await kid.getByText('Hai lần nhập PIN chưa giống nhau').isVisible(), 'PIN nhập lại sai bị chặn');
  await kid.getByLabel('Nhập lại').fill('1234');
  await kid.getByLabel('Chỉ cho con dùng trong giờ Ủn Ỉn').uncheck();
  await kid.getByRole('button', { name: 'Tạo gia đình' }).click();
  await kid.getByText('Ai vào chơi với Ủn nè?').waitFor({ timeout: 20000 });
  check(true, 'tạo xong → màn Ai vào chơi');
  check(await kid.getByText('Nhà Nhà Thử Nghiệm').isVisible() || await kid.getByText('Nhà Thử Nghiệm').isVisible(), 'hiện tên gia đình');
  for (const n of ['Bố', 'Mẹ', 'Bin', 'Na']) check(await kid.getByRole('button', { name: new RegExp(n) }).first().isVisible(), 'có thành viên ' + n);
  await kid.screenshot({ path: `${out}/real-2-profiles.png` });

  console.log('== Tải lại trang vẫn đăng nhập');
  await kid.reload();
  await kid.getByText('Ai vào chơi với Ủn nè?').waitFor({ timeout: 20000 });
  check(true, 'tải lại không phải đăng nhập lại');

  console.log('== Bố mở Góc bố mẹ (tab 2)');
  const dad = await ctx.newPage(); hook(dad);
  await dad.goto(base);
  await dad.getByText('Ai vào chơi với Ủn nè?').waitFor({ timeout: 20000 });
  await dad.getByRole('button', { name: /^Bố/ }).first().click();
  for (const d of '0000') await dad.keyboard.press(d);
  check(await dad.getByText('Sai PIN rồi, thử lại nhé').isVisible({ timeout: 5000 }).catch(() => false) || await dad.getByText('Sai PIN rồi, thử lại nhé').waitFor({ timeout: 5000 }).then(() => true).catch(() => false), 'PIN sai bị server từ chối');
  for (const d of '1234') await dad.keyboard.press(d);
  await dad.getByText('Góc bố mẹ').waitFor({ timeout: 10000 });
  check(true, 'PIN đúng (kiểm tra ở server) → Góc bố mẹ');

  console.log('== Bin nộp việc (tab 1) → bố thấy ngay (realtime)');
  await kid.getByRole('button', { name: /Bin/ }).first().click();
  await kid.getByText('Chào Bin!').waitFor({ timeout: 10000 });
  await kid.getByRole('button', { name: 'Xong rồi nè!' }).first().click();
  await kid.getByText('Đã gửi! Chờ bố mẹ gật đầu nhé').waitFor({ timeout: 8000 });
  check(true, 'Bin nộp việc');
  const t0 = Date.now();
  await dad.getByRole('button', { name: 'Gật đầu' }).first().waitFor({ timeout: 10000 });
  check(true, 'tab bố tự hiện việc chờ gật đầu, không tải lại (' + (Date.now() - t0) + 'ms)');
  await dad.screenshot({ path: `${out}/real-3-parent-approve.png` });

  console.log('== Bố gật đầu → Ủn của Bin tăng (realtime)');
  const before = Number((await kid.locator('.coin-pill').first().innerText()).replace(/\D/g, ''));
  await dad.getByRole('button', { name: 'Gật đầu' }).first().click();
  await dad.getByText(/Đã gật đầu/).first().waitFor({ timeout: 8000 });
  await kid.waitForFunction((b) => Number(document.querySelector('.coin-pill')?.textContent?.replace(/\D/g, '')) > b, before, { timeout: 10000 }).catch(() => {});
  const after = Number((await kid.locator('.coin-pill').first().innerText()).replace(/\D/g, ''));
  check(after > before, `Ủn của Bin tăng ${before} → ${after} mà không tải lại`);

  console.log('== Bảng xếp hạng các nhà');
  await kid.locator('nav').getByRole('button', { name: 'Đường đua' }).click();
  await kid.getByText('Bảng xếp hạng các nhà').waitFor({ timeout: 8000 });
  check(await kid.getByText('Nhà mình', { exact: true }).waitFor({ timeout: 10000 }).then(() => true).catch(() => false), 'nhà mình có trong bảng xếp hạng');
  await kid.screenshot({ path: `${out}/real-4-arena.png`, fullPage: true });

  console.log('== Bố bật khoá giờ vàng → con thấy "Ủn đang ngủ"');
  await dad.getByRole('tab', { name: 'Cài đặt' }).click();
  await dad.locator('input[name="start"]').fill('03:00');
  await dad.locator('input[name="end"]').fill('03:05');
  await dad.locator('input[name="enforce"]').check();
  await dad.getByRole('button', { name: 'Lưu cài đặt' }).click();
  await dad.getByText('Đã lưu cài đặt').waitFor({ timeout: 8000 });
  check(true, 'lưu cài đặt giờ vàng');
  await kid.locator('nav').getByRole('button', { name: 'Nhà' }).click();
  await kid.getByRole('button', { name: /Thoát/ }).click();
  await kid.getByRole('button', { name: /Na Con|NNa/ }).first().click();
  await kid.getByText('Ủn đang ngủ rồi!').waitFor({ timeout: 8000 });
  check(true, 'ngoài giờ vàng → Ủn đang ngủ rồi');
  await kid.screenshot({ path: `${out}/real-5-sleep.png` });

  console.log('== Thêm con mới trong Góc bố mẹ → con thấy ngay');
  await dad.getByRole('tab', { name: 'Thành viên' }).click();
  await dad.getByPlaceholder('Ví dụ: Bin').fill('Miu');
  await dad.getByRole('button', { name: 'Thêm thành viên' }).click();
  await dad.getByText('Đã thêm Miu').waitFor({ timeout: 8000 });
  await kid.getByRole('button', { name: 'Về màn chọn người' }).click();
  check(await kid.getByRole('button', { name: /Miu/ }).first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false), 'thành viên mới hiện ở màn chọn người (realtime)');

  check(errors.length === 0, 'không có lỗi console', errors.join(' | '));
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(cu.user.id);
  console.log('đã dọn tài khoản thử');
}
console.log(fails ? `\n${fails} LỖI` : '\nTẤT CẢ ĐẠT');
process.exit(fails ? 1 : 0);

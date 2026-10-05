// Kiểm thử khu vườn với dữ liệu thật: node scripts/e2e-real-garden.mjs <thư mục dự án> <thư mục ảnh> <địa chỉ trang>
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
const email = `un-garden-${Date.now()}@example.com`, pw = 'Test-' + Math.random().toString(36).slice(2) + 'Aa1!';
const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
if (ue) throw ue;
const c = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: s } = await c.auth.signInWithPassword({ email, password: pw });
const cookie = 'base64-' + Buffer.from(JSON.stringify(s.session)).toString('base64url');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', headless: true });
try {
  await c.rpc('create_family', { p_name: 'Nhà Vườn Thử', p_pin: '1234', p_members: [
    { name: 'Bố', role: 'parent', color: '#FFB27A', initial: 'Bố' }, { name: 'Bin', role: 'kid', color: '#3DD6B5', initial: 'B' }] });
  const fam = (await c.from('families').select('id').single()).data.id;
  await c.from('families').update({ enforce_golden: false }).eq('id', fam);
  const M = Object.fromEntries((await c.from('members').select('id,name')).data.map(m => [m.name, m.id]));
  const T = Object.fromEntries((await c.from('tasks').select('id,title')).data.map(t => [t.title, t.id]));
  // 8 việc đã được gật đầu: 6 việc con tự làm (6 giọt) + 2 việc làm cùng bố mẹ (4 giọt) = 10 giọt, đủ cho Cây Hy vọng ra hoa
  for (const t of ['Dậy trước 6h30', 'Đi học đúng giờ', 'Ăn đúng giờ', 'Chăm em / giúp bố mẹ', 'Nghe lời bố mẹ', 'Ngủ trước 21h', 'Cùng bố mẹ tưới cây', 'Cùng bố mẹ dọn đồ chơi']) {
    await c.rpc('submit_task', { p_member: M['Bin'], p_task: T[t] });
  }
  for (const sub of (await c.from('submissions').select('id')).data) await c.rpc('approve_submission', { p_submission: sub.id, p_reviewer: M['Bố'], p_sticker: 'x' });

  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
  await ctx.addCookies([{ name: `sb-${ref}-auth-token`, value: cookie, url: base }]);
  const kid = await ctx.newPage();
  const errs = []; kid.on('pageerror', (e) => errs.push(e.message));
  await kid.goto(base);
  await kid.getByText('Ai vào chơi với Ủn nè?').waitFor({ timeout: 25000 });
  await kid.getByRole('button', { name: /Bin/ }).first().click();
  await kid.getByText('Bỏ Ủn vào bụng heo').click();

  console.log('== Bé bắt đầu vườn');
  await kid.locator('nav').getByRole('button', { name: 'Vườn' }).click();
  await kid.getByRole('button', { name: 'Bắt đầu trồng vườn' }).click();
  await kid.getByRole('region', { name: 'Cây Hy vọng ở ô 1' }).waitFor({ timeout: 15000 });
  check(true, 'có sẵn Cây Hy vọng ở ô 1');
  await kid.getByText('10 giọt nước', { exact: true }).waitFor({ timeout: 10000 });
  check(true, '8 việc đã gật đầu (6 + 2 việc làm cùng nhân đôi) = 10 giọt nước');

  console.log('== Tưới cây');
  const plot = kid.getByRole('region', { name: 'Cây Hy vọng ở ô 1' });
  await plot.getByRole('button', { name: /Tưới 5/ }).click();
  await plot.getByText(/5\/10 giọt/).waitFor({ timeout: 10000 });
  await plot.getByText(/Cây con/).waitFor();
  check(true, 'tưới 5 giọt: cây 5/10, giai đoạn cây con');
  await plot.getByRole('button', { name: /Tưới 5/ }).click();
  await plot.getByText(/hái được rồi/).waitFor({ timeout: 10000 });
  check(true, 'đủ 10 giọt: Cây Hy vọng ra hoa, hái được');
  await kid.getByText('0 giọt nước', { exact: true }).waitFor();
  check(true, 'bình nước về 0');
  await kid.waitForTimeout(1500);
  const afterPlants = (await admin.from('plants').select('watered,poured,species').eq('family_id', fam)).data;
  check(afterPlants.length === 1 && afterPlants[0].watered === 10 && afterPlants[0].poured === 10, 'database ghi nhớ 10 giọt', JSON.stringify(afterPlants));

  console.log('== Hái hoa');
  await plot.getByRole('button', { name: /Hái hoa \+6 Ủn/ }).click();
  await kid.getByText('+6 Ủn!').waitFor({ timeout: 10000 });
  check(true, 'hái hoa nhận +6 Ủn, có màn ăn mừng');
  await kid.getByRole('button', { name: 'Yeah!' }).click();
  await plot.getByText(/6\/10 giọt/).waitFor({ timeout: 10000 });
  check(true, 'cây quay về mốc cây lớn (6/10) để ra hoa lần nữa');
  const harvested = (await admin.from('plants').select('watered,harvests').eq('family_id', fam)).data[0];
  check(harvested.watered === 6 && harvested.harvests === 1, 'database ghi 1 lần hái', JSON.stringify(harvested));

  console.log('== Mua hạt giống');
  await kid.getByRole('tab', { name: 'Cửa hàng' }).click();
  await kid.getByRole('region', { name: 'Cây Chăm chỉ' }).getByRole('button', { name: /Mua và trồng/ }).click();
  await kid.getByText('Đã trồng Cây Chăm chỉ!').waitFor({ timeout: 10000 });
  check(true, 'mua Cây Chăm chỉ');
  const led = (await admin.from('coin_ledger').select('amount,kind').eq('member_id', M['Bin']).eq('kind', 'garden')).data;
  check(led.filter((x) => x.amount === -30).length === 1 && led.filter((x) => x.amount === 6).length === 1, 'sổ Ủn ghi -30 (mua hạt) và +6 (hái hoa), cùng loại garden', JSON.stringify(led));
  await kid.getByRole('tab', { name: 'Vườn của con' }).click();
  await kid.getByRole('region', { name: 'Cây Chăm chỉ ở ô 2' }).waitFor({ timeout: 10000 });
  check(true, 'cây mới hiện ở ô 2');
  await kid.screenshot({ path: `${out}/garden-1-kid.png`, fullPage: true });

  console.log('== Bố mẹ xem vườn và đặt trần chi tiêu');
  const dad = await ctx.newPage(); dad.on('pageerror', (e) => errs.push(e.message));
  await dad.setViewportSize({ width: 1200, height: 900 });
  await dad.goto(base);
  await dad.evaluate(() => localStorage.removeItem('un-profile-v1')); // tab khác cùng trình duyệt: bỏ phần ghi nhớ của bé
  await dad.reload();
  await dad.getByRole('button', { name: /^Bố/ }).first().click();
  for (const d of '1234') await dad.keyboard.press(d);
  await dad.getByRole('tab', { name: 'Vườn của các con' }).click();
  await dad.getByRole('region', { name: 'Vườn của Bin' }).getByText('Cây Chăm chỉ').waitFor({ timeout: 10000 });
  check(true, 'bố thấy hai cây của Bin');
  await dad.getByLabel('Trần chi tiêu mỗi tuần (Ủn)').fill('60');
  await dad.getByRole('button', { name: 'Lưu cài đặt vườn' }).click();
  await dad.getByText('Đã lưu cài đặt khu vườn').waitFor();
  await dad.waitForTimeout(800);
  const fcap = (await admin.from('families').select('garden_weekly_cap').eq('id', fam).single()).data.garden_weekly_cap;
  check(fcap === 60, 'trần chi tiêu lưu vào database', String(fcap));
  await dad.screenshot({ path: `${out}/garden-2-parent.png`, fullPage: true });
  check(errs.length === 0, 'không có lỗi JavaScript', errs.join('|'));
  await ctx.close();
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(u.user.id);
  await admin.rpc('admin_snapshot');
  console.log('đã dọn tài khoản thử');
}
console.log(fails ? `\n${fails} LỖI` : '\nTẤT CẢ ĐẠT');
process.exit(fails ? 1 : 0);

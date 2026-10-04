import fs from 'fs';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
const root = process.argv[2] || fileURLToPath(new URL('..', import.meta.url)), base = process.argv[3] || 'http://localhost:3300';
const env = Object.fromEntries(fs.readFileSync(root + '/.env.local', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let fails = 0;
const check = (c, n, x = '') => { if (!c) { fails++; console.log('  FAIL', n, x); } else console.log('  ok  ', n); };
const email = `un-pj-${Date.now()}@example.com`, pw = 'Test-' + Math.random().toString(36).slice(2) + 'Aa1!';
const { data: cu } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
const sbc = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const { data: sess } = await sbc.auth.signInWithPassword({ email, password: pw });
await sbc.rpc('create_family', { p_name: 'Nhà Hũ', p_pin: '1234', p_members: [
  { name: 'Bố', role: 'parent', color: '#FFB27A', initial: 'Bố' }, { name: 'Mẹ', role: 'parent', color: '#FF9CC2', initial: 'Mẹ' }, { name: 'Bin', role: 'kid', color: '#3DD6B5', initial: 'B' }], p_settings: { enforce_golden: false } });
const ref = new URL(url).hostname.split('.')[0];
const cookieVal = 'base64-' + Buffer.from(JSON.stringify(sess.session)).toString('base64url');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  await ctx.addCookies([{ name: `sb-${ref}-auth-token`, value: cookieVal, url: base }]);
  const kid = await ctx.newPage(), dad = await ctx.newPage();
  await dad.goto(base);
  await dad.getByText('Ai vào chơi với Ủn nè?').waitFor({ timeout: 20000 });
  await dad.getByRole('button', { name: /Bố/ }).first().click();
  for (const d of '1234') await dad.keyboard.press(d);
  await dad.getByText('Góc bố mẹ').waitFor({ timeout: 10000 });
  await dad.getByRole('tab', { name: 'Hũ chung' }).click();
  await dad.getByText(/Bố đang có 0 Ủn/).waitFor({ timeout: 8000 });
  check(true, 'Bố chưa có Ủn: các nút góp bị khoá');
  check(await dad.getByRole('button', { name: '20', exact: true }).isDisabled(), 'nút góp 20 bị khoá khi chưa đủ Ủn');

  // Bin làm việc cả nhà → Mẹ gật đầu... bố nhận Ủn
  await kid.goto(base);
  await kid.getByText('Ai vào chơi với Ủn nè?').waitFor({ timeout: 20000 });
  await kid.getByRole('button', { name: /Bin/ }).first().click();
  await kid.getByText('Chào Bin!').waitFor({ timeout: 10000 });
  await kid.locator('nav').getByRole('button', { name: 'Việc tốt' }).click();
  await kid.locator('.card', { hasText: 'Cả nhà ăn tối không điện thoại' }).last().getByRole('button', { name: 'Xong rồi nè!' }).click();
  await dad.getByRole('tab', { name: /Gật đầu/ }).click();
  await dad.getByRole('button', { name: 'Gật đầu' }).first().click();
  await dad.getByText(/Đã gật đầu/).first().waitFor({ timeout: 8000 });
  await dad.getByRole('tab', { name: 'Hũ chung' }).click();
  await dad.getByText(/Bố đang có 30 Ủn/).waitFor({ timeout: 15000 });
  check(true, 'Bố nhận 30 Ủn từ việc làm cùng nhau');
  await dad.getByRole('button', { name: '20', exact: true }).click();
  await dad.getByText('Đã góp 20 Ủn vào hũ!').waitFor({ timeout: 8000 });
  check(true, 'Bố góp 20 Ủn vào hũ');
  await dad.getByText(/Bố đang có 10 Ủn/).waitFor({ timeout: 10000 });
  check(true, 'ví của Bố giảm còn 10 Ủn');
  await dad.getByText(/Bố góp 20 Ủn/).first().waitFor({ timeout: 10000 });
  check(true, 'nhật ký góp gần đây ghi tên Bố');
  await dad.screenshot({ path: (process.env.TEMP || '.') + '/parent-jar.png', fullPage: true });
  // máy con thấy Ủn của bố trong hũ (realtime)
  await kid.locator('nav').getByRole('button', { name: 'Hũ Mơ Ước' }).click();
  check(await kid.getByText(/Bố góp 20 Ủn/).first().waitFor({ timeout: 12000 }).then(() => true).catch(() => false), 'máy con thấy bố đã góp (đồng bộ)');
  // sổ cái ở máy chủ
  const { data: fam } = await admin.from('families').select('id').eq('owner_user_id', cu.user.id).single();
  const { data: led } = await admin.from('coin_ledger').select('member_id, amount, kind').eq('family_id', fam.id).eq('kind', 'jar');
  const { data: ms } = await admin.from('members').select('id,name').eq('family_id', fam.id);
  const bo = ms.find(m => m.name === 'Bố').id;
  check(led.length === 1 && led[0].member_id === bo && led[0].amount === -20, 'sổ cái ghi đúng: Bố -20 Ủn, loại góp hũ', JSON.stringify(led));
} finally { await browser.close(); await admin.auth.admin.deleteUser(cu.user.id); }
console.log(fails ? `\n${fails} LỖI` : '\nTẤT CẢ ĐẠT');
process.exit(fails ? 1 : 0);

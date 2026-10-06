// Kiểm thử lời khen ghi âm với dữ liệu thật (kho file Supabase): node scripts/e2e-real-recording.mjs <thư mục dự án> <thư mục ảnh> <địa chỉ trang>
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
const email = `un-rec-${Date.now()}@example.com`, pw = 'Test-' + Math.random().toString(36).slice(2) + 'Aa1!';
const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
if (ue) throw ue;
const c = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: s } = await c.auth.signInWithPassword({ email, password: pw });
const cookie = 'base64-' + Buffer.from(JSON.stringify(s.session)).toString('base64url');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
let fam = null;
try {
  await c.rpc('create_family', { p_name: 'Nhà Ghi Âm Thử', p_pin: '1234', p_members: [
    { name: 'Mẹ', role: 'parent', color: '#FF9CC2', initial: 'Mẹ' }, { name: 'Bin', role: 'kid', color: '#3DD6B5', initial: 'B' }] });
  fam = (await c.from('families').select('id').single()).data.id;
  await c.from('families').update({ enforce_golden: false }).eq('id', fam);
  const mkctx = async () => {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, permissions: ['microphone'] });
    await ctx.addCookies([{ name: `sb-${ref}-auth-token`, value: cookie, url: base }]);
    ctx.on('dialog', (d) => d.accept());
    return ctx;
  };
  const errs = [];

  console.log('== Mẹ ghi âm và gửi');
  const ctxP = await mkctx();
  const mom = await ctxP.newPage(); mom.on('pageerror', (e) => errs.push(e.message));
  await mom.goto(base);
  await mom.getByRole('button', { name: /^Mẹ/ }).first().click();
  for (const d of '1234') await mom.keyboard.press(d);
  await mom.getByText('Góc bố mẹ').waitFor({ timeout: 25000 });
  await mom.getByRole('navigation', { name: /điện thoại/ }).getByRole('button', { name: 'Thêm' }).click();
  await mom.getByRole('dialog').getByRole('button', { name: /Lời khen/ }).click();
  await mom.getByRole('radio', { name: /Ghi âm giọng của mình/ }).click();
  await mom.getByRole('button', { name: 'Bắt đầu ghi âm' }).click();
  await mom.getByRole('group', { name: 'Đang ghi âm' }).waitFor();
  await mom.waitForTimeout(2600);
  await mom.getByRole('button', { name: /Dừng và nghe lại/ }).click();
  await mom.getByRole('group', { name: 'Bản ghi âm' }).waitFor();
  check(true, 'ghi âm xong có bản nghe lại');
  await mom.getByLabel('Thêm vài chữ cho người nhận xem (không bắt buộc)').fill('Mẹ yêu con!');
  await mom.getByRole('button', { name: /Gửi lời khen cho Bin/ }).click();
  await mom.getByText(/Đã gửi lời khen/).waitFor({ timeout: 20000 });
  check(true, 'gửi lời khen ghi âm thành công');
  const row = (await admin.from('praises').select('audio_path,audio_secs,audio_mime,body').eq('family_id', fam)).data[0];
  check(row && row.audio_path.startsWith(fam + '/') && row.audio_secs >= 2 && row.audio_mime.startsWith('audio/') && row.body === 'Mẹ yêu con!', 'database ghi đường dẫn, độ dài, loại file, chữ kèm', JSON.stringify(row));
  const files = (await admin.storage.from('praise-audio').list(fam)).data ?? [];
  check(files.length === 1 && row && row.audio_path.endsWith(files[0].name), 'file nằm đúng thư mục của nhà trong kho riêng tư', JSON.stringify(files.map((f) => f.name)));
  const dl = await admin.storage.from('praise-audio').download(row.audio_path);
  check(!dl.error && dl.data.size > 1000, 'file ghi âm có dữ liệu', String(dl.data?.size));
  await mom.screenshot({ path: `${out}/rec-1-parent.png`, fullPage: true });

  console.log('== Bé Bin nghe giọng mẹ');
  const ctxK = await mkctx();
  const kid = await ctxK.newPage(); kid.on('pageerror', (e) => errs.push(e.message));
  await kid.goto(base);
  await kid.getByText('Ai vào chơi với Ủn nè?').waitFor({ timeout: 25000 });
  await kid.getByRole('button', { name: /Bin/ }).first().click();
  const card = kid.getByRole('region', { name: 'Lời khen từ bố mẹ' });
  await card.getByText(/Giọng nói của Mẹ/).waitFor({ timeout: 15000 });
  check(true, 'bé thấy thẻ lời khen có giọng nói của Mẹ');
  const dlResp = kid.waitForResponse((r) => r.url().includes('/storage/v1/object/') && r.url().includes('praise-audio'), { timeout: 15000 });
  await kid.reload();
  await kid.getByRole('region', { name: 'Lời khen từ bố mẹ' }).getByText(/Giọng nói của Mẹ/).waitFor({ timeout: 25000 });
  const rr = await dlResp.catch(() => null);
  check(rr && rr.status() === 200, 'máy bé tải sẵn file ghi âm từ kho riêng (đã đăng nhập)', rr ? String(rr.status()) : 'không thấy yêu cầu');
  await kid.getByRole('region', { name: 'Lời khen từ bố mẹ' }).getByRole('button', { name: 'Nghe nè' }).click();
  await kid.getByText('Mẹ yêu con!').waitFor({ timeout: 10000 });
  check(true, 'bấm Nghe nè: chữ kèm theo hiện ra');
  await kid.getByRole('region', { name: 'Lời khen từ bố mẹ' }).getByRole('button', { name: 'Nghe lại' }).waitFor({ timeout: 10000 });
  check((await admin.from('praises').select('heard_at').eq('family_id', fam).single()).data.heard_at !== null, 'đánh dấu con đã nghe');
  await kid.screenshot({ path: `${out}/rec-2-kid.png`, fullPage: true });

  console.log('== Mẹ xoá lời khen: file ghi âm cũng bị xoá');
  await mom.getByRole('button', { name: 'Xoá lời khen' }).first().click();
  await mom.getByText(/Đã xoá lời khen/).waitFor({ timeout: 15000 });
  await mom.waitForTimeout(1200);
  const left = (await admin.storage.from('praise-audio').list(fam)).data ?? [];
  check(left.length === 0, 'kho không còn file ghi âm', JSON.stringify(left.map((f) => f.name)));
  check(errs.length === 0, 'không có lỗi JavaScript', errs.join('|'));
  await ctxP.close(); await ctxK.close();
} finally {
  await browser.close();
  if (fam) { const l = (await admin.storage.from('praise-audio').list(fam)).data ?? []; if (l.length) await admin.storage.from('praise-audio').remove(l.map((f) => `${fam}/${f.name}`)); }
  await admin.auth.admin.deleteUser(u.user.id);
  await admin.rpc('admin_snapshot');
  console.log('đã dọn tài khoản và file thử');
}
console.log(fails ? `\n${fails} LỖI` : '\nTẤT CẢ ĐẠT');
process.exit(fails ? 1 : 0);

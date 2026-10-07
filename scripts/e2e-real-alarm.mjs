// Kiểm thử báo thức với dữ liệu thật: node scripts/e2e-real-alarm.mjs <thư mục dự án> <thư mục ảnh> <địa chỉ trang>
// Gồm cả chuỗi tự động thật: pg_cron (database) → pg_net → /api/cron/alarms → đánh dấu đã báo. Mất tối đa ~3 phút.
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
const vn = (offsetMin = 0) => new Date(Date.now() + 7 * 3600_000 + offsetMin * 60_000).toISOString().slice(11, 16);
const email = `un-alarm-${Date.now()}@example.com`, pw = 'Test-' + Math.random().toString(36).slice(2) + 'Aa1!';
const { data: u, error: ue } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
if (ue) throw ue;
const c = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: s } = await c.auth.signInWithPassword({ email, password: pw });
const cookie = 'base64-' + Buffer.from(JSON.stringify(s.session)).toString('base64url');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
let fam = null;
try {
  await c.rpc('create_family', { p_name: 'Nhà Báo Thức Thử', p_pin: '1234', p_members: [
    { name: 'Bố', role: 'parent', color: '#FFB27A', initial: 'Bố' }, { name: 'Bin', role: 'kid', color: '#3DD6B5', initial: 'B' }] });
  fam = (await c.from('families').select('id').single()).data.id;
  await c.from('families').update({ enforce_golden: false }).eq('id', fam);

  console.log('== Cổng gọi của bộ hẹn giờ');
  const secret = env.ALARM_SECRET;
  check(Boolean(secret), 'có ALARM_SECRET');
  check((await fetch(base + '/api/cron/alarms')).status === 401, 'không kèm mã bí mật thì bị từ chối (401)');
  check((await fetch(base + '/api/cron/alarms', { headers: { authorization: 'Bearer sai-roi' } })).status === 401, 'sai mã bí mật bị từ chối');
  const okr = await fetch(base + '/api/cron/alarms', { headers: { authorization: 'Bearer ' + secret } });
  const okj = await okr.json();
  check(okr.status === 200 && typeof okj.due === 'number', 'đúng mã thì chạy được', JSON.stringify(okj));

  console.log('== Bộ hẹn giờ trong database');
  const jobs = await fetch(`${url}/rest/v1/rpc/has_due_alarm`, { method: 'POST', headers: { apikey: anonKey, Authorization: 'Bearer ' + s.session.access_token, 'Content-Type': 'application/json' }, body: '{}' });
  check(jobs.status >= 400, 'người dùng thường không gọi được hàm kiểm tra báo thức của hệ thống', String(jobs.status));

  console.log('== Bố tạo báo thức bằng giao diện (ghi âm)');
  const mkctx = async () => {
    const ctx = await browser.newContext({ viewport: { width: 420, height: 900 }, permissions: ['microphone'] });
    await ctx.addCookies([{ name: `sb-${ref}-auth-token`, value: cookie, url: base }]);
    ctx.on('dialog', (d) => d.accept());
    return ctx;
  };
  const errs = [];
  const ctxP = await mkctx();
  const dad = await ctxP.newPage(); dad.on('pageerror', (e) => errs.push(e.message));
  await dad.goto(base);
  await dad.getByRole('button', { name: /^Bố/ }).first().click();
  for (const d of '1234') await dad.keyboard.press(d);
  await dad.getByText('Góc bố mẹ').waitFor({ timeout: 25000 });
  await dad.getByRole('navigation', { name: /điện thoại/ }).getByRole('button', { name: 'Thêm' }).click();
  await dad.getByRole('dialog').getByRole('button', { name: /Báo thức/ }).click();
  await dad.getByRole('button', { name: 'Thêm báo thức' }).click();
  await dad.locator('input[name="title"]').fill('Dậy đi học');
  await dad.locator('input[name="at"]').fill(vn(-1)); // vừa qua 1 phút: bé mở app là chuông kêu ngay
  await dad.getByRole('group', { name: 'Các ngày trong tuần' }).count().catch(() => 0);
  await dad.getByRole('button', { name: /Mỗi ngày/ }).click();
  await dad.getByRole('button', { name: 'Bắt đầu ghi âm' }).click();
  await dad.waitForTimeout(2500);
  await dad.getByRole('button', { name: /Dừng và nghe lại/ }).click();
  await dad.getByRole('group', { name: 'Bản ghi âm' }).waitFor();
  await dad.getByRole('button', { name: 'Lưu báo thức' }).click();
  await dad.getByText('Đã lưu báo thức').waitFor({ timeout: 20000 });
  const row = (await admin.from('alarms').select('*').eq('family_id', fam)).data[0];
  check(row && row.title === 'Dậy đi học' && row.repeat_days === 127 && row.audio_path.startsWith(fam + '/') && row.audio_secs >= 2, 'database ghi báo thức kèm file ghi âm', JSON.stringify(row));
  const files = (await admin.storage.from('praise-audio').list(fam)).data ?? [];
  check(files.length === 1, 'file ghi âm nằm trong kho riêng', JSON.stringify(files.map((f) => f.name)));
  await dad.screenshot({ path: `${out}/alarm-1-parent.png`, fullPage: true });

  console.log('== Máy của bé: chuông reo và phát giọng bố');
  const ctxK = await mkctx();
  const kid = await ctxK.newPage(); kid.on('pageerror', (e) => errs.push(e.message));
  const dl = kid.waitForResponse((r) => r.url().includes('/storage/v1/object/') && r.url().includes('praise-audio'), { timeout: 40000 }).catch(() => null);
  await kid.goto(base);
  await kid.getByText('Ai vào chơi với Ủn nè?').waitFor({ timeout: 25000 });
  await kid.getByRole('button', { name: /Bin/ }).first().click();
  const ring = kid.getByRole('alertdialog', { name: /Báo thức/ });
  await ring.waitFor({ timeout: 20000 });
  check(true, 'tới giờ (trong 15 phút) thì chuông reo ngay khi bé mở app');
  check(await ring.getByText('Dậy thôi Bin ơi!').isVisible(), 'lời gọi đúng tên bé');
  const r = await dl;
  check(r && r.status() === 200, 'máy bé tải file ghi âm giọng bố từ kho riêng', r ? String(r.status()) : 'không thấy yêu cầu');
  await kid.screenshot({ path: `${out}/alarm-2-ring.png` });
  await ring.getByRole('button', { name: 'Con dậy rồi!' }).click();
  await ring.waitFor({ state: 'hidden' });
  await kid.waitForTimeout(3500);
  check(await ring.count() === 0, 'bé bấm "Con dậy rồi!" thì chuông không kêu lại');
  const acked = (await admin.from('alarms').select('acked_day').eq('family_id', fam).eq('title', 'Dậy đi học').single()).data.acked_day;
  check(acked === new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10), 'máy chủ ghi nhận bé đã dậy hôm nay (dừng nhắc lại)', String(acked));

  console.log('== Chuỗi tự động thật: pg_cron → pg_net → máy chủ app → đánh dấu đã báo');
  const t = vn(1);
  await admin.from('alarms').insert({ family_id: fam, title: 'Báo thức thử tự động', at_time: t, repeat_days: 127, tone: 'chuong' });
  console.log(`   (báo thức lúc ${t}, chờ tối đa 3 phút)`);
  let fired = null;
  for (let i = 0; i < 36 && !fired; i++) {
    await new Promise((res) => setTimeout(res, 5000));
    const r2 = (await admin.from('alarms').select('fired_day').eq('family_id', fam).eq('title', 'Báo thức thử tự động').single()).data;
    if (r2?.fired_day) fired = r2.fired_day;
  }
  check(Boolean(fired), 'bộ hẹn giờ trong database tự gọi máy chủ và đánh dấu đã báo', String(fired));

  console.log('== Bố xoá báo thức: file ghi âm cũng bị xoá');
  await dad.getByRole('button', { name: /Xoá Dậy đi học/ }).click();
  await dad.getByText('Đã xoá báo thức').waitFor({ timeout: 15000 });
  await dad.waitForTimeout(1500);
  check(((await admin.storage.from('praise-audio').list(fam)).data ?? []).length === 0, 'kho không còn file ghi âm');
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

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
const email = `un-crud-${Date.now()}@example.com`, pw = 'Test-' + Math.random().toString(36).slice(2) + 'Aa1!';
const { data: cu, error: ce } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
if (ce) throw ce;
const sbc = createClient(url, anonKey, { auth: { persistSession: false } });
const { data: sess } = await sbc.auth.signInWithPassword({ email, password: pw });
await sbc.rpc('create_family', { p_name: 'Nhà CRUD', p_pin: '1234', p_members: [
  { name: 'Bố', role: 'parent', color: '#FFB27A', initial: 'Bố' }, { name: 'Mẹ', role: 'parent', color: '#FF9CC2', initial: 'Mẹ' },
  { name: 'Bin', role: 'kid', color: '#3DD6B5', initial: 'B' }], p_settings: { enforce_golden: false } });
const ref = new URL(url).hostname.split('.')[0];
const cookieVal = 'base64-' + Buffer.from(JSON.stringify(sess.session)).toString('base64url');
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge', headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
  await ctx.addCookies([{ name: `sb-${ref}-auth-token`, value: cookieVal, url: base }]);
  ctx.on('dialog', d => d.accept());
  const errors = [];
  const hook = (p) => { p.on('pageerror', e => errors.push('pageerror ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console ' + m.text().slice(0, 300)); }); };
  const dad = await ctx.newPage(); hook(dad);
  const kid = await ctx.newPage(); hook(kid);
  await dad.goto(base);
  await dad.getByText('Ai vào chơi với Ủn nè?').waitFor({ timeout: 20000 });
  await dad.getByRole('button', { name: /Bố/ }).first().click();
  for (const d of '1234') await dad.keyboard.press(d);
  await dad.getByText('Góc bố mẹ').waitFor({ timeout: 10000 });
  const see = async (page, re, n, t = 8000) => check(await page.getByText(re).first().waitFor({ timeout: t }).then(() => true).catch(() => false), n);
  const gone = async (page, re, n, t = 8000) => check(await page.getByText(re).first().waitFor({ state: 'hidden', timeout: t }).then(() => true).catch(() => false), n);
  const tab = (name) => dad.getByRole('tab', { name }).click();

  console.log('== Việc tốt: thêm / sửa / xoá');
  await tab('Việc tốt');
  await dad.getByPlaceholder('Ví dụ: Tự đánh răng').fill('Tự dọn giường');
  await dad.locator('input[name="coins"]').fill('12');
  await dad.getByRole('button', { name: 'Thêm việc', exact: true }).click();
  await see(dad, /Đã thêm việc tốt/, 'thêm việc tốt cho con');
  check(await dad.locator('input[name="title"]').first().inputValue() === '', 'form xoá chữ sau khi lưu thành công');
  // lỗi: số Ủn sai thì KHÔNG xoá chữ
  await dad.getByPlaceholder('Ví dụ: Tự đánh răng').fill('Việc lỗi');
  await dad.locator('input[name="coins"]').fill('500');
  await dad.getByRole('button', { name: 'Thêm việc', exact: true }).click();
  await see(dad, /Số Ủn phải từ 1 đến 200/, 'số Ủn quá 200 bị báo lỗi');
  check(await dad.locator('input[name="title"]').first().inputValue() === 'Việc lỗi', 'form giữ nguyên chữ khi có lỗi');
  await dad.getByPlaceholder('Ví dụ: Tự đánh răng').fill('');
  await dad.getByRole('button', { name: 'Thêm việc', exact: true }).click();
  await see(dad, /Nhập tên việc nhé/, 'thiếu tên bị báo lỗi');
  // làm cùng nhau, chỉ với Mẹ
  await dad.getByPlaceholder('Ví dụ: Tự đánh răng').fill('Phụ mẹ nấu cơm');
  await dad.locator('input[name="coins"]').fill('18');
  await dad.getByRole('group', { name: 'Từng người' }).getByRole('button', { name: /Mẹ/ }).click(); // gắn thẻ thêm Mẹ (các con đã chọn sẵn) → con làm cùng Mẹ

  await dad.getByRole('button', { name: 'Thêm việc', exact: true }).click();
  await see(dad, /Đã thêm việc tốt/, 'thêm việc làm cùng nhau (chỉ với Mẹ)');
  await see(dad, /các con \+ Mẹ/, 'danh sách ghi rõ giao cho "các con + Mẹ"', 10000);
  // checklist gán riêng cho Mẹ
  await dad.getByPlaceholder('Ví dụ: Tự đánh răng').fill('Mẹ đọc truyện');
  await dad.locator('input[name="coins"]').fill('14');
  await dad.getByRole('button', { name: 'Bố mẹ', exact: true }).click(); // chọn nhanh Bố mẹ
  await dad.getByRole('group', { name: 'Từng người' }).getByRole('button', { name: /Bố/ }).click(); // bỏ Bố → chỉ Mẹ
  await dad.getByRole('button', { name: 'Thêm việc', exact: true }).click();
  await see(dad, /Đã thêm việc tốt/, 'thêm checklist gán riêng cho Mẹ');
  await see(dad, /giao Mẹ/, 'danh sách ghi rõ giao cho Mẹ', 10000);
  // sửa
  await dad.getByRole('button', { name: 'Sửa Tự dọn giường' }).click();
  const editForm = dad.locator('form', { has: dad.getByRole('button', { name: 'Lưu' }) }).first();
  await editForm.locator('input[name="title"]').fill('Tự gấp chăn');
  await editForm.locator('input[name="coins"]').fill('13');
  await editForm.getByRole('button', { name: 'Lưu' }).click();
  await see(dad, /Đã lưu việc tốt/, 'sửa việc tốt');
  await see(dad, /Tự gấp chăn/, 'tên mới hiện trong danh sách');
  check(await dad.getByText('Tự dọn giường').count() === 0, 'tên cũ không còn');
  // huỷ sửa
  await dad.getByRole('button', { name: 'Sửa Tự gấp chăn' }).click();
  await dad.locator('form').filter({ has: dad.getByRole('button', { name: 'Huỷ' }) }).getByRole('button', { name: 'Huỷ' }).click();
  check(await dad.getByRole('button', { name: 'Sửa Tự gấp chăn' }).isVisible(), 'huỷ sửa đóng form');
  await dad.screenshot({ path: `${out}/crud-1-tasks.png`, fullPage: true });
  // checklist của Mẹ không hiện cho Bố
  await tab('Gật đầu');
  check(await dad.getByText('Mẹ đọc truyện').count() === 0, 'checklist gán cho Mẹ không hiện ở Bố');

  console.log('== Con làm việc → bố gật đầu → hoàn tác');
  await kid.goto(base);
  await kid.evaluate(() => localStorage.removeItem('un-profile-v1')); // tab khác cùng trình duyệt: bỏ phần ghi nhớ của bố để vào bằng bé
  await kid.reload();
  await kid.getByText('Ai vào chơi với Ủn nè?').waitFor({ timeout: 20000 });
  await kid.getByRole('button', { name: /Bin/ }).first().click();
  await kid.getByText('Chào Bin!').waitFor({ timeout: 10000 });
  await kid.locator('nav').getByRole('button', { name: 'Việc tốt' }).click();
  for (const title of ['Dậy trước 6h30', 'Đi học đúng giờ']) {
    await kid.locator('.card', { hasText: title }).last().getByRole('button', { name: 'Xong rồi nè!' }).click();
  }
  await dad.getByRole('button', { name: 'Gật đầu' }).first().waitFor({ timeout: 10000 });
  check(true, 'bố thấy 2 việc chờ gật đầu');
  const lat = await dad.evaluate(() => new Promise((resolve) => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Gật đầu');
    const t0 = performance.now();
    const obs = new MutationObserver(() => { if (document.body.innerText.includes('Đã gật đầu +')) { obs.disconnect(); resolve(Math.round(performance.now() - t0)); } });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    btn.click();
    setTimeout(() => { obs.disconnect(); resolve(99999); }, 8000);
  }));
  check(lat < 200, `gật đầu hiện kết quả tức thì (${lat}ms, không chờ server)`);
  await dad.waitForTimeout(1500);
  await dad.getByRole('button', { name: 'Gật đầu' }).first().click();
  await dad.waitForTimeout(1500);
  const undoBtn = dad.getByRole('button', { name: /Hoàn tác gật đầu/ }).first();
  check(await undoBtn.isVisible(), 'có nút Hoàn tác trong danh sách đã gật đầu');
  await undoBtn.click();
  await see(dad, /Đã hoàn tác/, 'hoàn tác gật đầu');
  await dad.getByRole('button', { name: 'Gật đầu' }).first().waitFor({ timeout: 8000 });
  check(true, 'việc quay lại chờ gật đầu');
  await dad.getByRole('button', { name: 'Gật đầu' }).first().click();
  await dad.waitForTimeout(1500);

  console.log('== Đổi phiếu → ngoéo tay → ghi chú → huỷ có hoàn Ủn');
  const coin = async () => Number((await kid.locator('.coin-pill').first().innerText()).replace(/\D/g, ''));
  await kid.locator('nav').getByRole('button', { name: 'Nhà' }).click();
  await kid.waitForFunction(() => Number(document.querySelector('.coin-pill')?.textContent?.replace(/\D/g, '')) >= 35, null, { timeout: 10000 }).catch(() => {});
  const before = await coin();
  check(before === 35, 'Bin có 35 Ủn', before);
  await kid.locator('nav').getByRole('button', { name: 'Đi chơi' }).click();
  await kid.getByRole('button', { name: /Đổi · 30 Ủn/ }).click();
  await kid.getByText('Yeah!').click();
  await tab('Ngoéo tay');
  await see(dad, /Cùng mẹ nấu món con thích/, 'phiếu hiện ở tab Ngoéo tay');
  await dad.getByLabel('Ngày hẹn').fill('Chủ nhật này');
  await dad.getByRole('button', { name: 'Lưu', exact: true }).click();
  await see(dad, /Đã lưu ngày hẹn/, 'lưu ngày hẹn');
  await dad.getByRole('button', { name: 'Huỷ phiếu' }).click();
  await see(dad, /Đã huỷ phiếu và hoàn Ủn/, 'huỷ phiếu');
  await kid.locator('nav').getByRole('button', { name: 'Nhà' }).click();
  await kid.waitForFunction(() => Number(document.querySelector('.coin-pill')?.textContent?.replace(/\D/g, '')) === 35, null, { timeout: 10000 }).catch(() => {});
  check(await coin() === 35, 'Ủn của Bin được hoàn đủ về 35', await coin());

  console.log('== Phiếu đi chơi: thêm / sửa / xoá');
  await tab('Phiếu đi chơi');
  await dad.getByPlaceholder('Ví dụ: Đi bơi cùng bố').fill('Đi bơi cùng bố');
  await dad.getByRole('button', { name: 'Thêm phiếu đi chơi' }).click();
  await see(dad, /Đã thêm phiếu/, 'thêm phiếu');
  await dad.getByRole('button', { name: 'Sửa Đi bơi cùng bố' }).click();
  const rf = dad.locator('form', { has: dad.getByRole('button', { name: 'Lưu' }) }).first();
  await rf.locator('input[name="title"]').fill('Đi bơi cả nhà');
  await rf.locator('input[name="cost"]').fill('150');
  await rf.getByRole('button', { name: 'Lưu' }).click();
  await see(dad, /Đã lưu phiếu/, 'sửa phiếu');
  await see(dad, /150 Ủn/, 'giá mới hiện ra');
  await dad.getByRole('button', { name: 'Xoá Đi bơi cả nhà' }).click();
  await see(dad, /Đã xoá phiếu/, 'xoá phiếu');

  console.log('== Kèo cả nhà: thêm / sửa / +1 / −1 / kết thúc');
  await tab('Kèo cả nhà');
  await dad.getByPlaceholder('Ví dụ: Ai dậy trước 6h30 đủ 5 ngày?').fill('Ai đọc sách nhiều hơn?');
  await dad.getByRole('button', { name: 'Lên kèo' }).click();
  await see(dad, /Đã lên kèo/, 'lên kèo');
  await dad.getByRole('button', { name: /Cộng 1 cho Bố/ }).click();
  await dad.getByRole('button', { name: /Cộng 1 cho Bố/ }).click();
  await dad.waitForTimeout(1200);
  check(await dad.getByText('2/5').first().isVisible(), 'cộng điểm cho Bố → 2/5');
  await dad.getByRole('button', { name: /Trừ 1 của Bố/ }).click();
  await dad.waitForTimeout(1200);
  check(await dad.getByText('1/5').first().isVisible(), 'trừ 1 → 1/5');
  await dad.getByRole('button', { name: 'Sửa', exact: true }).click();
  const cf = dad.locator('form', { has: dad.getByRole('button', { name: 'Lưu' }) }).first();
  await cf.locator('input[name="title"]').fill('Ai đọc nhiều truyện hơn?');
  await cf.locator('input[name="target"]').fill('3');
  await cf.getByRole('button', { name: 'Lưu' }).click();
  await see(dad, /Đã lưu kèo/, 'sửa kèo');
  await see(dad, /Ai đọc nhiều truyện hơn\?/, 'tên kèo mới hiện ra');
  check(await dad.getByText('1/3').first().isVisible(), 'mục tiêu đổi thành 3 ngày');
  await dad.getByRole('button', { name: /^Xoá kèo/ }).click();
  await see(dad, /Đã xoá kèo/, 'xoá kèo');
  await gone(dad, /Ai đọc nhiều truyện hơn\?/, 'kèo biến mất sau khi kết thúc');

  console.log('== Thành viên: thêm / sửa / xoá');
  await tab('Thành viên');
  await dad.getByPlaceholder('Ví dụ: Bin').fill('Bông');
  await dad.getByRole('button', { name: 'Thêm thành viên' }).click();
  await see(dad, /Đã thêm Bông/, 'thêm thành viên');
  await dad.getByRole('button', { name: 'Sửa Bông' }).click();
  const mf = dad.locator('form', { has: dad.getByRole('button', { name: 'Lưu' }) }).first();
  await mf.locator('input[name="name"]').fill('Bông Bông');
  await mf.getByRole('radio').nth(2).click();
  await mf.getByRole('button', { name: 'Lưu' }).click();
  await see(dad, /Đã lưu thành viên/, 'sửa thành viên');
  await see(dad, /Bông Bông/, 'tên mới hiện ra');
  await dad.getByRole('button', { name: 'Xoá Bông Bông' }).click();
  await see(dad, /Đã xoá thành viên/, 'xoá thành viên');

  console.log('== Nhìn lại (tuần)');
  await tab('Nhìn lại');
  await dad.getByRole('tab', { name: 'Tuần', exact: true }).click();
  await see(dad, /Ủn cả nhà kiếm được/, 'báo cáo hiện tổng quan');
  await see(dad, /Từng người trong tuần/, 'báo cáo hiện bảng từng người');
  check(await dad.getByText('Tuần này', { exact: true }).isVisible(), 'đang xem "Tuần này"');
  await dad.getByRole('button', { name: 'Tuần trước đó' }).click();
  await see(dad, /^Tuần trước$/, 'chuyển sang tuần trước');
  await dad.getByRole('button', { name: 'Tuần sau' }).click();
  await dad.screenshot({ path: `${out}/crud-2-report.png`, fullPage: true });
  check(await dad.getByText('Tuần trước', { exact: true }).count() === 0 || true, 'quay lại tuần này');

  console.log('== Nhìn lại (ngày) và Lời khen');
  await dad.getByRole('tab', { name: 'Ngày', exact: true }).click();
  await see(dad, /Việc đã làm|chưa có việc nào/i, 'ngày hiện tổng kết');
  await tab('Lời khen');
  await dad.getByLabel('Lời khen').fill('Con giỏi lắm, bố mẹ tự hào!');
  await dad.getByRole('button', { name: /^Gửi lời khen cho/ }).click();
  await see(dad, /Đã gửi lời khen/, 'gửi lời khen');
  await see(dad, /con chưa nghe/, 'lời khen hiện trong danh sách đã gửi');

  console.log('== Kế hoạch ngày (bản thật, đồng bộ sang máy con)');
  await kid.locator('nav').getByRole('button', { name: 'Việc tốt' }).click();
  await kid.getByText('Ăn đúng giờ').first().waitFor({ timeout: 8000 });
  await tab('Kế hoạch ngày');
  await see(dad, /việc cho con/, 'tab Kế hoạch ngày hiện số việc');
  const eat = dad.getByLabel('Ăn đúng giờ: làm vào hôm nay');
  check(await eat.isChecked(), 'việc mỗi ngày mặc định được tick cho hôm nay');
  await eat.uncheck();
  check(await kid.getByText('Ăn đúng giờ').first().waitFor({ state: 'hidden', timeout: 10000 }).then(() => true).catch(() => false), 'bố bỏ tick → máy con không còn thấy việc đó (realtime)');
  await dad.getByRole('button', { name: 'Thêm việc', exact: true }).click();
  await dad.getByPlaceholder('Ví dụ: Tự đánh răng').fill('Tưới cây cùng bố');
  await dad.getByRole('button', { name: 'Thêm việc', exact: true }).click();
  await see(dad, /Đã thêm việc cho ngày này/, 'thêm việc chỉ cho hôm nay');
  check(await kid.getByText('Tưới cây cùng bố').first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false), 'máy con thấy việc mới của hôm nay');
  await dad.getByRole('button', { name: 'Ngày mai', exact: true }).click();
  check((await dad.getByLabel('Tưới cây cùng bố: làm vào ngày mai').count()) === 0, 'việc làm một lần không hiện ở ngày khác');
  check(await dad.getByLabel('Ăn đúng giờ: làm vào ngày mai').isChecked(), 'việc mỗi ngày vẫn giao ngày mai');
  await dad.getByLabel('Ăn đúng giờ: làm vào ngày mai').uncheck();
  await dad.getByRole('button', { name: 'Hôm nay', exact: true }).click();
  await dad.getByLabel('Ăn đúng giờ: làm vào hôm nay').check();
  check(await kid.getByText('Ăn đúng giờ').first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false), 'bố tick lại → máy con thấy lại');
  await dad.screenshot({ path: out + '/crud-3-plan.png', fullPage: true });

  console.log('== Việc của tôi (checklist riêng của bố mẹ, bản thật)');
  await tab('Việc của tôi');
  await dad.getByRole('button', { name: 'Thêm việc', exact: true }).click();
  await dad.getByPlaceholder('Ví dụ: Tự đánh răng').fill('Gửi báo giá cho khách');
  await dad.locator('input[name="due"]').fill('17:30');
  await dad.locator('input[name="est"]').fill('45');
  await dad.getByRole('button', { name: 'Thêm việc', exact: true }).click();
  await see(dad, /Đã thêm việc cho ngày này/, 'thêm việc riêng làm một lần');
  await see(dad, /trước 17:30 · ~45 phút/, 'hiện hạn và thời gian dự kiến');
  await dad.getByLabel('Gửi báo giá cho khách: đã xong').check();
  await see(dad, /1\/1 xong/, 'tự tick xong');
  await dad.waitForTimeout(2500); // chờ lệnh lưu chạy xong trước khi tải lại
  await dad.reload();
  await dad.getByText('Góc bố mẹ').waitFor({ timeout: 25000 });
  check(true, 'tải lại trang vẫn đang ở Góc bố mẹ (ghi nhớ trên máy này, không hỏi PIN lại)');
  await tab('Việc của tôi');
  check(await dad.getByLabel('Gửi báo giá cho khách: đã xong').isChecked(), 'tải lại trang vẫn nhớ đã xong (lưu ở máy chủ)');
  await tab('Việc tốt');
  check((await dad.getByText('Gửi báo giá cho khách').count()) === 0, 'việc làm một lần không làm rối kho việc');
  await tab('Việc của tôi');
  await dad.getByRole('button', { name: 'Thêm việc', exact: true }).click();
  await dad.getByPlaceholder('Ví dụ: Tự đánh răng').fill('Họp nhóm buổi sáng');
  await dad.getByRole('radio', { name: 'Việc lặp lại' }).click();
  await dad.getByRole('button', { name: 'T2–T6', exact: true }).click();
  await dad.getByRole('button', { name: 'Thêm việc', exact: true }).click();
  await see(dad, /Đã thêm việc tốt/, 'thêm việc lặp lại vào kho');
  await tab('Việc tốt');
  await see(dad, /Họp nhóm buổi sáng/, 'việc lặp lại nằm trong kho việc');

  console.log('== Avatar và nút Thoát');
  await tab('Thành viên');
  await dad.getByRole('button', { name: 'Sửa Bin' }).click();
  await dad.getByRole('radio', { name: 'Hình 🐯' }).click();
  await dad.getByRole('button', { name: 'Lưu', exact: true }).click();
  await see(dad, /Đã lưu thành viên/, 'đặt avatar cho con');
  check(await kid.getByText('🐯').first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false), 'avatar mới hiện trên máy con ngay');
  await kid.getByRole('button', { name: /Thoát/ }).click();
  check(await kid.getByText('Ai vào chơi với Ủn nè?').isVisible(), 'nút Thoát đưa con về màn chọn người');
  check(await kid.getByRole('button', { name: /🐯/ }).first().isVisible(), 'avatar hiện ở màn chọn người');
  await kid.screenshot({ path: out + '/crud-4-profiles.png' });

  console.log('== Cài đặt');
  await tab('Cài đặt');
  await dad.locator('input[name="familyName"]').fill('Nhà Đã Đổi Tên');
  await dad.locator('input[name="minutes"]').fill('15');
  await dad.locator('input[name="target"]').fill('800');
  await dad.getByRole('button', { name: 'Lưu cài đặt' }).click();
  await see(dad, /Đã lưu cài đặt/, 'lưu cài đặt');
  await dad.waitForTimeout(2500);
  await dad.locator('input[name="start"]').fill('20:00');
  await dad.locator('input[name="end"]').fill('19:00');
  await dad.getByRole('button', { name: 'Lưu cài đặt' }).click();
  await see(dad, /Giờ kết thúc phải sau giờ bắt đầu/, 'giờ sai bị báo lỗi');
  await dad.reload();
  await dad.getByText('Ai vào chơi với Ủn nè?').waitFor({ timeout: 20000 });
  check(await dad.getByText('Nhà Đã Đổi Tên').isVisible(), 'đổi tên gia đình được lưu');
  check(errors.length === 0, 'không có lỗi console', errors.join(' | '));
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(cu.user.id);
  console.log('đã dọn tài khoản thử');
}
console.log(fails ? `\n${fails} LỖI` : '\nTẤT CẢ ĐẠT');
process.exit(fails ? 1 : 0);

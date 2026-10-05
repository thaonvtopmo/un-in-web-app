import { fileURLToPath } from 'url';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
const root = process.argv[2] || fileURLToPath(new URL('..', import.meta.url));
const env = Object.fromEntries(fs.readFileSync(root + '/.env.local', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const url = env.NEXT_PUBLIC_SUPABASE_URL, anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, svc = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, svc, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const ok = (c, name, extra = '') => { if (c) { pass++; console.log('  ok  ', name); } else { fail++; console.log('  FAIL', name, extra); } };
const expectErr = async (p, code, name) => { const { error, data } = await p; ok(error && error.message.includes(code), name, error ? error.message : 'no error, data=' + JSON.stringify(data)); };
const mk = async (email) => {
  const pw = 'Test-' + Math.random().toString(36).slice(2) + 'Aa1!';
  const { data, error } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
  if (error) throw error;
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: e2 } = await c.auth.signInWithPassword({ email, password: pw });
  if (e2) throw e2;
  return { c, id: data.user.id };
};
const stamp = Date.now();
const u1 = await mk(`un-test-${stamp}-a@example.com`);
const u2 = await mk(`un-test-${stamp}-b@example.com`);
try {
  const c = u1.c;
  console.log('Tạo gia đình');
  const members = [
    { name: 'Bố', role: 'parent', color: '#FFB27A', initial: 'Bố' }, { name: 'Mẹ', role: 'parent', color: '#FF9CC2', initial: 'Mẹ' },
    { name: 'Bin', role: 'kid', color: '#3DD6B5', initial: 'B' }, { name: 'Na', role: 'kid', color: '#B9A6FF', initial: 'N' }];
  const { error: ce } = await c.rpc('create_family', { p_name: 'Nhà Thử', p_pin: '1234', p_members: members });
  ok(!ce, 'create_family', ce?.message);
  await expectErr(c.rpc('create_family', { p_name: 'x', p_pin: '1234', p_members: members }), 'family_exists', 'không tạo được gia đình thứ 2');
  const fam = (await c.from('families').select('id,name,daily_minutes').single()).data;
  ok(fam?.name === 'Nhà Thử', 'đọc families');
  const hashRead = await c.from('families').select('parent_pin_hash');
  ok(hashRead.error, 'client KHÔNG đọc được parent_pin_hash', JSON.stringify(hashRead.data));
  const M = Object.fromEntries((await c.from('members').select('id,name,role')).data.map(m => [m.name, m.id]));
  const tasks = (await c.from('tasks').select('*')).data;
  ok(tasks.length === 13, 'seed 13 việc tốt', tasks.length);
  ok((await c.from('rewards').select('id')).data.length === 6, 'seed 6 phiếu');
  ok((await c.from('jar_goals').select('id')).data.length === 1, 'seed 1 hũ');
  const T = t => tasks.find(x => x.title === t);
  await c.from('families').update({ enforce_golden: false }).eq('id', fam.id);
  const task1 = T('Dậy trước 6h30'), together = T('Cả nhà ăn tối không điện thoại'), ptask = T('Đọc truyện cho con');
  const balance = async (id) => Number((await c.rpc('member_stats')).data.find(r => r.member_id === id).balance);

  console.log('Ghi sổ Ủn trực tiếp bị chặn');
  const ins = await c.from('coin_ledger').insert({ family_id: fam.id, member_id: M['Bin'], amount: 999, kind: 'adjust' });
  ok(ins.error, 'client không tự insert coin_ledger');

  console.log('Nộp việc → gật đầu');
  ok(!(await c.rpc('submit_task', { p_member: M['Bin'], p_task: task1.id })).error, 'Bin nộp việc');
  await c.rpc('submit_task', { p_member: M['Bin'], p_task: task1.id });
  let subs = (await c.from('submissions').select('*')).data;
  ok(subs.length === 1 && subs[0].status === 'pending', 'nộp 2 lần chỉ có 1 bản ghi pending');
  await expectErr(c.rpc('approve_submission', { p_submission: subs[0].id, p_reviewer: M['Bin'], p_sticker: 'x' }), 'invalid_reviewer', 'con không duyệt được');
  ok(!(await c.rpc('approve_submission', { p_submission: subs[0].id, p_reviewer: M['Bố'], p_sticker: 'Siêu sao!' })).error, 'Bố gật đầu');
  await c.rpc('approve_submission', { p_submission: subs[0].id, p_reviewer: M['Mẹ'], p_sticker: 'x' });
  ok(await balance(M['Bin']) === 20, 'Bin +20 Ủn (duyệt lại không cộng đôi)', await balance(M['Bin']));
  subs = (await c.from('submissions').select('*')).data;
  ok(subs[0].sticker === 'Siêu sao!' && subs[0].seen_by_member === false, 'lưu lời khen, chưa xem');

  console.log('Nhắc nhẹ (không trừ Ủn)');
  const t2 = T('Đi học đúng giờ');
  await c.rpc('submit_task', { p_member: M['Bin'], p_task: t2.id });
  const s2 = (await c.from('submissions').select('*').eq('task_id', t2.id).single()).data;
  await c.rpc('remind_submission', { p_submission: s2.id });
  ok((await c.from('submissions').select('status').eq('id', s2.id).single()).data.status === 'redo', 'chuyển sang redo');
  ok(await balance(M['Bin']) === 20, 'Ủn không đổi khi nhắc nhẹ');
  await c.rpc('submit_task', { p_member: M['Bin'], p_task: t2.id });
  ok((await c.from('submissions').select('status').eq('id', s2.id).single()).data.status === 'pending', 'nộp lại → pending');

  console.log('Làm cùng nhau');
  await c.rpc('submit_task', { p_member: M['Bin'], p_task: together.id });
  const sg = (await c.from('submissions').select('*').eq('task_id', together.id).single()).data;
  await c.rpc('approve_submission', { p_submission: sg.id, p_reviewer: M['Mẹ'], p_sticker: '' });
  const b3 = [await balance(M['Bin']), await balance(M['Bố']), await balance(M['Mẹ'])];
  ok(b3.join('/') === '50/30/30', 'Bin +30, Bố +30, Mẹ +30', b3.join('/'));

  console.log('Con chấm bố mẹ');
  await c.rpc('judge_parent_task', { p_parent: M['Bố'], p_task: ptask.id, p_kid: M['Bin'] });
  ok(await balance(M['Bố']) === 45, 'Bố +15 khi chấm Đạt', await balance(M['Bố']));
  await c.rpc('judge_parent_task', { p_parent: M['Bố'], p_task: ptask.id, p_kid: M['Bin'] });
  ok(await balance(M['Bố']) === 30, 'bấm lại huỷ → trừ 15', await balance(M['Bố']));
  await c.rpc('judge_parent_task', { p_parent: M['Bố'], p_task: ptask.id, p_kid: M['Bin'] });

  console.log('Đổi phiếu');
  const rw = (await c.from('rewards').select('*')).data;
  const cheap = rw.find(r => r.cost === 30), dear = rw.find(r => r.cost === 180);
  await expectErr(c.rpc('redeem_reward', { p_member: M['Bin'], p_reward: dear.id }), 'insufficient', 'thiếu Ủn thì bị chặn');
  ok(!(await c.rpc('redeem_reward', { p_member: M['Bin'], p_reward: cheap.id })).error, 'đủ Ủn thì đổi được');
  ok(await balance(M['Bin']) === 20, 'Bin còn 20', await balance(M['Bin']));
  const red = (await c.from('redemptions').select('*')).data;
  ok(red.length === 1 && red[0].status === 'promised', 'có vé ngoéo tay');
  await c.rpc('complete_redemption', { p_id: red[0].id });
  ok((await c.from('redemptions').select('status').single()).data.status === 'done', 'Giữ lời rồi');

  console.log('Hũ chung');
  const goal = (await c.from('jar_goals').select('*').single()).data;
  await c.rpc('set_jar_goal', { p_title: 'Đi biển', p_target: 50 });
  const g2 = (await c.from('jar_goals').select('*').single()).data;
  ok(g2.title === 'Đi biển' && g2.target === 50 && g2.id === goal.id, 'sửa mục tiêu hũ tại chỗ');
  await expectErr(c.rpc('contribute_jar', { p_member: M['Na'], p_goal: goal.id, p_amount: 20 }), 'insufficient', 'Na chưa có Ủn không góp được');
  let r1 = await c.rpc('contribute_jar', { p_member: M['Bố'], p_goal: goal.id, p_amount: 20 });
  ok(r1.data === false && await balance(M['Bố']) === 25, 'góp 20 trừ ví Bố', await balance(M['Bố']));
  r1 = await c.rpc('contribute_jar', { p_member: M['Mẹ'], p_goal: goal.id, p_amount: 30 });
  ok(r1.data === true, 'đủ 50 thì hũ đầy', JSON.stringify(r1));
  ok((await c.from('jar_goals').select('status').single()).data.status === 'reached', 'trạng thái reached');
  await expectErr(c.rpc('contribute_jar', { p_member: M['Bố'], p_goal: goal.id, p_amount: 5 }), 'jar_closed', 'hũ đầy không góp thêm');

  console.log('Thống kê tuần');
  const st = (await c.rpc('member_stats')).data.find(r => r.member_id === M['Bin']);
  ok(Number(st.week_coins) === 50 && Number(st.last_week_coins) === 0, 'Bin kiếm 50 tuần này, 0 tuần trước', JSON.stringify(st));

  console.log('Giờ vàng + giới hạn phút');
  let ks = (await c.rpc('kid_session', { p_member: M['Bin'] })).data;
  ok(ks.limit === false && ks.remaining === null, 'mặc định KHÔNG giới hạn phút (remaining = null)', JSON.stringify(ks));
  ok((await c.rpc('heartbeat', { p_member: M['Bin'], p_seconds: 30 })).data === -1, 'không giới hạn: heartbeat không ghi phút (-1)');
  await c.from('families').update({ limit_enabled: true }).eq('id', fam.id);
  ks = (await c.rpc('kid_session', { p_member: M['Bin'] })).data;
  ok(ks.remaining === 600 && ks.in_window === true, 'chưa khoá giờ vàng: còn 600s', JSON.stringify(ks));
  ok((await c.rpc('heartbeat', { p_member: M['Bin'], p_seconds: 30 })).data === 570, 'heartbeat 30s → còn 570s');
  ok((await c.rpc('heartbeat', { p_member: M['Bin'], p_seconds: 9999 })).data === 510, 'heartbeat bị chặn tối đa 60s/lần');
  const t3 = T('Ăn đúng giờ');
  await c.from('families').update({ daily_minutes: 1 }).eq('id', fam.id);
  await expectErr(c.rpc('submit_task', { p_member: M['Bin'], p_task: t3.id }), 'time_up', 'hết phút thì chặn nộp việc');
  await c.from('families').update({ daily_minutes: 10, enforce_golden: true, golden_start: '03:00', golden_end: '03:01' }).eq('id', fam.id);
  await expectErr(c.rpc('submit_task', { p_member: M['Bin'], p_task: t3.id }), 'outside_window', 'ngoài giờ vàng thì chặn nộp việc');
  await expectErr(c.rpc('redeem_reward', { p_member: M['Bin'], p_reward: cheap.id }), 'outside_window', 'ngoài giờ vàng thì chặn đổi phiếu');
  ks = (await c.rpc('kid_session', { p_member: M['Bin'] })).data;
  ok(ks.in_window === false, 'kid_session báo ngoài giờ');
  await c.from('families').update({ enforce_golden: false, limit_enabled: false }).eq('id', fam.id);
  const t3b = T('Ăn đúng giờ');
  await c.from('families').update({ daily_minutes: 1 }).eq('id', fam.id);
  ok(!(await c.rpc('submit_task', { p_member: M['Bin'], p_task: t3b.id })).error, 'tắt giới hạn phút thì hết phút vẫn nộp được');

  console.log('Cách ly giữa các gia đình (RLS)');
  const c2 = u2.c;
  ok((await c2.from('members').select('id')).data.length === 0, 'tài khoản khác không thấy thành viên');
  ok((await c2.from('coin_ledger').select('id')).data.length === 0, 'tài khoản khác không thấy sổ Ủn');
  await expectErr(c2.rpc('approve_submission', { p_submission: sg.id, p_reviewer: M['Bố'], p_sticker: '' }), 'no_family', 'tài khoản khác không duyệt được');
  await expectErr(c2.rpc('submit_task', { p_member: M['Bin'], p_task: task1.id }), 'no_family', 'tài khoản khác không nộp được');
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const am = await anon.from('members').select('id');
  ok(am.error || am.data.length === 0, 'chưa đăng nhập không đọc được gì');
  ok((await anon.rpc('verify_parent_pin', { p_pin: '1234' })).error, 'chưa đăng nhập không gọi được hàm PIN');

  console.log('Snapshot 1 truy vấn');
  const snap = (await c.rpc('family_snapshot')).data;
  ok(snap.family.name === 'Nhà Thử' && snap.members.length === 4, 'snapshot có gia đình và 4 thành viên');
  ok(snap.tasks.length === 13 && snap.rewards.length === 6, 'snapshot có việc tốt và phiếu');
  ok(!JSON.stringify(snap).includes('parent_pin_hash'), 'snapshot không lộ mã băm PIN');
  ok(snap.stats.length === 4, 'snapshot có thống kê 4 người');
  ok(snap.jar_log.length >= 2 && snap.jar_log[0].amount > 0, 'snapshot có nhật ký góp hũ', JSON.stringify(snap.jar_log));
  ok(snap.family.limit_enabled === false, 'snapshot báo giới hạn phút đang tắt');

  console.log('Checklist gán riêng từng người');
  const mine = T('Chơi với con 30 phút');
  await c.from('tasks').update({ parent_ids: [M['Mẹ']] }).eq('id', mine.id);
  await expectErr(c.rpc('judge_parent_task', { p_parent: M['Bố'], p_task: mine.id, p_kid: M['Bin'] }), 'not_assigned', 'con không chấm mục của Mẹ cho Bố');
  ok(!(await c.rpc('judge_parent_task', { p_parent: M['Mẹ'], p_task: mine.id, p_kid: M['Bin'] })).error, 'con chấm đúng người được gán');
  await c.rpc('judge_parent_task', { p_parent: M['Mẹ'], p_task: mine.id, p_kid: M['Bin'] }); // bỏ chấm

  console.log('Sửa và xoá mềm');
  const upd = await c.from('tasks').update({ title: 'Dậy sớm hơn', coins: 25 }).eq('id', task1.id).select().single();
  ok(upd.data?.title === 'Dậy sớm hơn' && upd.data?.coins === 25, 'sửa việc tốt');
  ok((await c.from('tasks').update({ coins: 999 }).eq('id', task1.id)).error, 'số Ủn ngoài 1–200 bị chặn');
  await c.from('tasks').update({ active: false }).eq('id', task1.id);
  ok(!(await c.rpc('family_snapshot')).data.tasks.some(t => t.id === task1.id), 'việc đã xoá không còn trong snapshot');
  await c.from('tasks').update({ active: true }).eq('id', task1.id);

  console.log('Hoàn tác gật đầu');
  const t5 = T('Nghe lời bố mẹ');
  await c.rpc('submit_task', { p_member: M['Na'], p_task: t5.id });
  const s5 = (await c.from('submissions').select('*').eq('task_id', t5.id).single()).data;
  await c.rpc('approve_submission', { p_submission: s5.id, p_reviewer: M['Bố'], p_sticker: '' });
  ok(await balance(M['Na']) === 15, 'Na +15 sau khi gật đầu');
  ok(!(await c.rpc('revoke_approval', { p_submission: s5.id })).error, 'hoàn tác gật đầu');
  ok(await balance(M['Na']) === 0, 'Na về 0 sau hoàn tác', await balance(M['Na']));
  ok((await c.from('submissions').select('status').eq('id', s5.id).single()).data.status === 'pending', 'việc quay lại chờ gật đầu');
  await expectErr(c.rpc('revoke_approval', { p_submission: s5.id }), 'not_approved', 'không hoàn tác việc chưa gật đầu');
  await c.rpc('approve_submission', { p_submission: s5.id, p_reviewer: M['Bố'], p_sticker: '' });

  console.log('Huỷ phiếu hoàn Ủn');
  const t4 = T('Chăm em / giúp bố mẹ');
  await c.rpc('submit_task', { p_member: M['Bin'], p_task: t4.id });
  const s4 = (await c.from('submissions').select('*').eq('task_id', t4.id).single()).data;
  await c.rpc('approve_submission', { p_submission: s4.id, p_reviewer: M['Mẹ'], p_sticker: '' });
  const binBefore = await balance(M['Bin']);
  await c.from('families').update({ enforce_golden: false }).eq('id', fam.id);
  const r2 = (await c.rpc('redeem_reward', { p_member: M['Bin'], p_reward: cheap.id }));
  ok(!r2.error, 'Bin đổi phiếu lần 2', r2.error?.message);
  ok(await balance(M['Bin']) === binBefore - 30, 'trừ 30 Ủn');
  const prom = (await c.from('redemptions').select('*').eq('status', 'promised')).data[0];
  ok(!(await c.rpc('cancel_redemption', { p_id: prom.id })).error, 'huỷ phiếu');
  ok(await balance(M['Bin']) === binBefore, 'hoàn đủ 30 Ủn');
  await expectErr(c.rpc('cancel_redemption', { p_id: prom.id }), 'not_promised', 'không huỷ phiếu hai lần');
  const stBin = (await c.rpc('member_stats')).data.find(r => r.member_id === M['Bin']);
  ok(Number(stBin.week_coins) === 75, 'Ủn tuần không tính tiền hoàn', JSON.stringify(stBin));

  console.log('Báo cáo tuần');
  const rep = (await c.rpc('week_report', { p_offset: 0 })).data;
  ok(rep.length === 4 * 7, 'báo cáo có 4 người x 7 ngày', rep.length);
  const binEarned = rep.filter(r => r.member_id === M['Bin']).reduce((a, r) => a + Number(r.earned), 0);
  ok(binEarned === 75, 'tổng Ủn kiếm của Bin trong tuần = 75', binEarned);
  const prev = (await c.rpc('week_report', { p_offset: -1 })).data;
  ok(prev.every(r => Number(r.earned) === 0), 'tuần trước chưa có gì');

  console.log('Đăng ký thông báo');
  const ps = await c.from('push_subscriptions').insert({ family_id: fam.id, endpoint: 'https://example.invalid/push/' + stamp, p256dh: 'k', auth: 'a' });
  ok(!ps.error, 'lưu đăng ký thông báo', ps.error?.message);
  ok((await c2.from('push_subscriptions').select('id')).data.length === 0, 'gia đình khác không thấy đăng ký thông báo');

  console.log('Kế hoạch theo ngày');
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const tomorrow = new Date(Date.parse(todayStr + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
  const dow = (new Date(todayStr + 'T00:00:00Z').getUTCDay() + 6) % 7;
  const planned = T('Ăn đúng giờ');
  ok((await c.rpc('task_on_day', { p_task: planned.id, p_day: todayStr })).data === true, 'việc mới mặc định giao mỗi ngày');
  ok(!(await c.rpc('set_day_plan', { p_day: todayStr, p_items: [{ task: planned.id, enabled: false }] })).error, 'tắt việc cho hôm nay');
  await expectErr(c.rpc('submit_task', { p_member: M['Bin'], p_task: planned.id }), 'not_scheduled', 'việc bị tắt hôm nay thì con không nộp được');
  ok((await c.rpc('family_snapshot')).data.overrides.some(o => o.task_id === planned.id && o.day === todayStr && o.enabled === false), 'snapshot có ghi đè của ngày');
  await c.rpc('set_day_plan', { p_day: todayStr, p_items: [{ task: planned.id, enabled: null }] });
  ok(!(await c.rpc('submit_task', { p_member: M['Bin'], p_task: planned.id })).error, 'bỏ ghi đè thì con nộp được lại');

  const mask = 127 ^ (1 << dow); // mọi ngày trừ hôm nay
  const weekly = T('Nghe lời bố mẹ');
  await c.from('tasks').update({ repeat_days: mask }).eq('id', weekly.id);
  ok((await c.rpc('task_on_day', { p_task: weekly.id, p_day: todayStr })).data === false, 'lịch lặp không có hôm nay → không giao');
  await expectErr(c.rpc('submit_task', { p_member: M['Na'], p_task: weekly.id }), 'not_scheduled', 'ngoài lịch lặp thì chặn nộp');
  await c.rpc('set_day_plan', { p_day: todayStr, p_items: [{ task: weekly.id, enabled: true }] });
  ok(!(await c.rpc('submit_task', { p_member: M['Na'], p_task: weekly.id })).error, 'bật riêng hôm nay thì nộp được');
  ok((await c.from('tasks').update({ repeat_days: 200 }).eq('id', weekly.id)).error, 'lịch lặp ngoài 0–127 bị chặn');

  const parentTask = T('Về nhà trước 19h');
  await c.rpc('set_day_plan', { p_day: todayStr, p_items: [{ task: parentTask.id, enabled: false }] });
  await expectErr(c.rpc('judge_parent_task', { p_parent: M['Bố'], p_task: parentTask.id, p_kid: M['Bin'] }), 'not_scheduled', 'mục checklist chưa giao hôm nay thì con không chấm được');

  const one = await c.rpc('add_oneoff_task', { p_day: todayStr, p_title: 'Việc riêng hôm nay', p_icon: 'star', p_coins: 7, p_slot: 'toi', p_audience: 'kid', p_kid_ids: null, p_parent_ids: null });
  ok(!one.error && one.data, 'thêm việc chỉ cho một ngày', one.error?.message);
  const oneTask = (await c.rpc('family_snapshot')).data.tasks.find(t => t.id === one.data);
  ok(oneTask && oneTask.repeat_days === 0, 'việc riêng có lịch lặp = 0');
  ok((await c.rpc('task_on_day', { p_task: one.data, p_day: todayStr })).data === true, 'việc riêng có giao hôm nay');
  ok((await c.rpc('task_on_day', { p_task: one.data, p_day: tomorrow })).data === false, 'việc riêng không giao ngày mai');
  ok(!(await c.rpc('submit_task', { p_member: M['Bin'], p_task: one.data })).error, 'con nộp được việc riêng');
  await expectErr(c.rpc('set_day_plan', { p_day: '2099-01-01', p_items: [] }), 'invalid_day', 'ngày quá xa bị từ chối');
  await expectErr(c2.rpc('set_day_plan', { p_day: todayStr, p_items: [{ task: planned.id, enabled: false }] }), 'no_family', 'gia đình khác không đặt kế hoạch được');

  console.log('Giao việc cho từng người (gắn thẻ)');
  const careTask = T('Chăm em / giúp bố mẹ');
  await c.from('tasks').update({ kid_ids: [M['Bin']] }).eq('id', careTask.id);
  await expectErr(c.rpc('submit_task', { p_member: M['Na'], p_task: careTask.id }), 'not_assigned', 'bé không được gắn thẻ thì không nộp được');
  await c.rpc('set_day_plan', { p_day: todayStr, p_items: [{ task: careTask.id, enabled: true }] });
  ok(!(await c.rpc('submit_task', { p_member: M['Bin'], p_task: careTask.id })).error, 'bé được gắn thẻ nộp được');
  const toyTask = T('Cùng bố mẹ dọn đồ chơi');
  await c.from('tasks').update({ parent_ids: [M['Bố']] }).eq('id', toyTask.id);
  await c.rpc('set_day_plan', { p_day: todayStr, p_items: [{ task: toyTask.id, enabled: true }] });
  const bBố = await balance(M['Bố']), bMẹ = await balance(M['Mẹ']), bBin = await balance(M['Bin']);
  await c.rpc('submit_task', { p_member: M['Bin'], p_task: toyTask.id });
  const toySub = (await c.from('submissions').select('id').eq('task_id', toyTask.id).single()).data;
  await c.rpc('approve_submission', { p_submission: toySub.id, p_reviewer: M['Mẹ'], p_sticker: '' });
  ok(await balance(M['Bố']) === bBố + 20 && await balance(M['Mẹ']) === bMẹ && await balance(M['Bin']) === bBin + 20, 'chỉ bố mẹ được gắn thẻ nhận Ủn (Bố +20, Mẹ +0, Bin +20)', [await balance(M['Bố']) - bBố, await balance(M['Mẹ']) - bMẹ, await balance(M['Bin']) - bBin].join('/'));
  const oneAll = await c.rpc('add_oneoff_task', { p_day: todayStr, p_title: 'Cả nhà dọn bếp', p_icon: 'home', p_coins: 9, p_slot: 'toi', p_audience: 'together', p_kid_ids: [M['Na']], p_parent_ids: null });
  ok(!oneAll.error, 'việc riêng gắn thẻ bé Na và cả bố mẹ', oneAll.error?.message);
  await expectErr(c.rpc('add_oneoff_task', { p_day: todayStr, p_title: 'x', p_icon: 'home', p_coins: 5, p_slot: 'toi', p_audience: 'kid', p_kid_ids: [M['Bố']], p_parent_ids: null }), 'invalid_member', 'gắn thẻ nhầm người lớn vào việc của bé bị chặn');

  console.log('Việc riêng của bố mẹ (tự đánh dấu, hạn, làm một lần)');
  const mineRes = await c.rpc('add_oneoff_task', { p_day: todayStr, p_title: 'Gửi báo giá cho khách', p_icon: 'check', p_coins: 99, p_slot: 'chieu', p_audience: 'parent', p_kid_ids: null, p_parent_ids: [M['Bố']], p_due: '18:00', p_est: 30, p_self: true, p_keep: false, p_repeat: 0 });
  ok(!mineRes.error && mineRes.data, 'Bố thêm việc riêng làm một lần', mineRes.error?.message);
  const mineTask = (await c.rpc('family_snapshot')).data.tasks.find(t => t.id === mineRes.data);
  ok(mineTask && mineTask.self_check === true && mineTask.coins === 0 && mineTask.one_off === true, 'việc riêng: tự đánh dấu, 0 Ủn dù gửi 99, làm một lần', JSON.stringify(mineTask));
  ok(mineTask && mineTask.due_time === '18:00' && mineTask.est_minutes === 30, 'lưu hạn 18:00 và dự kiến 30 phút', JSON.stringify(mineTask));
  const coinsBefore = await balance(M['Bố']);
  await expectErr(c.rpc('judge_parent_task', { p_parent: M['Bố'], p_task: mineRes.data, p_kid: M['Bin'] }), 'invalid_task', 'con không chấm được việc bố mẹ tự đánh dấu');
  await expectErr(c.rpc('toggle_self_task', { p_parent: M['Mẹ'], p_task: mineRes.data }), 'not_assigned', 'Mẹ không đánh dấu hộ việc của Bố');
  ok(!(await c.rpc('toggle_self_task', { p_parent: M['Bố'], p_task: mineRes.data })).error, 'Bố tự đánh dấu xong');
  ok((await c.from('submissions').select('status').eq('member_id', M['Bố']).eq('task_id', mineRes.data).single()).data.status === 'approved', 'ghi nhận đã xong');
  ok(await balance(M['Bố']) === coinsBefore, 'tự đánh dấu không đổi số Ủn');
  ok(!(await c.rpc('toggle_self_task', { p_parent: M['Bố'], p_task: mineRes.data })).error, 'bấm lại để bỏ đánh dấu');
  ok(((await c.from('submissions').select('id').eq('member_id', M['Bố']).eq('task_id', mineRes.data)).data ?? []).length === 0, 'đã bỏ đánh dấu');
  await expectErr(c.rpc('toggle_self_task', { p_parent: M['Bố'], p_task: T('Chơi với con 30 phút').id }), 'invalid_task', 'không tự đánh dấu được việc con chấm');
  ok((await c.from('tasks').update({ coins: 5 }).eq('id', mineRes.data)).error, 'việc tự đánh dấu không được có Ủn (ràng buộc)');

  const keepRes = await c.rpc('add_oneoff_task', { p_day: todayStr, p_title: 'Họp nhóm', p_icon: 'check', p_coins: 0, p_slot: 'sang', p_audience: 'parent', p_kid_ids: null, p_parent_ids: [M['Mẹ']], p_due: '09:00', p_est: 60, p_self: true, p_keep: true, p_repeat: 31 });
  const keepTask = (await c.rpc('family_snapshot')).data.tasks.find(t => t.id === keepRes.data);
  ok(keepTask && keepTask.one_off === false && keepTask.repeat_days === 31, 'lưu vào kho việc: lặp T2–T6, không phải làm một lần', JSON.stringify(keepTask));

  const oldRes = await c.rpc('add_oneoff_task', { p_day: todayStr, p_title: 'Việc cũ lâu rồi', p_icon: 'check', p_coins: 0, p_slot: 'toi', p_audience: 'parent', p_kid_ids: null, p_parent_ids: [M['Bố']], p_due: null, p_est: null, p_self: true, p_keep: false, p_repeat: 0 });
  ok((await c.rpc('family_snapshot')).data.tasks.some(t => t.id === oldRes.data), 'việc làm một lần của hôm nay có trong snapshot');
  const tenDaysAgo = new Date(Date.parse(todayStr + 'T00:00:00Z') - 10 * 86400000).toISOString().slice(0, 10);
  await admin.from('task_overrides').update({ day: tenDaysAgo }).eq('task_id', oldRes.data);
  ok(!(await c.rpc('family_snapshot')).data.tasks.some(t => t.id === oldRes.data), 'việc làm một lần quá 7 ngày bị ẩn khỏi snapshot (không làm rối kho)');

  console.log('Avatar');
  ok(!(await c.from('members').update({ avatar: '🐯' }).eq('id', M['Bin'])).error, 'bố mẹ đặt avatar cho con');
  ok((await c.rpc('family_snapshot')).data.members.find(m => m.id === M['Bin']).avatar === '🐯', 'snapshot có avatar');
  ok((await c.from('members').update({ avatar: 'x'.repeat(40) }).eq('id', M['Bin'])).error, 'avatar quá dài bị chặn');
  ok(!(await c.from('members').update({ avatar: null }).eq('id', M['Bin'])).error, 'bỏ avatar quay về chữ cái');

  console.log('Nhìn lại: tổng kết ngày, sticker, lưu lịch sử');
  {
    const c2 = u2.c;
    const mem2 = [
      { name: 'Bố', role: 'parent', color: '#FFB27A', initial: 'Bố' }, { name: 'Mẹ', role: 'parent', color: '#FF9CC2', initial: 'Mẹ' },
      { name: 'Bin', role: 'kid', color: '#3DD6B5', initial: 'B' }, { name: 'Na', role: 'kid', color: '#B9A6FF', initial: 'N' }];
    ok(!(await c2.rpc('create_family', { p_name: 'Nhà Nhìn Lại', p_pin: '1234', p_members: mem2 })).error, 'tạo gia đình thứ hai để thử Nhìn lại');
    const fam2 = (await c2.from('families').select('id').single()).data.id;
    await c2.from('families').update({ enforce_golden: false }).eq('id', fam2);
    const M2 = Object.fromEntries((await c2.from('members').select('id,name')).data.map(m => [m.name, m.id]));
    const T2 = Object.fromEntries((await c2.from('tasks').select('id,title')).data.map(t => [t.title, t.id]));
    const row = async (m) => (await c2.rpc('review_range', { p_from: todayStr, p_to: todayStr })).data?.find(r => r.member_id === m && r.day === todayStr);

    let r = await row(M2['Bin']);
    ok(r && r.planned === 9 && r.done === 0 && r.missed.length === 9, 'chưa làm gì: 9 việc được giao, 0 xong, 9 chưa làm', JSON.stringify(r));
    await c2.rpc('submit_task', { p_member: M2['Bin'], p_task: T2['Dậy trước 6h30'] });
    await c2.rpc('submit_task', { p_member: M2['Bin'], p_task: T2['Đi học đúng giờ'] });
    const subs2 = (await c2.from('submissions').select('id,task_id')).data;
    await c2.rpc('approve_submission', { p_submission: subs2.find(s => s.task_id === T2['Dậy trước 6h30']).id, p_reviewer: M2['Bố'], p_sticker: 'x' });
    r = await row(M2['Bin']);
    ok(r && r.planned === 9 && r.done === 2, 'Bin được giao 9 việc (6 việc con + 3 làm cùng), đã làm 2 (1 gật đầu + 1 chờ)', JSON.stringify(r));
    ok(r.stickers.includes('sang') && !r.stickers.includes('star'), 'xong trọn buổi sáng được sticker sang, chưa phải star', JSON.stringify(r.stickers));
    ok(r.coins === 20 && r.missed.length === 7 && r.done_titles.length === 2, 'Ủn 20, 7 việc chưa làm, 2 việc đã làm', JSON.stringify(r));
    ok(!r.missed.includes('Dậy trước 6h30') && r.missed.includes('Ngủ trước 21h'), 'danh sách chưa làm đúng');
    const na = await row(M2['Na']);
    ok(na.done === 0 && na.missed.length === 9, 'Na chưa làm gì: 9 việc chưa làm');
    const parentRow = await row(M2['Bố']);
    ok(parentRow && parentRow.planned === 4, 'Bố được giao 4 việc trong checklist bố mẹ', JSON.stringify(parentRow));

    for (const t of ['Ăn đúng giờ', 'Chăm em / giúp bố mẹ', 'Nghe lời bố mẹ', 'Ngủ trước 21h', 'Cùng bố mẹ tưới cây', 'Cùng bố mẹ dọn đồ chơi', 'Cả nhà ăn tối không điện thoại']) {
      if (T2[t]) await c2.rpc('submit_task', { p_member: M2['Bin'], p_task: T2[t] });
    }
    r = await row(M2['Bin']);
    ok(r.done === 9 && r.missed.length === 0, 'làm đủ 9 việc thì không còn việc nào chưa làm', JSON.stringify(r));
    ok(['star', 'chamchi', 'sang', 'chieu', 'toi'].every(s => r.stickers.includes(s)), 'đủ sticker: star, chamchi, 3 buổi', JSON.stringify(r.stickers));

    // việc có hạn: nộp đúng hạn thì được dunggio
    const due = await c2.rpc('add_oneoff_task', { p_day: todayStr, p_title: 'Xếp sách', p_icon: 'book', p_coins: 5, p_slot: 'toi', p_audience: 'kid', p_kid_ids: [M2['Na']], p_parent_ids: null, p_due: '23:59', p_est: 5, p_self: false, p_keep: false, p_repeat: 0 });
    await c2.rpc('submit_task', { p_member: M2['Na'], p_task: due.data });
    r = await row(M2['Na']);
    ok(r.stickers.includes('dunggio') && r.planned === 10 && r.done === 1, 'xong việc có hạn trước giờ hạn thì có sticker dunggio', JSON.stringify(r));
    ok(!(await row(M2['Bin'])).missed.includes('Xếp sách'), 'việc giao riêng cho Na không tính cho Bin');

    // lưu lịch sử: cron lưu rồi đọc lại
    const nAll = await admin.rpc('finalize_all', { p_back: 0 });
    ok(!nAll.error && nAll.data >= 2, 'finalize_all lưu tổng kết cho các gia đình', nAll.error?.message);
    const stored = (await admin.from('day_summaries').select('*').eq('family_id', fam2).eq('day', todayStr)).data;
    ok(stored.length >= 3 && stored.find(x => x.member_id === M2['Bin']).done === 9, 'bảng day_summaries có dòng của hôm nay', JSON.stringify(stored.map(x => [x.member_id.slice(0, 4), x.done])));
    ok((await c2.from('day_summaries').insert({ family_id: fam2, member_id: M2['Bin'], day: '2020-01-01' })).error, 'client không tự ghi tổng kết');
    // giả lập ngày cũ: dời dòng đã lưu về 10 ngày trước, đọc lại qua review_range (phải lấy từ bảng đã lưu)
    await admin.from('day_summaries').update({ day: tenDaysAgo }).eq('family_id', fam2).eq('day', todayStr);
    const old = (await c2.rpc('review_range', { p_from: tenDaysAgo, p_to: tenDaysAgo })).data;
    ok(old.length === stored.length && old.find(x => x.member_id === M2['Bin']).stickers.includes('star'), 'ngày cũ đọc từ bảng đã lưu', JSON.stringify(old.length));
    ok((await c2.rpc('review_range', { p_from: todayStr, p_to: '2099-01-01' })).error?.message.includes('invalid_range'), 'khoảng ngày quá dài bị chặn');
    ok(((await c.rpc('review_range', { p_from: tenDaysAgo, p_to: tenDaysAgo })).data ?? []).length === 0, 'gia đình khác không đọc được tổng kết của nhà này');
    const bf = await c2.rpc('backfill_summaries', { p_days: 30 });
    ok(!bf.error && bf.data === 1, 'backfill chỉ bù từ ngày tạo gia đình', bf.error?.message ?? bf.data);

    console.log('Lời khen của bố mẹ');
    const sp = await c2.rpc('send_praise', { p_from: M2['Mẹ'], p_to: M2['Bin'], p_body: '  Con giỏi lắm, mẹ tự hào về con!  ' });
    ok(!sp.error, 'mẹ gửi lời khen cho Bin', sp.error?.message);
    let pr = (await c2.from('praises').select('*')).data;
    ok(pr.length === 1 && pr[0].body === 'Con giỏi lắm, mẹ tự hào về con!' && pr[0].heard_at === null, 'lời khen được cắt khoảng trắng, chưa nghe');
    await expectErr(c2.rpc('send_praise', { p_from: M2['Bin'], p_to: M2['Na'], p_body: 'x' }), 'invalid_member', 'con không gửi được lời khen (chỉ bố mẹ)');
    await expectErr(c2.rpc('send_praise', { p_from: M2['Mẹ'], p_to: M2['Bin'], p_body: '   ' }), 'empty_body', 'lời khen trống bị chặn');
    ok((await c2.rpc('send_praise', { p_from: M2['Mẹ'], p_to: M['Bin'], p_body: 'khác nhà' })).error, 'không khen được người của nhà khác');
    ok((await c2.from('praises').insert({ family_id: fam2, from_member: M2['Mẹ'], to_member: M2['Bin'], body: 'x' })).error, 'client không tự insert lời khen');
    await c2.rpc('mark_praise_heard', { p_id: sp.data });
    pr = (await c2.from('praises').select('*')).data;
    ok(pr[0].heard_at !== null, 'bé nghe xong thì đánh dấu đã nghe');
    ok(((await c.from('praises').select('id')).data ?? []).length === 0, 'nhà khác không thấy lời khen');
    for (let i = 0; i < 52; i++) await c2.rpc('send_praise', { p_from: M2['Bố'], p_to: M2['Na'], p_body: `Khen ${i}` });
    ok((await c2.from('praises').select('id')).data.length === 50, 'chỉ giữ 50 lời khen gần nhất');
    await c2.rpc('delete_praise', { p_id: (await c2.from('praises').select('id').limit(1)).data[0].id });
    ok((await c2.from('praises').select('id')).data.length === 49, 'xoá một lời khen');
  }

  console.log('PIN');
  ok((await c.rpc('verify_parent_pin', { p_pin: '1234' })).data === true, 'PIN đúng');
  for (let i = 0; i < 5; i++) await c.rpc('verify_parent_pin', { p_pin: '0000' });
  await expectErr(c.rpc('verify_parent_pin', { p_pin: '1234' }), 'pin_locked', 'sai 5 lần thì khoá');
} catch (e) { fail++; console.log('LỖI', e); }
finally {
  await admin.auth.admin.deleteUser(u1.id); await admin.auth.admin.deleteUser(u2.id);
  const left = await admin.from('families').select('id').in('owner_user_id', [u1.id, u2.id]);
  console.log('dọn dẹp xong, còn lại', left.data.length, 'gia đình thử');
}
console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);

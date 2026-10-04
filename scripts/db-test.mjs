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
  await c.from('families').update({ enforce_golden: false }).eq('id', fam.id);

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

  console.log('Checklist gán riêng từng người');
  const mine = T('Chơi với con 30 phút');
  await c.from('tasks').update({ assignee_id: M['Mẹ'] }).eq('id', mine.id);
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

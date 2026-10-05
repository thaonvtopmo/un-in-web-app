// Bộ dữ liệu thử cho khu vườn: thêm một bé thử tạm vào một gia đình thật, nạp sẵn nước và Ủn, rồi xoá sạch khi xong.
//   node scripts/garden-testkit.mjs setup <email chủ nhà> [số ngày=12] [số Ủn=600]
//   node scripts/garden-testkit.mjs cleanup <email chủ nhà>
// Bé thử tên "Bé Thử Vườn". Mọi dữ liệu của bé (việc, sổ Ủn, cây, tổng kết) xoá theo bé khi cleanup (khoá ngoại ON DELETE CASCADE).
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
const root = fileURLToPath(new URL('..', import.meta.url));
const env = Object.fromEntries(fs.readFileSync(root + '/.env.local', 'utf8').split(/\r?\n/).filter(l => /^[A-Z_]+=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [cmd, email, daysArg, coinsArg] = process.argv.slice(2);
const NAME = 'Bé Thử Vườn';
if (!cmd || !email) { console.log('Dùng: setup|cleanup <email chủ nhà>'); process.exit(1); }

const { data: users } = await admin.auth.admin.listUsers({ perPage: 500 });
const owner = users.users.find((x) => (x.email || '').toLowerCase() === email.toLowerCase());
if (!owner) throw new Error('Không thấy tài khoản ' + email);
const fam = (await admin.from('families').select('id,name').eq('owner_user_id', owner.id).single()).data;
const counts = async () => Object.fromEntries(await Promise.all([
  ['members', admin.from('members').select('id', { count: 'exact', head: true }).eq('family_id', fam.id)],
  ['submissions', admin.from('submissions').select('id', { count: 'exact', head: true }).eq('family_id', fam.id)],
  ['ledger', admin.from('coin_ledger').select('id', { count: 'exact', head: true }).eq('family_id', fam.id)],
  ['gardens', admin.from('gardens').select('member_id', { count: 'exact', head: true }).eq('family_id', fam.id)],
  ['plants', admin.from('plants').select('id', { count: 'exact', head: true }).eq('family_id', fam.id)],
  ['summaries', admin.from('day_summaries').select('member_id', { count: 'exact', head: true }).eq('family_id', fam.id)],
].map(async ([k, q]) => [k, (await q).count])));
const vnDay = (offset = 0) => { const d = new Date(Date.now() + 7 * 3600_000 + offset * 86400_000); return d.toISOString().slice(0, 10); };

if (cmd === 'setup') {
  const days = Number(daysArg) || 12, coins = Number(coinsArg) || 600;
  const before = await counts();
  if ((await admin.from('members').select('id').eq('family_id', fam.id).eq('name', NAME)).data.length) throw new Error('Đã có bé thử rồi, chạy cleanup trước');
  const parent = (await admin.from('members').select('id').eq('family_id', fam.id).eq('role', 'parent').order('sort_order').limit(1)).data[0];
  const kid = (await admin.from('members').insert({ family_id: fam.id, name: NAME, role: 'kid', color: '#B9A6FF', initial: 'T', sort_order: 99 }).select('id').single()).data;
  // Vườn bắt đầu cách đây `days` ngày để các ngày làm việc trong quá khứ được tính nước
  await admin.from('gardens').insert({ member_id: kid.id, family_id: fam.id, started_at: new Date(Date.now() - (days - 1) * 86400_000).toISOString(), slots: 2 });
  await admin.from('plants').insert({ family_id: fam.id, member_id: kid.id, species: 'hy_vong', slot: 1 });
  // Việc chung cho mọi bé (không giao riêng cho ai): việc con tự làm = 1 giọt, việc làm cùng bố mẹ = 2 giọt
  const tasks = (await admin.from('tasks').select('id,title,audience,kid_ids').eq('family_id', fam.id).eq('active', true).eq('one_off', false).in('audience', ['kid', 'together'])).data.filter((t) => !t.kid_ids);
  let water = 0, rows = [];
  for (let d = 0; d < days; d++) {
    const day = vnDay(-d);
    for (const t of tasks) {
      rows.push({ family_id: fam.id, member_id: kid.id, task_id: t.id, day, status: 'approved', reviewer_id: parent.id, seen_by_member: true, submitted_at: `${day}T01:30:00Z`, reviewed_at: `${day}T02:00:00Z` });
      water += t.audience === 'together' ? 2 : 1;
    }
  }
  for (let i = 0; i < rows.length; i += 100) { const r = await admin.from('submissions').insert(rows.slice(i, i + 100)); if (r.error) throw r.error; }
  await admin.from('coin_ledger').insert({ family_id: fam.id, member_id: kid.id, amount: coins, kind: 'adjust' }); // Ủn thử để mua hạt giống, chậu, ô đất
  fs.writeFileSync(root + '/.garden-testkit.json', JSON.stringify({ email, family: fam.id, kid: kid.id, before }, null, 2));
  console.log(`Đã tạo "${NAME}" trong ${fam.name}: ${tasks.length} việc/ngày x ${days} ngày = ${water} giọt nước, ${coins} Ủn.`);
  console.log('Trước khi thử:', before);
  console.log('Sau khi tạo:  ', await counts());
} else if (cmd === 'cleanup') {
  const kids = (await admin.from('members').select('id').eq('family_id', fam.id).eq('name', NAME)).data;
  for (const k of kids) { const r = await admin.from('members').delete().eq('id', k.id); if (r.error) throw r.error; }
  await admin.rpc('admin_snapshot'); // chụp lại số liệu thống kê hôm nay sau khi bé thử đã biến mất
  const saved = fs.existsSync(root + '/.garden-testkit.json') ? JSON.parse(fs.readFileSync(root + '/.garden-testkit.json', 'utf8')) : null;
  const now = await counts();
  console.log(`Đã xoá ${kids.length} bé thử.`);
  console.log('Hiện tại:', now);
  if (saved) {
    const same = Object.keys(saved.before).filter((k) => k !== 'summaries').every((k) => saved.before[k] === now[k]);
    console.log('Trước khi thử:', saved.before);
    console.log(same ? 'KHỚP: dữ liệu gia đình đã về đúng như trước khi thử.' : 'CHƯA KHỚP, cần kiểm tra lại.');
    if (same) fs.unlinkSync(root + '/.garden-testkit.json');
  }
}

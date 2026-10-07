// Cài bộ hẹn giờ báo thức trong database (pg_cron + pg_net): mỗi phút kiểm tra, chỉ khi có báo thức đến giờ mới gọi máy chủ app.
//   node scripts/setup-alarm-cron.mjs [địa chỉ app, mặc định https://www.minhchihub.vn]
//   node scripts/setup-alarm-cron.mjs --remove
// Cần ALARM_SECRET trong .env.local (tự tạo nếu chưa có, nhớ đặt cùng giá trị trong biến môi trường của Vercel).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = fileURLToPath(new URL('..', import.meta.url));
const envFile = path.join(root, '.env.local');
let raw = fs.readFileSync(envFile, 'utf8');
const get = (k) => (raw.match(new RegExp(`^${k}=(.*)$`, 'm')) || [])[1]?.replace(/^"|"$/g, '');
const base = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'https://www.minhchihub.vn').replace(/\/$/, '');
const url = (get('POSTGRES_URL_NON_POOLING') || '').split('?')[0];
if (!url) throw new Error('Thiếu POSTGRES_URL_NON_POOLING');
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  if (process.argv.includes('--remove')) {
    await client.query("select cron.unschedule(jobid) from cron.job where jobname in ('un-alarms', 'un-cron-cleanup')");
    console.log('Đã gỡ bộ hẹn giờ báo thức.');
  } else {
    let secret = get('ALARM_SECRET');
    if (!secret) {
      secret = crypto.randomBytes(24).toString('hex');
      fs.appendFileSync(envFile, `\nALARM_SECRET=${secret}\n`);
      console.log('Đã tạo ALARM_SECRET mới trong .env.local. Đặt cùng giá trị này cho biến ALARM_SECRET của Vercel (Production).');
    }
    await client.query('create extension if not exists pg_cron with schema pg_catalog');
    await client.query('create extension if not exists pg_net with schema extensions');
    const cmd = `select net.http_post(url := '${base}/api/cron/alarms', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ${secret}'), body := '{}'::jsonb, timeout_milliseconds := 10000) where public.has_due_alarm()`;
    await client.query('select cron.schedule($1, $2, $3)', ['un-alarms', '* * * * *', cmd]);
    // lịch sử chạy của pg_cron chỉ giữ 2 ngày để không phình dung lượng
    await client.query('select cron.schedule($1, $2, $3)', ['un-cron-cleanup', '15 20 * * *', "delete from cron.job_run_details where end_time < now() - interval '2 days'"]);
    const jobs = (await client.query("select jobname, schedule, active from cron.job order by jobname")).rows;
    console.log('Bộ hẹn giờ đã cài:', jobs);
  }
} finally {
  await client.end();
}

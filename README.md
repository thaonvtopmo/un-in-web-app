# Ủn Ỉn Cả Nhà

Web app gia đình: bố mẹ và con cùng làm **việc tốt** hằng ngày để tích **Ủn**, rồi đổi Ủn lấy **phiếu đi chơi** cùng nhau.
Mục tiêu: giảm thời gian con dùng điện thoại, tăng gắn kết gia đình.

- Trang chính: https://www.minhchihub.vn
- Một Gmail cho cả nhà đăng nhập. Các con không cần tài khoản riêng. Bố mẹ cần **PIN** để vào Góc bố mẹ.

## Công nghệ

| Phần | Dùng |
|---|---|
| Giao diện | Next.js 16 (App Router) + TypeScript + Tailwind 4, font Baloo 2 và Nunito |
| Dữ liệu, đăng nhập, realtime | Supabase (Postgres + Auth Google + Realtime + RLS) |
| Máy chủ web | Vercel (deploy tự động khi push lên `main`) |
| Thông báo | Web Push (VAPID) + Vercel Cron |
| Kiểm thử | Vitest, Playwright (kèm axe), kiểm thử cơ sở dữ liệu |

## Kiến trúc ngắn gọn

- **Server là nguồn sự thật.** Mọi biến động Ủn nằm trong bảng `coin_ledger`, chỉ ghi được qua các hàm trên server
  (`approve_submission`, `redeem_reward`, `contribute_jar`, `judge_parent_task`, `revoke_approval`, `cancel_redemption`...).
  Trình duyệt không tự cộng hay trừ Ủn được.
- **Giờ vàng và giới hạn phút** của con được kiểm tra ở server (`assert_kid_can_play`, `heartbeat`).
- **PIN bố mẹ** chỉ lưu dạng bcrypt, kiểm tra bằng `verify_parent_pin` (sai 5 lần khoá 5 phút).
- **Mỗi gia đình chỉ thấy dữ liệu của mình** nhờ Row Level Security.
- `lib/backend.ts` là lớp nói chuyện với server; `lib/demo.ts` là bản chạy trong bộ nhớ (khi thiếu khoá Supabase app tự chạy chế độ dùng thử, PIN `1234`).
- `lib/store.tsx` cập nhật giao diện ngay khi bấm, gọi server, rồi tải lại dữ liệu thật. Máy khác thay đổi thì nhận qua Realtime.
- `lib/rules.ts` chứa quy tắc cộng/trừ Ủn dùng chung cho cập nhật tức thì và bản dùng thử.

## Chạy trên máy

```bash
npm install
cp .env.local.example .env.local     # điền khoá Supabase (hoặc `vercel env pull` nếu dự án đã nối Vercel)
npm run dev                          # http://localhost:3000
```

Biến môi trường (`.env.local`, không đưa lên Git):

| Biến | Dùng cho |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Trình duyệt kết nối Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chỉ máy chủ: gửi thông báo, kiểm thử. **Không bao giờ** đưa ra trình duyệt |
| `POSTGRES_URL_NON_POOLING` | Chạy migration |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Thông báo đẩy |
| `CRON_SECRET` | Bảo vệ API nhắc hằng ngày |

Không có hai biến `NEXT_PUBLIC_SUPABASE_*` thì app chạy **chế độ dùng thử** (không đăng nhập, dữ liệu mẫu).

## Cơ sở dữ liệu

```bash
npm run migrate            # chạy các file trong supabase/migrations chưa chạy
node scripts/migrate.mjs --baseline   # database đã dựng sẵn: chỉ đánh dấu, không chạy lại
```

Migration: `001` bảng + RLS + PIN, `002` luồng chính + giờ vàng, `003` bảng xếp hạng, `004` quản lý (snapshot, hoàn tác, huỷ phiếu, báo cáo, thông báo), `005` sửa số liệu chi tiêu.

## Kiểm thử

```bash
npm test                    # Vitest: quy tắc Ủn, chuỗi ngày, heo lớn lên, câu báo lỗi
PW_CHANNEL=msedge npm run test:e2e   # Playwright trên bản dùng thử: luồng chính, 3 kích cỡ màn hình, khả năng truy cập (axe)
npm run test:db             # 70+ ca kiểm tra hàm server và phân quyền (cần .env.local, tự tạo và xoá tài khoản thử)
npm run test:real           # Playwright trên bản thật với Supabase: tạo gia đình, realtime, thêm/sửa/xoá, hoàn tác (cần `npm run build && npm start -- -p 3300`)
```

`PW_CHANNEL` đặt `msedge` hoặc `chrome` để dùng trình duyệt có sẵn, không cần tải Chromium của Playwright.

## Triển khai

Đẩy lên nhánh `main` là Vercel tự build. Cron nhắc hằng ngày cấu hình trong `vercel.json` (08:00 và 19:30 giờ Việt Nam).

Tên miền, đăng nhập Google và URL quay về cấu hình ở: Google Cloud (OAuth client) và Supabase (Authentication → Providers, URL Configuration).

## Lưu ý về vùng đặt máy chủ

Supabase hiện đặt ở `us-east-1` (Mỹ) nên mỗi lệnh từ Việt Nam mất khoảng 270 ms. Giao diện cập nhật ngay nên ít nhận ra,
nhưng đặt ở Singapore (`ap-southeast-1`) sẽ nhanh hơn khoảng 4 lần. Chuyển vùng cần tạo project Supabase mới, chạy lại migration
rồi cấu hình lại Google và URL quay về.

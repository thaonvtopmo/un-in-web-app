# Admin tổng của Ủn Ỉn: các đợt và tiến độ

Cập nhật 05/10/2026. Ký hiệu: ✅ đã làm xong và kiểm thử, ⏳ chưa làm, 🟡 làm một phần.

## 1. Đã chốt với chủ app
| Câu hỏi | Quyết định |
|---|---|
| Ai là admin | Chỉ chủ app. Hiện **chưa thêm email admin nào** (danh sách để trống), sẽ thêm khi cần dùng |
| Vai trò | Có sẵn 2 vai trò trong database: `owner` (chủ) và `support` (hỗ trợ, dành cho sau này) |
| "Xem như chủ nhà" để hỗ trợ | Có, làm ở đợt 2: phải nhập lý do, giới hạn 30 phút, chỉ đọc, ghi nhật ký |
| Thu phí | Chưa cần, chưa thiết kế gói dịch vụ |
| Ưu tiên đợt 1 | Thống kê, đo lường, kiểm tra gói miễn phí |
| Thông báo hệ thống cho bố mẹ | Bổ sung sau |

## 2. Nguyên tắc
1. Admin thấy số liệu tổng hợp, **không đọc tên con, tên việc, lời khen**.
2. Mọi lần xem chi tiết một nhà và mọi thao tác quản trị đều ghi **nhật ký**, nhật ký chỉ đọc.
3. Quyền admin kiểm **ở máy chủ** (hàm database), không phụ thuộc vào giao diện. Khoá quản trị không bao giờ có trong trình duyệt.

## 3. Đợt 1: nền tảng và đo lường

| Chức năng | Trạng thái | Ghi chú |
|---|---|---|
| Danh sách admin (`app_admins`) và kiểm quyền ở máy chủ | ✅ | Người thường gọi hàm admin đều bị từ chối `not_admin`, không đọc được các bảng quản trị |
| Đăng nhập trang `/admin` bằng Google | ✅ | Chưa đăng nhập thì chỉ thấy nút đăng nhập; tài khoản không có quyền thấy "Không có quyền quản trị" |
| Tổng quan: số nhà, thành viên, bé, nhà mới 7/30 ngày, hoạt động 1/7/30 ngày, nhà ngủ đông, thiết bị thông báo, việc nộp và gật đầu hôm nay | ✅ | |
| Đồng hồ gói miễn phí | ✅ | Dung lượng database là **số thật**. Băng thông tháng và kết nối realtime là **ước tính** (có nhãn "ước tính") |
| Dự báo "còn chứa thêm khoảng N nhà" | ✅ | Ước tính theo ~3,6 MB mỗi nhà mỗi năm |
| Bảng dữ liệu chiếm chỗ nhiều nhất | ✅ | 8 bảng lớn nhất, dung lượng và số dòng |
| Thống kê chụp mỗi đêm (`usage_daily`) và biểu đồ xu hướng 30 ngày | ✅ | Cron 21:00 giờ Việt Nam, kèm nút "Chụp số liệu ngay". Biểu đồ đầy dần theo ngày |
| Danh sách gia đình: tìm theo tên hoặc email chủ nhà, lọc trạng thái (đang dùng, mới, ít dùng, ngủ đông), tải thêm | ✅ | |
| Chi tiết một nhà: số liệu, cài đặt, hoạt động 14 ngày | ✅ | Không có tên con, tên việc, lời khen, PIN |
| Nhật ký admin | ✅ | Ghi ai, lúc nào, làm gì, nhà nào. Admin không xoá hay sửa được |
| Giao diện dùng được trên điện thoại | ✅ | |

**Kiểm thử đợt 1:** 38 kiểm tra database (quyền, riêng tư, nhật ký, thống kê), 17 kiểm tra trình duyệt thật trên tên miền chính thức (chưa đăng nhập, tài khoản thường, admin, điện thoại). Toàn bộ đạt.

### Cách thêm hoặc bỏ admin (khi cần)
Vào Supabase, mục SQL Editor, chạy:

```sql
-- thêm chủ
insert into public.app_admins (email, role) values ('email-cua-ban@gmail.com', 'owner');
-- bỏ
delete from public.app_admins where email = 'email-cua-ban@gmail.com';
```
Sau đó đăng nhập đúng Gmail đó rồi mở `www.minhchihub.vn/admin`. Quyền có hiệu lực ngay.

### Điều cần biết về số liệu
- **"Hoạt động" nghĩa là có ghi nhận việc nộp, ghi sổ Ủn hoặc giờ chơi.** App chưa ghi lại việc "chỉ mở app xem", nên nhà chỉ mở xem sẽ chưa được tính là hoạt động. Ghi thêm "lần mở app cuối" là việc của đợt 2.
- **Băng thông và kết nối realtime là ước tính** từ số nhà hoạt động (~52 MB mỗi nhà mỗi tháng, ~2,5 thiết bị mỗi nhà). Số thật xem ở bảng điều khiển Supabase và Vercel; Supabase không cho đọc số này từ database.
- **Dung lượng mỗi nhà là ước tính** theo số dòng dữ liệu (kích thước trung bình đã đo), không phải số đo chính xác từng nhà.
- Biểu đồ xu hướng chỉ có số liệu từ khi cron 21:00 bắt đầu chạy với bản này.

## 4. Đợt 2: hỗ trợ và vận hành (chưa làm)
| Chức năng | Trạng thái | Ghi chú |
|---|---|---|
| Xem như chủ nhà (chỉ đọc) | ⏳ | Nhập lý do, giới hạn 30 phút, ghi nhật ký, có banner nhắc đang ở chế độ hỗ trợ |
| Khoá và mở một nhà | ⏳ | |
| Đặt lại PIN khi bố mẹ quên | ⏳ | Đồng thời giải quyết mục "quên PIN" trong bản đồ tính năng |
| Xoá nhà theo yêu cầu | ⏳ | Xác nhận 2 lần, xuất dữ liệu trước |
| Nhật ký lỗi lưu trong database | ⏳ | Hiện lỗi chỉ nằm ở log Vercel và mất sau 1 giờ |
| Ghi "lần mở app cuối" của mỗi nhà | ⏳ | Để biết nhà nào thật sự còn dùng |
| Kiểm tra sức khoẻ hệ thống | ⏳ | Cron có chạy không, giọng AI còn hoạt động không, database sắp bị tạm dừng không |
| Chống Supabase tạm dừng khi 1 tuần không ai dùng | ⏳ | Tự gọi database định kỳ |
| Thông báo hệ thống cho bố mẹ (banner, thông báo đẩy hàng loạt) | ⏳ | Cần cơ chế người dùng đồng ý nhận |
| Thêm admin phụ (vai trò Hỗ trợ) ngay trên giao diện | ⏳ | Hiện thêm bằng SQL |

## 5. Đợt 3: phát triển lâu dài (chưa làm)
| Chức năng | Trạng thái |
|---|---|
| Cờ bật/tắt tính năng toàn hệ thống hoặc từng nhà | ⏳ |
| Hộp góp ý trong app và màn xử lý | ⏳ |
| Duyệt tên nhà trên bảng xếp hạng | ⏳ |
| Sao lưu và khôi phục theo từng nhà, xuất dữ liệu cho phụ huynh | ⏳ |
| Thư viện mẫu việc theo độ tuổi quản lý chung | ⏳ |
| Phân tích giữ chân người dùng (nhà bỏ dùng sau bao lâu) | ⏳ |
| Khung gói dịch vụ và thanh toán | ⏳ (chưa cần) |

## 6. Phần kỹ thuật (để người làm tiếp)
- Migration `supabase/migrations/013_admin.sql`.
- Bảng: `app_admins`, `admin_audit`, `usage_daily`. Cả ba **không có quyền đọc/ghi cho trình duyệt**, chỉ truy cập qua hàm.
- Hàm cho admin: `admin_role`, `admin_overview`, `admin_series`, `admin_families`, `admin_family`, `admin_audit_list`, `admin_snapshot_now`. Mỗi hàm tự kiểm `admin_role()` và ghi nhật ký khi mở chi tiết nhà.
- Hàm cho cron (chỉ khoá service role): `admin_snapshot`, gọi trong `/api/cron/daily-summary` mỗi 21:00.
- Giao diện: `app/admin/page.tsx` (không cho công cụ tìm kiếm lập chỉ mục) và `components/admin/AdminApp.tsx`.
- Kiểm thử: `node scripts/db-test.mjs` (mục "Admin tổng"), `node scripts/e2e-real-admin.mjs <thư mục dự án> <thư mục ảnh> <địa chỉ>` (tự tạo rồi dọn tài khoản thử).

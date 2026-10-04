# Ủn Ỉn Cả Nhà: báo cáo tổng quan (10/2026)

## 1. Hiện app làm được gì

**Cho cả nhà**
- Đăng nhập bằng 1 Gmail cho cả nhà; các con không cần tài khoản. Chọn người rồi vào; bố mẹ cần PIN (kiểm tra ở máy chủ, sai 5 lần khoá 5 phút).
- Đồng bộ thời gian thực giữa điện thoại, máy tính bảng, máy tính. Cài lên màn hình chính (PWA). Thông báo đẩy khi con làm xong việc, con đổi phiếu, nhắc mỗi ngày.
- Bảng xếp hạng các nhà (tuỳ chọn, chỉ hiện tên nhà và Ủn trung bình).

**Cho con**
- Trang chủ: heo Ủn lớn lên 4 cấp theo chuỗi ngày, việc hôm nay, Hũ Mơ Ước.
- Việc tốt theo buổi (sáng, chiều, tối), có hạn hoàn thành nếu bố mẹ đặt; màn ăn mừng kèm lời khen.
- Đổi phiếu đi chơi (3 tầng giá), Đường đua (bục, kèo, so với tuần trước), góp Hũ chung, chấm bố mẹ ("giám khảo"), lễ trao giải Chủ nhật.
- Nút Thoát ở mọi màn.

**Cho bố mẹ (Góc bố mẹ)**
- *Hằng ngày*: Gật đầu (lời khen, nhắc nhẹ, hoàn tác), Việc của tôi (checklist riêng có hạn, tự tick), Kế hoạch ngày (chọn tuần rồi chọn ngày, lặp lại hoặc một lần, giao đúng người), Hũ chung (bố mẹ cũng góp), Ngoéo tay (hẹn ngày, giữ lời, huỷ có hoàn Ủn).
- *Quản lý*: Báo cáo tuần, Việc tốt (kho việc), Phiếu đi chơi (đặt giá Ủn), Kèo cả nhà, Thành viên (đổi tên, màu, avatar), Cài đặt (giờ Ủn Ỉn, giới hạn phút (đang tắt), hũ, PIN, thông báo, xếp hạng).

## 2. Dung lượng gói miễn phí (số liệu chính thức + đo thực tế)

Giới hạn chính thức: Supabase Free (500 MB database, 5 GB egress, 200 kết nối realtime cùng lúc, 2 triệu tin realtime/tháng, 50.000 người dùng/tháng, tạm dừng nếu 1 tuần không hoạt động, không sao lưu). Vercel Hobby (100 GB băng thông, 1 triệu yêu cầu CDN, 1 triệu lần gọi hàm, 4 giờ CPU, cron mỗi ngày một lần, nhật ký 1 giờ, chỉ dùng phi thương mại).

Đo thực tế (gia đình 2 bố mẹ + 2 bé, mỗi ngày 18 lượt việc và 26 dòng sổ Ủn):
- Một dòng việc: 149 B (kèm chỉ mục ~296 B). Một dòng sổ Ủn: 112 B (kèm chỉ mục ~180 B).
- Mỗi gia đình thêm khoảng 3,6 MB database mỗi năm (dùng đều); nền hiện tại 13 MB.
- Mỗi lần app tải lại dữ liệu: 31 KB nén (60 ngày dữ liệu), mất khoảng 0,3 giây mạng (máy chủ đang ở Mỹ).

Ước tính số gia đình tối đa (dùng đều mỗi ngày):

| Hạn mức | Cách tính | Số gia đình |
|---|---|---|
| Dung lượng database 500 MB | 487 MB / 3,6 MB mỗi năm | ~135 nhà sau 1 năm; ~45 nhà sau 3 năm |
| Egress 5 GB/tháng | ~56 lần tải/ngày x 31 KB = ~52 MB/nhà/tháng | ~95 nhà |
| Kết nối realtime 200 | 2-3 thiết bị/nhà, đa số mở cùng lúc 19:30-19:45 | ~70-130 nhà |
| Tin realtime 2 triệu/tháng | ~10.000 tin/nhà/tháng | ~200 nhà |
| Vercel (băng thông, CDN, hàm, CPU) | dư rất nhiều | hàng nghìn nhà (CPU hàm: ~650) |
| Người dùng 50.000/tháng | 1 Gmail/nhà | không phải giới hạn |

Kết luận: khoảng **90-130 gia đình dùng đều** là trần thực tế của bản miễn phí; nút thắt đầu tiên là egress và kết nối realtime giờ vàng, rồi dung lượng database sau 1-2 năm.

## 3. Rủi ro cần xử lý sớm
1. Supabase Free **tạm dừng sau 1 tuần không hoạt động** và **không có sao lưu**.
2. Máy chủ dữ liệu ở Mỹ (us-east-1): mỗi lệnh ~270 ms từ Việt Nam. Singapore sẽ nhanh gấp ~4 lần.
3. Vercel Hobby chỉ cho dùng phi thương mại; thu phí thì cần Pro.
4. Nhật ký Vercel chỉ giữ 1 giờ.

## 4. Lộ trình bản sau

**Chức năng (ưu tiên từ trên xuống)**
1. Hiệu năng và chi phí: tải nhẹ hơn (cửa sổ 14 ngày, cập nhật từng phần), dọn dữ liệu cũ, chuyển Singapore, sao lưu tự động, ping giữ cho dự án không bị tạm dừng. Mục tiêu: 300-400 gia đình trên bản miễn phí.
2. Nhắc giờ: thông báo trước hạn cho việc riêng của bố mẹ.
3. Thưởng linh hoạt: Ủn thưởng thêm có lý do, tự động bỏ một phần Ủn vào hũ, mục tiêu tiết kiệm riêng của bé, lời khen tự gõ.
4. Việc: luân phiên (tuần này con A, tuần sau con B), mẫu việc theo độ tuổi, ghi chú, ảnh minh chứng (cân nhắc quyền riêng tư).
5. Người lớn thứ ba (ông bà): mời qua đường dẫn, quyền hạn chế.
6. Báo cáo: so sánh tháng, xuất CSV hoặc PDF.
7. Giờ vàng nâng cao: nhiều khung giờ, ngày cuối tuần khác, chế độ nghỉ.
8. Quên PIN: khôi phục bằng Gmail; đăng nhập phụ bằng email.
9. Quản trị: bảng theo dõi số nhà, lỗi.

**Giao diện (đã làm đợt này)**: tab Góc bố mẹ chia nhóm Hằng ngày / Quản lý, thanh điều hướng dưới cùng trên điện thoại, form Thêm việc gọn (biểu tượng gập, hai nút Việc lặp lại / Việc một lần), hàng danh sách nhẹ hơn, trạng thái trống có hình heo, thẻ "Bắt đầu nhanh" cho gia đình mới.

**Giao diện (để bản sau)**: chế độ tối, cỡ chữ lớn, hướng dẫn lần đầu cho bé, bộ icon và minh hoạ riêng thay emoji, hiệu ứng và âm thanh nhẹ (tắt được), khung chờ (skeleton), tìm kiếm và thao tác hàng loạt trong kho việc, kéo thả sắp xếp, thử nghiệm với người dùng thật.

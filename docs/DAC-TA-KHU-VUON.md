# Đặc tả: Khu vườn Ủn (game trồng cây cho các bé)

Bản nháp 05/10/2026, **chưa làm**. Mục đích: chốt luật chơi, kinh tế game và phạm vi trước khi viết code. Những chỗ ghi **[CẦN CHỐT]** là điều mình đã tự diễn giải và cần bạn xác nhận.

## 1. Mục tiêu
Biến việc làm việc tốt từ "làm nhiệm vụ nhận điểm" thành "chăm lớn một khu vườn của riêng mình", để các bé có cảm giác sở hữu và thi đua lành mạnh. Đổi phiếu đi chơi ngoài đời **vẫn giữ nguyên**, game là lớp phía trên.

Vòng chơi: **làm việc tốt được gật đầu → có giọt nước → tưới cho cây → cây lớn, ra quả → thu hoạch nhận Ủn và sticker → mua hạt giống mới, chậu, đồ trang trí → khoe vườn, được bố mẹ ghé thăm.**

## 2. Các quyết định đã chốt
| # | Nội dung | Quyết định |
|---|---|---|
| 1 | Lõi của game | Trồng cây trước, vật nuôi để bản sau |
| 2 | Tiền trong game | **Dùng chung một ví Ủn.** Giá trong cửa hàng ghi bằng **xu**, quy ước **10 Ủn = 1 xu** **[CẦN CHỐT cách hiểu, xem mục 4]** |
| 3 | Loại cây | Nhiều loài, mỗi loài mang một tên đức tính tích cực, bán trong cửa hàng |
| 4 | Hũ Mơ Ước | Giữ nguyên, vẫn là hoạt động chung của cả nhà |
| 5 | Hình ảnh | Vẽ bộ SVG riêng, cùng phong cách heo Ủn |
| 6 | Thi đua | Mỗi bé một khu vườn riêng, đua cá nhân (không có cây chung) |

## 3. Nguyên tắc thiết kế
1. **Cây lớn nhờ công sức, không nhờ tiền.** Tiền chỉ mua đồ và hạt giống, không mua được độ lớn của cây.
2. **Không có cây chết.** Bỏ bê vài ngày thì cây "buồn", tưới lại là tươi. Không tạo cảm giác có lỗi.
3. **Công bằng giữa các bé.** Bảng thi đua tính theo tỉ lệ việc được giao đã làm và số ngày chăm đều, không tính theo tổng số Ủn hay số cây.
4. **An toàn.** Không trò chuyện, không tiền thật, không quảng cáo. Bố mẹ bật/tắt game và đặt trần chi tiêu được.
5. **Phần thưởng thật vẫn là đích đến.** Giá đồ trong vườn thấp hơn phiếu đi chơi để bé không bỏ phiếu đi chơi.

## 4. Tiền và nước
**Ví.** Số dư vẫn là Ủn. Cửa hàng vườn ghi giá bằng xu: **1 xu = 10 Ủn**. Ví dụ hạt giống 5 xu = trừ 50 Ủn. Giữ một ví để không phải học hai loại tiền; cách ghi xu giúp các con số gọn (5 xu thay vì 50 Ủn).
> **[CẦN CHỐT]** Mình hiểu "dùng chung, 10 Ủn = 1 xu" là một ví duy nhất. Nếu bạn muốn một bước "đổi Ủn thành xu" riêng thì báo mình, vì sẽ thành hai ví.

**Giọt nước** (thứ làm cây lớn):
- Mỗi việc được gật đầu = **1 giọt**; việc làm cùng bố mẹ = **2 giọt**.
- Bé có khoảng 6 đến 9 việc mỗi ngày, tức khoảng 6 đến 12 giọt mỗi ngày.
- Bình nước tích dần, bé **tự tưới** cho cây nào tuỳ ý. Đây là nghi thức hằng ngày, và là chỗ bé quyết định chăm cây nào.
- Số giọt có được tính từ số việc được gật đầu, nên hoàn tác gật đầu thì số nước kiếm được giảm theo (cây đã lớn không lùi lại).

## 5. Cây
Mỗi cây có 6 giai đoạn: **hạt → mầm → cây con → cây lớn → ra hoa → ra quả**, nhảy giai đoạn ở 10%, 25%, 50%, 80%, 100% tổng số nước cần.

Bản đầu có 6 loài (mỗi loài 5 hình), bản sau thêm 4 loài:

| Loài (tên đức tính) | Hình gợi ý | Giá | Tốc độ | Nước cần | Quả (thưởng) | Bản |
|---|---|---|---|---|---|---|
| Cây Hy vọng | mầm vàng | **Miễn phí** (cây đầu tiên của mỗi bé) | nhanh | 40 | 20 Ủn | 1 |
| Cây Chăm chỉ | hướng dương | 5 xu | vừa | 70 | 40 Ủn | 1 |
| Cây Ngoan ngoãn | hoa cúc | 5 xu | nhanh | 40 | 30 Ủn | 1 |
| Cây Kỷ luật | tre | 8 xu | vừa | 70 | 50 Ủn | 1 |
| Cây Dũng cảm | xương rồng ra hoa | 8 xu | vừa | 70 | 50 Ủn | 1 |
| Cây Kiên nhẫn | cây sồi | 12 xu | chậm | 120 | **Quả vàng** (120 Ủn) | 1 |
| Cây Biết ơn | hoa anh đào | 10 xu | vừa | 70 | 60 Ủn | 2 |
| Cây Tử tế | cây táo | 10 xu | vừa | 70 | 60 Ủn | 2 |
| Cây Trung thực | cây bồ đề | 10 xu | chậm | 120 | Quả vàng | 2 |
| Cây Sáng tạo | cây cầu vồng | 15 xu | chậm | 120 | Quả vàng | 2 |

- **Quả luôn thấp hơn giá cây** (khoảng 60 đến 100%) để tiền đi ra khỏi hệ thống chứ không sinh thêm. Con số sẽ chỉnh khi chạy thử.
- **Quả vàng:** ngoài Ủn còn là một phiếu đặc biệt (bố mẹ cài sẵn món quà nhỏ ngoài đời).
- **Sau khi thu hoạch,** cây trở lại giai đoạn "cây lớn" và ra quả lần nữa sau khi tưới thêm 50% lượng nước. Cây nào cũng giữ được mãi.
- **Cây buồn:** 3 ngày không được tưới thì hiện vẻ buồn và dừng lớn. Tưới một lần là tươi lại.

## 6. Cửa hàng và vườn
- **Vườn:** bắt đầu 2 ô đất. Mở thêm ô: 10, 20, 40 xu (tối đa 6 ô, bản đầu cho 4 ô).
- **Hạt giống:** các loài ở mục 5.
- **Chậu:** đổi kiểu chậu cho cây, 3 đến 10 xu (chỉ để trang trí).
- **Đồ trang trí** (bản 2): hàng rào, đèn, ghế, tượng nhỏ, 2 đến 15 xu.
- **Trần chi tiêu mỗi tuần:** mặc định 30 xu (300 Ủn), bố mẹ chỉnh được, để bé vẫn dành Ủn cho phiếu đi chơi lớn.
- Cửa hàng vườn nằm cùng nơi với đổi phiếu đi chơi, tách thành hai ngăn: **Phiếu đi chơi** và **Hạt giống và chậu**.

## 7. Thi đua
- **Vườn đẹp của tuần** (mỗi Chủ nhật): xếp hạng giữa các bé trong nhà theo (1) tỉ lệ việc được giao đã làm, (2) số ngày tưới đều, (3) số cây lên giai đoạn mới. Dữ liệu lấy từ tổng kết ngày đã có.
- Người thắng nhận huy hiệu và một món trang trí riêng cho vườn.
- Chuỗi chăm đều (đã có) vẫn làm heo Ủn lớn lên.
- Bảng xếp hạng giữa các nhà vẫn là tuỳ chọn như hiện nay.

## 8. Thăm vườn (bản 2)
| Ai thăm | Làm được gì |
|---|---|
| Bố mẹ thăm vườn con | Xem cây, **tưới giúp 1 giọt** mỗi ngày mỗi vườn, cắm **tấm biển lời khen** (bé chạm vào để nghe giọng đọc, dùng lại tính năng lời khen) |
| Con thăm vườn bố mẹ | Xem cây của bố mẹ. Cây bố mẹ lớn nhờ việc tự tick và nhờ **con chấm Đạt** (giám khảo), nên con chấm càng nhiều cây bố mẹ càng tươi |
| Anh chị em thăm nhau | Xem và tưới giúp 1 giọt mỗi ngày. Không lấy được nước của nhau |

Mỗi lượt tưới giúp hiện thành dòng "Mẹ vừa tưới giúp Bin" để bé thấy được quan tâm.

## 9. Quyền của bố mẹ
- Bật/tắt Khu vườn cho cả nhà.
- Đặt trần chi tiêu tuần, xem lịch sử mua.
- Đặt quà cho "Quả vàng".
- Ẩn/hiện bảng "Vườn đẹp của tuần".

## 10. Giao diện
- Thêm tab **Vườn** cho bé với 3 ngăn: Vườn của con, Cửa hàng, Thăm vườn. Tưới nước bằng cách bấm vào cây.
- Thanh dưới cùng đang có 5 mục. Thêm Vườn sẽ thành 6, rất chật trên máy 360 px. Mình đề xuất đưa **Đường đua** vào trang Vườn dưới tên "Đua vườn" và nhường chỗ cho tab Vườn. Chốt khi làm mẫu giao diện.
- Heo Ủn là người trông vườn, nói câu nhắc ngắn ("Nước đầy rồi, tưới cây đi con!").
- Góc bố mẹ thêm mục **Vườn của các con** (xem, tưới giúp, cắm biển, chi tiêu).

## 11. Phần kỹ thuật
- **Tăng trưởng tính từ dữ liệu việc đã có**, không ghi thêm mỗi lần bé làm việc. Số giọt nước kiếm được = số việc được gật đầu từ khi bắt đầu chơi (việc làm cùng nhân đôi).
- **Bảng mới:** `plants` (cây đã trồng: chủ, loài, ô, số nước đã tưới, số lần thu hoạch, lần tưới cuối), `garden_items` (chậu và đồ đã mua, đã đặt chưa), `garden_gifts` (lượt tưới giúp, tấm biển, bản 2), cùng danh mục loài cây (viết trong mã ở bản đầu).
- **Hàm máy chủ:** mua đồ, trồng, tưới, thu hoạch, mở ô, tưới giúp. Mua đồ và thu hoạch ghi vào **sổ Ủn hiện có** (thêm loại ghi sổ "vườn"), nên số dư luôn khớp.
- **Chống gian lận:** trần chi tiêu tuần, giới hạn tưới giúp mỗi ngày, mọi phép tính ở máy chủ.
- **Realtime:** dùng kênh hiện có, bố mẹ tưới giúp thì máy bé thấy ngay.
- **Gói miễn phí:** dữ liệu rất nhỏ (vài chục dòng mỗi nhà), gần như không đổi ngưỡng đã tính.
- **Bản dùng thử và Admin:** chạy được cả trong bản dùng thử; trang Admin thêm số nhà đang chơi vườn.
- **Hình ảnh:** mỗi loài 5 hình giai đoạn, vẽ theo khung chung (cùng chậu, cùng cách đổ bóng) để thêm loài mới nhanh. Đây là phần tốn công nhất.

## 12. Lộ trình
| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 0 | Chốt đặc tả này, vẽ mẫu giao diện, chốt bộ hình và con số kinh tế | ⏳ |
| 1 (bản đầu) | Mỗi bé một vườn, 6 loài, mua/trồng/tưới/thu hoạch, mở ô, chậu, trần chi tiêu, bố mẹ xem vườn con, bé tự tưới | ⏳ |
| 2 | Thăm vườn (bố mẹ, con, anh chị em), tưới giúp, tấm biển lời khen, vườn bố mẹ, đồ trang trí, 4 loài mới, Vườn đẹp của tuần | ⏳ |
| 3 | Vật nuôi, sự kiện theo mùa, huy hiệu, thành tích | ⏳ |

## 13. Những điều còn mở
1. Cách hiểu "10 Ủn = 1 xu" ở mục 4 (một ví, giá ghi bằng xu).
2. Việc làm cùng bố mẹ được 2 giọt có hợp lý không.
3. Bé có tưới được khi hết giờ vàng không (hiện giờ vàng đang tắt giới hạn nên mặc định là có).
4. Danh sách loài và tên đức tính của bản đầu, có muốn đổi tên nào không.
5. Tên và hình của linh vật trông vườn (dùng heo Ủn hiện tại hay thêm nhân vật mới).
6. Con số kinh tế (giá, nước cần, quả) là đề xuất, sẽ chỉnh khi chạy thử với các bé thật.

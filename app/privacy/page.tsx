import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư · Ủn Ỉn Cả Nhà",
  description: "Ủn Ỉn Cả Nhà thu thập, dùng và bảo vệ dữ liệu của gia đình bạn như thế nào.",
};

const UPDATED = "04/10/2026";
const CONTACT = "thaonv.topmo@gmail.com";

export default function Privacy() {
  return (
    <main className="app" style={{ maxWidth: 720 }}>
      <Link href="/" className="muted">← Về Ủn Ỉn Cả Nhà</Link>
      <h1>Chính sách quyền riêng tư</h1>
      <p className="muted">Cập nhật lần cuối: {UPDATED}</p>

      <div className="card stack" style={{ gap: 14, padding: 18, fontWeight: 600, lineHeight: 1.6 }}>
        <p>
          <b>Ủn Ỉn Cả Nhà</b> là ứng dụng web giúp bố mẹ và con cùng làm việc tốt hằng ngày, tích Ủn và đổi thành thời gian đi chơi cùng nhau.
          Trang này giải thích ứng dụng thu thập những gì, dùng để làm gì và bạn kiểm soát dữ liệu của mình ra sao.
        </p>

        <h2>1. Dữ liệu chúng tôi thu thập</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li><b>Tài khoản Google:</b> khi bố hoặc mẹ đăng nhập bằng Google, chúng tôi nhận địa chỉ email, tên hiển thị và mã định danh tài khoản. Chúng tôi không nhận mật khẩu Google và không đọc Gmail, danh bạ hay Drive của bạn.</li>
          <li><b>Thông tin gia đình do bạn nhập:</b> tên gia đình, tên (hoặc biệt danh) của bố mẹ và các con, màu đại diện, các việc tốt, phiếu đi chơi, mục tiêu hũ chung.</li>
          <li><b>Hoạt động trong ứng dụng:</b> việc tốt đã làm, lời khen, số Ủn kiếm và tiêu, phiếu đã đổi, thời gian con dùng ứng dụng mỗi ngày.</li>
          <li><b>PIN của bố mẹ:</b> chỉ lưu dưới dạng mã băm một chiều (bcrypt), không ai đọc lại được PIN gốc.</li>
        </ul>
        <p>Các con không cần tài khoản riêng và ứng dụng không yêu cầu họ tên đầy đủ, ngày sinh, ảnh hay vị trí của trẻ. Chúng tôi khuyên bố mẹ dùng biệt danh cho các bé.</p>

        <h2>2. Chúng tôi dùng dữ liệu để làm gì</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Đăng nhập và giữ phiên đăng nhập của gia đình.</li>
          <li>Vận hành các tính năng: nhận việc, gật đầu, đổi phiếu, hũ chung, giờ Ủn Ỉn và giới hạn thời gian dùng.</li>
          <li>Đồng bộ giữa các thiết bị của cùng một gia đình.</li>
          <li>Hiển thị bảng xếp hạng các nhà (nếu gia đình đồng ý tham gia).</li>
        </ul>
        <p>Chúng tôi <b>không bán</b> dữ liệu, <b>không chạy quảng cáo</b> và không dùng dữ liệu của trẻ để theo dõi hay lập hồ sơ quảng cáo.</p>

        <h2>3. Bảng xếp hạng các nhà</h2>
        <p>
          Nếu gia đình bật tham gia, các nhà khác chỉ thấy <b>tên gia đình</b>, số Ủn tuần này, số thành viên và số Ủn trung bình mỗi người.
          Tên và hoạt động của từng thành viên không bao giờ hiển thị. Vì tên gia đình có thể được người khác nhìn thấy, xin đừng dùng họ tên đầy đủ của bé làm tên gia đình.
          Bố mẹ có thể tắt tham gia bất kỳ lúc nào trong Góc bố mẹ → Cài đặt.
        </p>

        <h2>4. Nơi lưu trữ và bên xử lý dữ liệu</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li><b>Supabase</b>: cơ sở dữ liệu và dịch vụ đăng nhập.</li>
          <li><b>Vercel</b>: máy chủ chạy ứng dụng web.</li>
          <li><b>Google</b>: xác thực khi đăng nhập bằng Google.</li>
        </ul>
        <p>Dữ liệu được truyền qua kết nối mã hoá HTTPS. Mỗi gia đình chỉ truy cập được dữ liệu của chính mình nhờ các quy tắc phân quyền ở cấp cơ sở dữ liệu.</p>

        <h2>5. Dữ liệu của trẻ em</h2>
        <p>
          Ứng dụng dành cho bố mẹ quản lý và cùng chơi với con. Tài khoản chỉ do người lớn tạo và chịu trách nhiệm.
          Chúng tôi không liên hệ trực tiếp với trẻ và không thu thập thông tin ngoài những gì bố mẹ tự nhập.
        </p>

        <h2>6. Quyền của bạn</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Xoá một thành viên (và lịch sử của thành viên đó) ngay trong Góc bố mẹ → Thành viên.</li>
          <li>Yêu cầu xem, sửa hoặc xoá toàn bộ dữ liệu gia đình bằng cách gửi email cho chúng tôi từ địa chỉ Gmail đã đăng ký.</li>
          <li>Thu hồi quyền đăng nhập bằng Google tại <a href="https://myaccount.google.com/permissions" rel="noopener noreferrer">myaccount.google.com/permissions</a>.</li>
        </ul>
        <p>Chúng tôi giữ dữ liệu cho đến khi bạn yêu cầu xoá hoặc ngừng sử dụng dịch vụ.</p>

        <h2>7. Thay đổi chính sách</h2>
        <p>Khi có thay đổi quan trọng, chúng tôi sẽ cập nhật trang này và đổi ngày ở đầu trang.</p>

        <h2>8. Liên hệ</h2>
        <p>Mọi câu hỏi hoặc yêu cầu về dữ liệu, vui lòng gửi email tới <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </div>
    </main>
  );
}

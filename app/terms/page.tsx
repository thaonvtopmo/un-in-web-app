import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Điều khoản sử dụng · Ủn Ỉn Cả Nhà",
  description: "Điều khoản khi sử dụng ứng dụng Ủn Ỉn Cả Nhà.",
};

const UPDATED = "04/10/2026";
const CONTACT = "thaonv.topmo@gmail.com";

export default function Terms() {
  return (
    <main className="app" style={{ maxWidth: 720 }}>
      <Link href="/" className="muted">← Về Ủn Ỉn Cả Nhà</Link>
      <h1>Điều khoản sử dụng</h1>
      <p className="muted">Cập nhật lần cuối: {UPDATED}</p>

      <div className="card stack" style={{ gap: 14, padding: 18, fontWeight: 600, lineHeight: 1.6 }}>
        <h2>1. Về dịch vụ</h2>
        <p>
          Ủn Ỉn Cả Nhà là ứng dụng giúp gia đình cùng làm việc tốt và đi chơi cùng nhau. &quot;Ủn&quot; chỉ là điểm thưởng trong ứng dụng,
          không có giá trị quy đổi thành tiền và không thể mua bán hay chuyển nhượng.
        </p>

        <h2>2. Tài khoản</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Tài khoản do người lớn đăng ký bằng Google và chịu trách nhiệm về mọi hoạt động của gia đình trong ứng dụng.</li>
          <li>Hãy giữ kín PIN bố mẹ. Ai biết PIN đều có thể vào Góc bố mẹ.</li>
          <li>Mỗi tài khoản Google tạo được một gia đình.</li>
        </ul>

        <h2>3. Sử dụng hợp lý</h2>
        <p>
          Vui lòng không nhập nội dung xúc phạm, vi phạm pháp luật hoặc thông tin nhận dạng của người khác vào tên gia đình, tên thành viên,
          việc tốt hay phiếu. Chúng tôi có thể ẩn nội dung không phù hợp (ví dụ tên gia đình trên bảng xếp hạng) hoặc tạm khoá tài khoản vi phạm.
        </p>

        <h2>4. Giới hạn trách nhiệm</h2>
        <p>
          Ứng dụng được cung cấp &quot;nguyên trạng&quot; và có thể gián đoạn khi bảo trì. Phần thưởng thật (các chuyến đi chơi, hoạt động) do bố mẹ tự thực hiện.
          Chúng tôi không chịu trách nhiệm về việc thực hiện hay không thực hiện các lời hứa trong gia đình.
        </p>

        <h2>5. Dữ liệu cá nhân</h2>
        <p>Cách chúng tôi xử lý dữ liệu được nêu trong <Link href="/privacy">Chính sách quyền riêng tư</Link>.</p>

        <h2>6. Liên hệ</h2>
        <p>Thắc mắc về điều khoản, vui lòng gửi email tới <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
      </div>
    </main>
  );
}

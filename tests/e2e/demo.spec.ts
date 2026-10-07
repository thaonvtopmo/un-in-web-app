import { expect, test } from "@playwright/test";

/** Chạy trên bản dùng thử (không cần Supabase): kiểm tra luồng chính từ con tới bố mẹ */
test("con nộp việc, bố gật đầu, hoàn tác, huỷ phiếu, báo cáo, quản lý việc tốt", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Ai vào chơi với Ủn nè?")).toBeVisible();

  // Con
  await page.getByRole("button", { name: /Bin/ }).first().click();
  await page.getByText("Bỏ Ủn vào bụng heo").click(); // Ủn chưa xem từ trước
  await expect(page.getByText("Chào Bin!")).toBeVisible();
  await page.getByRole("button", { name: "Xong rồi nè!" }).first().click();
  await expect(page.getByText("Đã gửi! Chờ bố mẹ gật đầu nhé")).toBeVisible();

  await page.locator("nav").getByRole("button", { name: "Đi chơi" }).click();
  await page.getByRole("button", { name: /Đổi · 30 Ủn/ }).click();
  await expect(page.getByText("Đổi phiếu thành công!")).toBeVisible();
  await page.getByText("Yeah!").click();

  // Bố mẹ: PIN sai rồi đúng
  await page.getByRole("button", { name: /Thoát/ }).click(); // nút Thoát ở thanh trên cùng của con
  await expect(page.getByText("Ai vào chơi với Ủn nè?")).toBeVisible();
  await page.getByRole("button", { name: /^Bố/ }).first().click();
  for (const d of "0000") await page.keyboard.press(d);
  await expect(page.getByText("Sai PIN rồi, thử lại nhé")).toBeVisible();
  for (const d of "1234") await page.keyboard.press(d);
  await expect(page.getByText("Góc bố mẹ")).toBeVisible();

  await page.getByRole("button", { name: "Gật đầu" }).first().click();
  await expect(page.getByText(/Đã gật đầu/).first()).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Hoàn tác gật đầu/ }).first().click();
  await expect(page.getByText(/Đã hoàn tác/)).toBeVisible();

  await page.getByRole("tab", { name: /Ngoéo tay/ }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Huỷ phiếu" }).first().click();
  await expect(page.getByText(/hoàn Ủn cho con/)).toBeVisible();

  await page.getByRole("tab", { name: "Nhìn lại" }).click();
  await page.getByRole("tab", { name: "Tuần", exact: true }).click();
  await expect(page.getByText("Ủn cả nhà kiếm được")).toBeVisible();
  await expect(page.getByText("Từng người trong tuần")).toBeVisible();

  // Thêm, sửa, xoá việc tốt
  await page.getByRole("tab", { name: "Việc tốt" }).click();
  await page.getByPlaceholder("Ví dụ: Tự đánh răng").fill("Tự dọn giường");
  await page.getByRole("button", { name: "Thêm việc", exact: true }).click();
  await expect(page.getByText("Tự dọn giường")).toBeVisible();
  await page.getByRole("button", { name: "Sửa Tự dọn giường" }).click();
  await page.locator("form").filter({ has: page.getByRole("button", { name: "Lưu", exact: true }) }).locator('input[name="title"]').fill("Tự gấp chăn");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Tự gấp chăn")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Xoá Tự gấp chăn" }).click();
  await expect(page.getByText("Tự gấp chăn")).toHaveCount(0);
});

test("nút Thoát có ở mọi màn của con", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Bin/ }).first().click();
  await page.getByText("Bỏ Ủn vào bụng heo").click();
  for (const tab of ["Nhà", "Việc tốt", "Vườn", "Đi chơi", "Hũ Mơ Ước"]) {
    await page.locator("nav").getByRole("button", { name: tab }).click();
    await expect(page.getByRole("button", { name: /Thoát/ }), `thiếu nút Thoát ở ${tab}`).toBeVisible();
  }
  await page.getByRole("button", { name: /Thoát/ }).click();
  await expect(page.getByText("Ai vào chơi với Ủn nè?")).toBeVisible();
});

test("kế hoạch ngày: tắt một việc thì con không thấy, thêm việc riêng cho một ngày", async ({ page }) => {
  await page.goto("/");
  // bố vào tab Kế hoạch ngày
  await page.getByRole("button", { name: /^Bố/ }).first().click();
  for (const d of "1234") await page.keyboard.press(d);
  await page.getByRole("tab", { name: "Kế hoạch ngày" }).click();
  await expect(page.getByText(/việc cho con/)).toBeVisible();
  const row = page.getByLabel("Dậy trước 6h30: làm vào hôm nay");
  await expect(row).toBeChecked();
  await row.uncheck();
  await expect(row).not.toBeChecked();
  // thêm việc chỉ cho hôm nay
  await page.getByRole("button", { name: "Thêm việc", exact: true }).click();
  await page.getByPlaceholder("Ví dụ: Tự đánh răng").fill("Tưới cây cùng bố");
  await page.getByRole("button", { name: "Thêm việc", exact: true }).click();
  await expect(page.getByLabel("Tưới cây cùng bố: làm vào hôm nay")).toBeChecked();
  // sang ngày mai: việc riêng của hôm nay không có, việc đã tắt hôm nay vẫn bật theo lịch lặp
  await page.getByRole("button", { name: "Ngày mai", exact: true }).click();
  await expect(page.getByLabel("Tưới cây cùng bố: làm vào ngày mai")).toHaveCount(0);
  await expect(page.getByLabel("Dậy trước 6h30: làm vào ngày mai")).toBeChecked();
  // con: không còn thấy "Dậy trước 6h30", thấy việc mới
  await page.getByRole("button", { name: "Thoát" }).first().click();
  await page.getByRole("button", { name: /Bin/ }).first().click();
  await page.getByText("Bỏ Ủn vào bụng heo").click();
  await page.locator("nav").getByRole("button", { name: "Việc tốt" }).click();
  await expect(page.getByText("Tưới cây cùng bố")).toBeVisible();
  await expect(page.getByText("Dậy trước 6h30")).toHaveCount(0);
});

test("Việc của tôi: bố thêm việc riêng có hạn, tự tick xong", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Bố/ }).first().click();
  for (const d of "1234") await page.keyboard.press(d);
  await page.getByRole("tab", { name: "Việc của tôi" }).click();
  await expect(page.getByRole("heading", { name: "Việc của Bố" })).toBeVisible();
  await page.getByRole("button", { name: "Thêm việc", exact: true }).click();
  await page.getByPlaceholder("Ví dụ: Tự đánh răng").fill("Gửi báo giá cho khách");
  await expect(page.getByRole("radio", { name: "Việc một lần" })).toBeChecked();
  await page.locator('input[name="due"]').fill("17:30");
  await page.locator('input[name="est"]').fill("45");
  await page.getByRole("button", { name: "Thêm việc", exact: true }).click();
  await expect(page.getByText("Gửi báo giá cho khách")).toBeVisible();
  await expect(page.getByText(/trước 17:30 · ~45 phút/)).toBeVisible();
  await expect(page.getByText("0/1 xong")).toBeVisible();
  await page.getByLabel("Gửi báo giá cho khách: đã xong").check();
  await expect(page.getByText("1/1 xong")).toBeVisible();
  // việc làm một lần không nằm trong kho việc
  await page.getByRole("tab", { name: "Việc tốt" }).click();
  await expect(page.getByText("Gửi báo giá cho khách")).toHaveCount(0);
  // việc lặp lại thì nằm trong kho việc
  await page.getByRole("tab", { name: "Việc của tôi" }).click();
  await page.getByRole("button", { name: "Thêm việc", exact: true }).click();
  await page.getByPlaceholder("Ví dụ: Tự đánh răng").fill("Họp nhóm buổi sáng");
  await page.getByRole("radio", { name: "Việc lặp lại" }).click();
  await page.getByRole("button", { name: "T2–T6", exact: true }).click();
  await page.getByRole("button", { name: "Thêm việc", exact: true }).click();
  await page.getByRole("tab", { name: "Việc tốt" }).click();
  await expect(page.getByText("Họp nhóm buổi sáng")).toBeVisible();
});

test("Kế hoạch ngày: chọn \"chỉ lần này\" hoặc \"lưu vào kho việc\"", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Bố/ }).first().click();
  for (const d of "1234") await page.keyboard.press(d);
  await page.getByRole("tab", { name: "Kế hoạch ngày" }).click();
  await page.getByRole("button", { name: "Thêm việc", exact: true }).click();
  await page.getByPlaceholder("Ví dụ: Tự đánh răng").fill("Đi chợ cuối tuần");
  await page.getByRole("button", { name: "Bố mẹ", exact: true }).click(); // chỉ bố mẹ
  await expect(page.getByRole("radio", { name: /Tự đánh dấu/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: "Việc một lần" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Việc lặp lại" })).toBeVisible();
  await page.getByRole("button", { name: "Thêm việc", exact: true }).click();
  await expect(page.getByLabel("Đi chợ cuối tuần: làm vào hôm nay")).toBeChecked();
  await page.getByRole("tab", { name: "Việc tốt" }).click();
  await expect(page.getByText("Đi chợ cuối tuần")).toHaveCount(0); // chỉ lần này: không vào kho
});

test("bố mẹ góp vào Hũ chung từ Góc bố mẹ", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Bố/ }).first().click();
  for (const d of "1234") await page.keyboard.press(d);
  await page.getByRole("tab", { name: "Hũ chung" }).click();
  await expect(page.getByText("Cả nhà đang tích được")).toBeVisible();
  await expect(page.getByText(/Bố đang có/)).toBeVisible();
  await page.getByRole("button", { name: "20", exact: true }).click();
  await expect(page.getByText("Đã góp 20 Ủn vào hũ!")).toBeVisible();
  await expect(page.getByText("Góp gần đây")).toBeVisible();
  await expect(page.getByText(/Bố.*góp 20 Ủn/).first()).toBeVisible();
});

test("bố mẹ đổi avatar cho con", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Bố/ }).first().click();
  for (const d of "1234") await page.keyboard.press(d);
  await page.getByRole("tab", { name: "Thành viên" }).click();
  await page.getByRole("button", { name: "Sửa Bin" }).click();
  await page.getByRole("radio", { name: "Hình 🐯" }).click();
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Đã lưu thành viên")).toBeVisible();
  await page.getByRole("button", { name: "Thoát" }).first().click();
  await expect(page.getByRole("button", { name: /🐯/ }).first()).toBeVisible(); // avatar mới hiện ở màn chọn người
});

test("Góc bố mẹ trên điện thoại: thanh dưới cùng và mục Thêm", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: /^Bố/ }).first().click();
  for (const d of "1234") await page.keyboard.press(d);
  const nav = page.getByRole("navigation", { name: /điện thoại/ });
  await expect(nav).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Các mục của Góc bố mẹ" })).toBeHidden(); // thanh tab ngang chỉ dành cho màn rộng
  await nav.getByRole("button", { name: "Kế hoạch" }).click();
  await expect(page.getByText(/việc cho con/)).toBeVisible();
  await nav.getByRole("button", { name: "Thêm" }).click();
  await page.getByRole("dialog", { name: "Thêm mục" }).getByRole("button", { name: /Nhìn lại/ }).click();
  await page.getByRole("tab", { name: "Tuần", exact: true }).click();
  await expect(page.getByText("Ủn cả nhà kiếm được")).toBeVisible();
  for (const tab of ["Gật đầu", "Của tôi", "Kế hoạch", "Hũ chung"]) {
    await nav.getByRole("button", { name: tab }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(overflow, `tràn ngang ở ${tab}`).toBe(false);
  }
});

for (const [name, size] of [
  ["điện thoại", { width: 390, height: 844 }],
  ["máy tính bảng", { width: 820, height: 1180 }],
  ["máy tính", { width: 1440, height: 900 }],
] as const) {
  test(`không tràn ngang trên ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto("/");
    await page.getByRole("button", { name: /Bin/ }).first().click();
    await page.getByText("Bỏ Ủn vào bụng heo").click();
    for (const tab of ["Việc tốt", "Vườn", "Đi chơi", "Hũ Mơ Ước", "Nhà"]) {
      await page.locator("nav").getByRole("button", { name: tab }).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflow, `tràn ngang ở ${tab}`).toBe(false);
    }
  });
}

/* ---------- Đợt cập nhật: chọn buổi bằng nút, sửa/xoá việc, Nhìn lại, lời khen ---------- */
async function asParent(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Bố/ }).first().click();
  for (const d of "1234") await page.keyboard.press(d);
  await expect(page.getByText("Góc bố mẹ")).toBeVisible();
}

test("điện thoại: chọn buổi Sáng/Chiều/Tối bằng nút và thêm việc đúng buổi", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await asParent(page);
  const nav = page.getByRole("navigation", { name: /điện thoại/ });
  await nav.getByRole("button", { name: "Kế hoạch" }).click();
  await page.getByRole("button", { name: "Thêm việc" }).first().click();
  const slots = page.getByRole("radiogroup", { name: "Buổi" });
  await expect(slots).toBeVisible();
  for (const s of ["Sáng", "Chiều", "Tối"]) await expect(slots.getByRole("radio", { name: new RegExp(s) })).toBeVisible();
  expect(await page.locator("select").count()).toBe(0); // không còn danh sách thả xuống của hệ điều hành
  await slots.getByRole("radio", { name: /Tối/ }).click();
  await expect(slots.getByRole("radio", { name: /Tối/ })).toHaveAttribute("aria-checked", "true");
  await page.getByPlaceholder("Ví dụ: Tự đánh răng").fill("Xếp giày");
  await page.getByRole("button", { name: "Thêm việc" }).last().click();
  await expect(page.getByText("Đã thêm việc cho ngày này")).toBeVisible();
  await expect(page.locator(".plan-row", { hasText: "Xếp giày" }).getByText(/Tối/)).toBeVisible();
});

test("sửa và xoá việc ngay trong Kế hoạch ngày (kể cả việc một lần nhập sai)", async ({ page }) => {
  await asParent(page);
  await page.getByRole("tab", { name: "Kế hoạch ngày" }).click();
  await page.getByRole("button", { name: "Thêm việc" }).first().click();
  await page.getByPlaceholder("Ví dụ: Tự đánh răng").fill("Viec nhap sai");
  await page.getByRole("button", { name: "Thêm việc" }).last().click();
  await expect(page.getByText("Viec nhap sai")).toBeVisible();

  await page.getByRole("button", { name: "Sửa Viec nhap sai" }).click();
  await page.getByPlaceholder("Ví dụ: Tự đánh răng").fill("Việc đã sửa đúng");
  await page.getByRole("button", { name: "Lưu", exact: true }).click();
  await expect(page.getByText("Việc đã sửa đúng")).toBeVisible();
  await expect(page.getByText("Viec nhap sai")).toHaveCount(0);

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Xoá Việc đã sửa đúng" }).click();
  await expect(page.getByText("Việc đã sửa đúng")).toHaveCount(0);
});

test("Nhìn lại: ngày, tuần, tháng, năm", async ({ page }) => {
  await asParent(page);
  await page.getByRole("tab", { name: "Nhìn lại" }).click();
  // Ngày: Bin đã có việc làm hôm nay trong dữ liệu mẫu
  await expect(page.getByRole("heading", { name: "Nhìn lại" })).toBeVisible();
  const bin = page.getByRole("region", { name: "Tổng kết của Bin" });
  await expect(bin).toBeVisible();
  await expect(bin.getByText("Cần cải thiện hôm sau").or(bin.getByText("Còn lại hôm nay"))).toBeVisible();
  await expect(bin.getByText("Sticker hôm nay")).toBeVisible();
  await page.getByRole("button", { name: "Trước đó" }).click(); // hôm qua (lịch sử mẫu)
  await expect(page.getByText("Hôm qua")).toBeVisible();
  await expect(page.getByRole("region", { name: /Tổng kết của/ }).first()).toBeVisible();
  // Tháng: lịch nhiệt, bấm một ngày để xem chi tiết
  await page.getByRole("tab", { name: "Tháng", exact: true }).click();
  await expect(page.getByRole("grid")).toBeVisible();
  await page.getByRole("gridcell", { name: /^Ngày 1:/ }).click().catch(() => undefined);
  // Năm: 12 cột tháng
  await page.getByRole("tab", { name: "Năm", exact: true }).click();
  await expect(page.getByRole("img", { name: /^Tháng 1:/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Tháng 12:/ })).toBeVisible();
  await expect(page.getByText("Việc cần cải thiện nhiều nhất")).toBeVisible();
  // Tuần vẫn có báo cáo cũ
  await page.getByRole("tab", { name: "Tuần", exact: true }).click();
  await expect(page.getByText("Ủn cả nhà kiếm được")).toBeVisible();
  await expect(page.getByText("Sticker được tặng thế nào?")).toBeVisible();
});

test("lời khen: bố gửi, con nghe (giọng đọc giả lập)", async ({ page }) => {
  // máy giả lập có giọng tiếng Việt; ghi lại những gì được đọc
  await page.addInitScript(() => {
    const spoken: { text: string; lang: string }[] = [];
    (window as unknown as { __spoken: typeof spoken }).__spoken = spoken;
    const voice = { lang: "vi-VN", name: "Giọng thử", localService: true, default: true, voiceURI: "vi" };
    class FakeUtterance { text: string; lang = ""; voice: unknown = null; rate = 1; pitch = 1; onend: (() => void) | null = null; onerror: (() => void) | null = null; constructor(t: string) { this.text = t; } }
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance;
    Object.defineProperty(window, "speechSynthesis", {
      value: { getVoices: () => [voice], cancel: () => {}, speak: (u: FakeUtterance) => { spoken.push({ text: u.text, lang: u.lang }); setTimeout(() => u.onend?.(), 5); } },
    });
  });
  await asParent(page);
  await page.getByRole("tab", { name: "Lời khen" }).click();
  await expect(page.getByText("Chưa có lời khen nào")).toBeVisible();
  await page.getByRole("radio", { name: "Na", exact: true }).click();
  await page.getByRole("button", { name: "Gửi lời khen cho Na" }).isDisabled();
  await page.getByLabel("Lời khen").fill("Na ơi, hôm nay con giỏi lắm! Bố mẹ tự hào về con.");
  await page.getByRole("button", { name: "Nghe thử" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: unknown[] }).__spoken.length)).toBeGreaterThan(1);
  await page.getByRole("button", { name: "Gửi lời khen cho Na" }).click();
  await expect(page.getByText(/Đã gửi lời khen/)).toBeVisible();
  await expect(page.getByText("con chưa nghe")).toBeVisible();

  // con Na vào chơi
  await page.getByRole("button", { name: /Thoát/ }).click();
  await page.getByRole("button", { name: /Na/ }).first().click();
  const card = page.getByRole("region", { name: "Lời khen từ bố mẹ" });
  await expect(card.getByText(/gửi lời khen cho con/)).toBeVisible();
  await card.getByRole("button", { name: "Nghe nè" }).click();
  await expect(card.getByText("Na ơi, hôm nay con giỏi lắm!")).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __spoken: { lang: string }[] }).__spoken.at(-1)?.lang)).toBe("vi-VN");
  await expect(card.getByText(/gửi lời khen cho con/)).toHaveCount(0); // đã nghe nên không còn là lời khen mới
  await expect(card.getByRole("button", { name: "Nghe lại" })).toBeVisible();
});

test("lời khen: máy chưa có giọng tiếng Việt vẫn đọc được chữ và có hướng dẫn", async ({ page }) => {
  await page.addInitScript(() => {
    class FakeUtterance { constructor(public text: string) {} }
    (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = FakeUtterance;
    Object.defineProperty(window, "speechSynthesis", { value: { getVoices: () => [{ lang: "en-US", name: "English", localService: true }], cancel: () => {}, speak: () => {} } });
  });
  await asParent(page);
  await page.getByRole("tab", { name: "Lời khen" }).click();
  await page.getByLabel("Lời khen").fill("Con giỏi lắm!");
  await page.getByRole("button", { name: "Nghe thử" }).click();
  await expect(page.getByText(/Chưa tạo được giọng đọc/)).toBeVisible();
});

/* ---------- Khu vườn Ủn ---------- */
test("khu vườn: bé bắt đầu, tưới cây, mua hạt giống và chậu, xem đua vườn", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Bin/ }).first().click();
  await page.getByText("Bỏ Ủn vào bụng heo").click();
  await page.locator("nav").getByRole("button", { name: "Vườn" }).click();
  await expect(page.getByText("Con có muốn trồng vườn không?")).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu trồng vườn" }).click();
  await expect(page.getByText("Khu vườn của con đã sẵn sàng!")).toBeVisible();

  // Bin có 2 việc đã được gật đầu hôm nay nên có 2 giọt nước
  await expect(page.getByText("2 giọt nước", { exact: true })).toBeVisible();
  const plot = page.getByRole("region", { name: "Cây Hy vọng ở ô 1" });
  await expect(plot).toBeVisible();
  await expect(plot.getByText(/0\/10 giọt/)).toBeVisible();
  await plot.getByRole("button", { name: /Tưới 1/ }).click();
  await expect(page.locator(".fx .can")).toHaveCount(1); // bình nước nghiêng xuống tưới cây
  await expect(plot.getByRole("button", { name: /Tưới 1/ })).toBeDisabled(); // đang tưới thì chưa bấm tiếp được
  await expect(plot.getByText(/Mầm · 1\/10 giọt/)).toBeVisible();
  await expect(plot.getByRole("status")).toContainText("Đã tưới 1/10 giọt"); // lời chúc: đã tưới bao nhiêu trên bao nhiêu
  await expect(plot.getByRole("status")).toContainText("Lên Mầm rồi!"); // 0 → 1 giọt: hạt nảy mầm
  await expect(plot.getByRole("status")).toContainText("giọt nữa là ra hoa");
  await expect(page.getByText("1 giọt nước", { exact: true })).toBeVisible();
  await plot.getByRole("button", { name: /Tưới 1/ }).click();
  await expect(page.getByText("0 giọt nước", { exact: true })).toBeVisible();
  await expect(plot.getByRole("button", { name: /Tưới 1/ })).toBeDisabled();

  // Cửa hàng: mua Cây Chăm chỉ (50 Ủn) vào ô trống
  await page.getByRole("tab", { name: "Cửa hàng" }).click();
  await page.getByRole("region", { name: "Cây Chăm chỉ" }).getByRole("button", { name: /Mua và trồng/ }).click();
  await expect(page.getByText("Đã trồng Cây Chăm chỉ!")).toBeVisible();
  await expect(page.getByRole("region", { name: "Cây Ngoan ngoãn" }).getByRole("button", { name: "Cần một ô trống" })).toBeDisabled();
  await page.getByRole("region", { name: "Chậu xanh" }).getByRole("button").click();
  await expect(page.getByText("Đã mua Chậu xanh!")).toBeVisible();
  await expect(page.getByRole("region", { name: "Chậu xanh" }).getByText("Đã có")).toBeVisible();

  await page.getByRole("tab", { name: "Vườn của con" }).click();
  await expect(page.getByRole("region", { name: "Cây Chăm chỉ ở ô 2" })).toBeVisible();
  await page.getByRole("region", { name: "Cây Hy vọng ở ô 1" }).getByRole("button", { name: "Đổi chậu" }).click();
  await page.getByRole("radio", { name: "Chậu xanh" }).click();
  await expect(page.getByText("Đã đổi chậu")).toBeVisible();

  await page.getByRole("tab", { name: "Đua vườn" }).click();
  await expect(page.getByText("Đường đua tuần này")).toBeVisible();
});

test("khu vườn: bố mẹ xem vườn các con, chỉnh trần chi tiêu, tắt vườn", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Bin/ }).first().click();
  await page.getByText("Bỏ Ủn vào bụng heo").click();
  await page.locator("nav").getByRole("button", { name: "Vườn" }).click();
  await page.getByRole("button", { name: "Bắt đầu trồng vườn" }).click();
  await expect(page.getByText("Khu vườn của con đã sẵn sàng!")).toBeVisible();
  await page.getByRole("button", { name: /Thoát/ }).click();

  await page.getByRole("button", { name: /^Bố/ }).first().click();
  for (const d of "1234") await page.keyboard.press(d);
  await page.getByRole("tab", { name: "Vườn của các con" }).click();
  await expect(page.getByRole("region", { name: "Vườn của Bin" }).getByText("Cây Hy vọng")).toBeVisible();
  // Bố mẹ chỉ thăm vườn để xem, chưa tưới giúp hay hái giúp con được
  await expect(page.getByRole("region", { name: "Vườn của Bin" }).getByRole("button")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Tưới|Hái|Mua/ })).toHaveCount(0);
  await expect(page.locator(".fx")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Vườn của Na" }).getByText("Chưa bắt đầu chơi vườn")).toBeVisible();
  await page.getByLabel("Trần chi tiêu mỗi tuần (Ủn)").fill("120");
  await page.getByRole("button", { name: "Lưu cài đặt vườn" }).click();
  await expect(page.getByText("Đã lưu cài đặt khu vườn")).toBeVisible();
  await page.getByLabel("Bật khu vườn cho các con").uncheck();
  await page.getByRole("button", { name: "Lưu cài đặt vườn" }).click();
  await expect(page.getByText("Đã lưu cài đặt khu vườn")).toBeVisible();

  await page.getByRole("button", { name: "Thoát" }).click();
  await page.getByRole("button", { name: /Bin/ }).first().click();
  await page.locator("nav").getByRole("button", { name: "Vườn" }).click();
  await expect(page.getByText("Khu vườn đang nghỉ")).toBeVisible();
});

/* ---------- Điện thoại: ô nhập không làm iPhone tự phóng to ---------- */
test("điện thoại: mọi ô nhập chữ có cỡ chữ từ 16px (iPhone không tự phóng to khi bấm vào)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await asParent(page);
  const nav = page.getByRole("navigation", { name: /điện thoại/ });
  const small = async (where: string) => {
    const bad = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select")]
      .filter((e) => e.offsetParent !== null && parseFloat(getComputedStyle(e).fontSize) < 16)
      .map((e) => `${e.tagName}[name=${e.getAttribute("name") ?? ""}] ${getComputedStyle(e).fontSize}`));
    expect(bad, `ô nhập nhỏ hơn 16px ở ${where}`).toEqual([]);
  };
  await nav.getByRole("button", { name: "Kế hoạch" }).click();
  await page.getByRole("button", { name: "Thêm việc" }).first().click();
  await small("form Thêm việc");
  await nav.getByRole("button", { name: "Của tôi" }).click();
  await small("Việc của tôi");
  for (const tab of ["Lời khen", "Cài đặt", "Thành viên", "Phiếu đi chơi", "Kèo cả nhà", "Vườn của các con", "Việc tốt"]) {
    await nav.getByRole("button", { name: "Thêm" }).click();
    await page.getByRole("dialog", { name: "Thêm mục" }).getByRole("button", { name: new RegExp(tab) }).click();
    await small(tab);
  }
});

/* ---------- Ghi nhớ đăng nhập trên máy này ---------- */
test("mở lại app: bé được nhớ tới khi bấm Thoát", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Bin/ }).first().click();
  await page.getByText("Bỏ Ủn vào bụng heo").click();
  await expect(page.getByText("Chào Bin!")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Chào Bin!")).toBeVisible(); // vào thẳng, không phải chọn người
  await page.getByText("Bỏ Ủn vào bụng heo").click(); // bản dùng thử mất dữ liệu khi tải lại nên màn ăn mừng hiện lại
  await page.getByRole("button", { name: /Thoát/ }).click();
  await expect(page.getByText("Ai vào chơi với Ủn nè?")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Ai vào chơi với Ủn nè?")).toBeVisible(); // đã Thoát thì quên
});

test("mở lại app: bố mẹ được nhớ theo thời gian chọn, Thoát hoặc Không nhớ thì hỏi PIN lại", async ({ page }) => {
  await asParent(page);
  await page.reload();
  await expect(page.getByText("Góc bố mẹ")).toBeVisible(); // không phải nhập PIN lại

  await page.getByRole("tab", { name: "Cài đặt" }).click();
  await expect(page.getByRole("radio", { name: "2 giờ" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: "Không nhớ" }).click();
  await page.reload();
  await expect(page.getByText("Ai vào chơi với Ủn nè?")).toBeVisible();

  await page.getByRole("button", { name: /^Bố/ }).first().click();
  for (const d of "1234") await page.keyboard.press(d);
  await expect(page.getByText("Góc bố mẹ")).toBeVisible();
  await page.getByRole("tab", { name: "Cài đặt" }).click();
  await page.getByRole("radio", { name: "1 ngày" }).click();
  await page.reload();
  await expect(page.getByText("Góc bố mẹ")).toBeVisible();
  await page.getByRole("button", { name: "Thoát" }).click();
  await page.reload();
  await expect(page.getByText("Ai vào chơi với Ủn nè?")).toBeVisible(); // bấm Thoát là quên ngay
});

/* ---------- Ghi âm lời khen ---------- */
test("lời khen: bố ghi âm giọng mình, gửi, con nghe", async ({ page }) => {
  await asParent(page);
  await page.getByRole("tab", { name: "Lời khen" }).click();
  await page.getByRole("radio", { name: "Na", exact: true }).click();
  await page.getByRole("radio", { name: /Ghi âm giọng của mình/ }).click();
  // chưa ghi thì chưa gửi được
  await expect(page.getByRole("button", { name: /Gửi lời khen cho Na/ })).toBeDisabled();
  await page.getByRole("button", { name: "Bắt đầu ghi âm" }).click();
  await expect(page.getByRole("group", { name: "Đang ghi âm" })).toBeVisible();
  await page.waitForTimeout(2300);
  await page.getByRole("button", { name: /Dừng và nghe lại/ }).click();
  const take = page.getByRole("group", { name: "Bản ghi âm" });
  await expect(take).toBeVisible();
  await expect(take.locator("audio")).toHaveCount(1);
  await page.getByLabel("Thêm vài chữ cho người nhận xem (không bắt buộc)").fill("Bố tự hào về con!");
  await page.getByRole("button", { name: /Gửi lời khen cho Na/ }).click();
  await expect(page.getByText(/Đã gửi lời khen/)).toBeVisible();
  await expect(page.getByText(/ghi âm 0:0\d/)).toBeVisible(); // lịch sử có ghi chú ghi âm kèm độ dài

  // ghi lại: bỏ bản cũ
  await page.getByRole("button", { name: "Bắt đầu ghi âm" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Dừng và nghe lại/ }).click();
  await page.getByRole("button", { name: "Ghi lại" }).click();
  await expect(page.getByRole("button", { name: "Bắt đầu ghi âm" })).toBeVisible();

  // con Na nghe giọng bố
  await page.getByRole("button", { name: /Thoát/ }).click();
  await page.getByRole("button", { name: /Na/ }).first().click();
  const card = page.getByRole("region", { name: "Lời khen từ bố mẹ" });
  await expect(card.getByText(/Giọng nói của/)).toBeVisible();
  await card.getByRole("button", { name: "Nghe nè" }).click();
  await expect(card.getByText("Bố tự hào về con!")).toBeVisible(); // chữ kèm theo hiện ra
  await expect(card.getByText(/gửi lời khen cho con/)).toHaveCount(0); // đã nghe nên không còn là lời mới
});

test("lời khen: ghi âm không bắt buộc có chữ, và quay về viết chữ vẫn gửi bình thường", async ({ page }) => {
  await asParent(page);
  await page.getByRole("tab", { name: "Lời khen" }).click();
  await page.getByRole("radio", { name: /Ghi âm giọng của mình/ }).click();
  await page.getByRole("button", { name: "Bắt đầu ghi âm" }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Dừng và nghe lại/ }).click();
  await page.getByRole("button", { name: /Gửi lời khen cho/ }).click();
  await expect(page.getByText(/Đã gửi lời khen/)).toBeVisible();
  await page.getByRole("radio", { name: /Viết chữ/ }).click();
  await page.locator('textarea[name="praise"]').fill("Con giỏi lắm!");
  await page.getByRole("button", { name: /Gửi lời khen cho/ }).click();
  await expect(page.getByText("Con giỏi lắm!").first()).toBeVisible();
});

/* ---------- Lời khen giữa mọi người trong nhà ---------- */
test("lời khen: chọn người gửi, bố mẹ gửi cho nhau và người nhận nghe ở Gật đầu", async ({ page }) => {
  await asParent(page); // đang là Bố
  await page.getByRole("tab", { name: "Lời khen" }).click();
  const to = page.getByRole("radiogroup", { name: "Gửi cho" });
  const from = page.getByRole("radiogroup", { name: "Từ" });
  await expect(from.getByRole("radio")).toHaveCount(2); // Bố, Mẹ
  await expect(from.getByRole("radio", { name: "Bố" })).toHaveAttribute("aria-checked", "true"); // mặc định người đang đăng nhập
  await expect(to.getByRole("radio")).toHaveCount(3); // Mẹ, Bin, Na (không có chính mình)
  await expect(to.getByRole("radio", { name: "Bố" })).toHaveCount(0);

  // Bố gửi cho Mẹ
  await to.getByRole("radio", { name: "Mẹ" }).click();
  await page.locator('textarea[name="praise"]').fill("Cảm ơn Mẹ vì hôm nay đã lo cho cả nhà.");
  await page.getByRole("button", { name: "Gửi lời khen cho Mẹ" }).click();
  await expect(page.getByText(/Đã gửi lời khen/)).toBeVisible();
  await expect(page.getByText("Bố khen Mẹ")).toBeVisible();

  // đổi người gửi sang Mẹ: Mẹ gửi cho Bố (Bố tự có trong danh sách nhận, Mẹ thì biến mất)
  await from.getByRole("radio", { name: "Mẹ" }).click();
  await expect(to.getByRole("radio", { name: "Mẹ" })).toHaveCount(0);
  await to.getByRole("radio", { name: "Bố" }).click();
  await page.locator('textarea[name="praise"]').fill("Cảm ơn Bố đã chơi với các con.");
  await page.getByRole("button", { name: "Gửi lời khen cho Bố" }).click();
  await expect(page.getByText("Mẹ khen Bố")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Lời khen/ })).toContainText("1"); // Bố có 1 lời khen chưa nghe

  // Bố mở Gật đầu thấy hộp thư lời khen của mình
  await page.getByRole("tab", { name: "Gật đầu" }).click();
  const inbox = page.getByRole("region", { name: "Lời khen trong nhà" });
  await expect(inbox.getByText("Mẹ gửi lời khen cho bạn!")).toBeVisible();
  await inbox.getByRole("button", { name: "Nghe nè" }).click();
  await expect(inbox.getByText("Cảm ơn Bố đã chơi với các con.")).toBeVisible();
  await expect(inbox.getByText(/gửi lời khen cho bạn/)).toHaveCount(0); // đã nghe nên không còn là lời mới
  await expect(inbox.getByRole("button", { name: "Nghe lại" })).toBeVisible();
});

/* ---------- Báo thức bằng giọng bố mẹ và bán lại chậu ---------- */
test("báo thức: bố ghi âm, đúng giờ chuông reo ở máy bé, hoãn rồi tắt", async ({ page }) => {
  // Đồng hồ giả: thứ Tư 07/10/2026, 06:48:30 giờ Việt Nam, vẫn chạy bình thường từ đó
  await page.clock.install({ time: new Date("2026-10-07T06:48:30+07:00") });
  await page.clock.resume();
  await asParent(page);
  await page.getByRole("tab", { name: "Báo thức" }).click();
  await expect(page.getByText("Chưa có báo thức nào")).toBeVisible();
  await page.getByRole("button", { name: "Thêm báo thức" }).click();
  await page.locator('input[name="title"]').fill("Dậy đi học");
  await page.locator('input[name="at"]').fill("06:50");
  await page.getByRole("radio", { name: "Gà gáy" }).click();
  // chọn ghi âm nhưng chưa ghi: không lưu được
  await page.getByRole("button", { name: "Lưu báo thức" }).click();
  await expect(page.getByText("Bấm ghi âm lời nhắc trước")).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu ghi âm" }).click();
  await page.waitForTimeout(1800);
  await page.getByRole("button", { name: /Dừng và nghe lại/ }).click();
  await expect(page.getByRole("group", { name: "Bản ghi âm" })).toBeVisible(); // đợi bản ghi đóng gói xong
  await page.getByRole("button", { name: "Lưu báo thức" }).click();
  await expect(page.getByText("Đã lưu báo thức")).toBeVisible();
  const row = page.locator(".card.row.flat", { hasText: "Dậy đi học" });
  await expect(row.getByText("6:50")).toBeVisible();
  await expect(row.getByText(/Gà gáy/)).toBeVisible();
  await expect(row.getByText(/ghi âm 0:0\d/)).toBeVisible();

  // thử chuông ở máy bố mẹ
  await row.getByRole("button", { name: /Thử chuông/ }).click();
  const preview = page.getByRole("alertdialog", { name: "Báo thức 6:50" });
  await expect(preview).toBeVisible();
  await expect(preview.getByText("Đây là bản thử")).toBeVisible();
  await preview.getByRole("button", { name: "Dừng thử" }).click();
  await expect(preview).toBeHidden();

  // tắt rồi bật báo thức
  await row.getByRole("checkbox", { name: /Bật báo thức/ }).uncheck();
  await expect(page.getByText("Đã tắt báo thức")).toBeVisible();
  await row.getByRole("checkbox", { name: /Bật báo thức/ }).check();

  // bé Bin vào, đồng hồ chạy tới 06:50
  await page.getByRole("button", { name: /Thoát/ }).click();
  await page.getByRole("button", { name: /Bin/ }).first().click();
  await page.getByText("Bỏ Ủn vào bụng heo").click();
  await expect(page.getByRole("region", { name: "Báo thức" }).getByText(/6:50 · Dậy đi học/)).toBeVisible();
  const ring = page.getByRole("alertdialog", { name: "Báo thức 6:50" });
  await expect(ring).toBeHidden(); // chưa tới giờ
  await page.clock.fastForward(100_000); // 06:50:10
  await page.clock.runFor(4000);
  await expect(ring).toBeVisible();
  await expect(ring.getByText("Dậy thôi Bin ơi!")).toBeVisible();
  await ring.getByRole("button", { name: /Ngủ thêm 5 phút/ }).click();
  await expect(ring).toBeHidden();
  await page.clock.runFor(10_000);
  await expect(ring).toBeHidden(); // đang hoãn
  await page.clock.fastForward(5 * 60_000 + 5000); // hết hoãn, vẫn trong 15 phút
  await page.clock.runFor(4000);
  await expect(ring).toBeVisible();
  await ring.getByRole("button", { name: "Con dậy rồi!" }).click();
  await expect(ring).toBeHidden();
  await page.clock.runFor(20_000);
  await expect(ring).toBeHidden(); // đã tắt hôm nay thì không kêu lại
  // qua 15 phút thì thôi, kể cả chưa tắt
  await page.clock.fastForward(30 * 60_000);
  await page.clock.runFor(4000);
  await expect(ring).toBeHidden();
});

test("báo thức: sửa, chỉ định bé, xoá", async ({ page }) => {
  await asParent(page);
  await page.getByRole("tab", { name: "Báo thức" }).click();
  await page.getByRole("button", { name: "Thêm báo thức" }).click();
  await page.getByRole("radio", { name: "Chỉ có chuông" }).click();
  await page.getByRole("group", { name: "Chọn bé" }).getByRole("button", { name: "Na" }).click(); // bỏ Na, chỉ còn Bin
  await page.getByRole("button", { name: "Lưu báo thức" }).click();
  const row = page.locator(".card.row.flat", { hasText: "Dậy đi học" });
  await expect(row.getByText(/Bin/)).toBeVisible();
  await expect(row.getByText(/chỉ chuông/)).toBeVisible();
  await row.getByRole("button", { name: /Sửa/ }).click();
  await page.locator('input[name="at"]').fill("07:15");
  await page.getByRole("radio", { name: /Viết chữ/ }).click();
  await page.locator('textarea[name="body"]').fill("Dậy thôi con ơi!");
  await page.getByRole("button", { name: "Lưu báo thức" }).click();
  await expect(page.locator(".card.row.flat", { hasText: "7:15" }).getByText(/giọng AI đọc/)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Xoá Dậy đi học/ }).click();
  await expect(page.getByText("Chưa có báo thức nào")).toBeVisible();
});

test("vườn: mua nhầm chậu thì bán lại được 60% giá", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Bin/ }).first().click();
  await page.getByText("Bỏ Ủn vào bụng heo").click();
  await page.locator("nav").getByRole("button", { name: "Vườn" }).click();
  await page.getByRole("button", { name: "Bắt đầu trồng vườn" }).click();
  await page.getByRole("tab", { name: "Cửa hàng" }).click();
  const pot = page.getByRole("region", { name: "Chậu ngôi sao" });
  await pot.getByRole("button").click(); // mua 40 Ủn
  await expect(page.getByText("Đã mua Chậu ngôi sao!")).toBeVisible();
  await expect(pot.getByText("Đã có")).toBeVisible();
  page.once("dialog", (d) => { expect(d.message()).toContain("24 Ủn"); void d.accept(); });
  await pot.getByRole("button", { name: /Bán lại/ }).click();
  await expect(page.getByText("Đã bán Chậu ngôi sao, nhận lại 24 Ủn")).toBeVisible();
  await expect(pot.getByText("Đã có")).toHaveCount(0);
  await expect(pot.getByRole("button", { name: /40/ })).toBeVisible(); // mua lại được
});

test("báo thức: máy chung bật chế độ nhận chuông thì hồ sơ bố mẹ cũng reo; tắt thì không", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-07T06:48:30+07:00") });
  await page.clock.resume();
  await asParent(page);
  await page.getByRole("tab", { name: "Báo thức" }).click();
  await page.getByRole("button", { name: "Thêm báo thức" }).click();
  await page.locator('input[name="title"]').fill("Dậy đi học");
  await page.locator('input[name="at"]').fill("06:50");
  await page.getByRole("radio", { name: "Chỉ có chuông" }).click();
  await page.getByRole("button", { name: "Lưu báo thức" }).click();
  await expect(page.getByText("Đã lưu báo thức")).toBeVisible();
  const ring = page.getByRole("alertdialog", { name: "Báo thức 6:50" });

  // chưa bật chế độ: đang ở hồ sơ bố mẹ thì không reo
  await page.clock.fastForward(100_000);
  await page.clock.runFor(4000);
  await expect(ring).toBeHidden();

  // bật trong Cài đặt: reo ngay dù vẫn ở hồ sơ bố mẹ
  await page.getByRole("tab", { name: "Cài đặt" }).click();
  await page.getByRole("checkbox", { name: "Máy này nhận chuông báo thức cho các bé" }).check();
  await page.clock.runFor(4000);
  await expect(ring).toBeVisible();
  await ring.getByRole("button", { name: "Con dậy rồi!" }).click();
  await expect(ring).toBeHidden();
  await page.clock.runFor(10_000);
  await expect(ring).toBeHidden();
});

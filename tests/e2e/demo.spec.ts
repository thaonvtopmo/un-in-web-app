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
  for (const tab of ["Nhà", "Việc tốt", "Đường đua", "Đi chơi", "Hũ Mơ Ước"]) {
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
    for (const tab of ["Việc tốt", "Đường đua", "Đi chơi", "Hũ Mơ Ước", "Nhà"]) {
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
  await page.getByRole("radio", { name: "Na" }).click();
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
  await expect(page.getByText(/chưa cài giọng đọc tiếng Việt/)).toBeVisible();
});

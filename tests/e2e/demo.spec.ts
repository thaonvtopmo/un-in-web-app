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

  await page.getByRole("tab", { name: "Báo cáo tuần" }).click();
  await expect(page.getByText("Ủn cả nhà kiếm được")).toBeVisible();
  await expect(page.getByText("Từng người trong tuần")).toBeVisible();

  // Thêm, sửa, xoá việc tốt
  await page.getByRole("tab", { name: "Việc tốt" }).click();
  await page.getByPlaceholder("Ví dụ: Tự đánh răng").fill("Tự dọn giường");
  await page.getByRole("button", { name: "Thêm việc tốt" }).click();
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
  await page.getByRole("button", { name: /Việc mới cho ngày này/ }).click();
  await page.getByPlaceholder("Ví dụ: Tự đánh răng").fill("Tưới cây cùng bố");
  await page.getByRole("button", { name: "Thêm vào ngày này" }).click();
  await expect(page.getByLabel("Tưới cây cùng bố: làm vào hôm nay")).toBeChecked();
  // sang ngày mai: việc riêng của hôm nay không có, việc đã tắt hôm nay vẫn bật theo lịch lặp
  await page.getByRole("button", { name: "Ngày mai", exact: true }).click();
  await expect(page.getByLabel("Tưới cây cùng bố: làm vào ngày mai")).not.toBeChecked();
  await expect(page.getByLabel("Dậy trước 6h30: làm vào ngày mai")).toBeChecked();
  // con: không còn thấy "Dậy trước 6h30", thấy việc mới
  await page.getByRole("button", { name: "Thoát" }).first().click();
  await page.getByRole("button", { name: /Bin/ }).first().click();
  await page.getByText("Bỏ Ủn vào bụng heo").click();
  await page.locator("nav").getByRole("button", { name: "Việc tốt" }).click();
  await expect(page.getByText("Tưới cây cùng bố")).toBeVisible();
  await expect(page.getByText("Dậy trước 6h30")).toHaveCount(0);
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

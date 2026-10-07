import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** Quét khả năng truy cập (độ tương phản, nhãn nút, vai trò...) trên các màn chính. Không được có lỗi nghiêm trọng. */
async function scan(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const lines = bad.map((v) => `${where} → ${v.id} (${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ") + " [" + (n.any[0]?.message ?? "").slice(0, 110) + "]").join(" | ")}`);
  expect.soft(lines).toEqual([]);
}

test("màn chọn người và màn của con đạt chuẩn truy cập", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Ai vào chơi với Ủn nè?")).toBeVisible();
  await scan(page, "chọn người");
  await page.getByRole("button", { name: /Bin/ }).first().click();
  await page.getByText("Bỏ Ủn vào bụng heo").click();
  for (const tab of ["Nhà", "Việc tốt", "Vườn", "Đi chơi", "Hũ Mơ Ước"]) {
    await page.locator("nav").getByRole("button", { name: tab }).click();
    await scan(page, `màn của con: ${tab}`);
  }
});

test("Góc bố mẹ đạt chuẩn truy cập", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Bố/ }).first().click();
  for (const d of "1234") await page.keyboard.press(d);
  await expect(page.getByText("Góc bố mẹ")).toBeVisible();
  for (const tab of ["Gật đầu", "Việc của tôi", "Kế hoạch ngày", "Hũ chung", "Ngoéo tay", "Lời khen", "Báo thức", "Vườn của các con", "Nhìn lại", "Việc tốt", "Phiếu đi chơi", "Kèo cả nhà", "Thành viên", "Cài đặt"]) {
    await page.getByRole("tab", { name: new RegExp(tab) }).click();
    await page.waitForTimeout(250);
    await scan(page, `Góc bố mẹ: ${tab}`);
  }
});

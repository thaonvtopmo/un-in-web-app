import { defineConfig } from "@playwright/test";

/**
 * Kiểm thử trình duyệt chạy trên bản dùng thử (không cần Supabase).
 * Máy không có Chromium của Playwright: đặt PW_CHANNEL=msedge (hoặc chrome) để dùng trình duyệt có sẵn.
 */
const PORT = 3400;
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}`, channel: process.env.PW_CHANNEL || undefined,
    // Micro giả để thử tính năng ghi âm lời khen
    launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
    permissions: ["microphone"],
  },
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    // Để trống hai biến này thì app chạy ở chế độ dùng thử
    env: { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
  },
});

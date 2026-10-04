/* Service worker của Ủn Ỉn Cả Nhà.
 * - File tĩnh (/_next/static, icon): lấy từ bộ nhớ đệm nếu có, để mở app nhanh.
 * - Trang: luôn hỏi mạng trước; mất mạng thì dùng bản đã lưu.
 * - Dữ liệu gia đình (Supabase) KHÔNG bao giờ được lưu đệm, luôn lấy mới từ server.
 */
const CACHE = "un-in-v1";
const SHELL = ["/", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return; // chỉ xử lý file của chính app

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match("/"))),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })),
    );
  }
});

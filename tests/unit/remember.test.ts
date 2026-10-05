import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PARENT_REMEMBER, forget, parentRememberMs, recall, remember, setParentRememberMs, touchParent } from "@/lib/remember";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(), key: () => null, length: 0,
  } as Storage;
});

describe("ghi nhớ trên máy này", () => {
  it("chưa chọn ai thì không nhớ gì", () => {
    expect(recall()).toBeNull();
  });
  it("bé được nhớ mãi cho tới khi bấm Thoát", () => {
    remember("bin", "kid");
    expect(recall(Date.now() + 30 * 86_400_000)?.member).toBe("bin");
    forget();
    expect(recall()).toBeNull();
  });
  it("bố mẹ được nhớ trong thời gian đã chọn (mặc định 2 giờ), quá hạn thì hỏi PIN lại", () => {
    expect(parentRememberMs()).toBe(DEFAULT_PARENT_REMEMBER);
    remember("bo", "parent");
    const t = Date.now();
    expect(recall(t + 60 * 60_000)?.member).toBe("bo");
    expect(recall(t + 3 * 3600_000)).toBeNull();
  });
  it("dùng tiếp thì gia hạn thời gian nhớ", () => {
    remember("bo", "parent");
    const raw = JSON.parse(store.get("un-profile-v1")!);
    store.set("un-profile-v1", JSON.stringify({ ...raw, at: Date.now() - 100 * 60_000 })); // đã 100 phút
    touchParent();
    expect(recall(Date.now() + 100 * 60_000)?.member).toBe("bo");
  });
  it("chọn Không nhớ thì bố mẹ luôn phải nhập PIN; chọn 1 ngày thì nhớ cả ngày", () => {
    remember("bo", "parent");
    setParentRememberMs(0);
    expect(recall()).toBeNull();
    setParentRememberMs(24 * 3600_000);
    expect(recall(Date.now() + 23 * 3600_000)?.member).toBe("bo");
  });
  it("giá trị lưu hỏng thì bỏ qua, không làm app lỗi", () => {
    store.set("un-profile-v1", "{không phải json");
    expect(recall()).toBeNull();
    store.set("un-profile-v1", JSON.stringify({ member: 5, role: "kid", at: "x" }));
    expect(recall()).toBeNull();
    store.set("un-remember-parent-v1", "abc");
    expect(parentRememberMs()).toBe(DEFAULT_PARENT_REMEMBER);
  });
});

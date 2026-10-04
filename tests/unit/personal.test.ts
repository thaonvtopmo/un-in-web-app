import { describe, expect, it } from "vitest";
import { isOverdue, myTasks, parentTasks, timeInfo, today } from "@/lib/data";
import { ruleSelfToggle } from "@/lib/rules";
import { familyFixture } from "./fixture";

const withPersonal = () => {
  const S = familyFixture();
  S.tasks.push(
    { id: "m1", title: "Gửi báo giá", icon: "check", coins: 0, slot: "chieu", who: "parent", parents: ["bo"], selfCheck: true, due: "18:00", est: 30, repeat: 127, bg: "#fff" },
    { id: "m2", title: "Họp nhóm", icon: "check", coins: 0, slot: "sang", who: "parent", parents: ["bo"], selfCheck: true, due: "09:00", repeat: 127, bg: "#fff" },
    { id: "m3", title: "Việc của Mẹ", icon: "check", coins: 0, slot: "toi", who: "parent", parents: ["me"], selfCheck: true, repeat: 127, bg: "#fff" },
  );
  return S;
};

describe("việc riêng của bố mẹ", () => {
  it("con chỉ chấm các mục \"con chấm Đạt\", không thấy việc bố mẹ tự đánh dấu", () => {
    const S = withPersonal();
    expect(parentTasks(S).map((t) => t.id)).toEqual(["p1"]);
  });
  it("Việc của tôi: chỉ việc của mình, xếp theo hạn rồi theo buổi", () => {
    const S = withPersonal();
    expect(myTasks(S, "bo").map((t) => t.id)).toEqual(["m2", "m1", "p1"]); // 09:00, 18:00, không hạn
    expect(myTasks(S, "me").map((t) => t.id)).toEqual(["p1", "m3"]); // cùng buổi tối, không hạn: giữ thứ tự thêm vào
  });
  it("tự đánh dấu xong rồi bỏ đánh dấu, không đụng tới Ủn", () => {
    const S = withPersonal();
    ruleSelfToggle(S, "bo", "m1");
    expect(S.subs).toHaveLength(1);
    expect(S.subs[0]).toMatchObject({ member: "bo", task: "m1", status: "approved" });
    expect(S.coins.bo).toBe(0);
    ruleSelfToggle(S, "bo", "m1");
    expect(S.subs).toHaveLength(0);
  });
  it("quá hạn chỉ tính cho hôm nay và việc chưa xong", () => {
    const S = withPersonal();
    const t = { ...S.tasks.find((x) => x.id === "m1")!, due: "00:00" };
    expect(isOverdue(t, today(), false)).toBe(true);
    expect(isOverdue(t, today(), true)).toBe(false);
    expect(isOverdue(t, "2099-01-01", false)).toBe(false);
    expect(isOverdue({ ...t, due: undefined }, today(), false)).toBe(false);
  });
  it("chữ mô tả hạn và thời gian dự kiến", () => {
    const S = withPersonal();
    expect(timeInfo(S.tasks.find((x) => x.id === "m1")!)).toBe("trước 18:00 · ~30 phút");
    expect(timeInfo(S.tasks.find((x) => x.id === "m2")!)).toBe("trước 09:00");
    expect(timeInfo(S.tasks[0])).toBe("");
  });
});

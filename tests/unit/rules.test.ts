import { describe, expect, it } from "vitest";
import { today } from "@/lib/data";
import { ruleApprove, ruleCancelPromise, ruleGive, ruleJudge, ruleRedeem, ruleRemind, ruleRevoke, ruleSubmit } from "@/lib/rules";
import { familyFixture } from "./fixture";

describe("nộp việc và gật đầu", () => {
  it("nộp việc tạo bản ghi chờ, nộp lại không tạo thêm", () => {
    const S = familyFixture();
    ruleSubmit(S, "bin", "t1");
    ruleSubmit(S, "bin", "t1");
    expect(S.subs.filter((s) => s.task === "t1" && s.member === "bin")).toHaveLength(1);
    expect(S.subs[0].status).toBe("pending");
  });
  it("gật đầu cộng Ủn ngay và đánh dấu con chưa xem", () => {
    const S = familyFixture();
    ruleSubmit(S, "bin", "t1");
    ruleApprove(S, S.subs[0].id, "bo", "Giỏi quá!");
    expect(S.coins.bin).toBe(20);
    expect(S.week.bin).toBe(20);
    expect(S.subs[0]).toMatchObject({ status: "approved", by: "bo", sticker: "Giỏi quá!", seen: false });
  });
  it("gật đầu hai lần không cộng đôi", () => {
    const S = familyFixture();
    ruleSubmit(S, "bin", "t1");
    ruleApprove(S, S.subs[0].id, "bo", "");
    ruleApprove(S, S.subs[0].id, "me", "");
    expect(S.coins.bin).toBe(20);
  });
  it("việc làm cùng nhau cộng cho con và đúng người cùng làm", () => {
    const S = familyFixture();
    ruleSubmit(S, "bin", "g1"); // chỉ với Bố
    ruleApprove(S, S.subs[0].id, "me", "");
    expect(S.coins).toMatchObject({ bin: 30, bo: 30, me: 0 });
    ruleSubmit(S, "bin", "g2"); // cả nhà
    ruleApprove(S, S.subs[1].id, "me", "");
    expect(S.coins).toMatchObject({ bin: 40, bo: 40, me: 10 });
  });
  it("nhắc nhẹ không trừ Ủn, nộp lại thì về chờ", () => {
    const S = familyFixture();
    ruleSubmit(S, "bin", "t1");
    ruleRemind(S, S.subs[0].id);
    expect(S.subs[0].status).toBe("redo");
    expect(S.coins.bin).toBe(0);
    ruleSubmit(S, "bin", "t1");
    expect(S.subs[0].status).toBe("pending");
  });
  it("hoàn tác trả lại đúng Ủn đã cộng, kể cả bố mẹ làm cùng", () => {
    const S = familyFixture();
    ruleSubmit(S, "bin", "g2");
    ruleApprove(S, S.subs[0].id, "me", "");
    ruleRevoke(S, S.subs[0].id);
    expect(S.coins).toMatchObject({ bin: 0, bo: 0, me: 0 });
    expect(S.subs[0].status).toBe("pending");
  });
  it("gật đầu tự cộng tiến độ kèo gắn với việc đó, hoàn tác thì trừ lại", () => {
    const S = familyFixture();
    S.challenges.push({ id: "c", a: "bo", b: "bin", title: "x", target: 5, prog: { bo: 0, bin: 0 }, prize: "", daysLeft: 7, linkedTask: "t1" });
    ruleSubmit(S, "bin", "t1");
    ruleApprove(S, S.subs[0].id, "bo", "");
    expect(S.challenges[0].prog.bin).toBe(1);
    ruleRevoke(S, S.subs[0].id);
    expect(S.challenges[0].prog.bin).toBe(0);
  });
});

describe("con chấm bố mẹ", () => {
  it("bấm lần 1 cộng Ủn, bấm lại huỷ trong ngày", () => {
    const S = familyFixture();
    ruleJudge(S, "bo", "p1", "bin");
    expect(S.coins.bo).toBe(15);
    expect(S.subs.some((s) => s.member === "bo" && s.date === today())).toBe(true);
    ruleJudge(S, "bo", "p1", "bin");
    expect(S.coins.bo).toBe(0);
    expect(S.subs.some((s) => s.member === "bo")).toBe(false);
  });
});

describe("đổi phiếu, huỷ phiếu, hũ chung", () => {
  it("đổi phiếu trừ Ủn và tạo lời ngoéo tay", () => {
    const S = familyFixture();
    S.coins.bin = 100;
    ruleRedeem(S, "bin", "r1");
    expect(S.coins.bin).toBe(70);
    expect(S.promises[0]).toMatchObject({ member: "bin", reward: "r1", status: "promised" });
  });
  it("huỷ phiếu hoàn đủ Ủn và không tính là Ủn kiếm được", () => {
    const S = familyFixture();
    S.coins.bin = 100;
    S.week.bin = 100;
    ruleRedeem(S, "bin", "r1");
    ruleCancelPromise(S, S.promises[0].id);
    expect(S.coins.bin).toBe(100);
    expect(S.week.bin).toBe(100);
    expect(S.promises).toHaveLength(0);
  });
  it("không huỷ được phiếu đã giữ lời", () => {
    const S = familyFixture();
    S.coins.bin = 100;
    ruleRedeem(S, "bin", "r1");
    S.promises[0].status = "done";
    ruleCancelPromise(S, S.promises[0].id);
    expect(S.coins.bin).toBe(70);
  });
  it("góp hũ trừ ví cá nhân và báo khi đầy", () => {
    const S = familyFixture();
    S.coins.bin = 60;
    S.jar.target = 50;
    expect(ruleGive(S, "bin", 20)).toBe(false);
    expect(ruleGive(S, "bin", 30)).toBe(true);
    expect(S.coins.bin).toBe(10);
    expect(S.jar.reached).toBe(true);
    expect(S.jar.contrib.bin).toBe(50);
  });
});

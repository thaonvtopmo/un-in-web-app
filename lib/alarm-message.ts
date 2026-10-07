/** Nội dung thông báo đẩy của báo thức. Lần đầu mang đúng lời bố mẹ viết; các lần nhắc lại ngắn gọn hơn. */
export type DueAlarm = { id: string; family_id: string; title: string; at_text: string; body: string | null; repeat_no: number; kid_names: string[] };

export function alarmMessage(a: DueAlarm): { title: string; body: string } {
  const who = a.kid_names.length ? a.kid_names.join(", ") : "cả nhà";
  const note = (a.body ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  if (a.repeat_no === 0) {
    return { title: `⏰ ${a.title} (${a.at_text})`, body: note ? `${who} ơi, ${note}` : `Dậy thôi ${who} ơi! Mở Ủn Ỉn để nghe lời nhắc.` };
  }
  return { title: `⏰ Nhắc lại ${a.repeat_no}/3: ${a.title}`, body: `${who} ơi, dậy thôi nào! Bấm vào đây rồi bấm "Con dậy rồi!" để tắt báo thức.` };
}

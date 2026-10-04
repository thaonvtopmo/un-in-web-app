import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Coin, CoinPill } from "@/components/Coin";
import { ICON_PATHS, Icon, type IconName } from "@/components/Icon";
import { Pig, type PigMood } from "@/components/Pig";

const MOODS: PigMood[] = ["happy", "joy", "sleep", "judge"];
const COLORS = [
  "bg-bg", "bg-ink", "bg-muted", "bg-orange", "bg-coin", "bg-coin-soft", "bg-mint", "bg-mint-soft",
  "bg-purple", "bg-purple-btn", "bg-purple-soft", "bg-pink", "bg-pink-soft", "bg-sand", "bg-night",
];

export default function Styleguide() {
  return (
    <main className="mx-auto flex max-w-[920px] flex-col gap-4 px-4 py-6 md:px-7">
      <h1 className="text-[28px] md:text-[34px]">Styleguide · Ủn Ỉn Cả Nhà</h1>

      <h2 className="text-[21px]">Linh vật Ủn</h2>
      <Card className="flex flex-wrap items-end justify-around gap-4">
        {MOODS.map((m) => (
          <div key={m} className="text-center">
            <Pig mood={m} size={110} />
            <p className="text-sm text-muted">{m}</p>
          </div>
        ))}
      </Card>

      <h2 className="text-[21px]">Màu</h2>
      <div className="grid grid-cols-3 gap-3 md:grid-cols-5">
        {COLORS.map((c) => (
          <div key={c} className="text-center text-xs">
            <div className={`h-12 rounded-xl border-[3px] border-ink ${c}`} />
            {c.slice(3)}
          </div>
        ))}
      </div>

      <h2 className="text-[21px]">Nút</h2>
      <Card className="flex flex-wrap items-center gap-3">
        <Button color="orange">Xong rồi nè!</Button>
        <Button color="mint">Gật đầu</Button>
        <Button color="coin">Đổi phiếu</Button>
        <Button color="pink">Lời khen</Button>
        <Button color="purple">Đường đua</Button>
        <Button>Nhắc nhẹ</Button>
        <Button ghost>Nét đứt</Button>
        <Button disabled>Còn thiếu 30 Ủn</Button>
        <Button size="sm" color="mint">Nhỏ</Button>
        <Button size="big" color="orange">Nút to</Button>
      </Card>

      <h2 className="text-[21px]">Ủn</h2>
      <Card className="flex items-center gap-4">
        <Coin size={22} />
        <Coin size={40} />
        <CoinPill amount={320} />
      </Card>

      <h2 className="text-[21px]">Thẻ</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <Card>Trắng</Card>
        <Card tone="pink">Làm cùng nhau</Card>
        <Card tone="purple">Chờ gật đầu</Card>
        <Card tone="mint">Hũ Mơ Ước</Card>
        <Card tone="coin">Chuỗi ngày</Card>
        <Card tone="sand">Bị khoá</Card>
      </div>

      <h2 className="text-[21px]">Icon</h2>
      <Card className="grid grid-cols-5 gap-3 md:grid-cols-8">
        {(Object.keys(ICON_PATHS) as IconName[]).map((n) => (
          <div key={n} className="flex flex-col items-center gap-1 text-[11px]">
            <Icon name={n} size={32} />
            {n}
          </div>
        ))}
      </Card>
    </main>
  );
}

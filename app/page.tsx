import Link from "next/link";
import { Button } from "@/components/Button";
import { Pig } from "@/components/Pig";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col items-center justify-center gap-4 p-4 text-center">
      <Pig mood="joy" size={150} className="bob" />
      <h1 className="text-[34px]">Ủn Ỉn Cả Nhà</h1>
      <p className="text-muted">Cùng con làm việc nhỏ · cùng nhau đi chơi to</p>
      <Link href="/styleguide">
        <Button color="coin">Xem styleguide</Button>
      </Link>
    </main>
  );
}

import Link from "next/link";
import { CopyItemNumber } from "@/components/copy-item-number";
import { S2B_ITEM_NUMBER, S2B_URL } from "@/lib/catalog";

const SHOW_S2B = false;

const uses = ["지역별·학교별 기온 비교", "하루 동안의 기온·습도 변화 관찰", "CSV로 내려받아 데이터 분석 수업"];

export function HomeIntro() {
  return (
    <section className="rounded-2xl border border-line bg-card px-4 py-4 md:px-6 md:py-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] tracking-[0.16em] text-muted">SCHOOL WEATHER NETWORK</p>
          <h1 className="mt-1 text-lg font-medium md:text-xl">학생이 만든 기상대로 우리 지역 날씨를 관측합니다</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            학생이 설치한 기상대가 기본 10분마다 기온과 습도를 기록합니다. 다른 사용자의 관측값들을 지도에서 비교하고,
            시트의 그래프와 CSV 파일로 직접 분석해 볼 수 있습니다.
          </p>
          <ul className="mt-3 hidden flex-wrap gap-2 sm:flex">
            {uses.map((use) => (
              <li key={use} className="rounded-full bg-paper px-3 py-1 text-xs text-ink">
                {use}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link href="/guide" className="rounded-md bg-sidebar px-3 py-2 text-sm text-white hover:opacity-90">
            기상대 설치 방법
          </Link>
          {SHOW_S2B ? (
            <div className="flex items-center gap-2 whitespace-nowrap rounded-md border border-line px-3 py-1.5 text-xs">
              <a
                href={S2B_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-accent px-2 py-0.5 font-medium text-ink"
              >
                학교장터(S2B)
              </a>
              <span>
                물품번호 <span className="font-mono">{S2B_ITEM_NUMBER}</span>
              </span>
              <CopyItemNumber value={S2B_ITEM_NUMBER} compact />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

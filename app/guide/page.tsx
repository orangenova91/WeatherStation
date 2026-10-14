import Link from "next/link";
import { CopyItemNumber } from "@/components/copy-item-number";
import { PlatformFrame } from "@/components/platform-frame";

const ITEM_NUMBER = "202609289528072";

export const metadata = { title: "기상대 설치 방법" };

const steps = [
  "weather_station.ino를 ESP32에 올립니다. 구글 시트용 스케치는 이 플랫폼으로 보내지 못합니다.",
  "로그인 후 Data 서버 만들기에서 시트를 만들고 토큰을 복사합니다.",
  "휴대폰 WIFI를 ESP32-Setup에 연결하고 브라우저에서 192.168.4.1을 엽니다.",
  "아래 순서대로 모두 입력합니다. 하나라도 비어 있으면 전송되지 않습니다.",
  "측정을 시작합니다. 기본 간격은 1분이고, 1분에서 1시간 사이로 바꿀 수 있습니다.",
  "시트 표에 행이 쌓이고 공유 지도 마커가 호박색이면 수신된 것입니다. 마지막 수신이 1시간을 넘으면 회색입니다.",
];

const fields = [
  "Token. 복사한 토큰",
  "Device Name. 기기 이름",
  "Sensor Name. 센서 이름",
  "Location Name. 위치 이름",
  "Latitude. 위도",
  "Longitude. 경도",
  "Sender Name. 발신자 이름. 맨 마지막에 입력합니다",
];

function StepItem({ index, step }: { index: number; step: string }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-line bg-card px-5 py-4">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sidebar text-xs text-white">
        {index + 1}
      </span>
      <p className="text-sm leading-6">
        {index === 0 ? (
          <>
            <a href="/download/weather_station.ino" download="weather_station.ino" className="font-medium text-ink underline">
              weather_station.ino
            </a>
            를 ESP32에 올립니다. 구글 시트용 스케치는 이 플랫폼으로 보내지 못합니다.
          </>
        ) : index === 1 ? (
          <>
            로그인 후{" "}
            <Link href="/sheets" className="font-medium text-ink underline">
              Data 서버 만들기
            </Link>
            에서 시트를 만들고 토큰을 복사합니다.
          </>
        ) : (
          step
        )}
      </p>
    </li>
  );
}

function FieldOrder() {
  return (
    <section className="rounded-2xl border border-line bg-card px-5 py-4">
      <h2 className="text-base font-medium">설정 화면 입력 순서</h2>
      <ol className="mt-3 flex flex-col gap-2 text-sm">
        {fields.map((field, index) => (
          <li key={field}>
            {index + 1}. {field}
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm leading-6 text-muted">
        시트에서 복사한 토큰을 Token 칸에 입력해야 합니다. 기기명은 사용하는 마이크로 컨트롤러(ESP32 등...), 센서명은 측정하는 센서 이름, 위치명은 측정 위치 이름입니다.
        좌표는 공유 지도에서 정확한 위도와 경도를 확인해서 입력해주세요. 발신자명은 사용자 이름이나 닉네임을 입력합니다.
      </p>
    </section>
  );
}

export default function GuidePage() {
  return (
    <PlatformFrame>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-medium">기상대 설치 방법</h1>
            <p className="mt-1 text-sm text-muted">관측값을 이 플랫폼으로 보내는 순서입니다.</p>
          </div>
          <section className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-card px-3 py-2 text-xs">
            <a
              href="https://www.s2b.kr/S2BNCustomer/S2B/index.jsp"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-accent px-2 py-0.5 font-medium text-ink"
            >
              학교장터(S2B)
            </a>
            <span>
              물품번호 <span className="font-mono">{ITEM_NUMBER}</span>
            </span>
            <CopyItemNumber value={ITEM_NUMBER} compact />
          </section>
        </div>
        <div className="flex flex-col gap-3">
          <ol className="flex flex-col gap-3">
            {steps.slice(0, 4).map((step, index) => (
              <StepItem key={step} index={index} step={step} />
            ))}
          </ol>
          <FieldOrder />
          <ol className="flex flex-col gap-3" start={5}>
            {steps.slice(4).map((step, index) => (
              <StepItem key={step} index={index + 4} step={step} />
            ))}
          </ol>
        </div>
      </div>
    </PlatformFrame>
  );
}

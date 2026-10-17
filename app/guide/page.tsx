import Link from "next/link";
import type { ReactNode } from "react";
import { CollapsibleStep } from "@/components/collapsible-step";
import { CopyItemNumber } from "@/components/copy-item-number";
import { PlatformFrame } from "@/components/platform-frame";
import { S2B_ITEM_NUMBER, S2B_URL } from "@/lib/catalog";

export const metadata = { title: "기상대 설치 방법" };

const steps = [
  "weather_station.ino를 ESP32에 올립니다. 구글 시트용 스케치는 이 플랫폼으로 보내지 못합니다.",
  "로그인 후 Data 서버 만들기에서 시트를 만들고 토큰을 복사합니다.",
  "휴대폰 WIFI를 ESP32-Setup에 연결하고 브라우저에서 192.168.4.1을 엽니다.",
  "아래 순서대로 모두 입력합니다. 하나라도 비어 있으면 전송되지 않습니다.",
  "측정을 시작합니다. 기본 간격은 10분이고, 1분에서 1시간 사이로 바꿀 수 있습니다.",
  "시트 표에 행이 쌓이고 공유 지도 마커가 호박색이면 수신된 것입니다. 마지막 수신이 1시간을 넘으면 회색입니다.",
];

const fields = [
  "Token. 복사한 토큰",
  "Device Name. 기기 이름",
  "Sensor Name. 센서 이름",
  "Location Name. 위치 이름",
  "Latitude. 위도",
  "Longitude. 경도",
  "Use my location. 가능하면 휴대폰 위치로 위도/경도를 채웁니다(안 되면 수동 입력)",
  "Sender Name. 발신자 이름. 맨 마지막에 입력합니다",
];

const wiring = [
  {
    part: "온습도 센서 DHT11",
    pins: [
      ["DATA", "GPIO 4"],
      ["VCC", "3.3V"],
      ["GND", "GND"],
    ],
  },
  {
    part: "OLED 디스플레이 SSD1306 128×64 (I2C, 0x3C)",
    pins: [
      ["SDA", "GPIO 21"],
      ["SCL", "GPIO 22"],
      ["VCC", "3.3V"],
      ["GND", "GND"],
    ],
  },
  {
    part: "조이스틱 모듈",
    pins: [
      ["VRx", "GPIO 34"],
      ["VRy", "GPIO 35 (현재 미사용)"],
      ["SW", "GPIO 32"],
      ["+5V", "3.3V"],
      ["GND", "GND"],
    ],
  },
];

function WiringTable() {
  return (
    <div className="flex flex-col gap-4">
      {wiring.map(({ part, pins }) => (
        <section key={part}>
          <h3 className="text-sm font-medium">{part}</h3>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-4 font-medium">부품 핀</th>
                <th className="py-1 font-medium">ESP32</th>
              </tr>
            </thead>
            <tbody>
              {pins.map(([pin, target]) => (
                <tr key={pin} className="border-t border-line">
                  <td className="py-1.5 pr-4 font-mono">{pin}</td>
                  <td className="py-1.5 font-mono">{target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="text-xs leading-5 text-muted">
        ESP32의 아날로그 입력은 3.3V까지 읽으므로 조이스틱 전원도 3.3V에 연결합니다. DHT22를 쓰면 스케치의 DHTTYPE과
        설정 화면의 Sensor Name을 함께 바꿉니다.
      </p>
    </div>
  );
}

const sheetSetup = [
  "계정이 없으면 왼쪽 메뉴의 가입에서 이메일과 비밀번호를 입력하고, 이메일로 받은 인증번호 6자리를 넣어 계정을 만듭니다. 계정이 있으면 로그인합니다.",
  "로그인하면 왼쪽 메뉴에 Data 서버 만들기가 나타납니다. 이 메뉴로 이동합니다.",
  "시트 만들기 칸에 시트 이름을 입력하고 만들기를 누릅니다. 예: OO초 운동장, 과학실 창가",
  "만들기를 누르면 그 시트 화면으로 바로 이동합니다. 송신 토큰 영역에서 토큰 복사를 누릅니다.",
  "복사한 토큰은 휴대폰 메모 등에 옮겨 둡니다. 다음 단계에서 휴대폰을 ESP32-Setup WIFI에 연결하면 인터넷이 끊기므로 미리 준비해 두는 것이 좋습니다.",
];

const sheetNotes = [
  "토큰은 ABCD-EFGH-JKMN처럼 12자리입니다. 하이픈(-)을 빼거나 소문자로 입력해도 같은 토큰으로 인식합니다.",
  "기상대마다 시트를 따로 만들면 관측 기록을 나눠 보기 쉽습니다.",
  "토큰이 다른 사람에게 알려졌다면 시트 화면에서 토큰 재발급을 누릅니다. 기존 토큰은 바로 막히므로 기상대에 새 토큰을 다시 입력해야 합니다.",
  "새 시트는 공유 지도에 표시되도록 켜져 있습니다. 지도에 보이지 않게 하려면 Data 서버 만들기 목록의 지도 공유 스위치를 끕니다.",
];

const wifiSetup = [
  "기상대 전원을 켜고 OLED에 첫 화면이 나오면 조이스틱 버튼을 눌러 메뉴를 엽니다.",
  "조이스틱을 위아래로 움직여 3. WiFi Connect를 고르고 버튼을 누릅니다. 화면에 Connect phone to: ESP32-Setup이 나타납니다.",
  "휴대폰 WIFI 설정에서 ESP32-Setup을 선택합니다. 비밀번호 없이 연결되며, 인터넷 없음 알림이 나와도 연결을 유지합니다.",
  "설정 화면이 자동으로 뜨지 않으면 휴대폰 브라우저 주소창에 192.168.4.1을 입력합니다.",
  "설정 화면에서 Configure WiFi를 누르고 기상대를 연결할 WIFI를 고른 뒤 비밀번호를 입력합니다. 같은 화면 아래 항목은 다음 단계의 순서대로 입력하고 Save를 누릅니다.",
  "연결되면 OLED에 Connected!와 WIFI 이름, IP 주소가 표시됩니다. 버튼을 누르면 메뉴로 돌아갑니다.",
];

const wifiNotes = [
  "설정 화면은 3분 동안 저장하지 않으면 닫히고 OLED에 Setup timed out이 표시됩니다. 메뉴에서 WiFi Connect를 다시 고르면 됩니다.",
  "ESP32는 2.4GHz WIFI에만 연결됩니다. 5GHz 전용 WIFI나 접속할 때 웹 로그인이 필요한 WIFI는 쓸 수 없습니다.",
  "설정하는 동안 휴대폰이 다른 WIFI로 바꾸지 않도록 모바일 데이터를 잠시 꺼 두면 좋습니다.",
  "이미 연결된 상태에서 WiFi Connect를 고르면 Already connected가 표시됩니다. 토큰이나 위치를 다시 입력하려면 이 화면에서 버튼을 3초간 눌러 WIFI 정보를 지운 뒤 WiFi Connect를 다시 고릅니다.",
];

const measureSetup = [
  "간격을 바꾸려면 메뉴에서 2. Set Interval을 고릅니다. 조이스틱을 위아래로 움직이면 1분 단위로 바뀌고(1분~60분), 버튼을 누르면 저장하고 메뉴로 돌아갑니다.",
  "메뉴에서 1. Start Measure를 고르고 버튼을 누릅니다. 바로 첫 측정을 하고, 그 뒤로 정한 간격마다 측정해 플랫폼으로 보냅니다.",
  "OLED에 Temp(기온)와 Humi(습도)가 표시됩니다. 오른쪽 위에서 측정 간격과 WIFI 연결 상태를 확인할 수 있습니다.",
  "측정을 멈추려면 버튼을 3초간 누르고 있습니다. 화면 아래 막대가 끝까지 차면 메뉴로 돌아갑니다.",
];

const measureNotes = [
  "측정 화면에 있는 동안에만 측정하고 보냅니다. 메뉴로 나오면 전송도 멈춥니다.",
  "전원을 껐다 켜면 WIFI가 자동으로 연결되지 않고 간격도 10분으로 돌아갑니다. 메뉴에서 WiFi Connect를 고르면 저장된 WIFI로 바로 연결되니, 그다음 Start Measure를 다시 고릅니다. 토큰과 위치 정보는 저장되어 있어 다시 입력하지 않아도 됩니다.",
  "WIFI가 연결되지 않으면 화면에는 측정값이 나오지만 플랫폼으로는 보내지지 않습니다.",
  "Sensor Read Error!가 표시되면 DHT11의 DATA(GPIO 4)와 전원 배선을 확인합니다.",
];

const receiveCheck = [
  "Data 서버 만들기 목록에서 시트 이름 옆에 수신 중이 표시되는지 확인합니다. 1시간 이내에 값이 들어온 시트에 표시됩니다.",
  "시트를 눌러 들어가면 위쪽에 실시간 연결됨이 보이고, 새 관측값이 들어오는 즉시 수신 기록 표 맨 위에 추가됩니다.",
  "표와 그래프 버튼으로 보기를 바꿀 수 있습니다. 그래프에서는 기온·습도 변화를 한눈에 보고, 관측소가 여러 곳이면 골라서 볼 수 있습니다.",
  "CSV 받기를 누르면 전체 기록을 파일로 내려받아 엑셀이나 스프레드시트에서 분석할 수 있습니다. 화면의 표에는 최신 100건만 표시됩니다.",
  "공유 지도에서 기상대 위치에 마커가 나타납니다. 지도는 약 20초마다 새로 고쳐지고, 마커를 누르면 최근 기온·습도와 수신 시각이 보입니다.",
];

const receiveNotes = [
  "기록이 쌓이지 않으면 먼저 기상대가 측정 화면에 있는지, OLED 오른쪽 위에 WIFI 연결 표시가 있는지 확인합니다.",
  "Token, Device Name, Sensor Name, Location Name, Sender Name 중 하나라도 비어 있거나 위도·경도가 숫자가 아니면 기상대가 값을 보내지 않습니다. 3단계 참고 사항대로 설정을 다시 입력합니다.",
  "토큰을 재발급했다면 기상대에도 새 토큰을 입력해야 합니다.",
  "지도 공유를 끈 시트는 기록은 쌓이지만 공유 지도에는 나타나지 않습니다.",
];

function StepGuide({ items, notes }: { items: string[]; notes: string[] }) {
  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-2 text-sm leading-6">
        {items.map((item, index) => (
          <li key={item} className="flex gap-2">
            <span className="shrink-0 font-mono text-xs leading-6 text-muted">{index + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ol>
      <ul className="flex flex-col gap-1.5 text-xs leading-5 text-muted">
        {notes.map((note) => (
          <li key={note}>· {note}</li>
        ))}
      </ul>
    </div>
  );
}

const stepDetails: Record<number, ReactNode> = {
  0: <WiringTable />,
  1: <StepGuide items={sheetSetup} notes={sheetNotes} />,
  2: <StepGuide items={wifiSetup} notes={wifiNotes} />,
  4: <StepGuide items={measureSetup} notes={measureNotes} />,
  5: <StepGuide items={receiveCheck} notes={receiveNotes} />,
};

function StepText({ index, step }: { index: number; step: string }) {
  return (
    <p className="text-sm leading-6">
      {index === 0 ? (
        <>
          아래(펼치기 ▾) 설계대로 기상대를 조립하고, 다음 코드(
          <a href="/download/weather_station.ino" download="weather_station.ino" className="font-medium text-ink underline">
            weather_station.ino
          </a>
          )를 ESP32에 올립니다.
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
  );
}

function StepItem({ index, step }: { index: number; step: string }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-line bg-card px-4 py-4 md:px-5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sidebar text-xs text-white">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        {stepDetails[index] ? (
          <CollapsibleStep header={<StepText index={index} step={step} />}>{stepDetails[index]}</CollapsibleStep>
        ) : (
          <StepText index={index} step={step} />
        )}
      </div>
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
        좌표는 Use my location으로 채울 수 있습니다. 브라우저가 위치를 막으면 공유 지도에서 위도·경도를 확인한 뒤 수동으로 입력하세요. 발신자명은 사용자 이름이나 닉네임을 입력합니다.
      </p>
    </section>
  );
}

export default function GuidePage() {
  return (
    <PlatformFrame>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:gap-4">
          <div>
            <h1 className="text-xl font-medium md:text-2xl">기상대 설치 방법</h1>
            <p className="mt-1 text-sm text-muted">관측값을 이 플랫폼으로 보내는 순서입니다.</p>
          </div>
          <section className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-card px-3 py-2 text-xs">
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

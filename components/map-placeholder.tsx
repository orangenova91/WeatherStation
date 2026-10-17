type MapPlaceholderProps = {
  count?: number;
  offline?: boolean;
  loading?: boolean;
};

export function MapPlaceholder({ count, offline = false, loading = false }: MapPlaceholderProps) {
  let status = "좌표를 이 영역에 실시간으로 표시할 예정입니다.";
  if (loading) status = "수신 건수를 확인하는 중…";
  else if (offline) status = "데이터베이스에 연결되지 않았습니다.";
  else if (count === 0) status = "아직 수신된 좌표가 없습니다.";
  else if (typeof count === "number") status = `최근 수신 목록 ${count}건이 저장되어 있습니다.`;

  return (
    <section className="relative min-h-[20rem] flex-1 md:min-h-[32rem] overflow-hidden rounded-2xl border border-line bg-[#e7f0ea]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(18,32,42,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(18,32,42,0.07) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div className="absolute top-4 left-5 text-xs tracking-[0.2em] text-muted">N</div>
      <div className="absolute top-4 right-5 rounded-full border border-line bg-card px-3 py-1 text-xs text-muted">
        실시간 마커 · 준비 중
      </div>
      <div className="relative flex min-h-[20rem] items-center justify-center p-6 md:min-h-[32rem]">
        <div className="max-w-md rounded-2xl border border-line bg-card/95 px-6 py-5 text-center shadow-sm">
          <p className="text-lg font-medium">공유 지도</p>
          <p className="mt-2 text-sm leading-6 text-muted">{status}</p>
        </div>
      </div>
    </section>
  );
}

import type { ReactNode } from "react";

export function ShellFallback({ children }: { children?: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-screen bg-paper">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-white md:flex">
        <div className="flex items-center gap-3 px-5 py-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/50">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          <div>
            <p className="text-[11px] tracking-[0.16em] text-sidebar-muted">WEATHER STATION</p>
            <p className="text-sm font-medium">관측 플랫폼</p>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center border-b border-line bg-card px-4 md:px-6">
          <p className="text-sm font-medium">Weather Station</p>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
          {children ?? <p className="text-sm text-muted">불러오는 중…</p>}
        </main>
        <footer className="hidden h-10 shrink-0 items-center border-t border-line px-6 text-xs text-muted md:flex">
          관측값은 각 시트의 송신 토큰으로 저장됩니다.
        </footer>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type PlatformShellProps = {
  user: { email: string } | null;
  children: ReactNode;
};

const titles: Array<{ prefix: string; title: string }> = [
  { prefix: "/sheets/", title: "시트 수신" },
  { prefix: "/sheets", title: "Data 서버 만들기" },
  { prefix: "/login", title: "로그인" },
  { prefix: "/signup", title: "가입" },
  { prefix: "/guide", title: "기상대 설치 방법" },
  { prefix: "/", title: "공유 지도" },
];

function sectionTitle(pathname: string) {
  const match = titles.find((item) =>
    item.prefix === "/" ? pathname === "/" : pathname === item.prefix || pathname.startsWith(item.prefix),
  );
  return match?.title ?? "Weather Station";
}

function navClass(active: boolean) {
  return `block rounded-md px-3 py-2.5 text-sm md:py-2 ${
    active ? "bg-white/10 text-white" : "text-sidebar-muted hover:bg-white/5 hover:text-white"
  }`;
}

export function PlatformShell({ user, children }: PlatformShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  async function logout() {
    closeMenu();
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex h-dvh min-h-screen bg-paper">
      {menuOpen ? (
        <div className="fixed inset-0 z-[900] bg-sidebar/50 md:hidden" aria-hidden onClick={closeMenu} />
      ) : null}
      <aside
        id="platform-nav"
        className={`fixed inset-y-0 left-0 z-[1000] flex w-64 shrink-0 flex-col bg-sidebar text-white transition-transform duration-200 md:static md:z-auto md:w-60 md:translate-x-0 md:transition-none ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-accent/50">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" />
            </span>
            <div>
              <p className="text-[11px] tracking-[0.16em] text-sidebar-muted">WEATHER STATION</p>
              <p className="text-sm font-medium">관측 플랫폼</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeMenu}
            aria-label="메뉴 닫기"
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md text-xl text-sidebar-muted hover:text-white md:hidden"
          >
            ×
          </button>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          <Link href="/" onClick={closeMenu} className={navClass(pathname === "/")}>
            공유 지도
          </Link>
          <Link href="/guide" onClick={closeMenu} className={navClass(pathname === "/guide")}>
            기상대 설치 방법
          </Link>
          {user ? (
            <Link href="/sheets" onClick={closeMenu} className={navClass(pathname.startsWith("/sheets"))}>
              Data 서버 만들기
            </Link>
          ) : null}
        </nav>
        <div className="mt-auto border-t border-white/10 p-4">
          {user ? (
            <div className="space-y-3">
              <p className="truncate text-xs text-sidebar-muted">{user.email}</p>
              <button
                type="button"
                onClick={logout}
                className="w-full rounded-md border border-white/15 px-3 py-2.5 text-sm text-white hover:bg-white/5 md:py-2"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <Link href="/login" onClick={closeMenu} className={navClass(pathname === "/login")}>
                로그인
              </Link>
              <Link href="/signup" onClick={closeMenu} className={navClass(pathname === "/signup")}>
                가입
              </Link>
            </div>
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-card px-3 md:px-6">
          <div className="flex min-w-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              aria-label="메뉴 열기"
              aria-expanded={menuOpen}
              aria-controls="platform-nav"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink hover:bg-paper md:hidden"
            >
              <span aria-hidden className="flex w-5 flex-col gap-1">
                <span className="h-0.5 rounded bg-current" />
                <span className="h-0.5 rounded bg-current" />
                <span className="h-0.5 rounded bg-current" />
              </span>
            </button>
            <p className="truncate text-sm font-medium">{sectionTitle(pathname)}</p>
          </div>
          <p className="hidden truncate text-xs text-muted sm:block">{user ? user.email : "게스트"}</p>
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6">{children}</main>
        <footer className="hidden h-10 shrink-0 items-center border-t border-line px-6 text-xs text-muted md:flex">
          관측값은 각 시트의 송신 토큰으로 저장됩니다.
        </footer>
      </div>
    </div>
  );
}

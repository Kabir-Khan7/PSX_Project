"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { apiGet } from "@/lib/api";

interface Props { children: React.ReactNode; }

const NAV = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: "/watchlist",
    label: "Watchlist",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    href: "/markets",
    label: "Markets",
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
      </svg>
    ),
  },
];

export default function AppLayout({ children }: Props) {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]     = useState<{ email: string } | null>(null);
  const [time, setTime]     = useState("");
  const [sideOpen, setSideOpen] = useState(false);

  const logout = useCallback(async () => {
    try { await fetch("http://localhost:8000/auth/logout", { method: "POST", credentials: "include" }); } catch {}
    router.push("/login");
  }, [router]);

  useEffect(() => {
    apiGet<{ email: string }>("/auth/me").then(setUser).catch(() => router.push("/login"));
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Karachi",
    }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [router]);

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; font-family: 'Plus Jakarta Sans', sans-serif; background: #f0f4f8; }

        .app-root { display: flex; height: 100vh; overflow: hidden; background: #f0f4f8; }

        /* ── Sidebar ── */
        .sidebar {
          width: 220px; flex-shrink: 0;
          background: #0a1628;
          display: flex; flex-direction: column;
          z-index: 100;
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        .sidebar-brand {
          height: 60px; display: flex; align-items: center;
          padding: 0 1.1rem; gap: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          flex-shrink: 0; text-decoration: none;
        }
        .sidebar-logo {
          width: 30px; height: 30px; border-radius: 8px;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-title {
          color: #f0f6ff; font-weight: 700; font-size: 0.9rem;
          letter-spacing: -0.03em;
        }
        .sidebar-nav { flex: 1; padding: 0.75rem 0.6rem; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; }
        .nav-item {
          display: flex; align-items: center; gap: 9px;
          padding: 0.6rem 0.85rem; border-radius: 8px;
          text-decoration: none; font-size: 0.82rem; font-weight: 500;
          transition: all 0.15s; cursor: pointer;
          border: none; background: transparent; width: 100%;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .nav-item.active { background: rgba(255,255,255,0.1); color: #ffffff; }
        .nav-item:not(.active) { color: rgba(255,255,255,0.45); }
        .nav-item:not(.active):hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.8); }

        .sidebar-footer {
          padding: 0.6rem; border-top: 1px solid rgba(255,255,255,0.07); flex-shrink: 0;
        }
        .user-card {
          display: flex; align-items: center; gap: 9px;
          padding: 0.6rem 0.85rem; border-radius: 8px;
          background: rgba(255,255,255,0.05); margin-bottom: 4px;
        }
        .user-avatar {
          width: 28px; height: 28px; border-radius: 50%;
          background: #0891b2; color: white;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.68rem; font-weight: 700; flex-shrink: 0;
        }
        .user-email { color: #f0f6ff; font-size: 0.72rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .user-plan  { color: rgba(255,255,255,0.3); font-size: 0.62rem; }
        .logout-btn {
          display: flex; align-items: center; gap: 9px;
          padding: 0.6rem 0.85rem; border-radius: 8px;
          background: transparent; border: none;
          color: rgba(255,255,255,0.4); font-size: 0.82rem; font-weight: 500;
          cursor: pointer; transition: all 0.15s; width: 100%;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .logout-btn:hover { background: rgba(248,113,113,0.1); color: #f87171; }

        /* ── Main area ── */
        .main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }

        .topbar {
          height: 54px; background: #ffffff;
          border-bottom: 1px solid #e8edf4;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 1.25rem; flex-shrink: 0;
          box-shadow: 0 1px 3px rgba(10,22,40,0.06);
          gap: 1rem; z-index: 40;
        }
        .topbar-left { display: flex; align-items: center; gap: 10px; }
        .hamburger {
          display: none; background: none; border: none; cursor: pointer;
          color: #6b7a99; padding: 6px; border-radius: 6px;
          transition: background 0.15s;
        }
        .hamburger:hover { background: #f0f4f8; }
        .topbar-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .market-badge {
          display: flex; align-items: center; gap: 5px;
          background: #f0fdf4; border: 1px solid #bbf7d0;
          border-radius: 20px; padding: 3px 10px;
          font-size: 0.62rem; font-weight: 700;
          color: #15803d; letter-spacing: 0.06em; text-transform: uppercase;
        }
        .market-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .clock-badge {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.68rem; color: #6b7a99;
          background: #f5f7fa; padding: 4px 10px;
          border-radius: 6px; border: 1px solid #e8edf4;
        }
        .topbar-avatar {
          width: 30px; height: 30px; border-radius: 50%;
          background: #0a1628; color: white;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.7rem; font-weight: 700; cursor: pointer; flex-shrink: 0;
        }

        .page-content { flex: 1; overflow-y: auto; overflow-x: hidden; }

        /* ── Mobile overlay ── */
        .mobile-overlay {
          display: none; position: fixed; inset: 0;
          background: rgba(0,0,0,0.55); z-index: 90;
        }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .sidebar {
            position: fixed; top: 0; left: 0; bottom: 0;
            transform: translateX(-100%);
          }
          .sidebar.open { transform: translateX(0); }
          .hamburger { display: flex; align-items: center; justify-content: center; }
          .mobile-overlay.show { display: block; }
          .market-badge { display: none; }
        }
        @media (max-width: 600px) {
          .clock-badge { display: none; }
          .topbar { padding: 0 1rem; }
        }
      `}</style>

      {/* Overlay */}
      <div className={`mobile-overlay ${sideOpen ? "show" : ""}`} onClick={() => setSideOpen(false)}/>

      <div className="app-root">

        {/* SIDEBAR */}
        <aside className={`sidebar ${sideOpen ? "open" : ""}`}>
          <Link href="/dashboard" className="sidebar-brand" onClick={() => setSideOpen(false)}>
            <div className="sidebar-logo">
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <polyline points="1,13 5,7 9,10 15,3" stroke="#0fd4b4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="15" cy="3" r="1.8" fill="#34d399"/>
              </svg>
            </div>
            <span className="sidebar-title">PSX<span style={{ color: "#0fd4b4" }}>.</span>Analysis</span>
          </Link>

          <nav className="sidebar-nav">
            {NAV.map(({ href, label, icon }) => {
              const active = pathname === href || (pathname.startsWith(href + "/") && href !== "/");
              return (
                <Link key={href} href={href} className={`nav-item ${active ? "active" : ""}`} onClick={() => setSideOpen(false)}>
                  <span style={{ flexShrink: 0 }}>{icon}</span>
                  <span style={{ flex: 1 }}>{label}</span>
                  {active && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="user-card">
              <div className="user-avatar">{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="user-email">{user?.email ?? "..."}</div>
                <div className="user-plan">Free Plan</div>
              </div>
            </div>
            <button className="logout-btn" onClick={logout}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>
          </div>
        </aside>

        {/* MAIN */}
        <div className="main-area">
          <header className="topbar">
            <div className="topbar-left">
              <button className="hamburger" onClick={() => setSideOpen(s => !s)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                </svg>
              </button>
              {/* Breadcrumb */}
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2d3a52", textTransform: "capitalize" }}>
                {pathname.split("/")[1] || "Dashboard"}
              </span>
            </div>
            <div className="topbar-right">
              <div className="market-badge">
                <span className="market-dot"/>
                Market Open
              </div>
              <code className="clock-badge">{time} PKT</code>
              <div className="topbar-avatar">{initials}</div>
            </div>
          </header>

          <main className="page-content">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
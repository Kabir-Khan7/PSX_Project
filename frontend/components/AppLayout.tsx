"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { apiGet } from "@/lib/api";

interface Props { children: React.ReactNode; }

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>)},
  { href: "/watchlist", label: "Watchlist", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>)},
  { href: "/markets", label: "Markets", icon: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
    </svg>)},
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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; font-family: 'Plus Jakarta Sans', sans-serif; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #0d1b33; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 9999px; }
        ::-webkit-scrollbar-thumb:hover { background: #0fd4b4; }

        .app-shell { display:flex; height:100vh; overflow:hidden; background:#060d1f; }

        /* ── SIDEBAR ── */
        .sidebar {
          width:220px; flex-shrink:0;
          background:#060d1f;
          border-right:1px solid rgba(255,255,255,0.06);
          display:flex; flex-direction:column;
          z-index:100;
          transition:transform 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        .sidebar-brand {
          height:58px; display:flex; align-items:center;
          padding:0 1.1rem; gap:10px;
          border-bottom:1px solid rgba(255,255,255,0.06);
          flex-shrink:0; text-decoration:none;
        }
        .sidebar-logo {
          width:30px; height:30px; border-radius:8px;
          background:rgba(15,212,180,0.1);
          border:1px solid rgba(15,212,180,0.2);
          display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .sidebar-name { color:#f0f6ff; font-weight:700; font-size:0.88rem; letter-spacing:-0.02em; }
        .sidebar-name em { font-style:normal; color:#0fd4b4; }
        .sidebar-nav { flex:1; padding:0.75rem 0.6rem; display:flex; flex-direction:column; gap:2px; overflow-y:auto; }
        .nav-link {
          display:flex; align-items:center; gap:9px;
          padding:0.6rem 0.85rem; border-radius:8px;
          text-decoration:none; font-size:0.8rem; font-weight:500;
          transition:all 0.15s; color:rgba(255,255,255,0.4);
        }
        .nav-link:hover { background:rgba(255,255,255,0.05); color:rgba(255,255,255,0.75); }
        .nav-link.active {
          background:rgba(15,212,180,0.1);
          color:#0fd4b4;
          border:1px solid rgba(15,212,180,0.15);
        }
        .nav-link.active svg { color:#0fd4b4; }
        .nav-dot { width:5px; height:5px; border-radius:50%; background:#0fd4b4; margin-left:auto; flex-shrink:0; }

        .sidebar-footer {
          padding:0.75rem 0.6rem;
          border-top:1px solid rgba(255,255,255,0.06);
          flex-shrink:0;
        }
        .user-tile {
          display:flex; align-items:center; gap:9px;
          padding:0.6rem 0.85rem; border-radius:8px;
          background:rgba(255,255,255,0.04);
          border:1px solid rgba(255,255,255,0.06);
          margin-bottom:4px;
        }
        .user-avatar {
          width:28px; height:28px; border-radius:50%;
          background:linear-gradient(135deg,#0fd4b4,#0891b2);
          display:flex; align-items:center; justify-content:center;
          color:#060d1f; font-size:0.68rem; font-weight:800; flex-shrink:0;
        }
        .user-email { color:#f0f6ff; font-size:0.7rem; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .user-plan  { color:rgba(255,255,255,0.3); font-size:0.6rem; }
        .logout-btn {
          display:flex; align-items:center; gap:9px;
          padding:0.6rem 0.85rem; border-radius:8px;
          background:transparent; border:none;
          color:rgba(255,255,255,0.35); font-size:0.8rem; font-weight:500;
          cursor:pointer; transition:all 0.15s; width:100%;
          font-family:'Plus Jakarta Sans',sans-serif;
        }
        .logout-btn:hover { background:rgba(248,113,113,0.08); color:#f87171; }

        /* ── MAIN AREA ── */
        .main-area { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }

        .topbar {
          height:54px;
          background:#0a1628;
          border-bottom:1px solid rgba(255,255,255,0.06);
          display:flex; align-items:center; justify-content:space-between;
          padding:0 1.25rem; flex-shrink:0; gap:1rem; z-index:40;
        }
        .topbar-left { display:flex; align-items:center; gap:10px; }
        .hamburger {
          display:none; background:none; border:none; cursor:pointer;
          color:rgba(255,255,255,0.4); padding:6px; border-radius:6px;
          transition:all 0.15s;
        }
        .hamburger:hover { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.8); }
        .topbar-breadcrumb {
          font-size:0.78rem; font-weight:600;
          color:rgba(255,255,255,0.5); text-transform:capitalize;
        }
        .topbar-right { display:flex; align-items:center; gap:10px; flex-shrink:0; }
        .market-pill {
          display:flex; align-items:center; gap:5px;
          background:rgba(5,150,105,0.1);
          border:1px solid rgba(5,150,105,0.25);
          border-radius:20px; padding:3px 10px;
          font-size:0.62rem; font-weight:700;
          color:#34d399; letter-spacing:0.06em; text-transform:uppercase;
        }
        .market-dot { width:6px; height:6px; border-radius:50%; background:#34d399; animation:pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .clock {
          font-family:'JetBrains Mono',monospace;
          font-size:0.68rem; color:rgba(255,255,255,0.3);
          background:rgba(255,255,255,0.04);
          padding:4px 10px; border-radius:6px;
          border:1px solid rgba(255,255,255,0.06);
        }
        .topbar-avatar {
          width:30px; height:30px; border-radius:50%;
          background:linear-gradient(135deg,#0fd4b4,#0891b2);
          display:flex; align-items:center; justify-content:center;
          color:#060d1f; font-size:0.7rem; font-weight:800;
          cursor:pointer; flex-shrink:0;
        }

        .page-content { flex:1; overflow-y:auto; overflow-x:hidden; background:#060d1f; }

        .mobile-overlay {
          display:none; position:fixed; inset:0;
          background:rgba(0,0,0,0.65); z-index:90;
        }

        @media (max-width:900px) {
          .sidebar { position:fixed; top:0; left:0; bottom:0; transform:translateX(-100%); }
          .sidebar.open { transform:translateX(0); }
          .hamburger { display:flex; align-items:center; justify-content:center; }
          .mobile-overlay.show { display:block; }
          .market-pill { display:none; }
        }
        @media (max-width:600px) {
          .clock { display:none; }
          .topbar { padding:0 1rem; }
        }
      `}</style>

      <div className={`mobile-overlay ${sideOpen ? "show" : ""}`} onClick={() => setSideOpen(false)}/>

      <div className="app-shell">

        {/* SIDEBAR */}
        <aside className={`sidebar ${sideOpen ? "open" : ""}`}>
          <Link href="/dashboard" className="sidebar-brand" onClick={() => setSideOpen(false)}>
            <div className="sidebar-logo">
              <svg viewBox="0 0 16 16" fill="none" width="15" height="15">
                <polyline points="1,13 5,7 9,10 15,3" stroke="#0fd4b4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="15" cy="3" r="1.8" fill="#34d399"/>
              </svg>
            </div>
            <span className="sidebar-name">PSX<em>.</em>Analysis</span>
          </Link>

          <nav className="sidebar-nav">
            {NAV.map(({ href, label, icon }) => {
              const active = pathname === href || (pathname.startsWith(href + "/") && href !== "/");
              return (
                <Link key={href} href={href} className={`nav-link ${active ? "active" : ""}`}
                  onClick={() => setSideOpen(false)}>
                  <span style={{ flexShrink: 0 }}>{icon}</span>
                  <span style={{ flex: 1 }}>{label}</span>
                  {active && <span className="nav-dot"/>}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <div className="user-tile">
              <div className="user-avatar">{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="user-email">{user?.email ?? "..."}</div>
                <div className="user-plan">Free Plan</div>
              </div>
            </div>
            <button className="logout-btn" onClick={logout}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <span className="topbar-breadcrumb">
                {pathname.split("/")[1] || "dashboard"}
              </span>
            </div>
            <div className="topbar-right">
              <div className="market-pill">
                <span className="market-dot"/>Market Open
              </div>
              <code className="clock">{time} PKT</code>
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
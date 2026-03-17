"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { apiGet } from "@/lib/api";

interface WatchItem {
  id: number; symbol: string; name: string; sector: string;
  price: number | null; ldcp: number | null;
  change: number | null; change_pct: number | null;
}

function fmt(n: number | null | undefined) {
  return n != null ? n.toLocaleString("en-PK", { maximumFractionDigits: 2 }) : "—";
}

export default function WatchlistPage() {
  const router = useRouter();
  const [items, setItems]       = useState<WatchItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast]       = useState<{ msg: string; type: "ok"|"err" }|null>(null);

  const showToast = (msg: string, type: "ok"|"err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await apiGet<WatchItem[]>("/watchlist/");
      setItems(data);
    } catch { router.push("/login"); }
    finally { setLoading(false); setRefreshing(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const remove = async (symbol: string) => {
    try {
      await fetch(`http://localhost:8000/watchlist/${symbol}`, { method: "DELETE", credentials: "include" });
      setItems(prev => prev.filter(i => i.symbol !== symbol));
      showToast(`${symbol} removed from watchlist`);
    } catch { showToast("Failed to remove", "err"); }
  };

  const gainers = items.filter(i => (i.change_pct ?? 0) >= 0).length;

  return (
    <AppLayout>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .toast-bar { animation: slideIn 0.25s ease; }
        .watch-row { transition: background 0.12s; cursor: pointer; }
        .watch-row:hover { background: #f8fafc !important; }
        .del-btn { opacity: 0; transition: opacity 0.15s; }
        .watch-row:hover .del-btn { opacity: 1; }
        @media (max-width: 768px) {
          .watch-col-hide { display: none !important; }
          .watch-pad { padding: 1rem !important; }
          .watch-stats { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      {toast && (
        <div className="toast-bar" style={{
          position: "fixed", top: 20, right: 20, zIndex: 999,
          background: toast.type === "ok" ? "#0a1628" : "#dc2626",
          color: "#ffffff", padding: "10px 18px", borderRadius: 10,
          fontSize: "0.8rem", fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>{toast.msg}</div>
      )}

      <div className="watch-pad" style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0a1628", letterSpacing: "-0.03em", display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              My Watchlist
            </h1>
            <p style={{ fontSize: "0.78rem", color: "#9ba8bb", marginTop: 4 }}>Track and monitor your selected PSX stocks</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => load(true)} disabled={refreshing}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 9,
                background: "#ffffff", border: "1px solid #e8edf4",
                color: "#6b7a99", fontSize: "0.78rem", fontWeight: 600,
                cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "all 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = "#0a1628"}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = "#e8edf4"}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: refreshing ? "spin 0.6s linear infinite" : "none" }}>
                <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", borderRadius: 9,
                background: "#0a1628", border: "none",
                color: "#ffffff", fontSize: "0.78rem", fontWeight: 600,
                cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Stocks
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="watch-stats" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.875rem", marginBottom: "1.5rem" }}>
          {[
            { t: "Total Stocks",    v: items.length,           sub: "of 20 max",        c: "#0a1628" },
            { t: "With Price Data", v: items.filter(i => i.price != null).length, sub: "live data", c: "#0a1628" },
            { t: "Gainers Today",   v: gainers,                sub: "positive change",  c: "#059669" },
            { t: "Losers Today",    v: items.length - gainers, sub: "negative change",  c: "#dc2626" },
          ].map(s => (
            <div key={s.t} style={{ background: "#ffffff", border: "1px solid #e8edf4", borderRadius: 14, padding: "1.1rem 1.25rem", boxShadow: "0 1px 4px rgba(10,22,40,0.05)" }}>
              <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ba8bb", marginBottom: 8 }}>{s.t}</p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.35rem", fontWeight: 600, color: s.c, marginBottom: 4 }}>{s.v}</p>
              <p style={{ fontSize: "0.68rem", color: "#9ba8bb" }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: "#ffffff", border: "1px solid #e8edf4", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(10,22,40,0.05)" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f0f4f8" }}>
            <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0a1628" }}>Tracked Stocks</h2>
          </div>

          {loading ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#9ba8bb", fontSize: "0.82rem" }}>Loading watchlist...</div>
          ) : items.length === 0 ? (
            <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e8edf4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 1rem", display: "block" }}>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <p style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0a1628", marginBottom: 6 }}>Your watchlist is empty</p>
              <p style={{ fontSize: "0.78rem", color: "#9ba8bb", marginBottom: "1.25rem" }}>Go to the dashboard and click the ★ on any stock to add it here</p>
              <button onClick={() => router.push("/dashboard")}
                style={{ padding: "8px 18px", background: "#0a1628", color: "#ffffff", border: "none", borderRadius: 9, fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Go to Dashboard →
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 110px 110px 100px 44px", padding: "0.5rem 1.25rem", background: "#f8fafc", borderBottom: "1px solid #f0f4f8" }}>
                {["Symbol","Company","Price (PKR)","LDCP","Change",""].map((h, i) => (
                  <div key={i} className={i === 1 || i === 3 ? "watch-col-hide" : ""}
                    style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ba8bb", textAlign: i >= 2 ? "right" : "left" }}>
                    {h}
                  </div>
                ))}
              </div>

              {items.map((item, i) => {
                const up = (item.change_pct ?? 0) >= 0;
                return (
                  <div key={item.id} className="watch-row"
                    onClick={() => router.push(`/stock/${item.symbol}`)}
                    style={{
                      display: "grid", gridTemplateColumns: "110px 1fr 110px 110px 100px 44px",
                      padding: "0.9rem 1.25rem", alignItems: "center",
                      borderBottom: i < items.length - 1 ? "1px solid #f5f7fa" : "none",
                      background: "#ffffff",
                    }}>
                    <div>
                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.82rem", fontWeight: 600, color: "#0a1628" }}>{item.symbol}</p>
                      <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "#0aaa8f", background: "#e6faf7", padding: "1px 6px", borderRadius: 20 }}>{item.sector}</span>
                    </div>
                    <div className="watch-col-hide" style={{ paddingRight: "1rem" }}>
                      <p style={{ fontSize: "0.8rem", color: "#374357", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.82rem", fontWeight: 500, color: "#0a1628" }}>{fmt(item.price)}</p>
                    </div>
                    <div className="watch-col-hide" style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem", color: "#9ba8bb" }}>{fmt(item.ldcp)}</p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {item.change_pct != null ? (
                        <span style={{
                          display: "inline-block", fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "0.72rem", fontWeight: 600, padding: "3px 8px", borderRadius: 7,
                          background: up ? "#ecfdf5" : "#fef2f2",
                          color: up ? "#059669" : "#dc2626",
                        }}>
                          {up ? "▲" : "▼"} {Math.abs(item.change_pct).toFixed(2)}%
                        </span>
                      ) : <span style={{ fontSize: "0.78rem", color: "#9ba8bb" }}>—</span>}
                    </div>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <button className="del-btn" onClick={e => { e.stopPropagation(); remove(item.symbol); }}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 5, borderRadius: 6, color: "#9ba8bb", transition: "color 0.15s" }}
                        onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = "#dc2626"}
                        onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = "#9ba8bb"}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                          <path d="M10 11v6"/><path d="M14 11v6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: "0.62rem", color: "#b0bbc8", paddingBottom: "1.5rem", marginTop: "1rem" }}>
          Educational platform only · Not financial advice · Max 20 stocks per watchlist
        </p>
      </div>

      <style>{`@keyframes spin { to{transform:rotate(360deg)} }`}</style>
    </AppLayout>
  );
}
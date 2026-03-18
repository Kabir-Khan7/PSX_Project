"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import AppLayout from "@/components/AppLayout";
import { apiGet, apiPost } from "@/lib/api";

interface KSE100 {
  current: number; change: number; change_pct: number;
  history: { date: string; close: number }[];
}
interface Stock {
  symbol: string; name: string; sector: string;
  close: number; ldcp: number; change: number;
  change_pct: number; volume: number;
}
interface SearchResult { symbol: string; name: string; sector: string; }

const TICKERS = [
  { sym: "OGDC",  val: "262.64", chg: "+0.30%", up: true  },
  { sym: "HBL",   val: "259.60", chg: "-2.09%", up: false },
  { sym: "LUCK",  val: "346.79", chg: "+1.13%", up: true  },
  { sym: "PSO",   val: "353.39", chg: "+2.18%", up: true  },
  { sym: "ENGRO", val: "263.93", chg: "+1.01%", up: true  },
  { sym: "MCB",   val: "362.27", chg: "+4.47%", up: true  },
  { sym: "UBL",   val: "364.83", chg: "+1.78%", up: true  },
  { sym: "PPL",   val: "206.57", chg: "+2.14%", up: true  },
  { sym: "MEBL",  val: "426.19", chg: "+0.59%", up: true  },
  { sym: "SYS",   val: "126.14", chg: "+0.90%", up: true  },
];

const PERIODS = [
  { k: "1wk", l: "1W" }, { k: "1mo", l: "1M" },
  { k: "3mo", l: "3M" }, { k: "1y",  l: "1Y" },
];

function fmtNum(n: number | null | undefined, decimals = 2) {
  if (n == null) return "—";
  return n.toLocaleString("en-PK", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtVol(n: number | null | undefined) {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function DashboardPage() {
  const router = useRouter();
  const [kse, setKse]           = useState<KSE100 | null>(null);
  const [stocks, setStocks]     = useState<Stock[]>([]);
  const [loadKse, setLoadKse]   = useState(true);
  const [loadStk, setLoadStk]   = useState(true);
  const [period, setPeriod]     = useState("3mo");
  const [tab, setTab]           = useState("all");
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<SearchResult[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [searching, setSearching] = useState(false);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const loadKSE = useCallback(async (p: string) => {
    setLoadKse(true);
    try {
      const d = await apiGet<KSE100>(`/stocks/kse100?period=${p}`);
      setKse(d);
    } catch {
      setKse({ current: 0, change: 0, change_pct: 0, history: [] });
    } finally { setLoadKse(false); }
  }, []);

  useEffect(() => {
    loadKSE(period);
    apiGet<Stock[]>("/stocks/top")
      .then(setStocks).catch(() => {}).finally(() => setLoadStk(false));
    apiGet<{ symbol: string }[]>("/watchlist/")
      .then(w => setWatchlist(new Set(w.map(i => i.symbol)))).catch(() => {});
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [loadKSE, period]);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); setShowDrop(false); return; }
    setSearching(true); setShowDrop(true);
    try {
      const r = await apiGet<SearchResult[]>(`/stocks/search?q=${encodeURIComponent(q)}`);
      setResults(r);
    } catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  const toggleWatch = async (e: React.MouseEvent, s: Stock) => {
    e.stopPropagation();
    if (watchlist.has(s.symbol)) {
      try {
        await fetch(`http://localhost:8000/watchlist/${s.symbol}`, {
          method: "DELETE", credentials: "include",
        });
        setWatchlist(prev => { const n = new Set(prev); n.delete(s.symbol); return n; });
        showToast(`${s.symbol} removed from watchlist`);
      } catch { showToast("Failed", false); }
    } else {
      try {
        await apiPost("/watchlist/", { symbol: s.symbol });
        setWatchlist(prev => new Set([...prev, s.symbol]));
        showToast(`${s.symbol} added to watchlist`);
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : "Failed", false);
      }
    }
  };

  const isUp      = (kse?.change ?? 0) >= 0;
  const gainers   = stocks.filter(s => s.change >= 0).length;
  const losers    = stocks.filter(s => s.change < 0).length;
  const filtered  = tab === "all" ? stocks
    : tab === "gainers" ? stocks.filter(s => s.change >= 0)
    : stocks.filter(s => s.change < 0);
  const chartData = (kse?.history ?? []).map(d => ({ d: d.date.slice(5), v: d.close }));

  return (
    <AppLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

        .dash-wrap * { box-sizing: border-box; }
        .dash-wrap { font-family: 'Instrument Sans', 'Plus Jakarta Sans', sans-serif; }

        /* ticker */
        @keyframes tkscroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .tk-track { animation: tkscroll 55s linear infinite; display:flex; width:max-content; align-items:center; }
        .tk-track:hover { animation-play-state:paused; }

        /* toast */
        @keyframes toastIn { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        .toast { animation: toastIn 0.2s ease; }

        /* search drop hover */
        .drop-item:hover { background: #f5f7fa; }

        /* table row */
        .stk-row { transition: background 0.1s; cursor: pointer; }
        .stk-row:hover { background: #f8fafc !important; }
        .stk-row:hover .watch-star { opacity: 1 !important; }

        /* buttons */
        .period-btn { cursor:pointer; border:none; font-family:inherit; transition: all 0.15s; }
        .tab-btn    { cursor:pointer; border:none; font-family:inherit; transition: all 0.15s; background:none; }

        /* skeleton pulse */
        @keyframes skpulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        .sk { background:#e8edf4; border-radius:6px; animation:skpulse 1.5s ease infinite; }

        /* stat card hover */
        .stat-card { transition: box-shadow 0.15s, transform 0.15s; }
        .stat-card:hover { box-shadow: 0 4px 16px rgba(10,22,40,0.1) !important; transform: translateY(-1px); }

        @media (max-width:900px) {
          .stat-grid { grid-template-columns: repeat(2,1fr) !important; }
          .col-hide-md { display:none !important; }
          .dash-inner { padding: 1rem !important; }
        }
        @media (max-width:560px) {
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
          .col-hide-sm { display:none !important; }
        }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div className="toast" style={{
          position: "fixed", top: 16, right: 16, zIndex: 9999,
          background: toast.ok ? "#0a1628" : "#dc2626",
          color: "#fff", padding: "10px 16px", borderRadius: 10,
          fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.01em",
          boxShadow: "0 8px 32px rgba(10,22,40,0.25)",
          fontFamily: "'Instrument Sans', sans-serif",
        }}>{toast.msg}</div>
      )}

      <div className="dash-wrap">

        {/* ── TICKER ── */}
        <div style={{
          background: "#060e1f", height: 32, overflow: "hidden",
          display: "flex", alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div className="tk-track">
            {[...TICKERS, ...TICKERS].map((t, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "0 16px",
                borderRight: "1px solid rgba(255,255,255,0.05)",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.63rem", whiteSpace: "nowrap",
              }}>
                <span style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>{t.sym}</span>
                <span style={{ color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>{t.val}</span>
                <span style={{
                  color: t.up ? "#34d399" : "#f87171",
                  fontWeight: 600,
                }}>{t.chg}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-inner" style={{ padding: "1.25rem 1.5rem", maxWidth: 1440, margin: "0 auto" }}>

          {/* ── SEARCH ── */}
          <div ref={searchRef} style={{ position: "relative", marginBottom: "1.25rem" }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "#fff", border: "1.5px solid #e2e8f0",
              borderRadius: 12, padding: "0 14px",
              boxShadow: "0 1px 3px rgba(10,22,40,0.04)",
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                style={{
                  flex: 1, padding: "0.7rem 0", border: "none",
                  background: "transparent", outline: "none",
                  fontSize: "0.875rem", color: "#0a1628",
                  fontFamily: "'Instrument Sans', sans-serif",
                }}
                placeholder="Search any PSX stock — OGDC, Habib Bank, Lucky Cement..."
                value={query}
                onChange={e => handleSearch(e.target.value)}
                onFocus={() => query && setShowDrop(true)}
              />
              {query && (
                <button
                  onClick={() => { setQuery(""); setResults([]); setShowDrop(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer",
                    color: "#94a3b8", fontSize: "1.1rem", lineHeight: 1, padding: 0 }}
                >×</button>
              )}
            </div>

            {showDrop && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                background: "#fff", border: "1px solid #e2e8f0",
                borderRadius: 12, boxShadow: "0 16px 48px rgba(10,22,40,0.14)",
                zIndex: 300, overflow: "hidden", maxHeight: 340, overflowY: "auto",
              }}>
                {searching ? (
                  <div style={{ padding: "1rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>
                    Searching PSX stocks...
                  </div>
                ) : results.length === 0 ? (
                  <div style={{ padding: "1rem", textAlign: "center", color: "#94a3b8", fontSize: "0.8rem" }}>
                    No results for &ldquo;{query}&rdquo;
                  </div>
                ) : results.map(s => (
                  <div key={s.symbol} className="drop-item"
                    onClick={() => { router.push(`/stock/${s.symbol}`); setShowDrop(false); setQuery(""); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "0.7rem 1rem",
                      borderBottom: "1px solid #f8fafc",
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <p style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "0.82rem", fontWeight: 600,
                        color: "#0a1628", margin: 0,
                      }}>{s.symbol}</p>
                      <p style={{ fontSize: "0.72rem", color: "#94a3b8", margin: "2px 0 0" }}>{s.name}</p>
                    </div>
                    <span style={{
                      fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.07em",
                      textTransform: "uppercase",
                      color: "#0aaa8f", background: "#e6faf7",
                      padding: "2px 8px", borderRadius: 20,
                    }}>{s.sector}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── KSE-100 HERO ── */}
          <div style={{
            background: "#0a1628",
            borderRadius: 18,
            overflow: "hidden",
            marginBottom: "1.25rem",
            boxShadow: "0 4px 24px rgba(10,22,40,0.18)",
            position: "relative",
          }}>
            {/* Subtle mesh */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "radial-gradient(ellipse 60% 80% at 85% 0%, rgba(15,212,180,0.07) 0%, transparent 60%)",
            }}/>

            <div style={{ padding: "1.5rem 1.75rem 0", position: "relative", zIndex: 1 }}>
              <div style={{
                display: "flex", alignItems: "flex-start",
                justifyContent: "space-between",
                flexWrap: "wrap", gap: "1rem",
                marginBottom: "1rem",
              }}>
                {/* Left: index value */}
                <div>
                  <p style={{
                    fontSize: "0.6rem", fontWeight: 700,
                    letterSpacing: "0.12em", textTransform: "uppercase",
                    color: "rgba(255,255,255,0.3)", marginBottom: 10,
                  }}>KSE-100 · Pakistan Stock Exchange</p>

                  {loadKse ? (
                    <div className="sk" style={{ width: 220, height: 52, borderRadius: 8, background: "rgba(255,255,255,0.08)" }}/>
                  ) : (
                    <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "clamp(2rem, 4vw, 3rem)",
                        fontWeight: 600,
                        color: "#ffffff",
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                      }}>
                        {fmtNum(kse?.current, 0)}
                      </span>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "0.82rem", fontWeight: 600,
                          color: isUp ? "#34d399" : "#f87171",
                          background: isUp ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
                          padding: "3px 10px", borderRadius: 8,
                        }}>
                          {isUp ? "▲" : "▼"} {isUp ? "+" : ""}{fmtNum(kse?.change, 2)} pts
                        </span>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "0.72rem", fontWeight: 600,
                          color: isUp ? "#34d399" : "#f87171",
                          paddingLeft: 2,
                        }}>
                          {isUp ? "+" : ""}{kse?.change_pct?.toFixed(2)}% today
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: period pills */}
                <div style={{ display: "flex", gap: 4, alignSelf: "flex-start", paddingTop: 4 }}>
                  {PERIODS.map(p => (
                    <button key={p.k} className="period-btn"
                      onClick={() => { setPeriod(p.k); loadKSE(p.k); }}
                      style={{
                        padding: "5px 13px", borderRadius: 8,
                        fontSize: "0.72rem", fontWeight: 600,
                        background: period === p.k ? "#ffffff" : "rgba(255,255,255,0.08)",
                        color: period === p.k ? "#0a1628" : "rgba(255,255,255,0.4)",
                        letterSpacing: "0.02em",
                      }}>
                      {p.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart */}
            {!loadKse && chartData.length > 2 ? (
              <div style={{ position: "relative", zIndex: 1 }}>
                <ResponsiveContainer width="100%" height={190}>
                  <AreaChart data={chartData} margin={{ top: 8, right: 24, left: -4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="kseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={isUp ? "#0fd4b4" : "#f87171"} stopOpacity={0.22}/>
                        <stop offset="95%" stopColor={isUp ? "#0fd4b4" : "#f87171"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.04)" vertical={false}/>
                    <XAxis dataKey="d"
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)",
                        fontFamily: "JetBrains Mono,monospace" }}
                      axisLine={false} tickLine={false}
                      interval="preserveStartEnd"/>
                    <YAxis
                      tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)",
                        fontFamily: "JetBrains Mono,monospace" }}
                      axisLine={false} tickLine={false}
                      domain={["auto", "auto"]} width={58}
                      tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)}/>
                    <Tooltip
                      contentStyle={{
                        background: "#162035",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8, padding: "8px 12px",
                      }}
                      labelStyle={{ color: "rgba(255,255,255,0.45)", fontSize: 10,
                        fontFamily: "JetBrains Mono,monospace" }}
                      itemStyle={{ color: "#ffffff", fontSize: 14,
                        fontFamily: "JetBrains Mono,monospace", fontWeight: 600 }}
                      formatter={(v: unknown) => [
                        Number(v).toLocaleString("en-PK", { maximumFractionDigits: 0 }),
                        "KSE-100",
                      ]}
                    />
                    <Area type="monotone" dataKey="v"
                      stroke={isUp ? "#0fd4b4" : "#f87171"}
                      strokeWidth={2.5}
                      fill="url(#kseGrad)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 0, fill: isUp ? "#0fd4b4" : "#f87171" }}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : loadKse ? (
              <div style={{ height: 190, display: "flex", alignItems: "center",
                justifyContent: "center" }}>
                <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.78rem",
                  fontFamily: "JetBrains Mono,monospace" }}>Loading chart...</div>
              </div>
            ) : (
              <div style={{ height: 190, display: "flex", alignItems: "center",
                justifyContent: "center" }}>
                <div style={{ color: "rgba(255,255,255,0.15)", fontSize: "0.78rem" }}>
                  Chart data unavailable
                </div>
              </div>
            )}
          </div>

          {/* ── STAT CARDS ── */}
          <div className="stat-grid" style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: "0.875rem",
            marginBottom: "1.25rem",
          }}>
            {[
              {
                label: "Index Level",
                value: loadKse ? null : fmtNum(kse?.current, 0),
                unit: "pts",
                sub: "KSE-100 close",
                color: isUp ? "#059669" : "#dc2626",
                accent: isUp ? "#059669" : "#dc2626",
              },
              {
                label: "Day Change",
                value: loadKse ? null : `${isUp ? "+" : ""}${kse?.change_pct?.toFixed(2)}%`,
                unit: "",
                sub: "vs prev close",
                color: isUp ? "#059669" : "#dc2626",
                accent: isUp ? "#059669" : "#dc2626",
              },
              {
                label: "Gainers",
                value: gainers.toString(),
                unit: "stocks",
                sub: `of ${stocks.length} tracked`,
                color: "#059669",
                accent: "#059669",
              },
              {
                label: "Losers",
                value: losers.toString(),
                unit: "stocks",
                sub: `of ${stocks.length} tracked`,
                color: "#dc2626",
                accent: "#dc2626",
              },
              {
                label: "PSX Listed",
                value: "561",
                unit: "cos.",
                sub: "total companies",
                color: "#0a1628",
                accent: "#0fd4b4",
              },
            ].map(card => (
              <div key={card.label} className="stat-card" style={{
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderLeft: `3px solid ${card.accent}`,
                borderRadius: 12,
                padding: "1rem 1.1rem",
                boxShadow: "0 1px 3px rgba(10,22,40,0.04)",
              }}>
                <p style={{
                  fontSize: "0.6rem", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "#94a3b8", margin: "0 0 8px",
                }}>{card.label}</p>

                {card.value == null ? (
                  <div className="sk" style={{ width: "80%", height: 28, marginBottom: 6 }}/>
                ) : (
                  <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "1.5rem", fontWeight: 600,
                      color: card.color, lineHeight: 1,
                      letterSpacing: "-0.02em",
                    }}>{card.value}</span>
                    {card.unit && (
                      <span style={{
                        fontSize: "0.62rem", fontWeight: 700,
                        color: "#94a3b8", letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}>{card.unit}</span>
                    )}
                  </div>
                )}

                <p style={{ fontSize: "0.68rem", color: "#94a3b8", margin: 0 }}>
                  {card.sub}
                </p>
              </div>
            ))}
          </div>

          {/* ── STOCKS TABLE ── */}
          <div style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 1px 3px rgba(10,22,40,0.04)",
            marginBottom: "1.5rem",
          }}>
            {/* Table topbar */}
            <div style={{
              display: "flex", alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.25rem",
              borderBottom: "1px solid #f1f5f9",
              flexWrap: "wrap", gap: "0.75rem",
            }}>
              <div>
                <h2 style={{
                  fontSize: "0.95rem", fontWeight: 700,
                  color: "#0a1628", margin: 0,
                  letterSpacing: "-0.01em",
                }}>Top PSX Stocks</h2>
                <p style={{ fontSize: "0.68rem", color: "#94a3b8", margin: "3px 0 0" }}>
                  Live data · Click any row to view full analysis
                </p>
              </div>

              {/* Tabs */}
              <div style={{
                display: "flex", gap: 3,
                background: "#f8fafc",
                padding: 3, borderRadius: 10,
                border: "1px solid #e2e8f0",
              }}>
                {(["all", "gainers", "losers"] as const).map(t => (
                  <button key={t} className="tab-btn"
                    onClick={() => setTab(t)}
                    style={{
                      padding: "5px 14px", borderRadius: 8,
                      fontSize: "0.72rem", fontWeight: 600,
                      background: tab === t ? "#0a1628" : "transparent",
                      color: tab === t ? "#ffffff" : "#64748b",
                      letterSpacing: "0.01em",
                    }}>
                    {t === "all" ? "All" : t === "gainers" ? "Gainers" : "Losers"}
                  </button>
                ))}
              </div>
            </div>

            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "100px 1fr 110px 110px 100px 40px",
              padding: "0.45rem 1.25rem",
              background: "#f8fafc",
              borderBottom: "1px solid #f1f5f9",
            }}>
              {["Symbol", "Company", "Price (PKR)", "LDCP", "Change", ""].map((h, i) => (
                <div key={i}
                  className={i === 1 ? "col-hide-md" : i === 3 ? "col-hide-md" : ""}
                  style={{
                    fontSize: "0.58rem", fontWeight: 700,
                    letterSpacing: "0.09em", textTransform: "uppercase",
                    color: "#94a3b8",
                    textAlign: i >= 2 ? "right" : "left",
                  }}>{h}</div>
              ))}
            </div>

            {/* Rows */}
            {loadStk ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 110px 110px 100px 40px",
                  padding: "0.9rem 1.25rem",
                  borderBottom: "1px solid #f8fafc",
                  alignItems: "center",
                }}>
                  <div className="sk" style={{ width: 50, height: 14 }}/>
                  <div className="sk" style={{ width: 140, height: 14 }}/>
                  <div className="sk" style={{ width: 60, height: 14, marginLeft: "auto" }}/>
                  <div className="sk" style={{ width: 60, height: 14, marginLeft: "auto" }}/>
                  <div className="sk" style={{ width: 55, height: 20, marginLeft: "auto", borderRadius: 6 }}/>
                  <div/>
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div style={{ padding: "3rem", textAlign: "center", color: "#94a3b8", fontSize: "0.82rem" }}>
                No stocks match this filter.
              </div>
            ) : filtered.map((s, i) => (
              <div key={s.symbol} className="stk-row"
                onClick={() => router.push(`/stock/${s.symbol}`)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "100px 1fr 110px 110px 100px 40px",
                  padding: "0 1.25rem",
                  height: 56,
                  alignItems: "center",
                  borderBottom: i < filtered.length - 1 ? "1px solid #f8fafc" : "none",
                  background: "#ffffff",
                }}>

                {/* Symbol + sector badge */}
                <div>
                  <p style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.82rem", fontWeight: 600,
                    color: "#0a1628", margin: "0 0 2px",
                  }}>{s.symbol}</p>
                  <span style={{
                    fontSize: "0.55rem", fontWeight: 700,
                    letterSpacing: "0.05em", textTransform: "uppercase",
                    color: "#0aaa8f", background: "#e6faf7",
                    padding: "1px 5px", borderRadius: 4,
                    whiteSpace: "nowrap",
                  }}>{s.sector?.slice(0, 12)}</span>
                </div>

                {/* Name */}
                <div className="col-hide-md" style={{ paddingRight: "1rem", minWidth: 0 }}>
                  <p style={{
                    fontSize: "0.8rem", color: "#334155", fontWeight: 500,
                    overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap", margin: 0,
                  }}>{s.name}</p>
                </div>

                {/* Price */}
                <div style={{ textAlign: "right" }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.85rem", fontWeight: 600,
                    color: "#0a1628",
                  }}>{fmtNum(s.close)}</span>
                </div>

                {/* LDCP */}
                <div className="col-hide-md" style={{ textAlign: "right" }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.82rem", fontWeight: 400,
                    color: "#94a3b8",
                  }}>{fmtNum(s.ldcp)}</span>
                </div>

                {/* Change badge */}
                <div style={{ textAlign: "right" }}>
                  <span style={{
                    display: "inline-block",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.72rem", fontWeight: 700,
                    padding: "4px 8px", borderRadius: 7,
                    letterSpacing: "0.02em",
                    background: s.change_pct >= 0 ? "#ecfdf5" : "#fef2f2",
                    color: s.change_pct >= 0 ? "#059669" : "#dc2626",
                  }}>
                    {s.change_pct >= 0 ? "▲" : "▼"} {Math.abs(s.change_pct).toFixed(2)}%
                  </span>
                </div>

                {/* Watchlist star */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button
                    className="watch-star"
                    onClick={e => toggleWatch(e, s)}
                    title={watchlist.has(s.symbol) ? "Remove from watchlist" : "Add to watchlist"}
                    style={{
                      background: "none", border: "none",
                      cursor: "pointer", padding: 5,
                      borderRadius: 6,
                      opacity: watchlist.has(s.symbol) ? 1 : 0,
                      transition: "opacity 0.15s",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24"
                      fill={watchlist.has(s.symbol) ? "#f59e0b" : "none"}
                      stroke={watchlist.has(s.symbol) ? "#f59e0b" : "#94a3b8"}
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p style={{
            textAlign: "center",
            fontSize: "0.62rem", color: "#cbd5e1",
            paddingBottom: "1.5rem", lineHeight: 1.8,
          }}>
            Educational platform only · Data via Yahoo Finance + PSX Data Portal ·
            LDCP = Last Day Closing Price · Not financial advice
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
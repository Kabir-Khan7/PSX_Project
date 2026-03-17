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

function fmt(n: number | null | undefined) {
  return n != null ? n.toLocaleString("en-PK", { maximumFractionDigits: 2 }) : "—";
}

function StatCard({ title, value, sub, color }: {
  title: string; value: string; sub: string; color?: string;
}) {
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e8edf4",
      borderRadius: 14, padding: "1.1rem 1.25rem",
      boxShadow: "0 1px 4px rgba(10,22,40,0.05)",
    }}>
      <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ba8bb", marginBottom: 8 }}>{title}</p>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.35rem", fontWeight: 600, color: color || "#0a1628", marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: "0.68rem", color: "#9ba8bb" }}>{sub}</p>
    </div>
  );
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
  const [toast, setToast]       = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadKSE = useCallback(async (p: string) => {
    setLoadKse(true);
    try {
      const d = await apiGet<KSE100>(`/stocks/kse100?period=${p}`);
      setKse(d);
    } catch { setKse({ current: 0, change: 0, change_pct: 0, history: [] }); }
    finally { setLoadKse(false); }
  }, []);

  useEffect(() => {
    loadKSE(period);
    apiGet<Stock[]>("/stocks/top").then(setStocks).catch(() => {}).finally(() => setLoadStk(false));
    apiGet<{ symbol: string }[]>("/watchlist/").then(w => setWatchlist(new Set(w.map(i => i.symbol)))).catch(() => {});
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false);
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
        await fetch(`http://localhost:8000/watchlist/${s.symbol}`, { method: "DELETE", credentials: "include" });
        setWatchlist(prev => { const n = new Set(prev); n.delete(s.symbol); return n; });
        showToast(`${s.symbol} removed from watchlist`);
      } catch { showToast("Failed to remove", "err"); }
    } else {
      try {
        await apiPost("/watchlist/", { symbol: s.symbol });
        setWatchlist(prev => new Set([...prev, s.symbol]));
        showToast(`${s.symbol} added to watchlist ★`);
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : "Failed", "err");
      }
    }
  };

  const isUp = (kse?.change ?? 0) >= 0;
  const gainers = stocks.filter(s => s.change >= 0).length;
  const losers  = stocks.filter(s => s.change < 0).length;
  const filtered = tab === "all" ? stocks : tab === "gainers" ? stocks.filter(s => s.change >= 0) : stocks.filter(s => s.change < 0);
  const chartData = (kse?.history ?? []).map(d => ({ date: d.date.slice(5), v: d.close }));

  return (
    <AppLayout>
      <style>{`
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .tk { animation: ticker 50s linear infinite; display:flex; width:max-content; }
        .tk:hover { animation-play-state: paused; }
        @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .toast-bar { animation: slideIn 0.25s ease; }
        .stk-row { transition: background 0.12s; cursor: pointer; }
        .stk-row:hover { background: #f8fafc !important; }
        .star-btn { opacity: 0; transition: opacity 0.15s; background: none; border: none; cursor: pointer; padding: 4px; border-radius: 6px; }
        .stk-row:hover .star-btn { opacity: 1; }
        .star-btn.starred { opacity: 1; }
        .period-pill { transition: all 0.15s; border: none; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; }
        .tab-pill { transition: all 0.15s; border: none; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; }
        .search-input:focus { outline: none; }
        @media (max-width: 768px) {
          .kse-hero { padding: 1.25rem !important; }
          .stats-grid { grid-template-columns: repeat(2,1fr) !important; }
          .table-col-hide { display: none !important; }
          .dash-pad { padding: 1rem !important; }
        }
        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div className="toast-bar" style={{
          position: "fixed", top: 20, right: 20, zIndex: 999,
          background: toast.type === "ok" ? "#0a1628" : "#dc2626",
          color: "#ffffff", padding: "10px 18px",
          borderRadius: 10, fontSize: "0.8rem", fontWeight: 600,
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
          {toast.msg}
        </div>
      )}

      {/* TICKER */}
      <div style={{
        background: "#0a1628", height: 34, overflow: "hidden",
        display: "flex", alignItems: "center",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}>
        <div className="tk">
          {[...TICKERS, ...TICKERS].map((t, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "0 18px",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.67rem", whiteSpace: "nowrap",
              borderRight: "1px solid rgba(255,255,255,0.06)",
            }}>
              <span style={{ color: "rgba(255,255,255,0.35)" }}>{t.sym}</span>
              <span style={{ color: "rgba(255,255,255,0.75)" }}>{t.val}</span>
              <span style={{ color: t.up ? "#34d399" : "#f87171", fontWeight: 600 }}>{t.chg}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-pad" style={{ padding: "1.5rem", maxWidth: 1400, margin: "0 auto", width: "100%" }}>

        {/* SEARCH */}
        <div ref={searchRef} style={{ position: "relative", marginBottom: "1.5rem" }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#ffffff", border: "1.5px solid #e8edf4",
            borderRadius: 12, padding: "0 14px",
            boxShadow: "0 1px 4px rgba(10,22,40,0.05)",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ba8bb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              className="search-input"
              style={{
                flex: 1, padding: "0.75rem 0", border: "none",
                background: "transparent", fontSize: "0.875rem",
                color: "#0a1628", fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
              placeholder="Search any PSX stock — OGDC, Habib Bank, Lucky Cement..."
              value={query}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => query && setShowDrop(true)}
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); setShowDrop(false); }}
                style={{ background: "none", border: "none", color: "#9ba8bb", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1 }}>
                ×
              </button>
            )}
          </div>

          {showDrop && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
              background: "#ffffff", border: "1px solid #e8edf4",
              borderRadius: 12, boxShadow: "0 12px 40px rgba(10,22,40,0.12)",
              zIndex: 200, overflow: "hidden", maxHeight: 320, overflowY: "auto",
            }}>
              {searching ? (
                <div style={{ padding: "1rem", fontSize: "0.82rem", color: "#9ba8bb", textAlign: "center" }}>Searching PSX stocks...</div>
              ) : results.length === 0 ? (
                <div style={{ padding: "1rem", fontSize: "0.82rem", color: "#9ba8bb", textAlign: "center" }}>No results for &ldquo;{query}&rdquo;</div>
              ) : results.map(s => (
                <div key={s.symbol}
                  onClick={() => { router.push(`/stock/${s.symbol}`); setShowDrop(false); setQuery(""); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", borderBottom: "1px solid #f5f7fa", cursor: "pointer", transition: "background 0.1s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
                >
                  <div>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.82rem", fontWeight: 600, color: "#0a1628" }}>{s.symbol}</p>
                    <p style={{ fontSize: "0.72rem", color: "#9ba8bb", marginTop: 1 }}>{s.name}</p>
                  </div>
                  <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#0aaa8f", background: "#e6faf7", padding: "2px 8px", borderRadius: 20, letterSpacing: "0.06em" }}>{s.sector}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* KSE-100 CARD */}
        <div style={{ background: "#0a1628", borderRadius: 16, overflow: "hidden", marginBottom: "1.5rem", boxShadow: "0 4px 20px rgba(10,22,40,0.15)" }}>
          <div className="kse-hero" style={{ padding: "1.5rem 1.75rem 0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
              <div>
                <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 8 }}>
                  KSE-100 · Pakistan Stock Exchange
                </p>
                {loadKse ? (
                  <div style={{ height: 48, width: 200, background: "rgba(255,255,255,0.06)", borderRadius: 8 }}/>
                ) : (
                  <>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 600, color: "#ffffff", lineHeight: 1, marginBottom: 8 }}>
                      {fmt(kse?.current)}
                    </p>
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "4px 12px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 600,
                      background: isUp ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                      color: isUp ? "#34d399" : "#f87171",
                    }}>
                      {isUp ? "▲" : "▼"} {Math.abs(kse?.change ?? 0).toLocaleString()} pts &nbsp;·&nbsp; {kse?.change_pct?.toFixed(2)}%
                    </span>
                  </>
                )}
              </div>

              {/* Period selector */}
              <div style={{ display: "flex", gap: 4, alignSelf: "flex-start", marginTop: 4 }}>
                {PERIODS.map(p => (
                  <button key={p.k} className="period-pill"
                    onClick={() => { setPeriod(p.k); loadKSE(p.k); }}
                    style={{
                      padding: "5px 12px", borderRadius: 8, fontSize: "0.72rem", fontWeight: 600,
                      background: period === p.k ? "#ffffff" : "rgba(255,255,255,0.07)",
                      color: period === p.k ? "#0a1628" : "rgba(255,255,255,0.4)",
                    }}>
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Chart */}
          {!loadKse && chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ top: 0, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isUp ? "#0fd4b4" : "#f87171"} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={isUp ? "#0fd4b4" : "#f87171"} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontFamily: "JetBrains Mono" }}
                  axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontFamily: "JetBrains Mono" }}
                  axisLine={false} tickLine={false} domain={["auto","auto"]} width={50}
                  tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}/>
                <Tooltip
                  contentStyle={{ background: "#162035", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontFamily: "JetBrains Mono" }}
                  labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 10 }}
                  itemStyle={{ color: "#ffffff", fontSize: 13 }}
                  formatter={(v: unknown) => [Number(v).toLocaleString("en-PK"), "KSE-100"]}
                />
                <Area type="monotone" dataKey="v" stroke={isUp ? "#0fd4b4" : "#f87171"}
                  strokeWidth={2.5} fill="url(#g1)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : loadKse ? (
            <div style={{ height: 180, background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.78rem" }}>Loading chart...</p>
            </div>
          ) : (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.78rem" }}>Chart data unavailable</p>
            </div>
          )}
        </div>

        {/* STAT CARDS */}
        <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "0.875rem", marginBottom: "1.5rem" }}>
          <StatCard title="Index Level" value={fmt(kse?.current)} sub="KSE-100 latest" color={isUp ? "#059669" : "#dc2626"}/>
          <StatCard title="Day Change" value={`${isUp?"+":""}${kse?.change_pct?.toFixed(2)??"—"}%`} sub="vs LDCP" color={isUp ? "#059669" : "#dc2626"}/>
          <StatCard title="Gainers" value={gainers.toString()} sub={`of ${stocks.length} tracked`} color="#059669"/>
          <StatCard title="Losers"  value={losers.toString()}  sub={`of ${stocks.length} tracked`} color="#dc2626"/>
          <StatCard title="PSX Listed" value="561" sub="Total companies"/>
        </div>

        {/* STOCKS TABLE */}
        <div style={{ background: "#ffffff", border: "1px solid #e8edf4", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(10,22,40,0.05)", marginBottom: "1.5rem" }}>

          {/* Table header */}
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #f0f4f8", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
            <h2 style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0a1628" }}>Top PSX Stocks</h2>
            <div style={{ display: "flex", gap: 4 }}>
              {(["all","gainers","losers"] as const).map(t => (
                <button key={t} className="tab-pill"
                  onClick={() => setTab(t)}
                  style={{
                    padding: "5px 14px", borderRadius: 20, fontSize: "0.72rem", fontWeight: 600,
                    background: tab === t ? "#0a1628" : "#f0f4f8",
                    color: tab === t ? "#ffffff" : "#6b7a99",
                  }}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid", gridTemplateColumns: "110px 1fr 100px 100px 90px 36px",
            padding: "0.5rem 1.25rem", background: "#f8fafc",
            borderBottom: "1px solid #f0f4f8",
          }}>
            {["Symbol","Company","Price (PKR)","LDCP","Change",""].map((h, i) => (
              <div key={i} style={{
                fontSize: "0.6rem", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ba8bb",
                textAlign: i >= 2 ? "right" : "left",
              }} className={i === 1 || i === 3 ? "table-col-hide" : ""}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {loadStk ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "#9ba8bb", fontSize: "0.82rem" }}>Fetching live PSX data...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "2.5rem", textAlign: "center", color: "#9ba8bb", fontSize: "0.82rem" }}>No stocks match this filter.</div>
          ) : filtered.map((s, i) => (
            <div key={s.symbol} className="stk-row"
              onClick={() => router.push(`/stock/${s.symbol}`)}
              style={{
                display: "grid", gridTemplateColumns: "110px 1fr 100px 100px 90px 36px",
                padding: "0.85rem 1.25rem", alignItems: "center",
                borderBottom: i < filtered.length - 1 ? "1px solid #f5f7fa" : "none",
                background: "#ffffff",
              }}>
              <div>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.82rem", fontWeight: 600, color: "#0a1628" }}>{s.symbol}</p>
                <span style={{ fontSize: "0.58rem", fontWeight: 700, color: "#0aaa8f", background: "#e6faf7", padding: "1px 6px", borderRadius: 20, letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{s.sector}</span>
              </div>
              <div className="table-col-hide" style={{ paddingRight: "1rem" }}>
                <p style={{ fontSize: "0.8rem", color: "#374357", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.82rem", fontWeight: 500, color: "#0a1628" }}>{fmt(s.close)}</p>
              </div>
              <div className="table-col-hide" style={{ textAlign: "right" }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8rem", color: "#9ba8bb" }}>{fmt(s.ldcp)}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{
                  display: "inline-block",
                  fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem", fontWeight: 600,
                  padding: "3px 8px", borderRadius: 7,
                  background: s.change_pct >= 0 ? "#ecfdf5" : "#fef2f2",
                  color: s.change_pct >= 0 ? "#059669" : "#dc2626",
                }}>
                  {s.change_pct >= 0 ? "▲" : "▼"} {Math.abs(s.change_pct).toFixed(2)}%
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <button
                  className={`star-btn ${watchlist.has(s.symbol) ? "starred" : ""}`}
                  onClick={e => toggleWatch(e, s)}
                  title={watchlist.has(s.symbol) ? "Remove from watchlist" : "Add to watchlist"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24"
                    fill={watchlist.has(s.symbol) ? "#f59e0b" : "none"}
                    stroke={watchlist.has(s.symbol) ? "#f59e0b" : "#9ba8bb"}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <p style={{ textAlign: "center", fontSize: "0.62rem", color: "#b0bbc8", paddingBottom: "1.5rem" }}>
          Educational platform only · Data via Yahoo Finance · LDCP = Last Day Closing Price · Not financial advice
        </p>
      </div>
    </AppLayout>
  );
}
"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import AppLayout from "@/components/AppLayout";
import { apiGet, apiPost } from "@/lib/api";

interface StockDetail {
  symbol: string; name: string; sector: string; industry: string;
  description: string; website: string;
  current_price: number; ldcp: number; change: number; change_pct: number;
  high_period: number; low_period: number; avg_price: number;
  high_52w: number|null; low_52w: number|null;
  volume_today: number; avg_volume: number; vol_vs_avg: number|null;
  pe_ratio: number|null; eps: number|null; pb_ratio: number|null;
  market_cap_val: number|null; market_cap_unit: string;
  dividend_yield_pct: number|null; dividend_rate: number|null; beta: number|null;
  revenue_val: number|null; profit_margin_pct: number|null;
  roe_pct: number|null; debt_to_equity: number|null; current_ratio: number|null;
  volatility_pct: number|null; above_avg: boolean;
  history: { date: string; close: number; volume: number }[];
  explainers: { pe_ratio: string; dividend: string; volatility: string; momentum: string; volume: string };
}

function fmt(n: number|null|undefined) {
  return n != null ? n.toLocaleString("en-PK", { maximumFractionDigits: 2 }) : "—";
}

function MetricRow({ label, value, unit, explain, good }: {
  label: string; value: string|number|null; unit?: string; explain: string; good?: boolean|null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid #f5f7fa" }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1.25rem", cursor: "pointer", transition: "background 0.12s" }}
        onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"}
        onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "0.82rem", color: "#6b7a99" }}>{label}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#c8d0dc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: "0.85rem", fontWeight: 600,
          color: good === true ? "#059669" : good === false ? "#dc2626" : "#0a1628",
        }}>
          {value != null ? `${value}${unit ? " " + unit : ""}` : "N/A"}
        </span>
      </div>
      {open && (
        <div style={{ margin: "0 1.25rem 0.85rem", padding: "0.75rem", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 9, fontSize: "0.75rem", color: "#0369a1", lineHeight: 1.7 }}>
          {explain}
        </div>
      )}
    </div>
  );
}

function RangeBar({ low, high, current, label }: { low: number; high: number; current: number; label: string }) {
  const pct = high > low ? ((current - low) / (high - low)) * 100 : 50;
  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.7rem", color: "#6b7a99", fontWeight: 600 }}>
        <span>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          {low.toLocaleString()} — <strong style={{ color: "#0a1628" }}>{current.toLocaleString()}</strong> — {high.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 5, background: "#f0f4f8", borderRadius: 999, position: "relative" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#1d6bea", borderRadius: 999, transition: "width 0.6s ease" }}/>
        <div style={{ position: "absolute", left: `${pct}%`, top: "50%", transform: "translate(-50%,-50%)", width: 11, height: 11, borderRadius: "50%", background: "#0a1628", border: "2px solid #fff", boxShadow: "0 1px 4px rgba(10,22,40,0.2)" }}/>
      </div>
    </div>
  );
}

const PERIODS = [{ k: "1wk", l: "1W" }, { k: "1mo", l: "1M" }, { k: "3mo", l: "3M" }, { k: "1y", l: "1Y" }];
const TABS    = ["overview", "financials", "about"];

export default function StockDetailPage() {
  const params = useParams();
  const router = useRouter();
  const symbol = (params?.symbol as string)?.toUpperCase() ?? "";

  const [data, setData]         = useState<StockDetail|null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [period, setPeriod]     = useState("3mo");
  const [tab, setTab]           = useState("overview");
  const [inWatch, setInWatch]   = useState(false);
  const [wLoading, setWLoading] = useState(false);
  const [toast, setToast]       = useState<{ msg: string; type: "ok"|"err" }|null>(null);

  const showToast = (msg: string, type: "ok"|"err" = "ok") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async (p: string) => {
    setLoading(true); setError("");
    try {
      const d = await apiGet<StockDetail>(`/stocks/${symbol}?period=${p}`);
      setData(d);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    load(period);
    apiGet<{ in_watchlist: boolean }>(`/watchlist/check/${symbol}`)
      .then(r => setInWatch(r.in_watchlist)).catch(() => {});
  }, [symbol, load, period]);

  const toggleWatch = async () => {
    setWLoading(true);
    try {
      if (inWatch) {
        await fetch(`http://localhost:8000/watchlist/${symbol}`, { method: "DELETE", credentials: "include" });
        setInWatch(false); showToast(`${symbol} removed from watchlist`);
      } else {
        await apiPost("/watchlist/", { symbol });
        setInWatch(true); showToast(`${symbol} added to watchlist ★`);
      }
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Failed", "err"); }
    finally { setWLoading(false); }
  };

  const isUp = (data?.change ?? 0) >= 0;
  const chartData = (data?.history ?? []).map(d => ({ date: d.date.slice(5), v: d.close }));

  return (
    <AppLayout>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        .toast-bar { animation: slideIn 0.25s ease; }
        .period-btn { transition: all 0.15s; border: none; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; }
        .tab-btn { transition: all 0.15s; border: none; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif; background: none; }
        @media (max-width: 768px) {
          .detail-pad { padding: 1rem !important; }
          .quick-grid { grid-template-columns: repeat(2,1fr) !important; }
          .metrics-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {toast && (
        <div className="toast-bar" style={{ position: "fixed", top: 20, right: 20, zIndex: 999, background: toast.type === "ok" ? "#0a1628" : "#dc2626", color: "#ffffff", padding: "10px 18px", borderRadius: 10, fontSize: "0.8rem", fontWeight: 600, boxShadow: "0 8px 24px rgba(0,0,0,0.2)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          {toast.msg}
        </div>
      )}

      <div className="detail-pad" style={{ padding: "1.5rem", maxWidth: 1100, margin: "0 auto", width: "100%" }}>

        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {[180, 80, 80, 200].map((h, i) => (
              <div key={i} style={{ height: h, background: "#ffffff", borderRadius: 16, border: "1px solid #e8edf4", animation: "pulse 1.5s ease-in-out infinite" }}/>
            ))}
          </div>
        )}

        {error && !loading && (
          <div style={{ background: "#ffffff", borderRadius: 16, padding: "4rem 2rem", textAlign: "center", border: "1px solid #e8edf4" }}>
            <p style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>⚠️</p>
            <p style={{ fontSize: "1rem", fontWeight: 700, color: "#dc2626", marginBottom: "1.5rem" }}>{error}</p>
            <button onClick={() => router.push("/dashboard")} style={{ padding: "8px 20px", background: "#0a1628", color: "#fff", border: "none", borderRadius: 9, fontSize: "0.82rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              ← Back to Dashboard
            </button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* HERO */}
            <div style={{ background: "#0a1628", borderRadius: 16, overflow: "hidden", marginBottom: "1.25rem", boxShadow: "0 4px 20px rgba(10,22,40,0.15)" }}>
              <div style={{ padding: "1.5rem 1.75rem 0", background: "radial-gradient(ellipse 60% 80% at 90% 0%, rgba(15,212,180,0.07) 0%, transparent 70%)" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#0fd4b4", background: "rgba(15,212,180,0.1)", border: "1px solid rgba(15,212,180,0.2)", padding: "3px 10px", borderRadius: 20, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{data.sector}</span>
                      <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)" }}>{data.industry}</span>
                    </div>
                    <h1 style={{ fontSize: "clamp(1.2rem,2.5vw,1.75rem)", fontWeight: 800, color: "#f0f6ff", letterSpacing: "-0.03em", marginBottom: 4 }}>{data.name}</h1>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.72rem", color: "rgba(255,255,255,0.3)" }}>PSX: {data.symbol}</p>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "clamp(1.6rem,3vw,2.2rem)", fontWeight: 600, color: "#ffffff", lineHeight: 1, marginBottom: 8 }}>
                      PKR {fmt(data.current_price)}
                    </p>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, fontSize: "0.78rem", fontWeight: 600, background: isUp ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)", color: isUp ? "#34d399" : "#f87171" }}>
                      {isUp ? "▲" : "▼"} {Math.abs(data.change).toFixed(2)} ({Math.abs(data.change_pct).toFixed(2)}%)
                    </span>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.68rem", color: "rgba(255,255,255,0.25)", marginTop: 6 }}>LDCP: PKR {fmt(data.ldcp)}</p>
                  </div>
                </div>

                {/* Period + Watchlist row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "0", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ display: "flex", gap: 4 }}>
                    {PERIODS.map(p => (
                      <button key={p.k} className="period-btn"
                        onClick={() => setPeriod(p.k)}
                        style={{
                          padding: "5px 12px", borderRadius: 8, fontSize: "0.72rem", fontWeight: 600,
                          background: period === p.k ? "#ffffff" : "rgba(255,255,255,0.07)",
                          color: period === p.k ? "#0a1628" : "rgba(255,255,255,0.4)",
                        }}>
                        {p.l}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={toggleWatch} disabled={wLoading}
                    style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                      background: inWatch ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.08)",
                      border: `1px solid ${inWatch ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.12)"}`,
                      color: inWatch ? "#fbbf24" : "rgba(255,255,255,0.6)",
                      fontSize: "0.75rem", fontWeight: 600,
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      transition: "all 0.15s",
                    }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={inWatch ? "#fbbf24" : "none"} stroke={inWatch ? "#fbbf24" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    {inWatch ? "Watchlisted" : "Add to Watchlist"}
                  </button>
                </div>
              </div>

              {/* Chart */}
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isUp ? "#0fd4b4" : "#f87171"} stopOpacity={0.2}/>
                        <stop offset="95%" stopColor={isUp ? "#0fd4b4" : "#f87171"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                    <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.2)", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} domain={["auto","auto"]} width={50} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}/>
                    <Tooltip
                      contentStyle={{ background: "#162035", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8 }}
                      labelStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "JetBrains Mono" }}
                      itemStyle={{ color: "#fff", fontFamily: "JetBrains Mono", fontSize: 13 }}
                      formatter={(v: unknown) => [`PKR ${Number(v).toLocaleString("en-PK")}`, data.symbol]}
                    />
                    <ReferenceLine y={data.ldcp} stroke="rgba(148,163,184,0.4)" strokeDasharray="4 4"/>
                    <Area type="monotone" dataKey="v" stroke={isUp ? "#0fd4b4" : "#f87171"} strokeWidth={2.5} fill="url(#sg)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }}/>
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.78rem" }}>Chart data loading...</p>
                </div>
              )}
            </div>

            {/* QUICK STATS */}
            <div className="quick-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.875rem", marginBottom: "1.25rem" }}>
              {[
                { l: "Period High", v: fmt(data.high_period), c: "#059669" },
                { l: "Period Low",  v: fmt(data.low_period),  c: "#dc2626" },
                { l: "Avg Price",   v: fmt(data.avg_price),   c: data.above_avg ? "#059669" : "#dc2626" },
                { l: "Volatility",  v: data.volatility_pct ? `${data.volatility_pct}%/day` : "—", c: data.volatility_pct && data.volatility_pct < 1.5 ? "#059669" : "#dc2626" },
              ].map(s => (
                <div key={s.l} style={{ background: "#ffffff", border: "1px solid #e8edf4", borderRadius: 14, padding: "1rem 1.1rem", boxShadow: "0 1px 4px rgba(10,22,40,0.05)" }}>
                  <p style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ba8bb", marginBottom: 8 }}>{s.l}</p>
                  <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "1.1rem", fontWeight: 600, color: s.c }}>{s.v}</p>
                </div>
              ))}
            </div>

            {/* TABS */}
            <div style={{ background: "#ffffff", border: "1px solid #e8edf4", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(10,22,40,0.05)" }}>
              {/* Tab nav */}
              <div style={{ display: "flex", borderBottom: "2px solid #f0f4f8" }}>
                {TABS.map(t => (
                  <button key={t} className="tab-btn"
                    onClick={() => setTab(t)}
                    style={{
                      padding: "0.85rem 1.4rem", fontSize: "0.82rem", fontWeight: 600,
                      color: tab === t ? "#0a1628" : "#9ba8bb",
                      borderBottom: `2px solid ${tab === t ? "#0a1628" : "transparent"}`,
                      marginBottom: -2, textTransform: "capitalize",
                    }}>
                    {t}
                  </button>
                ))}
              </div>

              {/* Overview */}
              {tab === "overview" && (
                <div style={{ padding: "1.25rem" }}>
                  <div style={{ marginBottom: "1.25rem" }}>
                    <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ba8bb", marginBottom: "1rem" }}>Price Ranges</p>
                    <RangeBar low={data.low_period} high={data.high_period} current={data.current_price} label={`${period.toUpperCase()} Range`}/>
                    {data.high_52w && data.low_52w && (
                      <RangeBar low={data.low_52w} high={data.high_52w} current={data.current_price} label="52-Week Range"/>
                    )}
                  </div>
                  <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ba8bb", marginBottom: "0.5rem" }}>
                    Key Metrics <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0, fontSize: "0.68rem" }}>— click any row to learn what it means</span>
                  </p>
                  <div className="metrics-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ border: "1px solid #f0f4f8", borderRadius: 12, overflow: "hidden" }}>
                      <MetricRow label="P/E Ratio" value={data.pe_ratio} explain={data.explainers.pe_ratio} good={data.pe_ratio ? data.pe_ratio < 10 : null}/>
                      <MetricRow label="EPS (PKR)" value={data.eps} explain="Earnings Per Share — profit per share. Higher is better." good={data.eps ? data.eps > 0 : null}/>
                      <MetricRow label="Dividend Yield" value={data.dividend_yield_pct} unit="%" explain={data.explainers.dividend} good={data.dividend_yield_pct ? data.dividend_yield_pct > 3 : null}/>
                      <MetricRow label="Beta" value={data.beta} explain={data.explainers.volatility} good={data.beta ? data.beta < 1 : null}/>
                    </div>
                    <div style={{ border: "1px solid #f0f4f8", borderRadius: 12, overflow: "hidden" }}>
                      <MetricRow label="Market Cap" value={data.market_cap_val} unit={data.market_cap_unit} explain="Total market value of all shares. Larger = more established."/>
                      <MetricRow label="Volume Today" value={data.volume_today ? `${(data.volume_today/1000).toFixed(0)}K` : null} explain={data.explainers.volume}/>
                      <MetricRow label="Avg Volume" value={data.avg_volume ? `${(data.avg_volume/1000).toFixed(0)}K` : null} explain="Average daily trading volume over the selected period."/>
                      <MetricRow label="Volatility" value={data.volatility_pct} unit="%/day" explain={data.explainers.volatility} good={data.volatility_pct ? data.volatility_pct < 1.5 : null}/>
                    </div>
                  </div>
                </div>
              )}

              {/* Financials */}
              {tab === "financials" && (
                <div>
                  <div className="metrics-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", margin: "1.25rem" }}>
                    <div style={{ border: "1px solid #f0f4f8", borderRadius: 12, overflow: "hidden" }}>
                      <MetricRow label="P/B Ratio" value={data.pb_ratio} explain="Price-to-Book: market price vs book value. Below 1.5 is often good value." good={data.pb_ratio ? data.pb_ratio < 1.5 : null}/>
                      <MetricRow label="Revenue" value={data.revenue_val} unit="B PKR" explain="Total revenue. Growing revenue = healthy business."/>
                      <MetricRow label="Profit Margin" value={data.profit_margin_pct} unit="%" explain="% of revenue that becomes profit. Higher = more efficient." good={data.profit_margin_pct ? data.profit_margin_pct > 15 : null}/>
                      <MetricRow label="Return on Equity" value={data.roe_pct} unit="%" explain="How well the company uses shareholder money. Above 15% is strong." good={data.roe_pct ? data.roe_pct > 15 : null}/>
                    </div>
                    <div style={{ border: "1px solid #f0f4f8", borderRadius: 12, overflow: "hidden" }}>
                      <MetricRow label="Debt / Equity" value={data.debt_to_equity} explain="Company debt vs equity. Lower is safer. Above 1.5 = high leverage." good={data.debt_to_equity ? data.debt_to_equity < 0.5 : null}/>
                      <MetricRow label="Current Ratio" value={data.current_ratio} explain="Can the company pay short-term bills? Above 1.5 is healthy." good={data.current_ratio ? data.current_ratio > 1.5 : null}/>
                      <MetricRow label="Dividend/Share" value={data.dividend_rate} unit="PKR" explain={data.explainers.dividend} good={data.dividend_rate ? data.dividend_rate > 0 : null}/>
                      <MetricRow label="52-Week High" value={data.high_52w} explain="Highest price in the last 52 weeks."/>
                    </div>
                  </div>
                  {!data.pe_ratio && !data.roe_pct && !data.profit_margin_pct && (
                    <div style={{ margin: "0 1.25rem 1.25rem", padding: "0.9rem 1rem", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, fontSize: "0.75rem", color: "#92400e", lineHeight: 1.7 }}>
                      <strong>Note:</strong> Fundamental data (P/E, ROE, margins) is limited for this PSX symbol on Yahoo Finance. Price, LDCP, and volume data is accurate.
                    </div>
                  )}
                </div>
              )}

              {/* About */}
              {tab === "about" && (
                <div style={{ padding: "1.25rem" }}>
                  <div style={{ marginBottom: "1.25rem" }}>
                    <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0a1628", marginBottom: "0.75rem" }}>{data.name}</h3>
                    {data.description ? (
                      <p style={{ fontSize: "0.82rem", color: "#6b7a99", lineHeight: 1.8, fontWeight: 300 }}>{data.description}</p>
                    ) : (
                      <p style={{ fontSize: "0.82rem", color: "#9ba8bb", fontStyle: "italic" }}>Company description not available.</p>
                    )}
                    {data.website && (
                      <a href={data.website} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: "1rem", fontSize: "0.78rem", fontWeight: 600, color: "#1d6bea", textDecoration: "none" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        Visit official website
                      </a>
                    )}
                  </div>
                  <div style={{ border: "1px solid #f0f4f8", borderRadius: 12, overflow: "hidden" }}>
                    {[["Sector", data.sector], ["Industry", data.industry], ["PSX Symbol", data.symbol], ["Market Cap", data.market_cap_val ? `${data.market_cap_val} ${data.market_cap_unit}` : "N/A"], ["Exchange", "Pakistan Stock Exchange (PSX)"]].map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.8rem 1.1rem", borderBottom: "1px solid #f5f7fa" }}>
                        <span style={{ fontSize: "0.8rem", color: "#9ba8bb", fontWeight: 500 }}>{k}</span>
                        <span style={{ fontSize: "0.8rem", color: "#0a1628", fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <p style={{ textAlign: "center", fontSize: "0.62rem", color: "#b0bbc8", padding: "1.25rem 0 1.5rem" }}>
              Educational platform only · Data via Yahoo Finance · Not financial advice · Always do your own research
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}
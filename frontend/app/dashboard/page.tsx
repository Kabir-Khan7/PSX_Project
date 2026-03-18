"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import AppLayout from "@/components/AppLayout";
import { apiGet, apiPost } from "@/lib/api";

interface KSE100 { current: number; change: number; change_pct: number; history: { date: string; close: number }[]; }
interface Stock   { symbol: string; name: string; sector: string; close: number; ldcp: number; change: number; change_pct: number; volume: number; }
interface SearchResult { symbol: string; name: string; sector: string; }

const TICKERS = [
  { sym:"OGDC",val:"262.64",chg:"+0.30%",up:true }, { sym:"HBL",val:"259.60",chg:"-2.09%",up:false },
  { sym:"LUCK",val:"346.79",chg:"+1.13%",up:true }, { sym:"PSO",val:"353.39",chg:"+2.18%",up:true },
  { sym:"ENGRO",val:"263.93",chg:"+1.01%",up:true },{ sym:"MCB",val:"362.27",chg:"+4.47%",up:true },
  { sym:"UBL",val:"364.83",chg:"+1.78%",up:true },  { sym:"PPL",val:"206.57",chg:"+2.14%",up:true },
  { sym:"MEBL",val:"426.19",chg:"+0.59%",up:true },  { sym:"SYS",val:"126.14",chg:"+0.90%",up:true },
];
const PERIODS = [{ k:"1wk",l:"1W" },{ k:"1mo",l:"1M" },{ k:"3mo",l:"3M" },{ k:"1y",l:"1Y" }];

function fmtN(n: number|null|undefined, d=2) {
  if (n==null) return "—";
  return n.toLocaleString("en-PK",{minimumFractionDigits:d,maximumFractionDigits:d});
}

export default function DashboardPage() {
  const router = useRouter();
  const [kse, setKse]         = useState<KSE100|null>(null);
  const [stocks, setStocks]   = useState<Stock[]>([]);
  const [loadKse, setLoadKse] = useState(true);
  const [loadStk, setLoadStk] = useState(true);
  const [period, setPeriod]   = useState("3mo");
  const [tab, setTab]         = useState("all");
  const [query, setQuery]     = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDrop, setShowDrop] = useState(false);
  const [searching, setSearching] = useState(false);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [toast, setToast]     = useState<{msg:string;ok:boolean}|null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const showToast = (msg:string, ok=true) => { setToast({msg,ok}); setTimeout(()=>setToast(null),3000); };

  const loadKSE = useCallback(async (p:string) => {
    setLoadKse(true);
    try { const d = await apiGet<KSE100>(`/stocks/kse100?period=${p}`); setKse(d); }
    catch { setKse({current:0,change:0,change_pct:0,history:[]}); }
    finally { setLoadKse(false); }
  }, []);

  useEffect(() => {
    loadKSE(period);
    apiGet<Stock[]>("/stocks/top").then(setStocks).catch(()=>{}).finally(()=>setLoadStk(false));
    apiGet<{symbol:string}[]>("/watchlist/").then(w=>setWatchlist(new Set(w.map(i=>i.symbol)))).catch(()=>{});
    const h=(e:MouseEvent)=>{ if(searchRef.current&&!searchRef.current.contains(e.target as Node)) setShowDrop(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  }, [loadKSE, period]);

  const handleSearch = useCallback(async (q:string) => {
    setQuery(q);
    if(!q.trim()){setResults([]);setShowDrop(false);return;}
    setSearching(true); setShowDrop(true);
    try { const r=await apiGet<SearchResult[]>(`/stocks/search?q=${encodeURIComponent(q)}`); setResults(r); }
    catch { setResults([]); }
    finally { setSearching(false); }
  }, []);

  const toggleWatch = async (e:React.MouseEvent, s:Stock) => {
    e.stopPropagation();
    if(watchlist.has(s.symbol)) {
      try { await fetch(`http://localhost:8000/watchlist/${s.symbol}`,{method:"DELETE",credentials:"include"}); setWatchlist(p=>{const n=new Set(p);n.delete(s.symbol);return n;}); showToast(`${s.symbol} removed`); }
      catch { showToast("Failed",false); }
    } else {
      try { await apiPost("/watchlist/",{symbol:s.symbol}); setWatchlist(p=>new Set([...p,s.symbol])); showToast(`${s.symbol} added ★`); }
      catch(err:unknown){ showToast(err instanceof Error?err.message:"Failed",false); }
    }
  };

  const isUp    = (kse?.change??0) >= 0;
  const gainers = stocks.filter(s=>s.change>=0).length;
  const losers  = stocks.filter(s=>s.change<0).length;
  const filtered= tab==="all"?stocks:tab==="gainers"?stocks.filter(s=>s.change>=0):stocks.filter(s=>s.change<0);
  const chartData=(kse?.history??[]).map(d=>({d:d.date.slice(5),v:d.close}));

  return (
    <AppLayout>
      <style>{`
        @keyframes tkscroll { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .tk { animation:tkscroll 55s linear infinite; display:flex; width:max-content; align-items:center; }
        .tk:hover { animation-play-state:paused; }
        @keyframes toastIn { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
        .toast-bar { animation:toastIn 0.2s ease; }
        @keyframes skpulse { 0%,100%{opacity:0.3} 50%{opacity:0.6} }
        .sk { background:rgba(255,255,255,0.06); border-radius:8px; animation:skpulse 1.5s ease infinite; }
        .period-btn,.tab-btn,.stk-row { cursor:pointer; transition:all 0.15s; }
        .stk-row:hover { background:rgba(255,255,255,0.03) !important; }
        .stk-row:hover .wstar { opacity:1 !important; }
        .drop-item:hover { background:rgba(255,255,255,0.04) !important; }
        .stat-card:hover { border-color:rgba(15,212,180,0.3) !important; transform:translateY(-1px); }
        @media (max-width:900px) {
          .stat-grid { grid-template-columns:repeat(2,1fr) !important; }
          .col-md { display:none !important; }
          .dash-pad { padding:1rem !important; }
        }
        @media (max-width:560px) {
          .stat-grid { grid-template-columns:1fr 1fr !important; }
          .col-sm { display:none !important; }
        }
      `}</style>

      {toast && (
        <div className="toast-bar" style={{position:"fixed",top:16,right:16,zIndex:9999,background:toast.ok?"#0a1628":"#dc2626",color:"#fff",padding:"10px 16px",borderRadius:10,fontSize:"0.78rem",fontWeight:600,boxShadow:"0 8px 32px rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.1)",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
          {toast.msg}
        </div>
      )}

      {/* TICKER */}
      <div style={{background:"#030810",height:32,overflow:"hidden",display:"flex",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
        <div className="tk">
          {[...TICKERS,...TICKERS].map((t,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:7,padding:"0 16px",borderRight:"1px solid rgba(255,255,255,0.04)",fontFamily:"'JetBrains Mono',monospace",fontSize:"0.63rem",whiteSpace:"nowrap"}}>
              <span style={{color:"rgba(255,255,255,0.25)",letterSpacing:"0.06em"}}>{t.sym}</span>
              <span style={{color:"rgba(255,255,255,0.65)",fontWeight:500}}>{t.val}</span>
              <span style={{color:t.up?"#34d399":"#f87171",fontWeight:600}}>{t.chg}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="dash-pad" style={{padding:"1.25rem 1.5rem",maxWidth:1440,margin:"0 auto",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>

        {/* SEARCH */}
        <div ref={searchRef} style={{position:"relative",marginBottom:"1.25rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,background:"#0d1b33",border:"1px solid rgba(255,255,255,0.08)",borderRadius:12,padding:"0 14px",transition:"border-color 0.15s"}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input style={{flex:1,padding:"0.7rem 0",border:"none",background:"transparent",outline:"none",fontSize:"0.875rem",color:"rgba(255,255,255,0.8)",fontFamily:"'Plus Jakarta Sans',sans-serif"}}
              placeholder="Search any PSX stock — OGDC, Habib Bank, Lucky Cement..."
              value={query} onChange={e=>handleSearch(e.target.value)} onFocus={()=>query&&setShowDrop(true)}/>
            {query&&<button onClick={()=>{setQuery("");setResults([]);setShowDrop(false);}} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",fontSize:"1.1rem",lineHeight:1,padding:0}}>×</button>}
          </div>
          {showDrop&&(
            <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:"#0d1b33",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,boxShadow:"0 16px 48px rgba(0,0,0,0.5)",zIndex:300,overflow:"hidden",maxHeight:320,overflowY:"auto"}}>
              {searching ? <div style={{padding:"1rem",textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:"0.8rem"}}>Searching...</div>
                : results.length===0 ? <div style={{padding:"1rem",textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:"0.8rem"}}>No results for &ldquo;{query}&rdquo;</div>
                : results.map(s=>(
                  <div key={s.symbol} className="drop-item" onClick={()=>{router.push(`/stock/${s.symbol}`);setShowDrop(false);setQuery("");}}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.7rem 1rem",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer"}}>
                    <div>
                      <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"0.82rem",fontWeight:600,color:"#f0f6ff",margin:0}}>{s.symbol}</p>
                      <p style={{fontSize:"0.7rem",color:"rgba(255,255,255,0.3)",margin:"2px 0 0"}}>{s.name}</p>
                    </div>
                    <span style={{fontSize:"0.6rem",fontWeight:700,color:"#0fd4b4",background:"rgba(15,212,180,0.1)",border:"1px solid rgba(15,212,180,0.2)",padding:"2px 8px",borderRadius:20}}>{s.sector}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* KSE-100 HERO */}
        <div style={{background:"#0a1628",borderRadius:18,overflow:"hidden",marginBottom:"1.25rem",border:"1px solid rgba(255,255,255,0.06)",position:"relative"}}>
          <div style={{position:"absolute",inset:0,pointerEvents:"none",background:"radial-gradient(ellipse 60% 80% at 85% 0%, rgba(15,212,180,0.07) 0%, transparent 60%)"}}/>
          <div style={{padding:"1.5rem 1.75rem 0",position:"relative",zIndex:1}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:"1rem",marginBottom:"1rem"}}>
              <div>
                <p style={{fontSize:"0.58rem",fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:"rgba(255,255,255,0.25)",marginBottom:8}}>KSE-100 · Pakistan Stock Exchange</p>
                {loadKse ? <div className="sk" style={{width:220,height:52,borderRadius:8,background:"rgba(255,255,255,0.06)"}}/>
                : (
                  <>
                    <div style={{display:"flex",alignItems:"baseline",gap:14,flexWrap:"wrap"}}>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"clamp(1.8rem,4vw,2.8rem)",fontWeight:600,color:"#ffffff",letterSpacing:"-0.02em",lineHeight:1}}>
                        {fmtN(kse?.current,0)}
                      </span>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"0.85rem",fontWeight:600,padding:"4px 12px",borderRadius:8,background:isUp?"rgba(52,211,153,0.12)":"rgba(248,113,113,0.12)",color:isUp?"#34d399":"#f87171"}}>
                        {isUp?"▲":"▼"} {isUp?"+":""}{fmtN(kse?.change,2)} pts
                      </span>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"0.78rem",fontWeight:600,color:isUp?"#34d399":"#f87171"}}>
                        {isUp?"+":""}{kse?.change_pct?.toFixed(2)}% today
                      </span>
                    </div>
                  </>
                )}
              </div>
              <div style={{display:"flex",gap:4,alignSelf:"flex-start",paddingTop:4}}>
                {PERIODS.map(p=>(
                  <button key={p.k} className="period-btn" onClick={()=>{setPeriod(p.k);loadKSE(p.k);}}
                    style={{padding:"5px 13px",borderRadius:8,fontSize:"0.72rem",fontWeight:600,border:"none",background:period===p.k?"rgba(15,212,180,0.15)":"rgba(255,255,255,0.06)",color:period===p.k?"#0fd4b4":"rgba(255,255,255,0.35)",fontFamily:"inherit",cursor:"pointer"}}>
                    {p.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {!loadKse && chartData.length > 2 ? (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={chartData} margin={{top:8,right:24,left:-4,bottom:0}}>
                <defs>
                  <linearGradient id="kg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={isUp?"#0fd4b4":"#f87171"} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={isUp?"#0fd4b4":"#f87171"} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false}/>
                <XAxis dataKey="d" tick={{fontSize:9,fill:"rgba(255,255,255,0.2)",fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false} interval="preserveStartEnd"/>
                <YAxis tick={{fontSize:9,fill:"rgba(255,255,255,0.2)",fontFamily:"JetBrains Mono"}} axisLine={false} tickLine={false} domain={["auto","auto"]} width={58} tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}K`:String(v)}/>
                <Tooltip contentStyle={{background:"#0d1b33",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 12px"}} labelStyle={{color:"rgba(255,255,255,0.4)",fontSize:10,fontFamily:"JetBrains Mono"}} itemStyle={{color:"#fff",fontFamily:"JetBrains Mono",fontSize:13,fontWeight:700}} formatter={(v:unknown)=>[Number(v).toLocaleString("en-PK",{maximumFractionDigits:0}),"KSE-100"]}/>
                <Area type="monotone" dataKey="v" stroke={isUp?"#0fd4b4":"#f87171"} strokeWidth={2.5} fill="url(#kg)" dot={false} activeDot={{r:4,strokeWidth:0}}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : loadKse ? (
            <div style={{height:190,display:"flex",alignItems:"center",justifyContent:"center"}}><p style={{color:"rgba(255,255,255,0.15)",fontSize:"0.78rem",fontFamily:"JetBrains Mono,monospace"}}>Loading chart...</p></div>
          ) : (
            <div style={{height:190,display:"flex",alignItems:"center",justifyContent:"center"}}><p style={{color:"rgba(255,255,255,0.15)",fontSize:"0.78rem"}}>Chart data unavailable</p></div>
          )}
        </div>

        {/* STAT CARDS */}
        <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:"0.875rem",marginBottom:"1.25rem"}}>
          {[
            {label:"Index Level",value:loadKse?null:fmtN(kse?.current,0),unit:"pts",sub:"KSE-100 latest",color:isUp?"#34d399":"#f87171",accent:isUp?"#34d399":"#f87171"},
            {label:"Day Change",value:loadKse?null:`${isUp?"+":""}${kse?.change_pct?.toFixed(2)}%`,unit:"",sub:"vs prev close",color:isUp?"#34d399":"#f87171",accent:isUp?"#34d399":"#f87171"},
            {label:"Gainers",value:gainers.toString(),unit:"stocks",sub:`of ${stocks.length} tracked`,color:"#34d399",accent:"#34d399"},
            {label:"Losers",value:losers.toString(),unit:"stocks",sub:`of ${stocks.length} tracked`,color:"#f87171",accent:"#f87171"},
            {label:"PSX Listed",value:"561",unit:"cos.",sub:"total companies",color:"#0fd4b4",accent:"#0fd4b4"},
          ].map(c=>(
            <div key={c.label} className="stat-card" style={{background:"#0d1b33",border:`1px solid rgba(255,255,255,0.07)`,borderTop:`2px solid ${c.accent}`,borderRadius:12,padding:"1rem 1.1rem",boxShadow:"0 2px 8px rgba(0,0,0,0.2)",transition:"all 0.15s"}}>
              <p style={{fontSize:"0.58rem",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(255,255,255,0.3)",margin:"0 0 8px"}}>{c.label}</p>
              {c.value==null ? <div className="sk" style={{width:"75%",height:28,marginBottom:5}}/>
              : (
                <div style={{display:"flex",alignItems:"baseline",gap:5,marginBottom:4}}>
                  <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"1.4rem",fontWeight:700,color:c.color,letterSpacing:"-0.02em",lineHeight:1}}>{c.value}</span>
                  {c.unit&&<span style={{fontSize:"0.58rem",fontWeight:700,color:"rgba(255,255,255,0.25)",letterSpacing:"0.06em",textTransform:"uppercase"}}>{c.unit}</span>}
                </div>
              )}
              <p style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.25)",margin:0}}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* STOCKS TABLE */}
        <div style={{background:"#0d1b33",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,overflow:"hidden",marginBottom:"1.5rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"1rem 1.25rem",borderBottom:"1px solid rgba(255,255,255,0.06)",flexWrap:"wrap",gap:"0.75rem"}}>
            <div>
              <h2 style={{fontSize:"0.9rem",fontWeight:700,color:"#f0f6ff",margin:0,letterSpacing:"-0.01em"}}>Top PSX Stocks</h2>
              <p style={{fontSize:"0.65rem",color:"rgba(255,255,255,0.25)",margin:"3px 0 0"}}>Live data · Click any row for full analysis</p>
            </div>
            <div style={{display:"flex",gap:3,background:"rgba(255,255,255,0.04)",padding:3,borderRadius:10,border:"1px solid rgba(255,255,255,0.06)"}}>
              {(["all","gainers","losers"] as const).map(t=>(
                <button key={t} className="tab-btn" onClick={()=>setTab(t)}
                  style={{padding:"5px 14px",borderRadius:8,fontSize:"0.7rem",fontWeight:600,border:"none",background:tab===t?"rgba(15,212,180,0.15)":"transparent",color:tab===t?"#0fd4b4":"rgba(255,255,255,0.35)",fontFamily:"inherit",cursor:"pointer"}}>
                  {t==="all"?"All":t==="gainers"?"Gainers":"Losers"}
                </button>
              ))}
            </div>
          </div>

          {/* Headers */}
          <div style={{display:"grid",gridTemplateColumns:"100px 1fr 110px 110px 100px 40px",padding:"0.45rem 1.25rem",background:"rgba(255,255,255,0.02)",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            {["Symbol","Company","Price","LDCP","Change",""].map((h,i)=>(
              <div key={i} className={i===1?"col-md":i===3?"col-md":""} style={{fontSize:"0.58rem",fontWeight:700,letterSpacing:"0.09em",textTransform:"uppercase",color:"rgba(255,255,255,0.25)",textAlign:i>=2?"right":"left"}}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {loadStk ? (
            Array.from({length:8}).map((_,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"100px 1fr 110px 110px 100px 40px",padding:"0.85rem 1.25rem",borderBottom:"1px solid rgba(255,255,255,0.03)",alignItems:"center"}}>
                <div className="sk" style={{width:50,height:14}}/><div className="sk" style={{width:140,height:14}}/>
                <div className="sk" style={{width:60,height:14,marginLeft:"auto"}}/><div className="sk" style={{width:60,height:14,marginLeft:"auto"}}/>
                <div className="sk" style={{width:55,height:20,marginLeft:"auto",borderRadius:6}}/><div/>
              </div>
            ))
          ) : filtered.length===0 ? (
            <div style={{padding:"3rem",textAlign:"center",color:"rgba(255,255,255,0.25)",fontSize:"0.82rem"}}>No stocks match this filter.</div>
          ) : filtered.map((s,i)=>(
            <div key={s.symbol} className="stk-row" onClick={()=>router.push(`/stock/${s.symbol}`)}
              style={{display:"grid",gridTemplateColumns:"100px 1fr 110px 110px 100px 40px",padding:"0 1.25rem",height:56,alignItems:"center",borderBottom:i<filtered.length-1?"1px solid rgba(255,255,255,0.03)":"none",background:"transparent"}}>
              <div>
                <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"0.82rem",fontWeight:600,color:"#f0f6ff",margin:"0 0 2px"}}>{s.symbol}</p>
                <span style={{fontSize:"0.55rem",fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase",color:"#0fd4b4",background:"rgba(15,212,180,0.08)",padding:"1px 5px",borderRadius:4,whiteSpace:"nowrap"}}>{s.sector?.slice(0,10)}</span>
              </div>
              <div className="col-md" style={{paddingRight:"1rem",minWidth:0}}>
                <p style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.55)",fontWeight:400,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",margin:0}}>{s.name}</p>
              </div>
              <div style={{textAlign:"right"}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"0.85rem",fontWeight:600,color:"#f0f6ff"}}>{fmtN(s.close)}</span>
              </div>
              <div className="col-md" style={{textAlign:"right"}}>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"0.8rem",color:"rgba(255,255,255,0.3)"}}>{fmtN(s.ldcp)}</span>
              </div>
              <div style={{textAlign:"right"}}>
                <span style={{display:"inline-block",fontFamily:"'JetBrains Mono',monospace",fontSize:"0.72rem",fontWeight:700,padding:"4px 8px",borderRadius:7,background:s.change_pct>=0?"rgba(52,211,153,0.12)":"rgba(248,113,113,0.12)",color:s.change_pct>=0?"#34d399":"#f87171"}}>
                  {s.change_pct>=0?"▲":"▼"} {Math.abs(s.change_pct).toFixed(2)}%
                </span>
              </div>
              <div style={{display:"flex",justifyContent:"center"}}>
                <button className="wstar" onClick={e=>toggleWatch(e,s)}
                  style={{background:"none",border:"none",cursor:"pointer",padding:5,borderRadius:6,opacity:watchlist.has(s.symbol)?1:0,transition:"opacity 0.15s"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill={watchlist.has(s.symbol)?"#f59e0b":"none"} stroke={watchlist.has(s.symbol)?"#f59e0b":"rgba(255,255,255,0.3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <p style={{textAlign:"center",fontSize:"0.6rem",color:"rgba(255,255,255,0.15)",paddingBottom:"1.5rem",lineHeight:1.8}}>
          Educational platform only · Data via Yahoo Finance + PSX Data Portal · LDCP = Last Day Closing Price · Not financial advice
        </p>
      </div>
    </AppLayout>
  );
}
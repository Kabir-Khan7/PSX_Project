"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiPost } from "@/lib/api";

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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [mounted, setMounted]   = useState(false);
  const [time, setTime]         = useState("");
  const [focused, setFocused]   = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      timeZone: "Asia/Karachi",
    }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await apiPost("/auth/login", { email, password });
      router.push("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials");
    } finally { setLoading(false); }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,300&family=JetBrains+Mono:wght@400;500&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; overflow: hidden; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #060d1f; }

        /* Ticker */
        @keyframes scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .tk { animation: scroll 50s linear infinite; }
        .tk:hover { animation-play-state: paused; }

        /* Pulse */
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }

        /* Fade animations */
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeLeft { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }

        .fu1 { animation: fadeUp   0.55s cubic-bezier(0.16,1,0.3,1) 0.1s  both; }
        .fu2 { animation: fadeUp   0.55s cubic-bezier(0.16,1,0.3,1) 0.18s both; }
        .fu3 { animation: fadeUp   0.55s cubic-bezier(0.16,1,0.3,1) 0.26s both; }
        .fu4 { animation: fadeUp   0.55s cubic-bezier(0.16,1,0.3,1) 0.34s both; }
        .fu5 { animation: fadeUp   0.55s cubic-bezier(0.16,1,0.3,1) 0.42s both; }
        .fl1 { animation: fadeLeft 0.6s  cubic-bezier(0.16,1,0.3,1) 0.15s both; }
        .fl2 { animation: fadeLeft 0.6s  cubic-bezier(0.16,1,0.3,1) 0.28s both; }
        .fl3 { animation: fadeLeft 0.6s  cubic-bezier(0.16,1,0.3,1) 0.41s both; }
        .fl4 { animation: fadeLeft 0.6s  cubic-bezier(0.16,1,0.3,1) 0.54s both; }

        /* Input focus glow */
        .inp { transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; }
        .inp:focus { outline: none; border-color: #0fd4b4 !important; box-shadow: 0 0 0 3px rgba(15,212,180,0.15); background: #ffffff !important; }
        .inp::placeholder { color: #9ba8bb; }

        /* Button shimmer */
        .btn-primary {
          position: relative; overflow: hidden;
          transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
        }
        .btn-primary::after {
          content: '';
          position: absolute; top: 0; left: -100%; width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          transition: left 0.5s;
        }
        .btn-primary:hover::after { left: 150%; }
        .btn-primary:hover { background: #162035 !important; box-shadow: 0 8px 24px rgba(11,17,32,0.35) !important; }
        .btn-primary:active { transform: scale(0.99); }

        /* Mobile */
        @media (max-width: 860px) {
          .left-panel { display: none !important; }
          .right-panel { width: 100% !important; border-left: none !important; }
        }
      `}</style>

      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#060d1f" }}>

        {/* ── TOP NAV ── */}
        <header style={{
          height: 54, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "0 1.75rem",
          background: "rgba(6,13,31,0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0, zIndex: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, background: "rgba(255,255,255,0.07)",
              borderRadius: 9, border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg viewBox="0 0 16 16" fill="none" style={{ width: 15, height: 15 }}>
                <polyline points="1,13 5,7 9,10 15,3" stroke="#0fd4b4"
                  strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="15" cy="3" r="1.8" fill="#00c896"/>
              </svg>
            </div>
            <span style={{
              color: "#f0f6ff", fontWeight: 700, fontSize: "0.92rem",
              letterSpacing: "-0.03em",
            }}>
              PSX<span style={{ color: "#0fd4b4" }}>.</span>Analysis
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              background: "rgba(15,212,180,0.1)",
              border: "1px solid rgba(15,212,180,0.2)",
              borderRadius: 20, padding: "4px 12px",
              fontSize: "0.62rem", fontWeight: 700,
              color: "#0fd4b4", letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: "#0fd4b4",
                display: "inline-block", animation: "pulse 2s infinite",
              }}/>
              Market Live
            </div>
            {mounted && (
              <code style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.7rem", color: "rgba(255,255,255,0.35)",
                background: "rgba(255,255,255,0.05)",
                padding: "4px 10px", borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.07)",
              }}>{time} PKT</code>
            )}
          </div>
        </header>

        {/* ── TICKER ── */}
        <div style={{
          background: "#080f20", height: 36,
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          overflow: "hidden", display: "flex", alignItems: "center",
          flexShrink: 0,
        }}>
          <div className="tk" style={{ display: "flex", alignItems: "center", width: "max-content" }}>
            {[...TICKERS, ...TICKERS].map((t, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "0 20px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "0.68rem", whiteSpace: "nowrap",
                borderRight: "1px solid rgba(255,255,255,0.06)",
              }}>
                <span style={{ color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.04em" }}>{t.sym}</span>
                <span style={{ color: "rgba(255,255,255,0.75)" }}>{t.val}</span>
                <span style={{
                  color: t.up ? "#34d399" : "#f87171",
                  fontWeight: 600,
                }}>{t.chg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── LEFT PANEL ── */}
          <div className="left-panel" style={{
            flex: 1, background: "#0a1628",
            display: "flex", flexDirection: "column",
            justifyContent: "center",
            padding: "3rem 4rem",
            position: "relative", overflow: "hidden",
          }}>
            {/* Background gradient mesh */}
            <div style={{
              position: "absolute", inset: 0, pointerEvents: "none",
              background: "radial-gradient(ellipse 60% 50% at 80% 20%, rgba(15,212,180,0.06) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 20% 80%, rgba(29,107,234,0.08) 0%, transparent 70%)",
            }}/>

            {/* Decorative rings */}
            {[
              { s: 520, t: -220, r: -180 },
              { s: 300, t: -80, r: -20 },
              { s: 180, t: 60, r: 120 },
            ].map((c, i) => (
              <div key={i} style={{
                position: "absolute", borderRadius: "50%",
                width: c.s, height: c.s, top: c.t, right: c.r,
                border: "1px solid rgba(15,212,180,0.07)",
                pointerEvents: "none",
              }}/>
            ))}

            {mounted && (
              <div style={{ position: "relative", zIndex: 2, maxWidth: 480 }}>

                {/* Tag */}
                <div className="fl1" style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: "rgba(15,212,180,0.1)",
                  border: "1px solid rgba(15,212,180,0.2)",
                  borderRadius: 20, padding: "5px 14px",
                  fontSize: "0.62rem", fontWeight: 700,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  color: "#0fd4b4", marginBottom: "2.5rem",
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#0fd4b4", display: "inline-block" }}/>
                  Pakistan Stock Exchange
                </div>

                {/* Headline */}
                <h1 className="fl2" style={{
                  fontSize: "clamp(2rem, 3.2vw, 3rem)",
                  fontWeight: 800, lineHeight: 1.08,
                  color: "#f0f6ff", letterSpacing: "-0.04em",
                  marginBottom: "1.5rem",
                }}>
                  Institutional<br/>
                  intelligence.<br/>
                  <span style={{ color: "#0fd4b4" }}>For everyone.</span>
                </h1>

                {/* Subtitle */}
                <p className="fl3" style={{
                  fontSize: "0.88rem", fontWeight: 300,
                  lineHeight: 1.9, color: "rgba(255,255,255,0.4)",
                  marginBottom: "3rem", maxWidth: 380,
                }}>
                  Real-time PSX data, AI-powered stock research, and
                  plain-language insights — built for Pakistan&apos;s next
                  generation of investors.
                </p>

                {/* Chart card */}
                <div className="fl3" style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  borderRadius: 14, padding: "1.25rem 1.5rem",
                  marginBottom: "1.5rem",
                  backdropFilter: "blur(10px)",
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: "1rem",
                  }}>
                    <span style={{
                      fontSize: "0.62rem", fontWeight: 700,
                      letterSpacing: "0.1em", textTransform: "uppercase",
                      color: "rgba(255,255,255,0.25)",
                    }}>KSE-100 Index</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "1.1rem", fontWeight: 500, color: "#f0f6ff",
                      }}>156,181</span>
                      <span style={{
                        fontSize: "0.72rem", fontWeight: 700,
                        color: "#34d399",
                      }}>↑ +51.7% YTD</span>
                    </div>
                  </div>
                  <svg viewBox="0 0 400 72" style={{ width: "100%", display: "block" }}>
                    <defs>
                      <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0fd4b4" stopOpacity="0.25"/>
                        <stop offset="100%" stopColor="#0fd4b4" stopOpacity="0"/>
                      </linearGradient>
                    </defs>
                    <path d="M0,62 L44,54 L88,57 L132,40 L176,44 L220,24 L264,30 L308,12 L352,17 L400,8 L400,72 L0,72Z"
                      fill="url(#cg)"/>
                    <polyline points="0,62 44,54 88,57 132,40 176,44 220,24 264,30 308,12 352,17 400,8"
                      fill="none" stroke="#0fd4b4" strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="400" cy="8" r="4" fill="#0fd4b4"/>
                  </svg>
                </div>

                {/* Stats */}
                <div className="fl4" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }}>
                  {[
                    { v: "+51.7%", l: "YTD Return", hi: true },
                    { v: "561",    l: "Companies",  hi: false },
                    { v: "AI",     l: "Research",   hi: false },
                  ].map(s => (
                    <div key={s.l} style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10, padding: "0.9rem 1rem",
                    }}>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "1.15rem", fontWeight: 500,
                        color: s.hi ? "#0fd4b4" : "#f0f6ff",
                        marginBottom: 4,
                      }}>{s.v}</div>
                      <div style={{
                        fontSize: "0.6rem", fontWeight: 700,
                        letterSpacing: "0.09em", textTransform: "uppercase",
                        color: "rgba(255,255,255,0.25)",
                      }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT PANEL ── */}
          <div className="right-panel" style={{
            width: 480, flexShrink: 0,
            background: "#ffffff",
            display: "flex", flexDirection: "column",
            justifyContent: "center",
            padding: "2.75rem 3rem",
            overflowY: "auto",
            borderLeft: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "-20px 0 60px rgba(6,13,31,0.25)",
            position: "relative",
          }}>
            {/* Top accent */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0, height: 3,
              background: "linear-gradient(90deg, #0fd4b4 0%, #1d6bea 60%, transparent 100%)",
            }}/>

            {mounted && (
              <>
                <div className="fu1" style={{
                  fontSize: "0.62rem", fontWeight: 700,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "#0aaa8f", marginBottom: "0.75rem",
                }}>
                  Secure Portal
                </div>

                <h2 className="fu2" style={{
                  fontSize: "2rem", fontWeight: 800,
                  color: "#0a1628", letterSpacing: "-0.04em",
                  lineHeight: 1.1, marginBottom: "0.5rem",
                }}>
                  Welcome back
                </h2>

                <p className="fu3" style={{
                  fontSize: "0.82rem", color: "#6b7a99",
                  lineHeight: 1.65, marginBottom: "2.25rem",
                  fontWeight: 400,
                }}>
                  Sign in to your investment intelligence dashboard
                </p>

                <form onSubmit={handleSubmit}>
                  {/* Email field */}
                  <div className="fu3" style={{ marginBottom: "1.1rem" }}>
                    <label style={{
                      display: "block", fontSize: "0.68rem", fontWeight: 700,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      color: "#2d3a52", marginBottom: "0.5rem",
                    }}>Email Address</label>
                    <div style={{ position: "relative" }}>
                      <span style={{
                        position: "absolute", left: 14, top: "50%",
                        transform: "translateY(-50%)",
                        color: "#9ba8bb", fontSize: "0.82rem", pointerEvents: "none",
                      }}>✉</span>
                      <input
                        className="inp"
                        style={{
                          width: "100%",
                          background: focused === "email" ? "#ffffff" : "#f8fafc",
                          border: `1.5px solid ${focused === "email" ? "#0fd4b4" : "#e8edf4"}`,
                          borderRadius: 10, color: "#0a1628",
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          fontSize: "0.875rem", fontWeight: 400,
                          padding: "0.8rem 0.9rem 0.8rem 2.75rem",
                        }}
                        type="email" placeholder="you@example.com"
                        value={email} onChange={e => setEmail(e.target.value)}
                        required autoComplete="email"
                        onFocus={() => setFocused("email")}
                        onBlur={() => setFocused(null)}
                      />
                    </div>
                  </div>

                  {/* Password field */}
                  <div className="fu4" style={{ marginBottom: "1.5rem" }}>
                    <label style={{
                      display: "block", fontSize: "0.68rem", fontWeight: 700,
                      letterSpacing: "0.06em", textTransform: "uppercase",
                      color: "#2d3a52", marginBottom: "0.5rem",
                    }}>Password</label>
                    <div style={{ position: "relative" }}>
                      <span style={{
                        position: "absolute", left: 14, top: "50%",
                        transform: "translateY(-50%)",
                        color: "#9ba8bb", fontSize: "0.82rem", pointerEvents: "none",
                      }}>🔒</span>
                      <input
                        className="inp"
                        style={{
                          width: "100%",
                          background: focused === "password" ? "#ffffff" : "#f8fafc",
                          border: `1.5px solid ${focused === "password" ? "#0fd4b4" : "#e8edf4"}`,
                          borderRadius: 10, color: "#0a1628",
                          fontFamily: "'Plus Jakarta Sans', sans-serif",
                          fontSize: "0.875rem", fontWeight: 400,
                          padding: "0.8rem 0.9rem 0.8rem 2.75rem",
                        }}
                        type="password" placeholder="Min. 8 characters"
                        value={password} onChange={e => setPassword(e.target.value)}
                        required autoComplete="current-password"
                        onFocus={() => setFocused("password")}
                        onBlur={() => setFocused(null)}
                      />
                    </div>
                  </div>

                  {/* Error */}
                  {error && (
                    <div style={{
                      display: "flex", gap: 10, alignItems: "flex-start",
                      background: "#fff1f2",
                      border: "1.5px solid rgba(244,63,94,0.2)",
                      borderLeft: "3px solid #f43f5e",
                      borderRadius: 10, padding: "0.75rem 1rem",
                      marginBottom: "1.25rem",
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: "#f43f5e", color: "white",
                        fontSize: "0.62rem", fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, marginTop: 1,
                      }}>!</div>
                      <p style={{ fontSize: "0.78rem", color: "#be123c", lineHeight: 1.5, fontWeight: 500 }}>{error}</p>
                    </div>
                  )}

                  {/* Submit button */}
                  <div className="fu5">
                    <button
                      type="submit" disabled={loading}
                      className="btn-primary"
                      style={{
                        width: "100%",
                        background: loading ? "#e8edf4" : "#0a1628",
                        color: loading ? "#9ba8bb" : "#ffffff",
                        border: "none", borderRadius: 10,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                        fontSize: "0.875rem", fontWeight: 700,
                        letterSpacing: "0.01em",
                        padding: "0.9rem 1rem",
                        cursor: loading ? "not-allowed" : "pointer",
                        boxShadow: loading ? "none" : "0 4px 16px rgba(10,22,40,0.2)",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", gap: 8,
                        marginBottom: "1.25rem",
                      }}
                    >
                      {loading
                        ? <><span style={{ width: 16, height: 16, border: "2px solid #c8d0dc", borderTopColor: "#6b7a99", borderRadius: "50%", display: "inline-block", animation: "spin 0.6s linear infinite" }}/> Signing in...</>
                        : <><span>Sign In to Dashboard</span><span style={{ fontSize: "1rem" }}>→</span></>
                      }
                    </button>
                  </div>
                </form>

                {/* Divider */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0.25rem 0 1.25rem" }}>
                  <div style={{ flex: 1, height: 1, background: "#edf0f5" }}/>
                  <span style={{ fontSize: "0.7rem", color: "#9ba8bb", fontWeight: 500 }}>New to PSX Analysis?</span>
                  <div style={{ flex: 1, height: 1, background: "#edf0f5" }}/>
                </div>

                <div style={{ textAlign: "center", fontSize: "0.82rem", color: "#6b7a99" }}>
                  Don&apos;t have an account?{" "}
                  <Link href="/register" style={{ color: "#0aaa8f", fontWeight: 700, textDecoration: "none" }}>
                    Create one free
                  </Link>
                </div>

                {/* Trust row */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  gap: "1.5rem", marginTop: "2rem", paddingTop: "1.5rem",
                  borderTop: "1px solid #edf0f5",
                }}>
                  {[["🔒","SSL Secured"],["🛡","JWT Auth"],["✓","HTTPS Only"]].map(([ic, lb]) => (
                    <div key={lb} style={{
                      display: "flex", alignItems: "center", gap: 5,
                      fontSize: "0.62rem", fontWeight: 600, color: "#9ba8bb",
                    }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: 5,
                        background: "#f1f5f9",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.6rem",
                      }}>{ic}</div>
                      {lb}
                    </div>
                  ))}
                </div>

                <p style={{
                  marginTop: "1.25rem", fontSize: "0.6rem",
                  color: "#b0bbc8", textAlign: "center", lineHeight: 1.75,
                }}>
                  Educational platform only · Not financial advice ·
                  Always do your own research before investing.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
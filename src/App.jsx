import { useMemo, useState, useRef, useEffect, createContext, useContext } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList,
  PieChart, Pie,
  PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

/* ================================================================
   CONFIG
   ================================================================ */
const API_URL = import.meta.env.VITE_API_URL || "";
const BASE_URL = import.meta.env.BASE_URL || "/mores-pulse/";

const EMOTIONS = [
  { key: "Anger",   label: "Anger",   color: "#ff330d" },
  { key: "Fear",    label: "Fear",    color: "#ff6600" },
  { key: "Disgust", label: "Disgust", color: "#e61aff" },
  { key: "Sadness", label: "Sadness", color: "#2680ff" },
  { key: "Joy",     label: "Joy",     color: "#ffcc00" },
  { key: "None",    label: "None",    color: "#808080" },
];

const PRIDE_COLOR = "#6633ff";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hu", label: "Hungarian" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "pl", label: "Polish" },
  { code: "cs", label: "Czech" },
  { code: "sk", label: "Slovak" },
];

const LOADING_MESSAGES = [
  "Examining anger",
  "Disclosing fear",
  "Considering pride",
  "Evaluating the emotional layers of each sentence",
];

/* ================================================================
   THEMES
   ================================================================ */
const THEMES = {
  dark: {
    name: "dark",
    pageBg: "#282828", cardBg: "#303030", headerBg: "#2a2a2a",
    text: "#e4e4e7", text2: "#a1a1aa", text3: "#71717a",
    border: "#3f3f46", grid: "#444", inputBg: "#282828",
    tooltipBg: "#303030", tooltipBorder: "#555",
    heading: "#ffffff", link: "#ffcc00",
  },
  light: {
    name: "light",
    pageBg: "#f5f5f0", cardBg: "#ffffff", headerBg: "#f8f8f6",
    text: "#27272a", text2: "#52525b", text3: "#71717a",
    border: "#d4d4d8", grid: "#e4e4e7", inputBg: "#ffffff",
    tooltipBg: "#ffffff", tooltipBorder: "#d4d4d8",
    heading: "#18181b", link: "#2563eb",
  },
};

const ThemeCtx = createContext(THEMES.dark);
function useTheme() { return useContext(ThemeCtx); }

/* ================================================================
   HELPERS
   ================================================================ */
function hexAlpha(hex, a) {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${a})`;
}

function softStyle(hex) {
  return { background: hexAlpha(hex, 0.12), borderColor: hexAlpha(hex, 0.3), color: hex };
}

function isLightColor(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

function splitSentencesEst(text) {
  if (!text.trim()) return [];
  return text.replace(/\s+/g, " ")
    .split(/(?<=[.!?…])[""''»']?\s+(?=[""„''«']?[A-ZÁÉÍÓÖŐÚÜŰČĎĚŇŘŠŤŽŁŚŹŻÄÖÜ0-9])/u)
    .map((s) => s.trim()).filter(Boolean);
}

function downloadSvg(container, filename) {
  const svg = container?.querySelector("svg");
  if (!svg) return;
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const w = svg.getAttribute("width") || svg.getBoundingClientRect().width;
  const h = svg.getAttribute("height") || svg.getBoundingClientRect().height;
  clone.setAttribute("width", w);
  clone.setAttribute("height", h);
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
  // Add white background for exported SVG
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);
  // Force dark text and line colors for white-background export
  clone.querySelectorAll("text").forEach((t) => {
    if (!t.getAttribute("font-family")) {
      t.setAttribute("font-family", "quasimoda,sans-serif");
    }
    const fill = t.getAttribute("fill") || "";
    // Convert light fills to dark for legibility on white background
    if (fill.match(/^#[a-fA-F0-9]{6}$/)) {
      const h = fill.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      const lum = (r * 299 + g * 587 + b * 114) / 1000;
      if (lum > 160) t.setAttribute("fill", "#333333");
    }
    if (fill === "white" || fill === "#fff" || fill === "#ffffff") t.setAttribute("fill", "#333333");
  });
  // Fix grid/axis lines: make very dark lines slightly lighter, light lines darker
  clone.querySelectorAll("line, path").forEach((el) => {
    const stroke = el.getAttribute("stroke") || "";
    if (stroke === "#444" || stroke === "#3f3f46") el.setAttribute("stroke", "#cccccc");
  });
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = filename + ".svg";
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(rows, filename) {
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const header = Object.keys(rows[0]).map(escape).join(",");
  const body = rows.map((r) => Object.values(r).map(escape).join(",")).join("\n");
  const blob = new Blob([header + "\n" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = filename + ".csv";
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadHeatmapSvg(results, emotions, isDark, filename) {
  if (!results || !results.length) return;
  const n = results.length;
  const labelW = 100, cellH = 32, gap = 4, padX = 20, padY = 20;
  const chartW = Math.max(600, n * 20);
  const totalW = labelW + chartW + padX * 2;
  const totalH = emotions.length * (cellH + gap) - gap + padY * 2 + 40;

  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${totalW} ${totalH}">`;
  svgContent += `<rect width="${totalW}" height="${totalH}" fill="#ffffff"/>`;

  emotions.forEach((e, row) => {
    const y = padY + row * (cellH + gap);
    // Label
    svgContent += `<text x="${labelW - 4}" y="${y + cellH / 2 + 4}" text-anchor="end" font-size="11" font-family="quasimoda,sans-serif" fill="#333333">${e.label}</text>`;
    // Cells
    const cellW = chartW / n;
    results.forEach((r, i) => {
      const v = r.probs[e.key] || 0;
      const h = e.color.replace("#", "");
      const cr = parseInt(h.slice(0, 2), 16), cg = parseInt(h.slice(2, 4), 16), cb = parseInt(h.slice(4, 6), 16);
      const a = 0.08 + v * 0.92;
      svgContent += `<rect x="${labelW + padX + i * cellW}" y="${y}" width="${cellW + 0.5}" height="${cellH}" fill="rgba(${cr},${cg},${cb},${a})"/>`;
    });
  });

  // Sentence numbers
  const tickY = padY + emotions.length * (cellH + gap) + 12;
  const tickCount = Math.min(6, n);
  for (let ti = 0; ti < tickCount; ti++) {
    const idx = Math.round((ti * (n - 1)) / Math.max(tickCount - 1, 1));
    const x = labelW + padX + (idx / n) * chartW + (chartW / n) / 2;
    svgContent += `<text x="${x}" y="${tickY}" text-anchor="middle" font-size="10" font-family="quasimoda,sans-serif" fill="#555555">#${idx + 1}</text>`;
  }

  svgContent += `</svg>`;
  const blob = new Blob([svgContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = filename + ".svg";
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

/* ================================================================
   UI PRIMITIVES
   ================================================================ */
function Card({ children, className = "", style: extra = {} }) {
  const t = useTheme();
  return (
    <div className={className} style={{ border: `1px solid ${t.border}`, background: t.cardBg, ...extra }}>
      {children}
    </div>
  );
}

function CardHeader({ label, title, subtitle, right, onDownload }) {
  const t = useTheme();
  return (
    <div className="flex items-start justify-between gap-4 px-6 py-5" style={{ borderBottom: `1px solid ${t.border}` }}>
      <div>
        {label && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: t.text3 }}>
            {label}
          </p>
        )}
        {title && (
          <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight" style={{ color: t.text }}>
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="mt-1 text-[12px] font-light" style={{ color: t.text2 }}>{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right}
        {onDownload && (
          <button onClick={onDownload} className="p-1.5 opacity-50 transition hover:opacity-100" style={{ color: t.text2 }} title="Download">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function Pill({ children, style: s = {}, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 border px-2.5 py-0.5 text-[11px] font-medium ${className}`} style={s}>
      {children}
    </span>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */
export default function App() {
  const [text, setText] = useState(
    "The new policy is outrageous and disgusting. Many citizens feel afraid and sad about the future. Still, there is a small sense of joy and pride in the community as people come together to help one another."
  );
  const [language, setLanguage] = useState("en");
  const [includePride, setIncludePride] = useState(true);
  const [results, setResults] = useState(null);
  const [prideResults, setPrideResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDark, setIsDark] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);

  const theme = isDark ? THEMES.dark : THEMES.light;
  const resultsRef = useRef(null);
  const loadingRef = useRef(null);
  const chartRefs = useRef({});

  // Sync body background and color-scheme with theme
  useEffect(() => {
    document.body.style.background = theme.pageBg;
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [theme.pageBg, isDark]);

  // Loading message rotation
  useEffect(() => {
    if (!loading) return;
    let i = 0;
    const iv = setInterval(() => {
      i = (i + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[i]);
    }, 2200);
    return () => clearInterval(iv);
  }, [loading]);

  // Auto-scroll to loading indicator
  useEffect(() => {
    if (loading && loadingRef.current) {
      loadingRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading]);

  // Auto-scroll to results
  useEffect(() => {
    if (results && results.length > 0 && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [results]);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    setResults(null);
    setPrideResults(null);
    try {
      if (!API_URL) throw new Error("Backend URL is not configured. Set VITE_API_URL.");
      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language, include_pride: includePride }),
      });
      if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      // Filter results to only the 6 base emotions
      const VALID_KEYS = new Set(EMOTIONS.map((e) => e.key));
      const filtered = (data.sentences || []).map((r) => {
        const probs = {};
        for (const [k, v] of Object.entries(r.probs)) {
          if (VALID_KEYS.has(k)) probs[k] = v;
        }
        const ranked = Object.entries(probs).sort((a, b) => b[1] - a[1]);
        return {
          ...r,
          probs,
          top1: ranked[0] ? { label: ranked[0][0], conf: ranked[0][1] } : r.top1,
          top2: ranked[1] ? { label: ranked[1][0], conf: ranked[1][1] } : r.top2,
        };
      });
      setResults(filtered);
      setPrideResults(data.pride || null);
      if (typeof window !== "undefined" && window.umami) {
        window.umami.track("analyze", { language, include_pride: includePride, sentences: data.sentences?.length || 0 });
      }
    } catch (e) {
      console.error(e);
      setError(
        e.message.includes("Failed to fetch")
          ? "Cannot reach the backend. It may be warming up — try again in 10–30 seconds."
          : e.message
      );
    } finally {
      setLoading(false);
    }
  }

  // ---- Derived data ----

  const overview = useMemo(() => {
    if (!results) return [];
    const agg = {};
    EMOTIONS.forEach((e) => (agg[e.key] = 0));
    results.forEach((r) => {
      for (const [k, v] of Object.entries(r.probs)) if (k in agg) agg[k] += v;
    });
    const n = Math.max(results.length, 1);
    return EMOTIONS.map((e) => ({
      emotion: e.label,
      pct: +((agg[e.key] || 0) / n * 100).toFixed(1),
      color: e.color,
    }));
  }, [results]);

  const dominantCounts = useMemo(() => {
    if (!results || !results.length) return [];
    const counts = {};
    EMOTIONS.forEach((e) => (counts[e.key] = 0));
    results.forEach((r) => {
      if (r.top1.label in counts) counts[r.top1.label]++;
    });
    return EMOTIONS.map((e) => ({
      emotion: e.label,
      count: counts[e.key],
      color: e.color,
      pct: ((counts[e.key] / results.length) * 100).toFixed(1),
    })).filter((d) => d.count > 0);
  }, [results]);

  const confStats = useMemo(() => {
    if (!results || !results.length) return null;
    const confs = results.map((r) => r.top1.conf).sort((a, b) => a - b);
    const mid = Math.floor(confs.length / 2);
    const median = confs.length % 2 ? confs[mid] : (confs[mid - 1] + confs[mid]) / 2;
    const high = results.filter((r) => r.top1.conf >= 0.8).length;
    const level = median >= 0.7 ? "High" : median >= 0.4 ? "Moderate" : "Low";
    return { median, high, level, n: results.length };
  }, [results]);

  const prideStats = useMemo(() => {
    if (!prideResults || !prideResults.length) return null;
    const avg = prideResults.reduce((s, r) => s + r.pride, 0) / prideResults.length;
    const max = prideResults.reduce(
      (best, r, i) => (r.pride > best.pride ? { ...r, idx: i } : best),
      { pride: -1, sentence: "", dominant: "", idx: -1 }
    );
    const high = prideResults.filter((r) => r.pride >= 0.5).length;
    return { avg, max, high, n: prideResults.length };
  }, [prideResults]);

  const setChartRef = (name) => (el) => { chartRefs.current[name] = el; };

  // ---- Render ----

  return (
    <ThemeCtx.Provider value={theme}>
      {/* Global font override — ensures Quasimoda on every element */}
      <style>{`*, *::before, *::after { font-family: quasimoda, sans-serif !important; }`}</style>
      <div
        className="min-h-screen px-6 py-10 antialiased"
        style={{ background: theme.pageBg, color: theme.text }}
      >
        <div className="mx-auto max-w-6xl">

          {/* ---- Editorial header ---- */}
          <div className="mb-10 pb-8" style={{ borderBottom: `1px solid ${theme.border}` }}>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em]" style={{ color: theme.text3 }}>
                Emotion Analysis
              </p>
              <button
                onClick={() => setIsDark((d) => !d)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition hover:opacity-80"
                style={{ border: `1px solid ${theme.border}`, color: theme.text2 }}
              >
                {isDark ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                    Day mode
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    Night mode
                  </>
                )}
              </button>
            </div>

            <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl" style={{ color: theme.heading }}>
              MORES <span style={{ color: "#ffcc00" }}>Pulse</span> AI
            </h1>

            <p className="mt-4 text-sm leading-relaxed" style={{ color: theme.text2 }}>
              MORES Pulse reads any text for emotional content, sentence by sentence.
              It detects five emotions &mdash;{" "}
              <span style={{ color: theme.text }}>anger</span>,{" "}
              <span style={{ color: theme.text }}>fear</span>,{" "}
              <span style={{ color: theme.text }}>disgust</span>,{" "}
              <span style={{ color: theme.text }}>sadness</span>, and{" "}
              <span style={{ color: theme.text }}>joy</span>{" "}
              &mdash; and identifies sentences that carry none of these emotions.
              Analysis runs in Czech, English, French, German, Hungarian, Polish, and Slovak.
              Short texts return results within seconds; longer ones may take up to a few minutes.
            </p>

            <p className="mt-3 text-sm leading-relaxed" style={{ color: theme.text2 }}>
              <span className="font-medium" style={{ color: theme.text }}>Pride</span> is detected by an{" "}
              <a href="https://huggingface.co/MORES-horizon/MORES_emotions9" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: theme.link }}>
                extended model
              </a>.
              {" "}It appears as its own result and does not change the main analysis.
            </p>

            <p className="mt-3 text-sm leading-relaxed" style={{ color: theme.text2 }}>
              Questions about how MORES Pulse works? Read the{" "}
              <a href={BASE_URL + "MORES_Pulse_Q_and_A.pdf"} target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: theme.link }}>Q&A</a>.
              {" "}For the full technical specification, see the{" "}
              <a href={BASE_URL + "Emotion_codebook_7.pdf"} target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: theme.link }}>codebook</a>.
              {" "}Use the model{" "}
              <a href="https://huggingface.co/MORES-horizon/MORESPulse" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: theme.link }}>API</a>.
            </p>
          </div>

          {/* ---- Input card ---- */}
          <Card className="mb-6">
            <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-[1fr_260px]">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: theme.text3 }}>
                    Input text
                  </label>
                  <button
                    onClick={() => setExpanded((x) => !x)}
                    className="text-[10px] font-medium transition hover:opacity-80"
                    style={{ color: theme.text2 }}
                  >
                    {expanded ? "▲ Collapse" : "▼ Expand"}
                  </button>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={expanded ? 20 : 5}
                  placeholder="Enter your text here..."
                  className="w-full resize-y px-4 py-3 text-sm leading-relaxed outline-none transition placeholder:text-zinc-500"
                  style={{ border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text }}
                />
                <p className="mt-2 text-[11px] font-light" style={{ color: theme.text3 }}>
                  {text.trim().length} characters &middot; ~{splitSentencesEst(text).length} sentences detected
                </p>
              </div>

              <div className="flex flex-col justify-between gap-3">
                <div>
                  <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: theme.text3 }}>
                    Language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm outline-none"
                    style={{ border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text }}
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>{l.label}</option>
                    ))}
                  </select>
                </div>

                <label
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs"
                  style={{ border: `1px solid ${theme.border}`, background: theme.inputBg, color: theme.text2 }}
                >
                  <input
                    type="checkbox"
                    checked={includePride}
                    onChange={(e) => setIncludePride(e.target.checked)}
                    className="h-3.5 w-3.5"
                    style={{ accentColor: PRIDE_COLOR }}
                  />
                  <span>
                    Run <span className="font-semibold" style={{ color: PRIDE_COLOR }}>Pride detection</span> pass
                  </span>
                </label>

                <button
                  onClick={runAnalysis}
                  disabled={loading || !text.trim()}
                  className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider transition disabled:cursor-not-allowed"
                  style={{
                    background: loading ? theme.border : "#ffcc00",
                    color: loading ? theme.text3 : "#18181b",
                  }}
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                      Analysing&hellip;
                    </>
                  ) : (
                    "Analyse text →"
                  )}
                </button>
              </div>
            </div>
          </Card>

          {/* Error */}
          {error && (
            <Card className="mb-6" style={{ borderColor: hexAlpha("#ff3300", 0.4), background: hexAlpha("#ff3300", 0.1) }}>
              <p className="p-4 text-sm" style={{ color: "#ff3300" }}>{error}</p>
            </Card>
          )}

          {/* Emotion legend */}
          <div className="mb-6 flex flex-wrap gap-2">
            {EMOTIONS.map((e) => (
              <Pill key={e.key} style={softStyle(e.color)}>
                <span className="h-2 w-2" style={{ background: e.color }} />
                {e.label}
              </Pill>
            ))}
          </div>

          {/* Empty state */}
          {!results && !loading && !error && (
            <Card className="p-10 text-center">
              <p className="text-sm font-light" style={{ color: theme.text2 }}>
                Enter a text above and press{" "}
                <span className="font-semibold" style={{ color: "#ffcc00" }}>Analyse text</span>{" "}
                to see the emotion breakdown.
              </p>
            </Card>
          )}

          {/* Loading state */}
          {loading && (
            <div ref={loadingRef}>
              <Card className="p-10 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="h-8 w-8 animate-spin rounded-full"
                    style={{ border: `3px solid ${hexAlpha("#ffcc00", 0.2)}`, borderTopColor: "#ffcc00" }}
                  />
                  <p className="text-sm font-light animate-pulse" style={{ color: theme.text2 }}>
                    {loadingMsg}&hellip;
                  </p>
                </div>
              </Card>
            </div>
          )}

          {/* ---- Results ---- */}
          {results && results.length > 0 && (
            <div ref={resultsRef} className="grid grid-cols-1 gap-6 lg:grid-cols-2">

              {/* CHART 01 — Bar: what emotions the text is made of */}
              <Card>
                <CardHeader
                  label="01"
                  title="What emotions the text is made of"
                  subtitle="How strongly each emotion registers, averaged across all sentences (%)"
                  onDownload={() => downloadSvg(chartRefs.current.bar, "emotion-overview")}
                />
                <div className="p-4" ref={setChartRef("bar")}>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={overview} margin={{ top: 28, right: 8, left: -8, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} vertical={false} />
                        <XAxis dataKey="emotion" tick={false} axisLine={false} tickLine={false} height={5} />
                        <YAxis tick={{ fontSize: 10, fill: theme.text3, fontFamily: "quasimoda,sans-serif" }} axisLine={false} tickLine={false} domain={[0, "auto"]} />
                        <Tooltip
                          cursor={{ fill: hexAlpha("#ffcc00", 0.06) }}
                          contentStyle={{ border: `1px solid ${theme.tooltipBorder}`, background: theme.tooltipBg, fontSize: 12, color: theme.text, fontFamily: "quasimoda,sans-serif" }}
                          itemStyle={{ color: theme.text }}
                          labelStyle={{ color: theme.text2 }}
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload[0]) return null;
                            const d = payload[0].payload;
                            const count = dominantCounts.find((dc) => dc.emotion === d.emotion)?.count || 0;
                            return (
                              <div style={{ border: `1px solid ${theme.tooltipBorder}`, background: theme.tooltipBg, padding: "8px 12px", fontFamily: "quasimoda,sans-serif" }}>
                                <p style={{ color: theme.text, fontSize: 12, fontWeight: 600, margin: 0 }}>{d.emotion}:</p>
                                <p style={{ color: theme.text2, fontSize: 12, margin: "2px 0 0" }}>{count} sentence{count !== 1 ? "s" : ""}</p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="pct" radius={0}>
                          {overview.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                          <LabelList
                            content={({ x, y, width, height, value, index }) => {
                              const d = overview[index];
                              if (!d) return null;
                              const cx = x + width / 2;
                              const inBarFill = isLightColor(d.color) ? "#333333" : "white";
                              const inBarFill2 = isLightColor(d.color) ? "rgba(51,51,51,0.75)" : "rgba(255,255,255,0.85)";
                              if (height > 48) {
                                return (
                                  <g>
                                    <text x={cx} y={y + height / 2 - 8} fill={inBarFill} textAnchor="middle" fontSize={11} fontWeight={700} fontFamily="quasimoda,sans-serif">
                                      {d.emotion}
                                    </text>
                                    <text x={cx} y={y + height / 2 + 10} fill={inBarFill2} textAnchor="middle" fontSize={10} fontFamily="quasimoda,sans-serif">
                                      {value.toFixed(1)}
                                    </text>
                                  </g>
                                );
                              }
                              return (
                                <g>
                                  <text x={cx} y={y - 14} fill={theme.text2} textAnchor="middle" fontSize={10} fontWeight={600} fontFamily="quasimoda,sans-serif">
                                    {d.emotion}
                                  </text>
                                  <text x={cx} y={y - 3} fill={theme.text3} textAnchor="middle" fontSize={9} fontFamily="quasimoda,sans-serif">
                                    {value.toFixed(1)}
                                  </text>
                                </g>
                              );
                            }}
                          />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>

              {/* 02 — Analysis confidence summary */}
              {confStats && (
                <Card>
                  <CardHeader
                    label="02"
                    title="Analysis confidence"
                    subtitle="How certain the model is across the entire text"
                  />
                  <div className="flex flex-col gap-4 p-6">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: theme.text3 }}>
                        Median confidence
                      </p>
                      <p className="mt-1 text-4xl font-bold" style={{ color: theme.text }}>
                        {(confStats.median * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: theme.text3 }}>
                        Strong predictions (&ge; 80%)
                      </p>
                      <p className="mt-1 text-2xl font-bold" style={{ color: theme.text }}>
                        {confStats.high}{" "}
                        <span className="text-sm font-normal" style={{ color: theme.text2 }}>
                          of {confStats.n}
                        </span>
                      </p>
                    </div>
                    <div
                      className="px-3 py-2"
                      style={{
                        border: `1px solid ${confStats.level === "High" ? "#22c55e" : confStats.level === "Moderate" ? "#eab308" : "#ef4444"}`,
                        background: confStats.level === "High" ? "rgba(34,197,94,0.08)" : confStats.level === "Moderate" ? "rgba(234,179,8,0.08)" : "rgba(239,68,68,0.08)",
                      }}
                    >
                      <p
                        className="text-sm font-semibold"
                        style={{ color: confStats.level === "High" ? "#22c55e" : confStats.level === "Moderate" ? "#eab308" : "#ef4444" }}
                      >
                        {confStats.level} confidence
                      </p>
                      <p className="mt-0.5 text-[11px]" style={{ color: theme.text2 }}>
                        {confStats.level === "High"
                          ? "The model is confident in its predictions."
                          : confStats.level === "Moderate"
                            ? "Some sentences may benefit from review."
                            : "Results should be interpreted with caution."}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* CHART 03 — Radar: emotional signature */}
              <Card>
                <CardHeader
                  label="03"
                  title="Emotional signature"
                  subtitle="The pattern formed by all five emotions together — each text produces a unique shape (%)"
                  onDownload={() => downloadSvg(chartRefs.current.radar, "emotional-signature")}
                />
                <div className="p-6" ref={setChartRef("radar")}>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={overview} outerRadius="70%" margin={{ top: 25, right: 40, bottom: 25, left: 40 }}>
                        <PolarGrid stroke={theme.grid} />
                        <PolarAngleAxis
                          dataKey="emotion"
                          tick={({ x, y, cx, cy, payload, index, textAnchor }) => {
                            const d = overview[index];
                            const maxVal = Math.max(...overview.map((o) => o.pct));
                            const isBold = d && d.pct === maxVal && maxVal > 0;
                            // Push label further from center
                            const dx = (x - cx) * 0.15;
                            const dy = (y - cy) * 0.15;
                            return (
                              <text
                                x={x + dx} y={y + dy}
                                textAnchor={textAnchor}
                                fontSize={isBold ? 11 : 10}
                                fontWeight={isBold ? 700 : 400}
                                fill={isBold ? d.color : theme.text2}
                                fontFamily="quasimoda,sans-serif"
                              >
                                {payload.value}
                              </text>
                            );
                          }}
                        />
                        <PolarRadiusAxis
                          angle={90}
                          axisLine={false}
                          tick={({ x, y, payload }) => {
                            if (payload.value === 0) return null;
                            return (
                              <text
                                x={x + 12} y={y}
                                fontSize={9}
                                fill={theme.text3}
                                fontFamily="quasimoda,sans-serif"
                                textAnchor="start"
                                dominantBaseline="middle"
                              >
                                {payload.value}
                              </text>
                            );
                          }}
                        />
                        <Radar dataKey="pct" stroke="#ffcc00" fill="#ffcc00" fillOpacity={0.18} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>

              {/* CHART 04 — Pie: emotional tone (dominant counts) */}
              <Card>
                <CardHeader
                  label="04"
                  title="Emotional tone"
                  subtitle="How many sentences each emotion dominates — the overall tone of the text"
                  onDownload={() => downloadSvg(chartRefs.current.pie, "emotional-tone")}
                />
                <div className="p-4" ref={setChartRef("pie")}>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dominantCounts}
                          dataKey="count"
                          nameKey="emotion"
                          cx="50%" cy="50%"
                          innerRadius={45}
                          outerRadius={85}
                          label={({ cx: pcx, cy: pcy, midAngle, outerRadius: or, emotion, count }) => {
                            const RADIAN = Math.PI / 180;
                            const radius = or + 22;
                            const x = pcx + radius * Math.cos(-midAngle * RADIAN);
                            const y = pcy + radius * Math.sin(-midAngle * RADIAN);
                            return (
                              <text
                                x={x} y={y}
                                fill={theme.text}
                                textAnchor={x > pcx ? "start" : "end"}
                                dominantBaseline="central"
                                fontSize={10}
                                fontFamily="quasimoda,sans-serif"
                              >
                                {emotion} ({count})
                              </text>
                            );
                          }}
                          labelLine={{ stroke: theme.text3 }}
                        >
                          {dominantCounts.map((d, i) => (
                            <Cell key={i} fill={d.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ border: `1px solid ${theme.tooltipBorder}`, background: theme.tooltipBg, fontSize: 12, color: theme.text, fontFamily: "quasimoda,sans-serif" }}
                          itemStyle={{ color: theme.text }}
                          labelStyle={{ color: theme.text2 }}
                          formatter={(v, name, _props, _idx, payload) => {
                            const pct = payload && payload.pct ? payload.pct : ((v / results.length) * 100).toFixed(1);
                            return [`${pct}% (${v} sentence${v !== 1 ? "s" : ""})`, name];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Card>

              {/* CHART 05 — Sentence view */}
              <Card className="lg:col-span-2">
                <CardHeader
                  label="05"
                  title="The text, read emotionally"
                  subtitle="Each sentence carries one dominant emotion. Model confidence transparently shown alongside"
                  onDownload={() => downloadCsv(results.map((r, i) => ({ "#": i + 1, Sentence: r.sentence, Emotion: r.top1.label, "Confidence (%)": (r.top1.conf * 100).toFixed(1), "2nd Emotion": r.top2.label, "2nd Conf (%)": (r.top2.conf * 100).toFixed(1) })), "sentences-emotional")}
                />
                <div className="space-y-2 p-6">
                  {results.map((r, i) => {
                    const em = EMOTIONS.find((x) => x.key === r.top1.label) || EMOTIONS[5];
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-3 px-4 py-3 text-sm leading-relaxed transition"
                        style={{ ...softStyle(em.color), border: `1px solid ${hexAlpha(em.color, 0.3)}` }}
                      >
                        <span
                          className="mt-0.5 flex h-6 shrink-0 items-center justify-center px-2 text-[10px] font-bold uppercase tracking-[0.15em]"
                          style={{ background: em.color, color: "#18181b" }}
                        >
                          {em.label}
                        </span>
                        <p className="flex-1" style={{ color: theme.text }}>{r.sentence}</p>
                        <span className="shrink-0 text-[11px] tabular-nums" style={{ color: theme.text2 }}>
                          {(r.top1.conf * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* CHART 06 — Table: the full breakdown */}
              <Card className="lg:col-span-2">
                <CardHeader
                  label="06"
                  title="The full breakdown"
                  subtitle="Two emotions per sentence, ranked by strength, with confidence scores (%)"
                  onDownload={() => downloadCsv(results.map((r, i) => ({ "#": i + 1, Sentence: r.sentence, "Prediction 1": r.top1.label, "Conf 1 (%)": (r.top1.conf * 100).toFixed(1), "Prediction 2": r.top2.label, "Conf 2 (%)": (r.top2.conf * 100).toFixed(1) })), "full-breakdown")}
                />
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead
                      className="text-left text-[10px] font-semibold uppercase tracking-[0.18em]"
                      style={{ background: theme.headerBg, color: theme.text3, borderBottom: `1px solid ${theme.border}` }}
                    >
                      <tr>
                        <th className="px-5 py-3">Sentence</th>
                        <th className="px-5 py-3">Prediction 1</th>
                        <th className="px-5 py-3">Conf.</th>
                        <th className="px-5 py-3">Prediction 2</th>
                        <th className="px-5 py-3">Conf.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((r, i) => {
                        const e1 = EMOTIONS.find((x) => x.key === r.top1.label);
                        const e2 = EMOTIONS.find((x) => x.key === r.top2.label);
                        return (
                          <tr key={i} style={{ borderBottom: `1px solid ${hexAlpha(theme.border, 0.5)}` }}>
                            <td className="max-w-xl px-5 py-3" style={{ color: theme.text2 }}>{r.sentence}</td>
                            <td className="px-5 py-3">
                              <Pill style={softStyle(e1?.color || "#808080")}>
                                <span className="h-2 w-2" style={{ background: e1?.color }} />
                                {r.top1.label}
                              </Pill>
                            </td>
                            <td className="px-5 py-3 tabular-nums" style={{ color: theme.text3 }}>
                              {(r.top1.conf * 100).toFixed(1)}%
                            </td>
                            <td className="px-5 py-3">
                              <Pill style={softStyle(e2?.color || "#808080")}>
                                <span className="h-2 w-2" style={{ background: e2?.color }} />
                                {r.top2.label}
                              </Pill>
                            </td>
                            <td className="px-5 py-3 tabular-nums" style={{ color: theme.text3 }}>
                              {(r.top2.conf * 100).toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* CHART 07 — Heatmap: the emotional arc */}
              <Card className="lg:col-span-2">
                <CardHeader
                  label="07"
                  title="The emotional arc"
                  subtitle="Each column is one sentence, left to right. Colour depth shows emotional intensity. Hover for the exact figure (%)"
                  onDownload={() => downloadHeatmapSvg(results, EMOTIONS, isDark, "emotional-arc")}
                />
                <div ref={setChartRef("heatmap")}>
                  <RibbonHeatmap results={results} emotions={EMOTIONS} />
                </div>
              </Card>

              {/* CHART 08 — Pride: a separate layer */}
              {includePride && prideResults && prideResults.length > 0 && (
                <Card
                  className="lg:col-span-2"
                  style={{
                    borderColor: hexAlpha(PRIDE_COLOR, 0.3),
                    background: isDark
                      ? "linear-gradient(135deg, #303030, #2a2040)"
                      : "linear-gradient(135deg, #ffffff, #f0ecff)",
                  }}
                >
                  <CardHeader
                    label={<span style={{ color: PRIDE_COLOR }}>08 &middot; Extended</span>}
                    title={
                      <span className="inline-flex items-center gap-2" style={{ color: theme.text }}>
                        <span
                          className="h-2.5 w-2.5"
                          style={{ background: PRIDE_COLOR, boxShadow: `0 0 10px ${hexAlpha(PRIDE_COLOR, 0.6)}` }}
                        />
                        Pride: a separate layer
                      </span>
                    }
                    subtitle="Detected by our extended model, pride adds to the picture — it does not change the results above"
                    onDownload={() => downloadCsv(prideResults.map((r, i) => ({ "#": i + 1, Sentence: r.sentence, "Pride (%)": (r.pride * 100).toFixed(1) })), "pride-analysis")}
                  />
                  <PrideCard prideResults={prideResults} prideStats={prideStats} />
                </Card>
              )}
            </div>
          )}

          {results && results.length === 0 && (
            <Card className="p-6 text-center">
              <p className="text-sm font-light" style={{ color: theme.text2 }}>
                No sentences detected in the input.
              </p>
            </Card>
          )}

          {/* Footer */}
          <div className="mt-12 pt-6 text-center" style={{ borderTop: `1px solid ${theme.border}` }}>
            <p className="text-xs font-light leading-relaxed" style={{ color: theme.text2 }}>
              This research was funded by the European Union under grant agreement No. 101132601
              (<a href="https://mores-horizon.eu/" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: theme.link }}>MORES</a> &ndash; Moral emotions in politics &ndash; How they unite, How they divide).
            </p>
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

/* ================================================================
   RIBBON HEATMAP
   ================================================================ */
function RibbonHeatmap({ results, emotions }) {
  const theme = useTheme();
  const isDark = theme.name === "dark";
  const [hover, setHover] = useState(null);
  const n = results.length;
  if (!n) return null;

  const tickCount = Math.min(6, n);
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    Math.round((i * (n - 1)) / Math.max(tickCount - 1, 1))
  );

  return (
    <div className="relative p-6">
      <div className="space-y-2">
        {emotions.map((e) => (
          <div key={e.key} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-right text-[11px] font-medium" style={{ color: theme.text2 }}>
              {e.label}
            </div>
            <div
              className="relative h-9 flex-1 overflow-hidden"
              style={{ background: theme.pageBg, boxShadow: `inset 0 0 0 1px ${theme.border}` }}
              onMouseLeave={() => setHover(null)}
            >
              {results.map((r, i) => {
                const v = r.probs[e.key] || 0;
                return (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 cursor-pointer transition-[filter] hover:brightness-125"
                    style={{
                      left: `${(i / n) * 100}%`,
                      width: `${100 / n + 0.3}%`,
                      background: hexAlpha(e.color, 0.08 + v * 0.92),
                    }}
                    onMouseMove={(ev) => {
                      const rect = ev.currentTarget.parentElement.getBoundingClientRect();
                      setHover({ emotionKey: e.key, sentenceIdx: i, x: ev.clientX - rect.left });
                    }}
                  />
                );
              })}
              {hover?.emotionKey === e.key && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 w-px"
                  style={{
                    left: `${((hover.sentenceIdx + 0.5) / n) * 100}%`,
                    background: hexAlpha("#ffcc00", 0.7),
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tick marks */}
      <div className="relative mt-2 ml-[6.75rem] h-5 text-[10px] tabular-nums" style={{ color: theme.text3 }}>
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute -translate-x-1/2"
            style={{ left: `${(t / Math.max(n - 1, 1)) * 100}%` }}
          >
            #{t + 1}
          </span>
        ))}
      </div>

      {/* Gradient legend */}
      <div className="mt-4 flex items-center gap-3 pl-[6.75rem]">
        <span className="text-[10px] tabular-nums" style={{ color: theme.text3 }}>0%</span>
        <div
          className="h-2 flex-1"
          style={{
            background: isDark
              ? "linear-gradient(90deg, #333, #665500, #aa8800, #ffcc00)"
              : "linear-gradient(90deg, #e5e5e0, #ccaa44, #aa8800, #ffcc00)",
            boxShadow: `inset 0 0 0 1px ${theme.border}`,
          }}
        />
        <span className="text-[10px] tabular-nums" style={{ color: theme.text3 }}>100%</span>
      </div>

      {hover && (
        <FloatingTooltip
          result={results[hover.sentenceIdx]}
          emotionKey={hover.emotionKey}
          emotions={emotions}
          x={hover.x + 108}
        />
      )}
    </div>
  );
}

function FloatingTooltip({ result, emotionKey, emotions, x }) {
  const theme = useTheme();
  const em = emotions.find((e) => e.key === emotionKey);
  if (!em) return null;
  const v = result.probs[emotionKey] || 0;
  const snippet = result.sentence.length > 90 ? result.sentence.slice(0, 90) + "…" : result.sentence;
  return (
    <div
      className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 px-3 py-2 text-xs shadow-xl shadow-black/40"
      style={{ left: x, top: -4, border: `1px solid ${theme.tooltipBorder}`, background: theme.tooltipBg }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5" style={{ color: theme.text }}>
          <span className="h-2 w-2" style={{ background: em.color }} />
          <span className="font-semibold">{em.label}</span>
        </span>
        <span className="text-[11px] tabular-nums" style={{ color: theme.text2 }}>
          {(v * 100).toFixed(1)}%
        </span>
      </div>
      <div className="text-[11px] font-light leading-snug" style={{ color: theme.text2 }}>
        {snippet}
      </div>
    </div>
  );
}

/* ================================================================
   PRIDE CARD
   ================================================================ */
function PrideCard({ prideResults, prideStats }) {
  const theme = useTheme();
  const max = prideStats?.max;

  return (
    <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-[280px_1fr]">
      {/* Summary stats */}
      <div className="flex flex-col gap-3">
        <div className="p-4" style={{ border: `1px solid ${hexAlpha(PRIDE_COLOR, 0.4)}`, background: hexAlpha(PRIDE_COLOR, 0.1) }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: "#b399ff" }}>
            Pride intensity
          </p>
          <p className="mt-1 text-4xl font-bold" style={{ color: "#b399ff" }}>
            {(prideStats.avg * 100).toFixed(1)}%
          </p>
          <p className="mt-1 text-[11px] font-light" style={{ color: "#9a7fdb" }}>
            average pride signal across {prideStats.n} sentence{prideStats.n !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="p-4" style={{ border: `1px solid ${theme.border}`, background: theme.pageBg }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: theme.text3 }}>
            Sentences with strong pride
          </p>
          <p className="mt-1 text-4xl font-bold" style={{ color: theme.text }}>
            {prideStats.high}
          </p>
          <p className="mt-1 text-[11px] font-light" style={{ color: theme.text3 }}>
            pride probability &ge; 50% &middot; out of {prideStats.n}
          </p>
        </div>

        {max && max.idx >= 0 && (
          <div className="p-4" style={{ border: `1px solid ${theme.border}`, background: theme.pageBg }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: theme.text3 }}>
              Top pride sentence
            </p>
            <p className="mt-1.5 text-sm font-medium break-words" style={{ color: theme.text }}>
              {max.sentence.length > 140 ? max.sentence.slice(0, 140) + "…" : max.sentence}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <Pill style={softStyle(PRIDE_COLOR)}>
                <span className="h-2 w-2" style={{ background: PRIDE_COLOR }} />
                {(max.pride * 100).toFixed(1)}%
              </Pill>
            </div>
          </div>
        )}
      </div>

      {/* Per-sentence pride bars */}
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: theme.text3 }}>
            Per-sentence pride intensity
          </p>
          <p className="text-[10px] tabular-nums" style={{ color: theme.text3 }}>0% &rarr; 100%</p>
        </div>
        <div className="space-y-1.5">
          {prideResults.map((r, i) => {
            const pct = Math.round(r.pride * 100);
            return (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2 transition"
                style={{ border: `1px solid ${theme.border}`, background: theme.pageBg }}
                title={r.sentence}
              >
                <span className="w-6 shrink-0 text-right text-[10px] tabular-nums" style={{ color: theme.text3 }}>
                  #{i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: theme.text }}>
                  {r.sentence}
                </span>
                <div className="relative h-1.5 w-32 shrink-0 overflow-hidden" style={{ background: theme.border }}>
                  <div
                    className="absolute left-0 top-0 bottom-0"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${hexAlpha(PRIDE_COLOR, 0.4)}, ${PRIDE_COLOR})`,
                      boxShadow: `0 0 8px ${hexAlpha(PRIDE_COLOR, 0.6)}`,
                    }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-[11px] tabular-nums" style={{ color: theme.text3 }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

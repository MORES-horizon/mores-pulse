import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";

// ---- Config ----------------------------------------------------------------
// MORES visual identity — colours from official brand guide, Quasimoda font.
const API_URL = import.meta.env.VITE_API_URL || "";

const EMOTIONS = [
  { key: "Anger",   label: "Anger",   color: "#ff330d" },
  { key: "Fear",    label: "Fear",    color: "#ff6600" },
  { key: "Disgust", label: "Disgust", color: "#e61aff" },
  { key: "Sadness", label: "Sadness", color: "#2680ff" },
  { key: "Joy",     label: "Joy",     color: "#ffcc00" },
  { key: "None",    label: "None",    color: "#808080" },
];
const PRIDE_STYLE = { color: "#6633ff" };

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hu", label: "Hungarian" },
  { code: "de", label: "German" },
  { code: "fr", label: "French" },
  { code: "pl", label: "Polish" },
  { code: "cs", label: "Czech" },
  { code: "sk", label: "Slovak" },
];

function splitSentencesClientEstimate(text) {
  if (!text.trim()) return [];
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÖŐÚÜŰ0-9])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---- Helpers ---------------------------------------------------------------
function hexWithAlpha(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function softStyle(hex) {
  return {
    background: hexWithAlpha(hex, 0.12),
    borderColor: hexWithAlpha(hex, 0.3),
    color: hex,
  };
}

// ---- UI primitives ---------------------------------------------------------
function Card({ children, className = "" }) {
  return (
    <div className={`border border-zinc-700 bg-[#303030] ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ label, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-700 px-6 py-5">
      <div>
        {label && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            {label}
          </p>
        )}
        {title && (
          <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight text-zinc-100">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="mt-1 text-[12px] font-light text-zinc-400">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

function Pill({ children, style: pillStyle = {}, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2.5 py-0.5 text-[11px] font-medium ${className}`}
      style={pillStyle}
    >
      {children}
    </span>
  );
}

// ---- Main component --------------------------------------------------------
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

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      if (!API_URL) {
        throw new Error("Backend URL is not configured. Set VITE_API_URL in your environment.");
      }
      const res = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language, include_pride: includePride }),
      });
      if (!res.ok) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setResults(data.sentences || []);
      setPrideResults(data.pride || null);

      if (typeof window !== "undefined" && window.umami) {
        window.umami.track("analyze", {
          language,
          include_pride: includePride,
          sentences: data.sentences?.length || 0,
        });
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

  const overview = useMemo(() => {
    if (!results) return [];
    const agg = {};
    EMOTIONS.forEach((e) => (agg[e.key] = 0));
    results.forEach((r) => {
      for (const [k, v] of Object.entries(r.probs)) {
        if (k in agg) agg[k] += v;
      }
    });
    const n = Math.max(results.length, 1);
    return EMOTIONS.map((e) => ({
      emotion: e.label,
      value: +((agg[e.key] || 0) / n).toFixed(3),
      color: e.color,
    }));
  }, [results]);

  const prideStats = useMemo(() => {
    if (!prideResults || prideResults.length === 0) return null;
    const avg = prideResults.reduce((s, r) => s + r.pride, 0) / prideResults.length;
    const max = prideResults.reduce(
      (best, r, i) => (r.pride > best.pride ? { ...r, idx: i } : best),
      { pride: -1, sentence: "", dominant: "", idx: -1 }
    );
    const high = prideResults.filter((r) => r.pride >= 0.5).length;
    return { avg, max, high, n: prideResults.length };
  }, [prideResults]);

  return (
    <div className="min-h-screen bg-[#282828] px-6 py-10 text-zinc-200 antialiased" style={{ fontFamily: "quasimoda, sans-serif" }}>
      <div className="mx-auto max-w-6xl">
        {/* Editorial header */}
        <div className="mb-10 border-b border-zinc-600 pb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
            Emotion Analysis
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
            MORES <span style={{ color: "#ffcc00" }}>Pulse</span> AI
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            The model behind it operates using a 6-label codebook, including the following labels:{" "}
            <span className="text-zinc-200">Anger</span>,{" "}
            <span className="text-zinc-200">Fear</span>,{" "}
            <span className="text-zinc-200">Disgust</span>,{" "}
            <span className="text-zinc-200">Sadness</span>,{" "}
            <span className="text-zinc-200">Joy</span>, and{" "}
            <span className="text-zinc-200">None of Them</span>.
            {" "}The{" "}
            <a href="https://huggingface.co/poltextlab/xlm-roberta-large-pooled-emotions6" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: "#ffcc00" }}>
              model
            </a>{" "}
            is optimised for sentence-level analysis, and makes predictions in the following
            languages: Czech, English, French, German, Hungarian, Polish, and Slovak.
            The text you enter in the input box is automatically divided into sentences, and the
            analysis is performed on each sentence. Depending on the length of the text, this
            process may take a few seconds, but for longer texts, it can take up to 2–3 minutes.
            {" "}Read our{" "}
            <a href="#qa" className="font-medium underline" style={{ color: "#ffcc00" }}>
              Q&A about Pulse
            </a>{" "}
            and view the{" "}
            <a href="#codebook" className="font-medium underline" style={{ color: "#ffcc00" }}>
              codebook
            </a>.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Pride identification is conducted with the{" "}
            <a href="https://huggingface.co/poltextlab/xlm-roberta-large-pooled-emotions9-v2" target="_blank" rel="noopener noreferrer" className="font-medium underline" style={{ color: "#6633ff" }}>
              extended emotion model
            </a>.
          </p>
        </div>

        {/* Input card */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-[1fr_260px]">
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                Input text
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="Enter your text here..."
                className="w-full resize-y border border-zinc-600 bg-[#282828] px-4 py-3 text-sm leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:border-[#ffcc00]/60 focus:ring-2 focus:ring-[#ffcc00]/20"
              />
              <p className="mt-2 text-[11px] font-light text-zinc-400">
                {text.trim().length} characters · ~{splitSentencesClientEstimate(text).length} sentences detected
              </p>
            </div>
            <div className="flex flex-col justify-between gap-3">
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full border border-zinc-600 bg-[#282828] px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-[#ffcc00]/60 focus:ring-2 focus:ring-[#ffcc00]/20"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 border border-zinc-600 bg-[#282828] px-3 py-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={includePride}
                  onChange={(e) => setIncludePride(e.target.checked)}
                  className="h-3.5 w-3.5 border-zinc-600 bg-zinc-800"
                  style={{ accentColor: "#6633ff" }}
                />
                <span>
                  Run <span className="font-semibold" style={{ color: "#6633ff" }}>Pride detection</span> pass
                </span>
              </label>
              <button
                onClick={runAnalysis}
                disabled={loading || !text.trim()}
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-400"
                style={{ background: loading ? undefined : "#ffcc00" }}
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-900/30 border-t-zinc-900" />
                    Analysing…
                  </>
                ) : (
                  <>Analyse text →</>
                )}
              </button>
            </div>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <Card className="mb-6 border-[#ff3300]/40 bg-[#ff3300]/10">
            <p className="p-4 text-sm" style={{ color: "#ff3300" }}>{error}</p>
          </Card>
        )}

        {/* Emotion legend */}
        <div className="mb-6 flex flex-wrap gap-2">
          {EMOTIONS.map((e) => (
            <Pill key={e.key} style={softStyle(e.color)}>
              <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
              {e.label}
            </Pill>
          ))}
          {includePride && (
            <Pill style={softStyle(PRIDE_STYLE.color)}>
              <span className="h-2 w-2 rounded-full" style={{ background: PRIDE_STYLE.color }} />
              Pride (extended)
            </Pill>
          )}
        </div>

        {!results && !loading && !error && (
          <Card className="p-10 text-center">
            <p className="text-sm font-light text-zinc-400">
              Enter a text above and press{" "}
              <span className="font-semibold" style={{ color: "#ffcc00" }}>Analyse text</span>{" "}
              to see the emotion breakdown.
            </p>
          </Card>
        )}

        {results && results.length > 0 && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                label="01 · Overview"
                title="Emotion overview"
                subtitle="Average probability across all sentences (MORES, 6 emotions)"
              />
              <div className="p-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview} margin={{ top: 8, right: 8, left: -8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#444" vertical={false} />
                      <XAxis dataKey="emotion" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: "rgba(255,204,0,0.06)" }}
                        contentStyle={{ border: "1px solid #555", background: "#303030", fontSize: 12, color: "#e4e4e7" }}
                        labelStyle={{ color: "#a1a1aa" }}
                        formatter={(v) => [`${(v * 100).toFixed(1)}%`, "Probability"]}
                      />
                      <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                        {overview.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader
                label="02 · Profile"
                title="Emotion profile"
                subtitle="Shape of the emotional signal"
              />
              <div className="p-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={overview} outerRadius="75%">
                      <PolarGrid stroke="#444" />
                      <PolarAngleAxis dataKey="emotion" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                      <PolarRadiusAxis tick={{ fontSize: 10, fill: "#666" }} axisLine={false} />
                      <Radar dataKey="value" stroke="#ffcc00" fill="#ffcc00" fillOpacity={0.18} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                label="03 · Sentences"
                title="Coloured sentence view"
                subtitle="Each sentence is tinted by its dominant MORES emotion."
              />
              <div className="space-y-2 p-6">
                {results.map((r, i) => {
                  const em = EMOTIONS.find((x) => x.key === r.top1.label) || EMOTIONS[EMOTIONS.length - 1];
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-3 border px-4 py-3 text-sm leading-relaxed transition"
                      style={softStyle(em.color)}
                    >
                      <span
                        className="mt-0.5 flex h-6 shrink-0 items-center justify-center px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-950"
                        style={{ background: em.color }}
                      >
                        {em.label}
                      </span>
                      <p className="flex-1 text-zinc-200">{r.sentence}</p>
                      <span className="shrink-0 font-mono text-[11px] text-zinc-400">
                        {(r.top1.conf * 100).toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                label="04 · Table"
                title="Per-sentence predictions"
                subtitle="Top 2 emotions with confidence for every sentence"
              />
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-zinc-700 bg-[#2a2a2a] text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    <tr>
                      <th className="px-5 py-3">Sentence</th>
                      <th className="px-5 py-3">Prediction 1</th>
                      <th className="px-5 py-3">Conf.</th>
                      <th className="px-5 py-3">Prediction 2</th>
                      <th className="px-5 py-3">Conf.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-700/70">
                    {results.map((r, i) => {
                      const e1 = EMOTIONS.find((x) => x.key === r.top1.label);
                      const e2 = EMOTIONS.find((x) => x.key === r.top2.label);
                      return (
                        <tr key={i} className="hover:bg-zinc-700/30">
                          <td className="max-w-xl px-5 py-3 text-zinc-300">{r.sentence}</td>
                          <td className="px-5 py-3">
                            <Pill style={softStyle(e1?.color || "#808080")}>
                              <span className="h-2 w-2 rounded-full" style={{ background: e1?.color }} />
                              {r.top1.label}
                            </Pill>
                          </td>
                          <td className="px-5 py-3 font-mono text-zinc-400">{(r.top1.conf * 100).toFixed(1)}%</td>
                          <td className="px-5 py-3">
                            <Pill style={softStyle(e2?.color || "#808080")}>
                              <span className="h-2 w-2 rounded-full" style={{ background: e2?.color }} />
                              {r.top2.label}
                            </Pill>
                          </td>
                          <td className="px-5 py-3 font-mono text-zinc-400">{(r.top2.conf * 100).toFixed(1)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader
                label="05 · Timeline"
                title="Emotion timeline"
                subtitle="Intensity of each emotion across the text. Hover for details."
              />
              <RibbonHeatmap results={results} emotions={EMOTIONS} />
            </Card>

            {includePride && prideResults && prideResults.length > 0 && (
              <Card className="lg:col-span-2" style={{ borderColor: hexWithAlpha("#6633ff", 0.3), background: "linear-gradient(135deg, #303030, #2a2040)" }}>
                <CardHeader
                  label={<span style={{ color: "#6633ff" }}>06 · Extended</span>}
                  title={
                    <span className="inline-flex items-center gap-2 text-zinc-100">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: PRIDE_STYLE.color, boxShadow: `0 0 10px ${hexWithAlpha("#6633ff", 0.6)}` }} />
                      Pride detection
                    </span>
                  }
                  subtitle="From the extended emotion model. Shown separately — not mixed with the MORES results."
                />
                <PrideCard prideResults={prideResults} prideStats={prideStats} />
              </Card>
            )}
          </div>
        )}

        {results && results.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-sm font-light text-zinc-400">No sentences detected in the input.</p>
          </Card>
        )}

        <div className="mt-12 border-t border-zinc-600 pt-6 text-center">
          <p className="text-[11px] font-light leading-relaxed text-zinc-400">
            This research was funded by the European Union under grant agreement No. 101132601
            (MORES – Moral emotions in politics – how they unite, how they divide).
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- Ribbon heatmap --------------------------------------------------------
function RibbonHeatmap({ results, emotions }) {
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
            <div className="w-24 shrink-0 text-right text-[11px] font-medium text-zinc-400">
              {e.label}
            </div>
            <div
              className="relative h-9 flex-1 overflow-hidden bg-[#282828] ring-1 ring-zinc-700"
              onMouseLeave={() => setHover(null)}
            >
              {results.map((r, i) => {
                const v = r.probs[e.key] || 0;
                const alpha = 0.08 + v * 0.92;
                return (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 cursor-pointer transition-[filter] hover:brightness-125"
                    style={{
                      left: `${(i / n) * 100}%`,
                      width: `${100 / n + 0.3}%`,
                      background: hexWithAlpha(e.color, alpha),
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
                  style={{ left: `${((hover.sentenceIdx + 0.5) / n) * 100}%`, background: hexWithAlpha("#ffcc00", 0.7) }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-2 ml-[6.75rem] h-5 text-[10px] font-mono text-zinc-500">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(t / Math.max(n - 1, 1)) * 100}%` }}>
            #{t + 1}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3 pl-[6.75rem]">
        <span className="font-mono text-[10px] text-zinc-500">0%</span>
        <div
          className="h-2 flex-1 ring-1 ring-zinc-700"
          style={{ background: "linear-gradient(90deg, #333, #665500, #aa8800, #ffcc00)" }}
        />
        <span className="font-mono text-[10px] text-zinc-500">100%</span>
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
  const em = emotions.find((e) => e.key === emotionKey);
  if (!em) return null;
  const v = result.probs[emotionKey] || 0;
  const snippet = result.sentence.length > 90 ? result.sentence.slice(0, 90) + "…" : result.sentence;
  return (
    <div
      className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 border border-zinc-600 bg-[#363636] px-3 py-2 text-xs shadow-xl shadow-black/40"
      style={{ left: x, top: -4 }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-zinc-100">
          <span className="h-2 w-2 rounded-full" style={{ background: em.color }} />
          <span className="font-semibold">{em.label}</span>
        </span>
        <span className="font-mono text-[11px] text-zinc-300">{(v * 100).toFixed(1)}%</span>
      </div>
      <div className="text-[11px] font-light leading-snug text-zinc-400">{snippet}</div>
    </div>
  );
}

// ---- Pride detection card --------------------------------------------------
function PrideCard({ prideResults, prideStats }) {
  const max = prideStats?.max;
  return (
    <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-3">
        <div className="border p-4" style={{ borderColor: hexWithAlpha("#6633ff", 0.4), background: hexWithAlpha("#6633ff", 0.1) }}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: hexWithAlpha("#6633ff", 0.8) }}>
            Average Pride
          </p>
          <p className="mt-1 text-4xl font-bold" style={{ color: "#8866ff" }}>
            {(prideStats.avg * 100).toFixed(1)}%
          </p>
          <p className="mt-1 text-[11px] font-light" style={{ color: hexWithAlpha("#6633ff", 0.6) }}>
            across {prideStats.n} sentence{prideStats.n !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="border border-zinc-700 bg-[#282828] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            High-Pride sentences (≥50%)
          </p>
          <p className="mt-1 text-4xl font-bold text-zinc-100">{prideStats.high}</p>
          <p className="mt-1 text-[11px] font-light text-zinc-400">out of {prideStats.n}</p>
        </div>
        {max && max.idx >= 0 && (
          <div className="border border-zinc-700 bg-[#282828] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
              Top Pride sentence
            </p>
            <p className="mt-1.5 text-sm font-medium text-zinc-200 break-words">
              {max.sentence.length > 140 ? max.sentence.slice(0, 140) + "…" : max.sentence}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <Pill style={softStyle(PRIDE_STYLE.color)}>
                <span className="h-2 w-2 rounded-full" style={{ background: PRIDE_STYLE.color }} />
                {(max.pride * 100).toFixed(1)}%
              </Pill>
              <span className="text-zinc-400">
                ext. dominant: <span className="font-medium text-zinc-300">{max.dominant}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Per-sentence Pride intensity
          </p>
          <p className="font-mono text-[10px] text-zinc-500">0% → 100%</p>
        </div>
        <div className="space-y-1.5">
          {prideResults.map((r, i) => {
            const pct = Math.round(r.pride * 100);
            return (
              <div
                key={i}
                className="flex items-center gap-3 border border-zinc-700 bg-[#282828] px-3 py-2 transition hover:bg-[#2a2040]"
                style={{ borderColor: undefined }}
                title={r.sentence}
              >
                <span className="w-6 shrink-0 text-right font-mono text-[10px] text-zinc-500">
                  #{i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] font-light text-zinc-300">
                  {r.sentence}
                </span>
                <div className="relative h-1.5 w-32 shrink-0 overflow-hidden bg-zinc-700">
                  <div
                    className="absolute left-0 top-0 bottom-0"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${hexWithAlpha(PRIDE_STYLE.color, 0.4)}, ${PRIDE_STYLE.color})`,
                      boxShadow: `0 0 8px ${hexWithAlpha(PRIDE_STYLE.color, 0.6)}`,
                    }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-[11px] tabular-nums text-zinc-400">
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

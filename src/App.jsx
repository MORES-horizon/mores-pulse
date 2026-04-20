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
// Dark editorial theme — tuned to match mores-horizon.eu (near-black bg,
// white typography, yellow + fuchsia accents).
const API_URL = import.meta.env.VITE_API_URL || "";

const EMOTIONS = [
  { key: "Anger",   label: "Anger",   color: "#f87171", soft: "bg-red-500/15 text-red-200 border-red-500/30" },
  { key: "Fear",    label: "Fear",    color: "#c084fc", soft: "bg-purple-500/15 text-purple-200 border-purple-500/30" },
  { key: "Disgust", label: "Disgust", color: "#4ade80", soft: "bg-green-500/15 text-green-200 border-green-500/30" },
  { key: "Sadness", label: "Sadness", color: "#60a5fa", soft: "bg-blue-500/15 text-blue-200 border-blue-500/30" },
  { key: "Joy",     label: "Joy",     color: "#facc15", soft: "bg-yellow-500/15 text-yellow-200 border-yellow-500/30" },
  { key: "None",    label: "None",    color: "#71717a", soft: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30" },
];
const PRIDE_STYLE = {
  color: "#e879f9",
  soft: "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/30",
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hu", label: "Magyar" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "pl", label: "Polski" },
  { code: "cs", label: "Čeština" },
  { code: "sk", label: "Slovenčina" },
];

function splitSentencesClientEstimate(text) {
  if (!text.trim()) return [];
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=[A-ZÁÉÍÓÖŐÚÜŰ0-9])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---- UI primitives ---------------------------------------------------------
function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-zinc-800 bg-[#141419] ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ label, title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800/80 px-6 py-5">
      <div>
        {label && (
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            {label}
          </p>
        )}
        {title && (
          <h3 className="mt-1.5 text-[15px] font-semibold tracking-tight text-zinc-100">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="mt-1 text-[12px] font-light text-zinc-500">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

function Pill({ children, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${className}`}>
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
    <div className="min-h-screen bg-[#0b0b0d] px-6 py-10 text-zinc-200 antialiased">
      <div className="mx-auto max-w-6xl">
        {/* Editorial header (mirrors mores-horizon.eu) */}
        <div className="mb-10 border-b border-zinc-800 pb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
            Emotion Analysis
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-white md:text-5xl">
            MORES <span className="text-yellow-400">Pulse</span> AI
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-zinc-400">
            The model behind it operates using a 6-label codebook, including the following labels:{" "}
            <span className="text-zinc-200">Anger</span>,{" "}
            <span className="text-zinc-200">Fear</span>,{" "}
            <span className="text-zinc-200">Disgust</span>,{" "}
            <span className="text-zinc-200">Sadness</span>,{" "}
            <span className="text-zinc-200">Joy</span>, and{" "}
            <span className="text-zinc-200">None of Them</span>.
            {" "}The{" "}
            <a href="https://huggingface.co/poltextlab/xlm-roberta-large-pooled-emotions6" target="_blank" rel="noopener noreferrer" className="font-medium text-yellow-400 underline decoration-yellow-400/30 hover:decoration-yellow-400">
              model
            </a>{" "}
            is optimised for sentence-level analysis, and makes predictions in the following
            languages: Czech, English, French, German, Hungarian, Polish, and Slovak.
            The text you enter in the input box is automatically divided into sentences, and the
            analysis is performed on each sentence. Depending on the length of the text, this
            process may take a few seconds, but for longer texts, it can take up to 2–3 minutes.
            {" "}Read our{" "}
            <a href="#qa" className="font-medium text-yellow-400 underline decoration-yellow-400/30 hover:decoration-yellow-400">
              Q&A about Pulse
            </a>{" "}
            and view the{" "}
            <a href="#codebook" className="font-medium text-yellow-400 underline decoration-yellow-400/30 hover:decoration-yellow-400">
              codebook
            </a>.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400">
            Pride identification is conducted with the{" "}
            <a href="https://huggingface.co/poltextlab/xlm-roberta-large-pooled-emotions9-v2" target="_blank" rel="noopener noreferrer" className="font-medium text-fuchsia-400 underline decoration-fuchsia-400/30 hover:decoration-fuchsia-400">
              extended emotion model
            </a>.
          </p>
        </div>

        {/* Input card */}
        <Card className="mb-6">
          <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-[1fr_260px]">
            <div>
              <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Input text
              </label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder="Enter your text here..."
                className="w-full resize-y rounded-lg border border-zinc-800 bg-[#0b0b0d] px-4 py-3 text-sm leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-yellow-500/60 focus:ring-2 focus:ring-yellow-500/20"
              />
              <p className="mt-2 text-[11px] font-light text-zinc-500">
                {text.trim().length} characters · ~{splitSentencesClientEstimate(text).length} sentences detected
              </p>
            </div>
            <div className="flex flex-col justify-between gap-3">
              <div>
                <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-[#0b0b0d] px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-yellow-500/60 focus:ring-2 focus:ring-yellow-500/20"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-[#0b0b0d] px-3 py-2 text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={includePride}
                  onChange={(e) => setIncludePride(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-fuchsia-500 focus:ring-fuchsia-500/40"
                />
                <span>
                  Run <span className="font-semibold text-fuchsia-400">Pride detection</span> pass
                </span>
              </label>
              <button
                onClick={runAnalysis}
                disabled={loading || !text.trim()}
                className="flex items-center justify-center gap-2 rounded-lg bg-yellow-400 px-4 py-3 text-sm font-bold uppercase tracking-wider text-zinc-900 transition hover:bg-yellow-300 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-500"
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
          <Card className="mb-6 border-red-500/40 bg-red-950/20">
            <p className="p-4 text-sm text-red-300">{error}</p>
          </Card>
        )}

        {/* Emotion legend */}
        <div className="mb-6 flex flex-wrap gap-2">
          {EMOTIONS.map((e) => (
            <Pill key={e.key} className={e.soft}>
              <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
              {e.label}
            </Pill>
          ))}
          {includePride && (
            <Pill className={PRIDE_STYLE.soft}>
              <span className="h-2 w-2 rounded-full" style={{ background: PRIDE_STYLE.color }} />
              Pride (extended)
            </Pill>
          )}
        </div>

        {!results && !loading && !error && (
          <Card className="p-10 text-center">
            <p className="text-sm font-light text-zinc-500">
              Enter a text above and press{" "}
              <span className="font-semibold text-yellow-400">Analyse text</span>{" "}
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
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="emotion" tick={{ fontSize: 10, fill: "#a1a1aa" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: "rgba(250,204,21,0.06)" }}
                        contentStyle={{ borderRadius: 8, border: "1px solid #27272a", background: "#141419", fontSize: 12, color: "#e4e4e7" }}
                        labelStyle={{ color: "#a1a1aa" }}
                        formatter={(v) => [`${(v * 100).toFixed(1)}%`, "Probability"]}
                      />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
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
                      <PolarGrid stroke="#27272a" />
                      <PolarAngleAxis dataKey="emotion" tick={{ fontSize: 10, fill: "#a1a1aa" }} />
                      <PolarRadiusAxis tick={{ fontSize: 10, fill: "#52525b" }} axisLine={false} />
                      <Radar dataKey="value" stroke="#facc15" fill="#facc15" fillOpacity={0.18} />
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
                      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed transition ${em.soft}`}
                    >
                      <span
                        className="mt-0.5 flex h-6 shrink-0 items-center justify-center rounded px-2 text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-950"
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
                  <thead className="border-b border-zinc-800 bg-[#0f0f13] text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                    <tr>
                      <th className="px-5 py-3">Sentence</th>
                      <th className="px-5 py-3">Prediction 1</th>
                      <th className="px-5 py-3">Conf.</th>
                      <th className="px-5 py-3">Prediction 2</th>
                      <th className="px-5 py-3">Conf.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {results.map((r, i) => {
                      const e1 = EMOTIONS.find((x) => x.key === r.top1.label);
                      const e2 = EMOTIONS.find((x) => x.key === r.top2.label);
                      return (
                        <tr key={i} className="hover:bg-zinc-900/40">
                          <td className="max-w-xl px-5 py-3 text-zinc-300">{r.sentence}</td>
                          <td className="px-5 py-3">
                            <Pill className={e1?.soft}>
                              <span className="h-2 w-2 rounded-full" style={{ background: e1?.color }} />
                              {r.top1.label}
                            </Pill>
                          </td>
                          <td className="px-5 py-3 font-mono text-zinc-400">{(r.top1.conf * 100).toFixed(1)}%</td>
                          <td className="px-5 py-3">
                            <Pill className={e2?.soft}>
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
              <Card className="lg:col-span-2 border-fuchsia-500/30 bg-gradient-to-br from-[#141419] to-[#1a0f1f]">
                <CardHeader
                  label={<span className="text-fuchsia-400">06 · Extended</span>}
                  title={
                    <span className="inline-flex items-center gap-2 text-zinc-100">
                      <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_10px_rgba(232,121,249,0.6)]" style={{ background: PRIDE_STYLE.color }} />
                      Pride detection
                    </span>
                  }
                  subtitle="From the 10-emotion extended model. Shown separately — not mixed with the MORES results."
                />
                <PrideCard prideResults={prideResults} prideStats={prideStats} />
              </Card>
            )}
          </div>
        )}

        {results && results.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-sm font-light text-zinc-500">No sentences detected in the input.</p>
          </Card>
        )}

        <div className="mt-12 border-t border-zinc-800 pt-6 text-center">
          <p className="text-[11px] font-light leading-relaxed text-zinc-500">
            This research was funded by the European Union under grant agreement No. 101132601
            (MORES – Moral emotions in politics – how they unite, how they divide).
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- Helpers ---------------------------------------------------------------
function hexWithAlpha(hex, alpha) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---- Ribbon heatmap (dark) -------------------------------------------------
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
              className="relative h-9 flex-1 overflow-hidden rounded bg-[#0b0b0d] ring-1 ring-zinc-800"
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
                  className="pointer-events-none absolute top-0 bottom-0 w-px bg-yellow-400/70"
                  style={{ left: `${((hover.sentenceIdx + 0.5) / n) * 100}%` }}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="relative mt-2 ml-[6.75rem] h-5 text-[10px] font-mono text-zinc-600">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${(t / Math.max(n - 1, 1)) * 100}%` }}>
            #{t + 1}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-3 pl-[6.75rem]">
        <span className="font-mono text-[10px] text-zinc-600">0%</span>
        <div
          className="h-2 flex-1 rounded-full ring-1 ring-zinc-800"
          style={{ background: "linear-gradient(90deg, #1c1c22, #713f12, #ca8a04, #facc15)" }}
        />
        <span className="font-mono text-[10px] text-zinc-600">100%</span>
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
      className="pointer-events-none absolute z-10 w-64 -translate-x-1/2 rounded-lg border border-zinc-700 bg-[#1a1a20] px-3 py-2 text-xs shadow-xl shadow-black/40"
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

// ---- Pride detection card (dark) -------------------------------------------
function PrideCard({ prideResults, prideStats }) {
  const max = prideStats?.max;
  return (
    <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-[280px_1fr]">
      <div className="flex flex-col gap-3">
        <div className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-950/30 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-fuchsia-300">
            Average Pride
          </p>
          <p className="mt-1 text-4xl font-bold text-fuchsia-200">
            {(prideStats.avg * 100).toFixed(1)}%
          </p>
          <p className="mt-1 text-[11px] font-light text-fuchsia-300/70">
            across {prideStats.n} sentence{prideStats.n !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-[#0b0b0d] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            High-Pride sentences (≥50%)
          </p>
          <p className="mt-1 text-4xl font-bold text-zinc-100">{prideStats.high}</p>
          <p className="mt-1 text-[11px] font-light text-zinc-500">out of {prideStats.n}</p>
        </div>
        {max && max.idx >= 0 && (
          <div className="rounded-lg border border-zinc-800 bg-[#0b0b0d] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Top Pride sentence
            </p>
            <p className="mt-1.5 text-sm font-medium text-zinc-200">
              {max.sentence.length > 140 ? max.sentence.slice(0, 140) + "…" : max.sentence}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <Pill className={PRIDE_STYLE.soft}>
                <span className="h-2 w-2 rounded-full" style={{ background: PRIDE_STYLE.color }} />
                {(max.pride * 100).toFixed(1)}%
              </Pill>
              <span className="text-zinc-500">
                ext. dominant: <span className="font-medium text-zinc-300">{max.dominant}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Per-sentence Pride intensity
          </p>
          <p className="font-mono text-[10px] text-zinc-600">0% → 100%</p>
        </div>
        <div className="space-y-1.5">
          {prideResults.map((r, i) => {
            const pct = Math.round(r.pride * 100);
            const snippet = r.sentence.length > 110 ? r.sentence.slice(0, 110) + "…" : r.sentence;
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-md border border-zinc-800/70 bg-[#0b0b0d] px-3 py-2 transition hover:border-fuchsia-500/40 hover:bg-fuchsia-950/10"
                title={r.sentence}
              >
                <span className="w-6 shrink-0 text-right font-mono text-[10px] text-zinc-600">
                  #{i + 1}
                </span>
                <span className="flex-1 truncate text-[12px] font-light text-zinc-300">
                  {snippet}
                </span>
                <div className="relative h-1.5 w-40 shrink-0 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="absolute left-0 top-0 bottom-0 rounded-full"
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

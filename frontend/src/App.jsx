import { useState, useEffect } from "react";
import { T, font } from "./utils/tokens";
import { fetchOverview, fetchLines, fetchQuality, fetchShifts, fetchHourly, fetchHealth, fetchRecommendations } from "./api/client";
import { generateData } from "./data/mockData";
import Sidebar from "./components/layout/Sidebar";
import TopBar from "./components/layout/TopBar";
import Overview from "./pages/Overview";
import LinePerformance from "./pages/LinePerformance";
import QualityAnalytics from "./pages/QualityAnalytics";
import LineBalancing from "./pages/LineBalancing";
import CapacityPlanning from "./pages/CapacityPlanning";
import ActionCenter from "./pages/ActionCenter";

const MOCK = generateData();

export default function App() {
  const [page, setPage] = useState("overview");
  const [ready, setReady] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);

  const [overview, setOverview] = useState(null);
  const [lines, setLines] = useState([]);
  const [quality, setQuality] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [hourly, setHourly] = useState([]);
  const [recommendations, setRecommendations] = useState(null);
  const [recommendationsError, setRecommendationsError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const health = await fetchHealth();
        setDbConnected(health.db_connected === true);
      } catch {
        setDbConnected(false);
      }

      try {
        const [ov, ls, ql, sh, hr] = await Promise.all([
          fetchOverview(),
          fetchLines(),
          fetchQuality(),
          fetchShifts(),
          fetchHourly({ line_id: 1 }),
        ]);
        setOverview(ov);
        setLines(ls);
        setQuality(ql);
        setShifts(sh);
        setHourly(hr);
      } catch (err) {
        console.warn("API unavailable, falling back to demo data:", err.message);
        setOverview(MOCK.overview);
        setLines(MOCK.lines);
        setQuality({ defect_pareto: MOCK.defects, fpy_by_line: [] });
        setShifts(MOCK.shifts);
        setHourly(MOCK.hourly);
      }

      try {
        setRecommendationsError(false);
        setRecommendations(await fetchRecommendations());
      } catch (err) {
        console.warn("Recommendations unavailable:", err.message);
        setRecommendationsError(true);
        setRecommendations(null);
      }
    }

    load();
  }, []);

  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, [page]);

  const pageProps = { overview, lines, quality, shifts, hourly, recommendations, recommendationsError };

  return (
    <div style={{ fontFamily: font.body, background: T.bg, color: T.onSurface, minHeight: "100vh", display: "flex", margin: 0, padding: 0 }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      <Sidebar page={page} setPage={setPage} />

      <div style={{ flex: 1, marginLeft: 200, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <TopBar dbConnected={dbConnected} />
        <main style={{ flex: 1, padding: 24, overflowX: "hidden", opacity: ready ? 1 : 0, transform: ready ? "none" : "translateY(6px)", transition: "all 0.35s ease" }}>
          <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
            {page === "overview"  && <Overview  {...pageProps} />}
            {page === "lines"     && <LinePerformance lines={lines} />}
            {page === "quality"   && <QualityAnalytics quality={quality} />}
            {page === "balance"   && <LineBalancing />}
            {page === "capacity"  && <CapacityPlanning />}
            {page === "actions"   && <ActionCenter recommendations={recommendations} recommendationsError={recommendationsError} />}

            <div style={{ marginTop: 16, paddingTop: 20, borderTop: `1px solid ${T.high}`, textAlign: "center" }}>
              <p style={{ fontSize: 11, fontFamily: font.data, color: T.outline, lineHeight: 1.8 }}>
                <span style={{ color: T.primaryContainer, fontWeight: 600 }}>Stack: </span>
                PostgreSQL · FastAPI · React · OR-Tools · scikit-learn · Supabase · Vercel · Render
              </p>
              <p style={{ fontSize: 10, fontFamily: font.data, color: T.outlineVar, marginTop: 4 }}>
                Manufacturing Operations Intelligence Dashboard · Portfolio project · OEE computed from SQL, not hardcoded
              </p>
            </div>
          </div>
        </main>
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        *{box-sizing:border-box;margin:0}
        button{font-family:inherit}
        button:focus{outline:none}
        button:focus-visible{outline:2px solid ${T.primaryContainer};outline-offset:2px}
        ::-webkit-scrollbar{width:8px;height:8px}
        ::-webkit-scrollbar-track{background:${T.lowest}}
        ::-webkit-scrollbar-thumb{background:${T.high};border-radius:4px}
        ::-webkit-scrollbar-thumb:hover{background:${T.outlineVar}}
        input[type="range"]{height:4px;border-radius:4px;background:${T.high};cursor:pointer}
        input[type="range"]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%}
        table{border-spacing:0}
      `}</style>
    </div>
  );
}

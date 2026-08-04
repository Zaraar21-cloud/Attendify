"use client";

import { useState, useCallback, useMemo } from "react";
import { useAttendify } from "@/lib/context";
import { calcPercentage } from "@/lib/engine";

type InputMode = "ratio" | "percentage";

export default function AttendanceInput() {
  const { state, setAttendanceRatio, setAttendancePercentage } = useAttendify();
  const { attendance } = state;

  const [mode, setMode] = useState<InputMode>("percentage");
  const [attended, setAttended] = useState("");
  const [total, setTotal] = useState("");
  const [pctInput, setPctInput] = useState("");

  const [prevLoaded, setPrevLoaded] = useState(false);

  // Sync local inputs once context hydrates from localStorage
  if (state.isLoaded && !prevLoaded) {
    setPrevLoaded(true);
    if (attendance.attendedCount > 0 || attendance.totalCount > 0) {
      setAttended(String(attendance.attendedCount));
      setTotal(String(attendance.totalCount));
    }
    if (attendance.currentPercentage > 0) {
      setPctInput(String(attendance.currentPercentage));
    }
  }


  // Compute live preview
  const livePercentage = useMemo(() => {
    if (mode === "ratio") {
      const a = parseInt(attended, 10);
      const t = parseInt(total, 10);
      if (!isNaN(a) && !isNaN(t) && t > 0) return calcPercentage(a, t);
      return null;
    }
    const p = parseFloat(pctInput);
    if (!isNaN(p) && p >= 0 && p <= 100) return p;
    return null;
  }, [mode, attended, total, pctInput]);

  const handleApply = useCallback(() => {
    if (mode === "ratio") {
      const a = parseInt(attended, 10);
      const t = parseInt(total, 10);
      if (!isNaN(a) && !isNaN(t) && t > 0 && a >= 0) {
        setAttendanceRatio(a, t);
      }
    } else {
      const p = parseFloat(pctInput);
      if (!isNaN(p) && p >= 0 && p <= 100) {
        setAttendancePercentage(p);
      }
    }
  }, [mode, attended, total, pctInput, setAttendanceRatio, setAttendancePercentage]);

  const percentColor = livePercentage !== null
    ? livePercentage >= 75 ? "text-card-green" : "text-card-coral"
    : "text-brutal-black/40";

  return (
    <section id="attendance-input" className="w-full">
      <h2 className="font-heading text-xl font-extrabold text-brutal-black mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border-[3px] border-brutal-black bg-card-green text-white text-sm font-mono shadow-brutal-sm">
          3
        </span>
        Current Attendance
      </h2>

      <div className="rounded-lg border-[3px] border-brutal-black bg-white shadow-brutal p-5">
        {/* Mode Toggle */}
        <div className="flex mb-5 rounded-md border-[3px] border-brutal-black overflow-hidden">
          <button
            onClick={() => setMode("percentage")}
            className={`flex-1 py-2 font-mono text-sm font-bold transition-colors
              ${
                mode === "percentage"
                  ? "bg-accent-yellow text-brutal-black"
                  : "bg-white text-brutal-black/50 hover:bg-cream"
              }`}
          >
            Percentage (%)
          </button>
          <button
            onClick={() => setMode("ratio")}
            className={`flex-1 py-2 font-mono text-sm font-bold border-l-[3px] border-brutal-black transition-colors
              ${
                mode === "ratio"
                  ? "bg-accent-yellow text-brutal-black"
                  : "bg-white text-brutal-black/50 hover:bg-cream"
              }`}
          >
            Ratio (A / T)
          </button>
        </div>

        {/* Input Fields */}
        {mode === "percentage" ? (
          <div>
            <label className="block font-mono text-xs font-bold text-brutal-black mb-1.5">
              Current Percentage
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={pctInput}
                onChange={(e) => setPctInput(e.target.value)}
                placeholder="75.0"
                className="w-full rounded-md border-[3px] border-brutal-black px-3 py-2.5 pr-10 font-mono text-lg font-bold
                           focus:outline-none focus:ring-2 focus:ring-accent-yellow focus:border-accent-yellow
                           transition-all"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-heading text-xl font-extrabold text-brutal-black/30">
                %
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block font-mono text-xs font-bold text-brutal-black mb-1.5">
                Classes Attended
              </label>
              <input
                type="number"
                min={0}
                value={attended}
                onChange={(e) => setAttended(e.target.value)}
                placeholder="45"
                className="w-full rounded-md border-[3px] border-brutal-black px-3 py-2.5 font-mono text-lg font-bold
                           focus:outline-none focus:ring-2 focus:ring-accent-yellow focus:border-accent-yellow
                           transition-all"
              />
            </div>
            <div className="flex h-12 items-center justify-center">
              <span className="font-heading text-2xl font-extrabold text-brutal-black/30">/</span>
            </div>
            <div className="flex-1">
              <label className="block font-mono text-xs font-bold text-brutal-black mb-1.5">
                Total Conducted
              </label>
              <input
                type="number"
                min={1}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                placeholder="60"
                className="w-full rounded-md border-[3px] border-brutal-black px-3 py-2.5 font-mono text-lg font-bold
                           focus:outline-none focus:ring-2 focus:ring-accent-yellow focus:border-accent-yellow
                           transition-all"
              />
            </div>
          </div>
        )}

        {/* Live Preview + Apply */}
        <div className="flex items-center justify-between mt-5 pt-4 border-t-[2px] border-brutal-black/10">
          <div>
            <p className="font-mono text-xs text-brutal-black/50">Live Preview</p>
            <p className={`font-heading text-3xl font-extrabold ${percentColor}`}>
              {livePercentage !== null ? `${livePercentage.toFixed(1)}%` : "—"}
            </p>
          </div>
          <button
            onClick={handleApply}
            disabled={livePercentage === null}
            className="rounded-md border-[3px] border-brutal-black bg-accent-yellow px-6 py-2.5
                       font-mono text-sm font-bold text-brutal-black shadow-brutal
                       hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]
                       active:shadow-brutal-active
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-brutal disabled:hover:translate-x-0 disabled:hover:translate-y-0
                       transition-all"
          >
            Apply
          </button>
        </div>
      </div>
    </section>
  );
}

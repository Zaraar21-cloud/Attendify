"use client";

import { useMemo, useCallback } from "react";
import { useAttendify } from "@/lib/context";
import { calculateAll } from "@/lib/engine";

const PRESET_TARGETS = [75, 80, 85, 90];

export default function TargetCalculator() {
  const { state, setTarget } = useAttendify();
  const { attendance, timetable } = state;

  const result = useMemo(
    () => calculateAll(attendance, timetable),
    [attendance, timetable]
  );

  const hasData = attendance.totalCount > 0;

  const handlePresetClick = useCallback(
    (target: number) => {
      setTarget(target);
    },
    [setTarget]
  );

  const handleCustomTarget = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 0 && val <= 100) {
        setTarget(val);
      }
    },
    [setTarget]
  );

  return (
    <section id="target-calculator" className="w-full">
      <h2 className="font-heading text-xl font-extrabold text-brutal-black mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border-[3px] border-brutal-black bg-accent-yellow text-brutal-black text-sm font-mono shadow-brutal-sm">
          4
        </span>
        Target & Recovery
      </h2>

      <div className="rounded-lg border-[3px] border-brutal-black bg-white shadow-brutal p-5">
        {/* Target Selection */}
        <div className="mb-5">
          <label className="block font-mono text-xs font-bold text-brutal-black mb-2">
            Goal Attendance
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_TARGETS.map((t) => (
              <button
                key={t}
                onClick={() => handlePresetClick(t)}
                className={`rounded-md border-[3px] border-brutal-black px-4 py-2
                           font-mono text-sm font-bold transition-all
                  ${
                    attendance.targetPercentage === t
                      ? "bg-accent-yellow text-brutal-black shadow-brutal-sm"
                      : "bg-white text-brutal-black/60 hover:bg-cream"
                  }`}
              >
                {t}%
              </button>
            ))}
            <div className="relative">
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={attendance.targetPercentage}
                onChange={handleCustomTarget}
                className="w-24 rounded-md border-[3px] border-brutal-black px-3 py-2 pr-8
                           font-mono text-sm font-bold
                           focus:outline-none focus:ring-2 focus:ring-accent-yellow focus:border-accent-yellow
                           transition-all"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-brutal-black/30">
                %
              </span>
            </div>
          </div>
        </div>

        {/* Results Dashboard */}
        {!hasData ? (
          <div className="rounded-md border-[2px] border-dashed border-brutal-black/20 py-8 text-center">
            <p className="font-mono text-sm text-brutal-black/40">
              Enter your attendance above to see calculations
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Required Classes Card */}
            <div
              className={`rounded-lg border-[3px] border-brutal-black p-4 shadow-brutal-sm ${
                result.isAboveTarget ? "bg-card-green/10" : "bg-card-coral/10"
              }`}
            >
              <p className="font-mono text-xs font-bold text-brutal-black/60 mb-1">
                {result.isAboveTarget ? "You're Safe ✓" : "Classes Needed"}
              </p>
              <p
                className={`font-heading text-4xl font-extrabold ${
                  result.isAboveTarget ? "text-card-green" : "text-card-coral"
                }`}
              >
                {result.isAboveTarget ? "0" : result.requiredClasses}
              </p>
              <p className="font-mono text-xs text-brutal-black/50 mt-1">
                {result.isAboveTarget
                  ? "Above target percentage"
                  : `consecutive classes to attend`}
              </p>
            </div>

            {/* Required Days Card */}
            <div className="rounded-lg border-[3px] border-brutal-black bg-card-blue/10 p-4 shadow-brutal-sm">
              <p className="font-mono text-xs font-bold text-brutal-black/60 mb-1">
                Calendar Days
              </p>
              <p className="font-heading text-4xl font-extrabold text-card-blue">
                {result.isAboveTarget ? "0" : result.requiredDays}
              </p>
              <p className="font-mono text-xs text-brutal-black/50 mt-1">
                {result.isAboveTarget
                  ? "No recovery needed"
                  : "days of full attendance"}
              </p>
            </div>

            {/* Bunk Buffer Card */}
            <div
              className={`rounded-lg border-[3px] border-brutal-black p-4 shadow-brutal-sm ${
                result.bunkBuffer > 0 ? "bg-card-green/10" : "bg-card-coral/10"
              }`}
            >
              <p className="font-mono text-xs font-bold text-brutal-black/60 mb-1">
                Bunk Buffer
              </p>
              <p
                className={`font-heading text-4xl font-extrabold ${
                  result.bunkBuffer > 0 ? "text-card-green" : "text-card-coral"
                }`}
              >
                {result.bunkBuffer}
              </p>
              <p className="font-mono text-xs text-brutal-black/50 mt-1">
                {result.bunkBuffer > 0
                  ? `classes you can safely skip`
                  : "no room to skip classes"}
              </p>
            </div>
          </div>
        )}

        {/* Current Status Bar */}
        {hasData && (
          <div className="mt-5 pt-4 border-t-[2px] border-brutal-black/10">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-xs font-bold text-brutal-black/60">
                Current: {attendance.currentPercentage.toFixed(1)}%
              </span>
              <span className="font-mono text-xs font-bold text-brutal-black/60">
                Target: {attendance.targetPercentage}%
              </span>
            </div>
            <div className="h-4 w-full rounded-full border-[2px] border-brutal-black bg-cream overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  attendance.currentPercentage >= attendance.targetPercentage
                    ? "bg-card-green"
                    : "bg-card-coral"
                }`}
                style={{
                  width: `${Math.min(100, attendance.currentPercentage)}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

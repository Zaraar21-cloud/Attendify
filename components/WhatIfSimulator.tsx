"use client";

import { useState, useMemo, useCallback } from "react";
import { useAttendify } from "@/lib/context";
import { type Weekday, type TimeSlot, WEEKDAYS } from "@/lib/types";
import {
  simulateSkip,
  simulateAttend,
  simulateMixed,
  simulateClassChanges,
  classesOnDay,
} from "@/lib/engine";

type DayMode = "neutral" | "skip" | "attend";
type ClassMode = "neutral" | "skip" | "attend";
type BrushMode = "skip" | "attend";

export default function WhatIfSimulator() {
  const { state } = useAttendify();
  const { attendance, timetable } = state;

  const [dayModes, setDayModes] = useState<Record<Weekday, DayMode>>(
    () =>
      Object.fromEntries(WEEKDAYS.map((day) => [day, "neutral"])) as Record<
        Weekday,
        DayMode
      >
  );

  // Which brush is active — clicking a day applies this mode
  const [brushMode, setBrushMode] = useState<BrushMode>("skip");
  // Per-class skip/attend modes (keyed by slot id)
  const [classModes, setClassModes] = useState<Record<string, ClassMode>>({});

  // Click a day: toggle it with the active brush
  const toggleDay = useCallback(
    (day: Weekday) => {
      setDayModes((prev) => {
        // If already set to the active brush, un-set it (back to neutral)
        if (prev[day] === brushMode) {
          return { ...prev, [day]: "neutral" };
        }
        // Otherwise set it to the active brush
        return { ...prev, [day]: brushMode };
      });
    },
    [brushMode]
  );

  // Quick select: Skip Today
  const skipToday = useCallback(() => {
    const dayIndex = new Date().getDay();
    const dayMap: Record<number, Weekday> = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
    };
    const today = dayMap[dayIndex];
    if (today) {
      setDayModes((prev) => ({
        ...prev,
        [today]: prev[today] === "skip" ? "neutral" : "skip",
      }));
    }
  }, []);

  // Quick select: Attend Today
  const attendToday = useCallback(() => {
    const dayIndex = new Date().getDay();
    const dayMap: Record<number, Weekday> = {
      1: "Monday",
      2: "Tuesday",
      3: "Wednesday",
      4: "Thursday",
      5: "Friday",
      6: "Saturday",
    };
    const today = dayMap[dayIndex];
    if (today) {
      setDayModes((prev) => ({
        ...prev,
        [today]: prev[today] === "attend" ? "neutral" : "attend",
      }));
    }
  }, []);

  const clearSelection = useCallback(() => {
    setDayModes(
      Object.fromEntries(WEEKDAYS.map((day) => [day, "neutral"])) as Record<
        Weekday,
        DayMode
      >
    );
    setClassModes({});
  }, []);

  // Derive skip/attend day lists
  const skippedDays = useMemo(
    () => WEEKDAYS.filter((day) => dayModes[day] === "skip"),
    [dayModes]
  );
  const attendedDays = useMemo(
    () => WEEKDAYS.filter((day) => dayModes[day] === "attend"),
    [dayModes]
  );

  // ─── Today's Classes ───────────────────────────────────────────────────────

  const WEEKDAY_MAP: Record<number, Weekday> = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
  };

  const todayIndex = new Date().getDay();
  const todayName = WEEKDAY_MAP[todayIndex] ?? null;
  const todaySlots: TimeSlot[] = todayName ? (timetable[todayName] ?? []) : [];

  const toggleClass = useCallback(
    (slotId: string) => {
      setClassModes((prev) => {
        const current = prev[slotId] ?? "neutral";
        if (current === brushMode) {
          // Toggle off → neutral
          const next = { ...prev };
          delete next[slotId];
          return next;
        }
        return { ...prev, [slotId]: brushMode };
      });
    },
    [brushMode]
  );

  // Derive per-class skip/attend counts
  const classSkippedCount = useMemo(
    () => Object.values(classModes).filter((m) => m === "skip").length,
    [classModes]
  );
  const classAttendedCount = useMemo(
    () => Object.values(classModes).filter((m) => m === "attend").length,
    [classModes]
  );

  const hasClassSelection = classSkippedCount > 0 || classAttendedCount > 0;

  const hasSelection = skippedDays.length > 0 || attendedDays.length > 0;

  // Run simulation (day-level)
  const simulation = useMemo(() => {
    if (!hasSelection || attendance.totalCount === 0) return null;

    if (skippedDays.length > 0 && attendedDays.length === 0) {
      return simulateSkip(attendance, timetable, skippedDays);
    }
    if (attendedDays.length > 0 && skippedDays.length === 0) {
      return simulateAttend(attendance, timetable, attendedDays);
    }
    return simulateMixed(attendance, timetable, skippedDays, attendedDays);
  }, [skippedDays, attendedDays, hasSelection, attendance, timetable]);

  // Run class-level simulation
  const classSimulation = useMemo(() => {
    if (!hasClassSelection || attendance.totalCount === 0) return null;
    return simulateClassChanges(
      attendance,
      timetable,
      classSkippedCount,
      classAttendedCount
    );
  }, [hasClassSelection, attendance, timetable, classSkippedCount, classAttendedCount]);

  const hasData = attendance.totalCount > 0;

  return (
    <section id="what-if-simulator" className="w-full">
      <h2 className="font-heading text-xl font-extrabold text-brutal-black mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border-[3px] border-brutal-black bg-card-lavender text-white text-sm font-mono shadow-brutal-sm">
          5
        </span>
        What-If Simulator
      </h2>

      <div className="rounded-lg border-[3px] border-brutal-black bg-white shadow-brutal p-5">
        {/* Mode Toggle — Skip or Attend brush */}
        <div className="flex mb-4 rounded-md border-[3px] border-brutal-black overflow-hidden">
          <button
            onClick={() => setBrushMode("skip")}
            className={`flex-1 py-2 font-mono text-sm font-bold transition-colors
              ${
                brushMode === "skip"
                  ? "bg-card-coral text-white"
                  : "bg-white text-brutal-black/50 hover:bg-cream"
              }`}
          >
            🚫 Skip
          </button>
          <button
            onClick={() => setBrushMode("attend")}
            className={`flex-1 py-2 font-mono text-sm font-bold border-l-[3px] border-brutal-black transition-colors
              ${
                brushMode === "attend"
                  ? "bg-card-green text-white"
                  : "bg-white text-brutal-black/50 hover:bg-cream"
              }`}
          >
            ✓ Attend
          </button>
        </div>

        {/* Quick Selectors */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={skipToday}
            className="rounded-md border-[2px] border-brutal-black bg-card-coral/10 px-3 py-1
                       font-mono text-xs font-bold text-card-coral hover:bg-card-coral hover:text-white transition-colors"
          >
            🚫 Skip Today
          </button>
          <button
            onClick={attendToday}
            className="rounded-md border-[2px] border-brutal-black bg-card-green/10 px-3 py-1
                       font-mono text-xs font-bold text-card-green hover:bg-card-green hover:text-white transition-colors"
          >
            ✓ Attend Today
          </button>
          {hasSelection && (
            <button
              onClick={clearSelection}
              className="rounded-md border-[2px] border-brutal-black bg-cream px-3 py-1
                         font-mono text-xs font-bold text-brutal-black/60 hover:bg-brutal-black hover:text-white transition-colors"
            >
              ✕ Clear All
            </button>
          )}
        </div>

        {/* Day Toggles */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5">
          {WEEKDAYS.map((day) => {
            const classes = classesOnDay(timetable, day);
            const mode = dayModes[day];
            const disabled = classes === 0;

            // Determine if this day is before today in the current week
            const WEEKDAY_INDEX: Record<Weekday, number> = {
              Monday: 1,
              Tuesday: 2,
              Wednesday: 3,
              Thursday: 4,
              Friday: 5,
              Saturday: 6,
            };
            const currentDayIndex = new Date().getDay(); // 0=Sun, 1=Mon...6=Sat
            const isPast = currentDayIndex > 0 && WEEKDAY_INDEX[day] < currentDayIndex;

            let bgClass: string;
            if (mode === "skip") {
              bgClass = "bg-card-coral text-white shadow-brutal-sm";
            } else if (mode === "attend") {
              bgClass = "bg-card-green text-white shadow-brutal-sm";
            } else {
              bgClass = disabled
                ? "bg-cream/50 text-brutal-black/20 cursor-not-allowed"
                : "bg-white text-brutal-black hover:bg-card-lavender/10";
            }

            return (
              <button
                key={day}
                onClick={() => toggleDay(day)}
                disabled={disabled}
                className={`rounded-md border-[3px] border-brutal-black py-3 px-2
                           font-mono text-sm font-bold transition-all relative overflow-hidden
                  ${bgClass}`}
              >
                <span className="block text-sm">{day.slice(0, 3)}</span>
                <span className="block text-[10px] mt-0.5 opacity-70">
                  {classes} cls
                </span>
                {mode !== "neutral" && (
                  <span
                    className={`absolute -top-1.5 -right-1.5 flex h-5 min-w-[2.5rem] items-center justify-center rounded-full border-[2px] border-brutal-black bg-white px-1 text-[9px] font-extrabold shadow-sm z-10
                    ${mode === "skip" ? "text-card-coral" : "text-card-green"}`}
                  >
                    {mode === "skip" ? "🚫 SKIP" : "✓ ATTEND"}
                  </span>
                )}
                {isPast && mode === "neutral" && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-[5px] bg-black/20 pointer-events-none">
                    <span className="font-mono text-[10px] font-extrabold text-white tracking-wider drop-shadow-sm">
                      PAST
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active selections summary */}
        {hasSelection && (
          <div className="flex flex-wrap gap-2 mb-4">
            {skippedDays.map((day) => (
              <span
                key={day}
                className="inline-flex items-center gap-1 rounded-md border-[2px] border-card-coral bg-card-coral/10 px-2 py-0.5 font-mono text-[10px] font-bold text-card-coral"
              >
                🚫 {day.slice(0, 3)}
                <button
                  onClick={() =>
                    setDayModes((prev) => ({ ...prev, [day]: "neutral" }))
                  }
                  className="ml-0.5 hover:text-brutal-black transition-colors"
                >
                  ✕
                </button>
              </span>
            ))}
            {attendedDays.map((day) => (
              <span
                key={day}
                className="inline-flex items-center gap-1 rounded-md border-[2px] border-card-green bg-card-green/10 px-2 py-0.5 font-mono text-[10px] font-bold text-card-green"
              >
                ✓ {day.slice(0, 3)}
                <button
                  onClick={() =>
                    setDayModes((prev) => ({ ...prev, [day]: "neutral" }))
                  }
                  className="ml-0.5 hover:text-brutal-black transition-colors"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Day-level Simulation Results */}
        {!hasData ? (
          <div className="rounded-md border-[2px] border-dashed border-brutal-black/20 py-6 text-center">
            <p className="font-mono text-sm text-brutal-black/40">
              Enter your attendance data to start simulating
            </p>
          </div>
        ) : simulation ? (
          <div className="rounded-lg border-[3px] border-brutal-black bg-cream p-4">
            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="text-center">
                <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                  New %
                </p>
                <p
                  className={`font-heading text-2xl font-extrabold ${
                    simulation.newPercentage >= attendance.targetPercentage
                      ? "text-card-green"
                      : "text-card-coral"
                  }`}
                >
                  {simulation.newPercentage.toFixed(1)}%
                </p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                  Change
                </p>
                <p
                  className={`font-heading text-2xl font-extrabold ${
                    simulation.delta >= 0 ? "text-card-green" : "text-card-coral"
                  }`}
                >
                  {simulation.delta >= 0 ? "+" : ""}
                  {simulation.delta.toFixed(1)}%
                </p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                  Extra Classes
                </p>
                <p className="font-heading text-2xl font-extrabold text-brutal-black">
                  {simulation.extraClassesNeeded}
                </p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                  Extra Days
                </p>
                <p className="font-heading text-2xl font-extrabold text-brutal-black">
                  {simulation.extraDaysNeeded}
                </p>
              </div>
            </div>

            {/* Impact Message */}
            <div
              className={`rounded-md border-[3px] border-brutal-black px-4 py-3 font-mono text-sm font-medium ${
                simulation.newPercentage >= attendance.targetPercentage
                  ? "bg-card-green/10 text-card-green"
                  : "bg-card-coral/10 text-card-coral"
              }`}
            >
              {simulation.message}
            </div>
          </div>
        ) : (
          <div className="rounded-md border-[2px] border-dashed border-brutal-black/20 py-6 text-center">
            <p className="font-mono text-sm text-brutal-black/40">
              Select days above to see the impact on your attendance
            </p>
          </div>
        )}

        {/* ─── Today's Classes Section ─────────────────────────────────────── */}
        {todayName && todaySlots.length > 0 && (
          <div className="mt-6 pt-5 border-t-[3px] border-brutal-black/10">
            <h3 className="font-heading text-base font-extrabold text-brutal-black mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border-[2px] border-brutal-black bg-accent-yellow text-[10px] font-mono font-bold shadow-brutal-sm">
                📅
              </span>
              Today&apos;s Classes
              <span className="ml-auto rounded-md border-[2px] border-brutal-black bg-cream px-2 py-0.5 font-mono text-[10px] font-bold text-brutal-black/60">
                {todayName} · {todaySlots.length} class{todaySlots.length !== 1 ? "es" : ""}
              </span>
            </h3>

            <p className="font-mono text-xs text-brutal-black/50 mb-3">
              Tap individual classes to see per-class impact
            </p>

            {/* Class Toggles */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4">
              {todaySlots.map((slot, idx) => {
                const mode = classModes[slot.id] ?? "neutral";

                let bgClass: string;
                if (mode === "skip") {
                  bgClass = "bg-card-coral text-white shadow-brutal-sm";
                } else if (mode === "attend") {
                  bgClass = "bg-card-green text-white shadow-brutal-sm";
                } else {
                  bgClass = "bg-white text-brutal-black hover:bg-card-lavender/10";
                }

                return (
                  <button
                    key={slot.id}
                    onClick={() => toggleClass(slot.id)}
                    className={`rounded-md border-[3px] border-brutal-black py-2.5 px-2
                               font-mono text-sm font-bold transition-all relative overflow-hidden
                      ${bgClass}`}
                  >
                    <span className="block text-xs font-extrabold truncate" title={slot.label}>
                      {slot.label.length <= 4 ? slot.label : slot.label.slice(0, 3) + "."}
                    </span>
                    <span className="block text-[10px] mt-0.5 opacity-70">
                      {slot.startTime} – {slot.endTime}
                    </span>
                    <span className="block text-[9px] mt-0.5 opacity-50">
                      Slot {idx + 1}
                    </span>
                    {mode !== "neutral" && (
                      <span
                        className={`absolute -top-1.5 -right-1.5 flex h-5 min-w-[2.5rem] items-center justify-center rounded-full border-[2px] border-brutal-black bg-white px-1 text-[9px] font-extrabold shadow-sm z-10
                        ${mode === "skip" ? "text-card-coral" : "text-card-green"}`}
                      >
                        {mode === "skip" ? "🚫 SKIP" : "✓ GO"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Class-level selection summary */}
            {hasClassSelection && (
              <div className="flex flex-wrap gap-2 mb-4">
                {todaySlots
                  .filter((s) => classModes[s.id] === "skip")
                  .map((slot) => (
                    <span
                      key={slot.id}
                      className="inline-flex items-center gap-1 rounded-md border-[2px] border-card-coral bg-card-coral/10 px-2 py-0.5 font-mono text-[10px] font-bold text-card-coral"
                    >
                      🚫 {slot.label.length <= 4 ? slot.label : slot.label.slice(0, 3) + "."} ({slot.startTime})
                      <button
                        onClick={() =>
                          setClassModes((prev) => {
                            const next = { ...prev };
                            delete next[slot.id];
                            return next;
                          })
                        }
                        className="ml-0.5 hover:text-brutal-black transition-colors"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                {todaySlots
                  .filter((s) => classModes[s.id] === "attend")
                  .map((slot) => (
                    <span
                      key={slot.id}
                      className="inline-flex items-center gap-1 rounded-md border-[2px] border-card-green bg-card-green/10 px-2 py-0.5 font-mono text-[10px] font-bold text-card-green"
                    >
                      ✓ {slot.label.length <= 4 ? slot.label : slot.label.slice(0, 3) + "."} ({slot.startTime})
                      <button
                        onClick={() =>
                          setClassModes((prev) => {
                            const next = { ...prev };
                            delete next[slot.id];
                            return next;
                          })
                        }
                        className="ml-0.5 hover:text-brutal-black transition-colors"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
              </div>
            )}

            {/* Class-level Simulation Results */}
            {hasData && classSimulation ? (
              <div className="rounded-lg border-[3px] border-brutal-black bg-cream p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="text-center">
                    <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                      New %
                    </p>
                    <p
                      className={`font-heading text-2xl font-extrabold ${
                        classSimulation.newPercentage >= attendance.targetPercentage
                          ? "text-card-green"
                          : "text-card-coral"
                      }`}
                    >
                      {classSimulation.newPercentage.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                      Change
                    </p>
                    <p
                      className={`font-heading text-2xl font-extrabold ${
                        classSimulation.delta >= 0 ? "text-card-green" : "text-card-coral"
                      }`}
                    >
                      {classSimulation.delta >= 0 ? "+" : ""}
                      {classSimulation.delta.toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                      Extra Classes
                    </p>
                    <p className="font-heading text-2xl font-extrabold text-brutal-black">
                      {classSimulation.extraClassesNeeded}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                      Extra Days
                    </p>
                    <p className="font-heading text-2xl font-extrabold text-brutal-black">
                      {classSimulation.extraDaysNeeded}
                    </p>
                  </div>
                </div>

                <div
                  className={`rounded-md border-[3px] border-brutal-black px-4 py-3 font-mono text-sm font-medium ${
                    classSimulation.newPercentage >= attendance.targetPercentage
                      ? "bg-card-green/10 text-card-green"
                      : "bg-card-coral/10 text-card-coral"
                  }`}
                >
                  {classSimulation.message}
                </div>
              </div>
            ) : hasData && !hasClassSelection ? (
              <div className="rounded-md border-[2px] border-dashed border-brutal-black/20 py-4 text-center">
                <p className="font-mono text-xs text-brutal-black/40">
                  Tap classes above to simulate per-class impact
                </p>
              </div>
            ) : null}
          </div>
        )}

        {/* No classes today message */}
        {todayName && todaySlots.length === 0 && (
          <div className="mt-6 pt-5 border-t-[3px] border-brutal-black/10">
            <h3 className="font-heading text-base font-extrabold text-brutal-black mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border-[2px] border-brutal-black bg-accent-yellow text-[10px] font-mono font-bold shadow-brutal-sm">
                📅
              </span>
              Today&apos;s Classes
            </h3>
            <div className="rounded-md border-[2px] border-dashed border-brutal-black/20 py-4 text-center">
              <p className="font-mono text-xs text-brutal-black/40">
                No classes scheduled for {todayName}
              </p>
            </div>
          </div>
        )}

        {/* Sunday / no day message */}
        {!todayName && (
          <div className="mt-6 pt-5 border-t-[3px] border-brutal-black/10">
            <h3 className="font-heading text-base font-extrabold text-brutal-black mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border-[2px] border-brutal-black bg-accent-yellow text-[10px] font-mono font-bold shadow-brutal-sm">
                📅
              </span>
              Today&apos;s Classes
            </h3>
            <div className="rounded-md border-[2px] border-dashed border-brutal-black/20 py-4 text-center">
              <p className="font-mono text-xs text-brutal-black/40">
                It&apos;s Sunday — no classes today! 🎉
              </p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

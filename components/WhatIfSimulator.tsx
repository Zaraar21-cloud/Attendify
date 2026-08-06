"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useAttendify } from "@/lib/context";
import { type Weekday, type TimeSlot, WEEKDAYS } from "@/lib/types";
import {
  simulateSkip,
  simulateAttend,
  simulateMixed,
  simulateClassChanges,
  classesOnDay,
  classesNeededForTarget,
} from "@/lib/engine";

type DayMode = "neutral" | "skip" | "attend";
type ClassMode = "neutral" | "skip" | "attend";
type BrushMode = "skip" | "attend";

export default function WhatIfSimulator() {
  const { state } = useAttendify();
  const { attendance, timetable } = state;

  const modeToggleRef = useRef<HTMLDivElement>(null);
  const [showFloatingBrush, setShowFloatingBrush] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowFloatingBrush(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0, rootMargin: "-10px 0px 0px 0px" }
    );

    const currentRef = modeToggleRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }
    
    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, []);

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
  // Month simulator modes (keyed by day number)
  const [monthModes, setMonthModes] = useState<Record<number, ClassMode>>({});

  // Month details
  const todayDate = useMemo(() => new Date(), []);
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth();
  const currentDate = todayDate.getDate();
  const currentHour = todayDate.getHours();

  const daysInMonth = useMemo(() => new Date(currentYear, currentMonth + 1, 0).getDate(), [currentYear, currentMonth]);
  const monthDays = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const isDayDisabled = useCallback((dayNum: number) => {
    const date = new Date(currentYear, currentMonth, dayNum);
    const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday

    if (dayNum < currentDate) return true; // Past day
    if (dayNum === currentDate && currentHour >= 16) return true; // Past 4 PM today
    if (dayOfWeek === 0) return true; // Sunday

    if (dayOfWeek === 6) {
      // 2nd or 4th Saturday
      const weekOfMonth = Math.ceil(dayNum / 7);
      if (weekOfMonth === 2 || weekOfMonth === 4) return true;
    }

    return false;
  }, [currentYear, currentMonth, currentDate, currentHour]);
  const monthSimClasses = useMemo(() => {
    let skipped = 0;
    let attended = 0;
    const WEEKDAY_MAP: Record<number, Weekday> = {
      1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
    };

    for (const [dayStr, mode] of Object.entries(monthModes)) {
      const dayNum = parseInt(dayStr, 10);
      const date = new Date(currentYear, currentMonth, dayNum);
      const dayOfWeekIndex = date.getDay();

      const weekdayName = WEEKDAY_MAP[dayOfWeekIndex];
      if (weekdayName) {
        const classCount = classesOnDay(timetable, weekdayName);
        if (mode === "skip") skipped += classCount;
        else if (mode === "attend") attended += classCount;
      }
    }
    return { skipped, attended };
  }, [monthModes, currentYear, currentMonth, timetable]);


  const targetRequiredClasses = useMemo(() => {
    if (attendance.totalCount === 0) return 0;
    
    const simAttended = attendance.attendedCount + monthSimClasses.attended;
    const simTotal = attendance.totalCount + monthSimClasses.attended + monthSimClasses.skipped;

    return classesNeededForTarget(
      simAttended,
      simTotal,
      attendance.targetPercentage
    );
  }, [attendance, monthSimClasses]);

  const requiredDaysToHighlight = useMemo(() => {
    if (targetRequiredClasses <= 0) return new Set<number>();

    let classesGathered = 0;
    const requiredDays = new Set<number>();

    const WEEKDAY_MAP: Record<number, Weekday> = {
      1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
    };

    for (let dayNum = currentDate; dayNum <= daysInMonth; dayNum++) {
      if (isDayDisabled(dayNum)) continue; // skip disabled days (past days, sundays, etc)
      if (monthModes[dayNum] !== "neutral" && monthModes[dayNum] !== undefined) continue; // skip days already manually selected

      const date = new Date(currentYear, currentMonth, dayNum);
      const dayOfWeekIndex = date.getDay();
      const weekdayName = WEEKDAY_MAP[dayOfWeekIndex];

      if (weekdayName) {
        const classCount = classesOnDay(timetable, weekdayName);
        if (classCount > 0) {
          requiredDays.add(dayNum);
          classesGathered += classCount;
          if (classesGathered >= targetRequiredClasses) {
            break;
          }
        }
      }
    }

    return requiredDays;
  }, [targetRequiredClasses, currentDate, daysInMonth, isDayDisabled, currentYear, currentMonth, timetable, monthModes]);

  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragAction, setDragAction] = useState<"paint" | "erase" | null>(null);

  const handleDayMouseDown = useCallback((dayNum: number) => {
    if (isDayDisabled(dayNum)) return;
    setIsMouseDown(true);
    
    setMonthModes((prev) => {
      const current = prev[dayNum] ?? "neutral";
      const action = current === brushMode ? "erase" : "paint";
      setDragAction(action);
      
      if (action === "erase") {
        const next = { ...prev };
        delete next[dayNum];
        return next;
      }
      return { ...prev, [dayNum]: brushMode };
    });
  }, [brushMode, isDayDisabled]);

  const handleDayMouseEnter = useCallback((dayNum: number) => {
    if (!isMouseDown || isDayDisabled(dayNum) || !dragAction) return;
    
    setMonthModes((prev) => {
      if (dragAction === "erase") {
        if (prev[dayNum] === brushMode) {
          const next = { ...prev };
          delete next[dayNum];
          return next;
        }
        return prev;
      } else {
        if (prev[dayNum] === brushMode) return prev;
        return { ...prev, [dayNum]: brushMode };
      }
    });
  }, [isMouseDown, dragAction, brushMode, isDayDisabled]);

  const selectAllSelectableDays = useCallback(() => {
    setMonthModes((prev) => {
      const next = { ...prev };
      for (let i = 1; i <= daysInMonth; i++) {
        if (!isDayDisabled(i)) {
          next[i] = "attend";
        }
      }
      return next;
    });
  }, [daysInMonth, isDayDisabled]);


  // --- Weekly Classes Swipe Handlers ---
  const handleWeeklyMouseDown = useCallback((day: Weekday, disabled: boolean) => {
    if (disabled) return;
    setIsMouseDown(true);
    setDayModes((prev) => {
      const current = prev[day] ?? "neutral";
      const action = current === brushMode ? "erase" : "paint";
      setDragAction(action);
      
      if (action === "erase") {
        return { ...prev, [day]: "neutral" };
      }
      return { ...prev, [day]: brushMode };
    });
  }, [brushMode]);

  const handleWeeklyMouseEnter = useCallback((day: Weekday, disabled: boolean) => {
    if (!isMouseDown || disabled || !dragAction) return;
    setDayModes((prev) => {
      if (dragAction === "erase") {
        if (prev[day] === brushMode) return { ...prev, [day]: "neutral" };
        return prev;
      } else {
        if (prev[day] === brushMode) return prev;
        return { ...prev, [day]: brushMode };
      }
    });
  }, [isMouseDown, dragAction, brushMode]);

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
    setMonthModes({});
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

  // --- Today's Classes Swipe Handlers ---
  const handleClassMouseDown = useCallback((slotId: string) => {
    setIsMouseDown(true);
    setClassModes((prev) => {
      const current = prev[slotId] ?? "neutral";
      const action = current === brushMode ? "erase" : "paint";
      setDragAction(action);
      
      if (action === "erase") {
        const next = { ...prev };
        delete next[slotId];
        return next;
      }
      return { ...prev, [slotId]: brushMode };
    });
  }, [brushMode]);

  const handleClassMouseEnter = useCallback((slotId: string) => {
    if (!isMouseDown || !dragAction) return;
    setClassModes((prev) => {
      if (dragAction === "erase") {
        if (prev[slotId] === brushMode) {
          const next = { ...prev };
          delete next[slotId];
          return next;
        }
        return prev;
      } else {
        if (prev[slotId] === brushMode) return prev;
        return { ...prev, [slotId]: brushMode };
      }
    });
  }, [isMouseDown, dragAction, brushMode]);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsMouseDown(false);
      setDragAction(null);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isMouseDown) return;
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!target) return;

      const buttonTarget = target.closest("button");
      if (buttonTarget) {
        const weeklyDay = buttonTarget.getAttribute("data-weekly-day");
        if (weeklyDay) {
          const disabled = buttonTarget.hasAttribute("data-disabled");
          handleWeeklyMouseEnter(weeklyDay as Weekday, disabled);
          return;
        }

        const classSlot = buttonTarget.getAttribute("data-class-slot");
        if (classSlot) {
          handleClassMouseEnter(classSlot);
          return;
        }

        const monthDay = buttonTarget.getAttribute("data-month-day");
        if (monthDay) {
          handleDayMouseEnter(parseInt(monthDay, 10));
          return;
        }
      }
    };

    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchend", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchend", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isMouseDown, handleWeeklyMouseEnter, handleClassMouseEnter, handleDayMouseEnter]);

  // Derive per-class skip/attend counts
  const classSkippedCount = useMemo(
    () => Object.values(classModes).filter((m) => m === "skip").length,
    [classModes]
  );
  const classAttendedCount = useMemo(
    () => Object.values(classModes).filter((m) => m === "attend").length,
    [classModes]
  );

  const hasPerClassSelection = Object.values(classModes).some(m => m !== "neutral");
  const hasMonthSelection = Object.values(monthModes).some(m => m !== "neutral");
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

  // Run month-level simulation
  const monthSimulation = useMemo(() => {
    if (!hasMonthSelection || attendance.totalCount === 0) return null;
    return simulateClassChanges(
      attendance,
      timetable,
      monthSimClasses.skipped,
      monthSimClasses.attended
    );
  }, [hasMonthSelection, attendance, timetable, monthSimClasses]);

  const requiredDaysSimulation = useMemo(() => {
    if (requiredDaysToHighlight.size === 0 || attendance.totalCount === 0) return null;
    let attended = 0;
    const WEEKDAY_MAP: Record<number, Weekday> = {
      1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
    };
    for (const dayNum of requiredDaysToHighlight) {
      const date = new Date(currentYear, currentMonth, dayNum);
      const weekdayName = WEEKDAY_MAP[date.getDay()];
      if (weekdayName) {
        attended += classesOnDay(timetable, weekdayName);
      }
    }
    const sim = simulateClassChanges(
      attendance,
      timetable,
      0, // skipped
      attended
    );
    return {
      ...sim,
      attendedClasses: attended,
    };
  }, [requiredDaysToHighlight, attendance, timetable, currentYear, currentMonth]);

  const allSelectableDaysSelected = useMemo(() => {
    let selectableCount = 0;
    let selectedCount = 0;
    for (let i = 1; i <= daysInMonth; i++) {
      if (!isDayDisabled(i)) {
        selectableCount++;
        if (monthModes[i] === "attend") {
          selectedCount++;
        }
      }
    }
    return selectableCount > 0 && selectableCount === selectedCount;
  }, [daysInMonth, isDayDisabled, monthModes]);

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
        <div ref={modeToggleRef} className="flex mb-4 rounded-md border-[3px] border-brutal-black overflow-hidden">
          <button
            onClick={() => setBrushMode("skip")}
            className={`flex-1 py-2 font-mono text-sm font-bold transition-colors
              ${brushMode === "skip"
                ? "bg-card-coral text-white"
                : "bg-white text-brutal-black/50 hover:bg-cream"
              }`}
          >
            🚫 Skip
          </button>
          <button
            onClick={() => setBrushMode("attend")}
            className={`flex-1 py-2 font-mono text-sm font-bold border-l-[3px] border-brutal-black transition-colors
              ${brushMode === "attend"
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

        {/* ─── Month Simulator Section ─────────────────────────────────────── */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h3 className="font-heading text-base font-extrabold text-brutal-black flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border-[2px] border-brutal-black bg-accent-blue text-white text-[10px] font-mono font-bold shadow-brutal-sm">
                🗓️
              </span>
              Monthly Classes
              <span className="ml-auto sm:ml-2 rounded-md border-[2px] border-brutal-black bg-cream px-2 py-0.5 font-mono text-[10px] font-bold text-brutal-black/60">
                {todayDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
            </h3>

            <div className="flex gap-2 self-start sm:self-auto">
              {hasMonthSelection && (
                <button
                  onClick={() => setMonthModes({})}
                  className="rounded-md border-[2px] border-brutal-black bg-cream px-3 py-1.5
                             font-mono text-xs font-bold text-brutal-black/60 hover:bg-brutal-black hover:text-white transition-colors"
                >
                  ✕ Clear
                </button>
              )}
              {!allSelectableDaysSelected && (
                <button
                  onClick={selectAllSelectableDays}
                  className="rounded-md border-[2px] border-brutal-black bg-card-green/10 px-3 py-1.5
                             font-mono text-xs font-bold text-card-green hover:bg-card-green hover:text-white transition-colors"
                >
                  ✓ Select All to Attend
                </button>
              )}
            </div>
          </div>

          <p className="font-mono text-xs text-brutal-black/50 mb-3">
            Simulate attending or skipping upcoming days this month.
          </p>

          <div className="max-w-[280px] sm:max-w-[320px] mx-auto mt-2 mb-6 touch-none">
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-2">
              {/* Weekday Headers */}
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="text-center font-mono text-[10px] font-bold text-brutal-black/50">
                  {d}
                </div>
              ))}

              {/* Empty slots for start of month */}
              {Array.from({ length: new Date(currentYear, currentMonth, 1).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}

              {/* Days */}
              {monthDays.map((dayNum) => {
                const disabled = isDayDisabled(dayNum);
                const mode = monthModes[dayNum] ?? "neutral";
                const isRequired = requiredDaysToHighlight.has(dayNum);

                let bgClass: string;
                if (mode === "skip") {
                  bgClass = "bg-card-coral text-white shadow-brutal-sm";
                } else if (mode === "attend") {
                  bgClass = "bg-card-green text-white shadow-brutal-sm";
                } else if (isRequired) {
                  bgClass = "bg-orange-200 text-brutal-black hover:border-orange-400 hover:shadow-brutal-sm";
                } else {
                  bgClass = disabled
                    ? "bg-cream/50 text-brutal-black/20 cursor-not-allowed"
                    : "bg-white text-brutal-black hover:bg-card-lavender/10";
                }

                return (
                  <button
                    key={dayNum}
                    onPointerDown={() => handleDayMouseDown(dayNum)}
                    onPointerEnter={() => handleDayMouseEnter(dayNum)}
                    data-month-day={dayNum}
                    disabled={disabled}
                    className={`relative aspect-square rounded-md border-[2px] border-brutal-black flex flex-col items-center justify-center font-mono transition-all select-none
                    ${bgClass}`}
                  >
                    <span className="text-sm font-extrabold">{dayNum}</span>
                    {!disabled && mode !== "neutral" && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full border-[1px] border-brutal-black bg-white">
                        {mode === "skip" ? (
                          <span className="text-[6px] text-card-coral">🚫</span>
                        ) : (
                          <span className="text-[6px] text-card-green">✓</span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          {requiredDaysToHighlight.size > 0 && (
            <div className="flex items-center gap-2 mb-4 max-w-[280px] sm:max-w-[320px] mx-auto">
              <span className="block h-3 w-3 rounded-sm bg-orange-200 border border-brutal-black"></span>
              <span className="font-mono text-[10px] font-bold text-brutal-black/70">
                Required to attend to secure target
              </span>
            </div>
          )}

          {/* Month-level selection summary */}
          {hasMonthSelection && (
            <div className="flex flex-wrap gap-2 mb-4">
              {Object.entries(monthModes).map(([dayStr, mode]) => {
                const dayNum = parseInt(dayStr, 10);
                if (mode === "neutral") return null;
                return (
                  <span
                    key={dayStr}
                    className={`inline-flex items-center gap-1 rounded-md border-[2px] px-2 py-0.5 font-mono text-[10px] font-bold ${mode === "skip"
                      ? "border-card-coral bg-card-coral/10 text-card-coral"
                      : "border-card-green bg-card-green/10 text-card-green"
                      }`}
                  >
                    {mode === "skip" ? "🚫" : "✓"} {dayNum} {new Date(currentYear, currentMonth, dayNum).toLocaleString('default', { month: 'short' })}
                    <button
                      onClick={() =>
                        setMonthModes((prev) => {
                          const next = { ...prev };
                          delete next[dayNum];
                          return next;
                        })
                      }
                      className="ml-0.5 hover:text-brutal-black transition-colors"
                    >
                      ✕
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {/* Month-level Simulation Results */}
          {hasData && monthSimulation ? (
            <div className="rounded-lg border-[3px] border-brutal-black bg-cream p-4 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="text-center">
                  <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                    New %
                  </p>
                  <p
                    className={`font-heading text-2xl font-extrabold ${monthSimulation.newPercentage >= attendance.targetPercentage
                      ? "text-card-green"
                      : "text-card-coral"
                      }`}
                  >
                    {monthSimulation.newPercentage.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                    Change
                  </p>
                  <p
                    className={`font-heading text-2xl font-extrabold ${monthSimulation.delta >= 0 ? "text-card-green" : "text-card-coral"
                      }`}
                  >
                    {monthSimulation.delta >= 0 ? "+" : ""}
                    {monthSimulation.delta.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                    Extra Classes
                  </p>
                  <p className="font-heading text-2xl font-extrabold text-brutal-black">
                    {monthSimulation.extraClassesNeeded}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                    Extra Days
                  </p>
                  <p className="font-heading text-2xl font-extrabold text-brutal-black">
                    {monthSimulation.extraDaysNeeded}
                  </p>
                </div>
              </div>

              <div
                className={`rounded-md border-[3px] border-brutal-black px-4 py-3 font-mono text-sm font-medium ${monthSimulation.newPercentage >= attendance.targetPercentage
                  ? "bg-card-green/10 text-card-green"
                  : "bg-card-coral/10 text-card-coral"
                  }`}
              >
                {monthSimulation.message}
              </div>
            </div>
          ) : hasData && !hasMonthSelection && requiredDaysSimulation ? (
            <div className="rounded-lg border-[3px] border-brutal-black bg-orange-50 p-4 mb-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="text-center">
                  <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                    Expected %
                  </p>
                  <p
                    className={`font-heading text-2xl font-extrabold ${requiredDaysSimulation.newPercentage >= attendance.targetPercentage
                      ? "text-orange-500"
                      : "text-card-coral"
                      }`}
                  >
                    {requiredDaysSimulation.newPercentage.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                    Change
                  </p>
                  <p
                    className={`font-heading text-2xl font-extrabold ${requiredDaysSimulation.delta >= 0 ? "text-orange-500" : "text-card-coral"
                      }`}
                  >
                    {requiredDaysSimulation.delta >= 0 ? "+" : ""}
                    {requiredDaysSimulation.delta.toFixed(1)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                    Classes
                  </p>
                  <p className="font-heading text-2xl font-extrabold text-brutal-black">
                    +{requiredDaysSimulation.attendedClasses}
                  </p>
                </div>
                <div className="text-center">
                  <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                    Days
                  </p>
                  <p className="font-heading text-2xl font-extrabold text-brutal-black">
                    +{requiredDaysToHighlight.size}
                  </p>
                </div>
              </div>

              <div className="rounded-md border-[3px] border-brutal-black px-4 py-3 font-mono text-sm font-medium bg-orange-100 text-orange-700">
                <span className="font-bold">Required Days Impact:</span> {requiredDaysSimulation.message}
              </div>
            </div>
          ) : hasData && !hasMonthSelection ? (
            <div className="rounded-md border-[2px] border-dashed border-brutal-black/20 py-4 text-center mb-4">
              <p className="font-mono text-xs text-brutal-black/40">
                Select days in the month calendar to see the impact
              </p>
            </div>
          ) : null}
        </div>

        {/* ─── Weekly Classes Section ─────────────────────────────────────── */}
        <div className="mt-6 pt-5 border-t-[3px] border-brutal-black/10">
          <h3 className="font-heading text-base font-extrabold text-brutal-black flex items-center gap-2 mb-3">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border-[2px] border-brutal-black bg-accent-pink text-white text-[10px] font-mono font-bold shadow-brutal-sm">
              🗓️
            </span>
            Weekly Classes
          </h3>
          <p className="font-mono text-xs text-brutal-black/50 mb-3">
            Simulate attending or skipping days for the current week.
          </p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-5 touch-none">
          {WEEKDAYS.map((day) => {
            const classes = classesOnDay(timetable, day);
            const mode = dayModes[day];

            const WEEKDAY_INDEX: Record<Weekday, number> = {
              Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
            };
            const currentDayIndex = new Date().getDay(); // 0=Sun, 1=Mon...6=Sat
            const isToday = currentDayIndex === WEEKDAY_INDEX[day];
            const isPast = (currentDayIndex > 0 && WEEKDAY_INDEX[day] < currentDayIndex) || (isToday && currentHour >= 16);

            let isWeeklyDisabled = classes === 0;

            // Grey out 2nd and 4th Saturday for the weekly view
            if (day === "Saturday") {
              const diffToSat = 6 - currentDayIndex;
              const satDate = new Date(currentYear, currentMonth, currentDate + diffToSat);
              if (satDate.getMonth() === currentMonth) {
                const weekOfMonth = Math.ceil(satDate.getDate() / 7);
                if (weekOfMonth === 2 || weekOfMonth === 4) {
                  isWeeklyDisabled = true;
                }
              }
            }

            const disabled = isWeeklyDisabled;

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
                onPointerDown={() => handleWeeklyMouseDown(day, disabled)}
                onPointerEnter={() => handleWeeklyMouseEnter(day, disabled)}
                data-weekly-day={day}
                {...(disabled ? { "data-disabled": "true" } : {})}
                disabled={disabled}
                className={`rounded-md border-[3px] border-brutal-black py-3 px-2
                           font-mono text-sm font-bold transition-all relative overflow-hidden select-none
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
                  className={`font-heading text-2xl font-extrabold ${simulation.newPercentage >= attendance.targetPercentage
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
                  className={`font-heading text-2xl font-extrabold ${simulation.delta >= 0 ? "text-card-green" : "text-card-coral"
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
              className={`rounded-md border-[3px] border-brutal-black px-4 py-3 font-mono text-sm font-medium ${simulation.newPercentage >= attendance.targetPercentage
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mb-4 touch-none">
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
                    onPointerDown={() => handleClassMouseDown(slot.id)}
                    onPointerEnter={() => handleClassMouseEnter(slot.id)}
                    data-class-slot={slot.id}
                    className={`rounded-md border-[3px] border-brutal-black py-2.5 px-2
                               font-mono text-sm font-bold transition-all relative overflow-hidden select-none
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
            {hasPerClassSelection && (
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
                      className={`font-heading text-2xl font-extrabold ${classSimulation.newPercentage >= attendance.targetPercentage
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
                      className={`font-heading text-2xl font-extrabold ${classSimulation.delta >= 0 ? "text-card-green" : "text-card-coral"
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
                  className={`rounded-md border-[3px] border-brutal-black px-4 py-3 font-mono text-sm font-medium ${classSimulation.newPercentage >= attendance.targetPercentage
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
                  Tap classes above or select days in the month to simulate impact
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

      {/* Floating Brush Toggle */}
      <div
        className={`fixed bottom-6 right-6 z-50 flex flex-col gap-2 rounded-md border-[3px] border-brutal-black bg-white p-2 shadow-brutal transition-all duration-300 ${
          showFloatingBrush
            ? "translate-y-0 opacity-100"
            : "translate-y-10 opacity-0 pointer-events-none"
        }`}
      >
        <p className="text-center font-mono text-[10px] font-bold text-brutal-black/50 uppercase mb-1">
          Brush Mode
        </p>
        <button
          onClick={() => setBrushMode("skip")}
          className={`flex h-10 w-24 items-center justify-center rounded-md border-[2px] border-brutal-black font-mono text-xs font-bold transition-colors ${
            brushMode === "skip"
              ? "bg-card-coral text-white"
              : "bg-white text-brutal-black/50 hover:bg-cream"
          }`}
        >
          🚫 Skip
        </button>
        <button
          onClick={() => setBrushMode("attend")}
          className={`flex h-10 w-24 items-center justify-center rounded-md border-[2px] border-brutal-black font-mono text-xs font-bold transition-colors ${
            brushMode === "attend"
              ? "bg-card-green text-white"
              : "bg-white text-brutal-black/50 hover:bg-cream"
          }`}
        >
          ✓ Attend
        </button>
      </div>
    </section>
  );
}

"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useAttendify } from "@/lib/context";
import { type Weekday, WEEKDAYS } from "@/lib/types";
import {
  simulateClassChanges,
  classesNeededForTarget,
} from "@/lib/engine";
import { supabase } from "@/lib/supabase";

type ClassMode = "neutral" | "skip" | "attend";
type BrushMode = "skip" | "attend" | "select";

export default function WhatIfSimulator() {
  const { state } = useAttendify();
  const { attendance, timetable } = state;

  const [brushMode, setBrushMode] = useState<BrushMode>("select");
  const [showBrush, setShowBrush] = useState(true);
  const calendarRef = useRef<HTMLDivElement>(null);

  // selectedDay is a day number in the current month
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // monthDayClassSelections: { dayNum: { slotId: ClassMode } }
  const [monthDayClassSelections, setMonthDayClassSelections] = useState<
    Record<number, Record<string, ClassMode>>
  >({});

  // Month details
  const todayDate = useMemo(() => new Date(), []);
  const currentYear = todayDate.getFullYear();
  const currentMonth = todayDate.getMonth();
  const currentDate = todayDate.getDate();
  const currentHour = todayDate.getHours();

  const daysInMonth = useMemo(() => new Date(currentYear, currentMonth + 1, 0).getDate(), [currentYear, currentMonth]);
  const monthDays = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const [holidays, setHolidays] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchHolidays = async () => {
      const { data, error } = await supabase.from("holidays").select("date, name");
      if (!error && data) {
        const holidayMap: Record<string, string> = {};
        data.forEach((h: { date: string, name: string }) => {
          holidayMap[h.date] = h.name;
        });
        setHolidays(holidayMap);
      }
    };
    fetchHolidays();
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowBrush(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (calendarRef.current) {
      observer.observe(calendarRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const isDayDisabled = useCallback((dayNum: number) => {
    const date = new Date(currentYear, currentMonth, dayNum);
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (holidays[formattedDate]) return true;
    const dayOfWeek = date.getDay();
    if (dayNum < currentDate) return true;
    if (dayNum === currentDate && currentHour >= 16) return true;
    if (dayOfWeek === 0) return true;
    if (dayOfWeek === 6) {
      const weekOfMonth = Math.ceil(dayNum / 7);
      if (weekOfMonth === 2 || weekOfMonth === 4) return true;
    }
    return false;
  }, [currentYear, currentMonth, currentDate, currentHour, holidays]);

  const getHolidayReason = useCallback((dayNum: number) => {
    const date = new Date(currentYear, currentMonth, dayNum);
    const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return holidays[formattedDate];
  }, [currentYear, currentMonth, holidays]);

  const WEEKDAY_MAP: Record<number, Weekday> = useMemo(() => ({
    1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday", 6: "Saturday",
  }), []);

  // Helper to get classes for a specific dayNum
  const getClassesForDay = useCallback((dayNum: number) => {
    const date = new Date(currentYear, currentMonth, dayNum);
    const weekday = WEEKDAY_MAP[date.getDay()];
    if (!weekday) return [];
    return timetable[weekday] ?? [];
  }, [currentYear, currentMonth, WEEKDAY_MAP, timetable]);

  // Aggregate stats from monthDayClassSelections
  const { totalSkipped, totalAttended } = useMemo(() => {
    let skipped = 0;
    let attended = 0;
    for (const slots of Object.values(monthDayClassSelections)) {
      for (const mode of Object.values(slots)) {
        if (mode === "skip") skipped++;
        else if (mode === "attend") attended++;
      }
    }
    return { totalSkipped: skipped, totalAttended: attended };
  }, [monthDayClassSelections]);

  const targetRequiredClasses = useMemo(() => {
    if (attendance.totalCount === 0) return 0;
    const simAttended = attendance.attendedCount + totalAttended;
    const simTotal = attendance.totalCount + totalAttended + totalSkipped;
    return classesNeededForTarget(
      simAttended,
      simTotal,
      attendance.targetPercentage
    );
  }, [attendance, totalAttended, totalSkipped]);

  // Determine required days to highlight based on total required classes
  const requiredDaysToHighlight = useMemo(() => {
    if (targetRequiredClasses <= 0) return new Set<number>();
    let classesGathered = 0;
    const requiredDays = new Set<number>();

    for (let dayNum = currentDate; dayNum <= daysInMonth; dayNum++) {
      if (isDayDisabled(dayNum)) continue;
      
      // Skip if user has already modified this day's classes
      const daySelections = monthDayClassSelections[dayNum];
      const hasCustom = daySelections && Object.values(daySelections).some(m => m !== "neutral");
      if (hasCustom) continue;

      const classCount = getClassesForDay(dayNum).length;
      if (classCount > 0) {
        requiredDays.add(dayNum);
        classesGathered += classCount;
        if (classesGathered >= targetRequiredClasses) {
          break;
        }
      }
    }
    return requiredDays;
  }, [targetRequiredClasses, currentDate, daysInMonth, isDayDisabled, monthDayClassSelections, getClassesForDay]);

  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragAction, setDragAction] = useState<"paint" | "erase" | null>(null);

  // Set all classes for a day to a mode
  const setAllClassesForDay = useCallback((dayNum: number, mode: ClassMode) => {
    const classes = getClassesForDay(dayNum);
    if (classes.length === 0) return;

    setMonthDayClassSelections((prev) => {
      const next = { ...prev };
      if (mode === "neutral") {
        delete next[dayNum];
      } else {
        const slotSelections: Record<string, ClassMode> = {};
        classes.forEach(c => { slotSelections[c.id] = mode; });
        next[dayNum] = slotSelections;
      }
      return next;
    });
  }, [getClassesForDay]);

  const handleDayMouseDown = useCallback((dayNum: number) => {
    if (isDayDisabled(dayNum)) return;
    
    if (brushMode === "select") {
      setSelectedDay((prev) => (prev === dayNum ? null : dayNum));
      return;
    }

    setIsMouseDown(true);
    // Logic for skip/attend brush on calendar
    const classes = getClassesForDay(dayNum);
    if (classes.length === 0) return;

    // determine if we are erasing or painting
    const daySelections = monthDayClassSelections[dayNum];
    // if all classes are currently the brush mode, we erase
    const allMatch = daySelections && classes.every(c => daySelections[c.id] === brushMode);
    
    const action = allMatch ? "erase" : "paint";
    setDragAction(action);

    setAllClassesForDay(dayNum, action === "erase" ? "neutral" : brushMode as ClassMode);
    if (action === "erase") {
      setSelectedDay(null);
    } else {
      setSelectedDay(dayNum);
    }

  }, [isDayDisabled, brushMode, getClassesForDay, monthDayClassSelections, setAllClassesForDay]);

  const handleDayMouseEnter = useCallback((dayNum: number) => {
    if (!isMouseDown || isDayDisabled(dayNum) || !dragAction || brushMode === "select") return;
    setAllClassesForDay(dayNum, dragAction === "erase" ? "neutral" : brushMode as ClassMode);
    if (dragAction === "erase") {
      setSelectedDay(null);
    } else {
      setSelectedDay(dayNum);
    }
  }, [isMouseDown, dragAction, brushMode, isDayDisabled, setAllClassesForDay]);

  // Global mouse up & pointer down
  useEffect(() => {
    const handleMouseUp = () => {
      setIsMouseDown(false);
      setDragAction(null);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const target = e.target as HTMLElement;
      if (target.closest("button")) return;
      if (target.closest("#selected-day-panel")) return;
      if (target.closest("#floating-brush")) return;
      
      setSelectedDay((prev) => (prev !== null ? null : prev));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isMouseDown) return;
      const touch = e.touches[0];
      const target = document.elementFromPoint(touch.clientX, touch.clientY);
      if (!target) return;

      const buttonTarget = target.closest("button");
      if (buttonTarget) {
        const monthDay = buttonTarget.getAttribute("data-month-day");
        if (monthDay) {
          handleDayMouseEnter(parseInt(monthDay, 10));
          return;
        }
      }
    };

    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("touchend", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("touchend", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [isMouseDown, handleDayMouseEnter]);


  const clearSelection = useCallback(() => {
    setMonthDayClassSelections({});
    setSelectedDay(null);
  }, []);

  const hasSelection = Object.keys(monthDayClassSelections).length > 0;
  const hasData = attendance.totalCount > 0;

  // Single outcome simulation
  const finalSimulation = useMemo(() => {
    if (!hasData) return null;
    if (totalSkipped === 0 && totalAttended === 0) {
        // If nothing is explicitly customized, but we might have required days
        if (requiredDaysToHighlight.size > 0) {
            let attended = 0;
            for (const dayNum of requiredDaysToHighlight) {
                attended += getClassesForDay(dayNum).length;
            }
            const sim = simulateClassChanges(attendance, timetable, 0, attended);
            return { ...sim, attendedClasses: attended, isRequiredOnly: true };
        }
        return null;
    }
    const sim = simulateClassChanges(attendance, timetable, totalSkipped, totalAttended);
    return { ...sim, attendedClasses: 0, isRequiredOnly: false };
  }, [hasData, totalSkipped, totalAttended, requiredDaysToHighlight, attendance, timetable, getClassesForDay]);


  // Helper to determine day color in calendar
  const getDayColorClass = (dayNum: number, disabled: boolean, isRequired: boolean) => {
    if (disabled) return "bg-cream/50 text-brutal-black/20 cursor-not-allowed border-brutal-black/20";
    
    const isSelected = selectedDay === dayNum;
    const selections = monthDayClassSelections[dayNum];
    const classes = getClassesForDay(dayNum);
    
    let base = "bg-white text-brutal-black border-brutal-black hover:bg-card-lavender/10";
    
    if (selections && classes.length > 0) {
      const skipCount = classes.filter(c => selections[c.id] === "skip").length;
      const attendCount = classes.filter(c => selections[c.id] === "attend").length;
      
      if (skipCount === classes.length) {
        base = "bg-card-coral text-white border-brutal-black shadow-brutal-sm";
      } else if (attendCount === classes.length) {
        base = "bg-card-green text-white border-brutal-black shadow-brutal-sm";
      } else if (skipCount > 0 || attendCount > 0) {
        // Partial customization (blue)
        base = "bg-card-blue text-white border-brutal-black shadow-brutal-sm";
      } else if (isRequired) {
        base = "bg-orange-200 text-brutal-black border-brutal-black hover:border-orange-400 hover:shadow-brutal-sm";
      }
    } else if (isRequired) {
      base = "bg-orange-200 text-brutal-black border-brutal-black hover:border-orange-400 hover:shadow-brutal-sm";
    }

    if (isSelected) {
      // Ring it yellow if selected
      base += " ring-4 ring-accent-yellow ring-offset-2 ring-offset-white z-10";
    }

    return base;
  };

  return (
    <section id="what-if-simulator" className="w-full pb-24">
      <h2 className="font-heading text-xl font-extrabold text-brutal-black mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border-[3px] border-brutal-black bg-card-lavender text-white text-sm font-mono shadow-brutal-sm">
          5
        </span>
        What-If Simulator
      </h2>

      <div className="rounded-lg border-[3px] border-brutal-black bg-white shadow-brutal p-5">
        
        {/* Header & Clear Button */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b-[3px] border-brutal-black/10">
          <h3 className="font-heading text-lg font-extrabold text-brutal-black flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border-[2px] border-brutal-black bg-card-blue text-white text-[10px] font-mono font-bold shadow-brutal-sm">
              🗓️
            </span>
            {todayDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </h3>
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

        <p className="font-mono text-xs text-brutal-black/50 mb-5">
          Simulate your attendance! Use the floating brush to paint the calendar, or use 'Select' to customize individual classes for a day.
        </p>

        {/* 2-Column Layout */}
        <div className="flex flex-col lg:flex-row justify-center gap-6 mb-6">
            
          {/* LEFT: CALENDAR */}
          <div className="flex-1" ref={calendarRef}>
            <div className="touch-none max-w-[320px] mx-auto">
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
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
                  const isRequired = requiredDaysToHighlight.has(dayNum);
                  const bgClass = getDayColorClass(dayNum, disabled, isRequired);
                  const holidayReason = getHolidayReason(dayNum);

                  // Compute indicator icon
                  let icon = null;
                  const selections = monthDayClassSelections[dayNum];
                  const classes = getClassesForDay(dayNum);
                  if (selections && classes.length > 0) {
                      const skipCount = classes.filter(c => selections[c.id] === "skip").length;
                      const attendCount = classes.filter(c => selections[c.id] === "attend").length;
                      if (skipCount === classes.length) icon = <span className="text-[6px] text-card-coral">🚫</span>;
                      else if (attendCount === classes.length) icon = <span className="text-[6px] text-card-green">✓</span>;
                      else if (skipCount > 0 || attendCount > 0) icon = <span className="text-[6px] text-card-blue">●</span>;
                  }

                  return (
                    <button
                      key={dayNum}
                      onPointerDown={() => handleDayMouseDown(dayNum)}
                      onPointerEnter={() => handleDayMouseEnter(dayNum)}
                      data-month-day={dayNum}
                      disabled={disabled}
                      title={holidayReason || undefined}
                      className={`relative aspect-square rounded-md border-[2px] flex flex-col items-center justify-center font-mono transition-all select-none ${bgClass}`}
                    >
                      <span className="text-sm sm:text-base font-extrabold">{dayNum}</span>
                      {!disabled && icon && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3 sm:h-4 sm:w-4 items-center justify-center rounded-full border-[1px] sm:border-[2px] border-brutal-black bg-white">
                          {icon}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            {requiredDaysToHighlight.size > 0 && (
              <div className="flex items-center justify-center gap-2 mt-4 max-w-[320px] mx-auto">
                <span className="block h-3 w-3 rounded-sm bg-orange-200 border border-brutal-black"></span>
                <span className="font-mono text-[10px] font-bold text-brutal-black/70">
                  Required to attend to secure target
                </span>
              </div>
            )}
          </div>

          {/* RIGHT: SELECTED DAY PANEL */}
          <div id="selected-day-panel" className="flex-1 lg:max-w-[320px] flex flex-col">
            <h3 className="font-heading text-base font-extrabold text-brutal-black flex flex-wrap items-center justify-between gap-2 mb-4 mt-6 lg:mt-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border-[2px] border-brutal-black bg-accent-yellow text-white text-[10px] font-mono font-bold shadow-brutal-sm">
                    📌
                  </span>
                  Selected Day
                </span>
                {selectedDay && (
                  <span className="font-mono text-sm font-bold text-brutal-black/70">
                     • {(() => {
                        const d = new Date(currentYear, currentMonth, selectedDay);
                        const weekday = d.toLocaleString('default', { weekday: 'long' });
                        const day = d.getDate();
                        const suffix = (day > 3 && day < 21) ? 'th' : ['th', 'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th'][day % 10];
                        const month = d.toLocaleString('default', { month: 'long' });
                        const year = d.getFullYear();
                        return `${weekday}, ${day}${suffix} ${month} ${year}`;
                     })()}
                  </span>
                )}
              </div>
              {selectedDay && (
                <button
                  onClick={() => setSelectedDay(null)}
                  className="rounded-md border-[2px] border-brutal-black bg-cream px-2 py-0.5 text-xs font-bold hover:bg-brutal-black hover:text-white transition-colors"
                  title="Unselect Day"
                >
                  ✕
                </button>
              )}
            </h3>

            {!selectedDay ? (
               <div className="rounded-md border-[2px] border-dashed border-brutal-black/20 py-8 text-center bg-cream/30 flex-1 flex items-center justify-center min-h-[200px]">
                  <p className="font-mono text-xs text-brutal-black/40 px-4">
                    Use the 'Select' brush and tap a day in the calendar to customize its classes.
                  </p>
               </div>
            ) : (
               <div className="rounded-lg border-[3px] border-brutal-black bg-white shadow-brutal-sm p-4">
                  {getClassesForDay(selectedDay).length === 0 ? (
                      <p className="font-mono text-xs text-brutal-black/40 text-center py-4">No classes scheduled for this day.</p>
                  ) : (
                      <>
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setAllClassesForDay(selectedDay, "skip")}
                                className="flex-1 rounded-md border-[2px] border-brutal-black bg-card-coral/10 py-1.5 font-mono text-[10px] font-bold text-card-coral hover:bg-card-coral hover:text-white transition-colors"
                            >
                                🚫 Skip All
                            </button>
                            <button
                                onClick={() => setAllClassesForDay(selectedDay, "attend")}
                                className="flex-1 rounded-md border-[2px] border-brutal-black bg-card-green/10 py-1.5 font-mono text-[10px] font-bold text-card-green hover:bg-card-green hover:text-white transition-colors"
                            >
                                ✓ Attend All
                            </button>
                            <button
                                onClick={() => setAllClassesForDay(selectedDay, "neutral")}
                                className="px-2 rounded-md border-[2px] border-brutal-black bg-cream font-mono text-[10px] font-bold text-brutal-black hover:bg-brutal-black hover:text-white transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            {getClassesForDay(selectedDay).map((slot, idx) => {
                                const mode = (monthDayClassSelections[selectedDay] || {})[slot.id] || "neutral";
                                
                                return (
                                    <div key={slot.id} className="flex items-center justify-between rounded-md border-[2px] border-brutal-black p-2 bg-white">
                                        <div className="flex flex-col overflow-hidden mr-2">
                                            <span className="font-mono text-xs font-extrabold truncate" title={slot.label}>
                                                {slot.label}
                                            </span>
                                            <span className="font-mono text-[9px] opacity-70">
                                                {slot.startTime} – {slot.endTime}
                                            </span>
                                        </div>
                                        <div className="flex border-[2px] border-brutal-black rounded-md overflow-hidden shrink-0">
                                            <button
                                                onClick={() => {
                                                    setMonthDayClassSelections(prev => {
                                                        const next = { ...prev };
                                                        if (!next[selectedDay]) next[selectedDay] = {};
                                                        next[selectedDay] = { ...next[selectedDay], [slot.id]: mode === "skip" ? "neutral" : "skip" };
                                                        return next;
                                                    });
                                                }}
                                                className={`w-7 h-7 flex items-center justify-center transition-colors ${mode === "skip" ? "bg-card-coral text-white" : "bg-cream text-brutal-black/30 hover:bg-card-coral/20"}`}
                                            >
                                                🚫
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setMonthDayClassSelections(prev => {
                                                        const next = { ...prev };
                                                        if (!next[selectedDay]) next[selectedDay] = {};
                                                        next[selectedDay] = { ...next[selectedDay], [slot.id]: mode === "attend" ? "neutral" : "attend" };
                                                        return next;
                                                    });
                                                }}
                                                className={`w-7 h-7 border-l-[2px] border-brutal-black flex items-center justify-center transition-colors ${mode === "attend" ? "bg-card-green text-white" : "bg-cream text-brutal-black/30 hover:bg-card-green/20"}`}
                                            >
                                                ✓
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                      </>
                  )}
               </div>
            )}
          </div>
        </div>

        {/* SINGLE CONSOLIDATED RESULTS WINDOW */}
        <div className="pt-6 border-t-[3px] border-brutal-black/10 mt-6">
            <h3 className="font-heading text-base font-extrabold text-brutal-black mb-4">
                Simulation Outcome
            </h3>
            
            {!hasData ? (
                <div className="rounded-md border-[2px] border-dashed border-brutal-black/20 py-6 text-center">
                    <p className="font-mono text-sm text-brutal-black/40">
                        Enter your attendance data to start simulating
                    </p>
                </div>
            ) : finalSimulation ? (
                <div className={`rounded-lg border-[3px] border-brutal-black p-4 md:p-6 ${finalSimulation.isRequiredOnly ? 'bg-orange-50' : 'bg-cream'}`}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="text-center">
                            <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                                {finalSimulation.isRequiredOnly ? 'Expected %' : 'New %'}
                            </p>
                            <p className={`font-heading text-3xl font-extrabold ${finalSimulation.newPercentage >= attendance.targetPercentage ? (finalSimulation.isRequiredOnly ? "text-orange-500" : "text-card-green") : "text-card-coral"}`}>
                                {finalSimulation.newPercentage.toFixed(1)}%
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                                Change
                            </p>
                            <p className={`font-heading text-3xl font-extrabold ${finalSimulation.delta >= 0 ? (finalSimulation.isRequiredOnly ? "text-orange-500" : "text-card-green") : "text-card-coral"}`}>
                                {finalSimulation.delta >= 0 ? "+" : ""}{finalSimulation.delta.toFixed(1)}%
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                                {finalSimulation.isRequiredOnly ? 'Classes' : 'Extra Classes'}
                            </p>
                            <p className="font-heading text-3xl font-extrabold text-brutal-black">
                                {finalSimulation.isRequiredOnly ? '+' + (finalSimulation as any).attendedClasses : finalSimulation.extraClassesNeeded}
                            </p>
                        </div>
                        <div className="text-center">
                            <p className="font-mono text-[10px] font-bold text-brutal-black/50 uppercase">
                                {finalSimulation.isRequiredOnly ? 'Days' : 'Extra Days'}
                            </p>
                            <p className="font-heading text-3xl font-extrabold text-brutal-black">
                                {finalSimulation.isRequiredOnly ? '+' + requiredDaysToHighlight.size : finalSimulation.extraDaysNeeded}
                            </p>
                        </div>
                    </div>

                    <div className={`rounded-md border-[3px] border-brutal-black px-4 py-3 font-mono text-sm font-medium ${
                        finalSimulation.isRequiredOnly 
                            ? "bg-orange-100 text-orange-700" 
                            : (finalSimulation.newPercentage >= attendance.targetPercentage ? "bg-card-green/10 text-card-green" : "bg-card-coral/10 text-card-coral")
                    }`}>
                        {finalSimulation.isRequiredOnly && <span className="font-bold">Required Days Impact: </span>}
                        {finalSimulation.message}
                    </div>
                </div>
            ) : (
                <div className="rounded-md border-[2px] border-dashed border-brutal-black/20 py-6 text-center">
                    <p className="font-mono text-sm text-brutal-black/40">
                        Customize days above to see the final impact on your attendance
                    </p>
                </div>
            )}
        </div>

      </div>

      {/* Floating Brush Toggle */}
      <div id="floating-brush" className={`fixed bottom-24 right-6 z-50 flex flex-col gap-2 rounded-md border-[3px] border-brutal-black bg-white p-2 shadow-brutal pointer-events-auto transition-all duration-300 ${
        showBrush ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none lg:opacity-100 lg:translate-y-0 lg:pointer-events-auto"
      }`}>
        <p className="text-center font-mono text-[10px] font-bold text-brutal-black/50 uppercase mb-1">
          Brush Mode
        </p>
        <button
          onClick={() => setBrushMode("select")}
          className={`flex h-10 w-24 items-center justify-center rounded-md border-[2px] border-brutal-black font-mono text-xs font-bold transition-colors ${
            brushMode === "select"
              ? "bg-accent-yellow text-brutal-black"
              : "bg-white text-brutal-black/50 hover:bg-cream"
          }`}
        >
          📌 Select
        </button>
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

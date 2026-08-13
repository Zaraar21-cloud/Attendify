"use client";

import React, { useState, useMemo, useCallback } from "react";
import { type CatchUpDay } from "@/lib/types";

interface CatchUpPopupProps {
  days: CatchUpDay[];
  onConfirm: (days: CatchUpDay[]) => void;
  onDismiss: () => void;
}

export default function CatchUpPopup({ days: initialDays, onConfirm, onDismiss }: CatchUpPopupProps) {
  const [days, setDays] = useState<CatchUpDay[]>(initialDays);

  const totals = useMemo(() => {
    const totalClasses = days.reduce((sum, d) => sum + d.totalClasses, 0);
    const attended = days.reduce((sum, d) => sum + d.attendedClasses, 0);
    const skipped = totalClasses - attended;
    return { totalClasses, attended, skipped };
  }, [days]);

  const updateDay = useCallback((index: number, attendedClasses: number) => {
    setDays(prev => prev.map((d, i) =>
      i === index
        ? { ...d, attendedClasses: Math.max(0, Math.min(d.totalClasses, attendedClasses)) }
        : d
    ));
  }, []);

  const setAllAttended = useCallback(() => {
    setDays(prev => prev.map(d => ({ ...d, attendedClasses: d.totalClasses })));
  }, []);

  const setAllSkipped = useCallback(() => {
    setDays(prev => prev.map(d => ({ ...d, attendedClasses: 0 })));
  }, []);

  const formatDate = (isoDate: string): string => {
    const date = new Date(isoDate + "T00:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleConfirm = () => {
    onConfirm(days);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-brutal-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
    >
      <div
        className="w-full max-w-lg rounded-lg border-[3px] border-brutal-black bg-white shadow-brutal-lg
                    max-h-[85vh] flex flex-col animate-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pb-4 border-b-[3px] border-brutal-black/10">
          <div className="flex items-center gap-3 mb-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border-[3px] border-brutal-black bg-accent-yellow text-lg shadow-brutal-sm">
              📋
            </span>
            <h2 className="font-heading text-xl font-extrabold text-brutal-black">
              Welcome Back!
            </h2>
          </div>
          <p className="font-mono text-sm text-brutal-black/60 mt-1">
            You were away for{" "}
            <span className="font-bold text-brutal-black">{days.length} day{days.length !== 1 ? "s" : ""}</span>
            {" "}&mdash; <span className="font-bold text-brutal-black">{totals.totalClasses} classes</span> were conducted.
            Please mark which classes you attended.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 px-5 pt-4">
          <button
            onClick={setAllAttended}
            className="flex-1 rounded-md border-[2px] border-brutal-black bg-card-green/10 px-3 py-1.5
                       font-mono text-xs font-bold text-card-green transition-colors hover:bg-card-green hover:text-white"
          >
            ✓ Mark All Attended
          </button>
          <button
            onClick={setAllSkipped}
            className="flex-1 rounded-md border-[2px] border-brutal-black bg-card-coral/10 px-3 py-1.5
                       font-mono text-xs font-bold text-card-coral transition-colors hover:bg-card-coral hover:text-white"
          >
            ✕ Mark All Skipped
          </button>
        </div>

        {/* Day List */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {days.map((day, index) => {
            const isFullyAttended = day.attendedClasses === day.totalClasses;
            const isFullySkipped = day.attendedClasses === 0;
            const borderColor = isFullyAttended
              ? "border-card-green"
              : isFullySkipped
                ? "border-card-coral"
                : "border-accent-yellow";
            const bgColor = isFullyAttended
              ? "bg-card-green/5"
              : isFullySkipped
                ? "bg-card-coral/5"
                : "bg-accent-yellow/5";

            return (
              <div
                key={day.date}
                className={`rounded-md border-[2px] ${borderColor} ${bgColor} p-3 transition-colors`}
              >
                <div className="flex items-center justify-between">
                  {/* Day info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm font-bold text-brutal-black truncate">
                      {day.weekday}, {formatDate(day.date)}
                    </p>
                    <p className="font-mono text-xs text-brutal-black/50">
                      {day.totalClasses} class{day.totalClasses !== 1 ? "es" : ""} scheduled
                    </p>
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-2 ml-3">
                    {/* Decrement */}
                    <button
                      onClick={() => updateDay(index, day.attendedClasses - 1)}
                      disabled={day.attendedClasses <= 0}
                      className="h-8 w-8 rounded-md border-[2px] border-brutal-black bg-white font-mono text-sm font-bold
                                 hover:bg-card-coral/20 active:bg-card-coral/30
                                 disabled:opacity-30 disabled:cursor-not-allowed
                                 transition-colors flex items-center justify-center"
                    >
                      −
                    </button>

                    {/* Input */}
                    <input
                      type="number"
                      min={0}
                      max={day.totalClasses}
                      value={day.attendedClasses}
                      onChange={(e) => updateDay(index, parseInt(e.target.value, 10) || 0)}
                      className="h-8 w-12 rounded-md border-[2px] border-brutal-black text-center font-mono text-sm font-bold
                                 focus:outline-none focus:ring-2 focus:ring-accent-yellow focus:border-accent-yellow"
                    />

                    {/* Increment */}
                    <button
                      onClick={() => updateDay(index, day.attendedClasses + 1)}
                      disabled={day.attendedClasses >= day.totalClasses}
                      className="h-8 w-8 rounded-md border-[2px] border-brutal-black bg-white font-mono text-sm font-bold
                                 hover:bg-card-green/20 active:bg-card-green/30
                                 disabled:opacity-30 disabled:cursor-not-allowed
                                 transition-colors flex items-center justify-center"
                    >
                      +
                    </button>

                    {/* Quick toggle: all / none */}
                    <button
                      onClick={() => updateDay(index, isFullyAttended ? 0 : day.totalClasses)}
                      className={`h-8 px-2 rounded-md border-[2px] border-brutal-black font-mono text-xs font-bold
                                  transition-colors ${
                                    isFullyAttended
                                      ? "bg-card-green text-white hover:bg-card-green/80"
                                      : "bg-white text-brutal-black hover:bg-card-green/20"
                                  }`}
                      title={isFullyAttended ? "Mark as skipped" : "Mark as fully attended"}
                    >
                      {isFullyAttended ? "✓" : "○"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Summary + Confirm */}
        <div className="p-5 pt-4 border-t-[3px] border-brutal-black/10">
          {/* Summary stats */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 rounded-md border-[2px] border-brutal-black bg-card-green/10 p-2.5 text-center">
              <p className="font-mono text-xs text-brutal-black/50">Attended</p>
              <p className="font-heading text-xl font-extrabold text-card-green">
                {totals.attended}
              </p>
            </div>
            <div className="flex-1 rounded-md border-[2px] border-brutal-black bg-card-coral/10 p-2.5 text-center">
              <p className="font-mono text-xs text-brutal-black/50">Skipped</p>
              <p className="font-heading text-xl font-extrabold text-card-coral">
                {totals.skipped}
              </p>
            </div>
            <div className="flex-1 rounded-md border-[2px] border-brutal-black bg-card-blue/10 p-2.5 text-center">
              <p className="font-mono text-xs text-brutal-black/50">Total</p>
              <p className="font-heading text-xl font-extrabold text-card-blue">
                {totals.totalClasses}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={onDismiss}
              className="flex-1 rounded-md border-[3px] border-brutal-black bg-white px-4 py-2.5
                         font-mono text-sm font-bold text-brutal-black shadow-brutal
                         hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]
                         active:shadow-brutal-active transition-all"
            >
              Skip
            </button>
            <button
              onClick={handleConfirm}
              className="flex-[2] rounded-md border-[3px] border-brutal-black bg-accent-yellow px-4 py-2.5
                         font-mono text-sm font-bold text-brutal-black shadow-brutal
                         hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px]
                         active:shadow-brutal-active transition-all"
            >
              Confirm & Update Attendance
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

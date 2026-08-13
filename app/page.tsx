"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { AttendifyProvider, useAttendify } from "@/lib/context";
import { parseStructuredOcr, createDemoTimetable } from "@/lib/ocr";
import { computeClassGap } from "@/lib/engine";
import { type CatchUpDay, type Timetable, WEEKDAYS } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";
import ImageUpload from "@/components/ImageUpload";
import TimetableGrid from "@/components/TimetableGrid";
import AttendanceInput from "@/components/AttendanceInput";
import TargetCalculator from "@/components/TargetCalculator";
import WhatIfSimulator from "@/components/WhatIfSimulator";
import Taskbar, { TabType } from "@/components/Taskbar";
import CatchUpPopup from "@/components/CatchUpPopup";

/** Check if a timetable has any slots at all */
function hasTimetableSlots(timetable: Timetable): boolean {
  return WEEKDAYS.some((day) => (timetable[day]?.length ?? 0) > 0);
}

function AttendifyApp() {
  const { state, setTimetable, setAttendanceRatio, setLastLogin } = useAttendify();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("timetable");

  // Catch-up popup state
  const [catchUpDays, setCatchUpDays] = useState<CatchUpDay[] | null>(null);
  const [showCatchUp, setShowCatchUp] = useState(false);
  const catchUpCheckedRef = useRef(false);

  // ── Auto-redirect + catch-up logic (runs once after hydration) ──
  useEffect(() => {
    if (!state.isLoaded || catchUpCheckedRef.current) return;
    catchUpCheckedRef.current = true;

    const timetableExists = hasTimetableSlots(state.timetable);

    // If timetable is loaded, redirect to attendance tab
    if (timetableExists) {
      setActiveTab("attendance");
    }

    // If we have a lastLogin, compute the class gap
    if (timetableExists && state.lastLogin) {
      const lastLoginDate = new Date(state.lastLogin);
      const now = new Date();

      // Fetch holidays from Supabase, then compute gap
      supabase
        .from("holidays")
        .select("date")
        .then(({ data, error }) => {
          const holidays: string[] =
            !error && data ? data.map((h: { date: string }) => h.date) : [];

          const gap = computeClassGap(lastLoginDate, now, state.timetable, holidays);

          if (gap.length > 0) {
            setCatchUpDays(gap);
            setShowCatchUp(true);
          } else {
            // No gap days — just update lastLogin to now
            setLastLogin(now.toISOString());
          }
        });
    } else if (timetableExists && !state.lastLogin) {
      // First time with a timetable — just stamp lastLogin, no popup
      setLastLogin(new Date().toISOString());
    }
  }, [state.isLoaded, state.timetable, state.lastLogin, setLastLogin]);

  // ── Catch-up popup handlers ──
  const handleCatchUpConfirm = useCallback(
    (confirmedDays: CatchUpDay[]) => {
      const totalClassesPassed = confirmedDays.reduce((sum, d) => sum + d.totalClasses, 0);
      const totalAttended = confirmedDays.reduce((sum, d) => sum + d.attendedClasses, 0);

      // Add to existing counts
      const newTotal = state.attendance.totalCount + totalClassesPassed;
      const newAttended = state.attendance.attendedCount + totalAttended;

      setAttendanceRatio(newAttended, newTotal);
      setLastLogin(new Date().toISOString());
      setShowCatchUp(false);
      setCatchUpDays(null);
    },
    [state.attendance, setAttendanceRatio, setLastLogin]
  );

  const handleCatchUpDismiss = useCallback(() => {
    // User chose to skip — still update lastLogin so they don't see the popup again
    setLastLogin(new Date().toISOString());
    setShowCatchUp(false);
    setCatchUpDays(null);
  }, [setLastLogin]);

  const handleImageParsed = useCallback(
    (data: string[][]) => {
      const parsed = parseStructuredOcr(data);
      setTimetable(parsed);
    },
    [setTimetable]
  );

  const handleLoadDemo = useCallback(() => {
    const demo = createDemoTimetable();
    setTimetable(demo);
  }, [setTimetable]);

  return (
    <>
      <Header />
      <main className="flex-1 w-full pb-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col gap-10">
          {activeTab === "timetable" && (
            <div className="flex flex-col gap-10 animate-fade">
              {/* Fetch Section */}
              <div>
                <ImageUpload
                  onImageParsed={handleImageParsed}
                  onTimetableFetched={setTimetable}
                  isProcessing={isProcessing}
                  setIsProcessing={setIsProcessing}
                  allowSave={false}
                />
                <div className="mt-3 text-center">
                  <span className="font-mono text-xs text-brutal-black/40">
                    No image?{" "}
                  </span>
                  <button
                    onClick={handleLoadDemo}
                    className="font-mono text-xs font-bold text-card-blue underline underline-offset-2
                               hover:text-accent-yellow transition-colors"
                  >
                    Load a demo timetable
                  </button>
                </div>
              </div>

              {/* Timetable Grid */}
              <div style={{ animationDelay: "0.05s" }}>
                <TimetableGrid />
              </div>
            </div>
          )}

          {activeTab === "attendance" && (
            <div className="flex flex-col gap-10 animate-fade">
              {/* Attendance Input */}
              <div>
                <AttendanceInput />
              </div>

              {/* Target Calculator */}
              <div style={{ animationDelay: "0.05s" }}>
                <TargetCalculator />
              </div>
            </div>
          )}

          {activeTab === "simulator" && (
            <div className="animate-fade">
              {/* What-If Simulator */}
              <WhatIfSimulator />
            </div>
          )}

          {/* Footer */}
          <footer className="border-t-[3px] border-brutal-black/10 pt-6 pb-8 text-center mt-8">
            <p className="font-mono text-xs text-brutal-black/40">
              Attendify © 2026 · A Fun Project by Sreenidhi Ascend ·{" "}
              <span className="font-bold text-red-500">We DO NOT encourage you to bunk your classes!!!</span>{" "}
            </p>
          </footer>
        </div>
      </main>

      <Taskbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Catch-Up Popup Modal */}
      {showCatchUp && catchUpDays && catchUpDays.length > 0 && (
        <CatchUpPopup
          days={catchUpDays}
          onConfirm={handleCatchUpConfirm}
          onDismiss={handleCatchUpDismiss}
        />
      )}
    </>
  );
}

export default function Home() {
  return (
    <AttendifyProvider>
      <AttendifyApp />
    </AttendifyProvider>
  );
}


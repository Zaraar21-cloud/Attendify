"use client";

import { useCallback, useState } from "react";
import { AttendifyProvider, useAttendify } from "@/lib/context";
import { parseStructuredOcr, createDemoTimetable } from "@/lib/ocr";
import Header from "@/components/Header";
import ImageUpload from "@/components/ImageUpload";
import TimetableGrid from "@/components/TimetableGrid";
import AttendanceInput from "@/components/AttendanceInput";
import TargetCalculator from "@/components/TargetCalculator";
import WhatIfSimulator from "@/components/WhatIfSimulator";
import Taskbar, { TabType } from "@/components/Taskbar";

function AttendifyApp() {
  const { setTimetable } = useAttendify();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("timetable");

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

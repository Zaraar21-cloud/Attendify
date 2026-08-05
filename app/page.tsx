"use client";

import { useCallback, useState } from "react";
import { AttendifyProvider, useAttendify } from "@/lib/context";
import { parseOcrText, createDemoTimetable } from "@/lib/ocr";
import Header from "@/components/Header";
import ImageUpload from "@/components/ImageUpload";
import TimetableGrid from "@/components/TimetableGrid";
import AttendanceInput from "@/components/AttendanceInput";
import TargetCalculator from "@/components/TargetCalculator";
import WhatIfSimulator from "@/components/WhatIfSimulator";

function AttendifyApp() {
  const { setTimetable } = useAttendify();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageParsed = useCallback(
    (text: string) => {
      const parsed = parseOcrText(text);
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
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col gap-10">
          {/* Upload Section */}
          <div className="animate-fade">
            <ImageUpload
              onImageParsed={handleImageParsed}
              onTimetableFetched={setTimetable}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
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
              <br></br>
              <span className="font-bold font-mono text-xs text-brutal-black/40">The OCR parsing is not perfect, so please verify the timetable after uploading and make changes.</span>
            </div>
          </div>

          {/* Timetable Grid */}
          <div className="animate-fade" style={{ animationDelay: "0.05s" }}>
            <TimetableGrid />
          </div>

          {/* Attendance Input */}
          <div className="animate-fade" style={{ animationDelay: "0.1s" }}>
            <AttendanceInput />
          </div>

          {/* Target Calculator */}
          <div className="animate-fade" style={{ animationDelay: "0.15s" }}>
            <TargetCalculator />
          </div>

          {/* What-If Simulator */}
          <div className="animate-fade" style={{ animationDelay: "0.2s" }}>
            <WhatIfSimulator />
          </div>

          {/* Footer */}
          <footer className="border-t-[3px] border-brutal-black/10 pt-6 pb-8 text-center">
            <p className="font-mono text-xs text-brutal-black/40">
              Attendify © 2026 · A Fun Project by Sreenidhi Ascend ·{" "}
              <span className="font-bold text-red-500">We DO NOT encourage you to bunk your classes!!!</span>{" "}
            </p>
          </footer>
        </div>
      </main>
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

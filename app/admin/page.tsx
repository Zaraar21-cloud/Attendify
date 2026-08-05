"use client";

import { useCallback, useState } from "react";
import { AttendifyProvider, useAttendify } from "@/lib/context";
import { parseOcrText } from "@/lib/ocr";
import Header from "@/components/Header";
import ImageUpload from "@/components/ImageUpload";
import TimetableGrid from "@/components/TimetableGrid";

function AdminApp() {
  const { setTimetable } = useAttendify();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageParsed = useCallback(
    (text: string) => {
      const parsed = parseOcrText(text);
      setTimetable(parsed);
    },
    [setTimetable]
  );

  return (
    <>
      <Header />
      <main className="flex-1 w-full">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 flex flex-col gap-10">
          <div className="rounded-md border-[3px] border-card-coral bg-card-coral/10 p-4">
            <h1 className="font-heading text-2xl font-black text-card-coral">ADMIN PANEL</h1>
            <p className="font-mono text-sm text-brutal-black mt-2">
              Use this page to upload, verify, and save timetables to the database. These changes will be visible to all users.
            </p>
          </div>

          <div className="animate-fade">
            <ImageUpload
              onImageParsed={handleImageParsed}
              onTimetableFetched={setTimetable}
              isProcessing={isProcessing}
              setIsProcessing={setIsProcessing}
              allowSave={true}
            />
            <div className="mt-3 text-center">
              <span className="font-bold font-mono text-xs text-brutal-black/40">The OCR parsing is not perfect, so please verify the timetable after uploading and make changes before saving to the database.</span>
            </div>
          </div>

          <div className="animate-fade" style={{ animationDelay: "0.05s" }}>
            <TimetableGrid />
          </div>

          <footer className="border-t-[3px] border-brutal-black/10 pt-6 pb-8 text-center">
            <p className="font-mono text-xs text-brutal-black/40">
              Attendify Admin Area
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}

export default function AdminPage() {
  return (
    <AttendifyProvider>
      <AdminApp />
    </AttendifyProvider>
  );
}

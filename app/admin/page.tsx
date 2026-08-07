"use client";

import { useCallback, useState } from "react";
import { AttendifyProvider, useAttendify } from "@/lib/context";
import { parseStructuredOcr } from "@/lib/ocr";
import Header from "@/components/Header";
import ImageUpload from "@/components/ImageUpload";
import TimetableGrid from "@/components/TimetableGrid";
import HolidayManager from "@/components/HolidayManager";

function AdminApp() {
  const { setTimetable } = useAttendify();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageParsed = useCallback(
    (data: string[][]) => {
      const parsed = parseStructuredOcr(data);
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
            <HolidayManager />
          </div>

          <div className="animate-fade" style={{ animationDelay: "0.10s" }}>
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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-cream p-4">
        <form
          className="flex w-full max-w-sm flex-col gap-4 rounded-md border-[3px] border-brutal-black bg-white p-6 shadow-brutal"
          onSubmit={(e) => {
            e.preventDefault();
            if (username === "admin" && password === "zar@123") {
              setIsAuthenticated(true);
            } else {
              setError("Invalid credentials");
            }
          }}
        >
          <h1 className="font-heading text-2xl font-black text-brutal-black text-center mb-2">Admin Login</h1>
          {error && <p className="font-mono text-sm font-bold text-card-coral text-center">{error}</p>}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-sm font-bold text-brutal-black">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-md border-[2px] border-brutal-black p-2 font-mono outline-none focus:border-card-blue focus:ring-2 focus:ring-card-blue/20"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-sm font-bold text-brutal-black">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border-[2px] border-brutal-black p-2 font-mono outline-none focus:border-card-blue focus:ring-2 focus:ring-card-blue/20"
            />
          </div>
          <button
            type="submit"
            className="mt-4 rounded-md border-[3px] border-brutal-black bg-accent-yellow p-2 font-heading font-black text-brutal-black transition-transform hover:-translate-y-1 hover:shadow-brutal-lg active:translate-y-0 active:shadow-none"
          >
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <AttendifyProvider>
      <AdminApp />
    </AttendifyProvider>
  );
}

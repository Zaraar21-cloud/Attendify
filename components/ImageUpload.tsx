"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAttendify } from "@/lib/context";

const getAvailableSections = (year: string, branch: string): string[] => {
  if (year === "2nd") {
    switch (branch) {
      case "CSE": return ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
      case "AIML": return ["A", "B", "C", "D", "E"];
      case "IT": return ["A", "B", "C", "D"];
      case "ECE": return ["A", "B", "C", "D", "E", "F", "G"];
      case "DS": return ["A", "B", "C"];
      case "ME":
      case "CIVIL":
      case "CS":
      case "EEE":
        return ["-"]; // Un-named or single section
    }
  }
  // Default fallback for other years
  return ["A", "B", "C"];
};

interface ImageUploadProps {
  onImageParsed: (text: string) => void;
  onTimetableFetched?: (timetable: any) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
  allowSave?: boolean;
}

export default function ImageUpload({
  onImageParsed,
  onTimetableFetched,
  isProcessing,
  setIsProcessing,
  allowSave = false,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const { state } = useAttendify();
  const [isSaving, setIsSaving] = useState(false);

  // Dropdown states
  const [year, setYear] = useState<string>("1st");
  const [branch, setBranch] = useState<string>("CSE");
  const [section, setSection] = useState<string>("A");
  const [isFetching, setIsFetching] = useState(false);
  const [showCollegeNotice, setShowCollegeNotice] = useState(false);

  const availableSections = useMemo(() => getAvailableSections(year, branch), [year, branch]);

  // Ensure section is valid for the current year/branch
  useEffect(() => {
    if (!availableSections.includes(section)) {
      setSection(availableSections[0]);
    }
  }, [availableSections, section]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("attendify-dropdowns");
      if (saved) {
        const { year, branch, section } = JSON.parse(saved);
        if (year) setYear(year);
        if (branch) setBranch(branch);
        if (section) setSection(section);
      }
    } catch (e) {
      console.error("Failed to load dropdown selections", e);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(
      "attendify-dropdowns",
      JSON.stringify({ year, branch, section })
    );
  }, [year, branch, section]);

  const handleFetchTimetable = async () => {
    setIsFetching(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("class_timetables")
        .select("timetable")
        .eq("year", year)
        .eq("branch", branch)
        .eq("section", section)
        .single();

      if (fetchError) {
        if (fetchError.code === "PGRST116") {
          setError(`No timetable found for ${year} Year, ${branch}, Section ${section}.`);
        } else {
          throw fetchError;
        }
      } else if (data) {
        if (onTimetableFetched) {
          onTimetableFetched(data.timetable);
          setSuccessMsg("Timetable loaded successfully!");
          setTimeout(() => setSuccessMsg(null), 3000);
        }
      }
    } catch (err) {
      console.error(err);
      setError("Error connecting to the database.");
    } finally {
      setIsFetching(false);
    }
  };

  const handleSaveTimetable = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { error: upsertError } = await supabase
        .from("class_timetables")
        .upsert({
          year,
          branch,
          section,
          timetable: state.timetable,
        }, { onConflict: 'year, branch, section' });

      if (upsertError) throw upsertError;
      
      setSuccessMsg("Timetable saved to database successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.error(err);
      setError("Failed to save timetable to database.");
    } finally {
      setIsSaving(false);
    }
  };

  const processFile = useCallback(
    async (file: File) => {
      // Validate file type
      const allowed = ["image/png", "image/jpeg", "image/webp"];
      if (!allowed.includes(file.type)) {
        setError("Please upload a PNG, JPG, or WEBP image.");
        return;
      }

      setError(null);
      setIsProcessing(true);

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);

      try {
        // Dynamically import Tesseract.js for client-side OCR
        const { createWorker, PSM } = await import("tesseract.js");
        const worker = await createWorker("eng", 1, {
          logger: (m: { status: string; progress: number }) => {
            console.log(`[OCR] ${m.status}: ${(m.progress * 100).toFixed(0)}%`);
          },
        });
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.AUTO, // Fully automatic page segmentation (better for grids)
        });
        const {
          data: { text },
        } = await worker.recognize(file);
        await worker.terminate();
        onImageParsed(text);
      } catch (err) {
        console.error("OCR failed:", err);
        setError(
          "OCR processing failed. You can manually build your timetable below."
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [onImageParsed, setIsProcessing]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            processFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [processFile]);

  return (
    <section id="image-upload" className="w-full">
      <h2 className="font-heading text-xl font-extrabold text-brutal-black mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border-[3px] border-brutal-black bg-card-blue text-white text-sm font-mono shadow-brutal-sm">
          1
        </span>
        Load Timetable
      </h2>

      {/* Fetch Section */}
      <div className="mb-6 rounded-lg border-[3px] border-brutal-black bg-cream p-5 shadow-brutal">
        <div className="mb-4">
          <p className="font-mono text-sm font-bold text-brutal-black mb-3">
            College:
          </p>
          <div 
            onClick={() => setShowCollegeNotice(true)} 
            className="cursor-pointer relative"
          >
            <select
              disabled
              className="w-full rounded-md border-[2px] border-brutal-black px-3 py-2 pr-8 font-mono text-sm shadow-sm opacity-50 cursor-not-allowed appearance-none bg-white pointer-events-none"
            >
              <option>Sreenidhi Institute of Science & Technology</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-brutal-black opacity-50">
              <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
          {showCollegeNotice && (
            <p className="text-xs text-brutal-black/70 mt-2 font-mono font-bold">
              We're working on adding more colleges later.
            </p>
          )}
        </div>
        
        <p className="font-mono text-sm font-bold text-brutal-black mb-3">
          Fetch existing timetable:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-md border-[2px] border-brutal-black px-3 py-2 font-mono text-sm shadow-sm"
          >
            <option value="1st">1st Year</option>
            <option value="2nd">2nd Year</option>
            <option value="3rd">3rd Year</option>
            <option value="4th">4th Year</option>
          </select>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="rounded-md border-[2px] border-brutal-black px-3 py-2 font-mono text-sm shadow-sm"
          >
            <option value="CSE">CSE</option>
            <option value="AIML">AIML</option>
            <option value="IT">IT</option>
            <option value="DS">DS</option>
            <option value="CS">CS</option>
            <option value="ECE">ECE</option>
            <option value="EEE">EEE</option>
            <option value="ME">ME</option>
            <option value="CIVIL">CIVIL</option>
          </select>
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="rounded-md border-[2px] border-brutal-black px-3 py-2 font-mono text-sm shadow-sm"
          >
            {availableSections.map((sec) => (
              <option key={sec} value={sec}>
                {sec === "-" ? "-" : `Section ${sec}`}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleFetchTimetable}
          disabled={isFetching}
          className="w-full rounded-md border-[3px] border-brutal-black bg-accent-yellow px-4 py-2 font-mono text-sm font-bold shadow-brutal-sm transition-all hover:translate-y-[-2px] hover:shadow-brutal disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-brutal-sm"
        >
          {isFetching ? "Fetching..." : "Fetch Timetable"}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-md border-[3px] border-card-coral bg-card-coral/10 px-4 py-2 font-mono text-sm font-medium text-card-coral">
          {error}
        </div>
      )}
      
      {successMsg && (
        <div className="mb-6 rounded-md border-[3px] border-card-green bg-card-green/10 px-4 py-2 font-mono text-sm font-medium text-card-green">
          {successMsg}
        </div>
      )}

      <div className="flex items-center gap-4 mb-6">
        <div className="h-[2px] flex-1 bg-brutal-black/10"></div>
        <span className="font-mono text-xs font-bold text-brutal-black/40">OR UPLOAD IMAGE</span>
        <div className="h-[2px] flex-1 bg-brutal-black/10"></div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          relative cursor-pointer
          rounded-lg border-[3px] border-dashed
          transition-all duration-150
          ${
            dragOver
              ? "border-accent-yellow bg-accent-yellow/10 shadow-brutal"
              : "border-brutal-black/40 bg-white hover:border-brutal-black hover:shadow-brutal"
          }
          ${isProcessing ? "pointer-events-none opacity-70" : ""}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {preview ? (
          <div className="flex flex-col items-center gap-4 p-6">
            <img
              src={preview}
              alt="Uploaded timetable preview"
              className="max-h-48 rounded-md border-[3px] border-brutal-black shadow-brutal object-contain"
            />
            {isProcessing ? (
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-[3px] border-brutal-black border-t-accent-yellow" />
                <span className="font-mono text-sm font-bold text-brutal-black">
                  Processing with OCR...
                </span>
              </div>
            ) : (
              <p className="font-mono text-sm text-brutal-black/60">
                ✓ Image uploaded — click to replace
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border-[3px] border-brutal-black bg-cream">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#050505"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-heading text-lg font-bold text-brutal-black">
                Drop or paste your timetable image here
              </p>
              <p className="font-mono text-sm text-brutal-black/50 mt-1">
                PNG, JPG, or WEBP • Click, drop, or Ctrl+V
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Save Button for parsed timetable */}
      {allowSave && preview && !isProcessing && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSaveTimetable}
            disabled={isSaving}
            className="rounded-md border-[3px] border-brutal-black bg-card-green px-4 py-2 font-mono text-sm font-bold shadow-brutal-sm transition-all hover:translate-y-[-2px] hover:shadow-brutal disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Current Timetable to Database"}
          </button>
        </div>
      )}

    </section>
  );
}

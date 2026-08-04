"use client";

import { useCallback, useRef, useState } from "react";

interface ImageUploadProps {
  onImageParsed: (text: string) => void;
  isProcessing: boolean;
  setIsProcessing: (v: boolean) => void;
}

export default function ImageUpload({
  onImageParsed,
  isProcessing,
  setIsProcessing,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const { recognize } = await import("tesseract.js");
        const {
          data: { text },
        } = await recognize(file, "eng", {
          logger: (m: { status: string; progress: number }) => {
            console.log(`[OCR] ${m.status}: ${(m.progress * 100).toFixed(0)}%`);
          },
        });
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

  return (
    <section id="image-upload" className="w-full">
      <h2 className="font-heading text-xl font-extrabold text-brutal-black mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border-[3px] border-brutal-black bg-card-blue text-white text-sm font-mono shadow-brutal-sm">
          1
        </span>
        Upload Timetable
      </h2>

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
                Drop your timetable image here
              </p>
              <p className="font-mono text-sm text-brutal-black/50 mt-1">
                PNG, JPG, or WEBP • Click to browse
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-md border-[3px] border-card-coral bg-card-coral/10 px-4 py-2 font-mono text-sm font-medium text-card-coral">
          {error}
        </div>
      )}
    </section>
  );
}

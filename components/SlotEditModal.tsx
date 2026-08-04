"use client";

import { useState, useEffect, useCallback } from "react";
import type { TimeSlot } from "@/lib/types";

interface SlotEditModalProps {
  slot: TimeSlot | null;
  isNew?: boolean;
  onSave: (slot: TimeSlot) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export default function SlotEditModal({
  slot,
  isNew = false,
  onSave,
  onDelete,
  onClose,
}: SlotEditModalProps) {
  const [label, setLabel] = useState(slot?.label ?? "Class");
  const [startTime, setStartTime] = useState(slot?.startTime ?? "09:00");
  const [endTime, setEndTime] = useState(slot?.endTime ?? "10:00");

  const [prevSlot, setPrevSlot] = useState(slot);
  if (slot !== prevSlot) {
    setPrevSlot(slot);
    if (slot) {
      setLabel(slot.label);
      setStartTime(slot.startTime);
      setEndTime(slot.endTime);
    }
  }

  const handleSave = useCallback(() => {
    if (!slot) return;
    onSave({
      ...slot,
      label: label.trim() || "Class",
      startTime,
      endTime,
    });
  }, [slot, label, startTime, endTime, onSave]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!slot) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brutal-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-lg border-[3px] border-brutal-black bg-white shadow-brutal-lg animate-in">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b-[3px] border-brutal-black px-5 py-3 bg-cream">
          <h3 className="font-heading text-lg font-extrabold text-brutal-black">
            {isNew ? "Add New Slot" : "Edit Slot"}
          </h3>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md border-[3px] border-brutal-black bg-white font-bold text-brutal-black hover:bg-card-coral hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-4 p-5">
          {/* Label */}
          <div>
            <label className="block font-mono text-sm font-bold text-brutal-black mb-1.5">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Class, Math, Physics"
              className="w-full rounded-md border-[3px] border-brutal-black px-3 py-2 font-mono text-sm
                         focus:outline-none focus:ring-2 focus:ring-accent-yellow focus:border-accent-yellow
                         transition-all"
            />
          </div>

          {/* Time Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-sm font-bold text-brutal-black mb-1.5">
                Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-md border-[3px] border-brutal-black px-3 py-2 font-mono text-sm
                           focus:outline-none focus:ring-2 focus:ring-accent-yellow focus:border-accent-yellow
                           transition-all"
              />
            </div>
            <div>
              <label className="block font-mono text-sm font-bold text-brutal-black mb-1.5">
                End Time
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-md border-[3px] border-brutal-black px-3 py-2 font-mono text-sm
                           focus:outline-none focus:ring-2 focus:ring-accent-yellow focus:border-accent-yellow
                           transition-all"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t-[3px] border-brutal-black px-5 py-3 bg-cream">
          {!isNew && onDelete ? (
            <button
              onClick={onDelete}
              className="rounded-md border-[3px] border-brutal-black bg-card-coral px-4 py-2
                         font-mono text-sm font-bold text-white shadow-brutal-sm
                         hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]
                         active:shadow-brutal-active active:translate-x-[4px] active:translate-y-[4px]
                         transition-all"
            >
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border-[3px] border-brutal-black bg-white px-4 py-2
                         font-mono text-sm font-bold text-brutal-black shadow-brutal-sm
                         hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]
                         transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded-md border-[3px] border-brutal-black bg-accent-yellow px-4 py-2
                         font-mono text-sm font-bold text-brutal-black shadow-brutal-sm
                         hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]
                         active:shadow-brutal-active active:translate-x-[4px] active:translate-y-[4px]
                         transition-all"
            >
              {isNew ? "Add Slot" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

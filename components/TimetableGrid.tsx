"use client";

import { useState, useCallback } from "react";
import { useAttendify } from "@/lib/context";
import { type TimeSlot, type Weekday, WEEKDAYS, generateSlotId } from "@/lib/types";
import SlotEditModal from "./SlotEditModal";

/** Shorten a slot label for compact display.
 *  - Short codes (≤ 5 chars, e.g. "DBMS", "SE") → show as-is.
 *  - Multi-word labels → first letter of each word (uppercase), e.g.
 *    "DataBase Management Systems" → "DBMS".
 *  - Lab classes → acronym + " Lab", e.g. "DataBase Management Systems Lab" → "DBMS Lab". */
function shortenLabel(label: string): string {
  const originalTrimmed = label.trim();

  // Already a short code (e.g. "DBMS", "SE", "Class")
  if (originalTrimmed.length <= 5) return originalTrimmed;
  // Already an all-uppercase code like "OOPJ"
  if (/^[A-Z]{2,5}$/.test(originalTrimmed)) return originalTrimmed;

  // Normalize "DataBase" to "Data Base" so it produces "DBMS" instead of "DMS"
  const trimmed = originalTrimmed.replace(/DataBase/ig, "Data Base");

  const words = trimmed.split(/\s+/);

  // Single long word — just return it (e.g. a user-typed name)
  if (words.length === 1) return originalTrimmed;

  // Check if it ends with "Lab" — separate it out
  const isLab = words[words.length - 1].toLowerCase() === "lab";
  const coreWords = isLab ? words.slice(0, -1) : words;

  // Build acronym from first letter of each core word
  const acronym = coreWords
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return isLab ? `${acronym} Lab` : acronym;
}

export default function TimetableGrid() {
  const { state, addSlot, removeSlot, updateSlot, setTimetable } = useAttendify();
  const { timetable } = state;

  const [editingSlot, setEditingSlot] = useState<{
    day: Weekday;
    slot: TimeSlot;
    isNew: boolean;
  } | null>(null);

  // Start editing an existing slot
  const handleSlotClick = useCallback((day: Weekday, slot: TimeSlot) => {
    setEditingSlot({ day, slot, isNew: false });
  }, []);

  // Start adding a new slot
  const handleAddSlot = useCallback((day: Weekday) => {
    const existingSlots = timetable[day];
    const lastSlot = existingSlots[existingSlots.length - 1];
    const startTime = lastSlot ? lastSlot.endTime : "09:00";
    const startHour = parseInt(startTime.split(":")[0], 10);
    const endTime = `${String(Math.min(startHour + 1, 23)).padStart(2, "0")}:${startTime.split(":")[1]}`;

    const newSlot: TimeSlot = {
      id: generateSlotId(),
      label: "Class",
      startTime,
      endTime,
    };

    setEditingSlot({ day, slot: newSlot, isNew: true });
  }, [timetable]);

  // Save edited/new slot
  const handleSave = useCallback(
    (slot: TimeSlot) => {
      if (!editingSlot) return;
      if (editingSlot.isNew) {
        addSlot(editingSlot.day, slot);
      } else {
        updateSlot(editingSlot.day, slot);
      }
      setEditingSlot(null);
    },
    [editingSlot, addSlot, updateSlot]
  );

  // Delete slot
  const handleDelete = useCallback(() => {
    if (!editingSlot) return;
    removeSlot(editingSlot.day, editingSlot.slot.id);
    setEditingSlot(null);
  }, [editingSlot, removeSlot]);

  // Clear all
  const handleClearAll = useCallback(() => {
    const empty = {
      Monday: [],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
      Saturday: [],
    };
    setTimetable(empty);
  }, [setTimetable]);

  const totalSlots = WEEKDAYS.reduce(
    (sum, day) => sum + timetable[day].length,
    0
  );

  return (
    <section id="timetable-grid" className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-heading text-xl font-extrabold text-brutal-black flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border-[3px] border-brutal-black bg-card-blue text-white text-sm font-mono shadow-brutal-sm">
            2
          </span>
          Weekly Timetable
        </h2>
        <div className="flex items-center gap-2">
          <span className="rounded-md border-[3px] border-brutal-black bg-cream px-3 py-1 font-mono text-xs font-bold">
            {totalSlots} slot{totalSlots !== 1 ? "s" : ""}
          </span>
          {totalSlots > 0 && (
            <button
              onClick={handleClearAll}
              className="rounded-md border-[3px] border-brutal-black bg-card-coral/10 px-3 py-1 font-mono text-xs font-bold text-card-coral
                         hover:bg-card-coral hover:text-white transition-colors"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="rounded-lg border-[3px] border-brutal-black bg-white shadow-brutal overflow-hidden"
          >
            {/* Day Header */}
            <div className="border-b-[3px] border-brutal-black bg-accent-yellow px-3 py-2">
              <h3 className="font-heading text-sm font-extrabold text-brutal-black text-center">
                {day.slice(0, 3).toUpperCase()}
              </h3>
              <p className="font-mono text-[10px] text-brutal-black/60 text-center">
                {timetable[day].length} class{timetable[day].length !== 1 ? "es" : ""}
              </p>
            </div>

            {/* Slots */}
            <div className="flex flex-col gap-2 p-2 min-h-[120px]">
              {timetable[day].length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="font-mono text-xs text-brutal-black/30 text-center">
                    No classes
                  </p>
                </div>
              ) : (
                timetable[day].map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => handleSlotClick(day, slot)}
                    title={slot.label}
                    className="group rounded-md border-[2px] border-brutal-black bg-card-blue/10 px-2 py-1.5
                               hover:bg-card-blue/20 hover:shadow-brutal-sm
                               transition-all text-left"
                  >
                    <p className="font-mono text-xs font-bold text-brutal-black truncate">
                      {shortenLabel(slot.label)}
                    </p>
                    <p className="font-mono text-[10px] text-brutal-black/60">
                      {slot.startTime} – {slot.endTime}
                    </p>
                  </button>
                ))
              )}

              {/* Add Button */}
              <button
                onClick={() => handleAddSlot(day)}
                className="mt-auto rounded-md border-[2px] border-dashed border-brutal-black/30 py-1.5
                           font-mono text-xs font-bold text-brutal-black/40
                           hover:border-brutal-black hover:text-brutal-black hover:bg-accent-yellow/20
                           transition-all"
              >
                + Add
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingSlot && (
        <SlotEditModal
          slot={editingSlot.slot}
          isNew={editingSlot.isNew}
          onSave={handleSave}
          onDelete={editingSlot.isNew ? undefined : handleDelete}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </section>
  );
}

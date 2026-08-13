// ─── Weekday Constants ───────────────────────────────────────────────────────
export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

// ─── Time Slot ───────────────────────────────────────────────────────────────
export interface TimeSlot {
  id: string;
  label: string;
  startTime: string; // "HH:MM" 24h format
  endTime: string;   // "HH:MM" 24h format
}

// ─── Timetable ───────────────────────────────────────────────────────────────
export type Timetable = Record<Weekday, TimeSlot[]>;

// ─── Attendance Statistics ───────────────────────────────────────────────────
export interface AttendanceStats {
  attendedCount: number;
  totalCount: number;
  currentPercentage: number;
  targetPercentage: number;
}

// ─── Calculation Results ─────────────────────────────────────────────────────
export interface CalculationResult {
  requiredClasses: number;     // classes needed to reach target
  requiredDays: number;        // calendar days based on timetable density
  bunkBuffer: number;          // classes safely skippable while staying ≥ target
  isAboveTarget: boolean;      // whether current % ≥ target %
}

// ─── Simulation Results ──────────────────────────────────────────────────────
export interface SimulationResult {
  newPercentage: number;
  delta: number;               // change from current percentage
  extraClassesNeeded: number;  // additional classes to recover
  extraDaysNeeded: number;     // additional days to recover
  message: string;             // human-readable impact message
}

// ─── Empty Timetable Factory ─────────────────────────────────────────────────
export function createEmptyTimetable(): Timetable {
  return {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
  };
}

// ─── Catch-Up Day (for missed-classes reconciliation) ────────────────────────
export interface CatchUpDay {
  date: string;           // ISO date string "YYYY-MM-DD"
  weekday: Weekday;
  totalClasses: number;   // from timetable for that weekday
  attendedClasses: number; // user-entered (defaults to totalClasses)
}

export interface CatchUpResult {
  days: CatchUpDay[];
  totalClassesPassed: number;
  totalAttended: number;
}

// ─── ID Generator ────────────────────────────────────────────────────────────
let counter = 0;
export function generateSlotId(): string {
  counter++;
  return `slot-${Date.now()}-${counter}`;
}

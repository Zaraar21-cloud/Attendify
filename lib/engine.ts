import {
  type AttendanceStats,
  type CalculationResult,
  type SimulationResult,
  type Timetable,
  type Weekday,
  WEEKDAYS,
} from "./types";

// ─── Core Percentage ─────────────────────────────────────────────────────────

/** Calculate attendance percentage from attended/total counts */
export function calcPercentage(attended: number, total: number): number {
  if (total <= 0) return 0;
  return (attended / total) * 100;
}

// ─── Classes Needed For Target ───────────────────────────────────────────────

/**
 * Solve: (attended + x) / (total + x) >= target/100
 * → x >= (target*total - 100*attended) / (100 - target)
 * Returns 0 if already at/above target.
 */
export function classesNeededForTarget(
  attended: number,
  total: number,
  targetPercent: number
): number {
  if (targetPercent >= 100) return Infinity;
  if (total <= 0) return 0;

  const currentPercent = calcPercentage(attended, total);
  if (currentPercent >= targetPercent) return 0;

  const target = targetPercent / 100;
  const needed = Math.ceil((target * total - attended) / (1 - target));
  return Math.max(0, needed);
}

// ─── Bunk Buffer ─────────────────────────────────────────────────────────────

/**
 * Maximum classes that can be skipped while staying ≥ target.
 * Solve: attended / (total + x) >= target/100
 * → x <= (100*attended - target*total) / target
 * Returns 0 if already at or below target.
 */
export function bunkBuffer(
  attended: number,
  total: number,
  targetPercent: number
): number {
  if (targetPercent <= 0) return Infinity;
  if (total <= 0) return 0;

  const target = targetPercent / 100;
  const maxSkips = Math.floor((attended - target * total) / target);
  return Math.max(0, maxSkips);
}

// ─── Average Classes Per Day ─────────────────────────────────────────────────

/** Calculate average classes per active day from the timetable */
export function avgClassesPerDay(timetable: Timetable): number {
  const activeDays = WEEKDAYS.filter(
    (day) => timetable[day] && timetable[day].length > 0
  );
  if (activeDays.length === 0) return 0;

  const totalSlots = activeDays.reduce(
    (sum, day) => sum + timetable[day].length,
    0
  );
  return totalSlots / activeDays.length;
}

/** Total classes per week */
export function totalClassesPerWeek(timetable: Timetable): number {
  return WEEKDAYS.reduce((sum, day) => sum + (timetable[day]?.length ?? 0), 0);
}

/** Classes on a specific day */
export function classesOnDay(timetable: Timetable, day: Weekday): number {
  return timetable[day]?.length ?? 0;
}

// ─── Days Needed For Target ──────────────────────────────────────────────────

/**
 * Convert required classes into calendar days using the timetable.
 * Uses average classes per active day.
 */
export function daysNeededForTarget(
  classesNeeded: number,
  timetable: Timetable
): number {
  const avg = avgClassesPerDay(timetable);
  if (avg <= 0 || classesNeeded <= 0) return 0;
  return Math.ceil(classesNeeded / avg);
}

// ─── Full Calculation ────────────────────────────────────────────────────────

/** Run all target/recovery calculations at once */
export function calculateAll(
  stats: AttendanceStats,
  timetable: Timetable
): CalculationResult {
  const { attendedCount, totalCount, targetPercentage } = stats;
  const currentPercent = calcPercentage(attendedCount, totalCount);
  const isAboveTarget = currentPercent >= targetPercentage;

  const requiredClasses = classesNeededForTarget(
    attendedCount,
    totalCount,
    targetPercentage
  );
  const requiredDays = daysNeededForTarget(requiredClasses, timetable);
  const buffer = bunkBuffer(attendedCount, totalCount, targetPercentage);

  return {
    requiredClasses,
    requiredDays,
    bunkBuffer: buffer,
    isAboveTarget,
  };
}

// ─── What-If Simulation ─────────────────────────────────────────────────────

/**
 * Simulate skipping specific weekdays.
 * Skipped days add to total but not attended.
 */
export function simulateSkip(
  stats: AttendanceStats,
  timetable: Timetable,
  skippedDays: Weekday[]
): SimulationResult {
  const skippedClasses = skippedDays.reduce(
    (sum, day) => sum + classesOnDay(timetable, day),
    0
  );

  const newTotal = stats.totalCount + skippedClasses;
  const newAttended = stats.attendedCount; // no new attendance
  const newPercentage = calcPercentage(newAttended, newTotal);
  const delta = newPercentage - stats.currentPercentage;

  // How many extra classes needed to recover after skipping?
  const extraClassesNeeded = classesNeededForTarget(
    newAttended,
    newTotal,
    stats.targetPercentage
  );
  const extraDaysNeeded = daysNeededForTarget(extraClassesNeeded, timetable);

  const message = buildSkipMessage(
    skippedDays,
    stats.currentPercentage,
    newPercentage,
    extraDaysNeeded,
    stats.targetPercentage
  );

  return {
    newPercentage,
    delta,
    extraClassesNeeded,
    extraDaysNeeded,
    message,
  };
}

/**
 * Simulate attending specific weekdays.
 * Attended days add to both total and attended.
 */
export function simulateAttend(
  stats: AttendanceStats,
  timetable: Timetable,
  attendedDays: Weekday[]
): SimulationResult {
  const attendedClasses = attendedDays.reduce(
    (sum, day) => sum + classesOnDay(timetable, day),
    0
  );

  const newTotal = stats.totalCount + attendedClasses;
  const newAttended = stats.attendedCount + attendedClasses;
  const newPercentage = calcPercentage(newAttended, newTotal);
  const delta = newPercentage - stats.currentPercentage;

  const remainingClasses = classesNeededForTarget(
    newAttended,
    newTotal,
    stats.targetPercentage
  );
  const remainingDays = daysNeededForTarget(remainingClasses, timetable);

  const message = buildAttendMessage(
    attendedDays,
    stats.currentPercentage,
    newPercentage,
    remainingDays,
    stats.targetPercentage
  );

  return {
    newPercentage,
    delta,
    extraClassesNeeded: remainingClasses,
    extraDaysNeeded: remainingDays,
    message,
  };
}

/**
 * Simulate a mix of skipped and attended days simultaneously.
 * Skipped days add to total only; attended days add to both.
 */
export function simulateMixed(
  stats: AttendanceStats,
  timetable: Timetable,
  skippedDays: Weekday[],
  attendedDays: Weekday[]
): SimulationResult {
  const skippedClasses = skippedDays.reduce(
    (sum, day) => sum + classesOnDay(timetable, day),
    0
  );
  const attendedClasses = attendedDays.reduce(
    (sum, day) => sum + classesOnDay(timetable, day),
    0
  );

  const newTotal = stats.totalCount + skippedClasses + attendedClasses;
  const newAttended = stats.attendedCount + attendedClasses;
  const newPercentage = calcPercentage(newAttended, newTotal);
  const delta = newPercentage - stats.currentPercentage;

  const extraClassesNeeded = classesNeededForTarget(
    newAttended,
    newTotal,
    stats.targetPercentage
  );
  const extraDaysNeeded = daysNeededForTarget(extraClassesNeeded, timetable);

  const message = buildMixedMessage(
    skippedDays,
    attendedDays,
    stats.currentPercentage,
    newPercentage,
    extraDaysNeeded,
    stats.targetPercentage
  );

  return {
    newPercentage,
    delta,
    extraClassesNeeded,
    extraDaysNeeded,
    message,
  };
}

// ─── Message Builders ────────────────────────────────────────────────────────

function buildSkipMessage(
  days: Weekday[],
  oldPct: number,
  newPct: number,
  extraDays: number,
  target: number
): string {
  const dayNames = days.join(", ");
  const drop = Math.abs(oldPct - newPct).toFixed(1);

  if (newPct >= target) {
    return `Skipping ${dayNames} drops your attendance from ${oldPct.toFixed(1)}% to ${newPct.toFixed(1)}% (−${drop}%). You're still above your ${target}% target. 🟢`;
  }
  return `Skipping ${dayNames} drops your attendance from ${oldPct.toFixed(1)}% to ${newPct.toFixed(1)}% (−${drop}%). You'll need ${extraDays} extra day${extraDays !== 1 ? "s" : ""} to recover back to ${target}%. 🔴`;
}

function buildAttendMessage(
  days: Weekday[],
  oldPct: number,
  newPct: number,
  remainingDays: number,
  target: number
): string {
  const dayNames = days.join(", ");
  const gain = Math.abs(newPct - oldPct).toFixed(1);

  if (newPct >= target) {
    return `Attending ${dayNames} raises your attendance from ${oldPct.toFixed(1)}% to ${newPct.toFixed(1)}% (+${gain}%). You're at or above your ${target}% target! 🟢`;
  }
  return `Attending ${dayNames} raises your attendance from ${oldPct.toFixed(1)}% to ${newPct.toFixed(1)}% (+${gain}%). You still need ${remainingDays} more day${remainingDays !== 1 ? "s" : ""} to reach ${target}%. 🟡`;
}

function buildMixedMessage(
  skippedDays: Weekday[],
  attendedDays: Weekday[],
  oldPct: number,
  newPct: number,
  extraDays: number,
  target: number
): string {
  const skipNames = skippedDays.map((d) => d.slice(0, 3)).join(", ");
  const attendNames = attendedDays.map((d) => d.slice(0, 3)).join(", ");
  const change = Math.abs(newPct - oldPct).toFixed(1);
  const sign = newPct >= oldPct ? "+" : "−";

  const parts: string[] = [];
  if (skippedDays.length > 0) parts.push(`skipping ${skipNames}`);
  if (attendedDays.length > 0) parts.push(`attending ${attendNames}`);
  const action = parts.join(" and ");

  if (newPct >= target) {
    return `By ${action}, your attendance moves from ${oldPct.toFixed(1)}% to ${newPct.toFixed(1)}% (${sign}${change}%). You're at or above your ${target}% target! 🟢`;
  }
  return `By ${action}, your attendance moves from ${oldPct.toFixed(1)}% to ${newPct.toFixed(1)}% (${sign}${change}%). You'll need ${extraDays} more day${extraDays !== 1 ? "s" : ""} to reach ${target}%. 🔴`;
}

// ─── Per-Class Simulation ───────────────────────────────────────────────────

/**
 * Simulate the impact of skipping/attending individual classes (not whole days).
 * skippedCount: number of classes to skip (adds to total only)
 * attendedCount: number of classes to attend (adds to both)
 */
export function simulateClassChanges(
  stats: AttendanceStats,
  timetable: Timetable,
  skippedCount: number,
  attendedCount: number
): SimulationResult {
  const newTotal = stats.totalCount + skippedCount + attendedCount;
  const newAttended = stats.attendedCount + attendedCount;
  const newPercentage = calcPercentage(newAttended, newTotal);
  const delta = newPercentage - stats.currentPercentage;

  const extraClassesNeeded = classesNeededForTarget(
    newAttended,
    newTotal,
    stats.targetPercentage
  );
  const extraDaysNeeded = daysNeededForTarget(extraClassesNeeded, timetable);

  let message: string;
  const parts: string[] = [];
  if (skippedCount > 0) parts.push(`skipping ${skippedCount} class${skippedCount !== 1 ? "es" : ""}`);
  if (attendedCount > 0) parts.push(`attending ${attendedCount} class${attendedCount !== 1 ? "es" : ""}`);
  const action = parts.join(" and ");
  const change = Math.abs(delta).toFixed(1);
  const sign = delta >= 0 ? "+" : "−";

  if (newPercentage >= stats.targetPercentage) {
    message = `By ${action}, your attendance moves from ${stats.currentPercentage.toFixed(1)}% to ${newPercentage.toFixed(1)}% (${sign}${change}%). You're at or above your ${stats.targetPercentage}% target! 🟢`;
  } else {
    message = `By ${action}, your attendance moves from ${stats.currentPercentage.toFixed(1)}% to ${newPercentage.toFixed(1)}% (${sign}${change}%). You'll need ${extraDaysNeeded} more day${extraDaysNeeded !== 1 ? "s" : ""} to reach ${stats.targetPercentage}%. 🔴`;
  }

  return {
    newPercentage,
    delta,
    extraClassesNeeded,
    extraDaysNeeded,
    message,
  };
}

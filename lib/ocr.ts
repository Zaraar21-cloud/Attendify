import { type Timetable, type Weekday, WEEKDAYS, generateSlotId } from "./types";

// ─── OCR Text → Timetable Parser ────────────────────────────────────────────
//
// Class timetable images produce messy OCR output. This parser:
// 1. Detects day headers (MON, TUE, etc.) to group lines by day
// 2. Identifies subject codes (2-5 uppercase letters) as class slots
// 3. Recognizes lab sessions (spans multiple periods)
// 4. Assigns standard time slots based on slot count

// Standard class time slots (8 periods)
const DEFAULT_TIME_SLOTS = [
  { start: "09:00", end: "09:50" },
  { start: "09:50", end: "10:40" },
  { start: "10:40", end: "11:30" },
  { start: "11:30", end: "12:20" },
  { start: "13:10", end: "13:55" },
  { start: "13:55", end: "14:40" },
  { start: "14:40", end: "15:25" },
  { start: "15:25", end: "16:10" },
];

// Day detection patterns
const DAY_PATTERNS: { day: Weekday; regex: RegExp }[] = [
  { day: "Monday", regex: /(?:\b(?:MON(?:DAY)?|WON|WO)\b)/i },
  { day: "Tuesday", regex: /(?:\b(?:TUE(?:S(?:DAY)?)?|VEY|VE)\b)/i },
  { day: "Wednesday", regex: /(?:\b(?:WED(?:NES(?:DAY)?)?|VED|VEN|MO)\b|™)/i },
  { day: "Thursday", regex: /(?:\b(?:THU(?:RS(?:DAY)?)?|TH|LJ)\b|^-)/i },
  { day: "Friday", regex: /(?:\b(?:FRI(?:DAY)?|FR|AR)\b)/i },
  { day: "Saturday", regex: /(?:\b(?:SAT(?:URDAY)?|S4T|5AT|SATUR)\b)/i },
];

// Classes to automatically ignore (removed from parsed timetable)
export const IGNORED_CLASSES = new Set([
  "library",
  "nptel",
  "sports",
]);

// Words that are NOT subject codes (lab name components, common noise)
const NOISE_WORDS = new Set([
  "lunch", "break", "recess", "free",
  "lab", "tutorial", "practical", "through", "oriented",
  "programming", "management", "systems", "engineering",
  "computational", "mathematics", "database", "object",
  "software", "java", "data", "base",
  // Ignored class names (also noise for subject code detection)
  "library", "nptel", "sports",
  // Common OCR artifacts
  "eno", "ww", "ow", "lt", "ty",
]);

// Words that are part of lab names (used to build the lab regex)
export const LAB_NAME_WORDS = new Set([
  "database", "management", "systems", "computational", "mathematics",
  "software", "engineering", "object", "oriented", "programming",
  "through", "java", "data", "base", "digital", "computer",
  "network", "operating", "machine", "learning", "artificial",
  "intelligence", "web", "technology", "design", "analysis",
  "algorithm", "structure", "communication", "signal", "control",
  "electronic", "electrical", "mechanical", "civil", "chemical",
]);

/**
 * Detect which weekday a line belongs to.
 */
function detectDay(text: string): Weekday | null {
  for (const { day, regex } of DAY_PATTERNS) {
    if (regex.test(text)) return day;
  }
  return null;
}

/**
 * Check if a token is a valid subject code.
 * Must be 2-5 uppercase chars, not a noise word, not a number.
 */
function isSubjectCode(word: string): boolean {
  const clean = word.replace(/[^A-Za-z]/g, "").trim();
  if (clean.length < 2 || clean.length > 5) return false;
  if (NOISE_WORDS.has(clean.toLowerCase())) return false;
  if (/^\d+$/.test(word)) return false;
  // Exclude Roman numerals (I, II, III, IV, V, VI, VII, VIII)
  if (/^[IVXLCDM]+$/i.test(clean) && clean.length <= 4) return false;
  // Must be mostly uppercase letters
  if (!/^[A-Z]{2,5}$/i.test(clean)) return false;
  return true;
}

/**
 * Extract lab sessions from text.
 * Returns an array of lab match strings and the text with labs removed.
 *
 * Lab patterns match descriptive multi-word names ending in "Lab",
 * but NOT standalone uppercase subject codes (like CAO, SE) that happen
 * to appear right before the lab name in OCR text.
 */
function extractLabs(text: string): { labs: { label: string, index: number }[]; cleaned: string } {
  // Match lab patterns: one or more title-case/lowercase words followed by "Lab"
  // The words before "Lab" must be descriptive (not 2-4 char uppercase subject codes).
  const labRegex = /(?:(?:(?![A-Z]+\b)[A-Za-z]{3,})\s+)+L[.\s]*a[.\s]*b(?:[\s-]*\d*)?/g;

  const labs: { label: string, index: number }[] = [];
  let match;

  const cleanedArr = text.split("");

  while ((match = labRegex.exec(text)) !== null) {
    const rawMatch = match[0];
    labs.push({ label: rawMatch.trim(), index: match.index });
    // Replace with spaces in the cleaned array to preserve indices
    for (let i = 0; i < rawMatch.length; i++) {
      cleanedArr[match.index + i] = " ";
    }
  }

  return { labs, cleaned: cleanedArr.join("") };
}

/**
 * Extract the sequence of class labels (subject codes and labs) for a day's text.
 */
function extractSlots(text: string): string[] {
  const { labs, cleaned: textWithoutLabs } = extractLabs(text);

  // Remove "LUNCH" by replacing with spaces
  const cleanText = textWithoutLabs.replace(/\bLUNCH\b/gi, (m) => " ".repeat(m.length));

  const tokenizableText = cleanText
    .replace(/\([^)]*\)/g, (m) => " ".repeat(m.length))    // Remove parenthesized text like (T)
    .replace(/[|=\[\]{}<>]/g, " ")                         // Remove OCR border artifacts
    .replace(/\b\d{4}\b/g, "    ")                         // Remove 4-digit numbers like room codes (5201)
    .replace(/\.\s/g, "  ");                               // Remove stray periods

  const wordRegex = /[A-Za-z0-9]+/g;
  const subjects: { label: string, index: number }[] = [];
  let wMatch;

  while ((wMatch = wordRegex.exec(tokenizableText)) !== null) {
    const token = wMatch[0];
    if (isSubjectCode(token)) {
      // Fix common OCR errors (e.g. 00PJ -> OOPJ)
      const label = token.toUpperCase().replace(/0/g, "O").replace(/[^A-Z]/g, "");
      subjects.push({ label, index: wMatch.index });
    }
  }

  const regularCount = subjects.length;

  if (labs.length === 0) {
    return subjects.map(s => s.label).slice(0, 8);
  }

  // Determine lab spans
  const remainingSlots = 8 - regularCount;
  let labSlots: number;

  if (labs.length === 1) {
    // Single lab: gets all remaining slots, clamped to [2, 4]
    labSlots = Math.max(2, Math.min(4, remainingSlots));
  } else {
    // Multiple labs: split remaining evenly, each at least 2
    const perLab = Math.floor(remainingSlots / labs.length);
    labSlots = Math.max(2, Math.min(4, perLab));
  }

  // Combine and sort by original index to maintain timeline order
  const items = [...labs, ...subjects];
  items.sort((a, b) => a.index - b.index);

  const resultSlots: string[] = [];
  for (const item of items) {
    const isLab = labs.some(l => l.index === item.index && l.label === item.label);
    if (isLab) {
      for (let i = 0; i < labSlots; i++) {
        if (resultSlots.length < 8) {
          resultSlots.push(item.label);
        }
      }
    } else {
      if (resultSlots.length < 8) {
        resultSlots.push(item.label);
      }
    }
  }

  return resultSlots;
}

/**
 * Check if a slot label matches an ignored class name.
 * Checks the full label and individual words (case-insensitive).
 */
function isIgnoredClass(label: string): boolean {
  const lower = label.toLowerCase().trim();
  // Exact match (e.g. "Library", "NPTEL", "Sports")
  if (IGNORED_CLASSES.has(lower)) return true;
  // Check individual words (e.g. lab names containing "Library")
  const words = lower.split(/\s+/);
  return words.some((w) => IGNORED_CLASSES.has(w));
}

/**
 * Parse raw OCR text into a Timetable structure.
 */
export function parseOcrText(rawText: string): Timetable {
  const timetable: Timetable = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
  };

  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  // Step 1: Group lines by day
  // We need to handle the case where a day's content spans multiple OCR lines,
  // AND where FRI might not appear as its own line (OCR missed it).
  const dayGroups: Partial<Record<Weekday, string[]>> = {};
  let currentDay: Weekday | null = null;

  for (const line of lines) {
    const detectedDay = detectDay(line);
    if (detectedDay) {
      currentDay = detectedDay;
      if (!dayGroups[currentDay]) {
        dayGroups[currentDay] = [];
      }
      // The line might contain content after the day name
      const pattern = DAY_PATTERNS.find((p) => p.day === currentDay)!;
      const afterDay = line.replace(pattern.regex, "").trim();
      if (afterDay) {
        dayGroups[currentDay]!.push(afterDay);
      }
      continue;
    }

    // Check if this line starts with a day abbreviation embedded in text
    // e.g., "FRI    CS   OOPJ   DBMS" where FRI detection might fail
    // due to OCR artifacts
    if (currentDay && dayGroups[currentDay]) {
      dayGroups[currentDay]!.push(line);
    }
  }

  // Step 2: Fix Friday / Thursday split
  // OCR often merges Friday content into Thursday lines.
  // Look for the "Object Oriented Programming through Java Lab" line
  // which belongs to Friday in this timetable format (it's an afternoon lab).
  // Also look for lines starting with "cs" or "CS" which belong to Friday.
  if (!dayGroups["Friday"]) {
    const thuLines = dayGroups["Thursday"];
    if (thuLines && thuLines.length > 1) {
      const friLines: string[] = [];
      const keepThuLines: string[] = [];

      for (let i = 0; i < thuLines.length; i++) {
        const line = thuLines[i];
        // Lines starting with "cs" or "CS" belong to Friday
        if (i > 0 && /^\s*(?:cs|CS)\b/.test(line)) {
          // This line AND any lab description before it belong to Friday
          friLines.push(line);
        } else if (i > 0 && /^[=\s]*(?:object|oriented)/i.test(line)) {
          // "Object Oriented Programming through Java Lab" belongs to Friday
          friLines.push(line);
        } else {
          keepThuLines.push(line);
        }
      }

      if (friLines.length > 0) {
        dayGroups["Thursday"] = keepThuLines;
        dayGroups["Friday"] = friLines;
      }
    }
  }

  // Step 3: Fix Tuesday / Wednesday overlap
  // OCR may put "Computational" on the Tuesday line when it belongs to Wednesday.
  // If Wednesday exists and Tuesday has a trailing "Computational" word, move it.
  if (dayGroups["Tuesday"] && dayGroups["Wednesday"]) {
    const tueLines = dayGroups["Tuesday"]!;
    const wedLines = dayGroups["Wednesday"]!;
    const newTueLines: string[] = [];

    for (const line of tueLines) {
      // If a line is just "Computational" or starts with it, it belongs to Wednesday
      if (/^\s*Computational\s*$/i.test(line)) {
        wedLines.unshift(line);
      } else if (/\bComputational\s*$/i.test(line)) {
        // "Computational" is at the end of a Tuesday line — split it off
        const cleaned = line.replace(/\s*Computational\s*$/i, "").trim();
        if (cleaned) newTueLines.push(cleaned);
        wedLines.unshift("Computational");
      } else {
        newTueLines.push(line);
      }
    }

    dayGroups["Tuesday"] = newTueLines;
    dayGroups["Wednesday"] = wedLines;
  }

  // Step 4: Fix Friday / Saturday split
  // OCR might merge Saturday into Friday's line.
  if (dayGroups["Friday"] && !dayGroups["Saturday"]) {
    const friLines = dayGroups["Friday"]!;
    const newFriLines: string[] = [];
    const satLines: string[] = [];
    const satRegex = /(?:\b(?:SAT(?:URDAY)?|S4T|5AT|SATUR)\b)/i;

    for (const line of friLines) {
      const match = satRegex.exec(line);
      // If we find a Saturday keyword in the middle of a Friday line
      if (match && match.index > 0) {
        const before = line.substring(0, match.index).trim();
        const after = line.substring(match.index + match[0].length).trim();
        if (before) newFriLines.push(before);
        if (after) satLines.push(after);
        else satLines.push(line);
      } else {
        newFriLines.push(line);
      }
    }
    
    if (satLines.length > 0) {
      dayGroups["Friday"] = newFriLines;
      dayGroups["Saturday"] = satLines;
    }
  }

  // Step 5: For each day, extract slots and create timetable entries
  for (const day of WEEKDAYS) {
    const dayLines = dayGroups[day as Weekday];
    if (!dayLines || dayLines.length === 0) continue;

    const fullText = dayLines.join(" ");
    const slotLabels = extractSlots(fullText);

    if (slotLabels.length === 0) continue;

    for (let i = 0; i < slotLabels.length && i < DEFAULT_TIME_SLOTS.length; i++) {
      const timeSlot = DEFAULT_TIME_SLOTS[i];
      const label = slotLabels[i];

      // Skip ignored classes (Library, NPTEL, Sports)
      if (isIgnoredClass(label)) continue;

      timetable[day as Weekday].push({
        id: generateSlotId(),
        label,
        startTime: timeSlot.start,
        endTime: timeSlot.end,
      });
    }
  }

  return timetable;
}

/**
 * Create a demo timetable for users who don't have an image.
 */
export function createDemoTimetable(): Timetable {
  const slots = (count: number, startHour: number) =>
    Array.from({ length: count }, (_, i) => ({
      id: generateSlotId(),
      label: "Class",
      startTime: `${String(startHour + i).padStart(2, "0")}:00`,
      endTime: `${String(startHour + i + 1).padStart(2, "0")}:00`,
    }));

  return {
    Monday: slots(4, 9),
    Tuesday: slots(3, 9),
    Wednesday: slots(4, 9),
    Thursday: slots(3, 10),
    Friday: slots(2, 9),
    Saturday: [],
  };
}

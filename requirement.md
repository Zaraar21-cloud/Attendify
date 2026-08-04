# Software Requirement Specification (SRS)

**Project Name:** Attendify & Timetable Manager  
**Target Environment:** Antigravity IDE  
**UI/UX Style:** Neubrutalism (High-contrast, bold outlines, stark shadows, vivid accents, geometric typography)

---

## 1. Project Overview & Objective

The **Attendify Attendance Calculator** is a modern, web-based application designed to streamline student timetable ingestion and attendance prediction. Users can upload a photo of their class timetable, review and edit an automatically abstracted weekly schedule (where slots default to generic `"Class"` labels until customized), enter their current attendance status, set a target attendance threshold, and run interactive "what-if" skip/attend simulations across specific days of the week.

---

## 2. System Architecture & Tech Stack

- **IDE & Agent Environment:** Antigravity IDE (with MCP Servers for Filesystem, Fetch/Vision API, and GitHub/Deployment).
- **Frontend Framework:** Next.js (React) / Tailwind CSS.
- **Styling Architecture:** Neubrutalism Design System
  - Heavy black borders (`border-2 border-black` / `border-4 border-black`)
  - Crisp, unblurred box shadows (`shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`)
  - High-saturation pastel / neon accent palette (Electric Yellow `#FFE600`, Vivid Pink `#FF6B6B`, Mint Green `#4ECDC4`, Sky Blue `#4D96FF`)
  - Monospace or bold sans-serif typography (`font-mono` / `font-bold`)
- **Parsing / OCR:** Vision API / Tesseract.js / Structured Prompt OCR for extracting grid structures from timetable images.

---

## 3. Detailed Feature Requirements

### Feature 1: Timetable Ingestion & Image Parsing (OCR)
* **User Flow:**
  1. User uploads an image file (PNG, JPG, WEBP) of their weekly class timetable.
  2. The system parses the image grid (Days of the Week: Monday–Friday/Saturday vs. Time Slots).
  3. **Abstracted Naming Rule:** Extracted slots MUST default to the generic label **`"Class"`** (or `"Class 1"`, `"Class 2"`) rather than attempting subject name recognition.
* **Output:** A structured weekly schedule rendered in a Neubrutalist interactive grid.

---

### Feature 2: Interactive Timetable Verification & Editing
* **User Flow:**
  1. The parsed timetable is presented in a high-contrast Neubrutalist grid.
  2. **Add/Remove/Edit Slots:** Users can click on any cell to:
     - Add a new class slot to an empty hour.
     - Remove/delete an existing class slot if misparsed or free period.
     - Rename `"Class"` to a specific subject name if desired (optional).
     - Adjust start and end times.
  3. Save timetable button commits the schedule to local storage / state.

---

### Feature 3: Current Attendance Baseline Input
* **User Flow:**
  - The application prompts the user for their baseline attendance before running simulations.
  - **Flexible Input Options:**
    - **Option A (Exact Ratio):** Enter `Classes Attended` divided by `Total Classes Conducted` (e.g., `45 / 60`).
    - **Option B (Percentage):** Enter exact current percentage directly (e.g., `75%`).

---

### Feature 4: Target Percentage & Recovery Calculator
* **User Flow:**
  1. User sets a **Goal Attendance Percentage** (e.g., `75%`, `80%`, `85%`).
  2. **Calculated Metrics:**
     - **Required Classes:** Exact number of future consecutive classes required to reach or maintain the target percentage.
     - **Required Days:** Converts required classes into real calendar days based on the user's weekly timetable density.
     - **Bunk Buffer:** If currently above target, calculates how many classes / days can be safely missed.

---

### Feature 5: Interactive Day-Skip Simulator ("What-If" Engine)
* **User Flow:**
  1. Displays weekday toggles (Monday through Friday/Saturday) corresponding to the uploaded timetable.
  2. Allows selecting "Today", "Tomorrow", or any specific weekday(s) to simulate skipping or attending.
  3. **Live Recalculation:** Instantly shows how skipping that specific day's exact class count affects:
     - New overall attendance percentage.
     - Impact on target goal (e.g., *"Skipping tomorrow drops your attendance from 76.2% to 73.8% — requiring 3 extra days to recover"*).

---

## 4. Design System Specification (Neubrutalism)

```css
/* Core Design Tokens */
--border-brutal: 3px solid #000000;
--shadow-brutal: 5px 5px 0px #000000;
--shadow-brutal-active: 1px 1px 0px #000000;

/* Color Palette - Warm Editorial Neubrutalism */
--bg-main: #F7F4E9;      /* Warm Eggshell / Cream (Matches Reference Background) */
--bg-card: #FFFFFF;      /* Clean White (For high-contrast content cards) */
--border-black: #050505; /* Pitch Black (For heavy borders & typography) */

/* Primary Accent */
--accent-yellow: #FFC700; /* Industrial Signal Yellow (Matches "Build." accent) */

/* Functional Card Colors (Muted Neubrutalist Tones) */
--card-coral: #FF5A5F;   /* Danger / Low Attendance Warning (< 75%) */
--card-green: #38C172;   /* Safe / Safe Bunk Zone (≥ 75%) */
--card-blue: #4B82F6;    /* Info / Timetable Class Slots */
--card-lavender: #A855F7;/* Special / Skip Simulator Highlight */
```

---

## 5. Data Model (JSON Schema)

```json
{
  "timetable": {
    "Monday": [
      { "id": "m1", "label": "Class", "startTime": "09:00", "endTime": "10:00" },
      { "id": "m2", "label": "Class", "startTime": "10:00", "endTime": "11:00" }
    ],
    "Tuesday": [],
    "Wednesday": [],
    "Thursday": [],
    "Friday": []
  },
  "attendanceStats": {
    "attendedCount": 42,
    "totalCount": 50,
    "currentPercentage": 84.0,
    "targetPercentage": 75.0
  }
}
```

---

## 6. Antigravity Agent Execution Instructions

When loaded into **Antigravity IDE**, the agent should:
1. Initialize a Next.js project with Tailwind CSS configured for Neubrutalist utilities.
2. Implement image upload and OCR pipeline (mock/Vision API).
3. Build state management for the editable timetable grid.
4. Implement exact mathematical formulas for target calculation and skip simulation.
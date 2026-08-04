# Attendify — Class Attendance Calculator & Timetable Ingestion

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

> A modern, client-side web application for class timetable OCR ingestion, attendance threshold calculation, and interactive "What-If" skip/attend simulation designed with a high-contrast Neubrutalism UI.

---

## Key Features

- **OCR Timetable Ingestion**: Upload a photo or screenshot of your weekly timetable. Automated parsing identifies daily time slots, labs, and subject sessions via client-side Tesseract.js OCR.
- **Interactive Neubrutalist Grid**: Custom schedule editor allowing students to view, add, remove, or adjust weekly class slots with bold, high-contrast UI feedback.
- **Target Attendance Calculator**: Input current attendance (by ratio like `45/60` or percentage `75%`) and set your target goal to determine exact class attendance or safe skip allowances.
- **What-If Simulation Engine**: Test future attendance scenarios by toggling planned attendance across upcoming days and classes.
- **Privacy First**: 100% client-side execution. Timetable processing and attendance calculations run locally in the browser with no external backend storage.

---

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **UI & Components**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) (Custom Neubrutalism Design Tokens)
- **OCR Engine**: [Tesseract.js](https://github.com/naptha/tesseract.js)
- **Language**: [TypeScript](https://www.typescriptlang.org/)

---

## Project Structure

```text
Attendify/
├── app/                  # Next.js App Router pages and global layouts
│   ├── globals.css       # Neubrutalism design system tokens & styles
│   ├── layout.tsx        # Root layout with context providers
│   └── page.tsx          # Main application dashboard
├── components/           # Modular React components
│   ├── AttendanceInput.tsx   # Baseline attendance entry component
│   ├── Header.tsx            # Header & branding banner
│   ├── ImageUpload.tsx       # Drag-and-drop OCR upload component
│   ├── SlotEditModal.tsx     # Timetable slot editor modal
│   ├── TargetCalculator.tsx  # Threshold and recovery calculator
│   ├── TimetableGrid.tsx     # Neubrutalist weekly schedule grid
│   └── WhatIfSimulator.tsx   # Interactive attendance simulation matrix
├── lib/                  # Application logic and utility engines
│   ├── context.tsx       # Global timetable & attendance React Context
│   ├── engine.ts         # Attendance math & projection algorithms
│   ├── ocr.ts            # Tesseract OCR & timetable parsing heuristics
│   └── types.ts          # TypeScript type definitions & data models
├── public/               # Static web assets
└── package.json          # Project dependencies & scripts
```

---

## Getting Started

### Prerequisites

- Node.js `18.x` or higher
- npm, yarn, or pnpm

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Zaraar21-cloud/Attendify.git
   cd Attendify
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000) to access the application.

---

## Available Scripts

- `npm run dev` — Starts the Next.js development server with Turbopack.
- `npm run build` — Builds the application for production.
- `npm run start` — Starts the production server.
- `npm run lint` — Runs ESLint code quality checks.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

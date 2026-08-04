"use client";

export default function Header() {
  return (
    <header className="w-full border-b-[3px] border-brutal-black bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border-[3px] border-brutal-black bg-accent-yellow shadow-brutal">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#050505"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-brutal-black">
              Attend<span className="text-accent-yellow">ify</span>
            </h1>
            <p className="text-xs font-medium text-brutal-black/60 font-mono">
              Attendance Calculator & Timetable Manager
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="hidden sm:flex items-center gap-2 rounded-md border-[3px] border-brutal-black bg-cream px-3 py-1.5 shadow-brutal-sm font-mono text-sm font-bold">
          <span className="h-2.5 w-2.5 rounded-full bg-card-green animate-pulse" />
          Ready
        </div>
      </div>
    </header>
  );
}

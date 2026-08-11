"use client";

import React from "react";

export type TabType = "timetable" | "attendance" | "simulator";

interface TaskbarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export default function Taskbar({ activeTab, setActiveTab }: TaskbarProps) {
  const tabs = [
    {
      id: "timetable" as TabType,
      label: "Timetable",
      color: "bg-accent-yellow",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    },
    {
      id: "attendance" as TabType,
      label: "Attendance",
      color: "bg-accent-yellow",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      )
    },
    {
      id: "simulator" as TabType,
      label: "Simulator",
      color: "bg-accent-yellow",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19l16-14" />
          <circle cx="6" cy="6" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
      )
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-2 pb-4 bg-cream border-t-[3px] border-brutal-black pointer-events-auto">
      <div className="max-w-md mx-auto flex gap-3 justify-between">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1
                border-[3px] border-brutal-black rounded-lg transition-all duration-200
                font-mono font-bold text-xs sm:text-sm
                ${isActive ? tab.color : "bg-white hover:bg-black/5"}
                ${isActive ? "shadow-brutal-active translate-y-[2px]" : "shadow-brutal hover:-translate-y-1 hover:shadow-brutal-lg"}
              `}
            >
              <div className="text-brutal-black">{tab.icon}</div>
              <span className="text-brutal-black">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

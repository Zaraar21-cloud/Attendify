"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAttendify } from "@/lib/context";

const getAvailableSections = (year: string, branch: string): string[] => {
  if (year === "2nd") {
    switch (branch) {
      case "CSE": return ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
      case "AIML": return ["A", "B", "C", "D", "E"];
      case "IT": return ["A", "B", "C", "D"];
      case "ECE": return ["A", "B", "C", "D", "E", "F", "G"];
      case "DS": return ["A", "B", "C"];
      case "ME":
      case "CIVIL":
      case "CS":
      case "EEE":
        return ["-"];
    }
  }
  return ["A", "B", "C"];
};

export default function TimetableSelector() {
  const { setTimetable } = useAttendify();
  
  const [year, setYear] = useState<string>("1st");
  const [branch, setBranch] = useState<string>("CSE");
  const [section, setSection] = useState<string>("A");
  
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const availableSections = useMemo(() => getAvailableSections(year, branch), [year, branch]);

  useEffect(() => {
    if (!availableSections.includes(section)) {
      setSection(availableSections[0]);
    }
  }, [availableSections, section]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("attendify-dropdowns");
      if (saved) {
        const { year, branch, section } = JSON.parse(saved);
        if (year) setYear(year);
        if (branch) setBranch(branch);
        if (section) setSection(section);
      }
    } catch (e) {
      console.error("Failed to load dropdown selections", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "attendify-dropdowns",
      JSON.stringify({ year, branch, section })
    );
  }, [year, branch, section]);

  const handleFetchTimetable = async () => {
    setIsFetching(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("class_timetables")
        .select("timetable")
        .eq("year", year)
        .eq("branch", branch)
        .eq("section", section)
        .single();

      if (fetchError) {
        if (fetchError.code === "PGRST116") {
          setError(`No timetable found for ${year} Year, ${branch}, Section ${section}.`);
        } else {
          throw fetchError;
        }
      } else if (data) {
        setTimetable(data.timetable);
        setSuccessMsg("Timetable loaded successfully!");
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error(err);
      setError("Error connecting to the database.");
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <section className="w-full">
      <h2 className="font-heading text-xl font-extrabold text-brutal-black mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-md border-[3px] border-brutal-black bg-card-blue text-white text-sm font-mono shadow-brutal-sm">
          1
        </span>
        Select Class
      </h2>

      <div className="mb-6 rounded-lg border-[3px] border-brutal-black bg-cream p-5 shadow-brutal">
        <p className="font-mono text-sm font-bold text-brutal-black mb-3">
          Fetch your class timetable:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded-md border-[2px] border-brutal-black px-3 py-2 font-mono text-sm shadow-sm"
          >
            <option value="1st">1st Year</option>
            <option value="2nd">2nd Year</option>
            <option value="3rd">3rd Year</option>
            <option value="4th">4th Year</option>
          </select>
          <select
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            className="rounded-md border-[2px] border-brutal-black px-3 py-2 font-mono text-sm shadow-sm"
          >
            <option value="CSE">CSE</option>
            <option value="AIML">AIML</option>
            <option value="IT">IT</option>
            <option value="DS">DS</option>
            <option value="CS">CS</option>
            <option value="ECE">ECE</option>
            <option value="EEE">EEE</option>
            <option value="ME">ME</option>
            <option value="CIVIL">CIVIL</option>
          </select>
          <select
            value={section}
            onChange={(e) => setSection(e.target.value)}
            className="rounded-md border-[2px] border-brutal-black px-3 py-2 font-mono text-sm shadow-sm"
          >
            {availableSections.map((sec) => (
              <option key={sec} value={sec}>
                {sec === "-" ? "-" : `Section ${sec}`}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleFetchTimetable}
          disabled={isFetching}
          className="w-full rounded-md border-[3px] border-brutal-black bg-accent-yellow px-4 py-2 font-mono text-sm font-bold shadow-brutal-sm transition-all hover:translate-y-[-2px] hover:shadow-brutal disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-brutal-sm"
        >
          {isFetching ? "Fetching..." : "Fetch Timetable"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border-[3px] border-card-coral bg-card-coral/10 px-4 py-2 font-mono text-sm font-medium text-card-coral">
          {error}
        </div>
      )}
      
      {successMsg && (
        <div className="mt-4 rounded-md border-[3px] border-card-green bg-card-green/10 px-4 py-2 font-mono text-sm font-medium text-card-green">
          {successMsg}
        </div>
      )}
    </section>
  );
}

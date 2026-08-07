"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

type Holiday = {
  date: string;
  name: string;
};

export default function HolidayManager() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    const { data, error } = await supabase
      .from("holidays")
      .select("*")
      .order("date", { ascending: true });
    
    if (error) {
      console.error("Error fetching holidays:", error);
      setError("Failed to fetch holidays.");
    } else {
      setHolidays(data as Holiday[]);
      setError(null);
    }
  };

  const addHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newName) return;

    setIsSubmitting(true);
    setError(null);

    const { error } = await supabase
      .from("holidays")
      .insert([{ date: newDate, name: newName }]);

    setIsSubmitting(false);

    if (error) {
      console.error("Error adding holiday:", error);
      setError(error.message);
    } else {
      setNewDate("");
      setNewName("");
      fetchHolidays();
    }
  };

  const removeHoliday = async (date: string) => {
    const { error } = await supabase
      .from("holidays")
      .delete()
      .eq("date", date);

    if (error) {
      console.error("Error deleting holiday:", error);
      setError(error.message);
    } else {
      fetchHolidays();
    }
  };

  return (
    <div className="rounded-md border-[3px] border-brutal-black bg-white p-6 shadow-brutal">
      <h2 className="font-heading text-xl font-black text-brutal-black mb-4">Manage Holidays</h2>
      <p className="font-mono text-sm text-brutal-black/70 mb-6">
        Holidays added here will automatically disable the specified dates in the What-If Simulator for all users.
      </p>

      {error && (
        <div className="mb-4 rounded-md border-[2px] border-card-coral bg-card-coral/10 p-3 font-mono text-sm font-bold text-card-coral">
          {error}
        </div>
      )}

      <form onSubmit={addHoliday} className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex-1">
          <label className="block font-mono text-xs font-bold text-brutal-black mb-1">Date</label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full rounded-md border-[2px] border-brutal-black p-2 font-mono text-sm outline-none focus:border-card-blue focus:ring-2 focus:ring-card-blue/20"
            required
          />
        </div>
        <div className="flex-2 sm:w-1/2">
          <label className="block font-mono text-xs font-bold text-brutal-black mb-1">Holiday Name</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. Independence Day"
            className="w-full rounded-md border-[2px] border-brutal-black p-2 font-mono text-sm outline-none focus:border-card-blue focus:ring-2 focus:ring-card-blue/20"
            required
          />
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-[42px] rounded-md border-[3px] border-brutal-black bg-card-green px-4 font-mono text-sm font-bold text-white transition-transform hover:-translate-y-1 hover:shadow-brutal-sm active:translate-y-0 active:shadow-none disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
          >
            {isSubmitting ? "Adding..." : "Add Holiday"}
          </button>
        </div>
      </form>

      <div className="border-t-[3px] border-brutal-black/10 pt-6">
        <h3 className="font-heading text-lg font-bold text-brutal-black mb-4">Declared Holidays</h3>
        {holidays.length === 0 ? (
          <p className="font-mono text-sm text-brutal-black/50 italic">No holidays declared yet.</p>
        ) : (
          <div className="grid gap-3">
            {holidays.map((holiday) => (
              <div key={holiday.date} className="flex items-center justify-between rounded-md border-[2px] border-brutal-black bg-cream p-3">
                <div>
                  <div className="font-mono text-sm font-bold text-brutal-black">{holiday.name}</div>
                  <div className="font-mono text-xs text-brutal-black/60">{holiday.date}</div>
                </div>
                <button
                  onClick={() => removeHoliday(holiday.date)}
                  className="rounded-md border-[2px] border-brutal-black bg-card-coral/10 px-3 py-1 font-mono text-xs font-bold text-card-coral transition-colors hover:bg-card-coral hover:text-white"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

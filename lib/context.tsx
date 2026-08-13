"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from "react";
import {
  type AttendanceStats,
  type Timetable,
  type TimeSlot,
  type Weekday,
  createEmptyTimetable,
} from "./types";
import { calcPercentage } from "./engine";

// ─── State Shape ─────────────────────────────────────────────────────────────

interface AttendifyState {
  timetable: Timetable;
  attendance: AttendanceStats;
  lastLogin: string | null; // ISO timestamp of last visit
  isLoaded: boolean; // hydration flag
}

const DEFAULT_STATE: AttendifyState = {
  timetable: createEmptyTimetable(),
  attendance: {
    attendedCount: 0,
    totalCount: 0,
    currentPercentage: 0,
    targetPercentage: 75,
  },
  lastLogin: null,
  isLoaded: false,
};

// ─── Actions ─────────────────────────────────────────────────────────────────

type Action =
  | { type: "HYDRATE"; payload: Partial<AttendifyState> }
  | { type: "SET_TIMETABLE"; payload: Timetable }
  | { type: "ADD_SLOT"; day: Weekday; slot: TimeSlot }
  | { type: "REMOVE_SLOT"; day: Weekday; slotId: string }
  | { type: "UPDATE_SLOT"; day: Weekday; slot: TimeSlot }
  | { type: "SET_ATTENDANCE_RATIO"; attended: number; total: number }
  | { type: "SET_ATTENDANCE_PERCENTAGE"; percentage: number }
  | { type: "SET_TARGET"; target: number }
  | { type: "SET_LAST_LOGIN"; timestamp: string };

function reducer(state: AttendifyState, action: Action): AttendifyState {
  switch (action.type) {
    case "HYDRATE":
      return { ...state, ...action.payload, isLoaded: true };

    case "SET_TIMETABLE":
      return { ...state, timetable: action.payload };

    case "ADD_SLOT": {
      const daySlots = [...state.timetable[action.day], action.slot];
      return {
        ...state,
        timetable: { ...state.timetable, [action.day]: daySlots },
      };
    }

    case "REMOVE_SLOT": {
      const filtered = state.timetable[action.day].filter(
        (s) => s.id !== action.slotId
      );
      return {
        ...state,
        timetable: { ...state.timetable, [action.day]: filtered },
      };
    }

    case "UPDATE_SLOT": {
      const updated = state.timetable[action.day].map((s) =>
        s.id === action.slot.id ? action.slot : s
      );
      return {
        ...state,
        timetable: { ...state.timetable, [action.day]: updated },
      };
    }

    case "SET_ATTENDANCE_RATIO": {
      const pct = calcPercentage(action.attended, action.total);
      return {
        ...state,
        attendance: {
          ...state.attendance,
          attendedCount: action.attended,
          totalCount: action.total,
          currentPercentage: pct,
        },
      };
    }

    case "SET_ATTENDANCE_PERCENTAGE": {
      return {
        ...state,
        attendance: {
          ...state.attendance,
          currentPercentage: action.percentage,
          // Keep ratio in sync (approximate):
          attendedCount: Math.round((action.percentage / 100) * state.attendance.totalCount),
        },
      };
    }

    case "SET_TARGET":
      return {
        ...state,
        attendance: {
          ...state.attendance,
          targetPercentage: action.target,
        },
      };

    case "SET_LAST_LOGIN":
      return { ...state, lastLogin: action.timestamp };

    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface AttendifyContextValue {
  state: AttendifyState;
  dispatch: React.Dispatch<Action>;
  setTimetable: (tt: Timetable) => void;
  addSlot: (day: Weekday, slot: TimeSlot) => void;
  removeSlot: (day: Weekday, slotId: string) => void;
  updateSlot: (day: Weekday, slot: TimeSlot) => void;
  setAttendanceRatio: (attended: number, total: number) => void;
  setAttendancePercentage: (pct: number) => void;
  setTarget: (target: number) => void;
  setLastLogin: (timestamp: string) => void;
}

const AttendifyContext = createContext<AttendifyContextValue | null>(null);

// ─── localStorage Keys ───────────────────────────────────────────────────────

const STORAGE_KEY = "attendify-data";
const LAST_LOGIN_KEY = "attendify-last-login";

function loadFromStorage(): Partial<AttendifyState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const lastLogin = localStorage.getItem(LAST_LOGIN_KEY);
    if (!raw && !lastLogin) return null;
    const parsed = raw ? JSON.parse(raw) : {};
    if (lastLogin) parsed.lastLogin = lastLogin;
    return parsed;
  } catch {
    return null;
  }
}

function saveToStorage(state: AttendifyState) {
  if (typeof window === "undefined") return;
  try {
    const { timetable, attendance } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ timetable, attendance }));
    if (state.lastLogin) {
      localStorage.setItem(LAST_LOGIN_KEY, state.lastLogin);
    }
  } catch {
    // Storage full or unavailable
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AttendifyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, DEFAULT_STATE);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const saved = loadFromStorage();
    dispatch({ type: "HYDRATE", payload: saved ?? {} });
  }, []);

  // Persist on every state change (after hydration)
  useEffect(() => {
    if (state.isLoaded) {
      saveToStorage(state);
    }
  }, [state]);

  const setTimetable = useCallback(
    (tt: Timetable) => dispatch({ type: "SET_TIMETABLE", payload: tt }),
    []
  );
  const addSlot = useCallback(
    (day: Weekday, slot: TimeSlot) => dispatch({ type: "ADD_SLOT", day, slot }),
    []
  );
  const removeSlot = useCallback(
    (day: Weekday, slotId: string) =>
      dispatch({ type: "REMOVE_SLOT", day, slotId }),
    []
  );
  const updateSlot = useCallback(
    (day: Weekday, slot: TimeSlot) =>
      dispatch({ type: "UPDATE_SLOT", day, slot }),
    []
  );
  const setAttendanceRatio = useCallback(
    (attended: number, total: number) =>
      dispatch({ type: "SET_ATTENDANCE_RATIO", attended, total }),
    []
  );
  const setAttendancePercentage = useCallback(
    (pct: number) => dispatch({ type: "SET_ATTENDANCE_PERCENTAGE", percentage: pct }),
    []
  );
  const setTarget = useCallback(
    (target: number) => dispatch({ type: "SET_TARGET", target }),
    []
  );
  const setLastLogin = useCallback(
    (timestamp: string) => dispatch({ type: "SET_LAST_LOGIN", timestamp }),
    []
  );

  const value = useMemo(
    () => ({
      state,
      dispatch,
      setTimetable,
      addSlot,
      removeSlot,
      updateSlot,
      setAttendanceRatio,
      setAttendancePercentage,
      setTarget,
      setLastLogin,
    }),
    [state, setTimetable, addSlot, removeSlot, updateSlot, setAttendanceRatio, setAttendancePercentage, setTarget, setLastLogin]
  );

  return (
    <AttendifyContext.Provider value={value}>{children}</AttendifyContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAttendify(): AttendifyContextValue {
  const ctx = useContext(AttendifyContext);
  if (!ctx) {
    throw new Error("useAttendify must be used within a AttendifyProvider");
  }
  return ctx;
}

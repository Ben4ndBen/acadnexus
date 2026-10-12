"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, X } from "lucide-react";

interface DatePickerProps {
  value: string; // ISO format "YYYY-MM-DD" or ""
  onChange: (dateStr: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  minDate?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Select examination date",
  required = false,
  disabled = false,
  className = "",
  minDate,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"days" | "months">("days");
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize viewed month and year based on value or current date
  const initialDate = value ? new Date(value) : new Date();
  const validInitial = !isNaN(initialDate.getTime()) ? initialDate : new Date();

  const [viewYear, setViewYear] = useState<number>(validInitial.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(validInitial.getMonth()); // 0-indexed

  // When value changes from outside, update viewed month/year if valid
  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setViewMode("days");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Year range (currentYear - 3 to currentYear + 10)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 14 }, (_, i) => currentYear - 3 + i);

  const handlePrev = () => {
    if (viewMode === "months") {
      setViewYear(prev => prev - 1);
    } else {
      if (viewMonth === 0) {
        setViewMonth(11);
        setViewYear(prev => prev - 1);
      } else {
        setViewMonth(prev => prev - 1);
      }
    }
  };

  const handleNext = () => {
    if (viewMode === "months") {
      setViewYear(prev => prev + 1);
    } else {
      if (viewMonth === 11) {
        setViewMonth(0);
        setViewYear(prev => prev + 1);
      } else {
        setViewMonth(prev => prev + 1);
      }
    }
  };

  // Generate calendar days
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday
  const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  // Previous month trailing days
  const prevMonthDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = viewMonth === 0 ? 12 : viewMonth;
    const y = viewMonth === 0 ? viewYear - 1 : viewYear;
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    prevMonthDays.push({ day: d, dateStr, isCurrentMonth: false });
  }

  // Current month days
  const currentMonthDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    currentMonthDays.push({ day: d, dateStr, isCurrentMonth: true });
  }

  // Next month leading days to complete the 35 or 42 grid
  const totalDaysSoFar = prevMonthDays.length + currentMonthDays.length;
  const remainingCells = totalDaysSoFar <= 35 ? 35 - totalDaysSoFar : 42 - totalDaysSoFar;
  const nextMonthDays: { day: number; dateStr: string; isCurrentMonth: boolean }[] = [];
  for (let d = 1; d <= remainingCells; d++) {
    const m = viewMonth === 11 ? 1 : viewMonth + 2;
    const y = viewMonth === 11 ? viewYear + 1 : viewYear;
    const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    nextMonthDays.push({ day: d, dateStr, isCurrentMonth: false });
  }

  const allCalendarDays = [...prevMonthDays, ...currentMonthDays, ...nextMonthDays];

  // Format display text (e.g. "10/08/2026" or "YYYY-MM-DD")
  const formatDisplay = (val: string) => {
    if (!val) return "";
    try {
      const parts = val.split("-");
      if (parts.length === 3) {
        return `${parts[1]}/${parts[2]}/${parts[0]}`; // MM/DD/YYYY
      }
      return val;
    } catch {
      return val;
    }
  };

  const handleSelectDate = (dateStr: string) => {
    onChange(dateStr);
    setIsOpen(false);
    setViewMode("days");
  };

  const handleSelectMonth = (monthIndex: number) => {
    setViewMonth(monthIndex);
    setViewMode("days");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setIsOpen(false);
    setViewMode("days");
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input Display Button */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) setViewMode("days");
          }
        }}
        className={`flex items-center justify-between w-full bg-slate-50 border border-slate-200 text-slate-900 text-sm font-medium px-3.5 py-2.5 rounded-xl transition-all cursor-pointer select-none hover:border-slate-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-600 ${
          disabled ? "opacity-60 cursor-not-allowed bg-slate-100" : ""
        } ${className}`}
      >
        <span className={value ? "text-slate-900 font-medium" : "text-slate-400 font-medium"}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <div className="flex items-center gap-1.5 ml-2">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
              title="Clear date"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
      </div>

      {/* Hidden input for HTML form validation if required */}
      <input
        type="text"
        required={required}
        value={value}
        onChange={() => {}}
        className="sr-only"
        tabIndex={-1}
      />

      {/* Calendar Popover */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 z-[100] w-[260px] bg-white border border-slate-200 rounded-xl shadow-lg p-3 space-y-2 font-sans animate-in fade-in zoom-in-95 duration-150">
          {/* Month / Year Header with Clickable Month Button */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
            <div className="flex items-center gap-1">
              {/* Clickable Month Button */}
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "months" ? "days" : "months")}
                className={`text-xs font-semibold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 transition-all cursor-pointer ${
                  viewMode === "months"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                    : "text-slate-700 hover:text-emerald-700 hover:bg-slate-100"
                }`}
                title="Click to choose month"
              >
                <span>{monthNames[viewMonth]}</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-200 ${
                    viewMode === "months" ? "rotate-180 text-emerald-600" : "text-slate-400"
                  }`}
                />
              </button>

              {/* Year Selector */}
              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className="text-xs font-semibold text-slate-700 bg-transparent hover:bg-slate-100 focus:bg-slate-100 rounded-md px-1 py-0.5 cursor-pointer outline-none border border-transparent hover:border-slate-200 transition-colors"
                title="Select year"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Previous & Next Arrows */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                aria-label={viewMode === "months" ? "Previous year" : "Previous month"}
                title={viewMode === "months" ? "Previous year" : "Previous month"}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                aria-label={viewMode === "months" ? "Next year" : "Next month"}
                title={viewMode === "months" ? "Next year" : "Next month"}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* VIEW: MONTHS GRID */}
          {viewMode === "months" ? (
            <div className="space-y-1.5 py-0.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
                Select Month ({viewYear})
              </div>
              <div className="grid grid-cols-3 gap-1">
                {monthNames.map((name, idx) => {
                  const isCurrent = viewMonth === idx;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleSelectMonth(idx)}
                      className={`py-1.5 px-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
                        isCurrent
                          ? "bg-emerald-600 text-white font-extrabold shadow-xs"
                          : "text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-100 hover:border-emerald-200"
                      }`}
                    >
                      {name.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* VIEW: DAYS GRID */
            <>
              {/* Days of Week Header */}
              <div className="grid grid-cols-7 text-center">
                {daysOfWeek.map((d) => (
                  <span key={d} className="text-[10px] font-bold text-slate-400 py-0.5">
                    {d}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {allCalendarDays.map((cell, idx) => {
                  const isSelected = value === cell.dateStr;
                  const isCurrent = cell.isCurrentMonth;

                  return (
                    <button
                      key={`${cell.dateStr}-${idx}`}
                      type="button"
                      onClick={() => handleSelectDate(cell.dateStr)}
                      className={`h-7 w-7 text-[11px] font-medium rounded-md flex items-center justify-center transition-all cursor-pointer mx-auto ${
                        isSelected
                          ? "bg-emerald-600 text-white font-bold shadow-xs"
                          : isCurrent
                          ? "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                          : "text-slate-300 hover:bg-slate-50 hover:text-slate-500"
                      }`}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Footer with Clear and Close Buttons */}
          <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-500 hover:text-rose-600 font-bold transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-rose-50"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setViewMode("days");
              }}
              className="text-slate-500 hover:text-slate-800 font-bold transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-slate-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

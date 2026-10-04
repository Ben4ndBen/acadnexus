"use client";

import React from "react";

export interface TosTopicItem {
  id: string;
  topic_name: string;
  learning_outcomes: string;
  hours: number;
  weightPercentage: number;
  assignedItems: number;
  question_types?: string[];
  taxonomy?: {
    remembering: number;
    understanding: number;
    applying: number;
    analyzing: number;
    evaluating: number;
    creating: number;
  };
  itemPlacement?: string;
}

export interface BSCTableOfSpecificationsViewProps {
  examTitle: string;
  courseCode: string;
  courseTitle: string;
  departmentName?: string;
  term?: string;
  semester?: string;
  academicYear?: string;
  examDate?: string;
  documentReference?: string;
  facultyName?: string;
  facultyRank?: string;
  programChairName?: string;
  deptChairName?: string;
  directorInstructionName?: string;
  totalItems: number;
  topics: TosTopicItem[];
}

/**
 * Normalizes department name so that "DEPARTMENT" is at the end.
 * e.g., "DEPARTMENT OF AGRICULTURE" -> "AGRICULTURE DEPARTMENT"
 */
function formatDeptNameWithDeptLast(rawName: string): string {
  let cleaned = (rawName || "").trim().toUpperCase();
  if (!cleaned) return "ACADEMIC AFFAIRS DEPARTMENT";

  if (cleaned.startsWith("DEPARTMENT OF ")) {
    cleaned = cleaned.substring("DEPARTMENT OF ".length).trim();
  } else if (cleaned.startsWith("DEPARTMENT ")) {
    cleaned = cleaned.substring("DEPARTMENT ".length).trim();
  } else if (cleaned.startsWith("DEPT OF ")) {
    cleaned = cleaned.substring("DEPT OF ".length).trim();
  } else if (cleaned.startsWith("DEPT ")) {
    cleaned = cleaned.substring("DEPT ".length).trim();
  }

  if (cleaned.endsWith(" DEPARTMENT")) {
    cleaned = cleaned.substring(0, cleaned.length - " DEPARTMENT".length).trim();
  } else if (cleaned.endsWith(" DEPT")) {
    cleaned = cleaned.substring(0, cleaned.length - " DEPT".length).trim();
  }

  return `${cleaned} DEPARTMENT`;
}

/**
 * Dynamically resolves official department name from course code or fallback with DEPARTMENT at the end
 */
function resolveDepartmentName(courseCode?: string, fallbackDeptName?: string): string {
  const code = (courseCode || "").trim().toUpperCase();
  if (code.startsWith("ITC") || code.startsWith("ITE") || code.startsWith("ITM") || code.startsWith("ITD") || code === "ENT 403" || code.includes("INFOTECH")) {
    return "INFORMATION AND COMMUNICATIONS TECHNOLOGY DEPARTMENT";
  }
  if (code.startsWith("AGRI") || code.startsWith("AG EXT") || code.startsWith("AGB") || code.startsWith("AME") || code.startsWith("ANSCI") || code.startsWith("CROP") || code.startsWith("SOIL")) {
    return "AGRICULTURE DEPARTMENT";
  }
  if (code.startsWith("HPC") || code.startsWith("HMPE") || code.startsWith("TPC") || code.startsWith("TPE") || code.startsWith("THC") || code.startsWith("BME")) {
    return "HOSPITALITY AND TOURISM MANAGEMENT DEPARTMENT";
  }
  if (code.startsWith("IND")) {
    return "INDUSTRIAL TECHNOLOGY DEPARTMENT";
  }
  if (code.startsWith("EDUC")) {
    return "TEACHER EDUCATION DEPARTMENT";
  }
  return formatDeptNameWithDeptLast(fallbackDeptName || "Academic Affairs");
}

export function BSCTableOfSpecificationsView({
  examTitle,
  courseCode,
  courseTitle,
  departmentName = "Academic Affairs",
  term = "Midterm",
  semester = "1st Semester",
  academicYear = "2026-2027",
  examDate = new Date().toISOString().split("T")[0],
  documentReference = "BSC-ODI-F-121",
  totalItems,
  topics,
}: BSCTableOfSpecificationsViewProps) {
  // Dynamically resolve department name from course code or faculty department
  const resolvedDeptName = resolveDepartmentName(courseCode, departmentName);

  // Calculate Totals
  const totalHours = topics.reduce((sum, t) => sum + (Number(t.hours) || 0), 0);
  const totalWeight = topics.reduce((sum, t) => sum + (Number(t.weightPercentage) || 0), 0);
  const totalAssignedItems = topics.reduce((sum, t) => sum + (Number(t.assignedItems) || 0), 0);

  // Helper to extract calculated taxonomy values per topic
  const getTax = (t: TosTopicItem) => {
    const rem = t.taxonomy?.remembering ?? Math.round(t.assignedItems * 0.3);
    const und = t.taxonomy?.understanding ?? Math.round(t.assignedItems * 0.3);
    const app = t.taxonomy?.applying ?? Math.round(t.assignedItems * 0.2);
    const ana = t.taxonomy?.analyzing ?? Math.round(t.assignedItems * 0.1);
    const eva = t.taxonomy?.evaluating ?? Math.round(t.assignedItems * 0.05);
    const cre = t.taxonomy?.creating ?? Math.max(0, t.assignedItems - (rem + und + app + ana + eva));
    return { rem, und, app, ana, eva, cre };
  };

  // Taxonomy level column sums
  const totalRemembering = topics.reduce((sum, t) => sum + getTax(t).rem, 0);
  const totalUnderstanding = topics.reduce((sum, t) => sum + getTax(t).und, 0);
  const totalApplying = topics.reduce((sum, t) => sum + getTax(t).app, 0);
  const totalAnalyzing = topics.reduce((sum, t) => sum + getTax(t).ana, 0);
  const totalEvaluating = topics.reduce((sum, t) => sum + getTax(t).eva, 0);
  const totalCreating = topics.reduce((sum, t) => sum + getTax(t).cre, 0);

  return (
    <div className="bg-white text-slate-900 border border-slate-300 rounded-2xl shadow-xl p-4 sm:p-8 font-sans print:shadow-none print:border-none print:p-0 space-y-6">
      
      {/* OFFICIAL BSC HEADER IMAGE */}
      <div className="w-full border-b border-slate-200 pb-2">
        <img
          src="/bsc_header.png"
          alt="Batanes State College Header"
          className="w-full h-auto object-contain block rounded-t-xl"
        />
      </div>

      {/* Department Banner & Exam Metadata */}
      <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
        <div className="bg-slate-100 border-b border-slate-300 text-center py-2.5 px-4">
          <h2 className="text-xs sm:text-sm font-black tracking-wider uppercase text-slate-900 font-serif">
            {resolvedDeptName}
          </h2>
          <h3 className="text-sm sm:text-base font-black tracking-widest uppercase text-[#500e12] mt-0.5">
            TABLE OF SPECIFICATIONS
          </h3>
          <p className="text-xs font-bold text-[#E2A123] mt-0.5">
            {term.toUpperCase()} EXAMINATION
          </p>
          <p className="text-[11px] text-slate-600 font-medium">
            {semester}, Academic Year {academicYear}
          </p>
        </div>

        {/* Course Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 p-3.5 bg-white text-xs font-semibold text-slate-800">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-950 shrink-0">COURSE CODE:</span>
            <span className="border-b border-slate-400 flex-1 font-mono font-bold px-1 text-slate-900">{courseCode || "—"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-slate-950 shrink-0">DATE OF EXAMINATION:</span>
            <span className="border-b border-slate-400 flex-1 font-mono font-bold px-1 text-slate-900">{examDate || "—"}</span>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <span className="font-extrabold text-slate-950 shrink-0">COURSE TITLE:</span>
            <span className="border-b border-slate-400 flex-1 font-bold px-1 text-slate-900">{courseTitle || "—"}</span>
          </div>
        </div>
      </div>

      {/* TOS Matrix Table */}
      <div className="w-full overflow-visible border border-slate-900 rounded-xl shadow-2xs">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            {/* Main Header Row */}
            <tr className="bg-[#500e12] text-white font-extrabold text-center text-[11px] divide-x divide-slate-800">
              <th className="p-2.5 border border-slate-900 w-1/4" rowSpan={2}>LESSON / TOPIC</th>
              <th className="p-2.5 border border-slate-900 w-1/5" rowSpan={2}>LEARNING OUTCOMES</th>
              <th className="p-2 border border-slate-900 w-16" rowSpan={2}>NO. OF HOURS TAUGHT</th>
              <th className="p-2 border border-slate-900 w-16" rowSpan={2}>% WEIGHT / ALLOC.</th>
              <th className="p-2 border border-slate-900 w-16" rowSpan={2}>NO. OF ITEMS</th>
              <th className="p-2 border border-slate-900" colSpan={7}>ITEM SPECIFICATION PER TAXONOMY OF LEARNING</th>
              <th className="p-2.5 border border-slate-900 w-24" rowSpan={2}>ITEM PLACEMENT</th>
            </tr>
            {/* Taxonomy Sub-header Row */}
            <tr className="bg-[#7A151A] text-white font-bold text-[10px] text-center divide-x divide-slate-800">
              <th className="p-1 border border-slate-900">Remembering</th>
              <th className="p-1 border border-slate-900">Understanding</th>
              <th className="p-1 border border-slate-900">Applying</th>
              <th className="p-1 border border-slate-900">Analyzing</th>
              <th className="p-1 border border-slate-900">Evaluating</th>
              <th className="p-1 border border-slate-900">Creating</th>
              <th className="p-1 border border-slate-900 font-black bg-[#500e12]">TOTAL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300 text-slate-900 text-[11px]">
            {topics.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-6 text-center text-slate-400 italic">
                  No TOS topics configured yet.
                </td>
              </tr>
            ) : (
              topics.map((t, idx) => {
                const rem = t.taxonomy?.remembering ?? Math.round(t.assignedItems * 0.3);
                const und = t.taxonomy?.understanding ?? Math.round(t.assignedItems * 0.3);
                const app = t.taxonomy?.applying ?? Math.round(t.assignedItems * 0.2);
                const ana = t.taxonomy?.analyzing ?? Math.round(t.assignedItems * 0.1);
                const eva = t.taxonomy?.evaluating ?? Math.round(t.assignedItems * 0.05);
                const cre = t.taxonomy?.creating ?? (t.assignedItems - (rem + und + app + ana + eva));

                return (
                  <tr key={t.id || idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                    {/* Lesson / Topic */}
                    <td className="p-2.5 border border-slate-900 font-bold text-slate-950 align-top">
                      {t.topic_name || `Topic ${idx + 1}`}
                    </td>

                    {/* Learning Outcomes */}
                    <td className="p-2.5 border border-slate-900 text-slate-700 align-top leading-tight text-[10px]">
                      {t.learning_outcomes || "• Demonstrate comprehensive knowledge of core topic competencies and application principles."}
                    </td>

                    {/* Hours Taught */}
                    <td className="p-2 text-center border border-slate-900 font-bold font-mono align-middle">
                      {t.hours}
                    </td>

                    {/* % Weight */}
                    <td className="p-2 text-center border border-slate-900 font-bold font-mono align-middle">
                      {t.weightPercentage}%
                    </td>

                    {/* No. of Items */}
                    <td className="p-2 text-center border border-slate-900 font-black font-mono text-[#500e12] align-middle bg-amber-50/40">
                      {t.assignedItems}
                    </td>

                    {/* Taxonomy Breakdown */}
                    <td className="p-1 text-center border border-slate-900 font-mono align-middle">{rem || "—"}</td>
                    <td className="p-1 text-center border border-slate-900 font-mono align-middle">{und || "—"}</td>
                    <td className="p-1 text-center border border-slate-900 font-mono align-middle">{app || "—"}</td>
                    <td className="p-1 text-center border border-slate-900 font-mono align-middle">{ana || "—"}</td>
                    <td className="p-1 text-center border border-slate-900 font-mono align-middle">{eva || "—"}</td>
                    <td className="p-1 text-center border border-slate-900 font-mono align-middle">{cre > 0 ? cre : "—"}</td>
                    <td className="p-1 text-center border border-slate-900 font-black font-mono bg-amber-100/50 align-middle">
                      {t.assignedItems}
                    </td>

                    {/* Item Placement (Not generated yet per user instructions) */}
                    <td className="p-2 text-center border border-slate-900 font-bold font-mono text-slate-400 align-middle">
                      —
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

          {/* TOTAL FOOTER ROW */}
          <tfoot>
            <tr className="bg-[#7A151A] text-white font-black text-center text-xs divide-x divide-slate-900">
              <td className="p-2.5 border border-slate-900 text-left font-serif uppercase tracking-wider" colSpan={2}>
                TOTAL
              </td>
              <td className="p-2 border border-slate-900 font-mono">{totalHours} hrs</td>
              <td className="p-2 border border-slate-900 font-mono">{totalWeight}%</td>
              <td className="p-2 border border-slate-900 font-mono bg-[#500e12]">{totalAssignedItems}</td>
              <td className="p-1 border border-slate-900 font-mono">{totalRemembering || "—"}</td>
              <td className="p-1 border border-slate-900 font-mono">{totalUnderstanding || "—"}</td>
              <td className="p-1 border border-slate-900 font-mono">{totalApplying || "—"}</td>
              <td className="p-1 border border-slate-900 font-mono">{totalAnalyzing || "—"}</td>
              <td className="p-1 border border-slate-900 font-mono">{totalEvaluating || "—"}</td>
              <td className="p-1 border border-slate-900 font-mono">{totalCreating || "—"}</td>
              <td className="p-1 border border-slate-900 font-mono bg-[#500e12]">{totalAssignedItems}</td>
              <td className="p-2 border border-slate-900 font-mono text-slate-300">
                —
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* OFFICIAL BSC FOOTER IMAGE */}
      <div className="w-full mt-6 border-t border-slate-200 pt-2">
        <img
          src="/bsc_footer.png"
          alt="Batanes State College Footer"
          className="w-full h-auto object-contain block rounded-b-xl"
        />
      </div>
    </div>
  );
}

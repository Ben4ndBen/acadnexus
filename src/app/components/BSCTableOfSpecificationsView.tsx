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
  facultyName,
  facultyRank,
  programChairName,
  deptChairName,
  directorInstructionName,
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

  const safeTotalItems = totalAssignedItems > 0 ? totalAssignedItems : 1;
  const remPerc = Math.round((totalRemembering / safeTotalItems) * 100);
  const undPerc = Math.round((totalUnderstanding / safeTotalItems) * 100);
  const appPerc = Math.round((totalApplying / safeTotalItems) * 100);
  const anaPerc = Math.round((totalAnalyzing / safeTotalItems) * 100);
  const evaPerc = Math.round((totalEvaluating / safeTotalItems) * 100);
  const crePerc = Math.max(0, 100 - (remPerc + undPerc + appPerc + anaPerc + evaPerc));

  let runningItemStart = 1;

  return (
    <div className="bg-white text-black border border-slate-300 rounded-2xl shadow-xl p-4 sm:p-8 font-sans print:shadow-none print:border-none print:p-0 space-y-4">
      
      {/* BSC OFFICIAL HEADER IMAGE */}
      <div className="w-full border-b border-black pb-2 relative">
        <div className="absolute top-1 right-2 sm:top-2 sm:right-4 z-10 print:top-0 print:right-0">
          <span className="font-sans font-black text-[11px] sm:text-xs text-black bg-white border border-black px-2 py-0.5 rounded shadow-2xs uppercase tracking-wider">
            {documentReference || "BSC-ODI-F-121"}
          </span>
        </div>
        <img
          src="/bsc-header.png"
          alt="Batanes State College Header"
          className="w-full h-auto object-contain mx-auto max-h-[160px] print:max-h-none"
        />
      </div>

      {/* DYNAMIC DEPARTMENT NAME */}
      <div className="text-center pt-0.5">
        <h3 className="font-sans font-bold text-sm sm:text-base text-black uppercase tracking-wider">
          {resolvedDeptName}
        </h3>
      </div>

      {/* TOS TITLE & TERM */}
      <div className="text-center space-y-0.5 py-1">
        <h2 className="text-base sm:text-lg font-black font-sans text-black tracking-wide uppercase">
          TABLE OF SPECIFICATIONS
        </h2>
        <p className="text-xs sm:text-sm font-bold text-black uppercase">
          <span className="font-black">[{term.toUpperCase()}] EXAMINATION</span>
        </p>
        <p className="text-xs font-bold text-black">
          <span className="underline">{semester}</span>
        </p>
      </div>

      {/* COURSE & EXAMINATION METADATA GRID MATCHING PDF */}
      <div className="space-y-2 text-xs font-bold text-black uppercase pt-1 pb-2">
        <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-2 flex-1 w-full">
            <span className="shrink-0 font-extrabold text-[11px]">COURSE CODE:</span>
            <span className="border-b-2 border-black flex-1 font-mono font-black text-black px-1 text-[11px]">
              {courseCode || ""}
            </span>
          </div>
          <div className="flex items-baseline gap-2 flex-1 w-full">
            <span className="shrink-0 font-extrabold text-[11px]">DATE OF EXAMINATION:</span>
            <span className="border-b-2 border-black flex-1 font-mono font-black text-black px-1 text-[11px]">
              {examDate || ""}
            </span>
          </div>
        </div>
        <div className="flex items-baseline gap-2 w-full">
          <span className="shrink-0 font-extrabold text-[11px]">COURSE TITLE:</span>
          <span className="border-b-2 border-black flex-1 font-extrabold text-black px-1 text-[11px]">
            {courseTitle || ""}
          </span>
        </div>
      </div>

      {/* BSC-ODI-F-121 OFFICIAL TABLE FORMAT MATCHING FACULTY PREVIEW */}
      <div className="w-full max-w-full overflow-hidden rounded-none border border-black shadow-2xs print:overflow-visible">
        <table className="w-full text-left border-collapse text-[9.5px] print:text-[9px] table-fixed border-black font-sans">
          <thead>
            <tr className="bg-white text-black font-black uppercase text-center border-b border-black">
              <th rowSpan={3} className="py-2 px-1 border-r border-black w-[15%] text-left font-black align-middle text-[8.5px] leading-tight">LESSON / TOPIC</th>
              <th rowSpan={3} className="py-2 px-1 border-r border-black w-[20%] text-left font-black align-middle text-[8.5px] leading-tight">LEARNING OUTCOMES</th>
              <th rowSpan={3} className="py-2 px-0.5 border-r border-black w-[6%] font-black text-center align-middle text-[7.5px] leading-tight">NO. OF TEACHING HOURS</th>
              <th rowSpan={3} className="py-2 px-0.5 border-r border-black w-[6%] font-black text-center align-middle text-[7.5px] leading-tight">% OF ALLOCATION</th>
              <th rowSpan={3} className="py-2 px-0.5 border-r border-black w-[6%] font-black text-center align-middle text-[7.5px] leading-tight">NO. OF ITEMS</th>
              <th colSpan={7} className="py-1.5 px-0.5 border-r border-b border-black bg-white text-black font-black text-center text-[8.5px] tracking-tight">
                ITEM SPECIFICATION PER TAXONOMY OF LEARNING
              </th>
              <th rowSpan={3} className="py-2 px-1 border-black w-[9%] font-black text-center align-middle text-[7.5px] leading-tight">ITEM PLACEMENT</th>
            </tr>
            <tr className="bg-white text-black font-black text-[7px] uppercase text-center border-b border-black">
              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden">
                REMEMBERING /<br />KNOWLEDGE
              </th>
              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden">
                UNDERSTANDING /<br />COMPREHENSION
              </th>
              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden">
                APPLYING /<br />APPLICATION
              </th>
              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden">
                ANALYZING /<br />ANALYSIS
              </th>
              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden">
                EVALUATING /<br />SYNTHESIS
              </th>
              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden">
                CREATING /<br />EVALUATION
              </th>
              <th rowSpan={2} className="py-2 px-0.5 border-r border-black bg-white font-black text-black text-[8.5px] text-center align-middle">TOTAL</th>
            </tr>
            <tr className="bg-white text-black font-black text-[8.5px] uppercase text-center border-b border-black">
              <th className="py-1 px-0.5 border-r border-black font-black text-center underline">
                {remPerc}%
              </th>
              <th className="py-1 px-0.5 border-r border-black font-black text-center underline">
                {undPerc}%
              </th>
              <th className="py-1 px-0.5 border-r border-black font-black text-center underline">
                {appPerc}%
              </th>
              <th className="py-1 px-0.5 border-r border-black font-black text-center underline">
                {anaPerc}%
              </th>
              <th className="py-1 px-0.5 border-r border-black font-black text-center underline">
                {evaPerc}%
              </th>
              <th className="py-1 px-0.5 border-r border-black font-black text-center underline">
                {crePerc}%
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black font-medium text-black bg-white">
            {topics.length === 0 ? (
              <tr>
                <td colSpan={13} className="p-6 text-center text-black italic">
                  No TOS topics configured yet.
                </td>
              </tr>
            ) : (
              topics.map((t, idx) => {
                const tax = getTax(t);
                const count = Number(t.assignedItems) || 0;
                const startItem = runningItemStart;
                const endItem = startItem + count - 1;
                const calculatedPlacement = t.itemPlacement || (count > 0 ? (count === 1 ? `Item ${startItem}` : `Items ${startItem}–${endItem}`) : "—");
                runningItemStart += count;

                return (
                  <tr key={t.id || idx} className="bg-white border-b border-black">
                    <td className="py-2 px-2 font-bold text-black border-r border-black align-top">
                      {t.topic_name || `Topic ${idx + 1}`}
                    </td>
                    <td className="py-1 px-1.5 text-black border-r border-black text-[8.5px] align-top whitespace-pre-wrap break-words leading-snug">
                      {t.learning_outcomes || `Demonstrates competency and learning outcomes for ${(t.topic_name || "").toLowerCase()}.`}
                    </td>
                    <td className="py-2 px-1 text-center font-bold text-black border-r border-black align-top">
                      {t.hours > 0 ? t.hours : "0"}
                    </td>
                    <td className="py-2 px-1 text-center font-extrabold text-black border-r border-black align-top">
                      {t.weightPercentage}%
                    </td>
                    <td className="py-2 px-1 text-center font-extrabold text-black border-r border-black align-top">
                      {t.assignedItems}
                    </td>
                    <td className="py-2 px-0.5 text-center border-r border-black font-bold text-black align-top">
                      {tax.rem}
                    </td>
                    <td className="py-2 px-0.5 text-center border-r border-black font-bold text-black align-top">
                      {tax.und}
                    </td>
                    <td className="py-2 px-0.5 text-center border-r border-black font-bold text-black align-top">
                      {tax.app}
                    </td>
                    <td className="py-2 px-0.5 text-center border-r border-black font-bold text-black align-top">
                      {tax.ana}
                    </td>
                    <td className="py-2 px-0.5 text-center border-r border-black font-bold text-black align-top">
                      {tax.eva}
                    </td>
                    <td className="py-2 px-0.5 text-center border-r border-black font-bold text-black align-top">
                      {tax.cre}
                    </td>
                    <td className="py-2 px-0.5 text-center border-r border-black font-black text-black bg-white align-top">
                      {t.assignedItems}
                    </td>
                    <td className="py-2 px-1.5 font-mono font-bold text-black text-[9px] align-top">
                      {calculatedPlacement}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-white text-black font-black text-[9px] uppercase text-center border-t-2 border-black">
              <td colSpan={2} className="py-2 px-2 border-r border-black text-left font-black">
                TOTAL
              </td>
              <td className="py-2 px-1 border-r border-black font-black">{totalHours}</td>
              <td className="py-2 px-1 border-r border-black font-black">{totalWeight}%</td>
              <td className="py-2 px-1 border-r border-black font-black">{totalAssignedItems}</td>
              <td className="py-2 px-0.5 border-r border-black font-black">{totalRemembering}</td>
              <td className="py-2 px-0.5 border-r border-black font-black">{totalUnderstanding}</td>
              <td className="py-2 px-0.5 border-r border-black font-black">{totalApplying}</td>
              <td className="py-2 px-0.5 border-r border-black font-black">{totalAnalyzing}</td>
              <td className="py-2 px-0.5 border-r border-black font-black">{totalEvaluating}</td>
              <td className="py-2 px-0.5 border-r border-black font-black">{totalCreating}</td>
              <td className="py-2 px-0.5 border-r border-black font-black">{totalAssignedItems}</td>
              <td className="py-2 px-1 font-mono font-bold text-black">
                —
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* SIGNATURES / APPROVAL WORKFLOW BLOCK MATCHING FACULTY PREVIEW */}
      {(() => {
        const cCode = (courseCode || "").trim().toUpperCase();
        const dName = (resolvedDeptName || "").toUpperCase();
        const isSingleTier = dName.includes("AGRICULTURE") || dName.includes("HOSPITALITY") || cCode.startsWith("AGRI") || cCode.startsWith("HPC") || cCode.startsWith("TPC") || cCode.startsWith("BSA") || cCode.startsWith("BSHM") || cCode.startsWith("BSTM");
        
        return (
          <div className="pt-6 border-t border-black">
            <div className={`grid grid-cols-1 ${isSingleTier ? "sm:grid-cols-3" : "sm:grid-cols-4"} gap-6 text-xs text-black font-sans`}>
              {/* Prepared by */}
              <div className="space-y-8">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Prepared by:</p>
                <div>
                  <p className="font-bold text-black border-b border-black pb-1 uppercase tracking-wide">
                    {facultyName || "FACULTY INSTRUCTOR"}
                  </p>
                  <p className="text-[11px] text-black font-semibold mt-1">{facultyRank || "Faculty Instructor"}</p>
                </div>
              </div>

              {/* Reviewed by (Program Chair) - Only for ICT, IT, TED */}
              {!isSingleTier && (
                <div className="space-y-8">
                  <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Reviewed by:</p>
                  <div>
                    <p className="font-bold text-black border-b border-black pb-1 uppercase tracking-wide">
                      {programChairName || "PROGRAM CHAIRPERSON"}
                    </p>
                    <p className="text-[11px] text-black font-semibold mt-1">Program Chairperson</p>
                  </div>
                </div>
              )}

              {/* Recommended by (Department Chair) */}
              <div className="space-y-8">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Recommended by:</p>
                <div>
                  <p className="font-bold text-black border-b border-black pb-1 uppercase tracking-wide">
                    {deptChairName || "DEPARTMENT CHAIRPERSON"}
                  </p>
                  <p className="text-[11px] text-black font-semibold mt-1">Department Chairperson</p>
                </div>
              </div>

              {/* Approved by (DI) */}
              <div className="space-y-8">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Approved by:</p>
                <div>
                  <p className="font-bold text-black border-b border-black pb-1 uppercase tracking-wide">
                    {directorInstructionName || "DIRECTOR FOR INSTRUCTION"}
                  </p>
                  <p className="text-[11px] text-black font-semibold mt-1">Director for Instruction</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* OFFICIAL BSC FOOTER IMAGE */}
      <div className="w-full mt-6 border-t border-black pt-2">
        <img
          src="/bsc-footer.png"
          alt="Batanes State College Footer"
          className="w-full h-auto object-contain block rounded-b-xl"
        />
      </div>
    </div>
  );
}

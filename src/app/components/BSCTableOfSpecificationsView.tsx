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

  // Editable Signatory State
  const [editableFacultyName, setEditableFacultyName] = React.useState(facultyName || "NAME OF FACULTY MEMBER");
  const [editableFacultyRank, setEditableFacultyRank] = React.useState(facultyRank || "Academic Rank/Designation");
  const [editableProgramChairName, setEditableProgramChairName] = React.useState(programChairName || "NAME OF PROGRAM CHAIRPERSON");
  const [editableDeptChairName, setEditableDeptChairName] = React.useState(deptChairName || "NAME OF DEPARTMENT CHAIRPERSON");
  const [editableDirectorName, setEditableDirectorName] = React.useState(directorInstructionName || "NAME OF DIRECTOR FOR INSTRUCTION");
  const [signatoryLayoutMode, setSignatoryLayoutMode] = React.useState<"WITH_PC" | "WITHOUT_PC" | "PREPARED_BY_PC" | "ALL_TEMPLATES">("WITH_PC");

  let runningItemStart = 1;

  return (
    <div className="bg-white text-black border-none rounded-none shadow-md overflow-hidden font-sans w-full max-w-[1123px] mx-auto flex flex-col justify-between min-h-[794px] print:shadow-none print:border-none print:p-0 print:m-0 print:w-full print:max-w-none print:rounded-none">
      
      {/* BSC OFFICIAL HEADER BORDER */}
      <div className="w-full relative overflow-hidden leading-none block shrink-0">
        <img
          src="/bsc-header.png"
          alt="Batanes State College Header"
          className="w-full h-auto object-cover block mx-auto print:w-full"
        />
      </div>

      {/* INNER CONTENT BODY WITH PADDING */}
      <div className="p-4 sm:p-8 space-y-4 flex-1">

      {/* TOS TITLE & TERM */}
      <div className="text-center space-y-0.5 py-1">
        <h2 className="text-base sm:text-lg font-black font-sans text-black tracking-wider uppercase">
          TABLE OF SPECIFICATIONS
        </h2>
        <p className="text-xs sm:text-sm font-black text-black uppercase tracking-wide">
          <span>[{term ? term.toUpperCase() : "TERM"}] EXAMINATION</span>
        </p>
        <p className="text-xs font-bold text-black tracking-wide">
          <span className="border-b border-black pb-0.5 px-3">
            {semester ? semester : "________"} Semester, AY {academicYear ? academicYear : "20___-20___"}
          </span>
        </p>
      </div>

      {/* COURSE & EXAMINATION METADATA GRID MATCHING TEMPLATE */}
      <div className="space-y-2 text-xs font-extrabold text-black uppercase pt-2 pb-2">
        <div className="flex flex-col sm:flex-row items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-2 flex-1 w-full">
            <span className="shrink-0 font-black text-[11px] tracking-wide">COURSE CODE:</span>
            <span className="border-b border-black flex-1 font-mono font-bold text-black px-1 text-[11px] min-h-[18px]">
              {courseCode || ""}
            </span>
          </div>
          <div className="flex items-baseline gap-2 flex-1 w-full">
            <span className="shrink-0 font-black text-[11px] tracking-wide">DATE OF EXAMINATION:</span>
            <span className="border-b border-black flex-1 font-mono font-bold text-black px-1 text-[11px] min-h-[18px]">
              {examDate || ""}
            </span>
          </div>
        </div>
        <div className="flex items-baseline gap-2 w-full">
          <span className="shrink-0 font-black text-[11px] tracking-wide">COURSE TITLE:</span>
          <span className="border-b border-black flex-1 font-bold text-black px-1 text-[11px] min-h-[18px]">
            {courseTitle || ""}
          </span>
        </div>
      </div>

      {/* BSC-ODI-F-121 OFFICIAL TABLE FORMAT MATCHING TEMPLATE */}
      <div className="w-full max-w-full overflow-hidden rounded-none border border-black shadow-2xs print:overflow-visible">
        <table className="w-full text-left border-collapse text-[9px] print:text-[8.5px] table-fixed border-black font-sans">
          <thead>
            <tr className="bg-white text-black font-black uppercase text-center border-b border-black">
              <th rowSpan={3} className="py-2 px-1.5 border-r border-black w-[14%] text-left font-black align-middle text-[8.5px] leading-tight">
                LESSON / TOPIC
              </th>
              <th rowSpan={3} className="py-2 px-2 border-r border-black w-[24%] text-left font-black align-middle text-[8.5px] leading-tight">
                LEARNING OUTCOMES
              </th>
              <th rowSpan={3} className="py-2 px-0.5 border-r border-black w-[5.5%] font-black text-center align-middle text-[7.5px] leading-tight">
                NO. OF TEACHING HOURS
              </th>
              <th rowSpan={3} className="py-2 px-0.5 border-r border-black w-[5.5%] font-black text-center align-middle text-[7.5px] leading-tight">
                % OF ALLOCATION
              </th>
              <th rowSpan={3} className="py-2 px-0.5 border-r border-black w-[5.5%] font-black text-center align-middle text-[7.5px] leading-tight">
                NO. OF ITEMS
              </th>
              <th colSpan={7} className="py-1.5 px-0.5 border-r border-b border-black bg-white text-black font-black text-center text-[8.5px] tracking-tight">
                ITEM SPECIFICATION PER TAXONOMY OF LEARNING
              </th>
              <th rowSpan={3} className="py-2 px-1 border-black w-[11.7%] font-black text-center align-middle text-[7.5px] leading-tight">
                ITEM PLACEMENT
              </th>
            </tr>
            <tr className="bg-white text-black font-black text-[7px] uppercase text-center border-b border-black">
              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden w-[4.8%]">
                KNOW LEDGE /<br />REMEMBERING
              </th>
              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden w-[4.8%]">
                COMPRE HENSION /<br />UNDERSTANDING
              </th>
              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden w-[4.8%]">
                APPLICATION /<br />APPLYING
              </th>
              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden w-[4.8%]">
                ANALYSIS /<br />ANALYZING
              </th>
              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden w-[4.8%]">
                SYNTHESIS /<br />EVALUATING
              </th>
              <th className="py-1 px-0.5 border-r border-b border-black font-black leading-tight whitespace-normal break-normal text-center overflow-hidden w-[4.8%]">
                EVALUATION /<br />CREA TING
              </th>
              <th rowSpan={2} className="py-2 px-0.5 border-r border-black bg-white font-black text-black text-[8.5px] text-center align-middle w-[5%]">
                TOTAL
              </th>
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
                <td colSpan={13} className="p-6 text-center text-black italic font-sans">
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

                // Format learning outcome text into clean bullet points if needed
                const rawOutcome = t.learning_outcomes || `Demonstrates competency and learning outcomes for ${(t.topic_name || "").toLowerCase()}.`;
                const outcomeLines = rawOutcome.split("\n").filter(l => l.trim().length > 0);

                return (
                  <tr key={t.id || idx} className="bg-white border-b border-black">
                    <td className="py-2 px-2 font-bold text-black border-r border-black align-top text-[9px] leading-normal break-words">
                      {t.topic_name || `Topic ${idx + 1}`}
                    </td>
                    <td className="py-1.5 px-2 text-black border-r border-black text-[9px] align-top whitespace-pre-wrap break-words leading-normal">
                      {outcomeLines.map((line, lIdx) => (
                        <div key={lIdx} className="flex items-start gap-1 mb-1 text-[9px] leading-normal font-sans">
                          <span className="shrink-0 font-bold">•</span>
                          <span className="break-words whitespace-pre-wrap">{line.replace(/^[•\-\*]\s*/, "")}</span>
                        </div>
                      ))}
                    </td>
                    <td className="py-2 px-1 text-center font-bold text-black border-r border-black align-top">
                      {t.hours > 0 ? t.hours : "0"}
                    </td>
                    <td className="py-2 px-1 text-center font-black text-black border-r border-black align-top">
                      {t.weightPercentage}%
                    </td>
                    <td className="py-2 px-1 text-center font-black text-black border-r border-black align-top">
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
            {/* OFFICIAL TEMPLATE TOTAL ROW: ALL CELLS FILLED WITH GOLDEN YELLOW #F5B000 */}
            <tr className="bg-[#F5B000] text-black font-black text-[9.5px] uppercase text-center border-t-2 border-black divide-x divide-black">
              <td colSpan={2} className="py-2 px-3 text-left font-black text-xs tracking-wider bg-[#F5B000]">
                TOTAL
              </td>
              <td className="py-2 px-1 font-black bg-[#F5B000]">{totalHours}</td>
              <td className="py-2 px-1 font-black bg-[#F5B000]">{totalWeight}%</td>
              <td className="py-2 px-1 font-black bg-[#F5B000]">{totalAssignedItems}</td>
              <td className="py-2 px-0.5 font-black bg-[#F5B000]">{totalRemembering}</td>
              <td className="py-2 px-0.5 font-black bg-[#F5B000]">{totalUnderstanding}</td>
              <td className="py-2 px-0.5 font-black bg-[#F5B000]">{totalApplying}</td>
              <td className="py-2 px-0.5 font-black bg-[#F5B000]">{totalAnalyzing}</td>
              <td className="py-2 px-0.5 font-black bg-[#F5B000]">{totalEvaluating}</td>
              <td className="py-2 px-0.5 font-black bg-[#F5B000]">{totalCreating}</td>
              <td className="py-2 px-0.5 font-black bg-[#F5B000]">{totalAssignedItems}</td>
              <td className="py-2 px-1 font-mono font-bold text-black bg-[#F5B000]">
                —
              </td>
            </tr>
          </tfoot>
        </table>
      </div>



      {/* PAGE 2 SIGNATORIES / APPROVAL WORKFLOW MATCHING TEMPLATE SCREENSHOT EXACTLY */}
      <div className="pt-6 border-t border-black space-y-10">
        
        {/* OPTION 1: ***Signatories for programs with Program Chairperson */}
        {(signatoryLayoutMode === "WITH_PC" || signatoryLayoutMode === "ALL_TEMPLATES") && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-12 text-xs text-black font-sans pt-1">
              {/* Row 1 Left: Prepared by */}
              <div className="space-y-6">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Prepared by:</p>
                <div>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditableFacultyName(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Faculty Member name"
                  >
                    {editableFacultyName || "NAME OF FACULTY MEMBER"}
                  </p>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditableFacultyRank(e.currentTarget.innerText || "")}
                    className="text-[11px] text-black font-semibold mt-1 outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Academic Rank / Designation"
                  >
                    {editableFacultyRank || "Academic Rank/Designation"}
                  </p>
                </div>
              </div>

              {/* Row 1 Right: Reviewed by */}
              <div className="space-y-6">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Reviewed by:</p>
                <div>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditableProgramChairName(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Program Chairperson name"
                  >
                    {editableProgramChairName || "NAME OF PROGRAM CHAIRPERSON"}
                  </p>
                  <p className="text-[11px] text-black font-semibold mt-1">Program Chairperson</p>
                </div>
              </div>

              {/* Row 2 Left: Recommending Approval */}
              <div className="space-y-6">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Recommending Approval:</p>
                <div>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditableDeptChairName(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Department Chairperson name"
                  >
                    {editableDeptChairName || "NAME OF DEPARTMENT CHAIRPERSON"}
                  </p>
                  <p className="text-[11px] text-black font-semibold mt-1">Department Chairperson</p>
                </div>
              </div>

              {/* Row 2 Right: Approved by */}
              <div className="space-y-6">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Approved by:</p>
                <div>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditableDirectorName(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Director for Instruction name"
                  >
                    {editableDirectorName || "NAME OF DIRECTOR FOR INSTRUCTION"}
                  </p>
                  <p className="text-[11px] text-black font-semibold mt-1">Director for Instruction</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OPTION 2: ***Signatories for programs with NO Program Chairperson */}
        {(signatoryLayoutMode === "WITHOUT_PC" || signatoryLayoutMode === "ALL_TEMPLATES") && (
          <div className="space-y-4 pt-4 border-t border-slate-200 print:border-black">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-12 text-xs text-black font-sans pt-1">
              {/* Row 1 Left: Prepared by */}
              <div className="space-y-6">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Prepared by:</p>
                <div>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditableFacultyName(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Faculty Member name"
                  >
                    {editableFacultyName || "NAME OF FACULTY MEMBER"}
                  </p>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditableFacultyRank(e.currentTarget.innerText || "")}
                    className="text-[11px] text-black font-semibold mt-1 outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Academic Rank / Designation"
                  >
                    {editableFacultyRank || "Academic Rank/Designation"}
                  </p>
                </div>
              </div>

              {/* Row 1 Right: Reviewed by */}
              <div className="space-y-6">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Reviewed by:</p>
                <div>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditableDeptChairName(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Department Chairperson name"
                  >
                    {editableDeptChairName || "NAME OF DEPARTMENT CHAIRPERSON"}
                  </p>
                  <p className="text-[11px] text-black font-semibold mt-1">Department Chairperson</p>
                </div>
              </div>

              {/* Row 2 Center: Approved by */}
              <div className="sm:col-span-2 max-w-sm mx-auto w-full space-y-6 pt-2">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px] text-center">Approved by:</p>
                <div className="text-center">
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditableDirectorName(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Director for Instruction name"
                  >
                    {editableDirectorName || "NAME OF DIRECTOR FOR INSTRUCTION"}
                  </p>
                  <p className="text-[11px] text-black font-semibold mt-1">Director for Instruction</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* OPTION 3: ***Signatories for Program Chairperson (when prepared by Program Chair) */}
        {(signatoryLayoutMode === "PREPARED_BY_PC" || signatoryLayoutMode === "ALL_TEMPLATES") && (
          <div className="space-y-4 pt-4 border-t border-slate-200 print:border-black">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-8 gap-x-12 text-xs text-black font-sans pt-1">
              {/* Row 1 Left: Prepared by Program Chair */}
              <div className="space-y-6">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Prepared by:</p>
                <div>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditableProgramChairName(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Program Chairperson name"
                  >
                    {editableProgramChairName || editableFacultyName || "NAME OF PROGRAM CHAIRPERSON"}
                  </p>
                  <p className="text-[11px] text-black font-semibold mt-1">Program Chairperson</p>
                </div>
              </div>

              {/* Row 1 Right: Recommending Approval */}
              <div className="space-y-6">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">Recommending Approval:</p>
                <div>
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditableDeptChairName(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Department Chairperson name"
                  >
                    {editableDeptChairName || "NAME OF DEPARTMENT CHAIRPERSON"}
                  </p>
                  <p className="text-[11px] text-black font-semibold mt-1">Department Chairperson</p>
                </div>
              </div>

              {/* Row 2 Center: Approved by */}
              <div className="sm:col-span-2 max-w-sm mx-auto w-full space-y-6 pt-2">
                <p className="font-extrabold text-black uppercase tracking-wider text-[11px] text-center">Approved by:</p>
                <div className="text-center">
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => setEditableDirectorName(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100/90 focus:ring-1 focus:ring-amber-500 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Director for Instruction name"
                  >
                    {editableDirectorName || "NAME OF DIRECTOR FOR INSTRUCTION"}
                  </p>
                  <p className="text-[11px] text-black font-semibold mt-1">Director for Instruction</p>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
      </div>

      {/* OFFICIAL BSC TOS FOOTER IMAGE (BORDERLESS AT BOTTOM EDGE) */}
      <div className="w-full mt-auto relative overflow-hidden leading-none block shrink-0">
        <img
          src="/bsc-tos-footer.png"
          alt="Batanes State College TOS Footer"
          className="w-full h-auto object-cover block mx-auto print:w-full"
        />
      </div>
    </div>
  );
}

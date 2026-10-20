"use client";

import React from "react";

export interface ExamSignatorySectionProps {
  departmentName?: string;
  programCode?: string;
  courseCode?: string;
  courseTitle?: string;

  facultyAuthorName?: string;
  facultyAuthorRank?: string;
  programChairName?: string;
  departmentChairName?: string;
  directorName?: string;

  isProgramChairAuthor?: boolean;
  authorRole?: string;
  reviewerRoleTitle?: string;
  forcedLayoutMode?: "WITH_PC" | "WITHOUT_PC" | "PREPARED_BY_PC";

  isEditable?: boolean;
  onFacultyNameChange?: (name: string) => void;
  onFacultyRankChange?: (rank: string) => void;
  onProgramChairNameChange?: (name: string) => void;
  onDepartmentChairNameChange?: (name: string) => void;
  onDirectorNameChange?: (name: string) => void;

  className?: string;
}

/**
 * Department-based configuration helper matching TOS rules:
 * ONLY Computing and Industrial Technology Department (CITD) and
 * Teacher Education Department (TED) utilize Program Chairpersons.
 * Hospitality and Tourism Management (HTM) and Agriculture Departments do NOT have Program Chairpersons.
 */
export function checkDepartmentHasProgramChair(
  courseCode?: string,
  courseTitle?: string,
  programCode?: string,
  departmentName?: string
): boolean {
  const code = (courseCode || "").trim().toUpperCase();
  const title = (courseTitle || "").trim().toUpperCase();
  const prog = (programCode || "").trim().toUpperCase();
  const dept = (departmentName || "").trim().toUpperCase();

  // Explicitly non-PC departments or programs: HTM and AGRI
  if (
    dept.includes("HOSPITALITY") || dept.includes("HTM") || dept.includes("TOURISM") ||
    dept.includes("AGRICULTURE") || dept.includes("AGRI") ||
    prog === "BSA" || prog === "BSHM" || prog === "BSTM" ||
    code.startsWith("BSA") || code.startsWith("AGRI") || code.startsWith("HPC") || 
    code.startsWith("HMPE") || code.startsWith("TPC") || code.startsWith("TPE") || 
    code.startsWith("THC") || code.startsWith("BME")
  ) {
    return false;
  }

  // CITD: BSInfoTech, BSIT / Industrial Tech
  const isICT =
    code.startsWith("ITC") ||
    code.startsWith("ITE") ||
    code.startsWith("ITM") ||
    code.startsWith("ITD") ||
    code === "ENT 403" ||
    code.includes("INFOTECH") ||
    title.includes("COMPUTING") ||
    title.includes("INFORMATION TECH") ||
    prog.includes("BSINFOTECH") ||
    prog.includes("ICT");

  const isIndustrialTech =
    code.startsWith("IND") ||
    code.startsWith("BIT") ||
    prog.includes("BIT") ||
    prog.includes("BSINDTECH") ||
    prog.includes("BSIT") ||
    (code.startsWith("IT") && !isICT && !code.startsWith("ITRM"));

  // TED: BEED, BSED
  const isTED =
    code.startsWith("EDUC") ||
    prog.includes("BSED") ||
    prog.includes("BEED") ||
    prog.includes("TED") ||
    dept.includes("TEACHER EDUCATION") ||
    title.includes("EDUCATION");

  return isICT || isIndustrialTech || isTED || dept.includes("CITD");
}

export function ExamSignatorySection({
  departmentName,
  programCode,
  courseCode,
  courseTitle,
  facultyAuthorName = "NAME OF FACULTY MEMBER",
  facultyAuthorRank = "Academic Rank / Designation",
  programChairName = "NAME OF PROGRAM CHAIRPERSON",
  departmentChairName = "NAME OF DEPARTMENT CHAIRPERSON",
  directorName = "NAME OF DIRECTOR FOR INSTRUCTION",
  isProgramChairAuthor = false,
  authorRole,
  reviewerRoleTitle,
  forcedLayoutMode,
  isEditable = false,
  onFacultyNameChange,
  onFacultyRankChange,
  onProgramChairNameChange,
  onDepartmentChairNameChange,
  onDirectorNameChange,
  className = "",
}: ExamSignatorySectionProps) {
  const hasProgramChair = React.useMemo(() => {
    return checkDepartmentHasProgramChair(courseCode, courseTitle, programCode, departmentName);
  }, [courseCode, courseTitle, programCode, departmentName]);

  const isPcOrChairAuthor = React.useMemo(() => {
    if (isProgramChairAuthor) return true;
    const rRole = (authorRole || "").toUpperCase();
    if (rRole.includes("PROGRAMCHAIR") || rRole.includes("PROGRAM CHAIR") || rRole.includes("CHAIR")) return true;
    if (reviewerRoleTitle === "Department Chairperson") return true;
    const fac = (facultyAuthorName || "").toUpperCase();
    if (fac.includes("PROGRAM CHAIR") || fac.includes("DEPARTMENT CHAIR") || fac.includes("CHAIRPERSON")) return true;
    return false;
  }, [isProgramChairAuthor, authorRole, reviewerRoleTitle, facultyAuthorName]);

  // Determine effective layout mode based on institutional TOS rules
  const effectiveLayoutMode = React.useMemo(() => {
    if (forcedLayoutMode) return forcedLayoutMode;
    if (isPcOrChairAuthor && hasProgramChair) return "PREPARED_BY_PC";
    return hasProgramChair ? "WITH_PC" : "WITHOUT_PC";
  }, [forcedLayoutMode, isPcOrChairAuthor, hasProgramChair]);

  const displayFaculty = facultyAuthorName || "NAME OF FACULTY MEMBER";
  const displayFacultyRank = facultyAuthorRank || "Instructor / Faculty Member";
  const displayProgChair = programChairName || "NAME OF PROGRAM CHAIRPERSON";
  const displayDeptChair = departmentChairName || "NAME OF DEPARTMENT CHAIRPERSON";
  const displayDirector = directorName || "NAME OF DIRECTOR FOR INSTRUCTION";

  return (
    <div
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      className={`tq-signatory-section pt-6 border-t-2 border-slate-900 mt-6 space-y-6 text-black break-inside-avoid print:break-inside-avoid print:pt-4 print:mt-4 print:border-black ${className}`}
    >
      {/* OPTION 1: SIGNATORIES FOR PROGRAMS WITH PROGRAM CHAIRPERSON (CITD, TED) */}
      {effectiveLayoutMode === "WITH_PC" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-7 gap-x-12 text-xs text-black font-sans pt-1">
            {/* Row 1 Left: Prepared by */}
            <div className="space-y-5">
              <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">
                Prepared by:
              </p>
              <div>
                {isEditable ? (
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onFacultyNameChange?.(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Faculty Member name"
                  >
                    {displayFaculty}
                  </p>
                ) : (
                  <p className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full">
                    {displayFaculty}
                  </p>
                )}

                {isEditable ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={facultyAuthorRank}
                      onChange={(e) => onFacultyRankChange?.(e.target.value)}
                      placeholder="Academic Rank / Designation"
                      className="w-full text-[11px] text-black font-semibold mt-1 bg-transparent border-none outline-none focus:bg-amber-100 rounded px-1 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:italic print:hidden"
                      title="Click to edit Academic Rank / Designation"
                    />
                    <p className="hidden print:block text-[11px] text-black font-semibold mt-1">
                      {displayFacultyRank}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-black font-semibold mt-1">
                    {displayFacultyRank}
                  </p>
                )}
              </div>
            </div>

            {/* Row 1 Right: Reviewed by */}
            <div className="space-y-5">
              <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">
                Reviewed by:
              </p>
              <div>
                {isEditable ? (
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      if (isPcOrChairAuthor) {
                        onDepartmentChairNameChange?.(e.currentTarget.innerText || "");
                      } else {
                        onProgramChairNameChange?.(e.currentTarget.innerText || "");
                      }
                    }}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title={isPcOrChairAuthor ? "Click to edit Department Chairperson name" : "Click to edit Program Chairperson name"}
                  >
                    {isPcOrChairAuthor ? displayDeptChair : displayProgChair}
                  </p>
                ) : (
                  <p className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full">
                    {isPcOrChairAuthor ? displayDeptChair : displayProgChair}
                  </p>
                )}
                <p className="text-[11px] text-black font-semibold mt-1">
                  {isPcOrChairAuthor ? "Department Chairperson" : "Program Chairperson"}
                </p>
              </div>
            </div>

            {/* Row 2 Left: Recommending Approval */}
            <div className="space-y-5">
              <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">
                Recommending Approval:
              </p>
              <div>
                {isEditable ? (
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onDepartmentChairNameChange?.(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Department Chairperson name"
                  >
                    {displayDeptChair}
                  </p>
                ) : (
                  <p className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full">
                    {displayDeptChair}
                  </p>
                )}
                <p className="text-[11px] text-black font-semibold mt-1">
                  Department Chairperson
                </p>
              </div>
            </div>

            {/* Row 2 Right: Approved by */}
            <div className="space-y-5">
              <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">
                Approved by:
              </p>
              <div>
                {isEditable ? (
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onDirectorNameChange?.(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Director for Instruction name"
                  >
                    {displayDirector}
                  </p>
                ) : (
                  <p className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full">
                    {displayDirector}
                  </p>
                )}
                <p className="text-[11px] text-black font-semibold mt-1">
                  Director for Instruction
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OPTION 2: SIGNATORIES FOR PROGRAMS WITHOUT PROGRAM CHAIRPERSON (HTM, AGRICULTURE) */}
      {effectiveLayoutMode === "WITHOUT_PC" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-7 gap-x-12 text-xs text-black font-sans pt-1">
            {/* Row 1 Left: Prepared by */}
            <div className="space-y-5">
              <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">
                Prepared by:
              </p>
              <div>
                {isEditable ? (
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onFacultyNameChange?.(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Faculty Member name"
                  >
                    {displayFaculty}
                  </p>
                ) : (
                  <p className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full">
                    {displayFaculty}
                  </p>
                )}

                {isEditable ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={facultyAuthorRank}
                      onChange={(e) => onFacultyRankChange?.(e.target.value)}
                      placeholder="Academic Rank / Designation"
                      className="w-full text-[11px] text-black font-semibold mt-1 bg-transparent border-none outline-none focus:bg-amber-100 rounded px-1 transition-all placeholder:text-slate-400 placeholder:font-normal placeholder:italic print:hidden"
                      title="Click to edit Academic Rank / Designation"
                    />
                    <p className="hidden print:block text-[11px] text-black font-semibold mt-1">
                      {displayFacultyRank}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-black font-semibold mt-1">
                    {displayFacultyRank}
                  </p>
                )}
              </div>
            </div>

            {/* Row 1 Right: Reviewed by */}
            <div className="space-y-5">
              <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">
                Reviewed by:
              </p>
              <div>
                {isEditable ? (
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onDepartmentChairNameChange?.(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Department Chairperson name"
                  >
                    {displayDeptChair}
                  </p>
                ) : (
                  <p className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full">
                    {displayDeptChair}
                  </p>
                )}
                <p className="text-[11px] text-black font-semibold mt-1">
                  Department Chairperson
                </p>
              </div>
            </div>

            {/* Row 2 Center: Approved by */}
            <div className="sm:col-span-2 max-w-sm mx-auto w-full space-y-5 pt-2 text-center">
              <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">
                Approved by:
              </p>
              <div>
                {isEditable ? (
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onDirectorNameChange?.(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Director for Instruction name"
                  >
                    {displayDirector}
                  </p>
                ) : (
                  <p className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full">
                    {displayDirector}
                  </p>
                )}
                <p className="text-[11px] text-black font-semibold mt-1">
                  Director for Instruction
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OPTION 3: SIGNATORIES WHEN PREPARED BY PROGRAM CHAIRPERSON */}
      {effectiveLayoutMode === "PREPARED_BY_PC" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-7 gap-x-12 text-xs text-black font-sans pt-1">
            {/* Row 1 Left: Prepared by Program Chair */}
            <div className="space-y-5">
              <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">
                Prepared by:
              </p>
              <div>
                {isEditable ? (
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onProgramChairNameChange?.(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Program Chairperson name"
                  >
                    {displayProgChair || displayFaculty}
                  </p>
                ) : (
                  <p className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full">
                    {displayProgChair || displayFaculty}
                  </p>
                )}
                <p className="text-[11px] text-black font-semibold mt-1">
                  Program Chairperson
                </p>
              </div>
            </div>

            {/* Row 1 Right: Recommending Approval */}
            <div className="space-y-5">
              <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">
                Recommending Approval:
              </p>
              <div>
                {isEditable ? (
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onDepartmentChairNameChange?.(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Department Chairperson name"
                  >
                    {displayDeptChair}
                  </p>
                ) : (
                  <p className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full">
                    {displayDeptChair}
                  </p>
                )}
                <p className="text-[11px] text-black font-semibold mt-1">
                  Department Chairperson
                </p>
              </div>
            </div>

            {/* Row 2 Center: Approved by */}
            <div className="sm:col-span-2 max-w-sm mx-auto w-full space-y-5 pt-2 text-center">
              <p className="font-extrabold text-black uppercase tracking-wider text-[11px]">
                Approved by:
              </p>
              <div>
                {isEditable ? (
                  <p
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => onDirectorNameChange?.(e.currentTarget.innerText || "")}
                    className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full outline-none focus:bg-amber-100 rounded px-1 transition-all cursor-text print:p-0 print:bg-transparent print:ring-0"
                    title="Click to edit Director for Instruction name"
                  >
                    {displayDirector}
                  </p>
                ) : (
                  <p className="font-bold text-black border-b border-black pb-0.5 uppercase tracking-wide inline-block w-full">
                    {displayDirector}
                  </p>
                )}
                <p className="text-[11px] text-black font-semibold mt-1">
                  Director for Instruction
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

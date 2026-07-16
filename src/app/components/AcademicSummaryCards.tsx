"use client";

interface EnrolledSubject {
  id: string;
  course_code: string;
  course_name: string;
  units: number;
  faculty_name: string;
  schedule: string;
  grade?: number | null;
}

interface AcademicSummaryCardsProps {
  student: {
    name: string;
    program: string;
    year_level: number;
    section: string;
  };
  subjects: EnrolledSubject[];
}

function gradeLabel(grade?: number | null): string {
  if (grade == null) return "In progress";
  if (grade >= 90) return "Excellent";
  if (grade >= 80) return "Good";
  if (grade >= 75) return "Passing";
  return "Needs attention";
}

function gradeColor(grade?: number | null): string {
  if (grade == null) return "#6B7280";
  if (grade >= 90) return "#166534";
  if (grade >= 80) return "#1E4D9B";
  if (grade >= 75) return "#92400E";
  return "#991B1B";
}

function gradeBg(grade?: number | null): string {
  if (grade == null) return "#F3F4F6";
  if (grade >= 90) return "#DCFCE7";
  if (grade >= 80) return "#DBEAFE";
  if (grade >= 75) return "#FEF3C7";
  return "#FEE2E2";
}

export default function AcademicSummaryCards({
  student,
  subjects,
}: AcademicSummaryCardsProps) {
  const gradedSubjects = subjects.filter((s) => s.grade != null);
  const avg =
    gradedSubjects.length > 0
      ? gradedSubjects.reduce((sum, s) => sum + (s.grade ?? 0), 0) /
        gradedSubjects.length
      : null;

  const totalUnits = subjects.reduce((sum, s) => sum + s.units, 0);

  return (
    <section className="summary-section" aria-label="Academic summary">
      {/* Top stat strip */}
      <div className="stat-strip">
        <div className="stat-card">
          <span className="stat-value">{subjects.length}</span>
          <span className="stat-label">Enrolled subjects</span>
        </div>
        <div className="stat-divider" aria-hidden="true" />
        <div className="stat-card">
          <span className="stat-value">{totalUnits}</span>
          <span className="stat-label">Total units</span>
        </div>
        <div className="stat-divider" aria-hidden="true" />
        <div className="stat-card">
          <span
            className="stat-value"
            style={{ color: gradeColor(avg ?? undefined) }}
          >
            {avg != null ? avg.toFixed(1) : "—"}
          </span>
          <span className="stat-label">Average grade</span>
        </div>
        <div className="stat-divider" aria-hidden="true" />
        <div className="stat-card">
          <span className="stat-value">
            {student.program} — Y{student.year_level}
            {student.section}
          </span>
          <span className="stat-label">Program · Section</span>
        </div>
      </div>

      {/* Enrolled subjects table */}
      <div className="subjects-block">
        <h2 className="block-title">Enrolled subjects</h2>
        <div className="subjects-grid">
          {subjects.map((subject) => (
            <div className="subject-card" key={subject.id}>
              <div className="subject-top">
                <div>
                  <span className="subject-code">{subject.course_code}</span>
                  <span className="subject-name">{subject.course_name}</span>
                </div>
                <span
                  className="grade-badge"
                  style={{
                    background: gradeBg(subject.grade),
                    color: gradeColor(subject.grade),
                  }}
                >
                  {subject.grade != null
                    ? `${subject.grade}%`
                    : gradeLabel(subject.grade)}
                </span>
              </div>
              <div className="subject-meta">
                <span className="meta-item">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="8"
                      cy="6"
                      r="3"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  {subject.faculty_name}
                </span>
                <span className="meta-item">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect
                      x="2"
                      y="3"
                      width="12"
                      height="12"
                      rx="2"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <path
                      d="M2 7h12M5 1v4M11 1v4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  {subject.schedule}
                </span>
                <span className="units-pill">{subject.units} units</span>
              </div>
              {/* Grade bar */}
              {subject.grade != null && (
                <div className="grade-bar-track" aria-hidden="true">
                  <div
                    className="grade-bar-fill"
                    style={{
                      width: `${subject.grade}%`,
                      background: gradeColor(subject.grade),
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .summary-section {
          max-width: 1280px;
          margin: 0 auto;
          padding: 32px 24px 0;
          display: flex;
          flex-direction: column;
          gap: 28px;
        }

        /* Stat strip */
        .stat-strip {
          display: flex;
          align-items: center;
          background: #0B1F5C;
          border-radius: 12px;
          padding: 20px 32px;
          gap: 0;
          border: 1px solid rgba(201,168,76,0.25);
        }
        .stat-card {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .stat-value {
          font-size: 22px;
          font-weight: 700;
          color: #C9A84C;
          line-height: 1.1;
        }
        .stat-label {
          font-size: 11px;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          text-align: center;
        }
        .stat-divider {
          width: 1px;
          height: 36px;
          background: rgba(201,168,76,0.2);
          margin: 0 8px;
          flex-shrink: 0;
        }

        /* Subjects block */
        .block-title {
          font-size: 13px;
          font-weight: 600;
          color: #6B7280;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 0 0 14px;
        }
        .subjects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 12px;
        }
        .subject-card {
          background: #ffffff;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: box-shadow 0.15s, border-color 0.15s;
        }
        .subject-card:hover {
          border-color: #1E4D9B;
          box-shadow: 0 2px 8px rgba(30,77,155,0.08);
        }
        .subject-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .subject-code {
          display: block;
          font-size: 11px;
          font-weight: 700;
          color: #1E4D9B;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 2px;
        }
        .subject-name {
          display: block;
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          line-height: 1.3;
        }
        .grade-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 99px;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .subject-meta {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          color: #6B7280;
        }
        .units-pill {
          margin-left: auto;
          font-size: 10px;
          font-weight: 600;
          color: #374151;
          background: #F3F4F6;
          padding: 2px 7px;
          border-radius: 99px;
        }
        .grade-bar-track {
          height: 3px;
          background: #F3F4F6;
          border-radius: 99px;
          overflow: hidden;
        }
        .grade-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.6s ease;
          opacity: 0.75;
        }

        @media (max-width: 600px) {
          .stat-strip { flex-direction: column; gap: 16px; padding: 20px; }
          .stat-divider { display: none; }
        }
      `}</style>
    </section>
  );
}

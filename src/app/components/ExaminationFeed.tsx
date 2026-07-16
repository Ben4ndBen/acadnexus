"use client";

import { useState } from "react";

export interface Exam {
  id: string;
  title: string;
  course_code: string;
  course_name: string;
  exam_type: "Prelim" | "Midterm" | "Semi-Final" | "Final" | "Quiz" | "Long Test";
  scheduled_date: string; // ISO string
  duration_minutes: number;
  total_items: number;
  status: "upcoming" | "open" | "completed" | "missed";
  score?: number | null;
  instructions?: string | null;
}

interface ExaminationFeedProps {
  exams: Exam[];
  student: {
    program: string;
    year_level: number;
    section: string;
  };
}

const EXAM_TYPE_COLOR: Record<Exam["exam_type"], { bg: string; text: string }> = {
  Prelim:       { bg: "#EFF6FF", text: "#1E4D9B" },
  Midterm:      { bg: "#FFF7ED", text: "#92400E" },
  "Semi-Final": { bg: "#F0FDF4", text: "#166534" },
  Final:        { bg: "#FDF2F8", text: "#701A75" },
  Quiz:         { bg: "#F0F9FF", text: "#0369A1" },
  "Long Test":  { bg: "#FEFCE8", text: "#713F12" },
};

const STATUS_META: Record<Exam["status"], { label: string; dot: string }> = {
  upcoming:  { label: "Upcoming",  dot: "#6B7280" },
  open:      { label: "Open now",  dot: "#16A34A" },
  completed: { label: "Completed", dot: "#1E4D9B" },
  missed:    { label: "Missed",    dot: "#DC2626" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

type FilterStatus = "all" | Exam["status"];
type FilterType   = "all" | Exam["exam_type"];

export default function ExaminationFeed({ exams, student }: ExaminationFeedProps) {
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [typeFilter, setTypeFilter] = useState<FilterType>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = exams.filter((e) => {
    const matchStatus = statusFilter === "all" || e.status === statusFilter;
    const matchType   = typeFilter   === "all" || e.exam_type === typeFilter;
    return matchStatus && matchType;
  });

  // Group: open first, then upcoming (soonest), then completed, then missed
  const order: Record<Exam["status"], number> = {
    open: 0, upcoming: 1, completed: 2, missed: 3,
  };
  const sorted = [...filtered].sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
  });

  const uniqueTypes = Array.from(new Set(exams.map((e) => e.exam_type)));

  return (
    <section className="feed-section" aria-label="Examination feed">
      <div className="feed-header">
        <div>
          <h2 className="feed-title">Examination feed</h2>
          <p className="feed-sub">
            Showing exams for {student.program} · Year {student.year_level} · Section {student.section}
          </p>
        </div>
        <div className="filter-row" role="group" aria-label="Filter exams">
          {/* Status filter */}
          <div className="filter-group">
            {(["all", "open", "upcoming", "completed", "missed"] as FilterStatus[]).map((s) => (
              <button
                key={s}
                className={`filter-btn${statusFilter === s ? " active" : ""}`}
                onClick={() => setStatusFilter(s)}
                aria-pressed={statusFilter === s}
              >
                {s === "all" ? "All" : STATUS_META[s].label}
              </button>
            ))}
          </div>
          {/* Type filter */}
          <select
            className="type-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as FilterType)}
            aria-label="Filter by exam type"
          >
            <option value="all">All types</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <rect x="8" y="10" width="24" height="26" rx="3" stroke="#D1D5DB" strokeWidth="1.5"/>
            <path d="M14 18h12M14 24h8" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M14 6v8M26 6v8" stroke="#D1D5DB" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p>No exams match the current filters.</p>
        </div>
      ) : (
        <div className="exam-list">
          {sorted.map((exam) => {
            const typeColor = EXAM_TYPE_COLOR[exam.exam_type];
            const statusMeta = STATUS_META[exam.status];
            const days = daysUntil(exam.scheduled_date);
            const isExpanded = expanded === exam.id;
            const scorePercent = exam.score != null
              ? Math.round((exam.score / exam.total_items) * 100)
              : null;

            return (
              <div
                key={exam.id}
                className={`exam-card status-${exam.status}${isExpanded ? " expanded" : ""}`}
              >
                <button
                  className="exam-row"
                  onClick={() => setExpanded(isExpanded ? null : exam.id)}
                  aria-expanded={isExpanded}
                  aria-controls={`exam-detail-${exam.id}`}
                >
                  {/* Left: status indicator */}
                  <span
                    className="status-dot"
                    style={{ background: statusMeta.dot }}
                    aria-label={statusMeta.label}
                  />

                  {/* Middle: main info */}
                  <div className="exam-info">
                    <div className="exam-top-row">
                      <span
                        className="exam-type-badge"
                        style={{ background: typeColor.bg, color: typeColor.text }}
                      >
                        {exam.exam_type}
                      </span>
                      <span className="exam-course-code">{exam.course_code}</span>
                      <span className="exam-title">{exam.title}</span>
                    </div>
                    <div className="exam-bottom-row">
                      <span className="exam-date">
                        {formatDate(exam.scheduled_date)} · {formatTime(exam.scheduled_date)}
                      </span>
                      <span className="exam-duration">{exam.duration_minutes} min</span>
                      <span className="exam-items">{exam.total_items} items</span>
                    </div>
                  </div>

                  {/* Right: score or countdown */}
                  <div className="exam-right">
                    {exam.status === "completed" && scorePercent != null ? (
                      <div className="score-display">
                        <span className="score-pct" style={{ color: scorePercent >= 75 ? "#166534" : "#DC2626" }}>
                          {scorePercent}%
                        </span>
                        <span className="score-raw">{exam.score}/{exam.total_items}</span>
                      </div>
                    ) : exam.status === "open" ? (
                      <span className="open-cta">Take exam →</span>
                    ) : exam.status === "upcoming" ? (
                      <span className="countdown">
                        {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`}
                      </span>
                    ) : (
                      <span className="missed-label">Missed</span>
                    )}
                    <svg
                      className={`chevron${isExpanded ? " flipped" : ""}`}
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </button>

                {/* Expandable detail */}
                {isExpanded && (
                  <div className="exam-detail" id={`exam-detail-${exam.id}`}>
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">Course</span>
                        <span className="detail-value">{exam.course_name}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Status</span>
                        <span className="detail-value" style={{ color: statusMeta.dot }}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Duration</span>
                        <span className="detail-value">{exam.duration_minutes} minutes</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Items</span>
                        <span className="detail-value">{exam.total_items} questions</span>
                      </div>
                    </div>
                    {exam.instructions && (
                      <p className="exam-instructions">{exam.instructions}</p>
                    )}
                    {exam.status === "open" && (
                      <a href={`/dashboard/student/exams/${exam.id}`} className="exam-cta-btn">
                        Start examination
                      </a>
                    )}
                    {exam.status === "completed" && scorePercent != null && (
                      <div className="score-bar-track">
                        <div
                          className="score-bar-fill"
                          style={{
                            width: `${scorePercent}%`,
                            background: scorePercent >= 75 ? "#16A34A" : "#DC2626",
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .feed-section {
          max-width: 1280px;
          margin: 0 auto;
          padding: 28px 24px 48px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .feed-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .feed-title {
          font-size: 20px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 4px;
        }
        .feed-sub {
          font-size: 12px;
          color: #6B7280;
          margin: 0;
        }
        .filter-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .filter-group {
          display: flex;
          gap: 4px;
          background: #F3F4F6;
          border-radius: 8px;
          padding: 3px;
        }
        .filter-btn {
          padding: 5px 12px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          color: #6B7280;
          background: transparent;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .filter-btn:hover { color: #111827; background: rgba(0,0,0,0.05); }
        .filter-btn.active { background: #0B1F5C; color: #ffffff; }
        .type-select {
          padding: 6px 10px;
          border: 1px solid #E5E7EB;
          border-radius: 7px;
          font-size: 12px;
          color: #374151;
          background: #ffffff;
          cursor: pointer;
          outline: none;
        }
        .type-select:focus { border-color: #1E4D9B; }

        /* Exam list */
        .exam-list { display: flex; flex-direction: column; gap: 8px; }

        .exam-card {
          background: #ffffff;
          border: 1px solid #E5E7EB;
          border-radius: 10px;
          overflow: hidden;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .exam-card:hover { border-color: #9CA3AF; }
        .exam-card.status-open {
          border-color: #16A34A;
          box-shadow: 0 0 0 1px #16A34A;
        }
        .exam-card.expanded { border-color: #1E4D9B; }

        .exam-row {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 18px;
          background: none;
          border: none;
          text-align: left;
          cursor: pointer;
        }
        .exam-row:focus-visible {
          outline: 2px solid #1E4D9B;
          outline-offset: -2px;
          border-radius: 10px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .exam-info { flex: 1; min-width: 0; }
        .exam-top-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 5px;
          flex-wrap: wrap;
        }
        .exam-type-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 99px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
        }
        .exam-course-code {
          font-size: 11px;
          font-weight: 700;
          color: #1E4D9B;
          letter-spacing: 0.04em;
        }
        .exam-title {
          font-size: 14px;
          font-weight: 600;
          color: #111827;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .exam-bottom-row {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .exam-date, .exam-duration, .exam-items {
          font-size: 11px;
          color: #6B7280;
        }

        .exam-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .score-display { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
        .score-pct { font-size: 16px; font-weight: 700; line-height: 1; }
        .score-raw { font-size: 10px; color: #6B7280; }
        .open-cta {
          font-size: 12px;
          font-weight: 600;
          color: #16A34A;
          white-space: nowrap;
        }
        .countdown {
          font-size: 12px;
          font-weight: 600;
          color: #C9A84C;
          white-space: nowrap;
        }
        .missed-label {
          font-size: 12px;
          font-weight: 600;
          color: #DC2626;
        }
        .chevron {
          color: #9CA3AF;
          transition: transform 0.2s;
        }
        .chevron.flipped { transform: rotate(180deg); }

        /* Expandable detail */
        .exam-detail {
          border-top: 1px solid #F3F4F6;
          padding: 16px 18px 18px 40px;
          background: #FAFAFA;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 10px;
        }
        .detail-item { display: flex; flex-direction: column; gap: 2px; }
        .detail-label {
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: #9CA3AF;
        }
        .detail-value { font-size: 13px; font-weight: 500; color: #111827; }
        .exam-instructions {
          font-size: 12px;
          color: #6B7280;
          background: #ffffff;
          border: 1px solid #E5E7EB;
          border-radius: 6px;
          padding: 10px 12px;
          margin: 0;
          line-height: 1.6;
        }
        .exam-cta-btn {
          display: inline-block;
          padding: 8px 20px;
          background: #0B1F5C;
          color: #C9A84C;
          font-size: 13px;
          font-weight: 600;
          border-radius: 7px;
          text-decoration: none;
          align-self: flex-start;
          transition: background 0.15s;
        }
        .exam-cta-btn:hover { background: #1E4D9B; }
        .score-bar-track {
          height: 4px;
          background: #E5E7EB;
          border-radius: 99px;
          overflow: hidden;
        }
        .score-bar-fill {
          height: 100%;
          border-radius: 99px;
          transition: width 0.6s ease;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 48px;
          color: #9CA3AF;
          font-size: 13px;
          background: #F9FAFB;
          border-radius: 10px;
          border: 1px dashed #E5E7EB;
        }

        @media (max-width: 640px) {
          .feed-header { flex-direction: column; }
          .exam-row { flex-wrap: wrap; }
        }
      `}</style>
    </section>
  );
}

"use client";

import { LogoutButton } from "./LogoutButton";

interface StudentHeaderProps {
  student: {
    name: string;
    institutional_id: string;
    program: string;
    year_level: number;
    section: string;
  };
}

export default function StudentHeader({ student }: StudentHeaderProps) {
  const initials = student.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="student-header">
      <div className="header-inner">
        {/* Branding */}
        <div className="header-brand">
          <div className="brand-seal" aria-hidden="true">
            <svg viewBox="0 0 40 40" width="40" height="40" fill="none">
              <circle cx="20" cy="20" r="19" stroke="#C9A84C" strokeWidth="1.5" />
              <circle cx="20" cy="20" r="14" stroke="#C9A84C" strokeWidth="0.75" strokeDasharray="2 2" />
              {/* Ivatan hills silhouette */}
              <path d="M6 26 Q10 18 14 22 Q17 16 20 20 Q23 14 26 19 Q30 16 34 24" stroke="#C9A84C" strokeWidth="1" fill="none" />
              {/* lighthouse */}
              <rect x="19" y="14" width="2" height="6" fill="#C9A84C" />
              <polygon points="18,14 22,14 20,11" fill="#C9A84C" />
              {/* sea waves */}
              <path d="M8 29 Q11 27 14 29 Q17 31 20 29 Q23 27 26 29 Q29 31 32 29" stroke="#1E4D9B" strokeWidth="0.8" fill="none" />
            </svg>
          </div>
          <div>
            <span className="brand-name">AcadNexus</span>
            <span className="brand-sub">Batanes State College</span>
          </div>
        </div>

        {/* Nav links */}
        <nav className="header-nav" aria-label="Student navigation">
          <a href="/dashboard/student" className="nav-link active">Overview</a>
          <a href="/dashboard/student/exam" className="nav-link">Examinations</a>
          <a href="/dashboard/student/subjects" className="nav-link">Subjects</a>
          <a href="/dashboard/student/portfolio" className="nav-link">Portfolio</a>
        </nav>

        {/* Profile */}
        <div className="header-profile">
          <div className="profile-meta">
            <span className="profile-name">{student.name}</span>
            <span className="profile-id">{student.institutional_id}</span>
          </div>
          <div className="avatar" aria-hidden="true">{initials}</div>
          <LogoutButton />
        </div>
      </div>

      <style>{`
        .student-header {
          background: #0B1F5C;
          border-bottom: 2px solid #C9A84C;
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .header-inner {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 24px;
          height: 64px;
          display: flex;
          align-items: center;
          gap: 32px;
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }
        .brand-seal {
          display: flex;
          align-items: center;
        }
        .brand-name {
          display: block;
          font-size: 15px;
          font-weight: 700;
          color: #C9A84C;
          letter-spacing: 0.04em;
          line-height: 1.1;
        }
        .brand-sub {
          display: block;
          font-size: 10px;
          color: rgba(201,168,76,0.6);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .header-nav {
          display: flex;
          align-items: center;
          gap: 4px;
          flex: 1;
        }
        .nav-link {
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,0.65);
          text-decoration: none;
          transition: color 0.15s, background 0.15s;
          white-space: nowrap;
        }
        .nav-link:hover {
          color: #ffffff;
          background: rgba(255,255,255,0.08);
        }
        .nav-link.active {
          color: #C9A84C;
          background: rgba(201,168,76,0.12);
        }
        .header-profile {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          margin-left: auto;
        }
        .profile-meta {
          text-align: right;
        }
        .profile-name {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: #ffffff;
          line-height: 1.2;
        }
        .profile-id {
          display: block;
          font-size: 11px;
          color: rgba(255,255,255,0.45);
          font-family: monospace;
        }
        .avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, #1E4D9B, #0B1F5C);
          border: 1.5px solid #C9A84C;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: #C9A84C;
          flex-shrink: 0;
        }
        @media (max-width: 768px) {
          .header-nav { display: none; }
          .profile-meta { display: none; }
        }
      `}</style>
    </header>
  );
}

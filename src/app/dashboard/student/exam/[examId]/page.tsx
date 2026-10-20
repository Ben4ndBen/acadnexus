import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { startStudentExam, getStudentExamResultDetails } from "@/app/actions/student";
import { formatStudentName } from "@/lib/academicUtils";
import { TakeExamClient } from "@/app/components/TakeExamClient";
import { StudentExamResultContent } from "@/app/components/StudentExamResultContent";
import Link from "next/link";
import { ShieldAlert, CheckCircle2, ArrowLeft, GraduationCap, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ examId: string }>;
}

export default async function ExamPage({ params }: PageProps) {
  const { examId: examIdStr } = await params;
  const examId = Number(examIdStr);

  if (isNaN(examId)) {
    redirect("/dashboard/student");
  }

  // 1. Verify User and Role
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const role = user.user_metadata?.role;
  const institutionalId = user.user_metadata?.institutional_id;

  if (role !== "Student") {
    redirect("/");
  }

  // 2. Fetch student details from the database
  const dbUser = await db.user.findUnique({
    where: { institutional_id: institutionalId },
    include: {
      student: {
        include: {
          program: {
            include: {
              department: true,
            },
          },
        },
      },
    },
  });

  const student = dbUser?.student;
  if (!student) {
    redirect("/");
  }

  // 3. Initialize/Fetch the Student Exam attempt
  const result = await startStudentExam(examId, student.student_id);

  // Handle errors (e.g. target mismatches, inactive schedules)
  if (result.error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#7A151A] text-white p-2 rounded-xl">
                <GraduationCap className="w-6 h-6" />
              </div>
              <span className="font-extrabold text-slate-900 tracking-tight">AcadNexus</span>
            </div>
            <Link
              href="/dashboard/student"
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> Exit to Dashboard
            </Link>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center space-y-6">
            <div className="mx-auto w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 border border-rose-100">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-extrabold text-slate-900">Cannot Open Exam</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                {result.error}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <Link
                href="/dashboard/student"
                className="w-full inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-sm"
              >
                Back to Dashboard
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Handle completed examinations: allow revisiting result without retaking exam or creating another attempt
  if (result.isCompleted) {
    const resultDetails = await getStudentExamResultDetails({
      examId,
      studentId: student.student_id,
    });

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-[#7A151A] text-white p-2 rounded-xl">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <span className="font-extrabold text-slate-900 tracking-tight">AcadNexus</span>
                <span className="text-xs text-emerald-700 font-bold ml-2 bg-emerald-50 px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-200">
                  Exam Results
                </span>
              </div>
            </div>
            <Link
              href="/dashboard/student"
              className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition-colors font-semibold bg-white border border-slate-200 px-3.5 py-2 rounded-xl shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {resultDetails.data ? (
            <StudentExamResultContent data={resultDetails.data} isModal={false} />
          ) : (
            <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center space-y-6">
              <div className="mx-auto w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-extrabold text-slate-900">Exam Already Submitted</h2>
                <p className="text-slate-500 text-sm">
                  {resultDetails.error || "You have already submitted this exam and cannot retake it."}
                </p>
              </div>
              <Link
                href="/dashboard/student"
                className="w-full inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-sm"
              >
                Back to Dashboard
              </Link>
            </div>
          )}
        </main>
      </div>
    );
  }
  // 4. Render interactive client interface for the active exam attempt
  return (
    <TakeExamClient
      studentId={student.student_id}
      studentName={formatStudentName(student, "firstLast")}
      institutionalId={dbUser.institutional_id}
      examId={examId}
      initialData={{
        studentExamId: result.studentExamId!,
        remainingSeconds: result.remainingSeconds!,
        questions: result.questions!,
        savedAnswers: result.savedAnswers!,
        examTitle: result.examTitle!,
        courseTitle: result.courseTitle!,
        courseCode: result.courseCode!,
        timePenaltySeconds: (result as any).timePenaltySeconds!,
        scorePenaltyPoints: (result as any).scorePenaltyPoints!,
        timeLimitMinutes: (result as any).timeLimitMinutes || 60,
        isInProgress: !!(result as any).isInProgress,
      }}
    />
  );
}

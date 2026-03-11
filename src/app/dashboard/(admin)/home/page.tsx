"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardTitle,
  CardHeader,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  GraduationCap,
  BookOpen,
  Users,
  CalendarDays,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleType = "MWF" | "TTH" | "FS";

type ClassroomSchedule = {
  id: number;
  subject_id: string;
  subject_name: string;
  classroom_name: string;
  instructor: string;
  schedule_type: ScheduleType;
  start_date: string;
  end_date: string;
  time_start: string;
  time_end: string;
  enrolled_count: number;
  status: "Active" | "Upcoming" | "Completed";
};

type RecentStudent = {
  id: number;
  student_id: string;
  full_name: string;
  year_level: string;
  status: "Active" | "Inactive";
  enrolled_subjects: string[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const scheduleTypeColor: Record<ScheduleType, string> = {
  MWF: "bg-purple-100 text-purple-700 border-purple-200",
  TTH: "bg-amber-100 text-amber-700 border-amber-200",
  FS:  "bg-teal-100 text-teal-700 border-teal-200",
};

const statusColor: Record<string, string> = {
  Active:    "bg-green-100 text-green-700 border-green-200",
  Upcoming:  "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-gray-100 text-gray-500 border-gray-200",
};

const SCHEDULE_LABELS: Record<ScheduleType, string> = {
  MWF: "Mon · Wed · Fri",
  TTH: "Tue · Thu",
  FS:  "Fri · Sat",
};

const PIE_COLORS = ["#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#f43f5e"];

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_SCHEDULES: ClassroomSchedule[] = [
  { id: 1, subject_id: "MATH101", subject_name: "Mathematics",      classroom_name: "Room 101", instructor: "Mr. Santos",    schedule_type: "MWF", start_date: "2026-03-01", end_date: "2026-06-01", time_start: "08:00", time_end: "10:00", enrolled_count: 28, status: "Active" },
  { id: 2, subject_id: "SCI101",  subject_name: "Science",          classroom_name: "Room 202", instructor: "Ms. Reyes",     schedule_type: "TTH", start_date: "2026-03-01", end_date: "2026-06-15", time_start: "10:30", time_end: "12:00", enrolled_count: 24, status: "Active" },
  { id: 3, subject_id: "CS101",   subject_name: "Computer Science", classroom_name: "Lab A",    instructor: "Mr. Cruz",      schedule_type: "MWF", start_date: "2026-03-15", end_date: "2026-07-01", time_start: "13:00", time_end: "15:00", enrolled_count: 20, status: "Upcoming" },
  { id: 4, subject_id: "FIL101",  subject_name: "Filipino",         classroom_name: "Room 305", instructor: "Ms. Garcia",    schedule_type: "FS",  start_date: "2026-03-01", end_date: "2026-05-30", time_start: "09:00", time_end: "11:00", enrolled_count: 30, status: "Active" },
  { id: 5, subject_id: "ENG101",  subject_name: "English",          classroom_name: "Room 110", instructor: "Ms. Lim",       schedule_type: "TTH", start_date: "2026-03-05", end_date: "2026-06-05", time_start: "14:00", time_end: "16:00", enrolled_count: 26, status: "Active" },
  { id: 6, subject_id: "HIS101",  subject_name: "History",          classroom_name: "Room 208", instructor: "Mr. Dela Cruz", schedule_type: "MWF", start_date: "2026-03-01", end_date: "2026-06-01", time_start: "11:00", time_end: "12:30", enrolled_count: 18, status: "Completed" },
];

const MOCK_RECENT_STUDENTS: RecentStudent[] = [
  { id: 1, student_id: "2026-00001", full_name: "Santos, Juan Miguel",  year_level: "2nd Year", status: "Active",   enrolled_subjects: ["MATH101", "CS101"] },
  { id: 2, student_id: "2026-00002", full_name: "Reyes, Maria Clara",   year_level: "1st Year", status: "Active",   enrolled_subjects: ["SCI101", "ENG101", "FIL101"] },
  { id: 3, student_id: "2026-00003", full_name: "Cruz, Paolo Andre",    year_level: "3rd Year", status: "Active",   enrolled_subjects: ["HIS101", "MATH101"] },
  { id: 4, student_id: "2026-00004", full_name: "Garcia, Ana Liza",     year_level: "4th Year", status: "Inactive", enrolled_subjects: ["CS101"] },
  { id: 5, student_id: "2026-00005", full_name: "Lim, Kevin James",     year_level: "2nd Year", status: "Active",   enrolled_subjects: ["SCI101", "FIL101"] },
  { id: 6, student_id: "2026-00006", full_name: "Dela Cruz, Anna Mae",  year_level: "1st Year", status: "Active",   enrolled_subjects: ["MATH101", "ENG101"] },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  title: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, sub, icon, color }) => (
  <Card className={`w-full border-0 shadow-sm ${color}`}>
    <CardContent className="pt-5 pb-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-gray-800">{value}</p>
          <p className="text-xs text-gray-500">{sub}</p>
        </div>
        <div className="p-2 rounded-lg bg-white/60">
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const Home: React.FC = () => {

  // ── Derived stats ─────────────────────────────────────────────────────────

  const totalSchedules   = MOCK_SCHEDULES.length;
  const activeSchedules  = MOCK_SCHEDULES.filter((s) => s.status === "Active").length;
  const totalStudents    = MOCK_RECENT_STUDENTS.length;
  const activeStudents   = MOCK_RECENT_STUDENTS.filter((s) => s.status === "Active").length;
  const totalEnrollments = MOCK_RECENT_STUDENTS.reduce((acc, s) => acc + s.enrolled_subjects.length, 0);

  // Enrollment by subject (for bar chart)
  const enrollmentBySubject = MOCK_SCHEDULES.map((s) => ({
    name: s.subject_id,
    fullName: s.subject_name,
    enrolled: s.enrolled_count,
  }));

  // Schedule type distribution (for pie chart)
  const scheduleTypeDist = useMemo(() => {
    const counts: Record<string, number> = { MWF: 0, TTH: 0, FS: 0 };
    MOCK_SCHEDULES.forEach((s) => counts[s.schedule_type]++);
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  // Year level distribution (for pie)
  const yearDist = useMemo(() => {
    const counts: Record<string, number> = {};
    MOCK_RECENT_STUDENTS.forEach((s) => {
      counts[s.year_level] = (counts[s.year_level] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full px-4 py-6 space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of classroom schedules and student enrollments</p>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={totalStudents}
          sub={`${activeStudents} active`}
          icon={<GraduationCap className="w-5 h-5 text-blue-500" />}
          color="bg-blue-50"
        />
        <StatCard
          title="Schedules"
          value={totalSchedules}
          sub={`${activeSchedules} active classes`}
          icon={<CalendarDays className="w-5 h-5 text-amber-500" />}
          color="bg-amber-50"
        />
        <StatCard
          title="Total Enrollments"
          value={totalEnrollments}
          sub="across all subjects"
          icon={<BookOpen className="w-5 h-5 text-emerald-500" />}
          color="bg-emerald-50"
        />
        <StatCard
          title="Avg. per Subject"
          value={(totalEnrollments / totalSchedules).toFixed(1)}
          sub="students per class"
          icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
          color="bg-purple-50"
        />
      </div>

      {/* ── Row 2: Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Enrollment by Subject — Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Enrollment by Subject
            </CardTitle>
            <CardDescription className="text-xs">Number of students per subject</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={enrollmentBySubject} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value, _, props) => [value, props.payload.fullName]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="enrolled" radius={[4, 4, 0, 0]}>
                  {enrollmentBySubject.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Schedule Type Breakdown — Pie */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-purple-500" />
              Schedule Types
            </CardTitle>
            <CardDescription className="text-xs">MWF · TTH · FS distribution</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <PieChart width={180} height={160}>
              <Pie
                data={scheduleTypeDist}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={65}
                innerRadius={35}
                paddingAngle={3}
              >
                {scheduleTypeDist.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
            <div className="flex gap-3 mt-1">
              {scheduleTypeDist.map((entry, i) => (
                <div key={entry.name} className="flex items-center gap-1 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {entry.name}: <span className="font-semibold">{entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Active Schedules + Recent Students ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Active Classroom Schedules */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              Classroom Schedules
            </CardTitle>
            <CardDescription className="text-xs">All active and upcoming classes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {MOCK_SCHEDULES.map((sched) => (
              <div
                key={sched.id}
                className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800 truncate">{sched.subject_name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">{sched.subject_id}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{sched.classroom_name}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{sched.instructor}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {sched.time_start} – {sched.time_end} · {SCHEDULE_LABELS[sched.schedule_type]}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor[sched.status]}`}>
                    {sched.status}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-semibold ${scheduleTypeColor[sched.schedule_type]}`}>
                    {sched.schedule_type}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />{sched.enrolled_count}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Students */}
        <div className="space-y-4">

          {/* Year level pie + student list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-500" />
                Students by Year Level
              </CardTitle>
              <CardDescription className="text-xs">Enrollment distribution</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <PieChart width={130} height={130}>
                <Pie
                  data={yearDist}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={55}
                  innerRadius={28}
                  paddingAngle={3}
                >
                  {yearDist.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
              </PieChart>
              <div className="space-y-1.5 flex-1">
                {yearDist.map((entry, i) => (
                  <div key={entry.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-gray-600">{entry.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800">{entry.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent enrolled students list */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Recently Enrolled Students
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {MOCK_RECENT_STUDENTS.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{student.full_name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-mono">{student.student_id}</span>
                      <span>·</span>
                      <span>{student.year_level}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      {student.status === "Active" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
                      )}
                      <span className={`text-[10px] font-medium ${student.status === "Active" ? "text-green-600" : "text-gray-400"}`}>
                        {student.status}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {student.enrolled_subjects.length} subject{student.enrolled_subjects.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Home;
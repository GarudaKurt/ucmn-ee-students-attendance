"use client";

import { useState, useMemo, useEffect } from "react";
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
  Loader2,
  Radio,
} from "lucide-react";

// ── Firestore services ────────────────────────────────────────────────────────
import {
  subscribeToStudents,
  subscribeToSchedules,
} from "@/app/services/scheduleService"; // exports ClassroomSchedule + subscribeToSchedules

import {
  subscribeToStudents as subStudents,
} from "@/app/services/studentService";   // exports Student + subscribeToStudents

import {
  subscribeToAttendance,
  AttendanceRecord,
} from "@/app/services/attendaceService";

// ─── NOTE: adjust the two import paths above if your service files export
//     these from a different location. The key exports needed are:
//       subscribeToSchedules(cb)  →  ClassroomSchedule[]
//       subscribeToStudents(cb)   →  Student[]
//       subscribeToAttendance(cb) →  AttendanceRecord[]

// ─── Types (re-declared locally so the file is self-contained) ────────────────

type ScheduleType = "MWF" | "TTH" | "FS";

interface ClassroomSchedule {
  id?: string;
  subject_id?: string;
  subject_name: string;
  classroom_name: string;
  instructor: string;
  schedule_type: ScheduleType;
  start_date: string;
  end_date: string;
  time_start: string;
  time_end: string;
  enrolled_students?: any[];
  max_students?: number;
  status: "Active" | "Upcoming" | "Completed";
}

interface EnrolledSubject {
  schedule_id: string;
  subject_name: string;
  classroom_name: string;
  instructor: string;
  schedule_type: ScheduleType;
  time_start: string;
  time_end: string;
  enrolled_at: string;
}

interface Student {
  id?: string;
  student_id: string;
  full_name: string;
  year_level: string;
  section: string;
  status?: "Active" | "Inactive";
  enrolled_subjects: EnrolledSubject[];
  created_at?: any;
}

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

const todayISO = () => new Date().toISOString().split("T")[0];

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  title: string;
  value: string | number;
  sub: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}> = ({ title, value, sub, icon, color, loading }) => (
  <Card className={`w-full border-0 shadow-sm ${color}`}>
    <CardContent className="pt-5 pb-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          {loading ? (
            <div className="h-8 flex items-center">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
            </div>
          ) : (
            <p className="text-3xl font-bold text-gray-800">{value}</p>
          )}
          <p className="text-xs text-gray-500">{sub}</p>
        </div>
        <div className="p-2 rounded-lg bg-white/60">{icon}</div>
      </div>
    </CardContent>
  </Card>
);

// ─── Attendance Status Badge ──────────────────────────────────────────────────

const AttBadge: React.FC<{ status: string }> = ({ status }) => {
  const cls: Record<string, string> = {
    Present: "bg-green-100 text-green-700 border-green-200",
    Late:    "bg-yellow-100 text-yellow-700 border-yellow-200",
    Absent:  "bg-red-100 text-red-600 border-red-200",
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cls[status] ?? "bg-gray-100 text-gray-400"}`}>
      {status}
    </Badge>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const Home: React.FC = () => {

  // ── Firestore live state ──────────────────────────────────────────────────
  const [schedules,  setSchedules]  = useState<ClassroomSchedule[]>([]);
  const [students,   setStudents]   = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  const [loadingSch, setLoadingSch] = useState(true);
  const [loadingStu, setLoadingStu] = useState(true);
  const [loadingAtt, setLoadingAtt] = useState(true);

  const loading = loadingSch || loadingStu || loadingAtt;

  useEffect(() => {
    // subscribe to all three collections in parallel
    const unsubSch = subscribeToSchedules((d) => { setSchedules(d);  setLoadingSch(false); });
    const unsubStu = subStudents((d)           => { setStudents(d);   setLoadingStu(false); });
    const unsubAtt = subscribeToAttendance((d) => { setAttendance(d); setLoadingAtt(false); });
    return () => { unsubSch(); unsubStu(); unsubAtt(); };
  }, []);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const totalSchedules  = schedules.length;
  const activeSchedules = schedules.filter((s) => s.status === "Active").length;
  const totalStudents   = students.length;
  const activeStudents  = students.filter((s) => (s.status ?? "Active") === "Active").length;

  const totalEnrollments = students.reduce(
    (acc, s) => acc + (s.enrolled_subjects?.length ?? 0), 0
  );

  const avgPerSubject = totalSchedules > 0
    ? (totalEnrollments / totalSchedules).toFixed(1)
    : "0.0";

  // Today's attendance summary
  const today = todayISO();
  const todayRecords  = attendance.filter((r) => r.date === today);
  const todayPresent  = todayRecords.filter((r) => r.status === "Present").length;
  const todayLate     = todayRecords.filter((r) => r.status === "Late").length;
  const todayAbsent   = todayRecords.filter((r) => r.status === "Absent").length;

  // ── Chart data ────────────────────────────────────────────────────────────

  // Enrollment per schedule (bar chart)
  const enrollmentBySubject = useMemo(() =>
    schedules.map((s) => ({
      name:     s.subject_name.length > 10 ? s.subject_name.slice(0, 10) + "…" : s.subject_name,
      fullName: s.subject_name,
      enrolled: s.enrolled_students?.length ?? 0,
    })),
  [schedules]);

  // Schedule type distribution (donut)
  const scheduleTypeDist = useMemo(() => {
    const counts: Record<string, number> = { MWF: 0, TTH: 0, FS: 0 };
    schedules.forEach((s) => counts[s.schedule_type]++);
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [schedules]);

  // Year level distribution (donut)
  const yearDist = useMemo(() => {
    const counts: Record<string, number> = {};
    students.forEach((s) => {
      counts[s.year_level] = (counts[s.year_level] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [students]);

  // Today's attendance by subject (bar)
  const attendanceBySubject = useMemo(() => {
    const map: Record<string, { present: number; late: number; absent: number }> = {};
    todayRecords.forEach((r) => {
      if (!map[r.subject_name]) map[r.subject_name] = { present: 0, late: 0, absent: 0 };
      if (r.status === "Present") map[r.subject_name].present++;
      else if (r.status === "Late") map[r.subject_name].late++;
      else map[r.subject_name].absent++;
    });
    return Object.entries(map).map(([name, v]) => ({ name, ...v }));
  }, [todayRecords]);

  // 5 most recently registered students
  const recentStudents = useMemo(() =>
    [...students]
      .sort((a, b) => {
        const ta = a.created_at?.toMillis?.() ?? 0;
        const tb = b.created_at?.toMillis?.() ?? 0;
        return tb - ta;
      })
      .slice(0, 6),
  [students]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full px-4 py-6 space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of classroom schedules, students, and today's attendance
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Syncing Firestore…
          </div>
        )}
      </div>

      {/* ── Row 1: Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Students"
          value={totalStudents}
          sub={`${activeStudents} active`}
          icon={<GraduationCap className="w-5 h-5 text-blue-500" />}
          color="bg-blue-50"
          loading={loadingStu}
        />
        <StatCard
          title="Schedules"
          value={totalSchedules}
          sub={`${activeSchedules} active classes`}
          icon={<CalendarDays className="w-5 h-5 text-amber-500" />}
          color="bg-amber-50"
          loading={loadingSch}
        />
        <StatCard
          title="Total Enrollments"
          value={totalEnrollments}
          sub="across all subjects"
          icon={<BookOpen className="w-5 h-5 text-emerald-500" />}
          color="bg-emerald-50"
          loading={loadingStu}
        />
        <StatCard
          title="Avg. per Subject"
          value={avgPerSubject}
          sub="students per class"
          icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
          color="bg-purple-50"
          loading={loading}
        />
      </div>

      {/* ── Row 2: Today's Attendance Summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-green-50">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Present Today</p>
              {loadingAtt
                ? <Loader2 className="w-5 h-5 animate-spin text-gray-400 mt-1" />
                : <p className="text-3xl font-bold text-gray-800">{todayPresent}</p>}
              <p className="text-xs text-gray-500">{today}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-yellow-50">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-500 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Late Today</p>
              {loadingAtt
                ? <Loader2 className="w-5 h-5 animate-spin text-gray-400 mt-1" />
                : <p className="text-3xl font-bold text-gray-800">{todayLate}</p>}
              <p className="text-xs text-gray-500">{todayRecords.length} total taps</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-red-50">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Absent Today</p>
              {loadingAtt
                ? <Loader2 className="w-5 h-5 animate-spin text-gray-400 mt-1" />
                : <p className="text-3xl font-bold text-gray-800">{todayAbsent}</p>}
              <p className="text-xs text-gray-500">logged absences</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Enrollment by Subject — Bar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Enrollment by Subject
            </CardTitle>
            <CardDescription className="text-xs">Students enrolled per schedule</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSch ? (
              <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            ) : enrollmentBySubject.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">
                No schedules found
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={enrollmentBySubject} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
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
            )}
          </CardContent>
        </Card>

        {/* Schedule Type Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-purple-500" />
              Schedule Types
            </CardTitle>
            <CardDescription className="text-xs">MWF · TTH · FS distribution</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {loadingSch ? (
              <div className="flex items-center justify-center h-[160px]">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            ) : (
              <>
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
                <div className="flex gap-3 mt-1 flex-wrap justify-center">
                  {scheduleTypeDist.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-1 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {entry.name}: <span className="font-semibold">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Today's Attendance by Subject ── */}
      {(todayRecords.length > 0 || loadingAtt) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-400" />
              Today's Attendance by Subject
              <span className="text-[10px] font-mono text-muted-foreground font-normal">{today}</span>
            </CardTitle>
            <CardDescription className="text-xs">Present · Late · Absent per subject</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingAtt ? (
              <div className="flex items-center justify-center h-[180px]">
                <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={attendanceBySubject} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="present" name="Present" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="late"    name="Late"    stackId="a" fill="#f59e0b" />
                  <Bar dataKey="absent"  name="Absent"  stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Row 5: Schedules + Students ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Classroom Schedules list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-500" />
              Classroom Schedules
            </CardTitle>
            <CardDescription className="text-xs">All active and upcoming classes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loadingSch ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : schedules.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No schedules found.</p>
            ) : (
              schedules.map((sched, idx) => (
                <div
                  key={sched.id ?? idx}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 truncate">{sched.subject_name}</span>
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
                      <Users className="w-3 h-3" />{sched.enrolled_students?.length ?? 0}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Right column: year dist + recent students */}
        <div className="space-y-4">

          {/* Year level donut */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-500" />
                Students by Year Level
              </CardTitle>
              <CardDescription className="text-xs">Enrollment distribution</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              {loadingStu ? (
                <div className="flex justify-center w-full py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              ) : (
                <>
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
                </>
              )}
            </CardContent>
          </Card>

          {/* Recently registered students */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                Recently Enrolled Students
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingStu ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
                </div>
              ) : recentStudents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No students registered yet.</p>
              ) : (
                recentStudents.map((student) => {
                  // find today's attendance records for this student
                  const todayAtt = todayRecords.filter(
                    (r) => r.student_doc_id === student.id
                  );

                  return (
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
                          {(student.status ?? "Active") === "Active" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
                          )}
                          <span className={`text-[10px] font-medium ${(student.status ?? "Active") === "Active" ? "text-green-600" : "text-gray-400"}`}>
                            {student.status ?? "Active"}
                          </span>
                        </div>
                        {/* Show today's attendance status if available */}
                        {todayAtt.length > 0 ? (
                          <AttBadge status={todayAtt[0].status} />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">
                            {student.enrolled_subjects?.length ?? 0} subject{(student.enrolled_subjects?.length ?? 0) !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Home;
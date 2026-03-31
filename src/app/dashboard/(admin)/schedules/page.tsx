"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import {
  CalendarIcon, PlusCircle, BookOpen, Clock, Users,
  CalendarDays, Loader2, UserPlus, UserMinus, Search,
  CheckCircle2, XCircle, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetClose, SheetContent, SheetDescription,
  SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/../../firebase/configFirebase";

import {
  ClassroomSchedule,
  SessionDate,
  ScheduleType,
  createSchedule,
  subscribeToSchedules,
  enrollStudent,
  unenrollStudent,
} from "@/app/services/scheduleService";

import {
  Student,
  subscribeToStudents,
  addEnrolledSubject,
  removeEnrolledSubject, 
} from "@/app/services/studentService";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCHEDULE_DAYS: Record<ScheduleType, number[]> = {
  MWF: [1, 3, 5],
  TTH: [2, 4],
  FS:  [5, 6],
};

const SCHEDULE_LABELS: Record<ScheduleType, string> = {
  MWF: "Mon · Wed · Fri",
  TTH: "Tue · Thu",
  FS:  "Fri · Sat",
};

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

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSessionArray(dates: Date[], timeStart: string, timeEnd: string): SessionDate[] {
  return dates.map((d) => ({
    date:       d.toISOString().split("T")[0],
    dayOfWeek:  DAY_NAMES[d.getDay()],
    time_start: timeStart,
    time_end:   timeEnd,
  }));
}

type SessionSchedule = Pick<ClassroomSchedule, "schedule_type" | "start_date" | "end_date">;

function getSessionDatesInRange(
  schedule: SessionSchedule,
  filterStart: Date,
  filterEnd: Date
): Date[] {
  const schedStart  = parseISO(schedule.start_date);
  const schedEnd    = parseISO(schedule.end_date);
  const windowStart = filterStart > schedStart ? filterStart : schedStart;
  const windowEnd   = filterEnd   < schedEnd   ? filterEnd   : schedEnd;
  if (windowStart > windowEnd) return [];
  const allowedDays = SCHEDULE_DAYS[schedule.schedule_type];
  return eachDayOfInterval({ start: windowStart, end: windowEnd }).filter(
    (d) => allowedDays.includes(d.getDay())
  );
}

// ─── Session Chip ─────────────────────────────────────────────────────────────

const SessionChip: React.FC<{ date: Date }> = ({ date }) => (
  <span className="inline-block bg-gray-100 text-gray-700 text-[10px] font-medium px-2 py-0.5 rounded-full border border-gray-200">
    {format(date, "MMM d")}
  </span>
);

// ─── Enroll Students Dialog ───────────────────────────────────────────────────

type EnrollStudentsDialogProps = {
  open: boolean;
  schedule: ClassroomSchedule | null;
  allStudents: Student[];
  onClose: () => void;
  onEnrollStudent: (scheduleId: string, student: Student) => Promise<void>;
  onUnenrollStudent: (scheduleId: string, studentUid: string) => Promise<void>;
};

const EnrollStudentsDialog: React.FC<EnrollStudentsDialogProps> = ({
  open,
  schedule,
  allStudents,
  onClose,
  onEnrollStudent,
  onUnenrollStudent,
}) => {
  const [search,     setSearch]     = useState("");
  // Map of studentDocId → "adding" | "removing" | null for per-row loading
  const [processing, setProcessing] = useState<Record<string, "adding" | "removing" | null>>({});
  // Map of studentDocId → error message
  const [errors,     setErrors]     = useState<Record<string, string>>({});

  // Reset search when dialog opens
  useEffect(() => {
    if (open) { setSearch(""); setErrors({}); }
  }, [open]);

  if (!schedule) return null;

  const enrolledUids = new Set(schedule.enrolled_students.map((s) => s.uid));
  const isFull       = schedule.enrolled_students.length >= (schedule.max_students ?? 40);

  // Filter students by search term
  const filtered = allStudents.filter((s) => {
    const t = search.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(t) ||
      s.email.toLowerCase().includes(t) ||
      s.student_id.toLowerCase().includes(t)
    );
  });

  const handleAdd = async (student: Student) => {
    const key = student.id!;
    setProcessing((p) => ({ ...p, [key]: "adding" }));
    setErrors((e) => ({ ...e, [key]: "" }));
    try {
      await onEnrollStudent(schedule.id!, student);
    } catch (err: any) {
      setErrors((e) => ({ ...e, [key]: err.message }));
    } finally {
      setProcessing((p) => ({ ...p, [key]: null }));
    }
  };

  const handleRemove = async (student: Student) => {
    const key = student.id!;
    setProcessing((p) => ({ ...p, [key]: "removing" }));
    setErrors((e) => ({ ...e, [key]: "" }));
    try {
      await onUnenrollStudent(schedule.id!, student.id!);
    } catch (err: any) {
      setErrors((e) => ({ ...e, [key]: err.message }));
    } finally {
      setProcessing((p) => ({ ...p, [key]: null }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">

        {/* ── Header ── */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-100">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-blue-500" />
            Enroll Students
          </DialogTitle>
          <DialogDescription className="text-xs mt-0.5">
            <span className="font-medium text-gray-700">{schedule.subject_name}</span>
            <span className="mx-1.5 text-gray-300">·</span>
            {schedule.classroom_name}
            <span className="mx-1.5 text-gray-300">·</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${scheduleTypeColor[schedule.schedule_type]}`}>
              {schedule.schedule_type}
            </span>
          </DialogDescription>

          {/* Capacity bar */}
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{schedule.enrolled_students.length} enrolled</span>
              <span>{schedule.max_students ?? 40} max</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isFull ? "bg-red-400" : "bg-blue-400"}`}
                style={{
                  width: `${Math.min(
                    100,
                    (schedule.enrolled_students.length / (schedule.max_students ?? 40)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>
        </DialogHeader>

        {/* ── Search ── */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-9 h-9 text-sm"
              placeholder="Search by name, email or student ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-2.5 text-muted-foreground hover:text-gray-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {filtered.length} student{filtered.length !== 1 ? "s" : ""} shown
            {search && <> for "<span className="font-medium">{search}</span>"</>}
          </p>
        </div>

        {/* ── Student list ── */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No students match your search.
            </div>
          ) : (
            filtered.map((student) => {
              const isEnrolled = enrolledUids.has(student.id!);
              const state      = processing[student.id!] ?? null;
              const error      = errors[student.id!] ?? "";

              return (
                <div
                  key={student.id}
                  className={`flex items-center gap-3 px-5 py-3 transition-colors ${
                    isEnrolled ? "bg-green-50/60" : "hover:bg-gray-50"
                  }`}
                >
                  {/* Avatar initial */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isEnrolled
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}>
                    {student.full_name.charAt(0).toUpperCase()}
                  </div>

                  {/* Student info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {student.full_name}
                      </p>
                      {isEnrolled && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1 py-0 bg-green-100 text-green-700 border-green-200 leading-4"
                        >
                          Enrolled
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{student.email}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{student.student_id}</p>
                    {error && (
                      <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
                        <XCircle className="w-3 h-3 flex-shrink-0" />{error}
                      </p>
                    )}
                  </div>

                  {/* Action button */}
                  {isEnrolled ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-shrink-0 h-7 px-2.5 text-[11px] border-red-200 text-red-600 hover:bg-red-50"
                      disabled={state !== null}
                      onClick={() => handleRemove(student)}
                    >
                      {state === "removing" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <><UserMinus className="w-3 h-3 mr-1" />Remove</>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-shrink-0 h-7 px-2.5 text-[11px] bg-blue-500 hover:bg-blue-600 text-white"
                      disabled={state !== null || isFull}
                      onClick={() => handleAdd(student)}
                    >
                      {state === "adding" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <><UserPlus className="w-3 h-3 mr-1" />{isFull ? "Full" : "Add"}</>
                      )}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Schedule Card ────────────────────────────────────────────────────────────

type ScheduleCardProps = {
  schedule: ClassroomSchedule;
  sessionDates?: Date[];
  onSelectClick: (schedule: ClassroomSchedule, sessionDates?: Date[]) => void;
  onEnrollClick: (schedule: ClassroomSchedule) => void;
};

const ScheduleCard: React.FC<ScheduleCardProps> = ({
  schedule,
  sessionDates,
  onSelectClick,
  onEnrollClick,
}) => {
  const {
    id, classroom_name, subject_name, instructor,
    schedule_type, start_date, end_date,
    time_start, time_end, status = "Active",
    enrolled_students, max_students = 40,
  } = schedule;

  const [showAll, setShowAll] = useState(false);
  const PREVIEW_LIMIT = 6;
  const visible = showAll
    ? (sessionDates ?? [])
    : (sessionDates ?? []).slice(0, PREVIEW_LIMIT);

  const isFull = enrolled_students.length >= max_students;

  return (
    <Card className="w-full hover:shadow-md transition-shadow border border-gray-200">
      <CardContent className="pt-5 pb-4 space-y-3">

        {/* Subject + Room + Status */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 p-1.5 rounded-md">
              <BookOpen className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">{subject_name}</p>
              <p className="text-xs text-muted-foreground">{classroom_name}</p>
            </div>
          </div>
          <Badge className={`text-[10px] px-2 py-0.5 border font-medium ${statusColor[status]}`} variant="outline">
            {status}
          </Badge>
        </div>

        {/* Schedule type */}
        <Badge className={`text-[10px] px-2 py-0.5 border font-semibold ${scheduleTypeColor[schedule_type]}`} variant="outline">
          {schedule_type} · {SCHEDULE_LABELS[schedule_type]}
        </Badge>

        {/* Instructor */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{instructor}</span>
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>
            {new Date(start_date).toLocaleDateString()} – {new Date(end_date).toLocaleDateString()}
          </span>
        </div>

        {/* Time */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{time_start} – {time_end}</span>
        </div>

        {/* Enrollment count */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{enrolled_students.length} / {max_students} students enrolled</span>
          {isFull && (
            <Badge className="text-[10px] px-1.5 py-0 bg-red-100 text-red-600 border-red-200" variant="outline">
              Full
            </Badge>
          )}
        </div>

        {/* Session dates in range */}
        {sessionDates && sessionDates.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{sessionDates.length} session{sessionDates.length !== 1 ? "s" : ""} in range</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {visible.map((d, i) => <SessionChip key={i} date={d} />)}
              {sessionDates.length > PREVIEW_LIMIT && (
                <button
                  onClick={() => setShowAll((p) => !p)}
                  className="text-[10px] text-blue-500 underline ml-1 self-center"
                >
                  {showAll ? "Show less" : `+${sessionDates.length - PREVIEW_LIMIT} more`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs"
            onClick={() => onSelectClick(schedule, sessionDates)}
          >
            View Details
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs border-green-200 text-green-700 hover:bg-green-50"
            onClick={() => onEnrollClick(schedule)}
          >
            <UserPlus className="w-3 h-3 mr-1" />
            Enroll
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ClassroomSchedules: React.FC = () => {
  const [user] = useAuthState(auth);

  // ── Data ──────────────────────────────────────────────────────────────────
  const [schedules,  setSchedules]  = useState<ClassroomSchedule[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loadingSch, setLoadingSch] = useState(true);

  useEffect(() => {
    setLoadingSch(true);
    const unsubSch = subscribeToSchedules((data) => {
      setSchedules(data); setLoadingSch(false);
    });
    // Subscribe to students once so the dialog always has fresh data
    const unsubStu = subscribeToStudents((data) => setAllStudents(data));
    return () => { unsubSch(); unsubStu(); };
  }, []);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterClassroom,  setFilterClassroom]  = useState("");
  const [filterSubject,    setFilterSubject]    = useState("");
  const [filterStatus,     setFilterStatus]     = useState("all");
  const [filterSchedType,  setFilterSchedType]  = useState<"all" | ScheduleType>("all");
  const [filterRangeStart, setFilterRangeStart] = useState<Date | undefined>();
  const [filterRangeEnd,   setFilterRangeEnd]   = useState<Date | undefined>();

  // ── New schedule form ─────────────────────────────────────────────────────
  const [isSheetOpen,   setIsSheetOpen]   = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [classroomName, setClassroomName] = useState("");
  const [subjectName,   setSubjectName]   = useState("");
  const [instructor,    setInstructor]    = useState("");
  const [scheduleType,  setScheduleType]  = useState<ScheduleType | "">("");
  const [startDate,     setStartDate]     = useState<Date | undefined>();
  const [endDate,       setEndDate]       = useState<Date | undefined>();
  const [timeStart,     setTimeStart]     = useState("");
  const [timeEnd,       setTimeEnd]       = useState("");
  const [maxStudents,   setMaxStudents]   = useState("40");

  // ── Detail sheet ──────────────────────────────────────────────────────────
  const [isDetailOpen,         setIsDetailOpen]         = useState(false);
  const [selectedSchedule,     setSelectedSchedule]     = useState<ClassroomSchedule | null>(null);
  const [selectedSessionDates, setSelectedSessionDates] = useState<Date[]>([]);

  // ── Enroll dialog ─────────────────────────────────────────────────────────
  const [enrollDialogSchedule, setEnrollDialogSchedule] = useState<ClassroomSchedule | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────

  const hasDateFilter = !!filterRangeStart && !!filterRangeEnd;

  const filteredResults = useMemo(() => {
    return schedules
      .filter((s) => {
        if (!s.classroom_name.toLowerCase().includes(filterClassroom.toLowerCase())) return false;
        if (!s.subject_name.toLowerCase().includes(filterSubject.toLowerCase()))   return false;
        if (filterStatus    !== "all" && s.status        !== filterStatus)         return false;
        if (filterSchedType !== "all" && s.schedule_type !== filterSchedType)      return false;
        if (hasDateFilter) {
          const sStart = parseISO(s.start_date);
          const sEnd   = parseISO(s.end_date);
          if (sStart > filterRangeEnd! || sEnd < filterRangeStart!) return false;
        }
        return true;
      })
      .map((s) => ({
        schedule: s,
        sessionDates: hasDateFilter
          ? getSessionDatesInRange(s, filterRangeStart!, filterRangeEnd!)
          : undefined,
      }))
      .filter(({ sessionDates }) =>
        hasDateFilter ? (sessionDates?.length ?? 0) > 0 : true
      );
  }, [schedules, filterClassroom, filterSubject, filterStatus, filterSchedType, filterRangeStart, filterRangeEnd, hasDateFilter]);

  const formSessionPreview = useMemo(() => {
    if (!scheduleType || !startDate || !endDate) return [];
    return getSessionDatesInRange(
      {
        schedule_type: scheduleType,
        start_date: startDate.toISOString().split("T")[0],
        end_date:   endDate.toISOString().split("T")[0],
      },
      startDate,
      endDate
    );
  }, [scheduleType, startDate, endDate]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveSchedule = async () => {
    if (!classroomName || !subjectName || !instructor || !scheduleType ||
        !startDate || !endDate || !timeStart || !timeEnd) {
      alert("Please fill in all fields."); return;
    }
    if (formSessionPreview.length === 0) {
      alert("No sessions generated for the selected date range and schedule type."); return;
    }
    setSaving(true);
    try {
      const sessions         = buildSessionArray(formSessionPreview, timeStart, timeEnd);
      const derivedStartDate = sessions[0].date;
      const derivedEndDate   = sessions[sessions.length - 1].date;
      await createSchedule({
        classroom_name: classroomName, subject_name: subjectName,
        instructor, schedule_type: scheduleType as ScheduleType,
        start_date: derivedStartDate, end_date: derivedEndDate,
        time_start: timeStart, time_end: timeEnd,
        status: "Upcoming",
        max_students: parseInt(maxStudents, 10) || 40,
        sessions,
      });
      setIsSheetOpen(false);
      setClassroomName(""); setSubjectName(""); setInstructor("");
      setScheduleType(""); setStartDate(undefined); setEndDate(undefined);
      setTimeStart(""); setTimeEnd(""); setMaxStudents("40");
    } catch (err: any) {
      alert("Failed to save schedule: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Enroll a student into the currently-open enroll dialog's schedule.
   * Also syncs the student's enrolled_subjects array in the students collection.
   */
  const handleEnrollStudent = useCallback(async (
    scheduleId: string,
    student: Student
  ) => {
    // 1. Write to classroom_schedules.enrolled_students (existing)
    await enrollStudent(scheduleId, {
      uid:         student.id!,
      displayName: student.full_name,
      email:       student.email,
    });

    // 2. Write to students.enrolled_subjects (new — makes attendance table work)
const schedule = schedules.find((s) => s.id === scheduleId);
if (schedule) {
  await addEnrolledSubject(student.id!, {
    ...schedule,
    id:           schedule.id!,
    max_students: schedule.max_students ?? 40,
  });
}
  }, [schedules]);

  /**
   * Remove a student from the schedule.
   * Uses the student's Firestore doc ID (student.id) as the uid stored in
   * enrolled_students when registered via studentService.registerStudent().
   */
  const handleUnenrollStudent = useCallback(async (
    scheduleId: string,
    studentDocId: string
  ) => {
    await unenrollStudent(scheduleId, studentDocId);
  }, []);

  const handleSelectClick = (schedule: ClassroomSchedule, sessionDates?: Date[]) => {
    setSelectedSchedule(schedule);
    setSelectedSessionDates(sessionDates ?? []);
    setIsDetailOpen(true);
  };

  const handleEnrollClick = (schedule: ClassroomSchedule) => {
    // Always use the freshest schedule from the live list so enrolled counts are current
    const fresh = schedules.find((s) => s.id === schedule.id) ?? schedule;
    setEnrollDialogSchedule(fresh);
  };

  const handleClearFilters = () => {
    setFilterClassroom(""); setFilterSubject("");
    setFilterStatus("all"); setFilterSchedType("all");
    setFilterRangeStart(undefined); setFilterRangeEnd(undefined);
  };

  // Keep the enroll dialog schedule in sync with live Firestore updates
  // so the capacity bar and enrolled badges update in real-time
  useEffect(() => {
    if (!enrollDialogSchedule) return;
    const fresh = schedules.find((s) => s.id === enrollDialogSchedule.id);
    if (fresh) setEnrollDialogSchedule(fresh);
  }, [schedules]);

  const hasActiveFilters =
    filterClassroom || filterSubject || filterStatus !== "all" ||
    filterSchedType !== "all" || hasDateFilter;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="p-4 space-y-4">

        {/* ── Filter Card ── */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-lg font-semibold">Classroom Schedules</CardTitle>
              <div className="flex gap-2">
                {hasActiveFilters && (
                  <Button size="sm" variant="ghost" onClick={handleClearFilters} className="text-xs text-red-500 hover:text-red-600">
                    Clear Filters
                  </Button>
                )}
                <Button
                  size="sm"
                  className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={() => setIsSheetOpen(true)}
                >
                  <PlusCircle className="w-4 h-4" />New Schedule
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <Input placeholder="Search classroom..." value={filterClassroom} onChange={(e) => setFilterClassroom(e.target.value)} />
              <Input placeholder="Search subject..."   value={filterSubject}   onChange={(e) => setFilterSubject(e.target.value)} />
              <Select value={filterSchedType} onValueChange={(v) => setFilterSchedType(v as "all" | ScheduleType)}>
                <SelectTrigger><SelectValue placeholder="All Types" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Schedule Type</SelectLabel>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="MWF">MWF – Mon · Wed · Fri</SelectItem>
                    <SelectItem value="TTH">TTH – Tue · Thu</SelectItem>
                    <SelectItem value="FS">FS – Fri · Sat</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Status</SelectLabel>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Upcoming">Upcoming</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                Filter sessions by date:
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start text-left text-xs min-w-[140px]">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {filterRangeStart ? format(filterRangeStart, "MMM d, yyyy") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={filterRangeStart} onSelect={setFilterRangeStart} initialFocus />
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="justify-start text-left text-xs min-w-[140px]">
                    <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                    {filterRangeEnd ? format(filterRangeEnd, "MMM d, yyyy") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={filterRangeEnd} onSelect={setFilterRangeEnd} initialFocus />
                </PopoverContent>
              </Popover>
              {hasDateFilter && filterSchedType !== "all" && (
                <Badge className={`text-xs px-2 py-1 ${scheduleTypeColor[filterSchedType as ScheduleType]}`} variant="outline">
                  {filterSchedType} · {format(filterRangeStart!, "MMM d")} – {format(filterRangeEnd!, "MMM d, yyyy")}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Results bar ── */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {loadingSch ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading schedules...
            </span>
          ) : (
            <span>
              {filteredResults.length} schedule{filteredResults.length !== 1 ? "s" : ""} found
              {hasDateFilter && (
                <> · sessions from{" "}
                  <span className="font-medium text-gray-700">{format(filterRangeStart!, "MMM d")}</span>
                  {" "}–{" "}
                  <span className="font-medium text-gray-700">{format(filterRangeEnd!, "MMM d, yyyy")}</span>
                </>
              )}
            </span>
          )}
        </div>

        {/* ── Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {!loadingSch && filteredResults.length > 0 ? (
            filteredResults.map(({ schedule, sessionDates }) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                sessionDates={sessionDates}
                onSelectClick={handleSelectClick}
                onEnrollClick={handleEnrollClick}
              />
            ))
          ) : !loadingSch ? (
            <div className="col-span-full py-12 text-center space-y-1">
              <p className="text-sm font-medium text-gray-500">No schedules found</p>
              <p className="text-xs text-muted-foreground">Try adjusting your filters or date range.</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Enroll Students Dialog ── */}
      <EnrollStudentsDialog
        open={!!enrollDialogSchedule}
        schedule={enrollDialogSchedule}
        allStudents={allStudents}
        onClose={() => setEnrollDialogSchedule(null)}
        onEnrollStudent={handleEnrollStudent}
        onUnenrollStudent={handleUnenrollStudent}
      />

      {/* ── New Schedule Sheet ── */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>New Classroom Schedule</SheetTitle>
            <SheetDescription>Fill in the details to add a new classroom schedule to Firestore.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="classroomName">Classroom Name</Label>
              <Input id="classroomName" placeholder="e.g., Room 101" value={classroomName} onChange={(e) => setClassroomName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subjectName">Subject Name</Label>
              <Input id="subjectName" placeholder="e.g., Mathematics" value={subjectName} onChange={(e) => setSubjectName(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="instructor">Instructor</Label>
              <Input id="instructor" placeholder="e.g., Mr. Santos" value={instructor} onChange={(e) => setInstructor(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="maxStudents">Max Students</Label>
              <Input id="maxStudents" type="number" min="1" max="200" value={maxStudents} onChange={(e) => setMaxStudents(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Schedule Type</Label>
              <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as ScheduleType)}>
                <SelectTrigger><SelectValue placeholder="Select schedule type" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Schedule Type</SelectLabel>
                    <SelectItem value="MWF">MWF – Monday · Wednesday · Friday</SelectItem>
                    <SelectItem value="TTH">TTH – Tuesday · Thursday</SelectItem>
                    <SelectItem value="FS">FS – Friday · Saturday</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              {scheduleType && (
                <p className="text-xs text-muted-foreground">
                  Classes run every <span className="font-medium">{SCHEDULE_LABELS[scheduleType as ScheduleType]}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left text-sm">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex flex-col gap-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start text-left text-sm">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {formSessionPreview.length > 0 && (
              <div className="rounded-md bg-blue-50 border border-blue-100 p-3 space-y-1.5">
                <p className="text-xs font-semibold text-blue-700">
                  Session Preview — {formSessionPreview.length} total sessions
                </p>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                  {formSessionPreview.slice(0, 14).map((d, i) => <SessionChip key={i} date={d} />)}
                  {formSessionPreview.length > 14 && (
                    <span className="text-[10px] text-blue-400 self-center">
                      …and {formSessionPreview.length - 14} more
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="timeStart">Time Start</Label>
                <Input id="timeStart" type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="timeEnd">Time End</Label>
                <Input id="timeEnd" type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <SheetFooter>
            <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleSaveSchedule} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Save Schedule"}
            </Button>
            <SheetClose asChild><Button variant="outline">Cancel</Button></SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Detail Sheet ── */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Schedule Details</SheetTitle>
            <SheetDescription>Full information about the selected classroom schedule.</SheetDescription>
          </SheetHeader>
          {selectedSchedule && (
            <div className="grid gap-4 py-4">
              <DetailRow label="Classroom"     value={selectedSchedule.classroom_name} />
              <DetailRow label="Subject"       value={selectedSchedule.subject_name} />
              <DetailRow label="Instructor"    value={selectedSchedule.instructor} />
              <DetailRow label="Schedule Type" value={`${selectedSchedule.schedule_type} (${SCHEDULE_LABELS[selectedSchedule.schedule_type]})`} />
              <DetailRow label="Start Date"    value={new Date(selectedSchedule.start_date).toLocaleDateString()} />
              <DetailRow label="End Date"      value={new Date(selectedSchedule.end_date).toLocaleDateString()} />
              <DetailRow label="Time"          value={`${selectedSchedule.time_start} – ${selectedSchedule.time_end}`} />
              <DetailRow label="Status"        value={selectedSchedule.status ?? "—"} />
              <DetailRow label="Enrollment"    value={`${selectedSchedule.enrolled_students.length} / ${selectedSchedule.max_students ?? 40} students`} />
              {selectedSchedule.enrolled_students.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Enrolled Students</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {selectedSchedule.enrolled_students.map((s, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-md px-3 py-1.5 text-xs">
                        <span className="font-medium">{s.displayName}</span>
                        <span className="text-muted-foreground">{s.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedSessionDates.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Sessions in filtered range ({selectedSessionDates.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
                    {selectedSessionDates.map((d, i) => <SessionChip key={i} date={d} />)}
                  </div>
                </div>
              )}
            </div>
          )}
          <SheetFooter>
            <SheetClose asChild><Button variant="outline">Close</Button></SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="grid grid-cols-2 gap-2 border-b pb-2 last:border-0">
    <span className="text-sm text-muted-foreground font-medium">{label}</span>
    <span className="text-sm font-semibold">{value}</span>
  </div>
);

export default ClassroomSchedules;
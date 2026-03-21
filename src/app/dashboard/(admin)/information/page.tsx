"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  Table, TableBody, TableCaption, TableCell,
  TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Pencil, Trash, Clock, Search, BookOpen,
  CalendarDays, Users, FilterX, Loader2, Radio,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ── Firebase Realtime Database ────────────────────────────────────────────────
import { ref, onValue, off } from "firebase/database";
import { database } from "@/../firebase/configFirebase";

// ── Firestore service ─────────────────────────────────────────────────────────
import {
  Student, AttendanceRecord, EnrolledSubject, ScheduleType,
  subscribeToStudents, subscribeToAttendance,
  updateStudent, deleteStudentDoc,
  getLatestPerSubject, computeStatus,
  logAttendance, updateAttendance,
} from "@/app/services/attendaceService";

// ─── RTDB path ────────────────────────────────────────────────────────────────
// Expected node shape at "monitoring":
//   { studentId: 2909423, timeIn: "10:40", timeOut: "11:15" }
//
// studentId can be a raw RFID number OR a formatted string — both are handled.
const RTDB_PATH = "monitoring";

// ─── Constants ────────────────────────────────────────────────────────────────

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

const statusAttColor: Record<string, string> = {
  Present: "bg-green-100 text-green-700 border-green-200",
  Late:    "bg-yellow-100 text-yellow-700 border-yellow-200",
  Absent:  "bg-red-100 text-red-600 border-red-200",
};

const ITEMS_PER_PAGE = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

type EditForm = {
  full_name: string; year_level: string; section: string;
  contact: string;   address: string;    status: "Active" | "Inactive";
};

interface SensorPayload {
  studentId: string | number;
  timeIn:    string | number | null;
  timeOut:   string | number | null;
}

type SensorStatus = "idle" | "processing" | "ok" | "error" | "no_match";

type FlatRow = {
  student:   Student;
  subject:   EnrolledSubject;
  latestAtt: AttendanceRecord | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert any RTDB time value → "HH:mm" string or null */
function toHHMM(raw: string | number | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "string") return raw.slice(0, 5);
  const d = new Date(raw);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Today as "YYYY-MM-DD" */
const todayISO = () => new Date().toISOString().split("T")[0];

/**
 * Flexible student ID match.
 *
 * The RFID chip sends a raw decimal number (e.g. 2909423).
 * Firestore stores a formatted ID (e.g. "2024-00001") OR possibly the same number.
 * We try three strategies in order:
 *   1. Exact string match          "2909423" === "2909423"
 *   2. Numeric digits-only match   strip non-digits from both sides and compare
 *   3. Stored ID ends with sensor  "2024-2909423" ends with "2909423" (suffix)
 */
function matchStudentId(stored: string, sensorRaw: string | number): boolean {
  const sensor  = String(sensorRaw).trim();
  const storedS = String(stored).trim();

  if (storedS === sensor) return true;

  const storedDigits = storedS.replace(/\D/g, "");
  const sensorDigits = sensor.replace(/\D/g, "");
  if (storedDigits && sensorDigits && storedDigits === sensorDigits) return true;

  if (storedS.endsWith(sensor)) return true;

  return false;
}

/**
 * Returns true if a subject's schedule runs TODAY and now is within a
 * 30-min grace window (before start → after end).
 *
 * MWF → Mon(1) Wed(3) Fri(5)
 * TTH → Tue(2) Thu(4)
 * FS  → Fri(5) Sat(6)
 */
function isScheduleActiveNow(subject: EnrolledSubject): boolean {
  const now       = new Date();
  const dayOfWeek = now.getDay();

  const validDays: Record<ScheduleType, number[]> = {
    MWF: [1, 3, 5],
    TTH: [2, 4],
    FS:  [5, 6],
  };
  if (!validDays[subject.schedule_type]?.includes(dayOfWeek)) return false;

  const parseTime = (hhmm: string): Date => {
    const [h, m] = hhmm.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const GRACE_MS    = 30 * 60 * 1000;
  const classStart  = parseTime(subject.time_start);
  const classEnd    = parseTime(subject.time_end);
  const windowOpen  = new Date(classStart.getTime() - GRACE_MS);
  const windowClose = new Date(classEnd.getTime()   + GRACE_MS);

  return now >= windowOpen && now <= windowClose;
}

// ─── Sensor Status Banner ─────────────────────────────────────────────────────

const SensorBanner: React.FC<{
  status: SensorStatus;
  message: string;
  raw: SensorPayload | null;
}> = ({ status, message, raw }) => {
  const ring: Record<SensorStatus, string> = {
    idle:       "border-gray-200   bg-gray-50",
    processing: "border-yellow-200 bg-yellow-50",
    ok:         "border-green-200  bg-green-50",
    error:      "border-red-200    bg-red-50",
    no_match:   "border-orange-200 bg-orange-50",
  };
  const dot: Record<SensorStatus, string> = {
    idle:       "bg-gray-400",
    processing: "bg-yellow-500 animate-pulse",
    ok:         "bg-green-500",
    error:      "bg-red-500",
    no_match:   "bg-orange-500 animate-pulse",
  };
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg border ${ring[status]}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Radio className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-600 flex-shrink-0">RFID Sensor</span>
        <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">/{RTDB_PATH}</span>
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot[status]}`} />
        <span className="text-xs text-gray-700 truncate">{message}</span>
      </div>
      {raw && (
        <div className="flex items-center gap-3 text-[10px] font-mono text-gray-400 flex-shrink-0">
          <span>ID: <strong className="text-gray-700">{String(raw.studentId)}</strong></span>
          <span>In: <strong className="text-gray-700">{String(raw.timeIn  ?? "—")}</strong></span>
          <span>Out: <strong className="text-gray-700">{String(raw.timeOut ?? "—")}</strong></span>
        </div>
      )}
    </div>
  );
};

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

const EditDialog: React.FC<{
  open: boolean; student: Student | null;
  onClose: () => void; onSave: (id: string, data: EditForm) => Promise<void>;
}> = ({ open, student, onClose, onSave }) => {
  const [form, setForm] = useState<EditForm>({
    full_name: "", year_level: "", section: "", contact: "", address: "", status: "Active",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (student) setForm({
      full_name: student.full_name, year_level: student.year_level,
      section: student.section,     contact: student.contact,
      address: student.address,     status: student.status ?? "Active",
    });
  }, [student]);

  if (!student) return null;
  const set = (k: keyof EditForm, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const handleSave = async () => {
    setSaving(true); await onSave(student.id!, form); setSaving(false); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
          <DialogDescription>{student.full_name} · {student.student_id}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="sm:col-span-2">
            <Label>Full Name</Label>
            <Input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
          </div>
          <div>
            <Label>Year Level</Label>
            <Select value={form.year_level} onValueChange={(v) => set("year_level", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["1st Year","2nd Year","3rd Year","4th Year"].map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Section</Label>
            <Select value={form.section} onValueChange={(v) => set("section", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Section A","Section B","Section C","Section D"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Contact</Label>
            <Input value={form.contact} onChange={(e) => set("contact", e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as "Active" | "Inactive")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Attendance History Dialog ────────────────────────────────────────────────

const AttendanceHistoryDialog: React.FC<{
  open: boolean; student: Student | null; scheduleId: string | null;
  allRecords: AttendanceRecord[]; onClose: () => void;
}> = ({ open, student, scheduleId, allRecords, onClose }) => {
  if (!student) return null;

  const records = allRecords
    .filter((r) => r.student_doc_id === student.id)
    .filter((r) => !scheduleId || r.schedule_id === scheduleId)
    .sort((a, b) => b.date.localeCompare(a.date));

  const subjectLabel = scheduleId ? records[0]?.subject_name ?? scheduleId : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />Attendance History
          </DialogTitle>
          <DialogDescription>
            {student.full_name} · {student.student_id}
            {subjectLabel && <span> · {subjectLabel}</span>}
          </DialogDescription>
        </DialogHeader>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No attendance records found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Subject</TableHead>
                <TableHead className="text-xs">Sched</TableHead>
                <TableHead className="text-xs">Time In</TableHead>
                <TableHead className="text-xs">Time Out</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell className="text-xs">
                    {new Date(rec.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    <p>{rec.subject_name}</p>
                    <p className="text-[10px] text-muted-foreground">{rec.classroom_name}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${scheduleTypeColor[rec.schedule_type]}`}>
                      {rec.schedule_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {rec.time_in
                      ? <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">{rec.time_in}</span>
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-mono">
                    {rec.time_out
                      ? <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">{rec.time_out}</span>
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${statusAttColor[rec.status]}`}>{rec.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const AttendanceMonitoring: React.FC = () => {

  // ── Firestore live data ───────────────────────────────────────────────────
  const [students,   setStudents]   = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loadingS,   setLoadingS]   = useState(true);
  const [loadingA,   setLoadingA]   = useState(true);

  useEffect(() => {
    const unsubS = subscribeToStudents((d)   => { setStudents(d);   setLoadingS(false); });
    const unsubA = subscribeToAttendance((d) => { setAttendance(d); setLoadingA(false); });
    return () => { unsubS(); unsubA(); };
  }, []);

  const loading = loadingS || loadingA;

  // ── Refs so the RTDB callback always sees the freshest Firestore data ─────
  const studentsRef   = useRef<Student[]>([]);
  const attendanceRef = useRef<AttendanceRecord[]>([]);
  useEffect(() => { studentsRef.current   = students;   }, [students]);
  useEffect(() => { attendanceRef.current = attendance; }, [attendance]);

  // ── Real-time sensor state ────────────────────────────────────────────────
  const [sensorStatus,  setSensorStatus]  = useState<SensorStatus>("idle");
  const [sensorMessage, setSensorMessage] = useState("Waiting for sensor…");
  const [sensorRaw,     setSensorRaw]     = useState<SensorPayload | null>(null);

  /**
   * activeStudentDocId — the Firestore doc id of the student whose rows should
   * be highlighted right now. Cleared 4 seconds after a successful scan.
   */
  const [activeStudentDocId, setActiveStudentDocId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── RTDB listener ─────────────────────────────────────────────────────────
  useEffect(() => {
    const dbRef = ref(database, RTDB_PATH);

    const handleValue = async (snapshot: any) => {
      const payload = snapshot.val() as SensorPayload | null;
      if (!payload || payload.studentId === undefined || payload.studentId === null) return;

      setSensorRaw(payload);
      setSensorStatus("processing");
      setSensorMessage(`Reading ID: ${payload.studentId}…`);

      const timeIn  = toHHMM(payload.timeIn);
      const timeOut = toHHMM(payload.timeOut);
      const today   = todayISO();

      // 1 ── Match student using flexible ID comparison ──────────────────────
      const student = studentsRef.current.find(
        (s) => matchStudentId(s.student_id, payload.studentId)
      );

      if (!student) {
        setSensorStatus("no_match");
        setSensorMessage(
          `No student found for RFID: ${payload.studentId}. ` +
          `Check that the student_id in Firestore matches this RFID number.`
        );
        return;
      }

      // 2 ── Filter to subjects that are running right now ───────────────────
      const activeSubjects = student.enrolled_subjects.filter(isScheduleActiveNow);

      if (activeSubjects.length === 0) {
        setSensorStatus("no_match");
        setSensorMessage(`${student.full_name} — no class scheduled right now`);
        // Still highlight the student rows so staff can see who tapped
        setActiveStudentDocId(student.id ?? null);
        scheduleHighlightClear();
        return;
      }

      // 3 ── Upsert attendance in Firestore ─────────────────────────────────
      try {
        for (const subject of activeSubjects) {
          const existing = attendanceRef.current.find(
            (r) =>
              r.student_doc_id === student.id &&
              r.schedule_id    === subject.schedule_id &&
              r.date           === today
          );

          if (!existing) {
            // No record yet today → create one
            const status = timeIn ? computeStatus(timeIn, subject.time_start) : "Absent";
            await logAttendance({
            student_doc_id: student.id!,
            student_id:     student.student_id,
            student_name:   student.full_name,
            schedule_id:    subject.schedule_id,
            subject_name:   subject.subject_name,
            classroom_name: subject.classroom_name,
            schedule_type:  subject.schedule_type,
            time_start:     subject.time_start,
            time_end:       subject.time_end,
            date:           today,
            day_of_week:    new Date().toLocaleDateString("en-US", { weekday: "long" }), // ← NEW
            time_in:        timeIn,
            time_out:       timeOut,
          });
          } else {
            // Record exists → sensor is always the source of truth, overwrite with latest values
            const updates: Partial<AttendanceRecord> = {};

            // Always update if sensor provides a value (even if a value already exists)
            if (timeIn  !== null) updates.time_in  = timeIn;
            if (timeOut !== null) updates.time_out = timeOut;

            // Recompute status from the latest time_in
            const resolvedIn = timeIn ?? existing.time_in;
            if (resolvedIn) {
              updates.status = computeStatus(resolvedIn, subject.time_start);
            }

            await updateAttendance(existing.id!, updates);
          }
        }

        const subjectNames = activeSubjects.map((s) => s.subject_name).join(", ");
        setSensorStatus("ok");
        setSensorMessage(
          `✓ ${student.full_name}  ·  ${subjectNames}  ·  In: ${timeIn ?? "—"}  Out: ${timeOut ?? "—"}`
        );

        // Highlight the matched student's rows in the table
        setActiveStudentDocId(student.id ?? null);
        scheduleHighlightClear();

      } catch (err: any) {
        console.error("[RTDB→Firestore]", err);
        setSensorStatus("error");
        setSensorMessage(`Write failed: ${err?.message ?? "unknown error"}`);
      }
    };

    onValue(dbRef, handleValue);
    return () => off(dbRef, "value", handleValue);
  }, []);

  /** Clear the row highlight after 4 seconds */
  const scheduleHighlightClear = () => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => {
      setActiveStudentDocId(null);
    }, 4000);
  };

  // ── Filters ───────────────────────────────────────────────────────────────
  const [filterScheduleId, setFilterScheduleId] = useState("all");
  const [filterSchedType,  setFilterSchedType]  = useState("all");
  const [filterClassroom,  setFilterClassroom]  = useState("all");
  const [searchTerm,       setSearchTerm]       = useState("");
  const [currentPage,      setCurrentPage]      = useState(1);

  // ── Dialogs ───────────────────────────────────────────────────────────────
  const [editOpen,      setEditOpen]      = useState(false);
  const [editStudent,   setEditStudent]   = useState<Student | null>(null);
  const [histOpen,      setHistOpen]      = useState(false);
  const [histStudent,   setHistStudent]   = useState<Student | null>(null);
  const [histSubjectId, setHistSubjectId] = useState<string | null>(null);

  // ── Subject options ───────────────────────────────────────────────────────
  type SubjectOption = {
    schedule_id: string; subject_name: string; classroom_name: string;
    schedule_type: ScheduleType; time_start: string; time_end: string;
  };

  const subjectOptions = useMemo<SubjectOption[]>(() => {
    const seen = new Map<string, SubjectOption>();
    for (const s of students) {
      for (const sub of s.enrolled_subjects) {
        if (!seen.has(sub.schedule_id)) {
          seen.set(sub.schedule_id, {
            schedule_id: sub.schedule_id, subject_name: sub.subject_name,
            classroom_name: sub.classroom_name, schedule_type: sub.schedule_type,
            time_start: sub.time_start, time_end: sub.time_end,
          });
        }
      }
    }
    return [...seen.values()].sort((a, b) => a.subject_name.localeCompare(b.subject_name));
  }, [students]);

  const allClassrooms = useMemo(() => {
    const s = new Set<string>();
    students.forEach((st) => st.enrolled_subjects.forEach((sub) => s.add(sub.classroom_name)));
    return [...s].sort();
  }, [students]);

  const activeSubjectFilter = useMemo(
    () => subjectOptions.find((o) => o.schedule_id === filterScheduleId) ?? null,
    [subjectOptions, filterScheduleId]
  );

  // ── Attendance lookup ─────────────────────────────────────────────────────
  const attendanceLookup = useMemo(() => {
    const byStudent = new Map<string, AttendanceRecord[]>();
    for (const rec of attendance) {
      const list = byStudent.get(rec.student_doc_id) ?? [];
      list.push(rec);
      byStudent.set(rec.student_doc_id, list);
    }
    const result = new Map<string, Map<string, AttendanceRecord>>();
    byStudent.forEach((recs, sid) => result.set(sid, getLatestPerSubject(recs)));
    return result;
  }, [attendance]);

  // ── Flat rows ─────────────────────────────────────────────────────────────
  const flatRows = useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    for (const student of students) {
      for (const subject of student.enrolled_subjects) {
        if (filterScheduleId !== "all" && subject.schedule_id    !== filterScheduleId) continue;
        if (filterClassroom  !== "all" && subject.classroom_name !== filterClassroom)  continue;
        if (filterSchedType  !== "all" && subject.schedule_type  !== filterSchedType)  continue;
        if (searchTerm) {
          const t = searchTerm.toLowerCase();
          if (!student.full_name.toLowerCase().includes(t) &&
              !student.student_id.toLowerCase().includes(t)) continue;
        }
        const latestAtt = attendanceLookup.get(student.id ?? "")?.get(subject.schedule_id) ?? null;
        rows.push({ student, subject, latestAtt });
      }
    }
    return rows.sort((a, b) =>
      a.student.full_name.localeCompare(b.student.full_name) ||
      a.subject.subject_name.localeCompare(b.subject.subject_name)
    );
  }, [students, attendanceLookup, filterScheduleId, filterClassroom, filterSchedType, searchTerm]);

  const totalPages  = Math.max(1, Math.ceil(flatRows.length / ITEMS_PER_PAGE));
  const startIndex  = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentData = flatRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const stats = useMemo(() => {
    if (filterScheduleId === "all") return null;
    const present = flatRows.filter((r) => r.latestAtt?.status === "Present").length;
    const late    = flatRows.filter((r) => r.latestAtt?.status === "Late").length;
    const absent  = flatRows.length - present - late;
    return { total: flatRows.length, present, late, absent };
  }, [flatRows, filterScheduleId]);

  const hasFilter = filterScheduleId !== "all" || filterClassroom !== "all" || filterSchedType !== "all";

  const handleClear = () => {
    setFilterScheduleId("all"); setFilterClassroom("all");
    setFilterSchedType("all");  setSearchTerm("");  setCurrentPage(1);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full px-4 py-4 space-y-4">

      {/* ── Sensor live status banner ── */}
      <SensorBanner status={sensorStatus} message={sensorMessage} raw={sensorRaw} />

      {/* ── Filters ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              Attendance Monitoring
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </CardTitle>
            {hasFilter && (
              <button onClick={handleClear} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600">
                <FilterX className="w-3.5 h-3.5" /> Clear Filters
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Subject / Schedule</label>
              <Select value={filterScheduleId} onValueChange={(v) => { setFilterScheduleId(v); setCurrentPage(1); }}>
                <SelectTrigger><SelectValue placeholder="All Subjects" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Subjects</SelectLabel>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjectOptions.map((o) => (
                      <SelectItem key={o.schedule_id} value={o.schedule_id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{o.subject_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {o.schedule_type} · {o.classroom_name} · {o.time_start}–{o.time_end}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Classroom</label>
              <Select value={filterClassroom} onValueChange={(v) => { setFilterClassroom(v); setCurrentPage(1); }}>
                <SelectTrigger><SelectValue placeholder="All Classrooms" /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Classroom</SelectLabel>
                    <SelectItem value="all">All Classrooms</SelectItem>
                    {allClassrooms.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Schedule Type</label>
              <Select value={filterSchedType} onValueChange={(v) => { setFilterSchedType(v); setCurrentPage(1); }}>
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
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Search Student</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Name or Student ID..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Active subject banner + stats ── */}
      {activeSubjectFilter && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-blue-800">{activeSubjectFilter.subject_name}</span>
          </div>
          <span className="text-xs text-blue-700 font-medium">{activeSubjectFilter.classroom_name}</span>
          <Badge variant="outline" className={`text-[10px] font-semibold ${scheduleTypeColor[activeSubjectFilter.schedule_type]}`}>
            {activeSubjectFilter.schedule_type} · {SCHEDULE_LABELS[activeSubjectFilter.schedule_type]}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-blue-700">
            <Clock className="w-3.5 h-3.5" />{activeSubjectFilter.time_start} – {activeSubjectFilter.time_end}
          </div>
          {stats && (
            <div className="ml-auto flex gap-2 text-xs font-medium flex-wrap">
              <span className="flex items-center gap-1 text-gray-600"><Users className="w-3.5 h-3.5" />{stats.total} enrolled</span>
              <span className="bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">{stats.present} present</span>
              <span className="bg-yellow-100 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">{stats.late} late</span>
              <span className="bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">{stats.absent} absent</span>
            </div>
          )}
        </div>
      )}

      {/* ── Result count ── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {flatRows.length} row{flatRows.length !== 1 ? "s" : ""}
          {filterScheduleId !== "all" ? " (1 row = 1 student in this subject)" : " (1 row = 1 student × subject)"}
        </span>
        {!hasFilter && <span className="text-[11px] italic">Each row shows a student's latest attendance per subject</span>}
      </div>

      {/* ── Table ── */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border border-gray-100 w-full overflow-x-auto">
            <Table className="w-full min-w-[960px]">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[3%]  text-xs">#</TableHead>
                  <TableHead className="w-[9%]  text-xs">Student ID</TableHead>
                  <TableHead className="w-[14%] text-xs">Full Name</TableHead>
                  <TableHead className="w-[8%]  text-xs">Year / Section</TableHead>
                  <TableHead className="w-[7%]  text-xs">Status</TableHead>
                  <TableHead className="w-[13%] text-xs">Subject</TableHead>
                  <TableHead className="w-[8%]  text-xs">Schedule</TableHead>
                  <TableHead className="w-[10%] text-xs">
                    <div className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />Date</div>
                  </TableHead>
                  <TableHead className="w-[8%]  text-xs">Time In</TableHead>
                  <TableHead className="w-[8%]  text-xs">Time Out</TableHead>
                  <TableHead className="w-[7%]  text-xs">Att. Status</TableHead>
                  <TableHead className="w-[5%]  text-xs text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-16">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-sm">Loading attendance data...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : currentData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center text-sm text-muted-foreground py-12">
                      {hasFilter ? "No records match the selected filters." : "No students or attendance records found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  currentData.map(({ student, subject, latestAtt }, idx) => {
                    const attStatus  = latestAtt?.status ?? null;
                    // Highlight this row if the sensor just scanned this student
                    const isActive   = student.id === activeStudentDocId;

                    return (
                      <TableRow
                        key={`${student.id}-${subject.schedule_id}`}
                        className={[
                          "align-middle transition-colors duration-500",
                          isActive
                            ? "bg-green-50 ring-1 ring-inset ring-green-300"
                            : "hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <TableCell className="text-xs text-muted-foreground">{startIndex + idx + 1}</TableCell>

                        <TableCell className="text-xs font-mono">
                          <div className="flex items-center gap-1.5">
                            {isActive && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                            )}
                            {student.student_id}
                          </div>
                        </TableCell>

                        <TableCell>
                          <p className={`text-sm font-medium leading-tight truncate ${isActive ? "text-green-800" : ""}`}>
                            {student.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">{student.gender}</p>
                        </TableCell>

                        <TableCell className="text-xs">
                          <p>{student.year_level}</p>
                          <p className="text-muted-foreground">{student.section}</p>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline"
                            className={(student.status ?? "Active") === "Active"
                              ? "text-[10px] bg-green-100 text-green-700 border-green-200"
                              : "text-[10px] bg-gray-100 text-gray-500 border-gray-200"}
                          >
                            {student.status ?? "Active"}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <p className="text-xs font-semibold truncate">{subject.subject_name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {subject.classroom_name} · {subject.instructor}
                          </p>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-semibold ${scheduleTypeColor[subject.schedule_type]}`}>
                            {subject.schedule_type}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{subject.time_start}–{subject.time_end}</p>
                        </TableCell>

                        {/* ── Date ── */}
                        <TableCell className="text-xs">
                          {latestAtt ? (
                            <div className="flex items-center gap-1 text-gray-700">
                              <CalendarDays className="w-3 h-3 text-gray-400 flex-shrink-0" />
                              <span className="font-medium whitespace-nowrap">
                                {new Date(latestAtt.date).toLocaleDateString("en-PH", {
                                  month: "short", day: "numeric", year: "numeric",
                                })}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* ── Time In ── */}
                        <TableCell>
                          {latestAtt?.time_in ? (
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded border whitespace-nowrap
                              ${isActive
                                ? "text-green-800 bg-green-100 border-green-400 font-semibold"
                                : "text-green-700 bg-green-50 border-green-200"}`}>
                              {latestAtt.time_in}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* ── Time Out ── */}
                        <TableCell>
                          {latestAtt?.time_out ? (
                            <span className={`text-xs font-mono px-1.5 py-0.5 rounded border whitespace-nowrap
                              ${isActive
                                ? "text-blue-800 bg-blue-100 border-blue-400 font-semibold"
                                : "text-blue-700 bg-blue-50 border-blue-200"}`}>
                              {latestAtt.time_out}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* ── Att. Status ── */}
                        <TableCell>
                          {attStatus ? (
                            <Badge variant="outline" className={`text-[10px] ${statusAttColor[attStatus]}`}>{attStatus}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-400 border-gray-200">No record</Badge>
                          )}
                        </TableCell>

                        {/* ── Actions ── */}
                        <TableCell>
                          <div className="flex items-center gap-2 justify-center">
                            <button
                              title="View attendance history"
                              onClick={() => { setHistStudent(student); setHistSubjectId(subject.schedule_id); setHistOpen(true); }}
                              className="text-gray-400 hover:text-blue-500 transition-colors"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                            <button
                              title="Edit student"
                              onClick={() => { setEditStudent(student); setEditOpen(true); }}
                              className="text-gray-400 hover:text-blue-500 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              title="Delete student"
                              onClick={async () => {
                                if (!window.confirm(`Delete ${student.full_name}?`)) return;
                                await deleteStudentDoc(student.id!);
                              }}
                              className="text-gray-400 hover:text-red-500 transition-colors"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>

                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-muted-foreground">
              Showing {flatRows.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, flatRows.length)} of {flatRows.length} rows
            </p>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-40" : "cursor-pointer"}
                  />
                </PaginationItem>
                <PaginationItem className="px-3 py-1 text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-40" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <EditDialog
        open={editOpen} student={editStudent}
        onClose={() => setEditOpen(false)}
        onSave={async (id, data) => { await updateStudent(id, data); }}
      />
      <AttendanceHistoryDialog
        open={histOpen} student={histStudent}
        scheduleId={histSubjectId} allRecords={attendance}
        onClose={() => setHistOpen(false)}
      />
    </div>
  );
};

export default AttendanceMonitoring;
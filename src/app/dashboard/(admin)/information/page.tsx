"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  Trash,
  Clock,
  Search,
  BookOpen,
  CalendarDays,
  Users,
  FilterX,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleType = "MWF" | "TTH" | "FS";

type EnrolledSubject = {
  subject_id: string;       // e.g. "MATH101"
  subject_name: string;
  classroom: string;
  schedule_type: ScheduleType;
  time_start: string;
  time_end: string;
};

type AttendanceRecord = {
  date: string;
  subject_id: string;
  subject_name: string;
  time_in: string | null;
  time_out: string | null;
};

type Student = {
  id: number;
  student_id: string;
  full_name: string;
  year_level: string;
  section: string;
  gender: string;
  contact: string;
  address: string;
  status: "Active" | "Inactive";
  enrolled_subjects: EnrolledSubject[];
  attendance: AttendanceRecord[];
};

type EditForm = {
  full_name: string;
  year_level: string;
  section: string;
  contact: string;
  address: string;
  status: "Active" | "Inactive";
};

// ─── Constants ────────────────────────────────────────────────────────────────

const scheduleTypeColor: Record<ScheduleType, string> = {
  MWF: "bg-purple-100 text-purple-700 border-purple-200",
  TTH: "bg-amber-100 text-amber-700 border-amber-200",
  FS:  "bg-teal-100 text-teal-700 border-teal-200",
};

const SCHEDULE_LABELS: Record<ScheduleType, string> = {
  MWF: "Mon · Wed · Fri",
  TTH: "Tue · Thu",
  FS:  "Fri · Sat",
};

const ITEMS_PER_PAGE = 8;

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_STUDENTS: Student[] = [
  {
    id: 1,
    student_id: "2026-00001",
    full_name: "Santos, Juan Miguel",
    year_level: "2nd Year",
    section: "Section A",
    gender: "Male",
    contact: "09171234567",
    address: "Cebu City",
    status: "Active",
    enrolled_subjects: [
      { subject_id: "MATH101", subject_name: "Mathematics",      classroom: "Room 101", schedule_type: "MWF", time_start: "08:00", time_end: "10:00" },
      { subject_id: "CS101",   subject_name: "Computer Science", classroom: "Lab A",    schedule_type: "MWF", time_start: "13:00", time_end: "15:00" },
    ],
    attendance: [
      { date: "2026-03-10", subject_id: "MATH101", subject_name: "Mathematics",      time_in: "07:55", time_out: "10:02" },
      { date: "2026-03-10", subject_id: "CS101",   subject_name: "Computer Science", time_in: "12:58", time_out: "15:05" },
      { date: "2026-03-09", subject_id: "MATH101", subject_name: "Mathematics",      time_in: "08:01", time_out: null },
      { date: "2026-03-07", subject_id: "MATH101", subject_name: "Mathematics",      time_in: "07:58", time_out: "10:00" },
    ],
  },
  {
    id: 2,
    student_id: "2026-00002",
    full_name: "Reyes, Maria Clara",
    year_level: "1st Year",
    section: "Section B",
    gender: "Female",
    contact: "09181234567",
    address: "Mandaue City",
    status: "Active",
    enrolled_subjects: [
      { subject_id: "SCI101",  subject_name: "Science",  classroom: "Room 202", schedule_type: "TTH", time_start: "10:30", time_end: "12:00" },
      { subject_id: "ENG101",  subject_name: "English",  classroom: "Room 110", schedule_type: "TTH", time_start: "14:00", time_end: "16:00" },
      { subject_id: "FIL101",  subject_name: "Filipino", classroom: "Room 305", schedule_type: "FS",  time_start: "09:00", time_end: "11:00" },
    ],
    attendance: [
      { date: "2026-03-10", subject_id: "SCI101", subject_name: "Science",  time_in: "10:28", time_out: "12:03" },
      { date: "2026-03-10", subject_id: "ENG101", subject_name: "English",  time_in: "13:55", time_out: "16:10" },
      { date: "2026-03-07", subject_id: "FIL101", subject_name: "Filipino", time_in: "09:00", time_out: "11:00" },
    ],
  },
  {
    id: 3,
    student_id: "2026-00003",
    full_name: "Cruz, Paolo Andre",
    year_level: "3rd Year",
    section: "Section A",
    gender: "Male",
    contact: "09191234567",
    address: "Lapu-Lapu City",
    status: "Active",
    enrolled_subjects: [
      { subject_id: "HIS101",  subject_name: "History",     classroom: "Room 208", schedule_type: "MWF", time_start: "11:00", time_end: "12:30" },
      { subject_id: "MATH101", subject_name: "Mathematics", classroom: "Room 101", schedule_type: "MWF", time_start: "08:00", time_end: "10:00" },
    ],
    attendance: [
      { date: "2026-03-10", subject_id: "MATH101", subject_name: "Mathematics", time_in: "08:05", time_out: "10:00" },
      { date: "2026-03-10", subject_id: "HIS101",  subject_name: "History",     time_in: "11:02", time_out: "12:35" },
      { date: "2026-03-09", subject_id: "MATH101", subject_name: "Mathematics", time_in: null,    time_out: null },
    ],
  },
  {
    id: 4,
    student_id: "2026-00004",
    full_name: "Garcia, Ana Liza",
    year_level: "4th Year",
    section: "Section C",
    gender: "Female",
    contact: "09201234567",
    address: "Talisay City",
    status: "Inactive",
    enrolled_subjects: [
      { subject_id: "CS101", subject_name: "Computer Science", classroom: "Lab A", schedule_type: "MWF", time_start: "13:00", time_end: "15:00" },
    ],
    attendance: [],
  },
  {
    id: 5,
    student_id: "2026-00005",
    full_name: "Lim, Kevin James",
    year_level: "2nd Year",
    section: "Section D",
    gender: "Male",
    contact: "09211234567",
    address: "Consolacion",
    status: "Active",
    enrolled_subjects: [
      { subject_id: "SCI101", subject_name: "Science",  classroom: "Room 202", schedule_type: "TTH", time_start: "10:30", time_end: "12:00" },
      { subject_id: "FIL101", subject_name: "Filipino", classroom: "Room 305", schedule_type: "FS",  time_start: "09:00", time_end: "11:00" },
    ],
    attendance: [
      { date: "2026-03-10", subject_id: "SCI101", subject_name: "Science",  time_in: "10:25", time_out: "12:00" },
      { date: "2026-03-07", subject_id: "FIL101", subject_name: "Filipino", time_in: null,    time_out: null },
    ],
  },
  {
    id: 6,
    student_id: "2026-00006",
    full_name: "Dela Cruz, Anna Mae",
    year_level: "1st Year",
    section: "Section A",
    gender: "Female",
    contact: "09221234567",
    address: "Talisay City",
    status: "Active",
    enrolled_subjects: [
      { subject_id: "MATH101", subject_name: "Mathematics",      classroom: "Room 101", schedule_type: "MWF", time_start: "08:00", time_end: "10:00" },
      { subject_id: "ENG101",  subject_name: "English",          classroom: "Room 110", schedule_type: "TTH", time_start: "14:00", time_end: "16:00" },
    ],
    attendance: [
      { date: "2026-03-10", subject_id: "MATH101", subject_name: "Mathematics", time_in: "07:50", time_out: "10:05" },
      { date: "2026-03-10", subject_id: "ENG101",  subject_name: "English",     time_in: "14:02", time_out: "16:00" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get all unique subjects across all students */
function getAllSubjects(students: Student[]): EnrolledSubject[] {
  const seen = new Set<string>();
  const result: EnrolledSubject[] = [];
  for (const s of students) {
    for (const sub of s.enrolled_subjects) {
      if (!seen.has(sub.subject_id)) {
        seen.add(sub.subject_id);
        result.push(sub);
      }
    }
  }
  return result.sort((a, b) => a.subject_name.localeCompare(b.subject_name));
}

/** For a student enrolled in a subject, get their latest attendance record for that subject */
function getLatestAttendanceForSubject(
  attendance: AttendanceRecord[],
  subject_id: string
): AttendanceRecord | null {
  const records = attendance
    .filter((r) => r.subject_id === subject_id)
    .sort((a, b) => b.date.localeCompare(a.date));
  return records[0] ?? null;
}

// ─── Edit Dialog ──────────────────────────────────────────────────────────────

const EditDialog: React.FC<{
  open: boolean;
  student: Student | null;
  onClose: () => void;
  onSave: (id: number, data: EditForm) => void;
}> = ({ open, student, onClose, onSave }) => {
  const [form, setForm] = useState<EditForm>({
    full_name: student?.full_name ?? "",
    year_level: student?.year_level ?? "",
    section: student?.section ?? "",
    contact: student?.contact ?? "",
    address: student?.address ?? "",
    status: student?.status ?? "Active",
  });

  // Re-sync when student changes
  useMemo(() => {
    if (student) {
      setForm({
        full_name:  student.full_name,
        year_level: student.year_level,
        section:    student.section,
        contact:    student.contact,
        address:    student.address,
        status:     student.status,
      });
    }
  }, [student]);

  if (!student) return null;

  const set = (key: keyof EditForm, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
          <DialogDescription>
            {student.full_name} · {student.student_id}
          </DialogDescription>
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
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-blue-500 hover:bg-blue-600 text-white" onClick={() => onSave(student.id, form)}>
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Attendance History Dialog ────────────────────────────────────────────────

const AttendanceHistoryDialog: React.FC<{
  open: boolean;
  student: Student | null;
  subjectId: string | null;
  onClose: () => void;
}> = ({ open, student, subjectId, onClose }) => {
  if (!student) return null;

  const records = [...student.attendance]
    .filter((r) => !subjectId || r.subject_id === subjectId)
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Attendance History
          </DialogTitle>
          <DialogDescription>
            {student.full_name} · {student.student_id}
            {subjectId && <span> · {records[0]?.subject_name ?? subjectId}</span>}
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
                <TableHead className="text-xs">Time In</TableHead>
                <TableHead className="text-xs">Time Out</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((rec, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs">
                    {new Date(rec.date).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                  </TableCell>
                  <TableCell className="text-xs font-medium">{rec.subject_name}</TableCell>
                  <TableCell className="text-xs font-mono">{rec.time_in ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{rec.time_out ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={rec.time_in
                        ? "bg-green-100 text-green-700 border-green-200 text-[10px]"
                        : "bg-red-100 text-red-600 border-red-200 text-[10px]"
                      }
                    >
                      {rec.time_in ? "Present" : "Absent"}
                    </Badge>
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
  const [students, setStudents] = useState<Student[]>(MOCK_STUDENTS);
  const [currentPage, setCurrentPage] = useState(1);

  // Subject/class filters
  const [filterSubjectId,  setFilterSubjectId]  = useState("all");
  const [filterClassroom,  setFilterClassroom]  = useState("all");
  const [filterSchedType,  setFilterSchedType]  = useState("all");

  // Secondary search within results
  const [searchTerm, setSearchTerm] = useState("");

  // Dialogs
  const [editOpen, setEditOpen]               = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [histOpen, setHistOpen]               = useState(false);
  const [histStudent, setHistStudent]         = useState<Student | null>(null);

  // ── Derived: all unique subjects / classrooms ────────────────────────────

  const allSubjects   = useMemo(() => getAllSubjects(students), [students]);

  const allClassrooms = useMemo(() => {
    const set = new Set<string>();
    allSubjects.forEach((s) => set.add(s.classroom));
    return [...set].sort();
  }, [allSubjects]);

  /** The subject object that matches the current filter (for display) */
  const activeSubject = useMemo(
    () => allSubjects.find((s) => s.subject_id === filterSubjectId) ?? null,
    [allSubjects, filterSubjectId]
  );

  // ── Filtered rows ─────────────────────────────────────────────────────────

  /**
   * Strategy:
   * 1. If a subject filter is active → only show students enrolled in that subject.
   * 2. Apply classroom + schedule type filters on those enrolled subjects.
   * 3. Apply free-text search on name / student_id.
   */
  const filteredRows = useMemo(() => {
    return students
      .filter((student) => {
        // Must be enrolled in the filtered subject
        if (filterSubjectId !== "all") {
          const enrolled = student.enrolled_subjects.some(
            (sub) => sub.subject_id === filterSubjectId
          );
          if (!enrolled) return false;
        }

        // Classroom filter
        if (filterClassroom !== "all") {
          const match = student.enrolled_subjects.some(
            (sub) =>
              sub.classroom === filterClassroom &&
              (filterSubjectId === "all" || sub.subject_id === filterSubjectId)
          );
          if (!match) return false;
        }

        // Schedule type filter
        if (filterSchedType !== "all") {
          const match = student.enrolled_subjects.some(
            (sub) =>
              sub.schedule_type === filterSchedType &&
              (filterSubjectId === "all" || sub.subject_id === filterSubjectId)
          );
          if (!match) return false;
        }

        // Name / ID search
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          return (
            student.full_name.toLowerCase().includes(term) ||
            student.student_id.toLowerCase().includes(term)
          );
        }

        return true;
      })
      .map((student) => {
        // Determine the "active" subject for this row
        const subjectInFocus =
          filterSubjectId !== "all"
            ? student.enrolled_subjects.find((s) => s.subject_id === filterSubjectId) ?? null
            : null;

        // Latest attendance for the focused subject (or overall)
        const latestAtt = subjectInFocus
          ? getLatestAttendanceForSubject(student.attendance, subjectInFocus.subject_id)
          : [...student.attendance].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;

        return { student, subjectInFocus, latestAtt };
      });
  }, [students, filterSubjectId, filterClassroom, filterSchedType, searchTerm]);

  const totalPages  = Math.max(1, Math.ceil(filteredRows.length / ITEMS_PER_PAGE));
  const startIndex  = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentData = filteredRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const hasFilter = filterSubjectId !== "all" || filterClassroom !== "all" || filterSchedType !== "all";

  // ── Stats (only meaningful when subject is selected) ──────────────────────

  const stats = useMemo(() => {
    if (filterSubjectId === "all") return null;
    const total   = filteredRows.length;
    const present = filteredRows.filter((r) => r.latestAtt?.time_in).length;
    const absent  = total - present;
    return { total, present, absent };
  }, [filteredRows, filterSubjectId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleClear = () => {
    setFilterSubjectId("all");
    setFilterClassroom("all");
    setFilterSchedType("all");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const handleEdit = (student: Student) => {
    setSelectedStudent(student);
    setEditOpen(true);
  };

  const handleSaveEdit = (id: number, data: EditForm) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    setEditOpen(false);
  };

  const handleDelete = (id: number) => {
    if (!window.confirm("Delete this student?")) return;
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const handleViewHistory = (student: Student) => {
    setHistStudent(student);
    setHistOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="w-full px-4 py-4 space-y-4">

      {/* ── Filter Card ── */}
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              Attendance Monitoring
            </CardTitle>
            {hasFilter && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                <FilterX className="w-3.5 h-3.5" />
                Clear Filters
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

            {/* Subject filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <Select
                value={filterSubjectId}
                onValueChange={(v) => { setFilterSubjectId(v); setCurrentPage(1); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Subjects</SelectLabel>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {allSubjects.map((sub) => (
                      <SelectItem key={sub.subject_id} value={sub.subject_id}>
                        <span className="font-mono text-xs mr-1 text-muted-foreground">{sub.subject_id}</span>
                        {sub.subject_name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Classroom filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Classroom</label>
              <Select
                value={filterClassroom}
                onValueChange={(v) => { setFilterClassroom(v); setCurrentPage(1); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Classrooms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Classroom</SelectLabel>
                    <SelectItem value="all">All Classrooms</SelectItem>
                    {allClassrooms.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Schedule type filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">Schedule Type</label>
              <Select
                value={filterSchedType}
                onValueChange={(v) => { setFilterSchedType(v); setCurrentPage(1); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Schedules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Schedule Type</SelectLabel>
                    <SelectItem value="all">All Schedules</SelectItem>
                    <SelectItem value="MWF">MWF – Mon · Wed · Fri</SelectItem>
                    <SelectItem value="TTH">TTH – Tue · Thu</SelectItem>
                    <SelectItem value="FS">FS – Fri · Sat</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* Name / ID search */}
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

      {/* ── Active filter summary banner ── */}
      {activeSubject && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg bg-blue-50 border border-blue-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-blue-800">{activeSubject.subject_name}</span>
            <span className="text-xs font-mono text-blue-500">({activeSubject.subject_id})</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-blue-700">
            <span className="font-medium">{activeSubject.classroom}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={`text-[10px] font-semibold ${scheduleTypeColor[activeSubject.schedule_type]}`}
            >
              {activeSubject.schedule_type} · {SCHEDULE_LABELS[activeSubject.schedule_type]}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-blue-700">
            <Clock className="w-3.5 h-3.5" />
            {activeSubject.time_start} – {activeSubject.time_end}
          </div>

          {/* Stats */}
          {stats && (
            <div className="ml-auto flex gap-3 text-xs font-medium">
              <span className="flex items-center gap-1 text-gray-600">
                <Users className="w-3.5 h-3.5" />
                {stats.total} enrolled
              </span>
              <span className="text-green-700 bg-green-100 border border-green-200 px-2 py-0.5 rounded-full">
                {stats.present} present
              </span>
              <span className="text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-full">
                {stats.absent} absent
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Results count ── */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {filteredRows.length} student{filteredRows.length !== 1 ? "s" : ""}
          {filterSubjectId !== "all" ? " enrolled in this subject" : " total"}
        </span>
        {!hasFilter && (
          <span className="text-[11px] italic">Select a subject to filter attendance by class</span>
        )}
      </div>

      {/* ── Table ── */}
      <Card className="w-full">
        <CardContent className="p-0">
          <div className="rounded-md border border-gray-100 w-full">
            <Table className="w-full table-fixed">
              <TableCaption className="text-xs pb-3">
                {filterSubjectId !== "all"
                  ? `Students enrolled in ${activeSubject?.subject_name ?? filterSubjectId} — showing latest attendance`
                  : "All students — showing latest attendance across all subjects"}
              </TableCaption>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[4%] text-xs">#</TableHead>
                  <TableHead className="w-[11%] text-xs">Student ID</TableHead>
                  <TableHead className="w-[16%] text-xs">Full Name</TableHead>
                  <TableHead className="w-[9%] text-xs">Year / Section</TableHead>
                  <TableHead className="w-[8%] text-xs">Status</TableHead>
                  {/* Show subject col only when no single subject is selected */}
                  {filterSubjectId === "all" ? (
                    <TableHead className="w-[20%] text-xs">Subject</TableHead>
                  ) : (
                    <TableHead className="w-[20%] text-xs">Enrolled Schedule</TableHead>
                  )}
                  <TableHead className="w-[10%] text-xs">Last Date</TableHead>
                  <TableHead className="w-[9%] text-xs">Time In</TableHead>
                  <TableHead className="w-[9%] text-xs">Time Out</TableHead>
                  <TableHead className="w-[9%] text-xs text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-12">
                      {hasFilter
                        ? "No students match the selected filters."
                        : "No students found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  currentData.map(({ student, subjectInFocus, latestAtt }, idx) => {
                    const isPresent = !!latestAtt?.time_in;
                    return (
                      <TableRow key={student.id} className="hover:bg-gray-50 align-middle">

                        {/* # */}
                        <TableCell className="text-xs text-muted-foreground">
                          {startIndex + idx + 1}
                        </TableCell>

                        {/* Student ID */}
                        <TableCell className="text-xs font-mono truncate">
                          {student.student_id}
                        </TableCell>

                        {/* Full Name */}
                        <TableCell>
                          <p className="text-sm font-medium leading-tight truncate">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground">{student.gender}</p>
                        </TableCell>

                        {/* Year / Section */}
                        <TableCell className="text-xs">
                          <p>{student.year_level}</p>
                          <p className="text-muted-foreground">{student.section}</p>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              student.status === "Active"
                                ? "bg-green-100 text-green-700 border-green-200 text-[10px]"
                                : "bg-gray-100 text-gray-500 border-gray-200 text-[10px]"
                            }
                          >
                            {student.status}
                          </Badge>
                        </TableCell>

                        {/* Subject / Enrolled Schedule */}
                        <TableCell>
                          {filterSubjectId !== "all" && subjectInFocus ? (
                            // Show the specific enrolled schedule details
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 font-semibold ${scheduleTypeColor[subjectInFocus.schedule_type]}`}
                                >
                                  {subjectInFocus.schedule_type}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{subjectInFocus.classroom}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {subjectInFocus.time_start} – {subjectInFocus.time_end} · {SCHEDULE_LABELS[subjectInFocus.schedule_type]}
                              </p>
                            </div>
                          ) : (
                            // Show all subjects as badges
                            <div className="flex flex-wrap gap-1">
                              {student.enrolled_subjects.map((sub, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 font-medium ${scheduleTypeColor[sub.schedule_type]}`}
                                  title={`${sub.subject_name} · ${sub.classroom} · ${sub.time_start}–${sub.time_end}`}
                                >
                                  {sub.subject_id}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>

                        {/* Last Date */}
                        <TableCell className="text-xs">
                          {latestAtt ? (
                            <>
                              <p className="font-medium">
                                {new Date(latestAtt.date).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">{latestAtt.subject_name}</p>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Time In */}
                        <TableCell>
                          {latestAtt?.time_in ? (
                            <span className="text-xs font-mono text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-200">
                              {latestAtt.time_in}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Time Out */}
                        <TableCell>
                          {latestAtt?.time_out ? (
                            <span className="text-xs font-mono text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                              {latestAtt.time_out}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Actions */}
                        <TableCell>
                          <div className="flex items-center gap-2 justify-center">
                            <button
                              title="View attendance history"
                              onClick={() => handleViewHistory(student)}
                              className="text-gray-400 hover:text-blue-500 transition-colors"
                            >
                              <Clock className="w-4 h-4" />
                            </button>
                            <button
                              title="Edit student"
                              onClick={() => handleEdit(student)}
                              className="text-gray-400 hover:text-blue-500 transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              title="Delete student"
                              onClick={() => handleDelete(student.id)}
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

          {/* ── Pagination ── */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-muted-foreground">
              Showing {filteredRows.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredRows.length)} of {filteredRows.length} students
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

      {/* ── Edit Dialog ── */}
      <EditDialog
        open={editOpen}
        student={selectedStudent}
        onClose={() => setEditOpen(false)}
        onSave={handleSaveEdit}
      />

      {/* ── Attendance History Dialog ── */}
      <AttendanceHistoryDialog
        open={histOpen}
        student={histStudent}
        subjectId={filterSubjectId !== "all" ? filterSubjectId : null}
        onClose={() => setHistOpen(false)}
      />
    </div>
  );
};

export default AttendanceMonitoring;
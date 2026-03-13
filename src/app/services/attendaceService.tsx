// services/attendanceService.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { firestore } from "@/../../firebase/configFirebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScheduleType = "MWF" | "TTH" | "FS";

export type AttendanceRecord = {
  id?: string;
  student_doc_id: string;       // Firestore doc ID of the student
  student_id: string;           // e.g. "2026-00001"
  student_name: string;
  schedule_id: string;          // Firestore doc ID of the classroom_schedule
  subject_name: string;
  classroom_name: string;
  schedule_type: ScheduleType;
  time_start: string;           // scheduled start e.g. "08:00"
  time_end: string;             // scheduled end
  date: string;                 // "YYYY-MM-DD"
  time_in: string | null;       // actual time in e.g. "08:03"
  time_out: string | null;      // actual time out
  status: "Present" | "Absent" | "Late";
  created_at?: Timestamp | Date;
  updated_at?: Timestamp | Date;
};

export type EnrolledSubject = {
  schedule_id: string;
  subject_name: string;
  classroom_name: string;
  instructor: string;
  schedule_type: ScheduleType;
  start_date: string;
  end_date: string;
  time_start: string;
  time_end: string;
  enrolled_at: Timestamp | Date;
};

export type Student = {
  id?: string;
  student_id: string;
  full_name: string;
  email: string;
  contact: string;
  address: string;
  birthdate: string;
  year_level: string;
  section: string;
  gender: string;
  guardian_name: string;
  guardian_contact: string;
  enrolled_subjects: EnrolledSubject[];
  status?: "Active" | "Inactive";
  created_at?: Timestamp | Date;
  updated_at?: Timestamp | Date;
};

// ─── Collection references ────────────────────────────────────────────────────

const STUDENTS_COL   = "students";
const ATTENDANCE_COL = "attendance";

// ─── ATTENDANCE: CREATE ───────────────────────────────────────────────────────

/**
 * Log a new attendance entry for a specific student + subject.
 * Computes status automatically:
 *   - No time_in           → "Absent"
 *   - time_in > time_start → "Late"
 *   - Otherwise            → "Present"
 */
export async function logAttendance(
  data: Omit<AttendanceRecord, "id" | "status" | "created_at" | "updated_at">
): Promise<string> {
  const status = computeStatus(data.time_in, data.time_start);
  const ref = await addDoc(collection(firestore, ATTENDANCE_COL), {
    ...data,
    status,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Update time_out (or any field) on an existing attendance record.
 */
export async function updateAttendance(
  id: string,
  data: Partial<Pick<AttendanceRecord, "time_in" | "time_out" | "status">>
): Promise<void> {
  await updateDoc(doc(firestore, ATTENDANCE_COL, id), {
    ...data,
    updated_at: serverTimestamp(),
  });
}

// ─── ATTENDANCE: READ ─────────────────────────────────────────────────────────

/**
 * Real-time listener for ALL attendance records.
 * Ordered by date descending.
 */
export function subscribeToAttendance(
  callback: (records: AttendanceRecord[]) => void
): () => void {
  const q = query(
    collection(firestore, ATTENDANCE_COL),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord)));
  });
}

/**
 * Real-time listener filtered by a specific schedule (subject).
 */
export function subscribeToAttendanceBySchedule(
  scheduleId: string,
  callback: (records: AttendanceRecord[]) => void
): () => void {
  const q = query(
    collection(firestore, ATTENDANCE_COL),
    where("schedule_id", "==", scheduleId),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord)));
  });
}

/**
 * Real-time listener filtered by student doc ID.
 */
export function subscribeToAttendanceByStudent(
  studentDocId: string,
  callback: (records: AttendanceRecord[]) => void
): () => void {
  const q = query(
    collection(firestore, ATTENDANCE_COL),
    where("student_doc_id", "==", studentDocId),
    orderBy("date", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord)));
  });
}

// ─── STUDENTS: READ ───────────────────────────────────────────────────────────

export function subscribeToStudents(
  callback: (students: Student[]) => void
): () => void {
  return onSnapshot(collection(firestore, STUDENTS_COL), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)));
  });
}

export async function updateStudent(
  id: string,
  data: Partial<Omit<Student, "id">>
): Promise<void> {
  await updateDoc(doc(firestore, STUDENTS_COL, id), {
    ...data,
    updated_at: serverTimestamp(),
  });
}

export async function deleteStudentDoc(id: string): Promise<void> {
  const { deleteDoc } = await import("firebase/firestore");
  await deleteDoc(doc(firestore, STUDENTS_COL, id));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determine attendance status from actual vs scheduled time.
 * Grace period: 15 minutes.
 */
export function computeStatus(
  timeIn: string | null,
  scheduledStart: string
): "Present" | "Absent" | "Late" {
  if (!timeIn) return "Absent";
  const [sh, sm] = scheduledStart.split(":").map(Number);
  const [ah, am] = timeIn.split(":").map(Number);
  const scheduledMins = sh * 60 + sm;
  const actualMins    = ah * 60 + am;
  return actualMins <= scheduledMins + 15 ? "Present" : "Late";
}

/**
 * From a list of attendance records for a student,
 * return the latest record per schedule_id (subject).
 */
export function getLatestPerSubject(
  records: AttendanceRecord[]
): Map<string, AttendanceRecord> {
  const map = new Map<string, AttendanceRecord>();
  for (const rec of records) {
    const existing = map.get(rec.schedule_id);
    if (!existing || rec.date > existing.date) {
      map.set(rec.schedule_id, rec);
    }
  }
  return map;
}
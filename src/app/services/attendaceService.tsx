// services/attendanceService.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { firestore } from "@/../../firebase/configFirebase";
import {
  getScheduleById,
  ClassroomSchedule,
  EnrolledStudent,
} from "./scheduleService";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScheduleType = "MWF" | "TTH" | "FS";

/**
 * A single day's time log entry stored inside an attendance document.
 * One entry is appended per session/class day the student attends (or misses).
 */
export type TimeLog = {
  date: string;           // "YYYY-MM-DD" — the session date
  time_in: string | null; // actual clock-in  e.g. "08:03", null if absent
  time_out: string | null;// actual clock-out e.g. "10:00", null if not yet out
  status: "Present" | "Absent" | "Late";
};

/**
 * One attendance document per student per schedule (subject).
 * All daily time logs are stored as an array inside this single document.
 */
export type AttendanceRecord = {
  id?: string;

  // ── Student identifiers ──────────────────────────────────────────────────
  student_doc_id: string;   // Firestore doc ID of the student
  student_id: string;       // e.g. "2026-00001"
  student_name: string;

  // ── Schedule identifiers ─────────────────────────────────────────────────
  schedule_id: string;      // Firestore doc ID of the classroom_schedule
  subject_name: string;
  classroom_name: string;
  schedule_type: ScheduleType;
  time_start: string;       // scheduled class start  e.g. "08:00"
  time_end: string;         // scheduled class end    e.g. "10:00"

  // ── Daily logs ───────────────────────────────────────────────────────────
  /**
   * Append one TimeLog per session day.
   * Use logAttendance() to add and updateTimeOut() to patch time_out.
   */
  time_logs: TimeLog[];

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

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Verify that a student is enrolled in the given schedule.
 * Throws if the schedule does not exist or the student is not enrolled.
 */
async function assertStudentEnrolled(
  scheduleId: string,
  studentDocId: string
): Promise<ClassroomSchedule> {
  const schedule = await getScheduleById(scheduleId);
  if (!schedule) throw new Error(`Schedule "${scheduleId}" not found.`);

  const isEnrolled = schedule.enrolled_students.some(
    (s: EnrolledStudent) => s.uid === studentDocId
  );
  if (!isEnrolled) {
    throw new Error(
      `Student "${studentDocId}" is not enrolled in schedule "${scheduleId}".`
    );
  }

  return schedule;
}

/**
 * Warn (but do NOT throw) when the given date doesn't match any session.
 *
 * Reasons this can legitimately happen:
 *  - The sessions array in Firestore hasn't been populated yet.
 *  - A makeup / special class day was added outside the normal session list.
 *  - Clock/timezone drift between the device and the session date strings.
 *
 * We log a warning so the issue is visible in the console, but we still
 * write the attendance record so no real scan is ever silently dropped.
 */
function warnIfInvalidSessionDate(
  schedule: ClassroomSchedule,
  date: string
): void {
  const sessions = schedule.sessions ?? [];
  if (sessions.length === 0) {
    console.warn(
      `[attendanceService] Schedule "${schedule.id}" has no sessions array. ` +
      `Logging attendance for "${date}" anyway.`
    );
    return;
  }
  const sessionExists = sessions.some((s) => s.date === date);
  if (!sessionExists) {
    console.warn(
      `[attendanceService] "${date}" is not in the sessions list for ` +
      `schedule "${schedule.id}". Logging attendance anyway. ` +
      `Available dates: ${sessions.map((s) => s.date).join(", ")}`
    );
  }
}

/**
 * Find an existing attendance document for a student + schedule pair.
 * Returns null when none exists yet.
 */
async function findAttendanceDoc(
  scheduleId: string,
  studentDocId: string
): Promise<{ id: string; data: AttendanceRecord } | null> {
  const q = query(
    collection(firestore, ATTENDANCE_COL),
    where("schedule_id", "==", scheduleId),
    where("student_doc_id", "==", studentDocId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, data: { id: d.id, ...d.data() } as AttendanceRecord };
}

// ─── ATTENDANCE: CREATE / LOG ─────────────────────────────────────────────────

/**
 * Log (or initialise) an attendance entry for one session day.
 *
 * Behaviour:
 *  1. Validates student is enrolled in the schedule (via scheduleService).
 *  2. Warns if `date` doesn't match a session in the schedule's `sessions` array (non-blocking).
 *  3. If no attendance document exists for student + schedule → creates one.
 *  4. If the document already exists → appends a new TimeLog for the date.
 *     (Does NOT overwrite an existing log for the same date; call updateTimeOut
 *      or updateTimeIn instead.)
 *
 * Returns the Firestore doc ID of the attendance document.
 */
export async function logAttendance(data: {
  student_doc_id: string;
  student_id: string;
  student_name: string;
  schedule_id: string;
  date: string;           // "YYYY-MM-DD"
  time_in: string | null; // null → marked Absent immediately
  time_out: string | null;
}): Promise<string> {
  // 1. Enrollment + schedule validation
  const schedule = await assertStudentEnrolled(data.schedule_id, data.student_doc_id);

  // 2. Session date check (warn only — never blocks a real scan)
  warnIfInvalidSessionDate(schedule, data.date);

  // 3. Build the new TimeLog entry
  const newLog: TimeLog = {
    date: data.date,
    time_in: data.time_in,
    time_out: data.time_out,
    status: computeStatus(data.time_in, schedule.time_start),
  };

  // 4. Upsert the attendance document
  const existing = await findAttendanceDoc(data.schedule_id, data.student_doc_id);

  if (!existing) {
    // Create a brand-new attendance doc for this student + schedule
    const ref = await addDoc(collection(firestore, ATTENDANCE_COL), {
      student_doc_id:  data.student_doc_id,
      student_id:      data.student_id,
      student_name:    data.student_name,
      schedule_id:     data.schedule_id,
      subject_name:    schedule.subject_name,
      classroom_name:  schedule.classroom_name,
      schedule_type:   schedule.schedule_type,
      time_start:      schedule.time_start,
      time_end:        schedule.time_end,
      time_logs:       [newLog],
      created_at:      serverTimestamp(),
      updated_at:      serverTimestamp(),
    });
    return ref.id;
  }

  // Guard: do not append a duplicate log for the same date
  const alreadyLogged = (existing.data.time_logs ?? []).some((l) => l.date === data.date);
  if (alreadyLogged) {
    throw new Error(
      `Attendance for student "${data.student_doc_id}" on "${data.date}" is already logged. ` +
      `Use updateTimeIn() or updateTimeOut() to modify it.`
    );
  }

  // Append the new log using arrayUnion
  await updateDoc(doc(firestore, ATTENDANCE_COL, existing.id), {
    time_logs:  arrayUnion(newLog),
    updated_at: serverTimestamp(),
  });

  return existing.id;
}

// ─── ATTENDANCE: UPDATE ───────────────────────────────────────────────────────

/**
 * Patch the `time_out` field on a specific date's TimeLog.
 * Also recomputes status now that the full session is known (optional —
 * status at time-out stays as-is since "Present" / "Late" is set on time-in).
 */
export async function updateTimeOut(
  attendanceDocId: string,
  date: string,      // "YYYY-MM-DD"  — identifies which log to patch
  timeOut: string    // e.g. "10:05"
): Promise<void> {
  const snap = await getDoc(doc(firestore, ATTENDANCE_COL, attendanceDocId));
  if (!snap.exists()) throw new Error("Attendance document not found.");

  const record = snap.data() as AttendanceRecord;
  const updatedLogs = (record.time_logs ?? []).map((log) =>
    log.date === date ? { ...log, time_out: timeOut } : log
  );

  await updateDoc(doc(firestore, ATTENDANCE_COL, attendanceDocId), {
    time_logs:  updatedLogs,
    updated_at: serverTimestamp(),
  });
}

/**
 * Patch the `time_in` and recompute `status` on a specific date's TimeLog.
 * Useful for correcting a mis-scan or manually entering late arrivals.
 */
export async function updateTimeIn(
  attendanceDocId: string,
  date: string,
  timeIn: string | null
): Promise<void> {
  const snap = await getDoc(doc(firestore, ATTENDANCE_COL, attendanceDocId));
  if (!snap.exists()) throw new Error("Attendance document not found.");

  const record = snap.data() as AttendanceRecord;
  const updatedLogs = (record.time_logs ?? []).map((log) => {
    if (log.date !== date) return log;
    return {
      ...log,
      time_in: timeIn,
      status:  computeStatus(timeIn, record.time_start),
    };
  });

  await updateDoc(doc(firestore, ATTENDANCE_COL, attendanceDocId), {
    time_logs:  updatedLogs,
    updated_at: serverTimestamp(),
  });
}

// ─── ATTENDANCE: READ ─────────────────────────────────────────────────────────

/**
 * Real-time listener for ALL attendance documents.
 */
export function subscribeToAttendance(
  callback: (records: AttendanceRecord[]) => void
): () => void {
  return onSnapshot(collection(firestore, ATTENDANCE_COL), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord)));
  });
}

/**
 * Real-time listener filtered by schedule (subject).
 */
export function subscribeToAttendanceBySchedule(
  scheduleId: string,
  callback: (records: AttendanceRecord[]) => void
): () => void {
  const q = query(
    collection(firestore, ATTENDANCE_COL),
    where("schedule_id", "==", scheduleId)
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
    where("student_doc_id", "==", studentDocId)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord)));
  });
}

// ─── STUDENTS: READ / WRITE ───────────────────────────────────────────────────

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
 * Compute attendance status from actual vs scheduled start time.
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
 * From a student's attendance document, return a summary map:
 * date → TimeLog, for quick lookups per session day.
 */
export function buildLogsByDate(
  record: AttendanceRecord
): Map<string, TimeLog> {
  return new Map((record.time_logs ?? []).map((l) => [l.date, l]));
}

/**
 * Compute overall summary stats from a student's time_logs array.
 */
export function summariseLogs(logs: TimeLog[]): {
  total: number;
  present: number;
  late: number;
  absent: number;
} {
  return logs.reduce(
    (acc, log) => {
      acc.total++;
      if (log.status === "Present") acc.present++;
      else if (log.status === "Late") acc.late++;
      else acc.absent++;
      return acc;
    },
    { total: 0, present: 0, late: 0, absent: 0 }
  );
}
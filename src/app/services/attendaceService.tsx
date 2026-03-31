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

export type TimeLog = {
  date: string;
  time_in: string | null;
  time_out: string | null;
  status: "Present" | "Absent" | "Late";
};

export type AttendanceRecord = {
  id?: string;
  student_doc_id: string;
  student_id: string;
  student_name: string;
  schedule_id: string;
  subject_name: string;
  classroom_name: string;
  schedule_type: ScheduleType;
  time_start: string;
  time_end: string;
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

export async function logAttendance(data: {
  student_doc_id: string;
  student_id: string;
  student_name: string;
  schedule_id: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
}): Promise<string> {
  const schedule = await assertStudentEnrolled(data.schedule_id, data.student_doc_id);

  warnIfInvalidSessionDate(schedule, data.date);

  const newLog: TimeLog = {
    date:     data.date,
    time_in:  data.time_in,
    time_out: data.time_out,
    status:   computeStatus(data.time_in, schedule.time_start),
  };

  const existing = await findAttendanceDoc(data.schedule_id, data.student_doc_id);

  if (!existing) {
    const ref = await addDoc(collection(firestore, ATTENDANCE_COL), {
      student_doc_id: data.student_doc_id,
      student_id:     data.student_id,
      student_name:   data.student_name,
      schedule_id:    data.schedule_id,
      subject_name:   schedule.subject_name,
      classroom_name: schedule.classroom_name,
      schedule_type:  schedule.schedule_type,
      time_start:     schedule.time_start,
      time_end:       schedule.time_end,
      time_logs:      [newLog],
      created_at:     serverTimestamp(),
      updated_at:     serverTimestamp(),
    });
    return ref.id;
  }

  const alreadyLogged = (existing.data.time_logs ?? []).some((l) => l.date === data.date);
  if (alreadyLogged) {
    throw new Error(
      `Attendance for student "${data.student_doc_id}" on "${data.date}" is already logged. ` +
      `Use updateTimeLog() to modify it.`
    );
  }

  await updateDoc(doc(firestore, ATTENDANCE_COL, existing.id), {
    time_logs:  arrayUnion(newLog),
    updated_at: serverTimestamp(),
  });

  return existing.id;
}

// ─── ATTENDANCE: UPDATE ───────────────────────────────────────────────────────

/**
 * Atomically patch time_in and/or time_out on a specific date's TimeLog.
 * Does a single read → transform → write to prevent race conditions where
 * two sequential writes clobber each other (the old updateTimeIn/updateTimeOut
 * pattern). Always prefer this over the individual helpers for sensor writes.
 */
export async function updateTimeLog(
  attendanceDocId: string,
  date: string,
  patch: { time_in?: string | null; time_out?: string | null }
): Promise<void> {
  const snap = await getDoc(doc(firestore, ATTENDANCE_COL, attendanceDocId));
  if (!snap.exists()) throw new Error("Attendance document not found.");

  const record = snap.data() as AttendanceRecord;
  const updatedLogs = (record.time_logs ?? []).map((log) => {
    if (log.date !== date) return log;

    const newTimeIn  = "time_in"  in patch ? patch.time_in  : log.time_in;
    const newTimeOut = "time_out" in patch ? patch.time_out : log.time_out;

    return {
      ...log,
      time_in:  newTimeIn  ?? log.time_in,
      time_out: newTimeOut ?? log.time_out,
      // Recompute status only when time_in is being changed
      status: "time_in" in patch
        ? computeStatus(newTimeIn ?? null, record.time_start)
        : log.status,
    };
  });

  await updateDoc(doc(firestore, ATTENDANCE_COL, attendanceDocId), {
    time_logs:  updatedLogs,
    updated_at: serverTimestamp(),
  });
}

/**
 * Patch only time_out on a specific date's TimeLog.
 * Kept for any manual correction UI that calls it directly.
 * For sensor writes, use updateTimeLog() instead.
 */
export async function updateTimeOut(
  attendanceDocId: string,
  date: string,
  timeOut: string
): Promise<void> {
  return updateTimeLog(attendanceDocId, date, { time_out: timeOut });
}

/**
 * Patch time_in and recompute status on a specific date's TimeLog.
 * Kept for any manual correction UI that calls it directly.
 * For sensor writes, use updateTimeLog() instead.
 */
export async function updateTimeIn(
  attendanceDocId: string,
  date: string,
  timeIn: string | null
): Promise<void> {
  return updateTimeLog(attendanceDocId, date, { time_in: timeIn });
}

// ─── ATTENDANCE: READ ─────────────────────────────────────────────────────────

export function subscribeToAttendance(
  callback: (records: AttendanceRecord[]) => void
): () => void {
  return onSnapshot(collection(firestore, ATTENDANCE_COL), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord)));
  });
}

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

export function buildLogsByDate(
  record: AttendanceRecord
): Map<string, TimeLog> {
  return new Map((record.time_logs ?? []).map((l) => [l.date, l]));
}

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
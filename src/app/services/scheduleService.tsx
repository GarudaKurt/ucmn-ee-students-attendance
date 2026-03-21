// services/scheduleService.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  query,
  where,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import { firestore } from "@/../../firebase/configFirebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScheduleType = "MWF" | "TTH" | "FS";

export type EnrolledStudent = {
  uid: string;
  displayName: string;
  email: string;
  enrolledAt: Timestamp | Date;
};

export type SessionDate = {
  date: string;       // "YYYY-MM-DD"
  dayOfWeek: string;  // e.g. "Monday"
};

export type ClassroomSchedule = {
  id?: string;
  classroom_name: string;
  subject_name: string;
  instructor: string;
  schedule_type: ScheduleType;
  start_date: string;           // auto-derived from first session
  end_date: string;             // auto-derived from last session
  time_start: string;
  time_end: string;
  status: "Active" | "Upcoming" | "Completed";
  enrolled_students: EnrolledStudent[];
  sessions: SessionDate[];      // ← NEW: full session array
  max_students?: number;
  created_at?: Timestamp | Date;
  updated_at?: Timestamp | Date;
};

// Firestore collection reference
const SCHEDULES_COL = "classroom_schedules";
const schedulesRef = collection(firestore, SCHEDULES_COL);

// ─── CREATE ───────────────────────────────────────────────────────────────────

/**
 * Add a new classroom schedule to Firestore.
 * enrolled_students starts as an empty array.
 */
export async function createSchedule(
  data: Omit<ClassroomSchedule, "id" | "enrolled_students" | "created_at" | "updated_at">
): Promise<string> {
  const docRef = await addDoc(schedulesRef, {
    ...data,
    enrolled_students: [],
    max_students: data.max_students ?? 40,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return docRef.id;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all classroom schedules once.
 */
export async function getAllSchedules(): Promise<ClassroomSchedule[]> {
  const snap = await getDocs(schedulesRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassroomSchedule));
}

/**
 * Fetch a single schedule by Firestore document ID.
 */
export async function getScheduleById(id: string): Promise<ClassroomSchedule | null> {
  const snap = await getDoc(doc(firestore, SCHEDULES_COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ClassroomSchedule;
}

/**
 * Real-time listener — calls `callback` whenever the collection changes.
 * Returns the unsubscribe function.
 */
export function subscribeToSchedules(
  callback: (schedules: ClassroomSchedule[]) => void
): () => void {
  return onSnapshot(schedulesRef, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassroomSchedule));
    callback(data);
  });
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

/**
 * Update non-enrollment fields of a schedule.
 */
export async function updateSchedule(
  id: string,
  data: Partial<Omit<ClassroomSchedule, "id" | "enrolled_students">>
): Promise<void> {
  await updateDoc(doc(firestore, SCHEDULES_COL, id), {
    ...data,
    updated_at: serverTimestamp(),
  });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

/**
 * Delete a schedule document entirely.
 */
export async function deleteSchedule(id: string): Promise<void> {
  await deleteDoc(doc(firestore, SCHEDULES_COL, id));
}

// ─── ENROLLMENT ───────────────────────────────────────────────────────────────

/**
 * Enroll a student in a schedule.
 * Uses arrayUnion to avoid duplicate entries.
 */
export async function enrollStudent(
  scheduleId: string,
  student: Omit<EnrolledStudent, "enrolledAt">
): Promise<void> {
  const scheduleDoc = doc(firestore, SCHEDULES_COL, scheduleId);

  // Check capacity before enrolling
  const snap = await getDoc(scheduleDoc);
  if (!snap.exists()) throw new Error("Schedule not found.");

  const schedule = snap.data() as ClassroomSchedule;
  const alreadyEnrolled = schedule.enrolled_students.some((s) => s.uid === student.uid);
  if (alreadyEnrolled) throw new Error("Student is already enrolled in this schedule.");

  const maxStudents = schedule.max_students ?? 40;
  if (schedule.enrolled_students.length >= maxStudents) {
    throw new Error("This schedule has reached its maximum enrollment capacity.");
  }

  const newEntry: EnrolledStudent = {
    ...student,
    enrolledAt: new Date(),
  };

  await updateDoc(scheduleDoc, {
    enrolled_students: arrayUnion(newEntry),
    updated_at: serverTimestamp(),
  });
}

/**
 * Remove (unenroll) a student from a schedule by their UID.
 */
export async function unenrollStudent(
  scheduleId: string,
  studentUid: string
): Promise<void> {
  const scheduleDoc = doc(firestore, SCHEDULES_COL, scheduleId);
  const snap = await getDoc(scheduleDoc);
  if (!snap.exists()) throw new Error("Schedule not found.");

  const schedule = snap.data() as ClassroomSchedule;
  const studentEntry = schedule.enrolled_students.find((s) => s.uid === studentUid);
  if (!studentEntry) throw new Error("Student is not enrolled in this schedule.");

  await updateDoc(scheduleDoc, {
    enrolled_students: arrayRemove(studentEntry),
    updated_at: serverTimestamp(),
  });
}

/**
 * Get all schedules a specific student is enrolled in.
 */
export async function getSchedulesForStudent(
  studentUid: string
): Promise<ClassroomSchedule[]> {
  const all = await getAllSchedules();
  return all.filter((s) =>
    s.enrolled_students.some((e) => e.uid === studentUid)
  );
}
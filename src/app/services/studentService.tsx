// services/studentService.ts
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  query,
  where,
} from "firebase/firestore";
import { firestore } from "@/../../firebase/configFirebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScheduleType = "MWF" | "TTH" | "FS";

export type EnrolledSubject = {
  schedule_id: string;       // Firestore document ID of the classroom_schedule
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
  id?: string;               // Firestore document ID
  student_id: string;        // e.g. "2026-00001"
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
  enrolled_subjects: EnrolledSubject[];   // array of subject+schedule objects
  created_at?: Timestamp | Date;
  updated_at?: Timestamp | Date;
};

// ─── Collection refs ──────────────────────────────────────────────────────────

const STUDENTS_COL   = "students";
const SCHEDULES_COL  = "classroom_schedules";

const studentsRef  = collection(firestore, STUDENTS_COL);
const schedulesRef = collection(firestore, SCHEDULES_COL);

// ─── STUDENTS: CREATE ─────────────────────────────────────────────────────────

/**
 * Register a new student. enrolled_subjects is passed in from the form.
 * Also calls enrollStudent() on each selected schedule doc to add the student
 * to that schedule's enrolled_students array.
 */
export async function registerStudent(
  data: Omit<Student, "id" | "created_at" | "updated_at">
): Promise<string> {
  // 1. Check for duplicate student_id
  const dup = await getDocs(
    query(studentsRef, where("student_id", "==", data.student_id))
  );
  if (!dup.empty) throw new Error(`Student ID "${data.student_id}" is already registered.`);

  // 2. Save student document
  const docRef = await addDoc(studentsRef, {
    ...data,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });

  // 3. Add this student to each schedule's enrolled_students array
  await Promise.all(
    data.enrolled_subjects.map((sub) =>
      _addStudentToSchedule(sub.schedule_id, {
        uid:         docRef.id,
        displayName: data.full_name,
        email:       data.email,
        enrolledAt:  new Date(),
      })
    )
  );

  return docRef.id;
}

/** Internal: push a student entry into a schedule's enrolled_students array */
async function _addStudentToSchedule(
  scheduleId: string,
  student: { uid: string; displayName: string; email: string; enrolledAt: Date }
) {
  const { arrayUnion } = await import("firebase/firestore");
  const ref = doc(firestore, SCHEDULES_COL, scheduleId);
  await updateDoc(ref, {
    enrolled_students: arrayUnion(student),
    updated_at: serverTimestamp(),
  });
}

// ─── STUDENTS: READ ───────────────────────────────────────────────────────────

export async function getAllStudents(): Promise<Student[]> {
  const snap = await getDocs(studentsRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student));
}

export async function getStudentById(id: string): Promise<Student | null> {
  const snap = await getDoc(doc(firestore, STUDENTS_COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Student;
}

export function subscribeToStudents(callback: (students: Student[]) => void) {
  return onSnapshot(studentsRef, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Student)));
  });
}

// ─── SCHEDULES: READ (for the enrollment picker) ─────────────────────────────

export type ClassroomSchedule = {
  id: string;
  classroom_name: string;
  subject_name: string;
  instructor: string;
  schedule_type: ScheduleType;
  start_date: string;
  end_date: string;
  time_start: string;
  time_end: string;
  status: "Active" | "Upcoming" | "Completed";
  enrolled_students: { uid: string; displayName: string; email: string }[];
  max_students: number;
};

export async function getAvailableSchedules(): Promise<ClassroomSchedule[]> {
  const snap = await getDocs(schedulesRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassroomSchedule));
}

export function subscribeToSchedules(
  callback: (schedules: ClassroomSchedule[]) => void
): () => void {
  return onSnapshot(schedulesRef, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClassroomSchedule)));
  });
}
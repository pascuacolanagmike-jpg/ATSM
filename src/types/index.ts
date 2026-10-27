export interface Student {
  id: string;
  student_number: string;
  full_name: string;
  gender: string;
  section: string;
  email: string | null;
  phone: string | null;
  photo_url: string | null;
  status: string;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  time_in_am: string | null;
  time_out_am: string | null;
  time_in_pm: string | null;
  time_out_pm: string | null;
  status: string;
  method: string;
  remarks: string | null;
  created_at: string;
}

export interface AttendanceWithStudent extends AttendanceRecord {
  students: Pick<Student, 'id' | 'student_number' | 'full_name' | 'gender' | 'section'> | null;
}

export type View = 'landing' | 'dashboard' | 'students' | 'monitoring' | 'excel' | 'records';

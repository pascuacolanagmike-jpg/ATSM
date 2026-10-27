/*
# ICT12-Advance Attendance Monitoring and SMS System — Database Schema

## Overview
Creates the core tables for a student attendance monitoring system with AM/PM time tracking.

## New Tables

### 1. students
Stores student information for ICT12 class.
- id (uuid, PK)
- student_number (text, unique) — school-assigned student ID
- full_name (text) — student's full name
- gender (text) — Male/Female
- section (text) — class section, default 'ICT12'
- email (text, nullable)
- phone (text, nullable)
- photo_url (text, nullable) — path to student's face photo
- status (text) — 'active' | 'inactive', default 'active'
- created_at (timestamptz)

### 2. attendance_records
Stores daily attendance with AM/PM time in and time out.
- id (uuid, PK)
- student_id (uuid, FK → students.id, ON DELETE CASCADE)
- date (date) — the attendance date
- time_in_am (timestamptz, nullable) — morning time in
- time_out_am (timestamptz, nullable) — morning time out
- time_in_pm (timestamptz, nullable) — afternoon time in
- time_out_pm (timestamptz, nullable) — afternoon time out
- status (text) — 'present' | 'absent' | 'late' | 'excused'
- method (text) — 'face' | 'manual' | 'excel'
- remarks (text, nullable)
- created_at (timestamptz)

## Security
- RLS enabled on all tables.
- This is a single-tenant system (no auth/sign-in screen) → grants to anon + authenticated.
- All CRUD operations allowed for anon + authenticated (shared system data).
- Unique constraint on (student_id, date) to prevent duplicate daily records.

## Indexes
- Index on attendance_records.student_id for fast joins.
- Index on attendance_records.date for fast date queries.
- Index on students.student_number for fast lookups.
*/

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_number text UNIQUE NOT NULL,
  full_name text NOT NULL,
  gender text DEFAULT 'Male',
  section text DEFAULT 'ICT12',
  email text,
  phone text,
  photo_url text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date date NOT NULL,
  time_in_am timestamptz,
  time_out_am timestamptz,
  time_in_pm timestamptz,
  time_out_pm timestamptz,
  status text DEFAULT 'present',
  method text DEFAULT 'manual',
  remarks text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(student_id, date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(date);
CREATE INDEX IF NOT EXISTS idx_students_student_number ON students(student_number);

-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Grants for single-tenant (no-auth) system
GRANT SELECT, INSERT, UPDATE, DELETE ON students TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_records TO anon, authenticated;

-- Policies for students (shared data, no auth)
DROP POLICY IF EXISTS "anon_select_students" ON students;
CREATE POLICY "anon_select_students" ON students FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_students" ON students;
CREATE POLICY "anon_insert_students" ON students FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_students" ON students;
CREATE POLICY "anon_update_students" ON students FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_students" ON students;
CREATE POLICY "anon_delete_students" ON students FOR DELETE
  TO anon, authenticated USING (true);

-- Policies for attendance_records (shared data, no auth)
DROP POLICY IF EXISTS "anon_select_attendance" ON attendance_records;
CREATE POLICY "anon_select_attendance" ON attendance_records FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_attendance" ON attendance_records;
CREATE POLICY "anon_insert_attendance" ON attendance_records FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_attendance" ON attendance_records;
CREATE POLICY "anon_update_attendance" ON attendance_records FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_attendance" ON attendance_records;
CREATE POLICY "anon_delete_attendance" ON attendance_records FOR DELETE
  TO anon, authenticated USING (true);
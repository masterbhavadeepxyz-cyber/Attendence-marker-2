-- ============================================================
-- QuickCheck Supabase Schema Migration (Production Ready)
-- Migration: 20260805000000_create_quickcheck_tables.sql
-- Description: Creates members and attendance_logs tables using
--              native PostgreSQL gen_random_uuid(), with idempotent
--              policies, triggers, and indexes.
-- ============================================================

-- 1. Create Members Table
CREATE TABLE IF NOT EXISTS public.members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT DEFAULT 'Team Member',
    department TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for searching members by department and name
CREATE INDEX IF NOT EXISTS idx_members_department ON public.members (department);
CREATE INDEX IF NOT EXISTS idx_members_name ON public.members (name);

-- 2. Create Attendance Logs Table
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
    time_logged TEXT,
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_member_date UNIQUE (date, member_id)
);

-- Index for fast date queries
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance_logs (date);
CREATE INDEX IF NOT EXISTS idx_attendance_member_date ON public.attendance_logs (member_id, date);

-- 3. Automatic updated_at Trigger Function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_attendance_logs_updated_at ON public.attendance_logs;
CREATE TRIGGER update_attendance_logs_updated_at
BEFORE UPDATE ON public.attendance_logs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies for Members Table
DROP POLICY IF EXISTS "Allow public read access to members" ON public.members;
CREATE POLICY "Allow public read access to members"
ON public.members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert to members" ON public.members;
CREATE POLICY "Allow public insert to members"
ON public.members FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update to members" ON public.members;
CREATE POLICY "Allow public update to members"
ON public.members FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete to members" ON public.members;
CREATE POLICY "Allow public delete to members"
ON public.members FOR DELETE USING (true);

-- Idempotent RLS Policies for Attendance Logs Table
DROP POLICY IF EXISTS "Allow public read access to attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow public read access to attendance_logs"
ON public.attendance_logs FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert access to attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow public insert access to attendance_logs"
ON public.attendance_logs FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update access to attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow public update access to attendance_logs"
ON public.attendance_logs FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete access to attendance_logs" ON public.attendance_logs;
CREATE POLICY "Allow public delete access to attendance_logs"
ON public.attendance_logs FOR DELETE USING (true);

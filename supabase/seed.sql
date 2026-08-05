-- ============================================================
-- QuickCheck Seed Data
-- Seed: supabase/seed.sql
-- Description: Populates initial team members into Supabase
-- ============================================================

INSERT INTO public.members (id, name, role, department, email) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Sarah Jenkins', 'Lead Developer', 'Engineering', 'sarah.j@company.com'),
    ('22222222-2222-2222-2222-222222222222', 'Alex Rivera', 'Senior UX Designer', 'Design', 'alex.r@company.com'),
    ('33333333-3333-3333-3333-333333333333', 'Michael Chen', 'Product Manager', 'Product', 'michael.c@company.com'),
    ('44444444-4444-4444-4444-444444444444', 'Priya Patel', 'Frontend Engineer', 'Engineering', 'priya.p@company.com'),
    ('55555555-5555-5555-5555-555555555555', 'David Kim', 'Marketing Specialist', 'Marketing', 'david.k@company.com'),
    ('66666666-6666-6666-6666-666666666666', 'Emily Watson', 'Operations Lead', 'Operations', 'emily.w@company.com'),
    ('77777777-7777-7777-7777-777777777777', 'Carlos Mendez', 'Visual Designer', 'Design', 'carlos.m@company.com'),
    ('88888888-8888-8888-8888-888888888888', 'James Wilson', 'DevOps Engineer', 'Engineering', 'james.w@company.com')
ON CONFLICT (id) DO NOTHING;

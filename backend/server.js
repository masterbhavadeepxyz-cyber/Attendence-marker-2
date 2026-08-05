require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration for Render deployment
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// Serve static frontend files if hosted together
const frontendPath = path.join(__dirname, '../frontend');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath));
}

// Initialize Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://aikzkblsabagqfpsdwbs.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFpa3prYmxzYWJhZ3FmcHNkd2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTkxNzkxNCwiZXhwIjoyMTAxNDkzOTE0fQ.afoKRxJp1Ti7hi0NPXjm2NdsmY9qULUUHR-ZhSv6tPU';

let supabase = null;
let isSupabaseConfigured = false;

if (SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('your-supabase-project-id')) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    isSupabaseConfigured = true;
    console.log(`⚡ Connected to Supabase at ${SUPABASE_URL}`);
  } catch (err) {
    console.error(`⚠️ Supabase connection failed:`, err.message);
  }
} else {
  console.log(`ℹ️ Operating in fallback database mode.`);
}

// Local Storage Fallback Data Setup
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const initialMembers = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Sarah Jenkins", role: "Lead Developer", department: "Engineering", email: "sarah.j@company.com" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Alex Rivera", role: "Senior UX Designer", department: "Design", email: "alex.r@company.com" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Michael Chen", role: "Product Manager", department: "Product", email: "michael.c@company.com" },
  { id: "44444444-4444-4444-4444-444444444444", name: "Priya Patel", role: "Frontend Engineer", department: "Engineering", email: "priya.p@company.com" },
  { id: "55555555-5555-5555-5555-555555555555", name: "David Kim", role: "Marketing Specialist", department: "Marketing", email: "david.k@company.com" },
  { id: "66666666-6666-6666-6666-666666666666", name: "Emily Watson", role: "Operations Lead", department: "Operations", email: "emily.w@company.com" },
  { id: "77777777-7777-7777-7777-777777777777", name: "Carlos Mendez", role: "Visual Designer", department: "Design", email: "carlos.m@company.com" },
  { id: "88888888-8888-8888-8888-888888888888", name: "James Wilson", role: "DevOps Engineer", department: "Engineering", email: "james.w@company.com" }
];

function loadLocalDB() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const data = { members: initialMembers, attendance: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    return data;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { members: initialMembers, attendance: {} };
  }
}

function saveLocalDB(data) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Health checks for Render
app.get('/healthz', (req, res) => res.status(200).send('OK'));

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    mode: isSupabaseConfigured ? 'Supabase Database' : 'Local Storage Fallback',
    timestamp: new Date().toISOString()
  });
});

// Root Route
app.get('/', (req, res) => {
  if (fs.existsSync(path.join(frontendPath, 'index.html'))) {
    return res.sendFile(path.join(frontendPath, 'index.html'));
  }
  res.status(200).json({
    app: "QuickCheck Attendance Backend API",
    status: "online",
    health: "/api/health",
    members: "/api/members"
  });
});

// GET /api/members
app.get('/api/members', async (req, res) => {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('members').select('*').order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data || []);
  } else {
    const db = loadLocalDB();
    res.json(db.members || []);
  }
});

// POST /api/members
app.post('/api/members', async (req, res) => {
  const { name, role, department, email } = req.body;
  if (!name || !department) return res.status(400).json({ error: "name and department are required" });

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('members').insert([{
      name: name.trim(),
      role: (role || 'Team Member').trim(),
      department: department.trim(),
      email: (email || '').trim()
    }]).select();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data[0]);
  } else {
    const db = loadLocalDB();
    const newMember = {
      id: 'mem-' + Date.now(),
      name: name.trim(),
      role: (role || 'Team Member').trim(),
      department: department.trim(),
      email: (email || '').trim()
    };
    db.members.push(newMember);
    saveLocalDB(db);
    res.status(201).json(newMember);
  }
});

// DELETE /api/members/:id
app.delete('/api/members/:id', async (req, res) => {
  const { id } = req.params;
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('members').delete().eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ message: "Member deleted", id });
  } else {
    const db = loadLocalDB();
    db.members = db.members.filter(m => m.id !== id);
    saveLocalDB(db);
    res.json({ message: "Member deleted", id });
  }
});

// GET /api/attendance?date=YYYY-MM-DD
app.get('/api/attendance', async (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: "date parameter is required" });

  if (isSupabaseConfigured) {
    const { data, error } = await supabase.from('attendance_logs').select('*').eq('date', date);
    if (error) return res.status(500).json({ error: error.message });
    
    const recordsMap = {};
    (data || []).forEach(row => {
      recordsMap[row.member_id] = {
        status: row.status,
        time: row.time_logged,
        note: row.note
      };
    });
    return res.json(recordsMap);
  } else {
    const db = loadLocalDB();
    res.json(db.attendance[date] || {});
  }
});

// POST /api/attendance
app.post('/api/attendance', async (req, res) => {
  const { date, memberId, status, note } = req.body;
  if (!date || !memberId || !status) return res.status(400).json({ error: "date, memberId, status are required" });

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isSupabaseConfigured) {
    if (status === 'unmarked') {
      const { error } = await supabase.from('attendance_logs').delete().match({ date, member_id: memberId });
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ date, memberId, status: null });
    }

    const { data, error } = await supabase.from('attendance_logs').upsert({
      date,
      member_id: memberId,
      status,
      time_logged: timeString,
      note: note || ""
    }, { onConflict: 'date,member_id' }).select();

    if (error) return res.status(500).json({ error: error.message });
    return res.json({ date, memberId, record: data[0] });
  } else {
    const db = loadLocalDB();
    if (!db.attendance[date]) db.attendance[date] = {};

    if (status === 'unmarked') {
      delete db.attendance[date][memberId];
    } else {
      db.attendance[date][memberId] = { status, time: timeString, note: note || "" };
    }
    saveLocalDB(db);
    res.json({ date, memberId, record: db.attendance[date][memberId] });
  }
});

// POST /api/attendance/bulk
app.post('/api/attendance/bulk', async (req, res) => {
  const { date, action, status } = req.body;
  if (!date || !action) return res.status(400).json({ error: "date and action are required" });

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isSupabaseConfigured) {
    if (action === 'mark_all') {
      const { data: members } = await supabase.from('members').select('id');
      if (members && members.length > 0) {
        const rows = members.map(m => ({
          date,
          member_id: m.id,
          status: status || 'present',
          time_logged: timeString
        }));
        await supabase.from('attendance_logs').upsert(rows, { onConflict: 'date,member_id' });
      }
    } else if (action === 'reset') {
      await supabase.from('attendance_logs').delete().eq('date', date);
    }
    return res.json({ date, success: true });
  } else {
    const db = loadLocalDB();
    if (!db.attendance[date]) db.attendance[date] = {};

    if (action === 'mark_all') {
      db.members.forEach(member => {
        db.attendance[date][member.id] = { status: status || 'present', time: timeString, note: "" };
      });
    } else if (action === 'reset') {
      db.attendance[date] = {};
    }
    saveLocalDB(db);
    res.json({ date, records: db.attendance[date] });
  }
});

// Start Express Server - Bind explicitly to 0.0.0.0 for Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==================================================`);
  console.log(`🚀 QuickCheck Server running on 0.0.0.0:${PORT}`);
  console.log(`Mode: ${isSupabaseConfigured ? 'Supabase Database' : 'Local Storage Fallback'}`);
  console.log(`==================================================\n`);
});

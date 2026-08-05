require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Initialize Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

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
  console.log(`ℹ️ Supabase credentials not set in backend/.env. Using local database storage fallback.`);
}

// Fallback Local Storage Setup
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

// REST APIs
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: isSupabaseConfigured ? 'Supabase Database' : 'Local File Storage',
    timestamp: new Date().toISOString()
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
    
    // Map array to dictionary object by member_id
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

// Start Server
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 QuickCheck Server running at http://localhost:${PORT}`);
  console.log(`Database Mode: ${isSupabaseConfigured ? 'Supabase' : 'Local Storage Fallback'}`);
  console.log(`==================================================\n`);
});

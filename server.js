const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Default seed data
const initialData = {
  members: [
    { id: "mem-1", name: "Sarah Jenkins", role: "Lead Developer", department: "Engineering", email: "sarah.j@company.com" },
    { id: "mem-2", name: "Alex Rivera", role: "Senior UX Designer", department: "Design", email: "alex.r@company.com" },
    { id: "mem-3", name: "Michael Chen", role: "Product Manager", department: "Product", email: "michael.c@company.com" },
    { id: "mem-4", name: "Priya Patel", role: "Frontend Engineer", department: "Engineering", email: "priya.p@company.com" },
    { id: "mem-5", name: "David Kim", role: "Marketing Specialist", department: "Marketing", email: "david.k@company.com" },
    { id: "mem-6", name: "Emily Watson", role: "Operations Lead", department: "Operations", email: "emily.w@company.com" },
    { id: "mem-7", name: "Carlos Mendez", role: "Visual Designer", department: "Design", email: "carlos.m@company.com" },
    { id: "mem-8", name: "James Wilson", role: "DevOps Engineer", department: "Engineering", email: "james.w@company.com" }
  ],
  attendance: {
    // Format: "YYYY-MM-DD": { "mem-1": { status: "present", time: "09:00 AM", note: "" } }
  }
};

// Initialize DB file if not present
function loadDB() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    saveDB(initialData);
    return initialData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading database file, resetting to default:", err);
    saveDB(initialData);
    return initialData;
  }
}

function saveDB(data) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error("Error writing database file:", err);
  }
}

// Health endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET /api/members - Get all team members
app.get('/api/members', (req, res) => {
  const db = loadDB();
  res.json(db.members || []);
});

// POST /api/members - Add a new team member
app.post('/api/members', (req, res) => {
  const { name, role, department, email } = req.body;
  if (!name || !department) {
    return res.status(400).json({ error: "Name and department are required." });
  }

  const db = loadDB();
  const newMember = {
    id: 'mem-' + Date.now(),
    name: name.trim(),
    role: (role || 'Team Member').trim(),
    department: department.trim(),
    email: (email || '').trim()
  };

  db.members.push(newMember);
  saveDB(db);
  res.status(201).json(newMember);
});

// DELETE /api/members/:id - Remove a team member
app.delete('/api/members/:id', (req, res) => {
  const { id } = req.params;
  const db = loadDB();
  const index = db.members.findIndex(m => m.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Member not found" });
  }

  const removed = db.members.splice(index, 1);
  // Cleanup attendance records for deleted member
  Object.keys(db.attendance).forEach(date => {
    if (db.attendance[date] && db.attendance[date][id]) {
      delete db.attendance[date][id];
    }
  });

  saveDB(db);
  res.json({ message: "Member deleted", member: removed[0] });
});

// GET /api/attendance?date=YYYY-MM-DD - Fetch attendance for date
app.get('/api/attendance', (req, res) => {
  const date = req.query.date;
  if (!date) {
    return res.status(400).json({ error: "Query parameter 'date' (YYYY-MM-DD) is required" });
  }

  const db = loadDB();
  const records = db.attendance[date] || {};
  res.json(records);
});

// POST /api/attendance - Toggle or update single attendance record
app.post('/api/attendance', (req, res) => {
  const { date, memberId, status, note } = req.body;
  if (!date || !memberId || !status) {
    return res.status(400).json({ error: "date, memberId, and status are required" });
  }

  const db = loadDB();
  if (!db.attendance[date]) {
    db.attendance[date] = {};
  }

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  db.attendance[date][memberId] = {
    status,
    time: timeString,
    note: note !== undefined ? note : (db.attendance[date][memberId]?.note || ""),
    updatedAt: now.toISOString()
  };

  saveDB(db);
  res.json({ date, memberId, record: db.attendance[date][memberId] });
});

// POST /api/attendance/bulk - Bulk update attendance for date
app.post('/api/attendance/bulk', (req, res) => {
  const { date, action, status } = req.body;
  if (!date || !action) {
    return res.status(400).json({ error: "date and action are required" });
  }

  const db = loadDB();
  if (!db.attendance[date]) {
    db.attendance[date] = {};
  }

  const now = new Date();
  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (action === 'mark_all') {
    const targetStatus = status || 'present';
    db.members.forEach(member => {
      db.attendance[date][member.id] = {
        status: targetStatus,
        time: timeString,
        note: "",
        updatedAt: now.toISOString()
      };
    });
  } else if (action === 'reset') {
    db.attendance[date] = {};
  }

  saveDB(db);
  res.json({ date, records: db.attendance[date] });
});

// Start Express server
app.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 QuickCheck Server running at http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});

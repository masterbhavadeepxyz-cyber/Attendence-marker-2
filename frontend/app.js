/**
 * QuickCheck - Modern Attendance Marking App Logic
 * Triple Mode Support: Supabase Client SDK, Express Backend API, or LocalStorage
 */

(function () {
  // Global State
  const state = {
    members: [],
    attendance: {}, // { "YYYY-MM-DD": { "mem-1": { status: "present", time: "09:00 AM", note: "" } } }
    currentDate: getTodayString(),
    searchQuery: '',
    deptFilter: 'ALL',
    statusFilter: 'ALL',
    dataSourceMode: 'local', // 'supabase' | 'express' | 'local'
    supabaseClient: null,
    theme: localStorage.getItem('quickcheck_theme') || 'dark'
  };

  const defaultMembers = [
    { id: "11111111-1111-1111-1111-111111111111", name: "Sarah Jenkins", role: "Lead Developer", department: "Engineering", email: "sarah.j@company.com" },
    { id: "22222222-2222-2222-2222-222222222222", name: "Alex Rivera", role: "Senior UX Designer", department: "Design", email: "alex.r@company.com" },
    { id: "33333333-3333-3333-3333-333333333333", name: "Michael Chen", role: "Product Manager", department: "Product", email: "michael.c@company.com" },
    { id: "44444444-4444-4444-4444-444444444444", name: "Priya Patel", role: "Frontend Engineer", department: "Engineering", email: "priya.p@company.com" },
    { id: "55555555-5555-5555-5555-555555555555", name: "David Kim", role: "Marketing Specialist", department: "Marketing", email: "david.k@company.com" },
    { id: "66666666-6666-6666-6666-666666666666", name: "Emily Watson", role: "Operations Lead", department: "Operations", email: "emily.w@company.com" },
    { id: "77777777-7777-7777-7777-777777777777", name: "Carlos Mendez", role: "Visual Designer", department: "Design", email: "carlos.m@company.com" },
    { id: "88888888-8888-8888-8888-888888888888", name: "James Wilson", role: "DevOps Engineer", department: "Engineering", email: "james.w@company.com" }
  ];

  // DOM Elements
  const elements = {
    attendanceDate: document.getElementById('attendance-date'),
    btnPrevDay: document.getElementById('btn-prev-day'),
    btnNextDay: document.getElementById('btn-next-day'),
    btnToday: document.getElementById('btn-today'),
    btnThemeToggle: document.getElementById('btn-theme-toggle'),
    themeIcon: document.getElementById('theme-icon'),
    storageBadge: document.getElementById('storage-badge'),
    
    // Stats
    statTotal: document.getElementById('stat-total'),
    statPresent: document.getElementById('stat-present'),
    statPresentPct: document.getElementById('stat-present-pct'),
    statLate: document.getElementById('stat-late'),
    statLatePct: document.getElementById('stat-late-pct'),
    statAbsent: document.getElementById('stat-absent'),
    statAbsentPct: document.getElementById('stat-absent-pct'),
    statRate: document.getElementById('stat-rate'),
    statUnmarkedCount: document.getElementById('stat-unmarked-count'),
    progressBar: document.getElementById('progress-bar'),

    // Controls
    searchInput: document.getElementById('search-input'),
    btnClearSearch: document.getElementById('btn-clear-search'),
    deptFilter: document.getElementById('dept-filter'),
    statusTabs: document.querySelectorAll('.status-tab'),
    btnMarkAll: document.getElementById('btn-mark-all'),
    btnResetDay: document.getElementById('btn-reset-day'),
    btnExportCsv: document.getElementById('btn-export-csv'),
    btnOpenAddModal: document.getElementById('btn-open-add-modal'),
    
    // Roster Table & Empty State
    memberTableBody: document.getElementById('member-table-body'),
    emptyState: document.getElementById('empty-state'),
    btnClearFilters: document.getElementById('btn-clear-filters'),

    // Modal
    addMemberModal: document.getElementById('add-member-modal'),
    addMemberForm: document.getElementById('add-member-form'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnCancelModal: document.getElementById('btn-cancel-modal'),
    inputMemberName: document.getElementById('input-member-name'),
    inputMemberDept: document.getElementById('input-member-dept'),
    inputMemberRole: document.getElementById('input-member-role'),
    inputMemberEmail: document.getElementById('input-member-email'),

    // Toast Container
    toastContainer: document.getElementById('toast-container')
  };

  // Initialize Application
  async function init() {
    setupTheme();
    setupEventListeners();
    elements.attendanceDate.value = state.currentDate;
    
    await initDataSource();
    await loadInitialData();
    render();
  }

  function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function setupTheme() {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      elements.themeIcon.className = 'fa-solid fa-sun text-amber-400 text-lg';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      elements.themeIcon.className = 'fa-solid fa-moon text-indigo-400 text-lg';
    }
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('quickcheck_theme', state.theme);
    setupTheme();
    showToast(`Switched to ${state.theme === 'dark' ? 'Dark' : 'Light'} Mode`, 'info');
  }

  // Detect Data Source Mode
  async function initDataSource() {
    const config = window.QUICKCHECK_CONFIG || {};
    
    // 1. Try Direct Supabase Client
    if (window.supabase && config.SUPABASE_URL && config.SUPABASE_ANON_KEY && !config.SUPABASE_URL.includes('your-supabase-project-id')) {
      try {
        state.supabaseClient = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
        // Test query
        const { error } = await state.supabaseClient.from('members').select('count', { count: 'exact', head: true });
        if (!error) {
          state.dataSourceMode = 'supabase';
          elements.storageBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Supabase Connected`;
          elements.storageBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
          return;
        }
      } catch (e) {
        console.warn("Direct Supabase JS client failed to connect", e);
      }
    }

    // 2. Try Backend Express API
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const health = await res.json();
        state.dataSourceMode = 'express';
        elements.storageBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span> ${health.mode || 'Express Sync'}`;
        elements.storageBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/10 text-teal-400 border border-teal-500/20";
        return;
      }
    } catch (e) {}

    // 3. Fallback to LocalStorage
    state.dataSourceMode = 'local';
    elements.storageBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-400"></span> Local Storage`;
    elements.storageBadge.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20";
  }

  // Load Data
  async function loadInitialData() {
    if (state.dataSourceMode === 'supabase') {
      try {
        const { data: members, error: mErr } = await state.supabaseClient.from('members').select('*').order('created_at', { ascending: true });
        if (mErr) throw mErr;
        state.members = members || [];

        await loadAttendanceForDate(state.currentDate);
      } catch (err) {
        console.error("Error fetching from Supabase, loading local data", err);
        loadLocalStorageData();
      }
    } else if (state.dataSourceMode === 'express') {
      try {
        const resMem = await fetch('/api/members');
        state.members = await resMem.json();

        const resAtt = await fetch(`/api/attendance?date=${state.currentDate}`);
        state.attendance[state.currentDate] = await resAtt.json();
      } catch (err) {
        loadLocalStorageData();
      }
    } else {
      loadLocalStorageData();
    }
  }

  function loadLocalStorageData() {
    const localMem = localStorage.getItem('quickcheck_members');
    if (localMem) {
      state.members = JSON.parse(localMem);
    } else {
      state.members = [...defaultMembers];
      localStorage.setItem('quickcheck_members', JSON.stringify(state.members));
    }

    const localAtt = localStorage.getItem('quickcheck_attendance');
    state.attendance = localAtt ? JSON.parse(localAtt) : {};
  }

  function saveLocalStorageData() {
    localStorage.setItem('quickcheck_members', JSON.stringify(state.members));
    localStorage.setItem('quickcheck_attendance', JSON.stringify(state.attendance));
  }

  // Fetch Attendance for Date
  async function loadAttendanceForDate(dateStr) {
    if (state.dataSourceMode === 'supabase') {
      try {
        const { data, error } = await state.supabaseClient.from('attendance_logs').select('*').eq('date', dateStr);
        if (error) throw error;

        const recordsMap = {};
        (data || []).forEach(row => {
          recordsMap[row.member_id] = { status: row.status, time: row.time_logged, note: row.note };
        });
        state.attendance[dateStr] = recordsMap;
      } catch (e) {
        if (!state.attendance[dateStr]) state.attendance[dateStr] = {};
      }
    } else if (state.dataSourceMode === 'express') {
      try {
        const res = await fetch(`/api/attendance?date=${dateStr}`);
        state.attendance[dateStr] = await res.json();
      } catch (e) {
        if (!state.attendance[dateStr]) state.attendance[dateStr] = {};
      }
    } else {
      if (!state.attendance[dateStr]) state.attendance[dateStr] = {};
    }
  }

  // Render Dispatcher
  function render() {
    renderStats();
    renderTable();
  }

  function renderStats() {
    const total = state.members.length;
    const currentRecords = state.attendance[state.currentDate] || {};

    let present = 0, late = 0, absent = 0;

    Object.values(currentRecords).forEach(rec => {
      if (rec.status === 'present') present++;
      else if (rec.status === 'late') late++;
      else if (rec.status === 'absent') absent++;
    });

    const totalMarked = present + late + absent;
    const unmarked = total - totalMarked;

    const presentPct = total > 0 ? Math.round((present / total) * 100) : 0;
    const latePct = total > 0 ? Math.round((late / total) * 100) : 0;
    const absentPct = total > 0 ? Math.round((absent / total) * 100) : 0;
    const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    elements.statTotal.textContent = total;
    elements.statPresent.textContent = present;
    elements.statPresentPct.textContent = `${presentPct}%`;
    elements.statLate.textContent = late;
    elements.statLatePct.textContent = `${latePct}%`;
    elements.statAbsent.textContent = absent;
    elements.statAbsentPct.textContent = `${absentPct}%`;

    elements.statRate.textContent = `${attendanceRate}%`;
    elements.statUnmarkedCount.textContent = `${unmarked} Unmarked`;
    elements.progressBar.style.width = `${attendanceRate}%`;
  }

  function getAvatarInitials(name) {
    if (!name) return "??";
    const parts = name.trim().split(" ");
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  }

  function getAvatarBgColor(id) {
    const colors = ['bg-indigo-600', 'bg-emerald-600', 'bg-teal-600', 'bg-violet-600', 'bg-amber-600', 'bg-rose-600', 'bg-cyan-600'];
    let hash = 0;
    for (let i = 0; i < (id || "").length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function renderTable() {
    const tbody = elements.memberTableBody;
    tbody.innerHTML = '';

    const records = state.attendance[state.currentDate] || {};

    const filteredMembers = state.members.filter(member => {
      const q = state.searchQuery.toLowerCase();
      const matchesSearch = !q || 
        member.name.toLowerCase().includes(q) || 
        member.role.toLowerCase().includes(q) || 
        member.department.toLowerCase().includes(q) ||
        (member.email && member.email.toLowerCase().includes(q));

      const matchesDept = state.deptFilter === 'ALL' || member.department === state.deptFilter;

      const memberRec = records[member.id];
      const memberStatus = memberRec ? memberRec.status : 'unmarked';
      const matchesStatus = state.statusFilter === 'ALL' || 
        (state.statusFilter === 'unmarked' ? !memberRec : memberStatus === state.statusFilter);

      return matchesSearch && matchesDept && matchesStatus;
    });

    if (filteredMembers.length === 0) {
      elements.emptyState.classList.remove('hidden');
    } else {
      elements.emptyState.classList.add('hidden');
    }

    filteredMembers.forEach((member, index) => {
      const rec = records[member.id];
      const currentStatus = rec ? rec.status : null;
      const initials = getAvatarInitials(member.name);
      const avatarColor = getAvatarBgColor(member.id);

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-800/40 transition-colors animate-slide-up';
      tr.style.animationDelay = `${index * 0.03}s`;

      let statusBadgeHTML = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">Unmarked</span>`;
      if (currentStatus === 'present') {
        statusBadgeHTML = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 w-max mx-auto"><i class="fa-solid fa-circle text-[8px]"></i> Present</span>`;
      } else if (currentStatus === 'late') {
        statusBadgeHTML = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-max mx-auto"><i class="fa-solid fa-circle text-[8px]"></i> Late (${rec.time || ''})</span>`;
      } else if (currentStatus === 'absent') {
        statusBadgeHTML = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-max mx-auto"><i class="fa-solid fa-circle text-[8px]"></i> Absent</span>`;
      }

      tr.innerHTML = `
        <td class="py-4 px-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl ${avatarColor} text-white avatar-circle text-sm shadow-md">
              ${initials}
            </div>
            <div>
              <div class="font-bold text-slate-100">${escapeHTML(member.name)}</div>
              <div class="text-xs text-slate-400">${escapeHTML(member.email || 'No email')}</div>
            </div>
          </div>
        </td>

        <td class="py-4 px-4 hidden sm:table-cell">
          <div class="text-xs font-semibold text-slate-200">${escapeHTML(member.department)}</div>
          <div class="text-xs text-slate-400">${escapeHTML(member.role)}</div>
        </td>

        <td class="py-4 px-4 text-center">
          ${statusBadgeHTML}
        </td>

        <td class="py-4 px-6 text-center">
          <div class="inline-flex items-center p-1 bg-slate-900/90 rounded-xl border border-slate-700/80 gap-1 shadow-inner">
            <button data-id="${member.id}" data-status="present" class="btn-status px-3 py-1.5 rounded-lg text-xs font-bold ${currentStatus === 'present' ? 'status-present-active' : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-800'}" title="Mark Present">
              <i class="fa-solid fa-check mr-1"></i> Present
            </button>

            <button data-id="${member.id}" data-status="late" class="btn-status px-3 py-1.5 rounded-lg text-xs font-bold ${currentStatus === 'late' ? 'status-late-active' : 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'}" title="Mark Late">
              <i class="fa-solid fa-clock mr-1"></i> Late
            </button>

            <button data-id="${member.id}" data-status="absent" class="btn-status px-3 py-1.5 rounded-lg text-xs font-bold ${currentStatus === 'absent' ? 'status-absent-active' : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'}" title="Mark Absent">
              <i class="fa-solid fa-xmark mr-1"></i> Absent
            </button>
          </div>
        </td>

        <td class="py-4 px-4 text-right">
          <button data-delete-id="${member.id}" class="text-slate-500 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800 transition-colors" title="Delete Member">
            <i class="fa-solid fa-trash-can text-sm"></i>
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  }

  // Toggle Attendance Action
  async function toggleAttendance(memberId, targetStatus) {
    const records = state.attendance[state.currentDate] || {};
    const existingRec = records[memberId];

    const newStatus = (existingRec && existingRec.status === targetStatus) ? null : targetStatus;
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!state.attendance[state.currentDate]) {
      state.attendance[state.currentDate] = {};
    }

    if (newStatus) {
      state.attendance[state.currentDate][memberId] = { status: newStatus, time: timeString, note: "" };
    } else {
      delete state.attendance[state.currentDate][memberId];
    }

    // Persist according to DataSource Mode
    if (state.dataSourceMode === 'supabase') {
      try {
        if (newStatus) {
          await state.supabaseClient.from('attendance_logs').upsert({
            date: state.currentDate,
            member_id: memberId,
            status: newStatus,
            time_logged: timeString,
            note: ""
          }, { onConflict: 'date,member_id' });
        } else {
          await state.supabaseClient.from('attendance_logs').delete().match({ date: state.currentDate, member_id: memberId });
        }
      } catch (e) {
        console.error("Supabase upsert failed", e);
      }
    } else if (state.dataSourceMode === 'express') {
      try {
        await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: state.currentDate, memberId, status: newStatus || 'unmarked' })
        });
      } catch (e) {}
    }

    saveLocalStorageData();
    render();

    const member = state.members.find(m => m.id === memberId);
    const memberName = member ? member.name : "Member";

    if (newStatus === 'present') showToast(`Marked ${memberName} as Present`, 'success');
    else if (newStatus === 'late') showToast(`Marked ${memberName} as Late`, 'warning');
    else if (newStatus === 'absent') showToast(`Marked ${memberName} as Absent`, 'danger');
    else showToast(`Reset attendance for ${memberName}`, 'info');
  }

  // Bulk Action
  async function handleBulkAction(action) {
    if (!state.attendance[state.currentDate]) state.attendance[state.currentDate] = {};
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (action === 'mark_all') {
      state.members.forEach(member => {
        state.attendance[state.currentDate][member.id] = { status: 'present', time: timeString, note: '' };
      });

      if (state.dataSourceMode === 'supabase') {
        const rows = state.members.map(m => ({
          date: state.currentDate,
          member_id: m.id,
          status: 'present',
          time_logged: timeString
        }));
        await state.supabaseClient.from('attendance_logs').upsert(rows, { onConflict: 'date,member_id' });
      }

      showToast(`Marked all ${state.members.length} members Present!`, 'success');
    } else if (action === 'reset') {
      state.attendance[state.currentDate] = {};
      if (state.dataSourceMode === 'supabase') {
        await state.supabaseClient.from('attendance_logs').delete().eq('date', state.currentDate);
      }
      showToast(`Reset all attendance for ${state.currentDate}`, 'info');
    }

    saveLocalStorageData();
    render();
  }

  // Add Member
  async function handleAddMember(e) {
    e.preventDefault();
    const name = elements.inputMemberName.value.trim();
    const department = elements.inputMemberDept.value.trim();
    const role = elements.inputMemberRole.value.trim() || 'Team Member';
    const email = elements.inputMemberEmail.value.trim();

    if (!name || !department) {
      showToast("Please provide member name and department", "warning");
      return;
    }

    let newMember = { id: 'mem-' + Date.now(), name, department, role, email };

    if (state.dataSourceMode === 'supabase') {
      try {
        const { data, error } = await state.supabaseClient.from('members').insert([{ name, role, department, email }]).select();
        if (error) throw error;
        newMember = data[0];
      } catch (err) {
        console.error("Error creating member on Supabase", err);
      }
    } else if (state.dataSourceMode === 'express') {
      try {
        const res = await fetch('/api/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMember)
        });
        newMember = await res.json();
      } catch (e) {}
    }

    state.members.push(newMember);
    saveLocalStorageData();
    closeAddModal();
    render();
    showToast(`Added ${name} to team roster`, 'success');
  }

  // Delete Member
  async function handleDeleteMember(id) {
    const member = state.members.find(m => m.id === id);
    if (!member) return;

    if (!confirm(`Are you sure you want to remove ${member.name} from the team?`)) return;

    state.members = state.members.filter(m => m.id !== id);

    if (state.dataSourceMode === 'supabase') {
      await state.supabaseClient.from('members').delete().eq('id', id);
    } else if (state.dataSourceMode === 'express') {
      await fetch(`/api/members/${id}`, { method: 'DELETE' });
    }

    saveLocalStorageData();
    render();
    showToast(`Removed ${member.name}`, 'info');
  }

  // Export CSV
  function exportCSV() {
    const records = state.attendance[state.currentDate] || {};
    let csvContent = "Date,Member ID,Full Name,Department,Role,Email,Status,Time Logged\n";

    state.members.forEach(member => {
      const rec = records[member.id];
      const status = rec ? rec.status.toUpperCase() : "UNMARKED";
      const time = rec ? rec.time || "" : "";
      
      const row = [
        `"${state.currentDate}"`,
        `"${member.id}"`,
        `"${escapeCSV(member.name)}"`,
        `"${escapeCSV(member.department)}"`,
        `"${escapeCSV(member.role)}"`,
        `"${escapeCSV(member.email || '')}"`,
        `"${status}"`,
        `"${time}"`
      ];

      csvContent += row.join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `QuickCheck_Attendance_${state.currentDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported CSV for ${state.currentDate}`, 'success');
  }

  function escapeCSV(str) {
    return str ? str.replace(/"/g, '""') : '';
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    let iconHTML = `<i class="fa-solid fa-circle-info text-indigo-400"></i>`;
    let borderClass = `border-indigo-500/30`;

    if (type === 'success') {
      iconHTML = `<i class="fa-solid fa-circle-check text-emerald-400"></i>`;
      borderClass = `border-emerald-500/30`;
    } else if (type === 'warning') {
      iconHTML = `<i class="fa-solid fa-triangle-exclamation text-amber-400"></i>`;
      borderClass = `border-amber-500/30`;
    } else if (type === 'danger') {
      iconHTML = `<i class="fa-solid fa-circle-xmark text-rose-400"></i>`;
      borderClass = `border-rose-500/30`;
    }

    toast.className = `animate-toast flex items-center gap-3 bg-slate-900/95 text-slate-100 px-4 py-3 rounded-xl border ${borderClass} shadow-xl backdrop-blur-md text-xs font-semibold pointer-events-auto`;
    toast.innerHTML = `${iconHTML}<span>${escapeHTML(message)}</span>`;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function openAddModal() {
    elements.addMemberForm.reset();
    elements.addMemberModal.classList.remove('hidden');
    elements.inputMemberName.focus();
  }

  function closeAddModal() {
    elements.addMemberModal.classList.add('hidden');
  }

  function setupEventListeners() {
    elements.btnThemeToggle.addEventListener('click', toggleTheme);

    elements.attendanceDate.addEventListener('change', async (e) => {
      state.currentDate = e.target.value;
      await loadAttendanceForDate(state.currentDate);
      render();
    });

    elements.btnPrevDay.addEventListener('click', async () => {
      const d = new Date(state.currentDate);
      d.setDate(d.getDate() - 1);
      state.currentDate = d.toISOString().split('T')[0];
      elements.attendanceDate.value = state.currentDate;
      await loadAttendanceForDate(state.currentDate);
      render();
    });

    elements.btnNextDay.addEventListener('click', async () => {
      const d = new Date(state.currentDate);
      d.setDate(d.getDate() + 1);
      state.currentDate = d.toISOString().split('T')[0];
      elements.attendanceDate.value = state.currentDate;
      await loadAttendanceForDate(state.currentDate);
      render();
    });

    elements.btnToday.addEventListener('click', async () => {
      state.currentDate = getTodayString();
      elements.attendanceDate.value = state.currentDate;
      await loadAttendanceForDate(state.currentDate);
      render();
    });

    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      if (state.searchQuery) elements.btnClearSearch.classList.remove('hidden');
      else elements.btnClearSearch.classList.add('hidden');
      renderTable();
    });

    elements.btnClearSearch.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.searchQuery = '';
      elements.btnClearSearch.classList.add('hidden');
      renderTable();
    });

    elements.deptFilter.addEventListener('change', (e) => {
      state.deptFilter = e.target.value;
      renderTable();
    });

    elements.statusTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.statusTabs.forEach(t => {
          t.className = 'status-tab px-3 py-1 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 transition-all';
        });
        tab.className = 'status-tab px-3 py-1 text-xs font-semibold rounded-lg text-white bg-slate-700 transition-all';
        state.statusFilter = tab.getAttribute('data-filter');
        renderTable();
      });
    });

    elements.memberTableBody.addEventListener('click', (e) => {
      const statusBtn = e.target.closest('.btn-status');
      if (statusBtn) {
        const id = statusBtn.getAttribute('data-id');
        const status = statusBtn.getAttribute('data-status');
        toggleAttendance(id, status);
        return;
      }

      const deleteBtn = e.target.closest('[data-delete-id]');
      if (deleteBtn) {
        const id = deleteBtn.getAttribute('data-delete-id');
        handleDeleteMember(id);
      }
    });

    elements.btnClearFilters.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.searchQuery = '';
      state.deptFilter = 'ALL';
      state.statusFilter = 'ALL';
      elements.deptFilter.value = 'ALL';
      elements.btnClearSearch.classList.add('hidden');

      elements.statusTabs.forEach(t => {
        t.className = 'status-tab px-3 py-1 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 transition-all';
      });
      elements.statusTabs[0].className = 'status-tab px-3 py-1 text-xs font-semibold rounded-lg text-white bg-slate-700 transition-all';

      renderTable();
    });

    elements.btnMarkAll.addEventListener('click', () => handleBulkAction('mark_all'));
    elements.btnResetDay.addEventListener('click', () => handleBulkAction('reset'));
    elements.btnExportCsv.addEventListener('click', exportCSV);

    elements.btnOpenAddModal.addEventListener('click', openAddModal);
    elements.btnCloseModal.addEventListener('click', closeAddModal);
    elements.btnCancelModal.addEventListener('click', closeAddModal);
    elements.addMemberForm.addEventListener('submit', handleAddMember);

    elements.addMemberModal.addEventListener('click', (e) => {
      if (e.target === elements.addMemberModal) closeAddModal();
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }

  document.addEventListener('DOMContentLoaded', init);
})();

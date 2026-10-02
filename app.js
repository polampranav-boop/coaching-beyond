// Coaching Beyond Web / PWA App Logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, deleteDoc, getDoc, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Firebase Configuration from google-services.json
const firebaseConfig = {
  apiKey: "AIzaSyD3GiCQupk0_E0a2tNB0TcY00B7g0NdROs",
  authDomain: "coaching-beyond-academy.firebaseapp.com",
  projectId: "coaching-beyond-academy",
  storageBucket: "coaching-beyond-academy.firebasestorage.app",
  messagingSenderId: "430924101499",
  appId: "1:430924101499:web:29e6532040362eb663afde"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Constants
const ADMIN_EMAIL = "admin@coachingbeyond.in";
const ADMIN_PASSWORD = "Cb@123";
const ADMIN_ID = "admin_coachingbeyond_master_id";

const SESSION_TYPES = ["Batting", "Bowling", "Wicket Keeping", "Fielding", "Fitness", "Technical Training", "Match Preparation", "Other"];
const WICKET_TYPES = ["TURF", "ASTRO", "MATTING"];

// App State
let currentUser = null; // Coach or Admin object
let currentTab = 'dashboard';
let sessions = [];
let players = [];
let coaches = [];
let unapprovedCoaches = [];
let activeSessionFilter = 'all'; // 'all', 'mine'
let sessionTypeFilter = 'all';
let wicketTypeFilter = 'all';
let selectedCoachFilter = 'all';
let searchQuery = '';
let isAddSessionOpen = false;
let isAddPlayerOpen = false;
let editingSession = null;

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  initAuthListener();
  setupPWA();
});

function initAuthListener() {
  // Check local storage for cached session or firebase auth
  const cachedUser = localStorage.getItem('cb_current_user');
  if (cachedUser) {
    try {
      currentUser = JSON.parse(cachedUser);
      loadAppData();
      render();
    } catch (e) {
      localStorage.removeItem('cb_current_user');
      renderAuthScreen();
    }
  } else {
    renderAuthScreen();
  }
}

async function loadAppData() {
  try {
    // Fetch Coaches
    const coachesSnap = await getDocs(collection(db, "coaches"));
    coaches = coachesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Ensure Admin exists in list
    if (!coaches.some(c => c.id === ADMIN_ID)) {
      const adminCoach = {
        id: ADMIN_ID,
        name: "Academy Admin",
        email: ADMIN_EMAIL,
        username: "admin",
        title: "Administrator (View-Only)",
        role: "Admin",
        isApproved: true
      };
      coaches.push(adminCoach);
    }

    unapprovedCoaches = coaches.filter(c => !c.isApproved && c.role !== 'Admin');

    // Fetch Players
    const playersSnap = await getDocs(collection(db, "players"));
    players = playersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Fetch Sessions
    const sessionsSnap = await getDocs(collection(db, "coaching_sessions"));
    sessions = sessionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    render();
  } catch (err) {
    console.error("Error loading app data:", err);
  }
}

// ================= AUTHENTICATION =================
function renderAuthScreen() {
  const root = document.getElementById('app');
  root.innerHTML = `
    <div class="flex-1 flex flex-col justify-center items-center p-6 bg-gradient-to-br from-slate-950 via-cricket-dark to-slate-900">
      <div class="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-cricket-gold/30 rounded-3xl p-8 shadow-2xl">
        <div class="text-center mb-8">
          <div class="w-20 h-20 bg-cricket-gold/20 border border-cricket-gold rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cricket-gold/10">
            <span class="text-3xl font-extrabold text-cricket-gold">CB</span>
          </div>
          <h1 class="text-2xl font-black text-white tracking-wide">Coaching Beyond</h1>
          <p class="text-sm text-slate-400 mt-1">Professional Cricket Academy Management</p>
        </div>

        <div id="auth-error" class="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-300 text-xs hidden"></div>

        <form id="login-form" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <input type="email" id="login-email" required placeholder="coach@coachingbeyond.in" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cricket-gold" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Password / PIN</label>
            <input type="password" id="login-password" required placeholder="••••••••" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cricket-gold" />
          </div>
          <button type="submit" class="w-full py-3 bg-gradient-to-r from-cricket-gold to-yellow-500 text-slate-950 font-bold rounded-xl shadow-lg hover:brightness-110 transition active:scale-[0.98]">
            Sign In
          </button>
        </form>

        <div class="mt-6 text-center">
          <button id="toggle-auth-mode" class="text-xs text-cricket-gold hover:underline font-medium">
            Need an account? Register as Coach
          </button>
        </div>

        <div class="mt-8 pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
          Admin Demo: admin@coachingbeyond.in / Cb@123
        </div>
      </div>
    </div>
  `;

  let isRegistering = false;
  document.getElementById('toggle-auth-mode').addEventListener('click', () => {
    isRegistering = !isRegistering;
    const form = document.getElementById('login-form');
    const toggleBtn = document.getElementById('toggle-auth-mode');
    if (isRegistering) {
      form.innerHTML = `
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
          <input type="text" id="reg-name" required placeholder="Coach Name" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cricket-gold" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
          <input type="email" id="reg-email" required placeholder="coach@example.com" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cricket-gold" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Password / PIN</label>
          <input type="password" id="reg-password" required placeholder="••••••••" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cricket-gold" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Specialty Title</label>
          <input type="text" id="reg-title" placeholder="Senior Batting Coach" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cricket-gold" />
        </div>
        <button type="submit" class="w-full py-3 bg-gradient-to-r from-cricket-gold to-yellow-500 text-slate-950 font-bold rounded-xl shadow-lg hover:brightness-110 transition active:scale-[0.98]">
          Register Coach Account
        </button>
      `;
      toggleBtn.textContent = "Already have an account? Sign In";
    } else {
      renderAuthScreen();
    }
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errDiv = document.getElementById('auth-error');
    errDiv.classList.add('hidden');

    if (!isRegistering) {
      const email = document.getElementById('login-email').value.trim();
      const pass = document.getElementById('login-password').value.trim();

      if (email === ADMIN_EMAIL && pass === ADMIN_PASSWORD) {
        currentUser = {
          id: ADMIN_ID,
          name: "Academy Admin",
          email: ADMIN_EMAIL,
          username: "admin",
          title: "Administrator (View-Only)",
          role: "Admin",
          isApproved: true
        };
        localStorage.setItem('cb_current_user', JSON.stringify(currentUser));
        await loadAppData();
        return;
      }

      try {
        await signInWithEmailAndPassword(auth, email, pass);
        // Find coach in firestore
        const q = query(collection(db, "coaches"), where("email", "==", email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          currentUser = { id: snap.docs[0].id, ...snap.docs[0].data() };
          if (!currentUser.isApproved) {
            errDiv.textContent = "Your account is pending admin approval.";
            errDiv.classList.remove('hidden');
            await signOut(auth);
            return;
          }
          localStorage.setItem('cb_current_user', JSON.stringify(currentUser));
          await loadAppData();
        } else {
          errDiv.textContent = "Coach profile not found.";
          errDiv.classList.remove('hidden');
        }
      } catch (err) {
        errDiv.textContent = err.message;
        errDiv.classList.remove('hidden');
      }
    } else {
      const name = document.getElementById('reg-name').value.trim();
      const email = document.getElementById('reg-email').value.trim();
      const pass = document.getElementById('reg-password').value.trim();
      const title = document.getElementById('reg-title').value.trim() || "Academy Coach";

      try {
        const userCred = await createUserWithEmailAndPassword(auth, email, pass);
        const newCoach = {
          id: userCred.user.uid,
          name,
          email,
          username: email.split('@')[0],
          title,
          pin: pass,
          isApproved: false,
          role: "Coach"
        };
        await setDoc(doc(db, "coaches", newCoach.id), newCoach);
        alert("Registration successful! Your account is pending admin approval.");
        isRegistering = false;
        renderAuthScreen();
      } catch (err) {
        errDiv.textContent = err.message;
        errDiv.classList.remove('hidden');
      }
    }
  });
}

// ================= MAIN LAYOUT & ROUTING =================
function render() {
  if (!currentUser) {
    renderAuthScreen();
    return;
  }

  const root = document.getElementById('app');
  root.innerHTML = `
    <!-- Top Header -->
    <header class="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 px-4 py-3 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-cricket-primary border border-cricket-gold/40 flex items-center justify-center text-cricket-gold font-bold shadow">
          CB
        </div>
        <div>
          <h2 class="font-bold text-sm text-white leading-tight">Coaching Beyond</h2>
          <p class="text-xs text-slate-400">${currentUser.name} (${currentUser.role})</p>
        </div>
      </div>
      <div class="flex items-center space-x-2">
        ${currentUser.isAdmin && unapprovedCoaches.length > 0 ? `
          <button onclick="switchTab('requests')" class="relative p-2 bg-slate-800 rounded-xl text-cricket-gold hover:bg-slate-700">
            <i data-lucide="bell" class="w-5 h-5"></i>
            <span class="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center font-bold">${unapprovedCoaches.length}</span>
          </button>
        ` : ''}
        <button onclick="openAddSessionModal()" class="px-3 py-1.5 bg-cricket-gold text-slate-950 font-bold text-xs rounded-xl shadow flex items-center space-x-1 hover:brightness-110">
          <i data-lucide="plus" class="w-4 h-4"></i>
          <span class="hidden sm:inline">New Session</span>
        </button>
      </div>
    </header>

    <!-- Main Content Body -->
    <main class="flex-1 overflow-y-auto pb-24 md:pb-8 p-4 max-w-6xl w-full mx-auto">
      ${renderCurrentTabContent()}
    </main>

    <!-- Desktop / Tablet Sidebar & Mobile Bottom Navigation -->
    <nav class="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-40 md:top-16 md:bottom-auto md:left-0 md:w-64 md:h-[calc(100vh-4rem)] md:border-r md:border-t-0 flex md:flex-col justify-around md:justify-start py-2 md:py-6 px-4">
      <div class="hidden md:block mb-6 px-3">
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Navigation</span>
      </div>
      <div class="flex md:flex-col justify-around w-full md:space-y-1">
        ${navItem('dashboard', 'layout-dashboard', 'Dashboard')}
        ${navItem('sessions', 'calendar', 'Sessions')}
        ${navItem('players', 'users', 'Players')}
        ${navItem('analytics', 'bar-chart-3', 'Analytics')}
        ${navItem('profile', 'user-circle', 'Profile')}
      </div>
    </nav>

    <!-- Modals -->
    ${isAddSessionOpen ? renderAddSessionModal() : ''}
    ${isAddPlayerOpen ? renderAddPlayerModal() : ''}
  `;

  lucide.createIcons();
}

function navItem(tabId, icon, label) {
  const isActive = currentTab === tabId;
  return `
    <button onclick="switchTab('${tabId}')" class="flex flex-col md:flex-row items-center md:space-x-3 px-3 py-2 rounded-xl transition ${isActive ? 'text-cricket-gold bg-cricket-primary/20 md:bg-cricket-primary/30 font-bold' : 'text-slate-400 hover:text-white hover:bg-slate-800'}">
      <i data-lucide="${icon}" class="w-5 h-5"></i>
      <span class="text-xs md:text-sm mt-1 md:mt-0">${label}</span>
    </button>
  `;
}

window.switchTab = (tab) => {
  currentTab = tab;
  render();
};

// ================= TAB CONTENTS =================
function renderCurrentTabContent() {
  switch (currentTab) {
    case 'dashboard': return renderDashboard();
    case 'sessions': return renderSessionsTab();
    case 'players': return renderPlayersTab();
    case 'analytics': return renderAnalyticsTab();
    case 'profile': return renderProfileTab();
    case 'requests': return renderRequestsTab();
    default: return renderDashboard();
  }
}

// 1. Dashboard
function renderDashboard() {
  const mySessions = sessions.filter(s => currentUser.isAdmin || s.coachId === currentUser.id);
  const totalHours = mySessions.reduce((acc, s) => acc + (s.durationMinutes || 60), 0) / 60;
  const recentSessions = [...sessions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  return `
    <div class="space-y-6 md:ml-64">
      <!-- Welcome Banner -->
      <div class="bg-gradient-to-r from-cricket-primary to-cricket-dark border border-cricket-gold/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div class="relative z-10">
          <span class="px-3 py-1 bg-cricket-gold/20 text-cricket-gold text-xs font-bold rounded-full">Academy Portal</span>
          <h1 class="text-2xl md:text-3xl font-black text-white mt-2">Welcome back, ${currentUser.name}!</h1>
          <p class="text-sm text-slate-300 mt-1">Here is your cricket coaching summary & upcoming training schedule.</p>
        </div>
      </div>

      <!-- Quick Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div class="text-slate-400 text-xs font-semibold">Total Sessions</div>
          <div class="text-2xl font-black text-white mt-1">${mySessions.length}</div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div class="text-slate-400 text-xs font-semibold">Active Players</div>
          <div class="text-2xl font-black text-cricket-gold mt-1">${players.length}</div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div class="text-slate-400 text-xs font-semibold">Hours Coached</div>
          <div class="text-2xl font-black text-white mt-1">${totalHours.toFixed(1)}h</div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div class="text-slate-400 text-xs font-semibold">Coaches</div>
          <div class="text-2xl font-black text-cricket-gold mt-1">${coaches.length}</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button onclick="openAddSessionModal()" class="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left transition flex items-center space-x-3">
          <div class="p-2.5 bg-cricket-gold/20 text-cricket-gold rounded-xl"><i data-lucide="calendar-plus" class="w-5 h-5"></i></div>
          <div><div class="font-bold text-xs text-white">Add Session</div><div class="text-[10px] text-slate-400">Schedule training</div></div>
        </button>
        <button onclick="openAddPlayerModal()" class="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left transition flex items-center space-x-3">
          <div class="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl"><i data-lucide="user-plus" class="w-5 h-5"></i></div>
          <div><div class="font-bold text-xs text-white">Add Player</div><div class="text-[10px] text-slate-400">Register player</div></div>
        </button>
        <button onclick="switchTab('analytics')" class="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left transition flex items-center space-x-3">
          <div class="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl"><i data-lucide="bar-chart-3" class="w-5 h-5"></i></div>
          <div><div class="font-bold text-xs text-white">Analytics</div><div class="text-[10px] text-slate-400">View performance</div></div>
        </button>
        <button onclick="exportCSV()" class="p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left transition flex items-center space-x-3">
          <div class="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl"><i data-lucide="download" class="w-5 h-5"></i></div>
          <div><div class="font-bold text-xs text-white">Export Data</div><div class="text-[10px] text-slate-400">Download CSV</div></div>
        </button>
      </div>

      <!-- Recent Sessions -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-base text-white">Recent Coaching Sessions</h3>
          <button onclick="switchTab('sessions')" class="text-xs text-cricket-gold hover:underline">View All</button>
        </div>
        <div class="space-y-3">
          ${recentSessions.length === 0 ? `<div class="text-center py-8 text-slate-500 text-xs">No sessions recorded yet.</div>` : recentSessions.map(s => renderSessionCard(s)).join('')}
        </div>
      </div>
    </div>
  `;
}

// 2. Sessions Tab
function renderSessionsTab() {
  const filteredSessions = sessions.filter(s => {
    if (activeSessionFilter === 'mine' && !currentUser.isAdmin && s.coachId !== currentUser.id) return false;
    if (sessionTypeFilter !== 'all' && s.sessionType !== sessionTypeFilter) return false;
    if (wicketTypeFilter !== 'all' && s.wicketType !== wicketTypeFilter) return false;
    if (selectedCoachFilter !== 'all' && s.coachId !== selectedCoachFilter) return false;
    if (searchQuery && !s.playerName.toLowerCase().includes(searchQuery.toLowerCase()) && !s.notes.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return `
    <div class="space-y-6 md:ml-64">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black text-white">Coaching Sessions</h2>
          <p class="text-xs text-slate-400">Manage academy training schedules and player sessions.</p>
        </div>
        <button onclick="openAddSessionModal()" class="px-4 py-2.5 bg-cricket-gold text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-2 shadow hover:brightness-110">
          <i data-lucide="plus" class="w-4 h-4"></i><span>Schedule New Session</span>
        </button>
      </div>

      <!-- Filters & Search -->
      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div class="flex flex-wrap gap-2">
          <button onclick="setActiveFilter('all')" class="px-3 py-1.5 rounded-xl text-xs font-bold ${activeSessionFilter === 'all' ? 'bg-cricket-gold text-slate-950' : 'bg-slate-800 text-slate-300'}">All Sessions</button>
          <button onclick="setActiveFilter('mine')" class="px-3 py-1.5 rounded-xl text-xs font-bold ${activeSessionFilter === 'mine' ? 'bg-cricket-gold text-slate-950' : 'bg-slate-800 text-slate-300'}">My Sessions</button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="text" id="session-search" oninput="handleSearch(this.value)" placeholder="Search player or notes..." value="${searchQuery}" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cricket-gold" />
          <select id="session-type-filter" onchange="handleSessionTypeFilter(this.value)" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cricket-gold">
            <option value="all">All Session Types</option>
            ${SESSION_TYPES.map(t => `<option value="${t}" ${sessionTypeFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
          <select id="wicket-type-filter" onchange="handleWicketTypeFilter(this.value)" class="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cricket-gold">
            <option value="all">All Wicket Types</option>
            ${WICKET_TYPES.map(w => `<option value="${w}" ${wicketTypeFilter === w ? 'selected' : ''}>${w}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Sessions List -->
      <div class="space-y-3">
        ${filteredSessions.length === 0 ? `<div class="text-center py-12 text-slate-500 text-xs">No coaching sessions match your filters.</div>` : filteredSessions.map(s => renderSessionCard(s)).join('')}
      </div>
    </div>
  `;
}

window.setActiveFilter = (f) => { activeSessionFilter = f; render(); };
window.handleSearch = (q) => { searchQuery = q; };
window.handleSessionTypeFilter = (t) => { sessionTypeFilter = t; render(); };
window.handleWicketTypeFilter = (w) => { wicketTypeFilter = w; render(); };

function renderSessionCard(s) {
  const canEdit = currentUser.isAdmin || s.coachId === currentUser.id;
  return `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow hover:border-cricket-gold/30 transition">
      <div class="flex items-start justify-between">
        <div>
          <div class="flex items-center space-x-2">
            <span class="px-2.5 py-0.5 bg-cricket-primary text-cricket-gold text-[10px] font-bold rounded-full">${s.sessionType}</span>
            <span class="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-semibold rounded-full">${s.wicketType}</span>
          </div>
          <h4 class="font-bold text-white text-base mt-2">${s.playerName}</h4>
          <p class="text-xs text-slate-400">Coach: <span class="text-slate-200">${s.coachName}</span></p>
        </div>
        <div class="text-right">
          <div class="text-xs font-bold text-cricket-gold">${s.date}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${s.startTime} (${s.durationMinutes} mins)</div>
        </div>
      </div>
      ${s.notes ? `<p class="text-xs text-slate-300 mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800">${s.notes}</p>` : ''}
      ${canEdit ? `
        <div class="mt-4 pt-3 border-t border-slate-800 flex justify-end space-x-2">
          <button onclick="editSession('${s.id}')" class="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg">Edit</button>
          <button onclick="deleteSession('${s.id}')" class="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-semibold rounded-lg">Delete</button>
        </div>
      ` : ''}
    </div>
  `;
}

// 3. Players Tab
function renderPlayersTab() {
  return `
    <div class="space-y-6 md:ml-64">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-black text-white">Academy Players</h2>
          <p class="text-xs text-slate-400">Registered players in the coaching academy.</p>
        </div>
        <button onclick="openAddPlayerModal()" class="px-4 py-2.5 bg-cricket-gold text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-2 shadow hover:brightness-110">
          <i data-lucide="user-plus" class="w-4 h-4"></i><span>Add New Player</span>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        ${players.length === 0 ? `<div class="col-span-full text-center py-12 text-slate-500 text-xs">No players registered yet.</div>` : players.map(p => {
          const pSessions = sessions.filter(s => s.playerId === p.id);
          return `
            <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
              <div class="flex items-center space-x-3">
                <div class="w-12 h-12 bg-cricket-primary/30 border border-cricket-gold/30 rounded-2xl flex items-center justify-center font-bold text-cricket-gold text-lg">
                  ${p.name.charAt(0)}
                </div>
                <div>
                  <h4 class="font-bold text-white text-base">${p.name}</h4>
                  <p class="text-xs text-slate-400">${p.category}</p>
                </div>
              </div>
              <div class="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <span>Contact: ${p.contact || 'N/A'}</span>
                <span class="text-cricket-gold font-bold">${pSessions.length} Sessions</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// 4. Analytics Tab
function renderAnalyticsTab() {
  const mySessions = sessions.filter(s => currentUser.isAdmin || s.coachId === currentUser.id);
  const totalHours = mySessions.reduce((acc, s) => acc + (s.durationMinutes || 60), 0) / 60;

  // Breakdown by type
  const typeCounts = {};
  SESSION_TYPES.forEach(t => typeCounts[t] = 0);
  mySessions.forEach(s => {
    if (typeCounts[s.sessionType] !== undefined) typeCounts[s.sessionType]++;
    else typeCounts['Other'] = (typeCounts['Other'] || 0) + 1;
  });

  setTimeout(() => {
    const ctx = document.getElementById('analyticsChart');
    if (ctx) {
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(typeCounts),
          datasets: [{
            data: Object.values(typeCounts),
            backgroundColor: ['#10B981', '#EF4444', '#F59E0B', '#06B6D4', '#F97316', '#8B5CF6', '#6366F1', '#64748B']
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#94A3B8', font: { size: 11 } } }
          }
        }
      });
    }
  }, 100);

  return `
    <div class="space-y-6 md:ml-64">
      <div>
        <h2 class="text-2xl font-black text-white">Academy Analytics</h2>
        <p class="text-xs text-slate-400">Performance metrics and session distributions.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div class="text-slate-400 text-xs font-semibold">Total Sessions</div>
          <div class="text-3xl font-black text-white mt-1">${mySessions.length}</div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div class="text-slate-400 text-xs font-semibold">Total Hours Coached</div>
          <div class="text-3xl font-black text-cricket-gold mt-1">${totalHours.toFixed(1)}h</div>
        </div>
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow">
          <div class="text-slate-400 text-xs font-semibold">Active Players</div>
          <div class="text-3xl font-black text-emerald-400 mt-1">${players.length}</div>
        </div>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow max-w-xl mx-auto">
        <h3 class="font-bold text-sm text-white mb-4 text-center">Sessions by Training Type</h3>
        <div class="relative w-full h-64 flex items-center justify-center">
          <canvas id="analyticsChart"></canvas>
        </div>
      </div>
    </div>
  `;
}

// 5. Profile Tab
function renderProfileTab() {
  return `
    <div class="space-y-6 md:ml-64 max-w-xl mx-auto">
      <div>
        <h2 class="text-2xl font-black text-white">Coach Profile</h2>
        <p class="text-xs text-slate-400">Your account details and settings.</p>
      </div>

      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow space-y-6">
        <div class="flex items-center space-x-4">
          <div class="w-20 h-20 bg-cricket-primary border border-cricket-gold/40 rounded-2xl flex items-center justify-center text-cricket-gold font-bold text-2xl shadow">
            ${currentUser.name.charAt(0)}
          </div>
          <div>
            <h3 class="text-xl font-bold text-white">${currentUser.name}</h3>
            <p class="text-xs text-cricket-gold">${currentUser.title}</p>
            <p class="text-xs text-slate-400 mt-1">${currentUser.email}</p>
          </div>
        </div>

        <div class="border-t border-slate-800 pt-4 space-y-3">
          <div class="flex justify-between text-xs"><span class="text-slate-400">Role:</span><span class="font-bold text-white">${currentUser.role}</span></div>
          <div class="flex justify-between text-xs"><span class="text-slate-400">Status:</span><span class="font-bold text-emerald-400">Approved</span></div>
        </div>

        <div class="border-t border-slate-800 pt-4">
          <button onclick="logout()" class="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-xl text-xs transition">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  `;
}

// 6. Requests Tab (Admin Only)
function renderRequestsTab() {
  return `
    <div class="space-y-6 md:ml-64">
      <div>
        <h2 class="text-2xl font-black text-white">Coach Approval Requests</h2>
        <p class="text-xs text-slate-400">Approve or reject newly registered coaches.</p>
      </div>

      <div class="space-y-3">
        ${unapprovedCoaches.length === 0 ? `<div class="text-center py-12 text-slate-500 text-xs">No pending coach approval requests.</div>` : unapprovedCoaches.map(c => `
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow flex items-center justify-between">
            <div>
              <h4 class="font-bold text-white text-base">${c.name}</h4>
              <p class="text-xs text-slate-400">${c.email} • ${c.title}</p>
            </div>
            <div class="flex space-x-2">
              <button onclick="approveCoach('${c.id}')" class="px-3 py-1.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs">Approve</button>
              <button onclick="rejectCoach('${c.id}')" class="px-3 py-1.5 bg-red-500/20 text-red-300 font-bold rounded-xl text-xs">Reject</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

window.approveCoach = async (coachId) => {
  await updateDoc(doc(db, "coaches", coachId), { isApproved: true });
  await loadAppData();
};

window.rejectCoach = async (coachId) => {
  await deleteDoc(doc(db, "coaches", coachId));
  await loadAppData();
};

window.logout = async () => {
  await signOut(auth);
  localStorage.removeItem('cb_current_user');
  currentUser = null;
  render();
};

// ================= MODALS & ACTIONS =================
window.openAddSessionModal = () => {
  isAddSessionOpen = true;
  editingSession = null;
  render();
};

window.openAddPlayerModal = () => {
  isAddPlayerOpen = true;
  render();
};

window.editSession = (sessionId) => {
  editingSession = sessions.find(s => s.id === sessionId);
  isAddSessionOpen = true;
  render();
};

window.deleteSession = async (sessionId) => {
  if (confirm("Are you sure you want to delete this session?")) {
    await deleteDoc(doc(db, "coaching_sessions", sessionId));
    await loadAppData();
  }
};

function renderAddSessionModal() {
  const s = editingSession || {};
  return `
    <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div class="bg-slate-900 border border-cricket-gold/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="font-bold text-lg text-white">${s.id ? 'Edit Session' : 'Schedule New Session'}</h3>
          <button onclick="closeModal()" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
        </div>

        <form id="session-form" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Select Player</label>
            <select id="modal-player" required class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cricket-gold">
              <option value="">Select Player</option>
              ${players.map(p => `<option value="${p.id}|${p.name}" ${s.playerId === p.id ? 'selected' : ''}>${p.name} (${p.category})</option>`).join('')}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Session Type</label>
              <select id="modal-type" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cricket-gold">
                ${SESSION_TYPES.map(t => `<option value="${t}" ${s.sessionType === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Wicket Type</label>
              <select id="modal-wicket" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cricket-gold">
                ${WICKET_TYPES.map(w => `<option value="${w}" ${s.wicketType === w ? 'selected' : ''}>${w}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Date</label>
              <input type="date" id="modal-date" required value="${s.date || new Date().toISOString().split('T')[0]}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cricket-gold" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-300 mb-1">Start Time</label>
              <input type="text" id="modal-time" required value="${s.startTime || '07:00 AM'}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cricket-gold" />
            </div>
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Duration (Minutes)</label>
            <input type="number" id="modal-duration" required value="${s.durationMinutes || 60}" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cricket-gold" />
          </div>

          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Coaching Notes</label>
            <textarea id="modal-notes" rows="3" placeholder="Enter session drills and notes..." class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cricket-gold">${s.notes || ''}</textarea>
          </div>

          <button type="submit" class="w-full py-3 bg-cricket-gold text-slate-950 font-bold rounded-xl text-xs shadow hover:brightness-110">
            ${s.id ? 'Update Session' : 'Save Session'}
          </button>
        </form>
      </div>
    </div>
  `;
}

function renderAddPlayerModal() {
  return `
    <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div class="bg-slate-900 border border-cricket-gold/30 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="font-bold text-lg text-white">Add New Player</h3>
          <button onclick="closeModal()" class="text-slate-400 hover:text-white"><i data-lucide="x" class="w-5 h-5"></i></button>
        </div>

        <form id="player-form" class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Player Name</label>
            <input type="text" id="player-name" required placeholder="Sachin Tendulkar" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cricket-gold" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Contact Number</label>
            <input type="text" id="player-contact" placeholder="+91 98765 43210" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cricket-gold" />
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Category</label>
            <input type="text" id="player-category" value="Academy Player" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-cricket-gold" />
          </div>

          <button type="submit" class="w-full py-3 bg-cricket-gold text-slate-950 font-bold rounded-xl text-xs shadow hover:brightness-110">
            Save Player
          </button>
        </form>
      </div>
    </div>
  `;
}

window.closeModal = () => {
  isAddSessionOpen = false;
  isAddPlayerOpen = false;
  editingSession = null;
  render();
};

document.addEventListener('submit', async (e) => {
  if (e.target && e.target.id === 'session-form') {
    e.preventDefault();
    const playerVal = document.getElementById('modal-player').value.split('|');
    const playerId = playerVal[0];
    const playerName = playerVal[1];
    const sessionType = document.getElementById('modal-type').value;
    const wicketType = document.getElementById('modal-wicket').value;
    const date = document.getElementById('modal-date').value;
    const startTime = document.getElementById('modal-time').value;
    const durationMinutes = parseInt(document.getElementById('modal-duration').value) || 60;
    const notes = document.getElementById('modal-notes').value;

    const sessionData = {
      coachId: currentUser.id,
      coachName: currentUser.name,
      playerId,
      playerName,
      sessionType,
      wicketType,
      date,
      startTime,
      durationMinutes,
      notes,
      updatedAt: Date.now()
    };

    if (editingSession && editingSession.id) {
      await updateDoc(doc(db, "coaching_sessions", editingSession.id), sessionData);
    } else {
      sessionData.id = 'sess_' + Math.random().toString(36).substring(2, 9);
      sessionData.createdAt = Date.now();
      await setDoc(doc(db, "coaching_sessions", sessionData.id), sessionData);
    }

    closeModal();
    await loadAppData();
  }

  if (e.target && e.target.id === 'player-form') {
    e.preventDefault();
    const name = document.getElementById('player-name').value.trim();
    const contact = document.getElementById('player-contact').value.trim();
    const category = document.getElementById('player-category').value.trim();

    const playerData = {
      id: 'plyr_' + Math.random().toString(36).substring(2, 9),
      name,
      contact,
      category,
      createdAt: Date.now()
    };

    await setDoc(doc(db, "players", playerData.id), playerData);
    closeModal();
    await loadAppData();
  }
});

// CSV Export
window.exportCSV = () => {
  let csv = "Session ID,Coach,Player,Type,Wicket Type,Date,Time,Duration (mins),Notes\n";
  sessions.forEach(s => {
    csv += `"${s.id}","${s.coachName}","${s.playerName}","${s.sessionType}","${s.wicketType}","${s.date}","${s.startTime}",${s.durationMinutes},"${(s.notes || '').replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coaching_beyond_report_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
};

// PWA Setup
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error("SW registration failed", err));
  }

  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('pwa-banner').classList.remove('hidden');
  });

  document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        document.getElementById('pwa-banner').classList.add('hidden');
      }
      deferredPrompt = null;
    }
  });

  document.getElementById('pwa-close-btn')?.addEventListener('click', () => {
    document.getElementById('pwa-banner').classList.add('hidden');
  });
}

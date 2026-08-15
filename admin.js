// Admin Panel JavaScript

// State
let currentAdmin = null;
let currentSection = "dashboard";

// DOM Elements
const loginScreen = document.getElementById("login-screen");
const loginForm = document.getElementById("login-form");
const loginError = document.querySelector("[data-login-error]");
const adminDashboard = document.getElementById("admin-dashboard");

const navItems = document.querySelectorAll(".nav-item");
const sections = document.querySelectorAll(".section");

const adminArmourEl = document.querySelector("[data-admin-armour]");
const adminRoleEl = document.querySelector("[data-admin-role]");
const logoutBtn = document.querySelector("[data-logout]");

const modal = document.getElementById("modal");
const modalTitle = document.querySelector("[data-modal-title]");
const modalBody = document.querySelector("[data-modal-body]");

// Team names
const teamNames = {
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "11",
  12: "12",
  13: "13",
  14: "14",
};

const allTeams = Object.keys(teamNames);

// Sub-teams (team 2 only)
const SUBTEAM_PARENT = "2";
const SUB_TEAMS = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];

function subTeamLabel(st) {
  return st === "unassigned" ? "Unassigned" : `2${st.toUpperCase()}`;
}

function teamEntryLabel(t) {
  if (t === "all") return "All Teams";
  if (t.startsWith(`${SUBTEAM_PARENT}:`)) {
    return `2${t.split(":")[1].toUpperCase()}`;
  }
  return teamNames[t] || t;
}

// Session Management
function getAdminSession() {
  try {
    const session = localStorage.getItem("armourcare-admin");
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

function setAdminSession(admin) {
  try {
    if (admin) {
      localStorage.setItem("armourcare-admin", JSON.stringify(admin));
    } else {
      localStorage.removeItem("armourcare-admin");
    }
  } catch {}
}

function getAdminToken() {
  try {
    return localStorage.getItem("armourcare-admin-token") || "";
  } catch {
    return "";
  }
}

function setAdminToken(token) {
  try {
    if (token) {
      localStorage.setItem("armourcare-admin-token", token);
    } else {
      localStorage.removeItem("armourcare-admin-token");
    }
  } catch {}
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getAdminToken()}`,
  };
}

// API Functions
async function apiAdminLogin(armourNumber, password) {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ armourNumber, password }),
  });
  return res.json();
}

async function apiGetSecurityLogs(event, user, periodHours) {
  const params = new URLSearchParams();
  if (event) params.set("event", event);
  if (user) params.set("user", user);
  if (periodHours) params.set("period", periodHours);
  params.set("limit", "500");
  const res = await fetch(`/api/admin/security-logs?${params}`, {
    headers: authHeaders(),
  });
  return res.json();
}

async function apiDeleteSecurityLog(id) {
  const res = await fetch("/api/admin/security-logs", {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ id }),
  });
  return res.json();
}

async function apiGetAdmins() {
  const res = await fetch("/api/admin/admins", { headers: authHeaders() });
  return res.json();
}

async function apiAddAdmin(
  armourNumber,
  password,
  teams,
  nickname,
  permissions,
) {
  const res = await fetch("/api/admin/admins", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      armourNumber,
      password,
      teams,
      nickname,
      permissions,
    }),
  });
  return res.json();
}

async function apiUpdateAdmin(
  targetArmour,
  teams,
  password,
  nickname,
  permissions,
) {
  const res = await fetch("/api/admin/admins", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({
      targetArmour,
      teams,
      password,
      nickname,
      permissions,
    }),
  });
  return res.json();
}

async function apiDeleteAdmin(targetArmour) {
  const res = await fetch("/api/admin/admins", {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ targetArmour }),
  });
  return res.json();
}

async function apiGetUsers() {
  const res = await fetch("/api/admin/users", { headers: authHeaders() });
  return res.json();
}

async function apiDeleteUser(targetArmour) {
  const res = await fetch("/api/admin/users", {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ targetArmour }),
  });
  return res.json();
}

async function apiUpdateUserNickname(targetArmour, nickname) {
  const res = await fetch("/api/admin/users", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ targetArmour, nickname }),
  });
  return res.json();
}

async function apiUpdateUserSubTeam(targetArmour, subTeam) {
  const res = await fetch("/api/admin/users", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ targetArmour, subTeam }),
  });
  return res.json();
}

async function apiGetSubmissions(month) {
  let url = "/api/admin/submissions";
  if (month) url += `?month=${month}`;
  const res = await fetch(url, { headers: authHeaders() });
  return res.json();
}

async function apiResetSubmission(targetArmour, month) {
  const res = await fetch("/api/admin/submissions", {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ targetArmour, month }),
  });
  return res.json();
}

async function apiChangePassword(targetArmour, currentPassword, newPassword) {
  const res = await fetch("/api/admin/change-password", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ targetArmour, newPassword }),
  });
  return res.json();
}

async function apiGetStats(month) {
  const params = month ? `?month=${month}` : "";
  const res = await fetch(`/api/admin/stats${params}`, {
    headers: authHeaders(),
  });
  return res.json();
}

async function apiGetQuestions() {
  const res = await fetch("/api/admin/questions", { headers: authHeaders() });
  return res.json();
}

async function apiUpdateQuestions(questions) {
  const res = await fetch("/api/admin/questions", {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ questions }),
  });
  return res.json();
}

async function apiGetNotifications() {
  const res = await fetch("/api/admin/notifications", {
    headers: authHeaders(),
  });
  return res.json();
}

async function apiSendNotification(title, message, recipients) {
  const res = await fetch("/api/admin/notifications", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title, message, recipients }),
  });
  return res.json();
}

async function apiDeleteNotification(notificationId) {
  const res = await fetch("/api/admin/notifications", {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify({ notificationId }),
  });
  return res.json();
}

// UI Functions
function showLogin() {
  loginScreen.classList.remove("hidden");
  adminDashboard.classList.add("hidden");
  document.body.classList.remove(
    "is-master",
    "can-questions",
    "can-notifications",
  );
}

// Auto-refresh interval
let refreshInterval = null;

function showDashboard() {
  loginScreen.classList.add("hidden");
  adminDashboard.classList.remove("hidden");

  if (currentAdmin.isMaster) {
    document.body.classList.add("is-master");
  }

  // Apply permission classes for sub-admins
  const perms = currentAdmin.permissions || {};
  if (currentAdmin.isMaster || perms.questions) {
    document.body.classList.add("can-questions");
  }
  if (currentAdmin.isMaster || perms.notifications) {
    document.body.classList.add("can-notifications");
  }
  if (currentAdmin.isMaster || perms.security) {
    document.body.classList.add("can-security");
    // Check for security events and show badge
    apiGetSecurityLogs("", "")
      .then((data) => {
        if (data.summary && data.summary.total > 0) {
          const secNav = document.querySelector('[data-section="security"]');
          if (secNav && !secNav.querySelector(".nav-badge")) {
            const badge = document.createElement("span");
            badge.className = "nav-badge";
            badge.textContent = data.summary.last24h || "!";
            secNav.style.position = "relative";
            secNav.appendChild(badge);
          }
        }
      })
      .catch(() => {});
  }

  adminArmourEl.textContent = currentAdmin.armourNumber;
  adminRoleEl.textContent = currentAdmin.isMaster ? "Master Admin" : "Admin";

  // Pre-load questions data so it's available for submission reports
  if (!questionsData) {
    apiGetQuestions()
      .then((data) => {
        questionsData = data.questions;
      })
      .catch(() => {});
  }

  loadSection("dashboard");

  // Auto-refresh security every 1 hour (keep this for security monitoring)
  setInterval(() => {
    if (currentSection === "security") loadSecurityLogs();
  }, 3600000);
}

async function showSection(sectionId) {
  currentSection = sectionId;

  // Dismiss security badge when visiting Security tab
  if (sectionId === "security") {
    const badge = document.querySelector(
      '[data-section="security"] .nav-badge',
    );
    if (badge) badge.remove();
  }

  navItems.forEach((item) => {
    item.classList.toggle("active", item.dataset.section === sectionId);
  });

  sections.forEach((section) => {
    section.classList.toggle("active", section.id === `section-${sectionId}`);
  });

  await loadSection(sectionId);
}

async function loadSection(sectionId) {
  switch (sectionId) {
    case "dashboard":
      await loadDashboard();
      break;
    case "users":
      await loadUsers();
      break;
    case "submissions":
      await loadSubmissions();
      break;
    case "questions":
      await loadQuestions();
      break;
    case "notifications":
      await loadNotifications();
      break;
    case "security":
      await loadSecurityLogs();
      break;
    case "admins":
      await loadAdmins();
      break;
    case "guide":
      break;
  }
}

// Dashboard
async function loadDashboard(month) {
  try {
    const data = await apiGetStats(month);

    // Populate month selector (only on first load or if months changed)
    const dashMonthSelect = document.querySelector(
      "[data-dashboard-month-select]",
    );
    if (dashMonthSelect && data.availableMonths) {
      const prevVal = dashMonthSelect.value;
      dashMonthSelect.innerHTML = data.availableMonths
        .map(
          (m) =>
            `<option value="${m}" ${m === data.monthKey ? "selected" : ""}>${formatMonth(m)}</option>`,
        )
        .join("");
      if (!month && prevVal) dashMonthSelect.value = prevVal;
    }

    document.querySelector("[data-total-users]").textContent = data.totalUsers;
    document.querySelector("[data-total-submissions]").textContent =
      data.totalSubmissions;
    document.querySelector("[data-completion-rate]").textContent =
      `${data.completionRate}%`;
    document.querySelector("[data-month-label]").textContent = formatMonth(
      data.monthKey,
    );

    const tbody = document.querySelector("[data-team-stats]");
    tbody.innerHTML = "";

    Object.entries(data.teamStats).forEach(([team, stats]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="team-badge">${teamNames[team] || team}</span></td>
        <td>${stats.members}</td>
        <td>${stats.submitted}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="progress-bar" style="width: 100px;">
              <div class="progress-fill" style="width: ${stats.completion}%"></div>
            </div>
            <span>${stats.completion}%</span>
          </div>
        </td>
      `;
      tbody.appendChild(tr);

      // Sub-team breakdown rows under team 2
      if (team === SUBTEAM_PARENT && data.subTeamStats) {
        Object.entries(data.subTeamStats).forEach(([st, stStats]) => {
          const subTr = document.createElement("tr");
          subTr.innerHTML = `
            <td style="padding-left: 28px;"><span class="team-badge" style="opacity: 0.75;">${subTeamLabel(st)}</span></td>
            <td>${stStats.members}</td>
            <td>${stStats.submitted}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <div class="progress-bar" style="width: 100px;">
                  <div class="progress-fill" style="width: ${stStats.completion}%"></div>
                </div>
                <span>${stStats.completion}%</span>
              </div>
            </td>
          `;
          tbody.appendChild(subTr);
        });
      }
    });

    // Render radar charts for each team
    renderTeamRadarCharts(data.teamStats, data.monthKey);
  } catch (err) {
    console.error("Error loading dashboard:", err);
  }
}

// Radar chart colors
const radarColors = {
  burnout: "rgba(100, 200, 150, 0.8)",
  mental: "rgba(100, 150, 255, 0.8)",
  sleep: "rgba(255, 180, 100, 0.8)",
  lifestyle: "rgba(200, 100, 200, 0.8)",
};

// Draw radar chart on canvas
function drawRadarChart(canvas, scores) {
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 30;

  ctx.clearRect(0, 0, width, height);

  const labels = ["Burnout", "Mental", "Sleep", "Lifestyle"];
  const values = [
    scores.burnout || 0,
    scores.mental || 0,
    scores.sleep || 0,
    scores.lifestyle || 0,
  ];
  const colors = [
    radarColors.burnout,
    radarColors.mental,
    radarColors.sleep,
    radarColors.lifestyle,
  ];
  const numPoints = labels.length;
  const angleStep = (Math.PI * 2) / numPoints;

  // Draw grid circles
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, (radius * i) / 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw axis lines
  for (let i = 0; i < numPoints; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // Draw labels
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.font = "11px Space Grotesk, sans-serif";
  ctx.textAlign = "center";
  for (let i = 0; i < numPoints; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const x = centerX + Math.cos(angle) * (radius + 18);
    const y = centerY + Math.sin(angle) * (radius + 18);
    ctx.fillText(labels[i], x, y + 4);
  }

  // Draw data polygon
  ctx.beginPath();
  for (let i = 0; i < numPoints; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const value = (100 - values[i]) / 100;
    const x = centerX + Math.cos(angle) * radius * value;
    const y = centerY + Math.sin(angle) * radius * value;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(74, 158, 255, 0.2)";
  ctx.fill();
  ctx.strokeStyle = "rgba(74, 158, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw data points with colors
  for (let i = 0; i < numPoints; i++) {
    const angle = i * angleStep - Math.PI / 2;
    const value = (100 - values[i]) / 100;
    const x = centerX + Math.cos(angle) * radius * value;
    const y = centerY + Math.sin(angle) * radius * value;

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = colors[i];
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// Render radar charts for all teams
function renderTeamRadarCharts(teamStats, monthKey) {
  const grid = document.querySelector("[data-radar-grid]");
  if (!grid) return;

  grid.innerHTML = "";

  const teamsWithData = Object.entries(teamStats).filter(
    ([team, stats]) =>
      stats.sectionScores &&
      (stats.sectionScores.burnout > 0 ||
        stats.sectionScores.mental > 0 ||
        stats.sectionScores.sleep > 0 ||
        stats.sectionScores.lifestyle > 0),
  );

  if (teamsWithData.length === 0) {
    grid.innerHTML =
      '<p class="no-data-message">No submission data available for radar charts</p>';
    return;
  }

  teamsWithData.forEach(([team, stats]) => {
    const scores = stats.sectionScores || {
      burnout: 0,
      mental: 0,
      sleep: 0,
      lifestyle: 0,
    };
    const avgScore = Math.round(
      (scores.burnout + scores.mental + scores.sleep + scores.lifestyle) / 4,
    );

    // Get border color based on average score
    const getBorderColor = (score) => {
      if (score >= 60) return "#34d399"; // Green
      if (score >= 40) return "#fbbf24"; // Yellow
      return "#ef4444"; // Red
    };
    const borderColor = getBorderColor(avgScore);

    const card = document.createElement("div");
    card.className = "radar-card";
    card.style.borderColor = borderColor;
    card.style.cursor = "pointer";
    card.title = `View ${teamNames[team] || team} submissions`;
    card.addEventListener("click", async () => {
      // Load submissions for the same month as dashboard
      await loadSubmissions(monthKey);
      // Switch to submissions section without reloading
      currentSection = "submissions";
      navItems.forEach((item) => {
        item.classList.toggle("active", item.dataset.section === "submissions");
      });
      sections.forEach((section) => {
        section.classList.toggle(
          "active",
          section.id === "section-submissions",
        );
      });
      // Scroll to team
      setTimeout(() => jumpToSubmissionsTeam(team), 100);
    });
    card.innerHTML = `
      <div class="radar-card-header">
        <span class="radar-card-title">${teamNames[team] || team}</span>
        <span class="radar-card-score" style="color: ${borderColor}">Avg: ${avgScore}%</span>
      </div>
      <div class="radar-canvas-container">
        <canvas class="radar-canvas" width="200" height="200" data-team-radar="${team}"></canvas>
      </div>
      <div class="radar-legend">
        <div class="radar-legend-item">
          <span class="radar-legend-dot" style="background: ${radarColors.burnout}"></span>
          <span>Burnout ${scores.burnout}%</span>
        </div>
        <div class="radar-legend-item">
          <span class="radar-legend-dot" style="background: ${radarColors.mental}"></span>
          <span>Mental ${scores.mental}%</span>
        </div>
        <div class="radar-legend-item">
          <span class="radar-legend-dot" style="background: ${radarColors.sleep}"></span>
          <span>Sleep ${scores.sleep}%</span>
        </div>
        <div class="radar-legend-item">
          <span class="radar-legend-dot" style="background: ${radarColors.lifestyle}"></span>
          <span>Lifestyle ${scores.lifestyle}%</span>
        </div>
      </div>
    `;

    grid.appendChild(card);

    // Draw the radar chart
    const canvas = card.querySelector(`[data-team-radar="${team}"]`);
    if (canvas) {
      drawRadarChart(canvas, scores);
    }
  });
}

// Users
let allUsers = [];

async function loadUsers() {
  try {
    const data = await apiGetUsers();
    allUsers = data.users || [];
    renderUsers(allUsers);
  } catch (err) {
    console.error("Error loading users:", err);
  }
}

function renderUsers(users) {
  const container = document.querySelector("[data-users-container]");

  if (users.length === 0) {
    container.innerHTML =
      '<div class="card"><div class="card-body"><p class="empty-state">No users found</p></div></div>';
    return;
  }

  // Group users by team
  const grouped = {};
  users.forEach((user) => {
    const team = user.team || "Unknown";
    if (!grouped[team]) grouped[team] = [];
    grouped[team].push(user);
  });

  // Sort teams numerically
  const sortedTeams = Object.keys(grouped).sort((a, b) => {
    const numA = parseInt(a) || 999;
    const numB = parseInt(b) || 999;
    return numA - numB;
  });

  // Populate jump to team dropdown
  const jumpSelect = document.querySelector("[data-jump-to-team]");
  if (jumpSelect) {
    jumpSelect.innerHTML =
      '<option value="">Jump to team...</option>' +
      sortedTeams
        .map(
          (t) =>
            `<option value="team-${t}">${teamNames[t] || "Team " + t} (${grouped[t].length})</option>`,
        )
        .join("");
  }

  function userTableHtml(list, isSubTeamParent) {
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Armour Number</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map(
              (user) => `
            <tr>
              <td>
                <code>${user.armourNumber}</code>
                ${user.hasSubscription ? '<span class="user-subscribed" title="Subscribed to notifications"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></span>' : ""}
                ${user.nickname ? `<div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(user.nickname)}</div>` : ""}
              </td>
              <td>${formatDate(user.createdAt)}</td>
              <td>
                <button class="btn btn-secondary btn-sm" onclick="editUserNickname('${user.armourNumber}', '${escapeHtml(user.nickname || "")}')">Nickname</button>
                ${isSubTeamParent ? `<button class="btn btn-secondary btn-sm" onclick="editUserSubTeam('${user.armourNumber}', '${user.subTeam || ""}')">Sub-team</button>` : ""}
                <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.armourNumber}')">Delete</button>
              </td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  let html = "";
  sortedTeams.forEach((team) => {
    const teamUsers = grouped[team];
    const teamName = teamNames[team] || "Team " + team;

    let bodyHtml;
    if (team === SUBTEAM_PARENT) {
      // Sub-group team 2 users by sub-team
      const bySubTeam = {};
      teamUsers.forEach((u) => {
        const st = u.subTeam && SUB_TEAMS.includes(u.subTeam) ? u.subTeam : "unassigned";
        if (!bySubTeam[st]) bySubTeam[st] = [];
        bySubTeam[st].push(u);
      });
      const order = [...SUB_TEAMS, "unassigned"].filter((st) => bySubTeam[st]);
      bodyHtml = order
        .map(
          (st) => `
        <div class="subteam-group">
          <div class="team-group-header" style="padding-left: 12px;">
            <span class="team-group-name" style="font-size: 13px;">${subTeamLabel(st)}</span>
            <span class="team-group-count">${bySubTeam[st].length} user${bySubTeam[st].length !== 1 ? "s" : ""}</span>
          </div>
          <div class="card">
            <div class="card-body" style="padding: 0;">
              ${userTableHtml(bySubTeam[st], true)}
            </div>
          </div>
        </div>
      `,
        )
        .join("");
    } else {
      bodyHtml = `
        <div class="card">
          <div class="card-body" style="padding: 0;">
            ${userTableHtml(teamUsers, false)}
          </div>
        </div>
      `;
    }

    html += `
      <div class="team-group" id="team-${team}">
        <div class="team-group-header">
          <span class="team-group-name">${teamName}</span>
          <span class="team-group-count">${teamUsers.length} user${teamUsers.length !== 1 ? "s" : ""}</span>
        </div>
        ${bodyHtml}
      </div>
    `;
  });

  container.innerHTML = html;
}

function editUserSubTeam(armourNumber, currentSubTeam) {
  const html = `
    <form id="subteam-form">
      <div class="form-field">
        <label>Sub-team for ${armourNumber}</label>
        <select id="user-subteam" class="form-select" style="width: 100%; padding: 8px;">
          <option value="" ${!currentSubTeam ? "selected" : ""}>Unassigned</option>
          ${SUB_TEAMS.map(
            (st) =>
              `<option value="${st}" ${currentSubTeam === st ? "selected" : ""}>${subTeamLabel(st)}</option>`,
          ).join("")}
        </select>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  `;

  showModal("Assign Sub-team", html);

  document
    .getElementById("subteam-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const subTeam = document.getElementById("user-subteam").value;

      try {
        const result = await apiUpdateUserSubTeam(armourNumber, subTeam);
        if (result.error) {
          alert(result.error);
          return;
        }

        hideModal();
        loadUsers();
      } catch (err) {
        console.error("Error updating sub-team:", err);
        alert("Error updating sub-team");
      }
    });
}

function editUserNickname(armourNumber, currentNickname) {
  const html = `
    <form id="nickname-form">
      <div class="form-field">
        <label>Nickname for ${armourNumber}</label>
        <input type="text" id="user-nickname" value="${currentNickname}" placeholder="e.g. John Smith" />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn-primary">Save</button>
      </div>
    </form>
  `;

  showModal("Edit User Nickname", html);

  document
    .getElementById("nickname-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const nickname = document.getElementById("user-nickname").value;

      try {
        const result = await apiUpdateUserNickname(armourNumber, nickname);
        if (result.error) {
          alert(result.error);
          return;
        }

        hideModal();
        loadUsers();
      } catch (err) {
        console.error("Error updating nickname:", err);
        alert("Error updating nickname");
      }
    });
}

async function deleteUser(armourNumber) {
  if (!confirm(`Delete user ${armourNumber}?`)) return;

  try {
    const result = await apiDeleteUser(armourNumber);
    if (result.error) {
      alert(result.error);
      return;
    }
    loadUsers();
  } catch (err) {
    console.error("Error deleting user:", err);
    alert("Error deleting user");
  }
}

// User search
const userSearchInput = document.querySelector("[data-user-search]");
userSearchInput?.addEventListener("input", (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = allUsers.filter(
    (u) =>
      u.armourNumber.toLowerCase().includes(query) ||
      u.team.toLowerCase().includes(query),
  );
  renderUsers(filtered);
});

// Jump to team
document
  .querySelector("[data-jump-to-team]")
  ?.addEventListener("change", (e) => {
    const teamId = e.target.value;
    if (!teamId) return;
    const el = document.getElementById(teamId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    e.target.value = "";
  });

// Back to top button
const backToTopBtn = document.querySelector("[data-back-to-top]");
const mainContent = document.querySelector(".main-content");

if (mainContent && backToTopBtn) {
  mainContent.addEventListener("scroll", () => {
    if (mainContent.scrollTop > 300) {
      backToTopBtn.classList.remove("hidden");
    } else {
      backToTopBtn.classList.add("hidden");
    }
  });

  backToTopBtn.addEventListener("click", () => {
    mainContent.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// Submissions
let allSubmissions = [];
let availableMonths = [];

async function loadSubmissions(month) {
  try {
    const data = await apiGetSubmissions(month);
    allSubmissions = data.submissions || [];
    availableMonths = data.availableMonths || [];

    // Populate month selector
    const monthSelect = document.querySelector("[data-month-select]");
    monthSelect.innerHTML = availableMonths
      .map(
        (m) =>
          `<option value="${m}" ${m === data.monthKey ? "selected" : ""}>${formatMonth(m)}</option>`,
      )
      .join("");

    renderSubmissions(allSubmissions);
  } catch (err) {
    console.error("Error loading submissions:", err);
  }
}

function renderSubmissions(submissions) {
  const container = document.querySelector("[data-submissions-container]");

  if (submissions.length === 0) {
    container.innerHTML =
      '<div class="card"><div class="card-body"><p class="empty-state">No submissions found</p></div></div>';
    return;
  }

  // Group by team
  const grouped = {};
  submissions.forEach((sub) => {
    const team = sub.team || "unknown";
    if (!grouped[team]) grouped[team] = [];
    grouped[team].push(sub);
  });

  // Sort teams numerically
  const sortedTeams = Object.keys(grouped).sort((a, b) => {
    const numA = parseInt(a) || 999;
    const numB = parseInt(b) || 999;
    return numA - numB;
  });

  let html = "";
  sortedTeams.forEach((team) => {
    const subs = grouped[team];
    const teamName = teamNames[team] || team;
    html += `
      <div class="team-group" id="team-${team}">
        <div class="team-group-header">
          <span class="team-group-name">${teamName}</span>
          <span class="team-group-count">${subs.length} submission${subs.length !== 1 ? "s" : ""}</span>
        </div>
        <div class="card">
          <div class="card-body" style="padding: 0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Armour Number</th>
                  <th>Submitted</th>
                  <th>Score</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${subs
                  .map((sub) => {
                    const score = calcOverallScore(sub);
                    const scoreClass =
                      score !== null
                        ? score < 40
                          ? "score-low"
                          : score < 60
                            ? "score-medium"
                            : "score-high"
                        : "";
                    return `
                  <tr>
                    <td>
                      <code>${sub.armourNumber}</code>
                      ${sub.team === SUBTEAM_PARENT && sub.subTeam ? `<span class="team-badge" style="margin-left: 6px; font-size: 10px;">${subTeamLabel(sub.subTeam)}</span>` : ""}
                      ${sub.nickname ? `<div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(sub.nickname)}</div>` : ""}
                    </td>
                    <td>${formatDate(sub.submittedAt)}</td>
                    <td><span class="submission-score ${scoreClass}">${score !== null ? score + "%" : "-"}</span></td>
                    <td>
                      <button class="btn btn-secondary btn-sm" onclick="viewSubmission('${sub.armourNumber}')">View</button>
                      <button class="btn btn-danger btn-sm" onclick="resetSubmission('${sub.armourNumber}')">Reset</button>
                    </td>
                  </tr>
                `;
                  })
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Populate jump to team dropdown
  const jumpSelect = document.querySelector("[data-submissions-jump-to-team]");
  if (jumpSelect) {
    jumpSelect.innerHTML =
      '<option value="">Jump to team...</option>' +
      sortedTeams
        .map(
          (t) =>
            `<option value="${t}">${teamNames[t] || "Team " + t} (${grouped[t].length})</option>`,
        )
        .join("");
  }
}

// Jump to team on submissions page
function jumpToSubmissionsTeam(teamId) {
  const teamGroup = document.getElementById(`team-${teamId}`);
  if (teamGroup) {
    teamGroup.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// Event listener for submissions jump to team
document
  .querySelector("[data-submissions-jump-to-team]")
  ?.addEventListener("change", (e) => {
    if (e.target.value) {
      jumpToSubmissionsTeam(e.target.value);
      e.target.value = "";
    }
  });

// Dynamic category colors
const categoryColors = [
  "#ff6b6b",
  "#4ecdc4",
  "#9b59b6",
  "#f39c12",
  "#3498db",
  "#e74c3c",
  "#2ecc71",
  "#e67e22",
];

// Slugify helper (must match app.js)
function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Get max value for a response preset
function getPresetMaxValue(presetKey) {
  const preset = questionsData?.responsePresets?.[presetKey];
  if (!preset) return 3;
  if (preset.type === "buttons" && preset.options?.length) {
    return Math.max(...preset.options.map((o) => Number(o.value)));
  }
  return 3;
}

// Get min value for a response preset
function getPresetMinValue(presetKey) {
  const preset = questionsData?.responsePresets?.[presetKey];
  if (!preset) return 1;
  if (preset.type === "buttons" && preset.options?.length) {
    return Math.min(...preset.options.map((o) => Number(o.value)));
  }
  return 1;
}

// Get response label for a value given a preset
function getResponseLabel(presetKey, value) {
  const preset = questionsData?.responsePresets?.[presetKey];
  if (!preset) return String(value);
  if (preset.type === "buttons" && preset.options) {
    const opt = preset.options.find((o) => String(o.value) === String(value));
    return opt
      ? `${opt.label} (${value}/${Math.max(...preset.options.map((o) => Number(o.value)))})`
      : `${value}`;
  }
  return String(value);
}

// Map category title to 4-section key (must match server.js getSectionKey)
function getSectionKey(catTitle) {
  const t = catTitle.toLowerCase();
  if (t.includes("burnout")) return "burnout";
  if (t.includes("mental")) return "mental";
  if (t.includes("sleep")) return "sleep";
  return "lifestyle";
}

// Calculate wellbeing score (0-100%) for a single response, accounting for polarity
function calcWellbeingScore(value, minValue, maxValue, polarity) {
  if (maxValue === minValue) return 50;
  const normalised = (value - minValue) / (maxValue - minValue);
  if (polarity === "negative") return Math.round((1 - normalised) * 100);
  return Math.round(normalised * 100);
}

// Calculate overall score for a submission (matches wellbeing report calculation)
function calcOverallScore(submission) {
  if (!questionsData?.categories || !submission.responses) return null;
  const questionMap = buildQuestionMap();

  // Group scores by category (same as wellbeing report)
  const categoryScores = {};
  Object.entries(submission.responses).forEach(([key, value]) => {
    const qInfo = questionMap[key];
    if (!qInfo) return;
    const numValue = parseFloat(value) || 0;
    const maxValue = getPresetMaxValue(qInfo.responseType);
    const minValue = getPresetMinValue(qInfo.responseType);
    const score = calcWellbeingScore(
      numValue,
      minValue,
      maxValue,
      qInfo.polarity,
    );

    const catSlug = slugify(qInfo.categoryTitle);
    if (!categoryScores[catSlug]) categoryScores[catSlug] = [];
    categoryScores[catSlug].push(score);
  });

  // Calculate average per category, then average of categories
  const catAverages = Object.values(categoryScores)
    .map((scores) =>
      Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    )
    .filter((s) => s > 0);

  if (catAverages.length === 0) return null;
  return Math.round(
    catAverages.reduce((a, b) => a + b, 0) / catAverages.length,
  );
}

// Build a map of questionId -> { text, responseType, polarity, categoryTitle, subcategoryTitle, order } from questionsData
function buildQuestionMap() {
  const map = {};
  if (!questionsData?.categories) return map;
  let globalOrder = 0;
  Object.values(questionsData.categories).forEach((cat) => {
    if (cat.questions) {
      cat.questions.forEach((q, i) => {
        const id = `${slugify(cat.title)}-${i}`;
        map[id] = {
          text: q.text,
          responseType: q.responseType,
          polarity: q.polarity || "positive",
          categoryTitle: cat.title,
          subcategoryTitle: null,
          order: globalOrder++,
        };
      });
    }
    if (cat.subcategories) {
      Object.values(cat.subcategories).forEach((sub) => {
        if (sub.questions) {
          sub.questions.forEach((q, i) => {
            const id = `${slugify(sub.title)}-${i}`;
            map[id] = {
              text: q.text,
              responseType: q.responseType,
              polarity: q.polarity || "positive",
              categoryTitle: cat.title,
              subcategoryTitle: sub.title,
              order: globalOrder++,
            };
          });
        }
      });
    }
  });
  return map;
}

async function viewSubmission(armourNumber) {
  const sub = allSubmissions.find((s) => s.armourNumber === armourNumber);
  if (!sub) return;

  // Ensure questions data is loaded
  if (!questionsData) {
    try {
      const data = await apiGetQuestions();
      questionsData = data.questions;
    } catch (err) {
      console.error("Error loading questions for report:", err);
      showModal("Error", "<p>Could not load question data for the report.</p>");
      return;
    }
  }

  const questionMap = buildQuestionMap();

  // Build dynamic categories from questionsData
  const categories = {};
  let colorIdx = 0;

  if (questionsData?.categories) {
    Object.values(questionsData.categories).forEach((cat) => {
      const catSlug = slugify(cat.title);
      categories[catSlug] = {
        title: cat.title,
        color: categoryColors[colorIdx % categoryColors.length],
        items: [],
        subcategories: {},
      };
      colorIdx++;

      if (cat.subcategories) {
        Object.values(cat.subcategories).forEach((sub) => {
          const subSlug = slugify(sub.title);
          categories[catSlug].subcategories[subSlug] = {
            title: sub.title,
            items: [],
          };
        });
      }
    });
  }

  // Map responses to categories with correct normalization using polarity
  Object.entries(sub.responses).forEach(([key, value]) => {
    const qInfo = questionMap[key];
    if (!qInfo) return;

    const numValue = parseFloat(value) || 0;
    const maxValue = getPresetMaxValue(qInfo.responseType);
    const minValue = getPresetMinValue(qInfo.responseType);
    const scorePercent = calcWellbeingScore(
      numValue,
      minValue,
      maxValue,
      qInfo.polarity,
    );
    const catSlug = slugify(qInfo.categoryTitle);

    const item = {
      key,
      text: qInfo.text,
      responseType: qInfo.responseType,
      polarity: qInfo.polarity,
      value: numValue,
      maxValue,
      minValue,
      scorePercent,
      label: getResponseLabel(qInfo.responseType, numValue),
      order: qInfo.order,
    };

    if (categories[catSlug]) {
      if (qInfo.subcategoryTitle) {
        const subSlug = slugify(qInfo.subcategoryTitle);
        if (categories[catSlug].subcategories[subSlug]) {
          categories[catSlug].subcategories[subSlug].items.push(item);
        }
      }
      categories[catSlug].items.push(item);
    }
  });

  // Sort items by questionnaire order
  Object.values(categories).forEach((cat) => {
    cat.items.sort((a, b) => a.order - b.order);
    Object.values(cat.subcategories).forEach((sub) => {
      sub.items.sort((a, b) => a.order - b.order);
    });
  });

  // Calculate category scores
  const categoryScores = {};
  Object.entries(categories).forEach(([catSlug, cat]) => {
    if (cat.items.length === 0) {
      categoryScores[catSlug] = 0;
      return;
    }
    categoryScores[catSlug] = Math.round(
      cat.items.reduce((sum, i) => sum + i.scorePercent, 0) / cat.items.length,
    );
  });

  // Calculate 4-section scores matching server team-stats grouping
  const sectionScores = {
    burnout: { total: 0, count: 0 },
    mental: { total: 0, count: 0 },
    sleep: { total: 0, count: 0 },
    lifestyle: { total: 0, count: 0 },
  };
  Object.entries(categories).forEach(([catSlug, cat]) => {
    const section = getSectionKey(cat.title);
    cat.items.forEach((item) => {
      sectionScores[section].total += item.scorePercent;
      sectionScores[section].count++;
    });
  });
  const radarSectionScores = {};
  Object.entries(sectionScores).forEach(([key, s]) => {
    radarSectionScores[key] = s.count > 0 ? Math.round(s.total / s.count) : 0;
  });

  // Overall score
  const validScores = Object.values(categoryScores).filter((s) => s > 0);
  const overallScore =
    validScores.length > 0
      ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
      : 0;

  const getStatus = (score) => {
    if (score >= 80) return { label: "Excellent", color: "#34d399" };
    if (score >= 60) return { label: "Good", color: "#34d399" };
    if (score >= 40) return { label: "Fair", color: "#fbbf24" };
    if (score >= 20) return { label: "Needs Attention", color: "#ef4444" };
    return { label: "Critical", color: "#ef4444" };
  };

  const overallStatus = getStatus(overallScore);
  const displayName = sub.nickname || armourNumber;

  // Sort categories by score for insights
  const sortedCats = Object.entries(categoryScores)
    .filter(([_, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  const strengths = sortedCats.slice(0, Math.ceil(sortedCats.length / 2));
  const toImprove = sortedCats
    .slice(-Math.ceil(sortedCats.length / 2))
    .reverse();

  // Build the report HTML
  let html = `<div class="wr">`;

  // === TOP BAR: User info ===
  html += `
    <div class="wr-topbar">
      <div class="wr-user">
        <div class="wr-avatar">${escapeHtml(displayName[0].toUpperCase())}</div>
        <div>
          <div class="wr-name">${escapeHtml(displayName)}</div>
          <div class="wr-meta">${teamNames[sub.team] || sub.team} · ${formatDate(sub.submittedAt)}</div>
        </div>
      </div>
    </div>
  `;

  // === SCORE RING + RADAR ROW ===
  html += `
    <div class="wr-hero">
      <div class="wr-ring-wrap">
        <svg class="wr-ring" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="10"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="${overallStatus.color}" stroke-width="10"
            stroke-dasharray="${Math.round(overallScore * 3.267)} 326.7"
            stroke-linecap="round" transform="rotate(-90 60 60)"
            style="transition: stroke-dasharray 0.8s ease;"/>
        </svg>
        <div class="wr-ring-label">
          <span class="wr-ring-value" style="color: ${overallStatus.color};">${overallScore}</span>
          <span class="wr-ring-unit">%</span>
        </div>
        <div class="wr-ring-status" style="color: ${overallStatus.color};">${overallStatus.label}</div>
      </div>
      <div class="wr-radar-wrap">
        <canvas id="submission-radar-canvas" width="320" height="320"></canvas>
      </div>
    </div>
  `;

  // === CATEGORY CARDS with per-question breakdown ===
  html += `<div class="wr-categories">`;
  Object.entries(categories).forEach(([catSlug, cat]) => {
    if (cat.items.length === 0) return;
    const score = categoryScores[catSlug];
    const status = getStatus(score);

    html += `
      <div class="wr-cat">
        <div class="wr-cat-header">
          <div class="wr-cat-color" style="background: ${cat.color};"></div>
          <div class="wr-cat-title">${cat.title}</div>
          <div class="wr-cat-score" style="color: ${status.color};">${score}%</div>
        </div>
        <div class="wr-cat-bar">
          <div class="wr-cat-bar-fill" style="width: ${score}%; background: linear-gradient(90deg, ${cat.color}, ${cat.color}cc);"></div>
        </div>
    `;

    // If has subcategories, group questions under them
    const hasSubcats = Object.keys(cat.subcategories).length > 0;

    if (hasSubcats) {
      // Show top-level questions first (if any)
      const topItems = cat.items.filter((item) => {
        const qInfo = questionMap[item.key];
        return qInfo && !qInfo.subcategoryTitle;
      });
      if (topItems.length > 0) {
        topItems.forEach((item) => {
          html += renderQuestionRow(item, cat.color);
        });
      }

      // Then subcategories
      Object.entries(cat.subcategories).forEach(([subSlug, subcat]) => {
        if (subcat.items.length === 0) return;
        html += `<div class="wr-subcat-label">${subcat.title}</div>`;
        subcat.items.forEach((item) => {
          html += renderQuestionRow(item, cat.color);
        });
      });
    } else {
      cat.items.forEach((item) => {
        html += renderQuestionRow(item, cat.color);
      });
    }

    html += `</div>`;
  });
  html += `</div>`;

  html += `</div>`;

  showModal(`Wellbeing Report`, html, true);

  setTimeout(() => {
    drawSubmissionRadar(radarSectionScores);
  }, 50);
}

function renderQuestionRow(item, color) {
  const barWidth = Math.max(item.scorePercent, 2);
  return `
    <div class="wr-q">
      <div class="wr-q-text">${escapeHtml(item.text)}</div>
      <div class="wr-q-bar-wrap">
        <div class="wr-q-bar">
          <div class="wr-q-bar-fill" style="width: ${barWidth}%; background: ${color};"></div>
        </div>
        <span class="wr-q-val">${item.label}</span>
      </div>
    </div>
  `;
}

function drawSubmissionRadar(scores) {
  const canvas = document.getElementById("submission-radar-canvas");
  if (!canvas) return;

  // Fixed 4-section layout matching server team-stats and user app radar (same order & colors)
  const sections = [
    { key: "burnout", label: "Burnout", color: "rgba(100, 200, 150, 0.8)" },
    { key: "mental", label: "Mental", color: "rgba(100, 150, 255, 0.8)" },
    { key: "sleep", label: "Sleep", color: "rgba(255, 180, 100, 0.8)" },
    { key: "lifestyle", label: "Lifestyle", color: "rgba(200, 100, 200, 0.8)" },
  ];

  const dpr = window.devicePixelRatio || 1;
  const size = 320;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = size + "px";
  canvas.style.height = size + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 55;
  const numPoints = sections.length;
  const angleStep = (Math.PI * 2) / numPoints;

  // Grid circles
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, (radius * i) / 4, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Axis lines + labels
  ctx.font = "11px -apple-system, BlinkMacSystemFont, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  sections.forEach((sec, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.stroke();

    const lx = centerX + Math.cos(angle) * (radius + 28);
    const ly = centerY + Math.sin(angle) * (radius + 28);
    ctx.fillStyle = sec.color;
    ctx.fillText(sec.label, lx, ly);
  });

  // Data polygon
  ctx.beginPath();
  sections.forEach((sec, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const value = (100 - (scores[sec.key] || 0)) / 100;
    const x = centerX + Math.cos(angle) * radius * value;
    const y = centerY + Math.sin(angle) * radius * value;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "rgba(96, 165, 250, 0.2)";
  ctx.fill();
  ctx.strokeStyle = "rgba(96, 165, 250, 0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Data points
  sections.forEach((sec, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const value = (100 - (scores[sec.key] || 0)) / 100;
    const x = centerX + Math.cos(angle) * radius * value;
    const y = centerY + Math.sin(angle) * radius * value;

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = sec.color;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.3)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });
}

async function resetSubmission(armourNumber) {
  if (
    !confirm(
      `Reset submission for ${armourNumber}? This will allow them to submit again this month.`,
    )
  )
    return;

  const month = document.querySelector("[data-month-select]")?.value;

  try {
    const result = await apiResetSubmission(armourNumber, month);
    if (result.error) {
      alert(result.error);
      return;
    }
    loadSubmissions(month);
  } catch (err) {
    console.error("Error resetting submission:", err);
    alert("Error resetting submission");
  }
}

// Month selector change
document
  .querySelector("[data-month-select]")
  ?.addEventListener("change", (e) => {
    loadSubmissions(e.target.value);
  });

// Refresh submissions button
document
  .querySelector("[data-refresh-submissions]")
  ?.addEventListener("click", () => {
    const month = document.querySelector("[data-month-select]")?.value;
    loadSubmissions(month);
  });

// Export CSV
document.querySelector("[data-export-csv]")?.addEventListener("click", () => {
  if (allSubmissions.length === 0) {
    alert("No submissions to export");
    return;
  }

  // Get all unique response keys
  const allKeys = new Set();
  allSubmissions.forEach((sub) => {
    Object.keys(sub.responses || {}).forEach((key) => allKeys.add(key));
  });

  const headers = [
    "Armour Number",
    "Team",
    "Submitted At",
    ...Array.from(allKeys),
  ];
  const rows = allSubmissions.map((sub) => {
    const row = [
      sub.armourNumber,
      sub.team,
      new Date(sub.submittedAt).toISOString(),
    ];
    allKeys.forEach((key) => {
      row.push(sub.responses?.[key] ?? "");
    });
    return row;
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `submissions-${document.querySelector("[data-month-select]").value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

// Questions
let questionsData = null;

async function loadQuestions() {
  try {
    const data = await apiGetQuestions();
    questionsData = data.questions;
    renderQuestions(questionsData);
  } catch (err) {
    console.error("Error loading questions:", err);
  }
}

function getResponsePresetOptions() {
  if (!questionsData?.responsePresets) return "";
  return Object.entries(questionsData.responsePresets)
    .map(([key, preset]) => {
      const desc =
        preset.type === "slider"
          ? `Slider ${preset.min}-${preset.max}`
          : preset.options?.map((o) => o.label).join(", ");
      return `<option value="${key}">${escapeHtml(preset.name)} — ${desc}</option>`;
    })
    .join("");
}

function renderQuestions(questions) {
  const editor = document.querySelector("[data-questions-editor]");

  if (!questions || !questions.categories) {
    editor.innerHTML = '<p class="empty-state">No questions found</p>';
    return;
  }

  const isMaster = currentAdmin.isMaster;
  let html = "";
  let questionNum = 0;

  // Categories
  Object.entries(questions.categories).forEach(([catKey, category]) => {
    const catDragAttrs = isMaster
      ? `draggable="true" ondragstart="onDragStart(event, 'category')" ondragend="onDragEnd(event)"`
      : "";
    const qCount =
      (category.questions?.length || 0) +
      Object.values(category.subcategories || {}).reduce(
        (sum, sub) => sum + (sub.questions?.length || 0),
        0,
      );

    html += `
      <details class="qb-category" data-category="${catKey}" ${catDragAttrs}>
        <summary class="qb-category-summary" onclick="event.stopPropagation()">
          ${isMaster ? '<span class="qb-drag" title="Drag to reorder section">⋮⋮</span>' : ""}
          <span class="qb-chevron">▶</span>
          <span class="qb-cat-label">${escapeHtml(category.title)}</span>
          <span class="qb-cat-count">${qCount} question${qCount !== 1 ? "s" : ""}</span>
          ${isMaster ? `<button class="qb-delete-cat" onclick="event.stopPropagation(); deleteCategory('${catKey}')" title="Delete section">✕</button>` : ""}
        </summary>
        <div class="qb-category-body">
          <div class="qb-category-fields">
            <input type="text" class="qb-cat-title" value="${escapeHtml(category.title)}" 
              data-category="${catKey}" data-field="title" ${!isMaster ? "disabled" : ""} placeholder="Section title" />
            <input type="text" class="qb-cat-desc" value="${escapeHtml(category.description || "")}" 
              data-category="${catKey}" data-field="description" ${!isMaster ? "disabled" : ""} placeholder="Brief description (optional)" />
          </div>
          <div class="qb-questions" data-questions-list="${catKey}">
    `;

    if (category.questions) {
      category.questions.forEach((q, i) => {
        questionNum++;
        html += renderQuestionItem(catKey, null, i, q, isMaster, questionNum);
      });
    }

    html += `</div>`;

    if (isMaster) {
      html += `<button class="qb-add-question" onclick="addQuestion('${catKey}')">+ Add Question</button>`;
    }

    // Subcategories
    if (category.subcategories) {
      Object.entries(category.subcategories).forEach(([subKey, sub]) => {
        html += `
          <div class="qb-subcategory" data-subcategory="${subKey}">
            <div class="qb-sub-header">
              <input type="text" class="qb-sub-title" value="${escapeHtml(sub.title)}" 
                data-category="${catKey}" data-subcategory="${subKey}" data-field="title" ${!isMaster ? "disabled" : ""} placeholder="Subsection title" />
              ${isMaster ? `<button class="qb-delete-cat" onclick="deleteSubcategory('${catKey}', '${subKey}')" title="Delete subsection">✕</button>` : ""}
            </div>
            <input type="text" class="qb-sub-desc" value="${escapeHtml(sub.description || "")}" 
              data-category="${catKey}" data-subcategory="${subKey}" data-field="description" ${!isMaster ? "disabled" : ""} placeholder="Brief description (optional)" />
            <div class="qb-questions" data-questions-list="${catKey}-${subKey}">
        `;

        if (sub.questions) {
          sub.questions.forEach((q, i) => {
            questionNum++;
            html += renderQuestionItem(
              catKey,
              subKey,
              i,
              q,
              isMaster,
              questionNum,
            );
          });
        }

        html += `</div>`;

        if (isMaster) {
          html += `<button class="qb-add-question" onclick="addQuestion('${catKey}', '${subKey}')">+ Add Question</button>`;
        }

        html += `</div>`;
      });
    }

    if (isMaster) {
      html += `<button class="qb-add-sub" onclick="addSubcategory('${catKey}')">+ Add Subsection</button>`;
    }

    html += `</div></details>`;
  });

  if (isMaster) {
    html += `<button class="qb-add-category" onclick="addCategory()">+ Add Section</button>`;
  }

  // Response Presets (collapsible advanced section)
  if (isMaster) {
    html += `
      <details class="qb-presets-section">
        <summary>Response Types (Advanced)</summary>
        <div class="qb-presets-body">
          <p class="qb-presets-hint">Response types define the answer options shown for each question.</p>
          <div class="qb-presets-list">
    `;

    if (questions.responsePresets) {
      Object.entries(questions.responsePresets).forEach(([key, preset]) => {
        html += renderPresetCard(key, preset);
      });
    }

    html += `
          </div>
          <button class="qb-add-question" onclick="addResponsePreset()">+ Add Response Type</button>
        </div>
      </details>
    `;
  }

  editor.innerHTML = html;

  // Restore open/closed state of categories
  restoreOpenCategories();

  // Auto-resize textareas to fit content
  editor.querySelectorAll(".qb-question-text").forEach((ta) => {
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
    ta.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
    });
  });

  // Setup drag and drop after rendering
  setTimeout(() => setupDragAndDrop(), 0);
}

function renderPresetCard(key, preset) {
  const isButtons = preset.type === "buttons";
  let preview = "";

  if (isButtons && preset.options) {
    preview = preset.options.map((opt) => opt.label).join("  →  ");
  } else if (preset.type === "slider") {
    preview = `Slider: ${preset.min} → ${preset.max}`;
  }

  return `
    <div class="qb-preset" data-preset="${key}">
      <div class="qb-preset-info">
        <strong>${escapeHtml(preset.name)}</strong>
        <span class="qb-preset-preview">${preview}</span>
      </div>
      <div class="qb-preset-actions">
        <button class="btn btn-sm btn-secondary" onclick="editPreset('${key}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deletePreset('${key}')">✕</button>
      </div>
    </div>
  `;
}

function renderQuestionItem(catKey, subKey, index, question, isMaster, num) {
  const questionText = typeof question === "string" ? question : question.text;
  const responseType =
    typeof question === "object" ? question.responseType : "agreement_5";
  const polarity =
    typeof question === "object" ? question.polarity || "positive" : "positive";
  const dataAttrs = subKey
    ? `data-category="${catKey}" data-subcategory="${subKey}" data-index="${index}"`
    : `data-category="${catKey}" data-index="${index}"`;
  const dragAttrs = isMaster
    ? `draggable="true" ondragstart="onDragStart(event, 'question')" ondragend="onDragEnd(event)"`
    : "";

  return `
    <div class="qb-question" ${dataAttrs} ${dragAttrs}>
      ${isMaster ? '<span class="qb-drag" title="Drag to reorder">⋮⋮</span>' : ""}
      <div class="qb-question-body">
        <div class="qb-question-top">
          <span class="qb-num">${num}</span>
          <textarea class="qb-question-text" rows="1" ${dataAttrs} data-field="text" 
            ${!isMaster ? "disabled" : ""} placeholder="Enter question text...">${escapeHtml(questionText)}</textarea>
          ${isMaster ? `<button class="qb-delete-q" onclick="deleteQuestion('${catKey}', ${subKey ? `'${subKey}'` : "null"}, ${index})" title="Delete">✕</button>` : ""}
        </div>
        <div class="qb-question-bottom">
          <label class="qb-response-label">Response:</label>
          <select class="qb-response-select" ${dataAttrs} data-field="responseType" ${!isMaster ? "disabled" : ""}>
            ${getResponsePresetOptions().replace(`value="${responseType}"`, `value="${responseType}" selected`)}
          </select>
          <label class="qb-response-label" style="margin-left: 12px;">Polarity:</label>
          <select class="qb-polarity-select" ${dataAttrs} data-field="polarity" ${!isMaster ? "disabled" : ""}>
            <option value="positive" ${polarity === "positive" ? "selected" : ""}>+ Positive</option>
            <option value="negative" ${polarity === "negative" ? "selected" : ""}>− Negative</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

// Question Management Functions
// Track which categories are open
let openCategories = new Set();

function getOpenCategories() {
  document.querySelectorAll(".qb-category[open]").forEach((el) => {
    openCategories.add(el.dataset.category);
  });
}

function restoreOpenCategories() {
  openCategories.forEach((catKey) => {
    const el = document.querySelector(
      `.qb-category[data-category="${catKey}"]`,
    );
    if (el) el.setAttribute("open", "");
  });
}

function addCategory() {
  collectQuestionsData();
  getOpenCategories();
  const key = "category_" + Date.now();
  questionsData.categories[key] = {
    title: "New Category",
    description: "",
    questions: [],
  };
  openCategories.add(key);
  renderQuestions(questionsData);
}

function deleteCategory(catKey) {
  if (
    !confirm(
      `Delete category "${questionsData.categories[catKey]?.title}"? This will remove all questions in it.`,
    )
  )
    return;
  collectQuestionsData();
  getOpenCategories();
  openCategories.delete(catKey);
  delete questionsData.categories[catKey];
  renderQuestions(questionsData);
}

function addSubcategory(catKey) {
  collectQuestionsData();
  getOpenCategories();
  openCategories.add(catKey);
  const key = "subcategory_" + Date.now();
  if (!questionsData.categories[catKey].subcategories) {
    questionsData.categories[catKey].subcategories = {};
  }
  questionsData.categories[catKey].subcategories[key] = {
    title: "New Subcategory",
    description: "",
    questions: [],
  };
  renderQuestions(questionsData);
}

function deleteSubcategory(catKey, subKey) {
  if (
    !confirm(
      `Delete subcategory "${questionsData.categories[catKey]?.subcategories?.[subKey]?.title}"?`,
    )
  )
    return;
  collectQuestionsData();
  getOpenCategories();
  delete questionsData.categories[catKey].subcategories[subKey];
  renderQuestions(questionsData);
}

function addQuestion(catKey, subKey = null) {
  collectQuestionsData();
  getOpenCategories();
  openCategories.add(catKey);
  const newQuestion = { text: "", responseType: "agreement_5" };
  if (subKey) {
    questionsData.categories[catKey].subcategories[subKey].questions.push(
      newQuestion,
    );
  } else {
    if (!questionsData.categories[catKey].questions) {
      questionsData.categories[catKey].questions = [];
    }
    questionsData.categories[catKey].questions.push(newQuestion);
  }
  renderQuestions(questionsData);
}

function deleteQuestion(catKey, subKey, index) {
  if (!confirm("Delete this question?")) return;
  collectQuestionsData();
  getOpenCategories();
  if (subKey) {
    questionsData.categories[catKey].subcategories[subKey].questions.splice(
      index,
      1,
    );
  } else {
    questionsData.categories[catKey].questions.splice(index, 1);
  }
  renderQuestions(questionsData);
}

function moveQuestion(catKey, subKey, index, direction) {
  const questions = subKey
    ? questionsData.categories[catKey].subcategories[subKey].questions
    : questionsData.categories[catKey].questions;

  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= questions.length) return;

  [questions[index], questions[newIndex]] = [
    questions[newIndex],
    questions[index],
  ];
  renderQuestions(questionsData);
}

// Drag and Drop functionality
let draggedElement = null;
let dragType = null;

window.onDragStart = function (e, type) {
  draggedElement = e.target.closest(
    ".qb-question, .qb-category, .qb-subcategory",
  );
  dragType = type;
  draggedElement.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", "");
};

window.onDragEnd = function (e) {
  if (draggedElement) {
    draggedElement.classList.remove("dragging");
  }
  document
    .querySelectorAll(".drag-over")
    .forEach((el) => el.classList.remove("drag-over"));
  draggedElement = null;
  dragType = null;
};

function setupDragAndDrop() {
  const editor = document.querySelector("[data-questions-editor]");
  if (!editor) return;

  // Question drag and drop
  document.querySelectorAll(".qb-questions").forEach((list) => {
    list.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (dragType !== "question") return;

      const afterElement = getDragAfterElement(list, e.clientY, ".qb-question");
      const draggable = draggedElement;

      if (afterElement == null) {
        list.appendChild(draggable);
      } else {
        list.insertBefore(draggable, afterElement);
      }
    });

    list.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragType !== "question") return;

      collectQuestionsData();

      const listKey = list.dataset.questionsList;
      const [catKey, subKey] = listKey.includes("-")
        ? listKey.split("-")
        : [listKey, null];

      const items = list.querySelectorAll(".qb-question");
      const newOrder = [];

      items.forEach((item) => {
        const idx = parseInt(item.dataset.index);
        const questions = subKey
          ? questionsData.categories[catKey].subcategories[subKey].questions
          : questionsData.categories[catKey].questions;
        if (questions[idx]) {
          newOrder.push(questions[idx]);
        }
      });

      if (subKey) {
        questionsData.categories[catKey].subcategories[subKey].questions =
          newOrder;
      } else {
        questionsData.categories[catKey].questions = newOrder;
      }

      renderQuestions(questionsData);
    });
  });

  // Category drag and drop
  editor.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (dragType !== "category") return;

    const afterElement = getDragAfterElement(editor, e.clientY, ".qb-category");
    const draggable = draggedElement;

    if (afterElement == null) {
      // Insert before the add-category button or presets section
      const addBtn = editor.querySelector(".qb-add-category");
      if (addBtn) {
        editor.insertBefore(draggable, addBtn);
      } else {
        editor.appendChild(draggable);
      }
    } else {
      editor.insertBefore(draggable, afterElement);
    }
  });

  editor.addEventListener("drop", (e) => {
    e.preventDefault();
    if (dragType !== "category") return;

    collectQuestionsData();

    const blocks = editor.querySelectorAll(".qb-category");
    const newCategories = {};

    blocks.forEach((block) => {
      const catKey = block.dataset.category;
      if (questionsData.categories[catKey]) {
        newCategories[catKey] = questionsData.categories[catKey];
      }
    });

    questionsData.categories = newCategories;
    renderQuestions(questionsData);
  });
}

function getDragAfterElement(container, y, selector = ".qb-question") {
  const draggableElements = [
    ...container.querySelectorAll(`${selector}:not(.dragging)`),
  ];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY },
  ).element;
}

// Preset Management Functions
function addResponsePreset() {
  const key = "preset_" + Date.now();
  if (!questionsData.responsePresets) {
    questionsData.responsePresets = {};
  }
  questionsData.responsePresets[key] = {
    name: "New Preset",
    type: "buttons",
    options: [
      { label: "Option 1", value: 1 },
      { label: "Option 2", value: 2 },
      { label: "Option 3", value: 3 },
    ],
  };
  renderQuestions(questionsData);
  editPreset(key);
}

function deletePreset(key) {
  if (!confirm(`Delete preset "${questionsData.responsePresets[key]?.name}"?`))
    return;
  delete questionsData.responsePresets[key];
  renderQuestions(questionsData);
}

function editPreset(key) {
  const preset = questionsData.responsePresets[key];
  if (!preset) return;

  const isSlider = preset.type === "slider";
  let optionsHtml = "";

  if (!isSlider && preset.options) {
    optionsHtml = preset.options
      .map(
        (opt, i) => `
      <div class="preset-option-row">
        <input type="text" class="option-label" value="${escapeHtml(opt.label)}" placeholder="Label" data-index="${i}" />
        <input type="number" class="option-value" value="${opt.value}" placeholder="Value" data-index="${i}" />
        <button class="btn btn-sm btn-danger" onclick="removePresetOption(${i})">×</button>
      </div>
    `,
      )
      .join("");
  }

  const html = `
    <form id="preset-form">
      <div class="form-field">
        <label>Preset Name</label>
        <input type="text" id="preset-name" value="${escapeHtml(preset.name)}" required />
      </div>
      <div class="form-field">
        <label>Type</label>
        <select id="preset-type">
          <option value="buttons" ${preset.type === "buttons" ? "selected" : ""}>Buttons</option>
          <option value="slider" ${preset.type === "slider" ? "selected" : ""}>Slider</option>
        </select>
      </div>
      <div id="buttons-config" class="${isSlider ? "hidden" : ""}">
        <label>Options</label>
        <div id="preset-options">${optionsHtml}</div>
        <button type="button" class="btn btn-sm btn-secondary" onclick="addPresetOption()">+ Add Option</button>
      </div>
      <div id="slider-config" class="${!isSlider ? "hidden" : ""}">
        <div class="form-row">
          <div class="form-field">
            <label>Min</label>
            <input type="number" id="slider-min" value="${preset.min || 1}" />
          </div>
          <div class="form-field">
            <label>Max</label>
            <input type="number" id="slider-max" value="${preset.max || 10}" />
          </div>
          <div class="form-field">
            <label>Step</label>
            <input type="number" id="slider-step" value="${preset.step || 1}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>Min Label</label>
            <input type="text" id="slider-min-label" value="${preset.labels?.[String(preset.min)] || ""}" placeholder="e.g. Low" />
          </div>
          <div class="form-field">
            <label>Max Label</label>
            <input type="text" id="slider-max-label" value="${preset.labels?.[String(preset.max)] || ""}" placeholder="e.g. High" />
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn-primary">Save Preset</button>
      </div>
    </form>
  `;

  showModal("Edit Response Preset", html);

  // Toggle between buttons and slider config
  document.getElementById("preset-type").addEventListener("change", (e) => {
    document
      .getElementById("buttons-config")
      .classList.toggle("hidden", e.target.value === "slider");
    document
      .getElementById("slider-config")
      .classList.toggle("hidden", e.target.value === "buttons");
  });

  // Store current editing preset key
  window.currentEditingPreset = key;
  window.currentPresetOptions = preset.options ? [...preset.options] : [];

  document.getElementById("preset-form").addEventListener("submit", (e) => {
    e.preventDefault();
    savePreset();
  });
}

window.addPresetOption = function () {
  window.currentPresetOptions.push({
    label: "",
    value: window.currentPresetOptions.length + 1,
  });
  updatePresetOptionsUI();
};

window.removePresetOption = function (index) {
  window.currentPresetOptions.splice(index, 1);
  updatePresetOptionsUI();
};

function updatePresetOptionsUI() {
  const container = document.getElementById("preset-options");
  container.innerHTML = window.currentPresetOptions
    .map(
      (opt, i) => `
    <div class="preset-option-row">
      <input type="text" class="option-label" value="${escapeHtml(opt.label)}" placeholder="Label" data-index="${i}" />
      <input type="number" class="option-value" value="${opt.value}" placeholder="Value" data-index="${i}" />
      <button type="button" class="btn btn-sm btn-danger" onclick="removePresetOption(${i})">×</button>
    </div>
  `,
    )
    .join("");
}

function savePreset() {
  const key = window.currentEditingPreset;
  const type = document.getElementById("preset-type").value;

  // Collect option values from inputs
  document.querySelectorAll(".option-label").forEach((input, i) => {
    if (window.currentPresetOptions[i]) {
      window.currentPresetOptions[i].label = input.value;
    }
  });
  document.querySelectorAll(".option-value").forEach((input, i) => {
    if (window.currentPresetOptions[i]) {
      window.currentPresetOptions[i].value = parseInt(input.value) || i + 1;
    }
  });

  if (type === "buttons") {
    questionsData.responsePresets[key] = {
      name: document.getElementById("preset-name").value,
      type: "buttons",
      options: window.currentPresetOptions,
    };
  } else {
    const min = parseInt(document.getElementById("slider-min").value) || 1;
    const max = parseInt(document.getElementById("slider-max").value) || 10;
    questionsData.responsePresets[key] = {
      name: document.getElementById("preset-name").value,
      type: "slider",
      min,
      max,
      step: parseInt(document.getElementById("slider-step").value) || 1,
      labels: {
        [min]: document.getElementById("slider-min-label").value,
        [max]: document.getElementById("slider-max-label").value,
      },
    };
  }

  hideModal();
  renderQuestions(questionsData);
}

// Collect all data before saving
function collectQuestionsData() {
  // Collect category titles and descriptions
  document.querySelectorAll(".qb-cat-title").forEach((input) => {
    const cat = input.dataset.category;
    if (questionsData.categories[cat]) {
      questionsData.categories[cat].title = input.value;
    }
  });

  document.querySelectorAll(".qb-cat-desc").forEach((input) => {
    const cat = input.dataset.category;
    if (questionsData.categories[cat]) {
      questionsData.categories[cat].description = input.value;
    }
  });

  // Collect subcategory titles and descriptions
  document.querySelectorAll(".qb-sub-title").forEach((input) => {
    const cat = input.dataset.category;
    const sub = input.dataset.subcategory;
    if (questionsData.categories[cat]?.subcategories?.[sub]) {
      questionsData.categories[cat].subcategories[sub].title = input.value;
    }
  });

  document.querySelectorAll(".qb-sub-desc").forEach((input) => {
    const cat = input.dataset.category;
    const sub = input.dataset.subcategory;
    if (questionsData.categories[cat]?.subcategories?.[sub]) {
      questionsData.categories[cat].subcategories[sub].description =
        input.value;
    }
  });

  // Collect questions
  document.querySelectorAll(".qb-question").forEach((item) => {
    const cat = item.dataset.category;
    const sub = item.dataset.subcategory;
    const index = parseInt(item.dataset.index);

    const textInput = item.querySelector(".qb-question-text");
    const typeSelect = item.querySelector(".qb-response-select");

    if (!textInput || !typeSelect) return;

    const polaritySelect = item.querySelector(".qb-polarity-select");
    const questionObj = {
      text: textInput.value,
      responseType: typeSelect.value,
      polarity: polaritySelect ? polaritySelect.value : "positive",
    };

    if (sub) {
      if (questionsData.categories[cat]?.subcategories?.[sub]?.questions) {
        questionsData.categories[cat].subcategories[sub].questions[index] =
          questionObj;
      }
    } else {
      if (questionsData.categories[cat]?.questions) {
        questionsData.categories[cat].questions[index] = questionObj;
      }
    }
  });
}

document
  .querySelector("[data-save-questions]")
  ?.addEventListener("click", async () => {
    if (!currentAdmin.isMaster) return;

    collectQuestionsData();

    try {
      const result = await apiUpdateQuestions(questionsData);
      if (result.error) {
        alert(result.error);
        return;
      }
      alert("Questions saved successfully");
    } catch (err) {
      console.error("Error saving questions:", err);
      alert("Error saving questions");
    }
  });

// Export questions as JSON backup
document
  .querySelector("[data-export-questions]")
  ?.addEventListener("click", async () => {
    try {
      const data = await apiGetQuestions();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `armourcare-questions-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exporting questions:", err);
      alert("Error exporting questions");
    }
  });

// Restore questions from JSON backup
document
  .querySelector("[data-restore-file]")
  ?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (
      !confirm(
        `Restore questions from "${file.name}"?\n\nThis will replace all current questions. Make sure you have exported a backup first.`,
      )
    ) {
      e.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const questions = JSON.parse(text);

      if (!questions.categories || !questions.responsePresets) {
        alert(
          "Invalid questions file. Must contain categories and responsePresets.",
        );
        e.target.value = "";
        return;
      }

      const result = await apiUpdateQuestions(questions);
      if (result.error) {
        alert(result.error);
      } else {
        alert("Questions restored successfully");
        await loadQuestions();
      }
    } catch (err) {
      console.error("Error restoring questions:", err);
      alert("Error restoring questions: " + err.message);
    }

    e.target.value = "";
  });

// Security
const securityEventLabels = {
  user_registered: "Registration",
  user_login: "User Login",
  login_failed: "Failed Login",
  admin_login: "Admin Login",
  admin_login_failed: "Failed Admin Login",
  password_changed: "Password Changed",
  admin_created: "Admin Created",
  admin_updated: "Admin Updated",
  admin_deleted: "Admin Deleted",
  user_deleted: "User Deleted",
  submission_reset: "Submission Reset",
  logs_cleared: "Logs Cleared",
};

function getEventBadgeClass(event) {
  if (event.includes("failed")) return "event-danger";
  if (event.includes("deleted") || event === "submission_reset")
    return "event-warning";
  if (event.includes("login")) return "event-success";
  return "event-info";
}

function formatSecurityTime(ts) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
  );
}

function getSecurityDetails(log) {
  const parts = [];

  // Better feedback for failed logins
  if (log.reason === "unknown_user") {
    parts.push(
      "User not registered — may have mistyped Armour Number or not signed up yet",
    );
  } else if (log.reason === "wrong_password") {
    parts.push("Incorrect password — user exists but entered wrong password");
  } else if (log.reason === "unknown_admin") {
    parts.push("Admin account not found");
  }

  if (log.team) parts.push(`Team ${log.team}`);
  if (log.by) parts.push(`By ${log.by}`);
  if (log.target && log.by) parts.push(`Target: ${log.target}`);
  if (log.selfChange) parts.push("Self");
  if (log.month) parts.push(log.month);
  if (log.changes) {
    const changed = Object.entries(log.changes)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (changed.length) parts.push(changed.join(", "));
  }
  return parts.join(" · ") || "—";
}

async function loadSecurityLogs() {
  try {
    const eventFilter =
      document.querySelector("[data-security-event-filter]")?.value || "";
    const userFilter =
      document.querySelector("[data-security-user-filter]")?.value || "";
    const periodHours =
      document.querySelector("[data-security-period-filter]")?.value || "24";
    const data = await apiGetSecurityLogs(eventFilter, userFilter, periodHours);

    if (data.error) {
      console.error("Security logs error:", data.error);
      return;
    }

    // Update summary cards based on selected time period
    const s = data.summary || {};
    const el = (sel) => document.querySelector(sel);
    el("[data-sec-total]").textContent = s.totalInPeriod || 0;
    el("[data-sec-failed]").textContent = s.failedLogins || 0;
    el("[data-sec-registrations]").textContent = s.registrations || 0;
    el("[data-sec-logins]").textContent = s.userLogins || 0;
    el("[data-sec-admin-actions]").textContent = s.adminActions || 0;
    el("[data-sec-ips]").textContent = s.uniqueIPs || 0;

    // Highlight failed logins in red if > 0
    el("[data-sec-failed]").style.color = s.failedLogins > 0 ? "#ef4444" : "";

    const tbody = document.querySelector("[data-security-logs]");
    const emptyEl = document.querySelector("[data-security-empty]");
    const logs = data.logs || [];

    if (logs.length === 0) {
      tbody.innerHTML = "";
      emptyEl?.classList.remove("hidden");
      return;
    }

    emptyEl?.classList.add("hidden");
    tbody.innerHTML = logs
      .map((log) => {
        const user = log.user || log.target || log.by || "—";
        const badgeClass = getEventBadgeClass(log.event);
        const label = securityEventLabels[log.event] || log.event;
        const details = getSecurityDetails(log);
        const ip = log.ip || "—";

        return `<tr>
        <td style="white-space:nowrap">${formatSecurityTime(log.timestamp)}</td>
        <td><span class="security-event-badge ${badgeClass}">${escapeHtml(label)}</span></td>
        <td>${escapeHtml(user)}</td>
        <td>${escapeHtml(details)}</td>
        <td><span style="font-family:monospace;font-size:0.8rem;opacity:0.6">${escapeHtml(ip)}</span></td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteSecurityLog('${log.id}')">Delete</button></td>
      </tr>`;
      })
      .join("");
  } catch (err) {
    console.error("Error loading security logs:", err);
  }
}

async function deleteSecurityLog(id) {
  if (!confirm("Delete this security event?")) return;
  try {
    await apiDeleteSecurityLog(id);
    await loadSecurityLogs();
  } catch (err) {
    console.error("Error deleting security log:", err);
  }
}

document
  .querySelector("[data-security-refresh]")
  ?.addEventListener("click", () => loadSecurityLogs());
document
  .querySelector("[data-security-event-filter]")
  ?.addEventListener("change", () => loadSecurityLogs());
document
  .querySelector("[data-security-period-filter]")
  ?.addEventListener("change", () => loadSecurityLogs());

document
  .querySelector("[data-security-clear-all]")
  ?.addEventListener("click", async () => {
    if (!confirm("Clear ALL security events? This cannot be undone.")) return;
    try {
      await fetch("/api/admin/security-logs", {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      await loadSecurityLogs();
    } catch (err) {
      console.error("Error clearing security logs:", err);
    }
  });

let securityUserFilterTimeout;
document
  .querySelector("[data-security-user-filter]")
  ?.addEventListener("input", () => {
    clearTimeout(securityUserFilterTimeout);
    securityUserFilterTimeout = setTimeout(() => loadSecurityLogs(), 400);
  });

// Admins
async function loadAdmins() {
  if (!currentAdmin.isMaster) return;

  try {
    const data = await apiGetAdmins();
    renderAdmins(data.admins || []);
  } catch (err) {
    console.error("Error loading admins:", err);
  }
}

function renderAdmins(admins) {
  const tbody = document.querySelector("[data-admins-table]");
  tbody.innerHTML = "";

  admins.forEach((admin) => {
    const tr = document.createElement("tr");
    const teamsDisplay = admin.teams?.includes("all")
      ? "All Teams"
      : admin.teams?.map((t) => teamEntryLabel(t)).join(", ") || "None";

    tr.innerHTML = `
      <td>
        <code>${admin.armourNumber}</code>
        ${admin.nickname ? `<div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(admin.nickname)}</div>` : ""}
      </td>
      <td>${admin.isMaster ? '<span style="color: var(--accent);">Master</span>' : "Admin"}</td>
      <td>${teamsDisplay}</td>
      <td>
        <button class="btn btn-secondary btn-sm" onclick="showChangePasswordModal('${admin.armourNumber}')">Password</button>
        ${
          !admin.isMaster
            ? `
          <button class="btn btn-secondary btn-sm" onclick="editAdmin('${admin.armourNumber}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAdmin('${admin.armourNumber}')">Delete</button>
        `
            : ""
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

document.querySelector("[data-add-admin]")?.addEventListener("click", () => {
  showAdminModal();
});

function showAdminModal(admin = null) {
  const isEdit = !!admin;

  const hasAll = admin?.teams?.includes("all");
  let teamsHtml =
    `
    <label class="checkbox-label ${hasAll ? "checked" : ""}" data-team="all">
      <input type="checkbox" ${hasAll ? "checked" : ""} />
      All Teams
    </label>
  ` +
    allTeams
      .map(
        (team) => `
    <label class="checkbox-label ${hasAll || admin?.teams?.includes(team) ? "checked" : ""}" data-team="${team}">
      <input type="checkbox" ${hasAll || admin?.teams?.includes(team) ? "checked" : ""} />
      ${teamNames[team]}
    </label>
  `,
      )
      .join("");

  // Sub-team scoping for team 2 (only relevant when team 2 itself is not checked)
  const subTeamsHtml = SUB_TEAMS.map((st) => {
    const key = `${SUBTEAM_PARENT}:${st}`;
    const checked = !hasAll && admin?.teams?.includes(key);
    return `
    <label class="checkbox-label ${checked ? "checked" : ""}" data-subteam="${key}">
      <input type="checkbox" ${checked ? "checked" : ""} />
      ${subTeamLabel(st)}
    </label>
  `;
  }).join("");

  const html = `
    <form id="admin-form">
      <div class="form-field">
        <label>Armour Number</label>
        <input type="text" id="admin-armour" value="${admin?.armourNumber || ""}" ${isEdit ? "disabled" : "required"} />
      </div>
      <div class="form-field">
        <label>Nickname</label>
        <input type="text" id="admin-nickname" value="${escapeHtml(admin?.nickname || "")}" placeholder="e.g. John Smith" />
      </div>
      <div class="form-field">
        <label>Password ${isEdit ? "(leave blank to keep current)" : ""}</label>
        <input type="password" id="admin-password" ${isEdit ? "" : "required"} />
      </div>
      <div class="form-field">
        <label>Teams</label>
        <div class="checkbox-group" id="teams-group">
          ${teamsHtml}
        </div>
      </div>
      <div class="form-field">
        <label>Team 2 Sub-teams (only if Team 2 is not fully selected)</label>
        <div class="checkbox-group" id="subteams-group">
          ${subTeamsHtml}
        </div>
      </div>
      <div class="form-field">
        <label>Permissions</label>
        <div class="checkbox-group" id="perms-group">
          <label class="checkbox-label ${admin?.permissions?.questions ? "checked" : ""}" data-perm="questions">
            <input type="checkbox" ${admin?.permissions?.questions ? "checked" : ""} />
            Question Builder
          </label>
          <label class="checkbox-label ${admin?.permissions?.notifications ? "checked" : ""}" data-perm="notifications">
            <input type="checkbox" ${admin?.permissions?.notifications ? "checked" : ""} />
            Notifications
          </label>
          <label class="checkbox-label ${admin?.permissions?.security ? "checked" : ""}" data-perm="security">
            <input type="checkbox" ${admin?.permissions?.security ? "checked" : ""} />
            Security
          </label>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn-primary">${isEdit ? "Update" : "Add"} Admin</button>
      </div>
    </form>
  `;

  showModal(isEdit ? "Edit Admin" : "Add Admin", html);

  // Setup checkbox toggles
  const allTeamsLabel = document.querySelector(
    '#teams-group [data-team="all"]',
  );
  const teamLabels = document.querySelectorAll(
    '#teams-group [data-team]:not([data-team="all"])',
  );

  function syncAllTeamsCheckbox() {
    const allChecked = Array.from(teamLabels).every(
      (l) => l.querySelector("input").checked,
    );
    const allCb = allTeamsLabel.querySelector("input");
    allCb.checked = allChecked;
    allTeamsLabel.classList.toggle("checked", allChecked);
  }

  allTeamsLabel.addEventListener("click", () => {
    const cb = allTeamsLabel.querySelector("input");
    cb.checked = !cb.checked;
    allTeamsLabel.classList.toggle("checked", cb.checked);
    teamLabels.forEach((label) => {
      label.querySelector("input").checked = cb.checked;
      label.classList.toggle("checked", cb.checked);
    });
  });

  teamLabels.forEach((label) => {
    label.addEventListener("click", () => {
      const checkbox = label.querySelector("input");
      checkbox.checked = !checkbox.checked;
      label.classList.toggle("checked", checkbox.checked);
      syncAllTeamsCheckbox();
    });
  });

  document
    .querySelectorAll("#subteams-group .checkbox-label")
    .forEach((label) => {
      label.addEventListener("click", () => {
        const checkbox = label.querySelector("input");
        checkbox.checked = !checkbox.checked;
        label.classList.toggle("checked", checkbox.checked);
      });
    });

  document.querySelectorAll("#perms-group .checkbox-label").forEach((label) => {
    label.addEventListener("click", () => {
      const checkbox = label.querySelector("input");
      checkbox.checked = !checkbox.checked;
      label.classList.toggle("checked", checkbox.checked);
    });
  });

  // Form submit
  document
    .getElementById("admin-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const armourNumber = document.getElementById("admin-armour").value;
      const nickname = document.getElementById("admin-nickname").value;
      const password = document.getElementById("admin-password").value;
      const allChecked = document.querySelector(
        '#teams-group [data-team="all"] input',
      )?.checked;
      let teams = allChecked
        ? ["all"]
        : Array.from(
            document.querySelectorAll(
              '#teams-group [data-team]:not([data-team="all"]) input:checked',
            ),
          ).map((cb) => cb.closest(".checkbox-label").dataset.team);
      // Add sub-team scopes unless full team 2 (or all) is already granted
      if (!allChecked && !teams.includes(SUBTEAM_PARENT)) {
        const subTeamScopes = Array.from(
          document.querySelectorAll("#subteams-group input:checked"),
        ).map((cb) => cb.closest(".checkbox-label").dataset.subteam);
        teams = teams.concat(subTeamScopes);
      }
      const permissions = {
        questions: !!document.querySelector(
          '#perms-group [data-perm="questions"] input',
        )?.checked,
        notifications: !!document.querySelector(
          '#perms-group [data-perm="notifications"] input',
        )?.checked,
        security: !!document.querySelector(
          '#perms-group [data-perm="security"] input',
        )?.checked,
      };

      try {
        let result;
        if (isEdit) {
          result = await apiUpdateAdmin(
            armourNumber,
            teams,
            password || undefined,
            nickname,
            permissions,
          );
        } else {
          result = await apiAddAdmin(
            armourNumber,
            password,
            teams,
            nickname,
            permissions,
          );
        }

        if (result.error) {
          alert(result.error);
          return;
        }

        hideModal();
        loadAdmins();
      } catch (err) {
        console.error("Error saving admin:", err);
        alert("Error saving admin");
      }
    });
}

function editAdmin(armourNumber) {
  apiGetAdmins().then((data) => {
    const admin = data.admins?.find((a) => a.armourNumber === armourNumber);
    if (admin) showAdminModal(admin);
  });
}

async function deleteAdmin(armourNumber) {
  if (!confirm(`Delete admin ${armourNumber}?`)) return;

  try {
    const result = await apiDeleteAdmin(armourNumber);
    if (result.error) {
      alert(result.error);
      return;
    }
    loadAdmins();
  } catch (err) {
    console.error("Error deleting admin:", err);
    alert("Error deleting admin");
  }
}

// Modal
function showModal(title, content, wide = false) {
  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  const modalContent = modal.querySelector(".modal-content");
  if (wide) {
    modalContent.classList.add("modal-wide");
  } else {
    modalContent.classList.remove("modal-wide");
  }
  modal.classList.remove("hidden");
}

function hideModal() {
  modal.classList.add("hidden");
  const modalContent = modal.querySelector(".modal-content");
  modalContent.classList.remove("modal-wide");
}

// Use event delegation so dynamically added Cancel buttons also work
modal?.addEventListener("click", (e) => {
  if (e.target.closest("[data-modal-close]")) {
    hideModal();
  }
});

// Navigation
navItems.forEach((item) => {
  item.addEventListener("click", () => {
    showSection(item.dataset.section);
  });
});

// Refresh dashboard button
document
  .querySelector("[data-refresh-dashboard]")
  ?.addEventListener("click", () => {
    const month = document.querySelector(
      "[data-dashboard-month-select]",
    )?.value;
    loadDashboard(month);
  });

// Dashboard month selector change
document
  .querySelector("[data-dashboard-month-select]")
  ?.addEventListener("change", (e) => {
    loadDashboard(e.target.value);
  });

// Logout
logoutBtn?.addEventListener("click", () => {
  currentAdmin = null;
  setAdminSession(null);
  setAdminToken(null);
  showLogin();
});

// Login
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const armourNumber = document
    .getElementById("login-armour")
    .value.trim()
    .toUpperCase();
  const password = document.getElementById("login-password").value;

  loginError.textContent = "";

  try {
    const result = await apiAdminLogin(armourNumber, password);

    if (result.error) {
      loginError.textContent = result.error;
      return;
    }

    currentAdmin = result.admin;
    setAdminSession(currentAdmin);
    setAdminToken(result.token);
    showDashboard();
  } catch (err) {
    console.error("Login error:", err);
    loginError.textContent = "Connection error";
  }
});

// Helpers
function formatDate(timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonth(monthKey) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-");
  return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
    "en-GB",
    {
      month: "long",
      year: "numeric",
    },
  );
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// Change Password
function showChangePasswordModal(targetArmour = null) {
  const isSelf = !targetArmour || targetArmour === currentAdmin.armourNumber;
  const target = targetArmour || currentAdmin.armourNumber;

  const html = `
    <form id="password-form">
      <div class="form-field">
        <label>New Password</label>
        <input type="password" id="new-password" required minlength="4" />
      </div>
      <div class="form-field">
        <label>Confirm New Password</label>
        <input type="password" id="confirm-password" required minlength="4" />
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-secondary" data-modal-close>Cancel</button>
        <button type="submit" class="btn btn-primary">Change Password</button>
      </div>
    </form>
  `;

  showModal(
    isSelf ? "Change Your Password" : `Change Password: ${target}`,
    html,
  );

  document
    .getElementById("password-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const currentPassword =
        document.getElementById("current-password")?.value || "";
      const newPassword = document.getElementById("new-password").value;
      const confirmPassword = document.getElementById("confirm-password").value;

      if (newPassword !== confirmPassword) {
        alert("Passwords do not match");
        return;
      }

      if (newPassword.length < 4) {
        alert("Password must be at least 4 characters");
        return;
      }

      try {
        const result = await apiChangePassword(
          target,
          currentPassword,
          newPassword,
        );
        if (result.error) {
          alert(result.error);
          return;
        }

        hideModal();
        alert("Password changed successfully");

        // If changed own password, update session
        if (isSelf) {
          // Session doesn't store password, so no update needed
        }
      } catch (err) {
        console.error("Error changing password:", err);
        alert("Error changing password");
      }
    });
}

// Add click handler for change password button in sidebar
document.querySelector("[data-admin-armour]")?.addEventListener("click", () => {
  showChangePasswordModal();
});

// ===== NOTIFICATIONS =====
let notifRecipientMode = "all";
let notifSelectedUsers = new Set();

async function loadNotifications() {
  try {
    const data = await apiGetNotifications();
    document.querySelector("[data-sub-count]").textContent =
      `${data.subscribedCount || 0} subscribed users`;
    renderNotificationHistory(data.notifications || []);
    await populateNotifUserSelect();
    await loadAutoNotifConfig();
  } catch (err) {
    console.error("Error loading notifications:", err);
  }
}

async function populateNotifUserSelect() {
  try {
    const data = await apiGetUsers();
    const users = data.users || [];
    const container = document.querySelector("[data-notif-user-select]");
    if (!container) return;

    container.innerHTML = `
      <div class="notif-user-search">
        <input type="text" placeholder="Search users..." class="search-input" data-notif-search />
      </div>
      <div class="notif-user-list" data-notif-user-list>
        ${users
          .map(
            (u) => `
          <label class="notif-user-item" data-armour="${escapeHtml(u.armourNumber)}">
            <input type="checkbox" value="${escapeHtml(u.armourNumber)}" />
            <span class="notif-user-armour">${escapeHtml(u.armourNumber)}</span>
            ${u.nickname ? `<span class="notif-user-nick">${escapeHtml(u.nickname)}</span>` : ""}
            <span class="notif-user-team">${escapeHtml(u.team || "")}</span>
          </label>
        `,
          )
          .join("")}
      </div>
      <div class="notif-selected-count"><span data-selected-count>0</span> selected</div>
    `;

    // Search filter
    container
      .querySelector("[data-notif-search]")
      ?.addEventListener("input", (e) => {
        const q = e.target.value.toLowerCase();
        container.querySelectorAll(".notif-user-item").forEach((item) => {
          const armour = item.dataset.armour.toLowerCase();
          const nick =
            item.querySelector(".notif-user-nick")?.textContent.toLowerCase() ||
            "";
          const team =
            item.querySelector(".notif-user-team")?.textContent.toLowerCase() ||
            "";
          item.style.display =
            armour.includes(q) || nick.includes(q) || team.includes(q)
              ? ""
              : "none";
        });
      });

    // Checkbox handlers
    container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) {
          notifSelectedUsers.add(cb.value);
        } else {
          notifSelectedUsers.delete(cb.value);
        }
        container.querySelector("[data-selected-count]").textContent =
          notifSelectedUsers.size;
      });
    });
  } catch (err) {
    console.error("Error populating user select:", err);
  }
}

function renderNotificationHistory(notifications) {
  const container = document.querySelector("[data-notif-history]");
  if (!container) return;

  if (notifications.length === 0) {
    container.innerHTML =
      '<p class="empty-state">No notifications sent yet.</p>';
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Message</th>
          <th>Recipients</th>
          <th>Delivered</th>
          <th>Sent</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${notifications
          .map(
            (n) => `
          <tr>
            <td><strong>${escapeHtml(n.title)}</strong></td>
            <td class="notif-msg-cell">${escapeHtml(n.message)}</td>
            <td>${n.recipients === "all" ? "All Users" : Array.isArray(n.recipients) ? n.recipients.length + " users" : n.recipients}</td>
            <td><span class="badge badge-success">${n.delivered}</span> / <span class="badge badge-danger">${n.failed} failed</span></td>
            <td>${new Date(n.sentAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="deleteNotification('${n.id}')">Delete</button>
            </td>
          </tr>
        `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

async function deleteNotification(id) {
  if (!confirm("Delete this notification record?")) return;
  try {
    await apiDeleteNotification(id);
    await loadNotifications();
  } catch (err) {
    console.error("Error deleting notification:", err);
  }
}

// Recipient toggle buttons
document.querySelectorAll("[data-rec-type]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll("[data-rec-type]")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    notifRecipientMode = btn.dataset.recType;
    const selectPanel = document.querySelector("[data-notif-user-select]");
    if (notifRecipientMode === "select") {
      selectPanel?.classList.remove("hidden");
    } else {
      selectPanel?.classList.add("hidden");
    }
  });
});

// Send notification
document
  .querySelector("[data-send-notification]")
  ?.addEventListener("click", async () => {
    const titleEl = document.getElementById("notif-title");
    const messageEl = document.getElementById("notif-message");
    const title = titleEl?.value.trim();
    const message = messageEl?.value.trim();

    if (!title || !message) {
      alert("Please enter a title and message.");
      return;
    }

    let recipients;
    if (notifRecipientMode === "all") {
      recipients = "all";
    } else {
      if (notifSelectedUsers.size === 0) {
        alert("Please select at least one user.");
        return;
      }
      recipients = Array.from(notifSelectedUsers);
    }

    const sendBtn = document.querySelector("[data-send-notification]");
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending...";

    try {
      const result = await apiSendNotification(title, message, recipients);
      if (result.error) {
        alert(result.error);
      } else {
        titleEl.value = "";
        messageEl.value = "";
        notifSelectedUsers.clear();
        document
          .querySelectorAll('[data-notif-user-select] input[type="checkbox"]')
          .forEach((cb) => (cb.checked = false));
        const countEl = document.querySelector("[data-selected-count]");
        if (countEl) countEl.textContent = "0";

        alert(
          `Notification sent! Delivered: ${result.notification.delivered}, Failed: ${result.notification.failed}`,
        );
        await loadNotifications();
      }
    } catch (err) {
      console.error("Error sending notification:", err);
      alert("Error sending notification");
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
      Send Notification
    `;
    }
  });

// ===== AUTO-NOTIFICATION CONFIG =====
async function loadAutoNotifConfig() {
  try {
    const res = await fetch("/api/admin/auto-notif-config", {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (data.config) {
      populateAutoNotifForm(data.config);
    }
  } catch (err) {
    console.error("Error loading auto-notif config:", err);
  }
}

function populateAutoNotifForm(config) {
  const q = (s) => document.querySelector(s);

  if (config.surveyAvailable) {
    if (q("[data-survey-enabled]"))
      q("[data-survey-enabled]").checked =
        config.surveyAvailable.enabled !== false;
    if (q("[data-survey-title]"))
      q("[data-survey-title]").value = config.surveyAvailable.title || "";
    if (q("[data-survey-message]"))
      q("[data-survey-message]").value = config.surveyAvailable.message || "";
    if (q("[data-survey-date]"))
      q("[data-survey-date]").value = config.surveyAvailable.sendDate || "";
    if (q("[data-survey-time]"))
      q("[data-survey-time]").value =
        config.surveyAvailable.sendTime || "09:00";
  }
}

document
  .querySelector("[data-save-auto-config]")
  ?.addEventListener("click", async () => {
    const q = (s) => document.querySelector(s);
    const btn = q("[data-save-auto-config]");
    const savedEl = q("[data-auto-saved]");

    const config = {
      surveyAvailable: {
        enabled: q("[data-survey-enabled]")?.checked ?? true,
        title: q("[data-survey-title]")?.value.trim() || "New Survey Available",
        message: q("[data-survey-message]")?.value.trim() || "",
        sendDate: q("[data-survey-date]")?.value || "",
        sendTime: q("[data-survey-time]")?.value || "09:00",
      },
    };

    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
      const res = await fetch("/api/admin/auto-notif-config", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ config }),
      });
      const data = await res.json();

      if (data.success) {
        savedEl?.classList.remove("hidden");
        setTimeout(() => savedEl?.classList.add("hidden"), 3000);
      } else {
        alert(data.error || "Error saving configuration");
      }
    } catch (err) {
      console.error("Error saving auto-notif config:", err);
      alert("Error saving configuration");
    } finally {
      btn.disabled = false;
      btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
      Save Configuration
    `;
    }
  });

// Initialize
(function init() {
  const session = getAdminSession();
  if (session) {
    currentAdmin = session;
    showDashboard();
  } else {
    showLogin();
  }
})();

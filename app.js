const questionnaireEl = document.getElementById("questionnaire");
const answeredEl = document.querySelector("[data-answered]");
const totalEl = document.querySelector("[data-total]");
const progressPercentEl = document.querySelector("[data-progress-percent]");
const progressLabelEl = document.querySelector("[data-progress-label]");
const progressFillEl = document.querySelector("[data-progress-fill]");
const progressTrackEl = document.querySelector(".progress-track");
const actionBarEl = document.querySelector("[data-action-bar]");
const submitBtn = document.querySelector("[data-submit-btn]");
const questionnaireContainer = document.getElementById("questionnaire");

const responses = new Map();
let totalQuestions = 0;
let answeredQuestions = 0;
let isScrolling = false;
let scrollTimeout = null;
let responsePresets = {};
let questionsData = null;
let currentUser = null;

async function loadQuestions() {
  try {
    const res = await fetch("questions.json");
    if (!res.ok) throw new Error("Unable to load questionnaire.");
    const data = await res.json();
    responsePresets = data.responsePresets || {};
    questionsData = data;
    renderQuestionnaire(data);
  } catch (error) {
    console.error("Error loading questions:", error);
    questionnaireEl.innerHTML = `<div class="error">${error.message}</div>`;
  }
}

function renderQuestionnaire(data) {
  questionnaireEl.innerHTML = "";
  totalQuestions = 0;
  answeredQuestions = responses.size;

  const categories = data.categories ?? {};
  Object.values(categories).forEach((category) => {
    const section = document.createElement("section");
    section.className = "section-block";

    const header = document.createElement("header");
    header.innerHTML = `
      <h2>${category.title}</h2>
      <p>${category.description ?? ""}</p>
    `;
    section.appendChild(header);

    if (Array.isArray(category.questions)) {
      category.questions.forEach((question, index) => {
        const card = createQuestionCard(
          question,
          `${slugify(category.title)}-${index}`,
        );
        section.appendChild(card);
      });
    }

    if (category.subcategories) {
      Object.values(category.subcategories).forEach((sub) => {
        const subheading = document.createElement("p");
        subheading.className = "subsection-title";
        subheading.textContent = sub.title;
        section.appendChild(subheading);

        if (sub.description) {
          const subDesc = document.createElement("p");
          subDesc.className = "subsection-description";
          subDesc.textContent = sub.description;
          section.appendChild(subDesc);
        }

        sub.questions.forEach((question, index) => {
          const card = createQuestionCard(
            question,
            `${slugify(sub.title)}-${index}`,
          );
          section.appendChild(card);
        });
      });
    }

    questionnaireEl.appendChild(section);
  });

  if (totalEl) totalEl.textContent = totalQuestions;
  if (answeredEl) answeredEl.textContent = answeredQuestions;
  updateProgress();
  toggleFooter();
}

function createQuestionCard(question, id) {
  totalQuestions += 1;

  const card = document.createElement("article");
  card.className = "question-card";

  // Handle both old string format and new object format
  const questionText = typeof question === "string" ? question : question.text;
  const responseType =
    typeof question === "object" ? question.responseType : null;

  const title = document.createElement("h3");
  title.textContent = questionText;
  card.appendChild(title);

  // Get config from preset or fallback to text-based detection
  const config =
    responseType && responsePresets[responseType]
      ? getConfigFromPreset(responsePresets[responseType])
      : getQuestionConfig(questionText);

  const control = createControlElement(config, id);
  card.appendChild(control);
  return card;
}

function getConfigFromPreset(preset) {
  if (preset.type === "buttons") {
    return {
      type: "buttons",
      options: preset.options.map((opt) => ({
        value: String(opt.value),
        label: `<small>${opt.label}</small>`,
      })),
    };
  }

  if (preset.type === "slider") {
    return {
      type: "slider",
      min: preset.min,
      max: preset.max,
      step: preset.step || 1,
      default: preset.min,
      labels: {
        min: preset.labels?.[String(preset.min)] || String(preset.min),
        max: preset.labels?.[String(preset.max)] || String(preset.max),
      },
      format: (value) => String(value),
    };
  }

  // Fallback
  return {
    type: "buttons",
    options: [
      { value: "1", label: "<small>Low</small>" },
      { value: "2", label: "<small>Medium</small>" },
      { value: "3", label: "<small>High</small>" },
    ],
  };
}

function createControlElement(config, id) {
  if (
    ["likert", "intensity", "frequency", "rating", "triad", "buttons"].includes(
      config.type,
    )
  ) {
    const wrapper = document.createElement("div");
    wrapper.className =
      config.type === "frequency" ? "frequency-options" : "scale-options";

    config.options.forEach((option) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = id;
      input.value = option.value;

      // Use change event only - prevents accidental selection while scrolling
      input.addEventListener("change", () => {
        if (!isScrolling) {
          handleResponse(id, option.value);
        }
      });

      const visual = document.createElement("span");
      visual.innerHTML = option.abbrev
        ? `<strong>${option.abbrev}</strong>${option.label}`
        : option.label;

      label.appendChild(input);
      label.appendChild(visual);
      wrapper.appendChild(label);
    });

    return wrapper;
  }

  if (config.type === "slider") {
    const wrapper = document.createElement("div");
    wrapper.className = "numeric-control slider-untouched";

    const display = document.createElement("div");
    display.className = "value-display";
    display.innerHTML = `
      <span>${config.labels?.min ?? config.min}</span>
      <strong data-display>—</strong>
      <span>${config.labels?.max ?? config.max}</span>
    `;

    const input = document.createElement("input");
    input.type = "range";
    input.min = config.min;
    input.max = config.max;
    input.step = config.step;
    input.value = config.default;

    const activate = () => {
      wrapper.classList.remove("slider-untouched");
      display.querySelector("[data-display]").textContent = config.format(
        input.value,
      );
      handleResponse(id, input.value);
    };

    input.addEventListener("input", () => {
      wrapper.classList.remove("slider-untouched");
      display.querySelector("[data-display]").textContent = config.format(
        input.value,
      );
      handleResponse(id, input.value);
    });
    input.addEventListener("change", activate);

    wrapper.appendChild(display);
    wrapper.appendChild(input);
    return wrapper;
  }

  const fallback = document.createElement("p");
  fallback.textContent = "Input unavailable for this question.";
  return fallback;
}

function handleResponse(id, value) {
  if (!responses.has(id)) {
    answeredQuestions += 1;
  }
  responses.set(id, value);

  if (answeredEl) answeredEl.textContent = answeredQuestions;
  updateProgress();
  toggleFooter();
}

function getQuestionConfig(question) {
  const text = question.toLowerCase();

  if (
    text.startsWith("i've") ||
    text.startsWith("i have") ||
    text.startsWith("i ")
  ) {
    return {
      type: "triad",
      hint: "",
      options: createTriadScale(),
    };
  }

  if (text.includes("how often") || text.includes("how consistently")) {
    return {
      type: "frequency",
      hint: "",
      options: createFrequencyScale(),
    };
  }

  if (
    text.includes("how would you rate") ||
    text.includes("overall sense of wellbeing")
  ) {
    return {
      type: "triad",
      hint: "",
      options: createTriadScale(["Low", "Moderate", "High"]),
    };
  }

  if (text.includes("how long")) {
    const isMinutes = !text.includes("hours");
    return {
      type: "slider",
      min: 0,
      max: isMinutes ? 120 : 12,
      step: isMinutes ? 5 : 1,
      default: 0,
      labels: {
        min: isMinutes ? "0 min" : "0 hrs",
        max: isMinutes ? "120 min" : "12 hrs",
      },
      hint: "",
      format: (value) => `${value}${isMinutes ? " min" : " hrs"}`,
    };
  }

  if (text.includes("how many nights have you spent away")) {
    return {
      type: "slider",
      min: 0,
      max: 20,
      step: 1,
      default: 0,
      labels: { min: "0 nights", max: "20 nights" },
      hint: "",
      format: (value) => `${value} night${Number(value) === 1 ? "" : "s"}`,
    };
  }

  if (text.includes("how many nights per week")) {
    return {
      type: "slider",
      min: 0,
      max: 7,
      step: 1,
      default: 0,
      labels: { min: "0 nights", max: "7 nights" },
      hint: "",
      format: (value) => `${value} night${Number(value) === 1 ? "" : "s"}`,
    };
  }

  if (
    text.includes("how much time") ||
    text.includes("how much has") ||
    text.includes("how connected") ||
    text.includes("how manageable")
  ) {
    return {
      type: "triad",
      hint: "",
      options: createTriadScale(["Not at all", "Moderate", "Fully"]),
    };
  }

  return {
    type: "triad",
    hint: "",
    options: createTriadScale(),
  };
}

function createTriadScale(labels = ["Low", "Moderate", "High"]) {
  return [
    { value: "1", label: `<small>${labels[0]}</small>` },
    { value: "2", label: `<small>${labels[1]}</small>` },
    { value: "3", label: `<small>${labels[2]}</small>` },
  ];
}

function createFrequencyScale() {
  return [
    { value: "1", label: "<small>Rarely</small>" },
    { value: "2", label: "<small>Sometimes</small>" },
    { value: "3", label: "<small>Always</small>" },
  ];
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function updateProgress() {
  const percent =
    totalQuestions === 0
      ? 0
      : Math.round((answeredQuestions / totalQuestions) * 100);

  if (progressPercentEl) {
    progressPercentEl.textContent = `${percent}%`;
  }
  if (progressLabelEl) {
    progressLabelEl.textContent = `${answeredQuestions} of ${totalQuestions} complete`;
  }
  if (progressFillEl) {
    progressFillEl.style.width = `${percent}%`;
  }
  if (progressTrackEl) {
    progressTrackEl.setAttribute("aria-valuenow", String(percent));
  }
}

function toggleFooter() {
  if (!actionBarEl || !submitBtn) return;

  const isComplete = answeredQuestions === totalQuestions && totalQuestions > 0;

  if (isComplete) {
    actionBarEl.classList.add("action-bar--complete");
  } else {
    actionBarEl.classList.remove("action-bar--complete");
  }
}

// Submit button handler
if (submitBtn) {
  submitBtn.addEventListener("click", async () => {
    const user = getCurrentUser();
    if (!user) {
      alert("Please sign in to submit");
      return;
    }

    const result = Object.fromEntries(responses);

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          armourNumber: user.armourNumber,
          responses: result,
        }),
      });

      const data = await response.json();

      if (data.error) {
        alert("Error: " + data.error);
        return;
      }

      alert("Questionnaire submitted successfully! Thank you.");
      // Compute and show personal scores before responses are cleared
      const personalScores = computePersonalScores(responses);
      if (personalScores) {
        drawRadarChart(personalScores);
      }
      updateSubmissionStatus(true, 0, Date.now());
      loadTeamStats(user.team);
    } catch (err) {
      console.error("Submit error:", err);
      alert("Connection error. Please try again.");
    }
  });
}

// Auth & Profile
const authScreen = document.getElementById("auth-screen");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const deviceShell = document.querySelector(".device-shell");

const menuBtn = document.querySelector("[data-menu-btn]");
const menuOverlay = document.querySelector("[data-menu-overlay]");
const profileMenu = document.querySelector("[data-profile-menu]");
const menuClose = document.querySelector("[data-menu-close]");
const armourNumberEl = document.querySelector("[data-armour-number]");
const menuTeamEl = document.querySelector("[data-menu-team]");
const profileAvatarEl = document.querySelector("[data-profile-avatar]");
const logoutBtn = document.querySelector("[data-logout-btn]");

// Submission status elements
const statusIconEl = document.querySelector("[data-status-icon]");
const statusTitleEl = document.querySelector("[data-status-title]");
const statusSubtitleEl = document.querySelector("[data-status-subtitle]");
const submissionStatusEl = document.querySelector("[data-submission-status]");

// Team stats elements
const teamStatusEl = document.querySelector("[data-team-status]");
const teamWellbeingEl = document.querySelector("[data-team-wellbeing]");
const teamSubmittedEl = document.querySelector("[data-team-submitted]");
const monthLabelEl = document.querySelector("[data-month-label]");
const radarCanvas = document.getElementById("radar-chart");

// Questionnaire completed screen elements
const questionnaireCompletedEl = document.getElementById(
  "questionnaire-completed",
);
const submittedDateEl = document.querySelector("[data-submitted-date]");
const nextQuestionnaireEl = document.querySelector("[data-next-questionnaire]");

const teamNames = {
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "10",
  "11": "11",
  "12": "12",
  "13": "13",
  "14": "14",
  "15": "15",
};

// Session management (only session stored locally, auth on server)
function getCurrentUser() {
  try {
    const session = localStorage.getItem("armourcare-session");
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  try {
    if (user) {
      localStorage.setItem("armourcare-session", JSON.stringify(user));
    } else {
      localStorage.removeItem("armourcare-session");
    }
  } catch {}
}

function getUserToken() {
  try {
    return localStorage.getItem("armourcare-token") || "";
  } catch {
    return "";
  }
}

function setUserToken(token) {
  try {
    if (token) {
      localStorage.setItem("armourcare-token", token);
    } else {
      localStorage.removeItem("armourcare-token");
    }
  } catch {}
}

// API calls to server
async function apiSignup(armourNumber, team, subTeam, password) {
  const response = await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ armourNumber, team, subTeam, password }),
  });
  return response.json();
}

async function apiLogin(armourNumber, password) {
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ armourNumber, password }),
  });
  return response.json();
}

async function apiGenerateArmour() {
  const response = await fetch("/api/generate-armour");
  return response.json();
}

async function apiGetTeamStats(team) {
  const response = await fetch(
    `/api/team-stats?team=${encodeURIComponent(team)}`,
  );
  return response.json();
}

async function apiGetSubmissionStatus(armourNumber) {
  const response = await fetch(
    `/api/submission-status?armourNumber=${encodeURIComponent(armourNumber)}`,
  );
  return response.json();
}

// Update submission status UI
function updateSubmissionStatus(
  hasSubmitted,
  daysRemaining = 0,
  submittedAt = null,
) {
  if (hasSubmitted) {
    if (statusTitleEl) statusTitleEl.textContent = "Questionnaire Complete";
    if (statusSubtitleEl) statusSubtitleEl.textContent = "Submitted this month";
    submissionStatusEl?.classList.add("completed");

    // Show completed screen instead of questionnaire
    showCompletedScreen(submittedAt);
  } else {
    if (statusTitleEl) statusTitleEl.textContent = "Questionnaire Pending";
    if (statusSubtitleEl)
      statusSubtitleEl.textContent = `${daysRemaining} days remaining`;
    submissionStatusEl?.classList.remove("completed");

    // Show questionnaire
    hideCompletedScreen();
  }
}

// Show questionnaire completed screen
function showCompletedScreen(submittedAt) {
  if (questionnaireCompletedEl) {
    questionnaireCompletedEl.classList.remove("hidden");
  }
  if (questionnaireEl) {
    questionnaireEl.style.display = "none";
  }
  if (actionBarEl) {
    actionBarEl.style.display = "none";
  }

  // Format submitted date
  if (submittedDateEl && submittedAt) {
    const date = new Date(submittedAt);
    submittedDateEl.textContent = date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  // Calculate next questionnaire date (1st of next month)
  if (nextQuestionnaireEl) {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    nextQuestionnaireEl.textContent = nextMonth.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
}

// Hide questionnaire completed screen and reset form
function hideCompletedScreen() {
  if (questionnaireCompletedEl) {
    questionnaireCompletedEl.classList.add("hidden");
  }
  if (questionnaireEl) {
    questionnaireEl.style.display = "";
  }
  if (actionBarEl) {
    actionBarEl.style.display = "";
  }

  // Reset questionnaire selections so user can re-submit
  responses.clear();
  answeredQuestions = 0;
  updateProgress();
  toggleFooter();

  // Clear all selected states in the UI
  document
    .querySelectorAll(".option-btn.selected")
    .forEach((btn) => btn.classList.remove("selected"));
  document.querySelectorAll('input[type="range"]').forEach((slider) => {
    slider.value = slider.min || 0;
    const wrapper = slider.closest(".numeric-control");
    if (wrapper) wrapper.classList.add("slider-untouched");
    const display = wrapper?.querySelector("[data-display]");
    if (display) display.textContent = "—";
  });
}

// Draw radar chart
function drawRadarChart(scores) {
  if (!radarCanvas) return;

  const ctx = radarCanvas.getContext("2d");
  const width = radarCanvas.width;
  const height = radarCanvas.height;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) / 2 - 45;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  const labels = ["Burnout", "Mental", "Sleep", "Lifestyle"];
  const values = [
    scores.burnout || 0,
    scores.mental || 0,
    scores.sleep || 0,
    scores.lifestyle || 0,
  ];
  const colors = [
    "rgba(100, 200, 150, 0.8)",
    "rgba(100, 150, 255, 0.8)",
    "rgba(255, 180, 100, 0.8)",
    "rgba(200, 100, 200, 0.8)",
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
  ctx.fillStyle = "rgba(100, 180, 255, 0.2)";
  ctx.fill();
  ctx.strokeStyle = "rgba(100, 180, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw data points
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

// Get month name
function getMonthName(monthKey) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Get wellbeing status label based on score
function getWellbeingStatus(score) {
  if (score >= 80) return { label: "Excellent", color: "#50c878" };
  if (score >= 60) return { label: "Good", color: "#7dd87d" };
  if (score >= 40) return { label: "Fair", color: "#ffb432" };
  if (score >= 20) return { label: "At Risk", color: "#ff8c42" };
  return { label: "Needs Support", color: "#ff6b6b" };
}

// Load team stats
async function loadTeamStats(team) {
  try {
    const stats = await apiGetTeamStats(team);

    if (stats.wellbeingScore > 0) {
      const status = getWellbeingStatus(stats.wellbeingScore);
      if (teamStatusEl) {
        teamStatusEl.textContent = status.label;
        teamStatusEl.style.color = status.color;
      }
      if (teamWellbeingEl)
        teamWellbeingEl.textContent = `${stats.wellbeingScore}% Wellbeing`;
    } else {
      if (teamStatusEl) {
        teamStatusEl.textContent = "--";
        teamStatusEl.style.color = "";
      }
      if (teamWellbeingEl) teamWellbeingEl.textContent = "No data yet";
    }

    if (teamSubmittedEl)
      teamSubmittedEl.textContent = `${stats.submittedCount}/${stats.totalMembers}`;
    if (monthLabelEl) monthLabelEl.textContent = getMonthName(stats.monthKey);

    // Team stats loaded — radar chart is personal, handled separately
  } catch (err) {
    console.error("Error loading team stats:", err);
  }
}

// Compute personal section scores from a responses object (Map or plain object)
function computePersonalScores(responseData) {
  if (!questionsData) return null;
  // Accept either a Map or a plain object from the server
  const getVal =
    responseData instanceof Map
      ? (k) => responseData.get(k)
      : (k) => responseData[k];

  function slugify(str) {
    return str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
  function getSectionKey(catTitle) {
    const t = catTitle.toLowerCase();
    if (t.includes("burnout")) return "burnout";
    if (t.includes("mental")) return "mental";
    if (t.includes("sleep")) return "sleep";
    return "lifestyle";
  }
  function getMax(preset) {
    if (!preset || !preset.options) return 3;
    return Math.max(...preset.options.map((o) => Number(o.value)));
  }
  function getMin(preset) {
    if (!preset || !preset.options) return 1;
    return Math.min(...preset.options.map((o) => Number(o.value)));
  }

  const sections = {
    burnout: { t: 0, c: 0 },
    mental: { t: 0, c: 0 },
    sleep: { t: 0, c: 0 },
    lifestyle: { t: 0, c: 0 },
  };

  Object.values(questionsData.categories).forEach((cat) => {
    const sec = getSectionKey(cat.title);
    function scoreQuestions(questions, parentTitle) {
      const slug = slugify(parentTitle);
      questions.forEach((q, i) => {
        const key = `${slug}-${i}`;
        const val = getVal(key);
        if (val === undefined || val === null) return;
        const preset = responsePresets[q.responseType];
        const mx = getMax(preset);
        const mn = getMin(preset);
        const nv = parseFloat(val);
        if (isNaN(nv) || mx === mn) return;
        const norm = (nv - mn) / (mx - mn);
        const wb = q.polarity === "negative" ? (1 - norm) * 100 : norm * 100;
        sections[sec].t += Math.round(wb);
        sections[sec].c++;
      });
    }
    if (cat.questions) scoreQuestions(cat.questions, cat.title);
    if (cat.subcategories) {
      Object.values(cat.subcategories).forEach((sub) => {
        if (sub.questions) scoreQuestions(sub.questions, sub.title);
      });
    }
  });

  const result = {};
  Object.entries(sections).forEach(([k, s]) => {
    result[k] = s.c > 0 ? Math.round(s.t / s.c) : 0;
  });
  return result;
}

// Load user submission status and personal radar on return visits
async function loadSubmissionStatus(armourNumber) {
  try {
    const status = await apiGetSubmissionStatus(armourNumber);
    updateSubmissionStatus(
      status.hasSubmitted,
      status.daysRemaining,
      status.submittedAt,
    );
    // If user already submitted, compute personal scores from server responses
    if (status.hasSubmitted && status.responses && questionsData) {
      const personalScores = computePersonalScores(status.responses);
      if (personalScores) {
        drawRadarChart(personalScores);
      }
    }
  } catch (err) {
    console.error("Error loading submission status:", err);
  }
}

// Auth UI
let signupTeam = null;
let signupSubTeam = null;

const SUBTEAM_PARENT = "2";
const signupTeamLabel = document.querySelector("[data-signup-team-label]");
const signupTeamBtns = document.querySelectorAll("[data-signup-team]");
const subTeamField = document.querySelector("[data-subteam-field]");
const signupSubTeamLabel = document.querySelector(
  "[data-signup-subteam-label]",
);
const signupSubTeamBtns = document.querySelectorAll("[data-signup-subteam]");

function resetSubTeamSelection() {
  signupSubTeam = null;
  signupSubTeamBtns.forEach((b) => b.classList.remove("selected"));
  if (signupSubTeamLabel)
    signupSubTeamLabel.textContent = "Select a sub-team";
}
const showSignupBtn = document.querySelector("[data-show-signup]");
const showLoginBtn = document.querySelector("[data-show-login]");
const loginError = document.querySelector("[data-login-error]");
const signupError = document.querySelector("[data-signup-error]");

// Auto-format Armour Number (add dash after 5 characters)
function formatArmourNumber(input) {
  let value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (value.length > 5) {
    value = value.slice(0, 5) + "-" + value.slice(5, 9);
  }
  input.value = value;
}

document
  .getElementById("login-armour")
  ?.addEventListener("input", (e) => formatArmourNumber(e.target));
document
  .getElementById("signup-armour")
  ?.addEventListener("input", (e) => formatArmourNumber(e.target));

signupTeamBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    signupTeam = btn.dataset.signupTeam;
    signupTeamBtns.forEach((b) => b.classList.toggle("selected", b === btn));
    if (signupTeamLabel)
      signupTeamLabel.textContent = teamNames[signupTeam] || "Select a team";
    // Show sub-team picker only for team 2
    if (signupTeam === SUBTEAM_PARENT) {
      subTeamField?.classList.remove("hidden");
    } else {
      subTeamField?.classList.add("hidden");
      resetSubTeamSelection();
    }
  });
});

signupSubTeamBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    signupSubTeam = btn.dataset.signupSubteam;
    signupSubTeamBtns.forEach((b) => b.classList.toggle("selected", b === btn));
    if (signupSubTeamLabel)
      signupSubTeamLabel.textContent = `Sub-team ${signupSubTeam.toUpperCase()}`;
  });
});

showSignupBtn?.addEventListener("click", () => {
  loginForm?.classList.add("hidden");
  signupForm?.classList.remove("hidden");
  signupTeam = null;
  signupTeamBtns.forEach((b) => b.classList.remove("selected"));
  if (signupTeamLabel) signupTeamLabel.textContent = "Select a team";
  subTeamField?.classList.add("hidden");
  resetSubTeamSelection();
  // Clear signup form
  const signupArmourInput = document.getElementById("signup-armour");
  if (signupArmourInput) signupArmourInput.value = "";
  document.getElementById("signup-password")?.value &&
    (document.getElementById("signup-password").value = "");
  document.getElementById("signup-confirm")?.value &&
    (document.getElementById("signup-confirm").value = "");
});

showLoginBtn?.addEventListener("click", () => {
  signupForm?.classList.add("hidden");
  loginForm?.classList.remove("hidden");
});

// Login handler
loginForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const armour = document
    .getElementById("login-armour")
    ?.value.trim()
    .toUpperCase();
  const password = document.getElementById("login-password")?.value;

  if (loginError) loginError.textContent = "";

  try {
    const result = await apiLogin(armour, password);

    if (result.error) {
      if (loginError) loginError.textContent = result.error;
      return;
    }

    setCurrentUser(result.user);
    setUserToken(result.token);
    showApp(result.user);
  } catch (err) {
    console.error("Login error:", err);
    if (loginError)
      loginError.textContent = "Connection error. Please try again.";
  }
});

// Signup handler
signupForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const armourNumber = document
    .getElementById("signup-armour")
    ?.value.trim()
    .toUpperCase();
  const password = document.getElementById("signup-password")?.value;
  const confirm = document.getElementById("signup-confirm")?.value;

  if (signupError) signupError.textContent = "";

  if (!armourNumber) {
    if (signupError)
      signupError.textContent = "Please enter your Armour number";
    return;
  }

  if (!signupTeam) {
    if (signupError) signupError.textContent = "Please select a team";
    return;
  }

  if (signupTeam === SUBTEAM_PARENT && !signupSubTeam) {
    if (signupError) signupError.textContent = "Please select a sub-team";
    return;
  }

  if (password !== confirm) {
    if (signupError) signupError.textContent = "Passwords do not match";
    return;
  }

  if (password.length < 4) {
    if (signupError)
      signupError.textContent = "Password must be at least 4 characters";
    return;
  }

  try {
    const result = await apiSignup(
      armourNumber,
      signupTeam,
      signupTeam === SUBTEAM_PARENT ? signupSubTeam : undefined,
      password,
    );

    if (result.error) {
      if (signupError) signupError.textContent = result.error;
      return;
    }

    setCurrentUser(result.user);
    setUserToken(result.token);
    showApp(result.user);
  } catch (err) {
    console.error("Signup error:", err);
    if (signupError)
      signupError.textContent = "Connection error. Please try again.";
  }
});

// Show app after auth
function showApp(user) {
  currentUser = user;
  authScreen?.classList.add("hidden");
  deviceShell?.classList.remove("hidden");

  if (armourNumberEl) armourNumberEl.textContent = user.armourNumber;
  if (menuTeamEl)
    menuTeamEl.textContent = user.subTeam
      ? `${teamNames[user.team] || user.team}${user.subTeam.toUpperCase()}`
      : teamNames[user.team] || "-";

  // Load user data
  loadSubmissionStatus(user.armourNumber);
  loadTeamStats(user.team);

  // Update notification toggle state
  updateNotifToggleState();

  // Auto-register if notifications were previously enabled
  const notifPref = localStorage.getItem("armourcare-notif-enabled");
  if (notifPref !== "false") {
    // Only auto-register if permission was already granted (don't prompt automatically)
    if (Notification.permission === "granted") {
      registerPushNotifications(user.armourNumber);
    }
  }
}

// Push notification helpers
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Push notification registration
async function registerPushNotifications(armourNumber) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return false;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const res = await fetch("/api/vapid-public-key");
      const { publicKey } = await res.json();

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    await fetch("/api/push-subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ armourNumber, subscription }),
    });
    return true;
  } catch (err) {
    console.log("Push notification registration failed:", err.message);
    return false;
  }
}

// Check if push notifications are supported
function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

function isIOSSafari() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigator.standalone === true
  );
}

// Update the notification toggle UI based on current state
function updateNotifToggleState() {
  const btn = document.getElementById("notif-toggle-btn");
  const statusEl = document.querySelector("[data-notif-status]");
  if (!btn || !statusEl) return;

  const pref = localStorage.getItem("armourcare-notif-enabled");

  if (!isPushSupported()) {
    if (isIOSSafari() && !isStandalone()) {
      btn.classList.remove("active");
      statusEl.textContent = "Add to Home Screen first";
    } else {
      btn.classList.remove("active");
      statusEl.textContent = "";
    }
    return;
  }

  const perm =
    typeof Notification !== "undefined" ? Notification.permission : "default";

  if (perm === "granted" && pref !== "false") {
    btn.classList.add("active");
    statusEl.textContent = "On";
  } else if (perm === "denied") {
    btn.classList.remove("active");
    statusEl.textContent = "Reset in browser settings";
  } else if (pref === "false") {
    btn.classList.remove("active");
    statusEl.textContent = "Off";
  } else {
    btn.classList.remove("active");
    statusEl.textContent = "";
  }
}

// Handle notification toggle
async function handleNotifToggle(e) {
  if (e) e.preventDefault();
  const btn = document.getElementById("notif-toggle-btn");
  const statusEl = document.querySelector("[data-notif-status]");
  const user = getCurrentUser();
  if (!btn || !statusEl) return;
  const isActive = btn.classList.contains("active");

  if (isActive) {
    btn.classList.remove("active");
    localStorage.setItem("armourcare-notif-enabled", "false");
    statusEl.textContent = "Off";
    return;
  }

  // iOS Safari without Home Screen
  if (isIOSSafari() && !isStandalone()) {
    alert(
      'To receive notifications on iPhone:\n\n1. Tap the Share button (box with arrow)\n2. Tap "Add to Home Screen"\n3. Open the app from your Home Screen\n4. Enable notifications from there',
    );
    return;
  }

  if (!isPushSupported()) {
    alert("Push notifications are not supported in this browser.");
    return;
  }

  // Check if blocked
  if (
    typeof Notification !== "undefined" &&
    Notification.permission === "denied"
  ) {
    alert(
      "Notifications are blocked.\n\nTo fix: tap the lock/settings icon in your browser address bar and allow notifications for this site.",
    );
    return;
  }

  // Request permission
  const permission = await Notification.requestPermission();

  if (permission === "granted") {
    btn.classList.add("active");
    localStorage.setItem("armourcare-notif-enabled", "true");
    statusEl.textContent = "Registering...";
    if (user) {
      const success = await registerPushNotifications(user.armourNumber);
      statusEl.textContent = success ? "On" : "Failed";
      if (!success) btn.classList.remove("active");
    }
  } else if (permission === "denied") {
    localStorage.setItem("armourcare-notif-enabled", "false");
    statusEl.textContent = "Reset in browser settings";
  } else {
    localStorage.setItem("armourcare-notif-enabled", "false");
    statusEl.textContent = "Off";
  }
}

// Attach toggle handler with both touchend and click
const _notifBtn = document.getElementById("notif-toggle-btn");
if (_notifBtn) {
  let _notifTouched = false;
  _notifBtn.addEventListener(
    "touchend",
    (e) => {
      _notifTouched = true;
      handleNotifToggle(e);
    },
    { passive: false },
  );
  _notifBtn.addEventListener("click", (e) => {
    if (_notifTouched) {
      _notifTouched = false;
      return;
    }
    handleNotifToggle(e);
  });
}

// Re-check submission status when tab regains focus
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && currentUser) {
    loadSubmissionStatus(currentUser.armourNumber);
    loadTeamStats(currentUser.team);
  }
});

// Show auth screen
function showAuth() {
  deviceShell?.classList.add("hidden");
  authScreen?.classList.remove("hidden");
  loginForm?.classList.remove("hidden");
  signupForm?.classList.add("hidden");

  // Clear forms
  if (loginError) loginError.textContent = "";
  if (signupError) signupError.textContent = "";
  document.getElementById("login-armour")?.value &&
    (document.getElementById("login-armour").value = "");
  document.getElementById("login-password")?.value &&
    (document.getElementById("login-password").value = "");
}

// Menu functions
function openMenu() {
  menuOverlay?.classList.add("active");
  profileMenu?.classList.add("active");
}

function closeMenu() {
  menuOverlay?.classList.remove("active");
  profileMenu?.classList.remove("active");
}

menuBtn?.addEventListener("click", openMenu);
menuClose?.addEventListener("click", closeMenu);
menuOverlay?.addEventListener("click", closeMenu);

// Logout
logoutBtn?.addEventListener("click", () => {
  closeMenu();
  currentUser = null;
  setCurrentUser(null);
  setUserToken(null);
  showAuth();
});

// Check auth on load
function checkAuth() {
  const user = getCurrentUser();
  if (user) {
    showApp(user);
    return true;
  }
  return false;
}

// Hide splash screen after app loads
function hideSplash() {
  const splash = document.getElementById("splash");
  if (splash) {
    splash.classList.add("hidden");
  }
}

// Track scrolling to prevent accidental selections
if (questionnaireContainer) {
  questionnaireContainer.addEventListener(
    "scroll",
    () => {
      isScrolling = true;
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        isScrolling = false;
      }, 150);
    },
    { passive: true },
  );
}

// Initialize
(async function init() {
  console.log("Init starting...");
  try {
    await loadQuestions();
    console.log("Questions loaded");

    // After splash, check if user is logged in
    setTimeout(() => {
      console.log("Hiding splash...");
      hideSplash();
      const isLoggedIn = checkAuth();
      console.log("Is logged in:", isLoggedIn);
      if (!isLoggedIn) {
        console.log("Showing auth...");
        showAuth();
      }
    }, 1500);
  } catch (err) {
    console.error("Init error:", err);
    hideSplash();
    showAuth();
  }
})();

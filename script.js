
const API_BASE = "https://api.jolpi.ca/ergast/f1";

const $ = (selector) => document.querySelector(selector);

const TEAM_COLORS = {
  "McLaren": "#ff8000",
  "Ferrari": "#e8002d",
  "Red Bull": "#3671c6",
  "Mercedes": "#27f4d2",
  "Aston Martin": "#229971",
  "Alpine": "#ff87bc",
  "Williams": "#64c4ff",
  "Racing Bulls": "#6692ff",
  "RB": "#6692ff",
  "Haas": "#b6babd",
  "Kick Sauber": "#52e252",
  "Sauber": "#52e252",
  "Audi": "#bb0000",
  "Cadillac": "#d6d6d6"
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "날짜 미정";

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);

  return match
    ? `${match[1]}/${match[2]}/${match[3]}`
    : value;
}

function getTeamColor(teamName) {
  const team = Object.keys(TEAM_COLORS).find(name =>
    String(teamName || "").toLowerCase().includes(name.toLowerCase())
  );

  return team ? TEAM_COLORS[team] : "#ffffff";
}

async function getJSON(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API 오류: ${response.status}`);
  }

  return response.json();
}

/* 시즌 일정 */
async function loadSchedule() {
  const data = await getJSON(`${API_BASE}/current.json?limit=100`);
  const races = data.MRData?.RaceTable?.Races || [];

  const count = $("#rounds-value");
  const body = $("#schedule-body");

  if (count) count.textContent = races.length;

  if (!body) return;

  body.innerHTML = races.map(race => `
    <tr>
      <td>${escapeHTML(race.round)}</td>
      <td>${escapeHTML(race.raceName)}</td>
      <td>${formatDate(race.date)}</td>
      <td>${escapeHTML(race.Circuit?.circuitName || "—")}</td>
    </tr>
  `).join("");
}

/* 드라이버 순위 */
async function loadDrivers() {
  const data = await getJSON(
    `${API_BASE}/current/driverStandings.json`
  );

  const drivers =
    data.MRData?.StandingsTable?.StandingsLists?.[0]
      ?.DriverStandings || [];

  const count = $("#drivers-value");
  const list = $("#drivers-list");

  if (count) count.textContent = drivers.length;
  if (!list) return;

  list.innerHTML = drivers.map(item => {
    const driver = item.Driver || {};
    const team = item.Constructors?.[0]?.name || "팀 미정";
    const name = `${driver.givenName || ""} ${driver.familyName || ""}`.trim();
    const color = getTeamColor(team);

    return `
      <div class="standing-row">
        <span class="rank">${escapeHTML(item.position)}</span>
        <span class="standing-name" style="color:${color}">
          ${escapeHTML(name)}
          <span class="standing-sub">${escapeHTML(team)}</span>
        </span>
        <span class="standing-points">
          ${escapeHTML(item.points)} PTS
        </span>
      </div>
    `;
  }).join("");
}

/* 팀 순위 */
async function loadTeams() {
  const data = await getJSON(
    `${API_BASE}/current/constructorStandings.json`
  );

  const teams =
    data.MRData?.StandingsTable?.StandingsLists?.[0]
      ?.ConstructorStandings || [];

  const count = $("#teams-value");
  const list = $("#teams-list");

  if (count) count.textContent = teams.length;
  if (!list) return;

  list.innerHTML = teams.map(item => {
    const team = item.Constructor || {};
    const color = getTeamColor(team.name);

    return `
      <div class="standing-row">
        <span class="rank">${escapeHTML(item.position)}</span>
        <span class="standing-name" style="color:${color}">
          ${escapeHTML(team.name)}
          <span class="standing-sub">
            ${escapeHTML(team.nationality || "")}
          </span>
        </span>
        <span class="standing-points">
          ${escapeHTML(item.points)} PTS
        </span>
      </div>
    `;
  }).join("");
}

/* 공식 F1 경기 결과 페이지 연결 */
function renderLatestResults() {
  const container = $("#latest-results");
  if (!container) return;

  container.innerHTML = `
    <div class="latest-session-card">
      <h3>🏁 F1 공식 경기 결과</h3>
      <p>
        최신 연습 주행, 퀄리파잉, 스프린트 및 레이스 결과를
        Formula 1 공식 사이트에서 확인할 수 있습니다.
      </p>

      <p>
        <a
          href="https://www.formula1.com/en/results/2026/races"
          target="_blank"
          rel="noopener noreferrer"
        >
          최신 레이스 결과 보기 ↗
        </a>
      </p>

      <p>
        <a
          href="https://www.formula1.com/en/results/2026/qualifying"
          target="_blank"
          rel="noopener noreferrer"
        >
          퀄리파잉 결과 보기 ↗
        </a>
      </p>

      <p>
        <a
          href="https://www.formula1.com/en/results/2026/practice"
          target="_blank"
          rel="noopener noreferrer"
        >
          연습 주행 결과 보기 ↗
        </a>
      </p>
    </div>
  `;
}

/* 전체 화면 새로고침 */
async function loadDashboard() {
  const status = $("#connection-status");
  const refreshButton = $("#refresh-button");

  if (status) status.textContent = "데이터 불러오는 중…";
  if (refreshButton) refreshButton.disabled = true;

  const tasks = await Promise.allSettled([
    loadSchedule(),
    loadDrivers(),
    loadTeams()
  ]);

  renderLatestResults();

  const failed = tasks.filter(task => task.status === "rejected");

  if (status) {
    status.textContent = failed.length === 0
      ? "데이터 연결 완료"
      : `일부 데이터 연결 실패 (${3 - failed.length}/3)`;
  }

  if (refreshButton) refreshButton.disabled = false;

  tasks.forEach((task, index) => {
    if (task.status === "rejected") {
      console.error("대시보드 데이터 오류:", task.reason);
    }
  });
}

$("#refresh-button")?.addEventListener("click", loadDashboard);

loadDashboard();

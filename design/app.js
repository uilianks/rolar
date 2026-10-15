// tatame — comportamento compartilhado dos wireframes (sem framework).
// Cada página declara <body data-page="feed" data-shell="app"> e o shell (sidebar + dock) é montado aqui.

const NAV = [
  { id: "feed", href: "feed.html", icon: "house", label: "Feed" },
  { id: "progresso", href: "progresso.html", icon: "chart-no-axes-column", label: "Progresso" },
  { id: "registrar", href: "registrar.html", icon: "plus", label: "Registrar", cta: true },
  { id: "academia", href: "academia.html", icon: "users", label: "Academia" },
  { id: "perfil", href: "perfil.html", icon: "user", label: "Perfil" },
];
const NAV_EXTRA = [
  { id: "timer", href: "timer.html", icon: "timer", label: "Timer de rounds" },
  { id: "notificacoes", href: "notificacoes.html", icon: "bell", label: "Notificações", badge: "3" },
  { id: "config", href: "config.html", icon: "settings", label: "Configurações" },
  { id: "apoie", href: "apoie.html", icon: "heart", label: "Apoie o projeto" },
];

function storage(op, key, value) {
  try {
    if (op === "get") return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch { return null; }
}

function applyTheme(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
}
applyTheme(storage("get", "tatame-theme"));

function toggleTheme() {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  const next = dark ? "light" : "dark";
  applyTheme(next);
  storage("set", "tatame-theme", next);
}

function navLink(item, page) {
  const current = item.id === page ? ' aria-current="page"' : "";
  const badge = item.badge ? `<span class="badge badge-accent">${item.badge}</span>` : "";
  return `<a class="nav-item" href="${item.href}"${current}><i data-lucide="${item.icon}"></i>${item.label}${badge}</a>`;
}

function buildShell() {
  const page = document.body.dataset.page;
  if (document.body.dataset.shell !== "app") return;

  const sidebar = document.createElement("aside");
  sidebar.className = "sidebar";
  sidebar.innerHTML = `
    <a class="brand" href="index.html"><span class="brand-mark">t</span>tatame</a>
    <a class="btn btn-primary btn-block" href="registrar.html" style="margin-bottom:12px"><i data-lucide="plus"></i>Registrar treino</a>
    ${NAV.filter((n) => !n.cta).map((n) => navLink(n, page)).join("")}
    <div class="nav-label">Ferramentas</div>
    ${NAV_EXTRA.map((n) => navLink(n, page)).join("")}
    <div class="sidebar-foot stack">
      <div class="card card-pad stack" style="gap:8px">
        <div class="row"><i data-lucide="heart"></i><b>Projeto open source</b></div>
        <p class="small muted">Sem anúncios e sem paywall. Mantido por doações.</p>
        <a class="btn btn-sm" href="apoie.html">Apoiar</a>
      </div>
      <button class="nav-item btn-ghost" style="border:0;background:none;font:inherit;cursor:pointer" data-theme-toggle><i data-lucide="sun-moon"></i>Tema claro/escuro</button>
    </div>`;
  document.body.prepend(sidebar);

  const dock = document.createElement("nav");
  dock.className = "dock";
  dock.setAttribute("aria-label", "Navegação principal");
  dock.innerHTML = NAV.map((n) => {
    const current = n.id === page ? ' aria-current="page"' : "";
    return n.cta
      ? `<a class="dock-cta" href="${n.href}" aria-label="${n.label}"${current}><i data-lucide="${n.icon}"></i></a>`
      : `<a href="${n.href}"${current}><i data-lucide="${n.icon}"></i>${n.label}</a>`;
  }).join("");
  document.body.append(dock);
}

// Calendário de treinos: 26 semanas, valores determinísticos para o wireframe ficar estável.
function fillHeatmaps() {
  document.querySelectorAll("[data-heatmap]").forEach((el) => {
    const weeks = Number(el.dataset.heatmap) || 26;
    let seed = 7;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const cells = [];
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const trainingDay = [1, 2, 3, 4, 5].includes(d) ? rand() > 0.35 : rand() > 0.85;
        const level = trainingDay ? 1 + Math.floor(rand() * 4) : 0;
        cells.push(`<i data-l="${level}" title="semana ${w + 1}, dia ${d + 1}"></i>`);
      }
    }
    el.innerHTML = cells.join("");
  });
}

function wireInteractions() {
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-theme-toggle],.oss,[data-step]");
    if (!t) return;
    if (t.matches("[data-theme-toggle]")) toggleTheme();
    if (t.matches(".oss")) {
      const on = t.getAttribute("aria-pressed") === "true";
      t.setAttribute("aria-pressed", String(!on));
      const count = t.querySelector("[data-count]");
      if (count) count.textContent = Number(count.textContent) + (on ? -1 : 1);
    }
    if (t.matches("[data-step]")) {
      const out = t.parentElement.querySelector("output");
      const min = Number(out.dataset.min ?? 0);
      out.value = out.textContent = Math.max(min, Number(out.textContent) + Number(t.dataset.step));
    }
  });

  document.querySelectorAll("[data-rpe]").forEach((input) => {
    const labels = ["", "Muito leve", "Leve", "Leve", "Moderado", "Moderado", "Puxado", "Puxado", "Muito puxado", "Máximo", "Máximo"];
    const out = document.querySelector(input.dataset.rpe);
    const sync = () => (out.textContent = `${input.value} · ${labels[input.value]}`);
    input.addEventListener("input", sync);
    sync();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  buildShell();
  fillHeatmaps();
  wireInteractions();
  if (window.lucide) window.lucide.createIcons();
});

// modules/search.js
// Busca global transversal. Aberta pela lupa da topbar, de qualquer tela.
// Observa os quatro módulos e filtra pelo campo searchText (já populado em
// cada item). Resultados agrupados por tipo, com navegação para a tela.

import { watchNotes } from "./notes-data.js";
import { watchTasks } from "./tasks-data.js";
import { watchProjects } from "./projects-data.js";
import { watchRoutines } from "./routines-data.js";
import { escapeHtml, normalizeSearch, debounce } from "../lib/util.js";
import { icons } from "../lib/icons.js";
import { navigate } from "../router.js";

let isOpen = false;

export function openSearch(uid) {
  if (isOpen) return;
  isOpen = true;

  const overlay = document.createElement("div");
  overlay.className = "search-overlay";
  overlay.innerHTML = `
    <div class="search-bar">
      <span class="search-bar-icon">${icons.search}</span>
      <input id="gs-input" type="search" placeholder="Buscar em tudo…" autocomplete="off" />
      <button class="search-close" id="gs-close" aria-label="Fechar">${icons.close}</button>
    </div>
    <div id="gs-results" class="search-results">
      <p class="search-hint">Digite para buscar em tarefas, notas, projetos e rotinas.</p>
    </div>
  `;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const inputEl = overlay.querySelector("#gs-input");
  const resultsEl = overlay.querySelector("#gs-results");

  // Estado dos quatro módulos, atualizado em tempo real enquanto a busca abre.
  const state = { notes: [], tasks: [], projects: [], routines: [] };
  const unsubs = [
    watchNotes(uid, (v) => { state.notes = v; run(); }),
    watchTasks(uid, (v) => { state.tasks = v; run(); }),
    watchProjects(uid, (v) => { state.projects = v; run(); }),
    watchRoutines(uid, (v) => { state.routines = v; run(); }),
  ];

  function close() {
    if (!isOpen) return;
    isOpen = false;
    unsubs.forEach((u) => u && u());
    document.body.style.overflow = "";
    overlay.remove();
    window.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  window.addEventListener("keydown", onKey);

  overlay.querySelector("#gs-close").addEventListener("click", close);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });

  // Navega para a tela do item e fecha a busca.
  function go(route) { close(); navigate(route); }

  const run = () => renderResults(resultsEl, state, inputEl.value, go);
  inputEl.addEventListener("input", debounce(run, 150));

  inputEl.focus();
}

function renderResults(el, state, term, go) {
  const q = normalizeSearch(term || "");
  if (!q) {
    el.innerHTML = `<p class="search-hint">Digite para buscar em tarefas, notas, projetos e rotinas.</p>`;
    return;
  }

  const match = (item) => (item.searchText || "").includes(q);
  const groups = [
    {
      label: "Tarefas", icon: icons.tarefas, route: "/tarefas",
      items: state.tasks.filter(match), title: (x) => x.title,
    },
    {
      label: "Projetos", icon: icons.folder, route: "/projetos",
      items: state.projects.filter(match), title: (x) => x.name,
    },
    {
      label: "Notas", icon: icons.book, route: "/conhecimento",
      items: state.notes.filter(match),
      title: (x) => x.title || (x.body || "").slice(0, 50) || "(sem título)",
    },
    {
      label: "Rotinas", icon: icons.rotinas, route: "/rotinas",
      items: state.routines.filter(match), title: (x) => x.name,
    },
  ];

  const total = groups.reduce((s, g) => s + g.items.length, 0);
  if (total === 0) {
    el.innerHTML = `<p class="search-hint">Nada encontrado para “${escapeHtml(term)}”.</p>`;
    return;
  }

  let html = "";
  for (const g of groups) {
    if (!g.items.length) continue;
    html += `<div class="section-title">${g.label} (${g.items.length})</div>`;
    html += `<div class="search-group">` + g.items.slice(0, 20).map((it) => `
      <div class="search-item" data-route="${g.route}">
        <span class="search-item-icon">${g.icon}</span>
        <span class="search-item-name">${escapeHtml(g.title(it))}</span>
      </div>`).join("") + `</div>`;
  }
  el.innerHTML = html;

  el.querySelectorAll(".search-item").forEach((row) => {
    row.addEventListener("click", () => go(row.dataset.route));
  });
}

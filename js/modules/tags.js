// modules/tags.js
// Visão transversal de Tags. Não possui coleção própria: agrega as tags já
// existentes em notas, tarefas, projetos e rotinas, e mostra tudo que carrega
// uma tag, agrupado por módulo. Toque num item leva à sua tela.

import { watchNotes } from "./notes-data.js";
import { watchTasks } from "./tasks-data.js";
import { watchProjects } from "./projects-data.js";
import { watchRoutines } from "./routines-data.js";
import { escapeHtml } from "../lib/util.js";
import { icons } from "../lib/icons.js";
import { navigate } from "../router.js";

// Tag atualmente selecionada (sessão). null = mostra a nuvem de tags.
let selectedTag = null;

export function renderTags(container, ctx) {
  const { uid } = ctx;
  container.innerHTML = `<div id="tags-view"><p class="empty">Carregando…</p></div>`;
  const viewEl = document.getElementById("tags-view");

  const state = { notes: null, tasks: null, projects: null, routines: null };
  function ready() {
    return state.notes && state.tasks && state.projects && state.routines;
  }
  function paint() {
    if (!ready()) return;
    renderTagsView(viewEl, state);
  }

  const unsubN = watchNotes(uid, (v) => { state.notes = v; paint(); });
  const unsubT = watchTasks(uid, (v) => { state.tasks = v; paint(); });
  const unsubP = watchProjects(uid, (v) => { state.projects = v; paint(); });
  const unsubR = watchRoutines(uid, (v) => { state.routines = v; paint(); });

  return () => { unsubN(); unsubT(); unsubP(); unsubR(); };
}

// Monta um índice { tag: { notes:[], tasks:[], projects:[], routines:[] } }.
function buildIndex(state) {
  const index = {};
  const add = (tag, kind, item) => {
    if (!index[tag]) index[tag] = { notes: [], tasks: [], projects: [], routines: [] };
    index[tag][kind].push(item);
  };
  (state.notes || []).forEach((n) => (n.tags || []).forEach((t) => add(t, "notes", n)));
  (state.tasks || []).forEach((t) => (t.tags || []).forEach((tag) => add(tag, "tasks", t)));
  (state.projects || []).forEach((p) => (p.tags || []).forEach((t) => add(t, "projects", p)));
  (state.routines || []).forEach((r) => (r.tags || []).forEach((t) => add(t, "routines", r)));
  return index;
}

function renderTagsView(el, state) {
  const index = buildIndex(state);
  const tags = Object.keys(index).sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (tags.length === 0) {
    el.innerHTML = `
      <div class="empty" style="margin-top:36px">
        <strong style="display:block;color:var(--text-soft);font-size:1.05rem;margin-bottom:6px">Nenhuma tag ainda</strong>
        Adicione tags a notas, tarefas, projetos e rotinas para vê-las reunidas aqui.
      </div>`;
    return;
  }

  // Se a tag selecionada não existe mais, volta para a nuvem.
  if (selectedTag && !index[selectedTag]) selectedTag = null;

  if (!selectedTag) {
    // Nuvem de tags com contagem total.
    el.innerHTML = `
      <p class="list-sub" style="margin:8px 2px 14px">${tags.length} tag${tags.length > 1 ? "s" : ""}</p>
      <div class="tag-cloud">
        ${tags.map((t) => {
          const g = index[t];
          const total = g.notes.length + g.tasks.length + g.projects.length + g.routines.length;
          return `<button class="tag-cloud-item" data-tag="${escapeHtml(t)}">
            <span class="tag-cloud-name">#${escapeHtml(t)}</span>
            <span class="tag-cloud-count">${total}</span>
          </button>`;
        }).join("")}
      </div>`;
    el.querySelectorAll(".tag-cloud-item").forEach((btn) => {
      btn.addEventListener("click", () => { selectedTag = btn.dataset.tag; renderTagsView(el, state); });
    });
    return;
  }

  // Detalhe de uma tag: tudo que a carrega, agrupado por módulo.
  const g = index[selectedTag];
  const sections = [
    { key: "tasks", label: "Tarefas", icon: icons.tarefas, route: "/tarefas", title: (x) => x.title },
    { key: "projects", label: "Projetos", icon: icons.folder, route: "/projetos", title: (x) => x.name },
    { key: "notes", label: "Notas", icon: icons.book, route: "/conhecimento", title: (x) => x.title || (x.body || "").slice(0, 40) || "(sem título)" },
    { key: "routines", label: "Rotinas", icon: icons.rotinas, route: "/rotinas", title: (x) => x.name },
  ];

  let html = `
    <button class="tag-back" id="tag-back">${icons.chevron} <span>Todas as tags</span></button>
    <h2 class="tag-detail-title">#${escapeHtml(selectedTag)}</h2>`;

  let any = false;
  for (const sec of sections) {
    const items = g[sec.key];
    if (!items.length) continue;
    any = true;
    html += `<div class="section-title">${sec.label} (${items.length})</div>`;
    html += `<div class="tag-items">` + items.map((it) => `
      <div class="tag-item" data-route="${sec.route}">
        <span class="tag-item-icon">${sec.icon}</span>
        <span class="tag-item-name">${escapeHtml(sec.title(it))}</span>
      </div>`).join("") + `</div>`;
  }
  if (!any) html += `<p class="empty">Nada com esta tag.</p>`;

  el.innerHTML = html;
  el.querySelector("#tag-back").addEventListener("click", () => { selectedTag = null; renderTagsView(el, state); });
  el.querySelectorAll(".tag-item").forEach((row) => {
    row.addEventListener("click", () => navigate(row.dataset.route));
  });
}

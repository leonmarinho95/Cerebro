// modules/tasks.js
// Tela de Tarefas. Lista agrupada (Atrasadas / Hoje / Em breve / Sem data /
// Concluídas) em tempo real, com concluir inline, adiar e criar/editar.

import {
  watchTasks, createTask, updateTask, setTaskDone, snoozeTask,
  archiveTask, deleteTask, archiveTasksBatch,
} from "./tasks-data.js";
import { watchProjects } from "./projects-data.js";
import { groupTasks, taskDateState } from "./tasks-logic.js";
import { openModal, toast, confirmModal } from "../lib/ui.js";
import { escapeHtml } from "../lib/util.js";
import { todayKey, relativeDayLabel } from "../lib/dates.js";
import { icons } from "../lib/icons.js";

const SECTIONS = [
  { key: "overdue", label: "Atrasadas" },
  { key: "today", label: "Hoje" },
  { key: "upcoming", label: "Em breve" },
  { key: "nodate", label: "Sem data" },
];

// Preferência de sessão: mostrar ou ocultar as tarefas concluídas.
let showDone = false;

export function renderTasks(container, ctx) {
  const { uid } = ctx;
  container.innerHTML = `
    <div class="list-head">
      <p class="list-sub" id="tasks-sub">Carregando…</p>
      <button class="btn-add" id="add-task">${icons.plus}<span>Nova tarefa</span></button>
    </div>
    <div id="tasks-list"></div>
  `;

  document.getElementById("add-task").addEventListener("click", () => openTaskForm(uid));

  const listEl = document.getElementById("tasks-list");
  const subEl = document.getElementById("tasks-sub");

  // Estado: tarefas + mapa de projetos (para o selo de projeto nas linhas).
  const state = { tasks: null, projectMap: {} };

  function paint() {
    if (state.tasks === null) return;
    const groups = groupTasks(state.tasks, todayKey());
    renderList(listEl, subEl, uid, groups, state.projectMap);
  }

  const unsubT = watchTasks(uid, (tasks) => { state.tasks = tasks; paint(); });
  const unsubP = watchProjects(uid, (projects) => {
    const map = {};
    projects.forEach((p) => { map[p.id] = { name: p.name, color: p.color }; });
    state.projectMap = map;
    paint();
  });

  return () => { unsubT(); unsubP(); };
}

// Dentro de cada grupo de urgência, agrupa por projeto: soltas primeiro,
// depois as de cada projeto juntas. Preserva a ordem de entrada dos itens
// (que já vem ordenada por data pela lógica de agrupamento).
function orderByProject(items) {
  const loose = items.filter((t) => !t.projectId);
  const withProj = items.filter((t) => t.projectId);
  // Estável: agrupa por projectId preservando a ordem relativa original.
  const seen = [];
  const byProj = {};
  for (const t of withProj) {
    if (!byProj[t.projectId]) { byProj[t.projectId] = []; seen.push(t.projectId); }
    byProj[t.projectId].push(t);
  }
  const grouped = seen.flatMap((pid) => byProj[pid]);
  return [...loose, ...grouped];
}

function renderList(listEl, subEl, uid, groups, projectMap = {}) {
  const openCount = groups.overdue.length + groups.today.length + groups.upcoming.length + groups.nodate.length;
  const parts = [];
  if (groups.overdue.length) parts.push(`${groups.overdue.length} atrasada${groups.overdue.length > 1 ? "s" : ""}`);
  if (groups.today.length) parts.push(`${groups.today.length} hoje`);
  subEl.textContent = openCount === 0 ? "nada pendente" : (parts.join(" · ") || `${openCount} pendente${openCount > 1 ? "s" : ""}`);

  if (openCount === 0 && groups.done.length === 0) {
    listEl.innerHTML = `
      <div class="empty" style="margin-top:36px">
        <strong style="display:block;color:var(--text-soft);font-size:1.05rem;margin-bottom:6px">Nenhuma tarefa</strong>
        Toque em “Nova tarefa” ou use o botão + para capturar rapidamente.
      </div>`;
    return;
  }

  let html = "";
  for (const sec of SECTIONS) {
    const items = groups[sec.key];
    if (!items.length) continue;
    html += `<div class="section-title">${sec.label}</div>`;
    html += orderByProject(items).map((t) => taskRow(t, projectMap)).join("");
  }

  // Seção Concluídas: recolhível, com ação de arquivar todas.
  if (groups.done.length) {
    html += `
      <div class="done-head">
        <button class="done-toggle" id="done-toggle">
          <span class="done-chevron ${showDone ? "open" : ""}">${icons.chevronDown}</span>
          Concluídas (${groups.done.length})
        </button>
        ${showDone ? `<button class="done-archive" id="done-archive">Arquivar todas</button>` : ""}
      </div>`;
    if (showDone) {
      html += groups.done.map((t) => taskRow(t, projectMap)).join("");
    }
  }

  listEl.innerHTML = html;

  // Toggle mostrar/ocultar concluídas
  const toggle = document.getElementById("done-toggle");
  if (toggle) toggle.addEventListener("click", () => {
    showDone = !showDone;
    renderList(listEl, subEl, uid, groups, projectMap);
  });
  // Arquivar todas as concluídas (em massa, via batch)
  const archiveAll = document.getElementById("done-archive");
  if (archiveAll) archiveAll.addEventListener("click", async () => {
    const n = groups.done.length;
    const ok = await confirmModal(
      `Arquivar ${n} tarefa${n > 1 ? "s" : ""} concluída${n > 1 ? "s" : ""}? Elas somem da lista, mas o histórico é preservado.`,
      { okLabel: "Arquivar" }
    );
    if (!ok) return;
    try {
      await archiveTasksBatch(uid, groups.done.map((t) => t.id));
      toast(`${n} arquivada${n > 1 ? "s" : ""}`);
    } catch (err) { console.error(err); toast("Erro ao arquivar"); }
  });

  // Liga ações das linhas visíveis
  const visible = [...groups.overdue, ...groups.today, ...groups.upcoming, ...groups.nodate];
  if (showDone) visible.push(...groups.done);
  listEl.querySelectorAll(".task-row").forEach((row) => {
    const id = row.dataset.id;
    const task = visible.find((t) => t.id === id);
    if (!task) return;
    row.querySelector(".task-check").addEventListener("click", (e) => {
      e.stopPropagation();
      setTaskDone(uid, id, task.status !== "done").catch(() => toast("Erro"));
    });
    row.querySelector(".task-main").addEventListener("click", () => openTaskForm(uid, task));
    const snooze = row.querySelector(".task-snooze");
    if (snooze) snooze.addEventListener("click", (e) => {
      e.stopPropagation();
      snoozeTask(uid, task).then(() => toast("Adiada para amanhã")).catch(() => toast("Erro"));
    });
  });
}

function taskRow(t, projectMap = {}) {
  const done = t.status === "done";
  const state = taskDateState(t);
  const meta = [];
  if (!done && t.dueDate) {
    meta.push(`<span class="task-badge state-${state}">${relativeDayLabel(t.dueDate)}</span>`);
  }
  // Selo do projeto (cor + nome) quando a tarefa pertence a um projeto.
  const proj = t.projectId ? projectMap[t.projectId] : null;
  if (proj) {
    meta.push(`<span class="task-proj"><span class="task-proj-dot" style="background:${proj.color}"></span>${escapeHtml(proj.name)}</span>`);
  }
  const snoozeBtn = !done
    ? `<button class="task-snooze" aria-label="Adiar para amanhã">${icons.snooze}</button>`
    : "";

  return `
    <div class="task-row ${done ? "is-done" : `state-${state}`}" data-id="${t.id}">
      <button class="task-check ${done ? "checked" : ""}" aria-label="${done ? "Reabrir" : "Concluir"}">
        ${icons.checkSmall}
      </button>
      <div class="task-main">
        <div class="task-title">${escapeHtml(t.title)}</div>
        ${meta.length ? `<div class="task-meta">${meta.join("")}</div>` : ""}
      </div>
      ${snoozeBtn}
    </div>`;
}

// ---- Formulário de criação / edição ----
function openTaskForm(uid, task = null) {
  const editing = !!task;
  const due = task?.dueDate || "";

  const { close } = openModal(`
    <h2 class="modal-title">${editing ? "Editar tarefa" : "Nova tarefa"}</h2>
    <label class="field">
      <span class="field-label">Título</span>
      <input id="t-title" type="text" placeholder="O que precisa ser feito?" value="${editing ? escapeHtml(task.title) : ""}" />
    </label>
    <label class="field">
      <span class="field-label">Vencimento (opcional)</span>
      <input id="t-due" type="date" value="${due}" />
      <div class="chip-row" style="margin-top:8px">
        <button type="button" class="chip" id="t-today">Hoje</button>
        <button type="button" class="chip" id="t-tomorrow">Amanhã</button>
        <button type="button" class="chip" id="t-clear">Sem data</button>
      </div>
    </label>
    <div class="modal-actions">
      ${editing ? '<button class="btn-ghost" id="t-delete">Excluir</button>' : "<span></span>"}
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" id="t-cancel">Cancelar</button>
        <button class="btn-primary" id="t-save">${editing ? "Salvar" : "Criar"}</button>
      </div>
    </div>
  `);

  const titleEl = document.getElementById("t-title");
  const dueEl = document.getElementById("t-due");
  document.getElementById("t-today").addEventListener("click", () => { dueEl.value = todayKey(); });
  document.getElementById("t-tomorrow").addEventListener("click", () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    dueEl.value = d.toISOString().slice(0, 10);
  });
  document.getElementById("t-clear").addEventListener("click", () => { dueEl.value = ""; });

  document.getElementById("t-cancel").addEventListener("click", close);
  document.getElementById("t-save").addEventListener("click", async () => {
    const title = titleEl.value.trim();
    if (!title) { titleEl.focus(); toast("Dê um título à tarefa"); return; }
    const dueDate = dueEl.value || null;
    try {
      if (editing) { await updateTask(uid, task.id, { title, dueDate }); toast("Tarefa atualizada"); }
      else { await createTask(uid, { title, dueDate }); toast("Tarefa criada"); }
      close();
    } catch (err) { console.error(err); toast("Erro ao salvar"); }
  });

  if (editing) {
    document.getElementById("t-delete").addEventListener("click", async () => {
      const ok = await confirmModal(`Excluir “${escapeHtml(task.title)}”?`, { okLabel: "Excluir", danger: true });
      if (!ok) return;
      try { await deleteTask(uid, task.id); toast("Tarefa excluída"); close(); }
      catch (err) { console.error(err); toast("Erro ao excluir"); }
    });
  }
}

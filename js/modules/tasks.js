// modules/tasks.js
// Tela de Tarefas. Lista agrupada (Atrasadas / Hoje / Em breve / Sem data /
// Concluídas) em tempo real, com concluir inline, adiar e criar/editar.

import {
  watchTasks, createTask, updateTask, setTaskDone, snoozeTask,
  archiveTask, deleteTask, archiveTasksBatch, setTaskDoneOnDate, updateChecklist,
} from "./tasks-data.js";
import { watchProjects } from "./projects-data.js";
import { groupTasks, taskDateState } from "./tasks-logic.js";
import { openModal, toast, confirmModal } from "../lib/ui.js";
import { escapeHtml, parseTags } from "../lib/util.js";
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

    // Checklist inline: expandir/recolher
    const clToggle = row.querySelector(".task-cl-summary");
    if (clToggle) clToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const items = row.querySelector(".task-cl-items");
      const open = items.style.display !== "none";
      items.style.display = open ? "none" : "block";
      clToggle.querySelector(".cl-caret").classList.toggle("open", !open);
    });
    // Marcar item do checklist inline (salva no Firestore)
    row.querySelectorAll(".checklist-box[data-cl-check]").forEach((box) => {
      box.addEventListener("click", (e) => {
        e.stopPropagation();
        const i = +box.dataset.i;
        const items = (task.checklist || []).map((it) => ({ text: it.text, done: !!it.done }));
        if (!items[i]) return;
        items[i].done = !items[i].done;
        updateChecklist(uid, id, items).catch(() => toast("Erro"));
      });
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
  // Tags da tarefa
  (t.tags || []).forEach((tag) => {
    meta.push(`<span class="note-tag">#${escapeHtml(tag)}</span>`);
  });
  const snoozeBtn = !done
    ? `<button class="task-snooze" aria-label="Adiar para amanhã">${icons.snooze}</button>`
    : "";

  // Checklist (lista interna): resumo tocável que expande os itens.
  const cl = t.checklist || [];
  let checklistHtml = "";
  if (cl.length) {
    const doneCount = cl.filter((i) => i.done).length;
    checklistHtml = `
      <div class="task-checklist" data-cl-id="${t.id}">
        <button class="task-cl-summary" data-cl-toggle="${t.id}">
          ${icons.checkSmall}<span>${doneCount}/${cl.length} subitens</span>
          <span class="cl-caret">${icons.chevronDown}</span>
        </button>
        <div class="task-cl-items" data-cl-items="${t.id}" style="display:none">
          ${cl.map((it, i) => `
            <label class="task-cl-item">
              <button class="checklist-box sm ${it.done ? "checked" : ""}" data-cl-check="${t.id}" data-i="${i}" aria-label="Marcar">${it.done ? icons.checkSmall : ""}</button>
              <span class="${it.done ? "cl-done" : ""}">${escapeHtml(it.text)}</span>
            </label>`).join("")}
        </div>
      </div>`;
  }

  return `
    <div class="task-row ${done ? "is-done" : `state-${state}`}" data-id="${t.id}">
      <div class="task-row-head">
        <button class="task-check ${done ? "checked" : ""}" aria-label="${done ? "Reabrir" : "Concluir"}">
          ${icons.checkSmall}
        </button>
        <div class="task-main">
          <div class="task-title">${escapeHtml(t.title)}</div>
          ${meta.length ? `<div class="task-meta">${meta.join("")}</div>` : ""}
        </div>
        ${snoozeBtn}
      </div>
      ${checklistHtml}
    </div>`;
}

// ---- Formulário de criação / edição ----
function openTaskForm(uid, task = null) {
  const editing = !!task;
  const due = task?.dueDate || "";
  const tagsStr = (task?.tags || []).join(", ");
  // Cópia local do checklist, editada no formulário e salva junto.
  let checklist = (task?.checklist || []).map((it) => ({ text: it.text, done: !!it.done }));
  const hasChecklist = checklist.length > 0;

  const { close, overlay } = openModal(`
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
    <label class="field">
      <span class="field-label">Tags (separadas por vírgula)</span>
      <input id="t-tags" type="text" placeholder="carro, casa" value="${escapeHtml(tagsStr)}" />
    </label>

    <div class="field">
      <div id="t-checklist-wrap" style="display:${hasChecklist ? "block" : "none"}">
        <span class="field-label">Subitens</span>
        <div id="t-checklist" class="checklist-edit"></div>
        <div class="checklist-add-row">
          <input id="t-check-new" type="text" placeholder="Adicionar item…" />
          <button type="button" class="btn-ghost" id="t-check-add">Adicionar</button>
        </div>
      </div>
      <button type="button" class="link-btn" id="t-checklist-toggle" style="display:${hasChecklist ? "none" : "inline-flex"}">
        ${icons.plus} Adicionar subitens
      </button>
    </div>

    ${editing ? `
    <div class="field">
      <button type="button" class="link-btn" id="t-done-other">${icons.checkSmall} Concluir em outra data…</button>
      <div id="t-done-other-row" class="checklist-add-row" style="display:none">
        <input id="t-done-date" type="date" value="${todayKey()}" />
        <button type="button" class="btn-primary" id="t-done-confirm">Concluir</button>
      </div>
    </div>` : ""}

    <div class="modal-actions">
      ${editing ? '<button class="btn-ghost" id="t-delete">Excluir</button>' : "<span></span>"}
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" id="t-cancel">Cancelar</button>
        <button class="btn-primary" id="t-save">${editing ? "Salvar" : "Criar"}</button>
      </div>
    </div>
  `);

  const titleEl = overlay.querySelector("#t-title");
  const dueEl = overlay.querySelector("#t-due");
  overlay.querySelector("#t-today").addEventListener("click", () => { dueEl.value = todayKey(); });
  overlay.querySelector("#t-tomorrow").addEventListener("click", () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    dueEl.value = d.toISOString().slice(0, 10);
  });
  overlay.querySelector("#t-clear").addEventListener("click", () => { dueEl.value = ""; });

  // ----- Checklist (lista interna) -----
  const wrapEl = overlay.querySelector("#t-checklist-wrap");
  const listEl = overlay.querySelector("#t-checklist");
  const toggleEl = overlay.querySelector("#t-checklist-toggle");
  const newEl = overlay.querySelector("#t-check-new");

  function renderChecklist() {
    listEl.innerHTML = checklist.map((it, i) => `
      <div class="checklist-edit-item">
        <button type="button" class="checklist-box ${it.done ? "checked" : ""}" data-i="${i}" aria-label="Marcar">${it.done ? icons.checkSmall : ""}</button>
        <input class="checklist-text ${it.done ? "done" : ""}" data-i="${i}" type="text" value="${escapeHtml(it.text)}" />
        <button type="button" class="checklist-del" data-i="${i}" aria-label="Remover">${icons.close}</button>
      </div>`).join("");
    listEl.querySelectorAll(".checklist-box").forEach((b) => b.addEventListener("click", () => {
      const i = +b.dataset.i; checklist[i].done = !checklist[i].done; renderChecklist();
    }));
    listEl.querySelectorAll(".checklist-text").forEach((inp) => inp.addEventListener("input", () => {
      checklist[+inp.dataset.i].text = inp.value;
    }));
    listEl.querySelectorAll(".checklist-del").forEach((d) => d.addEventListener("click", () => {
      checklist.splice(+d.dataset.i, 1); renderChecklist();
    }));
  }
  function addItem() {
    const t = newEl.value.trim();
    if (!t) return;
    checklist.push({ text: t, done: false });
    newEl.value = "";
    renderChecklist();
    newEl.focus();
  }
  if (toggleEl) toggleEl.addEventListener("click", () => {
    wrapEl.style.display = "block";
    toggleEl.style.display = "none";
    newEl.focus();
  });
  overlay.querySelector("#t-check-add")?.addEventListener("click", addItem);
  newEl?.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } });
  renderChecklist();

  // ----- Concluir em outra data (só edição) -----
  if (editing) {
    const otherToggle = overlay.querySelector("#t-done-other");
    const otherRow = overlay.querySelector("#t-done-other-row");
    otherToggle.addEventListener("click", () => {
      const showing = otherRow.style.display !== "none";
      otherRow.style.display = showing ? "none" : "flex";
    });
    overlay.querySelector("#t-done-confirm").addEventListener("click", async () => {
      const day = overlay.querySelector("#t-done-date").value;
      if (!day) { toast("Escolha uma data"); return; }
      try {
        // Salva primeiro o checklist/edições pendentes, depois conclui na data.
        await setTaskDoneOnDate(uid, task.id, day);
        toast("Concluída em " + day.split("-").reverse().join("/"));
        close();
      } catch (err) { console.error(err); toast("Erro ao concluir"); }
    });
  }

  overlay.querySelector("#t-cancel").addEventListener("click", close);
  overlay.querySelector("#t-save").addEventListener("click", async () => {
    const title = titleEl.value.trim();
    if (!title) { titleEl.focus(); toast("Dê um título à tarefa"); return; }
    const dueDate = dueEl.value || null;
    const tags = parseTags(overlay.querySelector("#t-tags").value);
    // Remove itens de checklist vazios antes de salvar.
    const cleanChecklist = checklist.filter((it) => it.text.trim()).map((it) => ({ text: it.text.trim(), done: it.done }));
    try {
      if (editing) { await updateTask(uid, task.id, { title, dueDate, tags, checklist: cleanChecklist }); toast("Tarefa atualizada"); }
      else { await createTask(uid, { title, dueDate, tags, checklist: cleanChecklist }); toast("Tarefa criada"); }
      close();
    } catch (err) { console.error(err); toast("Erro ao salvar"); }
  });

  if (editing) {
    overlay.querySelector("#t-delete").addEventListener("click", async () => {
      const ok = await confirmModal(`Excluir “${escapeHtml(task.title)}”?`, { okLabel: "Excluir", danger: true });
      if (!ok) return;
      try { await deleteTask(uid, task.id); toast("Tarefa excluída"); close(); }
      catch (err) { console.error(err); toast("Erro ao excluir"); }
    });
  }
}

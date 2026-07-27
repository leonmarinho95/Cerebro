// modules/projects.js
// Tela de Projetos. Lista com progresso derivado (via contagem de tarefas) e
// detalhe do projeto com suas tarefas (concluir inline, adicionar vinculada).

import {
  watchProjects, createProject, updateProject, setProjectDone,
  archiveProject, deleteProject, PROJECT_COLORS,
} from "./projects-data.js";
import { projectProgress, compareProjects } from "./projects-logic.js";
import {
  watchTasks, watchProjectTasks, createTask, setTaskDone,
  updateTask, snoozeTask, deleteTask, swapTaskOrder,
} from "./tasks-data.js";
import { taskDateState } from "./tasks-logic.js";
import { openModal, toast, confirmModal } from "../lib/ui.js";
import { escapeHtml, parseTags } from "../lib/util.js";
import { relativeDayLabel, todayKey } from "../lib/dates.js";
import { icons } from "../lib/icons.js";

export function renderProjects(container, ctx) {
  const { uid } = ctx;
  container.innerHTML = `
    <div class="list-head">
      <p class="list-sub" id="proj-sub">Carregando…</p>
      <button class="btn-add" id="add-proj">${icons.plus}<span>Novo projeto</span></button>
    </div>
    <div id="proj-list"></div>
  `;
  document.getElementById("add-proj").addEventListener("click", () => openProjectForm(uid));

  const listEl = document.getElementById("proj-list");
  const subEl = document.getElementById("proj-sub");

  // Dois listeners: projetos + todas as tarefas (para derivar progresso).
  const state = { projects: null, tasks: null };
  function paint() {
    if (state.projects === null || state.tasks === null) return;
    renderProjectList(listEl, subEl, uid, state);
  }
  const unsubP = watchProjects(uid, (p) => { state.projects = p; paint(); });
  const unsubT = watchTasks(uid, (t) => { state.tasks = t; paint(); });
  return () => { unsubP(); unsubT(); };
}

function tasksByProject(tasks, projectId) {
  return tasks.filter((t) => t.projectId === projectId && t.status !== "archived");
}

function renderProjectList(listEl, subEl, uid, state) {
  const projects = [...state.projects].sort(compareProjects);
  const active = projects.filter((p) => p.status === "active").length;
  subEl.textContent = projects.length === 0
    ? ""
    : `${active} ativo${active !== 1 ? "s" : ""}`;

  if (projects.length === 0) {
    listEl.innerHTML = `
      <div class="empty" style="margin-top:36px">
        <strong style="display:block;color:var(--text-soft);font-size:1.05rem;margin-bottom:6px">Nenhum projeto ainda</strong>
        Agrupe tarefas de uma frente pessoal — “Reforma da garagem”, “Viagem”, o que tiver várias etapas.
      </div>`;
    return;
  }

  listEl.innerHTML = projects.map((p) => {
    const prog = projectProgress(tasksByProject(state.tasks, p.id));
    const done = p.status === "done";
    return `
      <div class="proj-row ${done ? "is-done" : ""}" data-id="${p.id}">
        <span class="proj-color" style="background:${p.color}"></span>
        <div class="proj-main">
          <div class="proj-name">${escapeHtml(p.name)}${done ? " ✓" : ""}</div>
          <div class="proj-progress">
            <div class="bar"><div class="bar-fill" style="width:${prog.pct}%;background:${p.color}"></div></div>
            <span class="proj-count">${prog.done}/${prog.total}</span>
          </div>
        </div>
      </div>`;
  }).join("");

  listEl.querySelectorAll(".proj-row").forEach((row) => {
    const p = state.projects.find((x) => x.id === row.dataset.id);
    row.addEventListener("click", () => openProjectDetail(uid, p));
  });
}

// ---- Formulário de criação / edição ----
function openProjectForm(uid, project = null) {
  const editing = !!project;
  const color = project?.color || PROJECT_COLORS[0];
  const tagsStr = (project?.tags || []).join(", ");
  const { close } = openModal(`
    <h2 class="modal-title">${editing ? "Editar projeto" : "Novo projeto"}</h2>
    <label class="field">
      <span class="field-label">Nome</span>
      <input id="p-name" type="text" placeholder="Ex.: Reforma da garagem" value="${editing ? escapeHtml(project.name) : ""}" />
    </label>
    <label class="field">
      <span class="field-label">Descrição (opcional)</span>
      <textarea id="p-desc" rows="2" style="resize:none" placeholder="Uma linha sobre o objetivo">${editing ? escapeHtml(project.description || "") : ""}</textarea>
    </label>
    <div class="field">
      <span class="field-label">Cor</span>
      <div class="color-row" id="p-colors">
        ${PROJECT_COLORS.map((c) => `<button type="button" class="swatch ${c === color ? "sel" : ""}" data-c="${c}" style="background:${c}"></button>`).join("")}
      </div>
    </div>
    <label class="field">
      <span class="field-label">Tags (separadas por vírgula)</span>
      <input id="p-tags" type="text" placeholder="casa, reforma" value="${escapeHtml(tagsStr)}" />
    </label>
    <div class="modal-actions">
      ${editing ? '<button class="btn-ghost" id="p-delete">Excluir</button>' : "<span></span>"}
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" id="p-cancel">Cancelar</button>
        <button class="btn-primary" id="p-save">${editing ? "Salvar" : "Criar"}</button>
      </div>
    </div>
  `);

  let chosen = color;
  const nameEl = document.getElementById("p-name");
  document.getElementById("p-colors").addEventListener("click", (e) => {
    const b = e.target.closest(".swatch");
    if (!b) return;
    chosen = b.dataset.c;
    document.querySelectorAll("#p-colors .swatch").forEach((s) => s.classList.toggle("sel", s === b));
  });
  document.getElementById("p-cancel").addEventListener("click", close);
  document.getElementById("p-save").addEventListener("click", async () => {
    const name = nameEl.value.trim();
    if (!name) { nameEl.focus(); toast("Dê um nome ao projeto"); return; }
    const description = document.getElementById("p-desc").value;
    const tags = parseTags(document.getElementById("p-tags").value);
    try {
      if (editing) { await updateProject(uid, project.id, { name, description, color: chosen, tags }); toast("Projeto atualizado"); }
      else { await createProject(uid, { name, description, color: chosen, tags }); toast("Projeto criado"); }
      close();
    } catch (err) { console.error(err); toast("Erro ao salvar"); }
  });
  if (editing) {
    document.getElementById("p-delete").addEventListener("click", async () => {
      const ok = await confirmModal(
        `Excluir “${escapeHtml(project.name)}”? As tarefas vinculadas não são apagadas — apenas deixam de pertencer ao projeto.`,
        { okLabel: "Excluir", danger: true }
      );
      if (!ok) return;
      try { await deleteProject(uid, project.id); toast("Projeto excluído"); close(); }
      catch (err) { console.error(err); toast("Erro ao excluir"); }
    });
  }
}

// ---- Detalhe do projeto ----
function openProjectDetail(uid, project) {
  let unsub = null; // listener das tarefas do projeto; encerrado no onClose

  const { close, overlay } = openModal(`
    <div class="detail-head">
      <h2 class="modal-title" style="margin:0">${escapeHtml(project.name)}</h2>
      <button class="icon-btn" id="pd-edit" aria-label="Editar">${icons.pencil}</button>
    </div>
    ${project.description ? `<p class="detail-desc">${escapeHtml(project.description)}</p>` : ""}
    <div class="detail-progress" id="pd-progress"></div>

    <div class="pd-tasks-head">
      <h3 class="detail-section" style="margin:0">Tarefas</h3>
      <button class="btn-add sm" id="pd-add">${icons.plus}<span>Adicionar</span></button>
    </div>
    <div id="pd-tasks"><p class="empty">Carregando…</p></div>

    <div class="modal-actions">
      <button class="btn-ghost" id="pd-toggle">${project.status === "done" ? "Reabrir projeto" : "Concluir projeto"}</button>
      <button class="btn-primary" id="pd-close">Fechar</button>
    </div>
  `, { onClose: () => { if (unsub) unsub(); } });

  const tasksEl = overlay.querySelector("#pd-tasks");
  const progEl = overlay.querySelector("#pd-progress");

  overlay.querySelector("#pd-close").addEventListener("click", close);
  overlay.querySelector("#pd-edit").addEventListener("click", () => { close(); openProjectForm(uid, project); });
  overlay.querySelector("#pd-add").addEventListener("click", () => openInlineTaskForm(uid, project.id));
  overlay.querySelector("#pd-toggle").addEventListener("click", async () => {
    try {
      await setProjectDone(uid, project.id, project.status !== "done");
      toast(project.status === "done" ? "Projeto reaberto" : "Projeto concluído ✓");
      close();
    } catch (err) { console.error(err); toast("Erro"); }
  });

  // Listener em tempo real das tarefas do projeto (progresso + lista).
  unsub = watchProjectTasks(uid, project.id, (tasks) => {
    const prog = projectProgress(tasks);
    progEl.innerHTML = `
      <div class="bar"><div class="bar-fill" style="width:${prog.pct}%;background:${project.color}"></div></div>
      <span class="detail-pct">${prog.pct}% · ${prog.done}/${prog.total} tarefas</span>`;

    if (!tasks.length) {
      tasksEl.innerHTML = `<p class="empty" style="padding:12px 2px">Nenhuma tarefa neste projeto ainda.</p>`;
      return;
    }
    // Ordem no projeto: abertas por 'order' (posição manual); concluídas ao
    // final, por conclusão mais recente. Fallback p/ tarefas antigas sem order.
    const ord = (t) => (t.order ?? (t.createdAt?.seconds || 0) * 1000);
    const open = tasks.filter((t) => t.status !== "done").sort((a, b) => ord(a) - ord(b));
    const doneList = tasks.filter((t) => t.status === "done")
      .sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0));

    tasksEl.innerHTML = open.map((t, i) => pdTaskRow(t, i, open.length)).join("")
      + doneList.map((t) => pdTaskRow(t, -1, 0)).join("");

    tasksEl.querySelectorAll(".pd-task").forEach((row) => {
      const t = tasks.find((x) => x.id === row.dataset.id);
      // Concluir/reabrir pelo check
      row.querySelector(".task-check").addEventListener("click", (e) => {
        e.stopPropagation();
        setTaskDone(uid, t.id, t.status !== "done").catch(() => toast("Erro"));
      });
      // Editar tocando no título
      row.querySelector(".pd-task-title").addEventListener("click", () => openTaskEditForm(uid, t));
      // Subir / descer (reordenar) — troca a posição com o vizinho.
      // Passamos os valores de order EFETIVOS (com fallback), nunca undefined.
      const up = row.querySelector(".pd-up");
      const down = row.querySelector(".pd-down");
      const doSwap = (a, b) => {
        let oa = ord(a);
        let ob = ord(b);
        // Desempate: se os valores efetivos coincidirem, cria uma diferença
        // mínima para a troca produzir efeito visível.
        if (oa === ob) { oa = oa + 1; }
        swapTaskOrder(uid, a.id, oa, b.id, ob).catch((err) => {
          console.error(err); toast("Erro ao reordenar");
        });
      };
      if (up) up.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = open.findIndex((x) => x.id === t.id);
        if (idx > 0) doSwap(open[idx], open[idx - 1]);
      });
      if (down) down.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = open.findIndex((x) => x.id === t.id);
        if (idx < open.length - 1) doSwap(open[idx], open[idx + 1]);
      });
    });
  });
}

// Linha de tarefa no detalhe. index/total definem os botões de reordenar
// (só para abertas; index === -1 indica concluída, sem reordenação).
function pdTaskRow(t, index, total) {
  const done = t.status === "done";
  const state = taskDateState(t);
  const canReorder = index >= 0 && total > 1;
  const reorder = canReorder
    ? `<div class="pd-reorder">
         <button class="pd-up" aria-label="Subir" ${index === 0 ? "disabled" : ""}>${icons.chevronUp}</button>
         <button class="pd-down" aria-label="Descer" ${index === total - 1 ? "disabled" : ""}>${icons.chevronDown}</button>
       </div>`
    : "";
  return `
    <div class="pd-task ${done ? "is-done" : ""}" data-id="${t.id}">
      <button class="task-check ${done ? "checked" : ""}" aria-label="${done ? "Reabrir" : "Concluir"}">${icons.checkSmall}</button>
      <span class="pd-task-title">${escapeHtml(t.title)}</span>
      ${!done && t.dueDate ? `<span class="task-badge state-${state}">${relativeDayLabel(t.dueDate)}</span>` : ""}
      ${reorder}
    </div>`;
}

// Editor de tarefa dentro do contexto do projeto (título, data, adiar, excluir).
function openTaskEditForm(uid, task) {
  const due = task.dueDate || "";
  const { close } = openModal(`
    <h2 class="modal-title">Editar tarefa</h2>
    <label class="field">
      <span class="field-label">Título</span>
      <input id="et-title" type="text" value="${escapeHtml(task.title)}" />
    </label>
    <label class="field">
      <span class="field-label">Vencimento (opcional)</span>
      <input id="et-due" type="date" value="${due}" />
      <div class="chip-row" style="margin-top:8px">
        <button type="button" class="chip" id="et-today">Hoje</button>
        <button type="button" class="chip" id="et-tomorrow">Amanhã</button>
        <button type="button" class="chip" id="et-clear">Sem data</button>
      </div>
    </label>
    <div class="modal-actions">
      <button class="btn-ghost" id="et-delete">Excluir</button>
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" id="et-cancel">Cancelar</button>
        <button class="btn-primary" id="et-save">Salvar</button>
      </div>
    </div>
  `);

  const titleEl = document.getElementById("et-title");
  const dueEl = document.getElementById("et-due");
  document.getElementById("et-today").addEventListener("click", () => { dueEl.value = todayKey(); });
  document.getElementById("et-tomorrow").addEventListener("click", () => {
    const d = new Date(); d.setDate(d.getDate() + 1);
    dueEl.value = d.toISOString().slice(0, 10);
  });
  document.getElementById("et-clear").addEventListener("click", () => { dueEl.value = ""; });
  document.getElementById("et-cancel").addEventListener("click", close);
  document.getElementById("et-save").addEventListener("click", async () => {
    const title = titleEl.value.trim();
    if (!title) { titleEl.focus(); toast("Dê um título à tarefa"); return; }
    try {
      await updateTask(uid, task.id, { title, dueDate: dueEl.value || null });
      toast("Tarefa atualizada");
      close();
    } catch (err) { console.error(err); toast("Erro ao salvar"); }
  });
  document.getElementById("et-delete").addEventListener("click", async () => {
    const ok = await confirmModal(`Excluir “${escapeHtml(task.title)}”?`, { okLabel: "Excluir", danger: true });
    if (!ok) return;
    try { await deleteTask(uid, task.id); toast("Tarefa excluída"); close(); }
    catch (err) { console.error(err); toast("Erro ao excluir"); }
  });
}

// Formulário enxuto para adicionar tarefa já vinculada ao projeto.
function openInlineTaskForm(uid, projectId) {
  const { close } = openModal(`
    <h2 class="modal-title">Nova tarefa</h2>
    <label class="field">
      <span class="field-label">Título</span>
      <input id="it-title" type="text" placeholder="O que precisa ser feito?" />
    </label>
    <label class="field">
      <span class="field-label">Vencimento (opcional)</span>
      <input id="it-due" type="date" />
    </label>
    <div class="modal-actions" style="justify-content:flex-end">
      <button class="btn-ghost" id="it-cancel">Cancelar</button>
      <button class="btn-primary" id="it-save">Criar</button>
    </div>
  `);
  const titleEl = document.getElementById("it-title");
  document.getElementById("it-cancel").addEventListener("click", close);
  document.getElementById("it-save").addEventListener("click", async () => {
    const title = titleEl.value.trim();
    if (!title) { titleEl.focus(); toast("Dê um título"); return; }
    const dueDate = document.getElementById("it-due").value || null;
    try {
      await createTask(uid, { title, dueDate, projectId });
      toast("Tarefa adicionada ✓");
      close();
    } catch (err) { console.error(err); toast("Erro ao salvar"); }
  });
}

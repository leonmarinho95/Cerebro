// modules/dashboard.js
// Dashboard "Hoje" — a tela principal do aplicativo.
//
// Não possui dados próprios: agrega Rotinas e Tarefas em tempo real.
// Blocos (conforme decisão fechada):
//   - resumo de fechamento do dia
//   - rotinas vencendo hoje / atrasadas
//   - tarefas de hoje / atrasadas
//   - próximos vencimentos (rotinas + tarefas, janela curta)
//   - projetos ativos  [slot: preenchido na fatia (e)]
//
// Tudo é acionável inline: marcar rotina, concluir tarefa, adiar.

import { watchRoutines, markRoutineDone, undoRoutineDone, hasEntryOn } from "./routines-data.js";
import { routineStatus, statusLabel, frequencyLabel } from "./routines-logic.js";
import { watchTasks, setTaskDone, snoozeTask } from "./tasks-data.js";
import { tasksForToday, upcomingTasks, taskDateState } from "./tasks-logic.js";
import { escapeHtml } from "../lib/util.js";
import { todayKey, relativeDayLabel, diffDays } from "../lib/dates.js";
import { icons } from "../lib/icons.js";
import { toast } from "../lib/ui.js";
import { navigate } from "../router.js";

const UPCOMING_WINDOW = 3; // dias de antecipação

export function renderDashboard(container, ctx) {
  const { uid } = ctx;

  container.innerHTML = `<div id="dash"><p class="empty">Carregando…</p></div>`;
  const dashEl = document.getElementById("dash");

  // Estado local: preenchido pelos dois listeners; re-renderiza a cada mudança.
  const state = { routines: null, tasks: null };

  function paint() {
    if (state.routines === null || state.tasks === null) return; // aguarda ambos
    renderDash(dashEl, uid, state);
  }

  const unsubR = watchRoutines(uid, (routines) => {
    const today = todayKey();
    routines.forEach((r) => { r._status = routineStatus(r.frequency, r.lastDoneDate, today); });
    state.routines = routines;
    paint();
  });

  const unsubT = watchTasks(uid, (tasks) => {
    state.tasks = tasks;
    paint();
  });

  // Cleanup do roteador: encerra os dois listeners.
  return () => { unsubR(); unsubT(); };
}

function renderDash(el, uid, state) {
  const today = todayKey();
  const { routines, tasks } = state;

  // --- Seleções ---
  const routinesDue = routines.filter((r) => r._status.state === "due" && r.lastDoneDate !== today);
  const routinesOverdue = routines.filter((r) => r._status.state === "overdue");
  const routinesDoneToday = routines.filter((r) => r.lastDoneDate === today);
  const tasksNow = tasksForToday(tasks, today); // atrasadas + hoje
  const tasksSoon = upcomingTasks(tasks, UPCOMING_WINDOW, today);
  const routinesSoon = routines
    .filter((r) =>
      r._status.state === "upcoming" &&
      r._status.daysUntil <= UPCOMING_WINDOW &&
      r.lastDoneDate !== today // já feita hoje: não repetir na antecipação
    )
    .sort((a, b) => a._status.daysUntil - b._status.daysUntil);

  // --- Resumo de fechamento ---
  const pendingRoutines = routinesDue.length + routinesOverdue.length;
  const pendingTasks = tasksNow.length;
  const doneToday = routinesDoneToday.length;

  let html = summaryBlock(pendingRoutines, pendingTasks, doneToday);

  // --- Rotinas: atrasadas + vence hoje (juntas, atrasadas primeiro) ---
  const routinesNow = [...routinesOverdue, ...routinesDue];
  if (routinesNow.length) {
    html += `<div class="section-title">Rotinas de hoje</div>`;
    html += routinesNow.map((r) => dashRoutineRow(r, false)).join("");
  }
  // Feitas hoje ficam visíveis, esmaecidas, para permitir desfazer.
  if (routinesDoneToday.length) {
    html += routinesDoneToday.map((r) => dashRoutineRow(r, true)).join("");
  }
  if (!routinesNow.length && !routinesDoneToday.length) {
    html += `<div class="section-title">Rotinas de hoje</div>
             <p class="dash-empty">Nenhuma rotina para hoje.</p>`;
  }

  // --- Tarefas: atrasadas + hoje ---
  html += `<div class="section-title">Tarefas</div>`;
  if (tasksNow.length) {
    html += tasksNow.map((t) => dashTaskRow(t)).join("");
  } else {
    html += `<p class="dash-empty">Nenhuma tarefa para hoje.</p>`;
  }

  // --- Próximos dias (antecipação) ---
  const soonItems = [
    ...routinesSoon.map((r) => ({
      kind: "routine", name: r.name, days: r._status.daysUntil,
      date: r._status.dueDate, color: r.color,
    })),
    ...tasksSoon.map((t) => ({
      kind: "task", name: t.title, days: diffDays(today, t.dueDate),
      date: t.dueDate, color: null,
    })),
  ].sort((a, b) => a.days - b.days);

  if (soonItems.length) {
    html += `<div class="section-title">Próximos dias</div>`;
    html += `<div class="soon-card">` + soonItems.map((i) => `
      <div class="soon-item">
        <span class="soon-icon">${i.kind === "routine" ? icons.rotinas : icons.tarefas}</span>
        <span class="soon-name">${escapeHtml(i.name)}</span>
        <span class="soon-when">${relativeDayLabel(i.date)}</span>
      </div>`).join("") + `</div>`;
  }

  // --- Projetos ativos: slot da fatia (e) ---
  // (será preenchido quando o módulo de Projetos existir)

  el.innerHTML = html;
  wireActions(el, uid, state, today);
}

function summaryBlock(pendingRoutines, pendingTasks, doneToday) {
  const total = pendingRoutines + pendingTasks;
  let msg;
  if (total === 0) {
    msg = doneToday > 0
      ? `Tudo em dia. ${doneToday} rotina${doneToday > 1 ? "s" : ""} concluída${doneToday > 1 ? "s" : ""} hoje.`
      : "Nada pendente para hoje.";
  } else {
    const parts = [];
    if (pendingRoutines) parts.push(`${pendingRoutines} rotina${pendingRoutines > 1 ? "s" : ""}`);
    if (pendingTasks) parts.push(`${pendingTasks} tarefa${pendingTasks > 1 ? "s" : ""}`);
    msg = `Faltam ${parts.join(" · ")}`;
  }
  return `<div class="dash-summary ${total === 0 ? "clear" : ""}">${msg}</div>`;
}

function dashRoutineRow(r, doneToday) {
  const st = r._status;
  const stateClass = doneToday ? "done" : st.state;
  const badge = doneToday ? "feita hoje" : statusLabel(st);
  return `
    <div class="routine-row state-${stateClass}" data-kind="routine" data-id="${r.id}">
      <button class="routine-check ${doneToday ? "checked" : ""}" aria-label="${doneToday ? "Desfazer" : "Marcar como feita"}">
        ${icons.checkSmall}
      </button>
      <div class="routine-main">
        <div class="routine-name">${escapeHtml(r.name)}</div>
        <div class="routine-meta">
          <span class="dot" style="background:${r.color}"></span>
          ${frequencyLabel(r.frequency)}
          <span class="sep">·</span>
          <span class="routine-badge">${badge}</span>
        </div>
      </div>
    </div>`;
}

function dashTaskRow(t) {
  const state = taskDateState(t);
  return `
    <div class="task-row state-${state}" data-kind="task" data-id="${t.id}">
      <button class="task-check" aria-label="Concluir">${icons.checkSmall}</button>
      <div class="task-main">
        <div class="task-title">${escapeHtml(t.title)}</div>
        ${t.dueDate ? `<div class="task-meta"><span class="task-badge state-${state}">${relativeDayLabel(t.dueDate)}</span></div>` : ""}
      </div>
      <button class="task-snooze" aria-label="Adiar para amanhã">${icons.snooze}</button>
    </div>`;
}

function wireActions(el, uid, state, today) {
  // Rotinas
  el.querySelectorAll('[data-kind="routine"]').forEach((row) => {
    const r = state.routines.find((x) => x.id === row.dataset.id);
    if (!r) return;
    row.querySelector(".routine-check").addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        if (r.lastDoneDate === today) {
          await undoRoutineDone(uid, r.id, today);
          toast("Marcação desfeita");
        } else {
          await markRoutineDone(uid, r, today);
          toast("Feita hoje ✓");
        }
      } catch (err) { console.error(err); toast("Não foi possível atualizar"); }
    });
    row.querySelector(".routine-main").addEventListener("click", () => navigate("/rotinas"));
  });

  // Tarefas
  el.querySelectorAll('[data-kind="task"]').forEach((row) => {
    const t = state.tasks.find((x) => x.id === row.dataset.id);
    if (!t) return;
    row.querySelector(".task-check").addEventListener("click", (e) => {
      e.stopPropagation();
      setTaskDone(uid, t.id, true).then(() => toast("Concluída ✓")).catch(() => toast("Erro"));
    });
    row.querySelector(".task-snooze").addEventListener("click", (e) => {
      e.stopPropagation();
      snoozeTask(uid, t).then(() => toast("Adiada para amanhã")).catch(() => toast("Erro"));
    });
    row.querySelector(".task-main").addEventListener("click", () => navigate("/tarefas"));
  });
}

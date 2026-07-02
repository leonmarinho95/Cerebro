// modules/tasks-logic.js
// Lógica pura de tarefas (sem Firestore, sem DOM).
// Agrupa e ordena tarefas para exibição.

import { todayKey, diffDays } from "../lib/dates.js";

// Status de uma tarefa aberta em relação a hoje:
//   'overdue'  -> venceu no passado
//   'today'    -> vence hoje
//   'upcoming' -> vence no futuro
//   'nodate'   -> sem data
export function taskDateState(task, today = todayKey()) {
  if (task.status === "done") return "done";
  if (!task.dueDate) return "nodate";
  const d = diffDays(today, task.dueDate);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  return "upcoming";
}

// Agrupa tarefas abertas em seções ordenadas para a tela de Tarefas.
// Retorna { overdue, today, upcoming, nodate, done } — cada um um array.
export function groupTasks(tasks, today = todayKey()) {
  const groups = { overdue: [], today: [], upcoming: [], nodate: [], done: [] };
  for (const t of tasks) {
    if (t.status === "done") { groups.done.push(t); continue; }
    groups[taskDateState(t, today)].push(t);
  }
  // Ordenações internas
  const byDate = (a, b) => (a.dueDate || "").localeCompare(b.dueDate || "");
  const byTitle = (a, b) => (a.title || "").localeCompare(b.title || "", "pt-BR");
  groups.overdue.sort((a, b) => byDate(a, b) || byTitle(a, b));
  groups.today.sort(byTitle);
  groups.upcoming.sort((a, b) => byDate(a, b) || byTitle(a, b));
  groups.nodate.sort(byTitle);
  // Concluídas: mais recentes primeiro (por completedAt se houver)
  groups.done.sort((a, b) => {
    const ta = a.completedAt?.seconds || 0;
    const tb = b.completedAt?.seconds || 0;
    return tb - ta;
  });
  return groups;
}

// Tarefas relevantes ao Dashboard "Hoje": atrasadas + de hoje.
export function tasksForToday(tasks, today = todayKey()) {
  return tasks.filter(
    (t) => t.status === "open" && t.dueDate && diffDays(today, t.dueDate) <= 0
  );
}

// Próximos vencimentos (janela de N dias à frente, exclui hoje/atrasadas).
export function upcomingTasks(tasks, days = 3, today = todayKey()) {
  return tasks
    .filter((t) => {
      if (t.status !== "open" || !t.dueDate) return false;
      const d = diffDays(today, t.dueDate);
      return d >= 1 && d <= days;
    })
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
}

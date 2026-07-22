// modules/projects-logic.js
// Lógica pura de projetos (sem Firestore, sem DOM).

// Progresso derivado: % de tarefas concluídas sobre o total (não-arquivadas).
// Retorna { done, total, pct } — pct é inteiro 0..100; total 0 => pct 0.
export function projectProgress(tasks) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, pct };
}

// Ordena projetos para a lista: ativos primeiro, depois concluídos; dentro de
// cada grupo, por nome.
export function compareProjects(a, b) {
  const rank = { active: 0, done: 1 };
  const ra = rank[a.status] ?? 2;
  const rb = rank[b.status] ?? 2;
  if (ra !== rb) return ra - rb;
  return (a.name || "").localeCompare(b.name || "", "pt-BR");
}

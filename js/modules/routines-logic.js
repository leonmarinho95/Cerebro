// modules/routines-logic.js
// Lógica pura das rotinas (sem Firestore, sem DOM) — fácil de testar.
//
// Decisões fechadas refletidas aqui:
//  - Frequência configurável: { unit: 'day'|'week'|'month', n: inteiro >= 1 }.
//  - Próxima ocorrência é calculada a partir da ÚLTIMA EXECUÇÃO REAL.
//  - Atrasos NÃO acumulam: por mais dias que passem, há no máximo uma
//    ocorrência devida. "Marcar feita" sempre parte de hoje.

import { addDays, addMonths, todayKey, diffDays } from "../lib/dates.js";

// Próxima data devida (dayKey) a partir da última execução.
// Se nunca foi executada (lastDoneDate null), está devida hoje.
export function nextDueDate(frequency, lastDoneDate, today = todayKey()) {
  if (!lastDoneDate) return today;
  const n = Math.max(1, frequency.n || 1);
  switch (frequency.unit) {
    case "day":   return addDays(lastDoneDate, n);
    case "week":  return addDays(lastDoneDate, n * 7);
    case "month": return addMonths(lastDoneDate, n);
    default:      return addDays(lastDoneDate, n);
  }
}

// Status da rotina hoje, derivado da próxima data devida:
//   'due'     -> vence hoje
//   'overdue' -> atrasada (devida no passado)
//   'upcoming'-> vence no futuro
// Inclui daysUntil (negativo = dias de atraso; 0 = hoje; positivo = faltam).
export function routineStatus(frequency, lastDoneDate, today = todayKey()) {
  const due = nextDueDate(frequency, lastDoneDate, today);
  const daysUntil = diffDays(today, due);
  let state;
  if (daysUntil < 0) state = "overdue";
  else if (daysUntil === 0) state = "due";
  else state = "upcoming";
  return { state, dueDate: due, daysUntil };
}

// Streak só faz sentido para rotinas diárias (n=1, unit=day).
// Conta execuções consecutivas terminando em hoje ou ontem (sem furo).
// entriesDates: array de dayKeys das execuções (qualquer ordem).
export function dailyStreak(frequency, entriesDates, today = todayKey()) {
  if (!(frequency.unit === "day" && (frequency.n || 1) === 1)) return null;
  if (!entriesDates || entriesDates.length === 0) return 0;

  const set = new Set(entriesDates);
  // O streak vale se a última execução foi hoje ou ontem; senão, quebrou.
  let cursor;
  if (set.has(today)) cursor = today;
  else if (set.has(addDays(today, -1))) cursor = addDays(today, -1);
  else return 0;

  let count = 0;
  while (set.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  return count;
}

// Texto humano da frequência: "diária", "a cada 3 dias", "semanal",
// "a cada 2 semanas", "mensal", "a cada 6 meses".
export function frequencyLabel(frequency) {
  const n = Math.max(1, frequency.n || 1);
  const unit = frequency.unit;
  if (n === 1) {
    if (unit === "day") return "diária";
    if (unit === "week") return "semanal";
    if (unit === "month") return "mensal";
  }
  const plural = { day: "dias", week: "semanas", month: "meses" }[unit] || "dias";
  return `a cada ${n} ${plural}`;
}

// Rótulo curto de status para a UI.
export function statusLabel(status) {
  if (status.state === "due") return "vence hoje";
  if (status.state === "overdue") {
    const d = Math.abs(status.daysUntil);
    return d === 1 ? "atrasada 1 dia" : `atrasada ${d} dias`;
  }
  // upcoming
  const d = status.daysUntil;
  if (d === 1) return "amanhã";
  return `em ${d} dias`;
}

// Ordenação para a lista: atrasadas primeiro, depois vence hoje, depois
// próximas (por proximidade). Dentro do mesmo grupo, por nome.
export function compareRoutines(a, b) {
  const rank = { overdue: 0, due: 1, upcoming: 2 };
  const ra = rank[a._status.state];
  const rb = rank[b._status.state];
  if (ra !== rb) return ra - rb;
  if (a._status.daysUntil !== b._status.daysUntil) {
    return a._status.daysUntil - b._status.daysUntil;
  }
  return (a.name || "").localeCompare(b.name || "", "pt-BR");
}

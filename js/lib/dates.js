// lib/dates.js
// Utilitários de data centrados no conceito de "dia local" (sem hora).
// As rotinas e tarefas raciocinam em dias, não em instantes — então
// padronizamos tudo em strings 'YYYY-MM-DD' no fuso local do dispositivo.

// Retorna 'YYYY-MM-DD' no fuso LOCAL (não UTC) para uma Date.
export function toDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Converte 'YYYY-MM-DD' em Date no fuso local (meia-noite).
export function fromDayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey() {
  return toDayKey(new Date());
}

// Diferença em dias inteiros entre dois dayKeys (b - a). Positivo = b no futuro.
export function diffDays(aKey, bKey) {
  const a = fromDayKey(aKey);
  const b = fromDayKey(bKey);
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((b - a) / MS);
}

// Soma N dias a um dayKey e devolve novo dayKey.
export function addDays(key, n) {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

// Soma N meses a um dayKey, preservando o melhor dia possível do mês alvo.
export function addMonths(key, n) {
  const d = fromDayKey(key);
  const targetMonthDay = d.getDate();
  d.setMonth(d.getMonth() + n);
  // Se o mês alvo não tem o dia (ex: 31 → fevereiro), JS já transborda;
  // corrige para o último dia do mês pretendido.
  if (d.getDate() < targetMonthDay) d.setDate(0);
  return toDayKey(d);
}

const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

// Ex: "qui, 19 jun" — para o cabeçalho do Dashboard.
export function formatHeaderDate(date = new Date()) {
  return `${WEEKDAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// Rótulo humano de proximidade: "hoje", "amanhã", "em 3 dias", "há 2 dias".
export function relativeDayLabel(targetKey, baseKey = todayKey()) {
  const n = diffDays(baseKey, targetKey);
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n === -1) return "ontem";
  if (n > 1) return `em ${n} dias`;
  return `há ${Math.abs(n)} dias`;
}

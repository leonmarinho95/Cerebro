// modules/routines-data.js
// Camada de dados das rotinas sobre o Firestore.
// Coleção: users/{uid}/routines/{routineId}
// Execuções: users/{uid}/routines/{routineId}/entries/{entryId}

import {
  addDoc, updateDoc, deleteDoc, getDocs, query, where, limit,
  onSnapshot, serverTimestamp, orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { userCol, userDoc, userSubCol, normalizeSearch } from "../lib/util.js";
import { todayKey } from "../lib/dates.js";

// Observa todas as rotinas ativas em tempo real.
// callback recebe um array de rotinas { id, ...dados }.
export function watchRoutines(uid, callback) {
  const q = query(userCol(uid, "routines"), where("active", "==", true));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list);
  });
}

// Cria uma rotina nova. lastDoneDate começa null (devida hoje).
export function createRoutine(uid, { name, frequency, color = "#5a9bd4", tags = [] }) {
  return addDoc(userCol(uid, "routines"), {
    name: name.trim(),
    frequency,                 // { unit, n }
    lastDoneDate: null,
    entryType: "boolean",      // V1: só feito/não-feito; numeric/session na Fase 2
    unit: null,
    target: null,
    color,
    tags,
    active: true,
    links: [],                 // reservado (Fase 3)
    searchText: normalizeSearch(name, ...tags),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateRoutine(uid, id, patch) {
  const data = { ...patch, updatedAt: serverTimestamp() };
  if (patch.name !== undefined || patch.tags !== undefined) {
    data.searchText = normalizeSearch(patch.name ?? "", ...(patch.tags ?? []));
  }
  return updateDoc(userDoc(uid, "routines", id), data);
}

// Arquiva (não apaga) — preserva histórico e timeline futura.
export function archiveRoutine(uid, id) {
  return updateDoc(userDoc(uid, "routines", id), {
    active: false,
    updatedAt: serverTimestamp(),
  });
}

// Apaga em definitivo a rotina (entries ficam órfãs e somem com a rotina na UI).
export async function deleteRoutine(uid, id) {
  // Remove entries primeiro para não deixar lixo.
  const entriesSnap = await getDocs(userSubCol(uid, "routines", id, "entries"));
  await Promise.all(entriesSnap.docs.map((d) => deleteDoc(d.ref)));
  return deleteDoc(userDoc(uid, "routines", id));
}

// Marca a rotina como feita numa data (padrão: hoje).
// Grava uma entry e atualiza lastDoneDate -> recalcula a próxima ocorrência.
// Atrasos não acumulam: marcar parte sempre da data informada.
export async function markRoutineDone(uid, routine, dateKey = todayKey(), note = null) {
  await addDoc(userSubCol(uid, "routines", routine.id, "entries"), {
    date: dateKey,
    value: true,
    note: note || null,
    createdAt: serverTimestamp(),
  });
  await updateDoc(userDoc(uid, "routines", routine.id), {
    lastDoneDate: dateKey,
    updatedAt: serverTimestamp(),
  });
}

// Desfaz a marcação de uma data: remove a entry daquela data e recalcula
// lastDoneDate para a execução anterior mais recente (ou null).
export async function undoRoutineDone(uid, routineId, dateKey) {
  const entriesRef = userSubCol(uid, "routines", routineId, "entries");
  const dupSnap = await getDocs(query(entriesRef, where("date", "==", dateKey)));
  await Promise.all(dupSnap.docs.map((d) => deleteDoc(d.ref)));

  // Recalcula lastDoneDate como a maior data restante.
  const restSnap = await getDocs(query(entriesRef, orderBy("date", "desc"), limit(1)));
  const newLast = restSnap.empty ? null : restSnap.docs[0].data().date;
  await updateDoc(userDoc(uid, "routines", routineId), {
    lastDoneDate: newLast,
    updatedAt: serverTimestamp(),
  });
}

// Carrega o histórico de execuções (datas), mais recente primeiro.
export async function loadEntries(uid, routineId, max = 60) {
  const snap = await getDocs(
    query(userSubCol(uid, "routines", routineId, "entries"), orderBy("date", "desc"), limit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Checa se já existe execução numa data (evita marcação dupla no mesmo dia).
export async function hasEntryOn(uid, routineId, dateKey) {
  const snap = await getDocs(
    query(userSubCol(uid, "routines", routineId, "entries"), where("date", "==", dateKey), limit(1))
  );
  return !snap.empty;
}

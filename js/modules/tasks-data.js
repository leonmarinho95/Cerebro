// modules/tasks-data.js
// Camada de dados das tarefas sobre o Firestore.
// Coleção: users/{uid}/tasks/{taskId}
//
// Decisões fechadas refletidas aqui:
//  - Tarefas podem existir SEM data (dueDate null).
//  - Concluir muda status para 'done' e grava completedAt.
//  - Campos reservados (priority, recurrence, checklist, links) já existem
//    para a estrutura futura, mas não são usados na UI da V1.

import {
  addDoc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { userCol, userDoc, normalizeSearch } from "../lib/util.js";
import { addDays, todayKey } from "../lib/dates.js";

// Observa todas as tarefas não-arquivadas em tempo real.
// Traz abertas e concluídas (a UI separa); exclui apenas arquivadas.
export function watchTasks(uid, callback) {
  const q = query(userCol(uid, "tasks"), where("status", "in", ["open", "done"]));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list);
  });
}

// Cria uma tarefa. dueDate opcional ('YYYY-MM-DD' ou null).
// projectId opcional (usado a partir da fatia de Projetos).
export function createTask(uid, { title, dueDate = null, projectId = null, tags = [] }) {
  return addDoc(userCol(uid, "tasks"), {
    title: title.trim(),
    description: "",
    dueDate,
    dueTime: null,        // reservado (lembretes, Fase 3)
    priority: null,       // reservado
    status: "open",
    recurrence: null,     // reservado
    projectId,
    checklist: [],        // reservado
    tags,
    links: [],            // reservado (Fase 3)
    searchText: normalizeSearch(title, ...tags),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null,
  });
}

export function updateTask(uid, id, patch) {
  const data = { ...patch, updatedAt: serverTimestamp() };
  if (patch.title !== undefined || patch.tags !== undefined) {
    data.searchText = normalizeSearch(patch.title ?? "", ...(patch.tags ?? []));
  }
  return updateDoc(userDoc(uid, "tasks", id), data);
}

// Conclui / reabre uma tarefa.
export function setTaskDone(uid, id, done) {
  return updateDoc(userDoc(uid, "tasks", id), {
    status: done ? "done" : "open",
    completedAt: done ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

// Adia para amanhã (ou define hoje se não tinha data).
export function snoozeTask(uid, task) {
  const base = task.dueDate || todayKey();
  return updateDoc(userDoc(uid, "tasks", task.id), {
    dueDate: addDays(base, 1),
    updatedAt: serverTimestamp(),
  });
}

export function archiveTask(uid, id) {
  return updateDoc(userDoc(uid, "tasks", id), {
    status: "archived",
    updatedAt: serverTimestamp(),
  });
}

export function deleteTask(uid, id) {
  return deleteDoc(userDoc(uid, "tasks", id));
}

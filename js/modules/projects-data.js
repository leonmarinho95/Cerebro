// modules/projects-data.js
// Camada de dados dos projetos sobre o Firestore.
// Coleção: users/{uid}/projects/{projectId}
//
// Decisões fechadas refletidas aqui:
//  - Progresso é DERIVADO das tarefas (% concluídas) — não persistido.
//  - Encerramento é MANUAL (status 'done'/'active'/'archived').
//  - Campo goalId reservado para a Fase 3 (vínculo a metas).

import {
  addDoc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { userCol, userDoc, normalizeSearch } from "../lib/util.js";

const PROJECT_COLORS = ["#5a9bd4", "#4fb286", "#f0a830", "#e0604d", "#9b87d4", "#d47fa6"];
export { PROJECT_COLORS };

// Observa projetos não-arquivados (ativos e concluídos) em tempo real.
export function watchProjects(uid, callback) {
  const q = query(userCol(uid, "projects"), where("status", "in", ["active", "done"]));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list);
  });
}

// Leitura pontual dos projetos ativos (para seletores em formulários).
export async function listActiveProjects(uid) {
  const snap = await getDocs(query(userCol(uid, "projects"), where("status", "==", "active")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function createProject(uid, { name, description = "", color = PROJECT_COLORS[0], tags = [] }) {
  return addDoc(userCol(uid, "projects"), {
    name: name.trim(),
    description: description.trim(),
    status: "active",
    color,
    tags,
    goalId: null,        // reservado (Fase 3)
    links: [],           // reservado (Fase 3)
    searchText: normalizeSearch(name, description, ...tags),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateProject(uid, id, patch) {
  const data = { ...patch, updatedAt: serverTimestamp() };
  if (patch.name !== undefined || patch.description !== undefined || patch.tags !== undefined) {
    data.searchText = normalizeSearch(patch.name ?? "", patch.description ?? "", ...(patch.tags ?? []));
  }
  return updateDoc(userDoc(uid, "projects", id), data);
}

// Encerramento manual: alterna entre concluído e ativo.
export function setProjectDone(uid, id, done) {
  return updateProject(uid, id, { status: done ? "done" : "active" });
}

export function archiveProject(uid, id) {
  return updateProject(uid, id, { status: "archived" });
}

// Exclui o projeto. As tarefas vinculadas NÃO são apagadas: apenas perdem o
// vínculo (projectId volta a null), para não destruir trabalho registrado.
export async function deleteProject(uid, id) {
  const linked = await getDocs(query(userCol(uid, "tasks"), where("projectId", "==", id)));
  await Promise.all(
    linked.docs.map((d) => updateDoc(d.ref, { projectId: null, updatedAt: serverTimestamp() }))
  );
  return deleteDoc(userDoc(uid, "projects", id));
}

// modules/notes-data.js
// Camada de dados de Conhecimento (notas) sobre o Firestore.
// Coleção: users/{uid}/notes/{noteId}
//
// Decisões refletidas:
//  - Nota e "informação de referência" são a MESMA coleção, distinguidas pela
//    flag isReference (não é um módulo separado).
//  - Texto puro na V1 (markdown fica para a Fase 2).
//  - searchText populado para a busca (feita no cliente, volume de 1 usuário).

import {
  addDoc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { userCol, userDoc, normalizeSearch } from "../lib/util.js";

// Observa todas as notas em tempo real.
export function watchNotes(uid, callback) {
  const q = query(userCol(uid, "notes"), where("archived", "==", false));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    callback(list);
  });
}

export function createNote(uid, { title = "", body = "", tags = [], isReference = false }) {
  return addDoc(userCol(uid, "notes"), {
    title: title.trim(),
    body: body.trim(),
    tags,
    pinned: false,
    isReference,
    archived: false,
    links: [],            // reservado (Fase 3)
    searchText: normalizeSearch(title, body, ...tags),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function updateNote(uid, id, patch) {
  const data = { ...patch, updatedAt: serverTimestamp() };
  if (patch.title !== undefined || patch.body !== undefined || patch.tags !== undefined) {
    data.searchText = normalizeSearch(patch.title ?? "", patch.body ?? "", ...(patch.tags ?? []));
  }
  return updateDoc(userDoc(uid, "notes", id), data);
}

export function togglePin(uid, id, pinned) {
  return updateDoc(userDoc(uid, "notes", id), { pinned, updatedAt: serverTimestamp() });
}

export function deleteNote(uid, id) {
  return deleteDoc(userDoc(uid, "notes", id));
}

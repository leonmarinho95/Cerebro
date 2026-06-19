// lib/util.js
// Utilitários gerais compartilhados pelos módulos.

import { collection, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "../firebase.js";

// Normaliza texto para busca: minúsculo, sem acentos, espaços colapsados.
// Todo documento "pesquisável" grava um campo searchText com este formato,
// para que a busca (Fase 2) varra um campo já populado desde a V1.
export function normalizeSearch(...parts) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos
    .replace(/\s+/g, " ")
    .trim();
}

// Referência a uma coleção sob users/{uid}/{name}.
export function userCol(uid, name) {
  return collection(db, "users", uid, name);
}

// Referência a um documento sob users/{uid}/{name}/{id}.
export function userDoc(uid, name, id) {
  return doc(db, "users", uid, name, id);
}

// Subcoleção: users/{uid}/{parent}/{parentId}/{child}.
export function userSubCol(uid, parent, parentId, child) {
  return collection(db, "users", uid, parent, parentId, child);
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// Escapa texto para inserção segura como conteúdo HTML.
export function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

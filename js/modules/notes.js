// modules/notes.js
// Tela de Conhecimento (notas e informações de referência).
// Lista em tempo real, busca no cliente (texto + tag), fixar, criar/editar.

import {
  watchNotes, createNote, updateNote, togglePin, deleteNote,
} from "./notes-data.js";
import { openModal, toast, confirmModal } from "../lib/ui.js";
import { escapeHtml, normalizeSearch, debounce } from "../lib/util.js";
import { icons } from "../lib/icons.js";

// Estado de busca/filtro (sessão).
let searchTerm = "";
let activeTag = null;

export function renderNotes(container, ctx) {
  const { uid } = ctx;
  container.innerHTML = `
    <div class="notes-search">
      <span class="notes-search-icon">${icons.search}</span>
      <input id="notes-q" type="search" placeholder="Buscar notas e informações…" value="${escapeHtml(searchTerm)}" />
    </div>
    <div id="notes-tags" class="notes-tags"></div>
    <div class="list-head" style="margin-top:6px">
      <p class="list-sub" id="notes-sub"></p>
      <button class="btn-add" id="add-note">${icons.plus}<span>Nova nota</span></button>
    </div>
    <div id="notes-list"></div>
  `;

  document.getElementById("add-note").addEventListener("click", () => openNoteForm(uid));

  const listEl = document.getElementById("notes-list");
  const subEl = document.getElementById("notes-sub");
  const tagsEl = document.getElementById("notes-tags");
  const qEl = document.getElementById("notes-q");

  qEl.addEventListener("input", debounce(() => {
    searchTerm = qEl.value;
    paint();
  }, 200));

  let allNotes = [];
  function paint() {
    renderNotesList(listEl, subEl, tagsEl, uid, allNotes);
  }

  const unsub = watchNotes(uid, (notes) => {
    allNotes = notes;
    paint();
  });
  return unsub;
}

function renderNotesList(listEl, subEl, tagsEl, uid, notes) {
  // Nuvem de tags (todas as tags existentes), com a ativa destacada.
  const tagCounts = {};
  notes.forEach((n) => (n.tags || []).forEach((t) => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const allTags = Object.keys(tagCounts).sort((a, b) => a.localeCompare(b, "pt-BR"));
  tagsEl.innerHTML = allTags.length
    ? allTags.map((t) => `<button class="tag-chip ${t === activeTag ? "sel" : ""}" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join("")
    : "";
  tagsEl.querySelectorAll(".tag-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeTag = activeTag === chip.dataset.tag ? null : chip.dataset.tag;
      renderNotesList(listEl, subEl, tagsEl, uid, notes);
    });
  });

  // Filtragem: por tag ativa e por termo de busca (no cliente).
  let filtered = notes;
  if (activeTag) filtered = filtered.filter((n) => (n.tags || []).includes(activeTag));
  if (searchTerm.trim()) {
    const q = normalizeSearch(searchTerm);
    filtered = filtered.filter((n) => (n.searchText || "").includes(q));
  }

  // Ordena: fixadas primeiro, depois por atualização mais recente.
  filtered.sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0);
  });

  subEl.textContent = notes.length === 0 ? "" : `${filtered.length} de ${notes.length}`;

  if (notes.length === 0) {
    listEl.innerHTML = `
      <div class="empty" style="margin-top:30px">
        <strong style="display:block;color:var(--text-soft);font-size:1.05rem;margin-bottom:6px">Nenhuma nota ainda</strong>
        Guarde ideias, informações de referência (medidas, códigos, dados) e qualquer coisa que queira consultar depois.
      </div>`;
    return;
  }
  if (filtered.length === 0) {
    listEl.innerHTML = `<p class="empty" style="margin-top:24px">Nada encontrado${activeTag ? ` em #${escapeHtml(activeTag)}` : ""}.</p>`;
    return;
  }

  listEl.innerHTML = filtered.map((n) => noteCard(n)).join("");
  listEl.querySelectorAll(".note-card").forEach((card) => {
    const n = filtered.find((x) => x.id === card.dataset.id);
    card.querySelector(".note-body-wrap").addEventListener("click", () => openNoteForm(uid, n));
    card.querySelector(".note-pin").addEventListener("click", (e) => {
      e.stopPropagation();
      togglePin(uid, n.id, !n.pinned).catch(() => toast("Erro"));
    });
  });
}

function noteCard(n) {
  const hasTitle = n.title && n.title.trim();
  const preview = (n.body || "").slice(0, 220);
  return `
    <div class="note-card ${n.pinned ? "pinned" : ""}" data-id="${n.id}">
      <button class="note-pin ${n.pinned ? "on" : ""}" aria-label="${n.pinned ? "Desafixar" : "Fixar"}">${icons.pin}</button>
      <div class="note-body-wrap">
        ${hasTitle ? `<div class="note-title">${escapeHtml(n.title)}</div>` : ""}
        ${preview ? `<div class="note-preview">${escapeHtml(preview)}${n.body.length > 220 ? "…" : ""}</div>` : (!hasTitle ? `<div class="note-preview note-empty-body">(vazia)</div>` : "")}
        <div class="note-foot">
          ${n.isReference ? `<span class="note-ref-badge">referência</span>` : ""}
          ${(n.tags || []).map((t) => `<span class="note-tag">#${escapeHtml(t)}</span>`).join("")}
        </div>
      </div>
    </div>`;
}

// ---- Formulário de criação / edição ----
function openNoteForm(uid, note = null) {
  const editing = !!note;
  const tagsStr = (note?.tags || []).join(", ");
  const { close } = openModal(`
    <h2 class="modal-title">${editing ? "Editar nota" : "Nova nota"}</h2>
    <label class="field">
      <span class="field-label">Título (opcional)</span>
      <input id="n-title" type="text" placeholder="Ex.: Filtro de óleo do Fox" value="${editing ? escapeHtml(note.title || "") : ""}" />
    </label>
    <label class="field">
      <span class="field-label">Conteúdo</span>
      <textarea id="n-body" rows="6" placeholder="Escreva aqui…">${editing ? escapeHtml(note.body || "") : ""}</textarea>
    </label>
    <label class="field">
      <span class="field-label">Tags (separadas por vírgula)</span>
      <input id="n-tags" type="text" placeholder="carro, manutenção" value="${escapeHtml(tagsStr)}" />
    </label>
    <label class="field-check">
      <input id="n-ref" type="checkbox" ${editing && note.isReference ? "checked" : ""} />
      <span>Marcar como informação de referência</span>
    </label>
    <div class="modal-actions">
      ${editing ? '<button class="btn-ghost" id="n-delete">Excluir</button>' : "<span></span>"}
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" id="n-cancel">Cancelar</button>
        <button class="btn-primary" id="n-save">${editing ? "Salvar" : "Criar"}</button>
      </div>
    </div>
  `);

  const titleEl = document.getElementById("n-title");
  const bodyEl = document.getElementById("n-body");
  const tagsEl = document.getElementById("n-tags");
  const refEl = document.getElementById("n-ref");

  document.getElementById("n-cancel").addEventListener("click", close);
  document.getElementById("n-save").addEventListener("click", async () => {
    const title = titleEl.value.trim();
    const body = bodyEl.value.trim();
    if (!title && !body) { bodyEl.focus(); toast("Escreva algo na nota"); return; }
    const tags = parseTags(tagsEl.value);
    const isReference = refEl.checked;
    try {
      if (editing) { await updateNote(uid, note.id, { title, body, tags, isReference }); toast("Nota atualizada"); }
      else { await createNote(uid, { title, body, tags, isReference }); toast("Nota criada"); }
      close();
    } catch (err) { console.error(err); toast("Erro ao salvar"); }
  });

  if (editing) {
    document.getElementById("n-delete").addEventListener("click", async () => {
      const label = note.title || (note.body || "").slice(0, 40) || "esta nota";
      const ok = await confirmModal(`Excluir “${escapeHtml(label)}”?`, { okLabel: "Excluir", danger: true });
      if (!ok) return;
      try { await deleteNote(uid, note.id); toast("Nota excluída"); close(); }
      catch (err) { console.error(err); toast("Erro ao excluir"); }
    });
  }
}

// Converte "a, b ,c" em ["a","b","c"] limpo, sem duplicatas nem vazios.
export function parseTags(str) {
  return [...new Set(
    (str || "")
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)
  )];
}

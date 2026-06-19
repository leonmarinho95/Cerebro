// modules/routines.js
// Tela de Rotinas. Renderiza a lista em tempo real, com status calculado,
// marcação inline, e formulário de criação/edição. Exporta renderRoutines
// para o roteador.

import {
  watchRoutines, createRoutine, updateRoutine, archiveRoutine,
  markRoutineDone, undoRoutineDone, loadEntries, hasEntryOn,
} from "./routines-data.js";
import {
  routineStatus, dailyStreak, frequencyLabel, statusLabel, compareRoutines,
} from "./routines-logic.js";
import { openModal, toast, confirmModal } from "../lib/ui.js";
import { escapeHtml } from "../lib/util.js";
import { todayKey, relativeDayLabel } from "../lib/dates.js";
import { icons } from "../lib/icons.js";

const COLORS = ["#5a9bd4", "#4fb286", "#f0a830", "#e0604d", "#9b87d4", "#d47fa6"];

// ---- Render principal (registrado no roteador) ----
export function renderRoutines(container, ctx) {
  const { uid } = ctx;

  container.innerHTML = `
    <div class="list-head">
      <p class="list-sub" id="routines-sub">Carregando…</p>
      <button class="btn-add" id="add-routine">${icons.plus}<span>Nova rotina</span></button>
    </div>
    <div id="routines-list"></div>
  `;

  document.getElementById("add-routine").addEventListener("click", () =>
    openRoutineForm(uid)
  );

  const listEl = document.getElementById("routines-list");
  const subEl = document.getElementById("routines-sub");

  // Listener em tempo real. O cleanup (return) é chamado pelo roteador ao sair.
  const unsub = watchRoutines(uid, (routines) => {
    const today = todayKey();
    routines.forEach((r) => {
      r._status = routineStatus(r.frequency, r.lastDoneDate, today);
    });
    routines.sort(compareRoutines);
    renderList(listEl, subEl, uid, routines, today);
  });

  return unsub;
}

function renderList(listEl, subEl, uid, routines, today) {
  if (routines.length === 0) {
    subEl.textContent = "";
    listEl.innerHTML = `
      <div class="empty" style="margin-top:36px">
        <strong style="display:block;color:var(--text-soft);font-size:1.05rem;margin-bottom:6px">Nenhuma rotina ainda</strong>
        Crie sua primeira rotina recorrente — barba, limpeza, revisão do carro, o que se repete na sua vida.
      </div>`;
    return;
  }

  const overdue = routines.filter((r) => r._status.state === "overdue").length;
  const due = routines.filter((r) => r._status.state === "due").length;
  const parts = [];
  if (due) parts.push(`${due} vence${due > 1 ? "m" : ""} hoje`);
  if (overdue) parts.push(`${overdue} atrasada${overdue > 1 ? "s" : ""}`);
  subEl.textContent = parts.length ? parts.join(" · ") : "tudo em dia";

  listEl.innerHTML = routines.map((r) => routineRow(r, today)).join("");

  // Liga ações de cada linha
  routines.forEach((r) => {
    const row = listEl.querySelector(`[data-id="${r.id}"]`);
    if (!row) return;
    row.querySelector(".routine-check").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleDone(uid, r, today);
    });
    row.querySelector(".routine-main").addEventListener("click", () =>
      openRoutineDetail(uid, r)
    );
  });
}

function routineRow(r, today) {
  const st = r._status;
  const doneToday = r.lastDoneDate === today;
  const streak = dailyStreak(r.frequency, doneToday ? [today] : [], today);
  // streak completo seria carregado sob demanda; aqui mostramos só se feita hoje
  const stateClass = doneToday ? "done" : st.state; // done | due | overdue | upcoming
  const badge = doneToday ? "feita hoje" : statusLabel(st);

  return `
    <div class="routine-row state-${stateClass}" data-id="${r.id}">
      <button class="routine-check ${doneToday ? "checked" : ""}" aria-label="Marcar feita">
        ${doneToday ? icons.checkSmall : ""}
      </button>
      <div class="routine-main">
        <div class="routine-name">${escapeHtml(r.name)}</div>
        <div class="routine-meta">
          <span class="dot" style="background:${r.color}"></span>
          ${frequencyLabel(r.frequency)}
          <span class="sep">·</span>
          <span class="routine-badge">${badge}</span>
        </div>
      </div>
    </div>`;
}

async function toggleDone(uid, routine, today) {
  const doneToday = routine.lastDoneDate === today;
  try {
    if (doneToday) {
      await undoRoutineDone(uid, routine.id, today);
      toast("Marcação desfeita");
    } else {
      const already = await hasEntryOn(uid, routine.id, today);
      if (!already) await markRoutineDone(uid, routine, today);
      else {
        // já havia entry hoje: só garante que lastDoneDate aponte para hoje
        await markRoutineDone(uid, routine, today);
      }
      toast("Feita hoje ✓");
    }
  } catch (err) {
    console.error(err);
    toast("Não foi possível atualizar");
  }
}

// ---- Formulário de criação / edição ----
function openRoutineForm(uid, routine = null) {
  const editing = !!routine;
  const freq = routine?.frequency || { unit: "day", n: 1 };
  const color = routine?.color || COLORS[0];

  const { close } = openModal(`
    <h2 class="modal-title">${editing ? "Editar rotina" : "Nova rotina"}</h2>
    <label class="field">
      <span class="field-label">Nome</span>
      <input id="r-name" type="text" placeholder="Ex.: Fazer a barba" value="${editing ? escapeHtml(routine.name) : ""}" />
    </label>

    <div class="field">
      <span class="field-label">Repetir a cada</span>
      <div class="freq-row">
        <input id="r-n" type="number" min="1" value="${freq.n}" inputmode="numeric" />
        <select id="r-unit">
          <option value="day"   ${freq.unit === "day" ? "selected" : ""}>dia(s)</option>
          <option value="week"  ${freq.unit === "week" ? "selected" : ""}>semana(s)</option>
          <option value="month" ${freq.unit === "month" ? "selected" : ""}>mês(es)</option>
        </select>
      </div>
      <p class="freq-preview" id="r-preview"></p>
    </div>

    <div class="field">
      <span class="field-label">Cor</span>
      <div class="color-row" id="r-colors">
        ${COLORS.map((c) => `<button type="button" class="swatch ${c === color ? "sel" : ""}" data-c="${c}" style="background:${c}"></button>`).join("")}
      </div>
    </div>

    <div class="modal-actions">
      ${editing ? '<button class="btn-ghost" id="r-archive">Arquivar</button>' : '<span></span>'}
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" id="r-cancel">Cancelar</button>
        <button class="btn-primary" id="r-save">${editing ? "Salvar" : "Criar"}</button>
      </div>
    </div>
  `);

  let chosen = color;
  const nameEl = document.getElementById("r-name");
  const nEl = document.getElementById("r-n");
  const unitEl = document.getElementById("r-unit");
  const preview = document.getElementById("r-preview");

  function updatePreview() {
    const n = Math.max(1, parseInt(nEl.value || "1", 10));
    preview.textContent = "Repetição: " + frequencyLabel({ unit: unitEl.value, n });
  }
  nEl.addEventListener("input", updatePreview);
  unitEl.addEventListener("change", updatePreview);
  updatePreview();

  document.getElementById("r-colors").addEventListener("click", (e) => {
    const b = e.target.closest(".swatch");
    if (!b) return;
    chosen = b.dataset.c;
    document.querySelectorAll("#r-colors .swatch").forEach((s) => s.classList.toggle("sel", s === b));
  });

  document.getElementById("r-cancel").addEventListener("click", close);

  document.getElementById("r-save").addEventListener("click", async () => {
    const name = nameEl.value.trim();
    if (!name) { nameEl.focus(); toast("Dê um nome à rotina"); return; }
    const n = Math.max(1, parseInt(nEl.value || "1", 10));
    const frequency = { unit: unitEl.value, n };
    try {
      if (editing) {
        await updateRoutine(uid, routine.id, { name, frequency, color: chosen });
        toast("Rotina atualizada");
      } else {
        await createRoutine(uid, { name, frequency, color: chosen });
        toast("Rotina criada");
      }
      close();
    } catch (err) {
      console.error(err);
      toast("Erro ao salvar");
    }
  });

  if (editing) {
    document.getElementById("r-archive").addEventListener("click", async () => {
      const ok = await confirmModal(`Arquivar “${escapeHtml(routine.name)}”? Ela sai da lista, mas o histórico é preservado.`, { okLabel: "Arquivar" });
      if (!ok) return;
      try { await archiveRoutine(uid, routine.id); toast("Rotina arquivada"); close(); }
      catch (err) { console.error(err); toast("Erro ao arquivar"); }
    });
  }
}

// ---- Detalhe / histórico ----
async function openRoutineDetail(uid, routine) {
  const st = routineStatus(routine.frequency, routine.lastDoneDate);
  const { close, overlay } = openModal(`
    <div class="detail-head">
      <h2 class="modal-title" style="margin:0">${escapeHtml(routine.name)}</h2>
      <button class="icon-btn" id="d-edit" aria-label="Editar">${icons.pencil}</button>
    </div>
    <div class="detail-meta">
      <span class="dot" style="background:${routine.color}"></span>
      ${frequencyLabel(routine.frequency)} · <span class="state-${st.state} pill">${statusLabel(st)}</span>
    </div>
    <p class="detail-next">Próxima: ${relativeDayLabel(st.dueDate)} (${st.dueDate.split("-").reverse().join("/")})</p>
    <h3 class="detail-section">Histórico</h3>
    <div id="d-history" class="history"><p class="empty">Carregando…</p></div>
    <div class="modal-actions">
      <button class="btn-ghost" id="d-close">Fechar</button>
    </div>
  `);

  document.getElementById("d-close").addEventListener("click", close);
  document.getElementById("d-edit").addEventListener("click", () => {
    close();
    openRoutineForm(uid, routine);
  });

  try {
    const entries = await loadEntries(uid, routine.id);
    const hist = document.getElementById("d-history");
    if (!entries.length) {
      hist.innerHTML = `<p class="empty">Nenhuma execução registrada ainda.</p>`;
    } else {
      hist.innerHTML = entries.map((e) =>
        `<div class="history-item">
           ${icons.checkSmall}
           <span>${e.date.split("-").reverse().join("/")}</span>
           <span class="history-rel">${relativeDayLabel(e.date)}</span>
         </div>`
      ).join("");
    }
  } catch (err) {
    console.error(err);
  }
}

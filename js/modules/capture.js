// modules/capture.js
// Captura rápida universal. Acessível pelo botão (+) de qualquer tela.
//
// Cria uma TAREFA por padrão (decisão fechada). Com o módulo de Conhecimento
// disponível, agora também permite classificar como NOTA. Ao escolher Nota,
// o seletor de vencimento (que só faz sentido para tarefa) é ocultado.

import { createTask } from "./tasks-data.js";
import { createNote } from "./notes-data.js";
import { openModal, toast } from "../lib/ui.js";
import { todayKey, addDays } from "../lib/dates.js";

export function openCapture(uid, { onSaved } = {}) {
  const { close, overlay } = openModal(`
    <h2 class="modal-title">Capturar</h2>

    <div class="chip-row" id="cap-type" style="margin-bottom:12px">
      <button type="button" class="chip sel" data-type="task">Tarefa</button>
      <button type="button" class="chip" data-type="note">Nota</button>
    </div>

    <label class="field" style="margin-bottom:12px">
      <textarea id="cap-text" rows="3" placeholder="Escreva qualquer coisa..." style="resize:none"></textarea>
    </label>

    <div class="field" id="cap-when-field">
      <span class="field-label">Vencimento</span>
      <div class="chip-row" id="cap-when">
        <button type="button" class="chip sel" data-when="none">Sem data</button>
        <button type="button" class="chip" data-when="today">Hoje</button>
        <button type="button" class="chip" data-when="tomorrow">Amanha</button>
      </div>
    </div>

    <div class="modal-actions">
      <span class="cap-hint" id="cap-hint">Vira uma tarefa</span>
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" id="cap-cancel">Cancelar</button>
        <button class="btn-primary" id="cap-save">Salvar</button>
      </div>
    </div>
  `);

  let type = "task";
  let when = "none";
  const textEl = overlay.querySelector("#cap-text");
  const whenField = overlay.querySelector("#cap-when-field");
  const hintEl = overlay.querySelector("#cap-hint");

  overlay.querySelector("#cap-type").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    type = b.dataset.type;
    overlay.querySelectorAll("#cap-type .chip").forEach((c) => c.classList.toggle("sel", c === b));
    whenField.style.display = type === "task" ? "" : "none";
    hintEl.textContent = type === "task" ? "Vira uma tarefa" : "Vira uma nota";
    textEl.focus();
  });

  overlay.querySelector("#cap-when").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    when = b.dataset.when;
    overlay.querySelectorAll("#cap-when .chip").forEach((c) => c.classList.toggle("sel", c === b));
  });

  async function save() {
    const text = textEl.value.trim();
    if (!text) { textEl.focus(); toast("Escreva algo para capturar"); return; }
    try {
      if (type === "note") {
        await createNote(uid, { body: text });
        toast("Nota criada");
      } else {
        let dueDate = null;
        if (when === "today") dueDate = todayKey();
        else if (when === "tomorrow") dueDate = addDays(todayKey(), 1);
        await createTask(uid, { title: text, dueDate });
        toast("Tarefa criada");
      }
      close();
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast("Erro ao salvar");
    }
  }

  overlay.querySelector("#cap-save").addEventListener("click", save);
  overlay.querySelector("#cap-cancel").addEventListener("click", close);
  textEl.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
  });
}

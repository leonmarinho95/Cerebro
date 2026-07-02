// modules/capture.js
// Captura rápida universal. Acessível pelo botão (+) de qualquer tela.
//
// Decisão fechada: a captura cria uma TAREFA por padrão. O texto vira o título.
// Opção rápida de definir "hoje" ou "amanhã" como vencimento. Classificar como
// Nota ficará disponível quando o módulo de Conhecimento existir (fatia f);
// até lá, o alternador de tipo mostra Nota como desabilitado com aviso.

import { createTask } from "./tasks-data.js";
import { openModal, toast } from "../lib/ui.js";
import { todayKey, addDays } from "../lib/dates.js";

export function openCapture(uid, { onSaved } = {}) {
  const { close } = openModal(`
    <h2 class="modal-title">Capturar</h2>
    <label class="field" style="margin-bottom:12px">
      <textarea id="cap-text" rows="2" placeholder="Escreva qualquer coisa…" style="resize:none"></textarea>
    </label>

    <div class="field">
      <span class="field-label">Vencimento</span>
      <div class="chip-row" id="cap-when">
        <button type="button" class="chip sel" data-when="none">Sem data</button>
        <button type="button" class="chip" data-when="today">Hoje</button>
        <button type="button" class="chip" data-when="tomorrow">Amanhã</button>
      </div>
    </div>

    <div class="modal-actions">
      <span class="cap-hint">Vira uma tarefa</span>
      <div style="display:flex;gap:8px">
        <button class="btn-ghost" id="cap-cancel">Cancelar</button>
        <button class="btn-primary" id="cap-save">Salvar</button>
      </div>
    </div>
  `);

  let when = "none";
  const textEl = document.getElementById("cap-text");

  document.getElementById("cap-when").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    when = b.dataset.when;
    document.querySelectorAll("#cap-when .chip").forEach((c) => c.classList.toggle("sel", c === b));
  });

  async function save() {
    const text = textEl.value.trim();
    if (!text) { textEl.focus(); toast("Escreva algo para capturar"); return; }
    let dueDate = null;
    if (when === "today") dueDate = todayKey();
    else if (when === "tomorrow") dueDate = addDays(todayKey(), 1);
    try {
      await createTask(uid, { title: text, dueDate });
      toast("Tarefa criada ✓");
      close();
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast("Erro ao salvar");
    }
  }

  document.getElementById("cap-save").addEventListener("click", save);
  document.getElementById("cap-cancel").addEventListener("click", close);

  // Ctrl/Cmd+Enter salva rápido
  textEl.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") save();
  });
}

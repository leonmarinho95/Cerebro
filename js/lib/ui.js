// lib/ui.js
// Componentes de UI compartilhados por todos os módulos: modal e toast.

// Abre um modal com conteúdo HTML. Retorna { close } e injeta um overlay.
// onClose é chamado ao fechar (backdrop, Esc ou botão).
export function openModal(innerHTML, { onClose } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${innerHTML}</div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  function close() {
    document.body.style.overflow = "";
    overlay.remove();
    window.removeEventListener("keydown", onKey);
    onClose?.();
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
  window.addEventListener("keydown", onKey);

  // Foco no primeiro campo, se houver.
  const first = overlay.querySelector("input, textarea, select, button");
  first?.focus();

  return { overlay, close };
}

let toastTimer;
export function toast(message) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

// Confirmação simples (substitui window.confirm com o visual do app).
export function confirmModal(message, { okLabel = "Confirmar", danger = false } = {}) {
  return new Promise((resolve) => {
    const { close } = openModal(
      `<p class="modal-confirm-msg">${message}</p>
       <div class="modal-actions">
         <button class="btn-ghost" data-act="cancel">Cancelar</button>
         <button class="${danger ? "btn-danger" : "btn-primary"}" data-act="ok">${okLabel}</button>
       </div>`,
      { onClose: () => resolve(false) }
    );
    document.querySelector('[data-act="cancel"]').addEventListener("click", () => { close(); resolve(false); });
    document.querySelector('[data-act="ok"]').addEventListener("click", () => { close(); resolve(true); });
  });
}

// lib/ui.js
// Componentes de UI compartilhados por todos os módulos: modal e toast.

// Contador para empilhar modais: cada novo modal fica acima do anterior.
let modalStack = 0;

// Abre um modal com conteúdo HTML. Retorna { overlay, close } e injeta um overlay.
// onClose é chamado ao fechar (backdrop, Esc ou botão).
export function openModal(innerHTML, { onClose } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const depth = ++modalStack;
  overlay.style.zIndex = String(100 + depth * 2);
  overlay.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${innerHTML}</div>`;
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    modalStack = Math.max(0, modalStack - 1);
    if (modalStack === 0) document.body.style.overflow = "";
    overlay.remove();
    window.removeEventListener("keydown", onKey);
    onClose?.();
  }
  // Esc fecha apenas o modal do topo (o de maior profundidade aberto).
  function onKey(e) {
    if (e.key === "Escape" && depth === modalStack) close();
  }

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
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      close();
      resolve(value);
    };
    const { overlay, close } = openModal(
      `<p class="modal-confirm-msg">${message}</p>
       <div class="modal-actions" style="justify-content:flex-end">
         <button class="btn-ghost" data-act="cancel">Cancelar</button>
         <button class="${danger ? "btn-danger" : "btn-primary"}" data-act="ok">${okLabel}</button>
       </div>`,
      { onClose: () => finish(false) }
    );
    // Busca dentro do overlay desta confirmação (não no document), pois pode
    // haver outro modal aberto por baixo.
    overlay.querySelector('[data-act="cancel"]').addEventListener("click", () => finish(false));
    overlay.querySelector('[data-act="ok"]').addEventListener("click", () => finish(true));
  });
}

// modules/more.js
// Tela "Mais" — agrupa destinos de ritmo semanal que não ocupam a barra
// inferior: Projetos (fatia e) e Conhecimento (fatia f, ainda placeholder).

import { navigate } from "../router.js";
import { icons } from "../lib/icons.js";

export function renderMore(container, ctx) {
  container.innerHTML = `
    <div class="more-menu">
      <button class="more-item" data-go="/projetos">
        <span class="more-icon">${icons.folder}</span>
        <span class="more-text">
          <span class="more-title">Projetos</span>
          <span class="more-sub">Frentes com várias tarefas</span>
        </span>
        <span class="more-arrow">${icons.chevron}</span>
      </button>

      <button class="more-item" data-go="/conhecimento">
        <span class="more-icon">${icons.book}</span>
        <span class="more-text">
          <span class="more-title">Conhecimento</span>
          <span class="more-sub">Notas e informações</span>
        </span>
        <span class="more-arrow">${icons.chevron}</span>
      </button>

      <button class="more-item" data-go="/tags">
        <span class="more-icon">${icons.tag}</span>
        <span class="more-text">
          <span class="more-title">Tags</span>
          <span class="more-sub">Tudo reunido por etiqueta</span>
        </span>
        <span class="more-arrow">${icons.chevron}</span>
      </button>
    </div>
  `;

  container.querySelectorAll(".more-item[data-go]").forEach((btn) => {
    const go = btn.dataset.go;
    if (!go) return;
    btn.addEventListener("click", () => navigate(go));
  });
}

// router.js
// Roteador mínimo baseado em hash (#/rota). Sem dependências, sem build.
// Cada módulo registra uma rota com uma função render(container, ctx).
// A barra inferior reflete a rota ativa.

const routes = new Map();
let currentCleanup = null;
let appCtx = null;

export function registerRoute(path, config) {
  // config: { title, render(container, ctx) -> optional cleanup fn }
  routes.set(path, config);
}

export function setContext(ctx) {
  appCtx = ctx;
}

export function navigate(path) {
  if (location.hash !== `#${path}`) {
    location.hash = `#${path}`;
  } else {
    renderCurrent(); // re-render se já estiver na rota
  }
}

export function currentPath() {
  return location.hash.replace(/^#/, "") || "/hoje";
}

async function renderCurrent() {
  const path = currentPath();
  const config = routes.get(path) || routes.get("/hoje");

  // Limpa a tela anterior (listeners do Firestore, etc.)
  if (typeof currentCleanup === "function") {
    try { currentCleanup(); } catch (_) {}
    currentCleanup = null;
  }

  const view = document.getElementById("view");
  const titleEl = document.getElementById("topbar-title");
  if (!view) return;

  view.innerHTML = "";
  if (titleEl && config.title) titleEl.textContent = config.title;

  // Atualiza estado ativo das abas
  document.querySelectorAll(".tab[data-route]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.route === path);
  });

  const cleanup = await config.render(view, appCtx);
  if (typeof cleanup === "function") currentCleanup = cleanup;

  view.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

export function startRouter() {
  window.addEventListener("hashchange", renderCurrent);
  if (!location.hash) location.hash = "#/hoje";
  else renderCurrent();
}

// router.js
// Roteador mínimo baseado em hash (#/rota). Sem dependências, sem build.
// Cada módulo registra uma rota com uma função render(container, ctx).
// A barra inferior reflete a rota ativa.
//
// Também cuida da "virada do dia": como o app é um PWA que fica suspenso,
// ao voltar ao foco verificamos se o dia mudou e, se sim, re-renderizamos a
// rota ativa (e atualizamos a data do cabeçalho). Sem isso, o Dashboard
// mostraria o dia anterior até um refresh manual.

import { todayKey, formatHeaderDate } from "./lib/dates.js";

const routes = new Map();
let currentCleanup = null;
let appCtx = null;
let lastRenderDay = null;

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

  // Atualiza estado ativo das abas. Rotas sem aba própria (ex.: /projetos)
  // mantêm "Mais" destacada.
  const MORE_CHILDREN = ["/projetos", "/conhecimento"];
  const activeTab = MORE_CHILDREN.includes(path) ? "/mais" : path;
  document.querySelectorAll(".tab[data-route]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.route === activeTab);
  });

  const cleanup = await config.render(view, appCtx);
  if (typeof cleanup === "function") currentCleanup = cleanup;

  lastRenderDay = todayKey();
  updateHeaderDate();

  view.scrollTo?.(0, 0);
  window.scrollTo(0, 0);
}

// Atualiza a data exibida na topbar (elemento criado pelo shell).
function updateHeaderDate() {
  const dateEl = document.querySelector(".topbar-date");
  if (dateEl) dateEl.textContent = formatHeaderDate();
}

export function startRouter() {
  window.addEventListener("hashchange", renderCurrent);

  // Virada do dia: ao reabrir/voltar ao foco, se mudou de dia, re-renderiza a
  // rota ativa para recalcular "hoje", atrasadas, próximos dias, etc.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && lastRenderDay && todayKey() !== lastRenderDay) {
      renderCurrent();
    }
  });
  // Alguns navegadores/PWAs disparam 'focus' sem 'visibilitychange'.
  window.addEventListener("focus", () => {
    if (lastRenderDay && todayKey() !== lastRenderDay) renderCurrent();
  });

  if (!location.hash) location.hash = "#/hoje";
  else renderCurrent();
}

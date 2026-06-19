// main.js
// Ponto de entrada. Fluxo:
//  1. Observa o estado de autenticação.
//  2. Sem usuário → tela de login (Google Sign-In).
//  3. Com usuário → garante users/{uid}, monta o shell (topbar + view + barra
//     inferior), registra as rotas e inicia o roteador.
//
// Nesta fatia (Fundação), as telas dos módulos são placeholders. As fases
// seguintes (Rotinas, Tarefas, Dashboard, Projetos, Conhecimento, Tags)
// substituem cada render() pelo módulo real, sem alterar este shell.

import { onAuth, signIn, signOutUser, ensureUserDoc } from "./auth.js";
import { registerRoute, setContext, startRouter, navigate } from "./router.js";
import { icons } from "./lib/icons.js";
import { formatHeaderDate } from "./lib/dates.js";
import { renderRoutines } from "./modules/routines.js";

const appEl = document.getElementById("app");

// Registra o service worker (PWA offline). Falha silenciosa em dev/file://.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* ---------- Tela de login ---------- */
function renderAuthGate() {
  appEl.innerHTML = `
    <div class="auth-screen">
      <div class="auth-logo">Cére<span>bro</span></div>
      <p class="auth-tagline">Seu painel pessoal de rotinas, tarefas e projetos. Um lugar só.</p>
      <button id="signin" class="btn-primary">${icons.google} Entrar com Google</button>
    </div>
  `;
  document.getElementById("signin").addEventListener("click", async () => {
    try {
      await signIn();
    } catch (err) {
      console.error("Falha no login:", err);
      alert("Não foi possível entrar. Tente novamente.");
    }
  });
}

/* ---------- Shell autenticado ---------- */
function renderShell(ctx) {
  appEl.innerHTML = `
    <header class="topbar">
      <h1 id="topbar-title">Hoje</h1>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="topbar-date">${formatHeaderDate()}</span>
        <button class="icon-btn" id="btn-search" aria-label="Buscar">${icons.search}</button>
      </div>
    </header>

    <main id="view" class="view"></main>

    <nav class="bottombar" aria-label="Navegação principal">
      <button class="tab" data-route="/hoje">${icons.hoje}<span>Hoje</span></button>
      <button class="tab" data-route="/rotinas">${icons.rotinas}<span>Rotinas</span></button>
      <button class="tab capture" aria-label="Capturar">
        <span class="capture-btn" id="btn-capture">${icons.plus}</span>
      </button>
      <button class="tab" data-route="/tarefas">${icons.tarefas}<span>Tarefas</span></button>
      <button class="tab" data-route="/mais">${icons.mais}<span>Mais</span></button>
    </nav>
  `;

  // Navegação das abas
  appEl.querySelectorAll(".tab[data-route]").forEach((tab) => {
    tab.addEventListener("click", () => navigate(tab.dataset.route));
  });

  // Captura rápida — placeholder até a fatia da Captura
  document.getElementById("btn-capture").addEventListener("click", () => {
    console.info("Captura rápida: a implementar (cria tarefa por padrão).");
  });

  // Busca — reservada para a Fase 2
  document.getElementById("btn-search").addEventListener("click", () => {
    console.info("Busca global: reservada para a Fase 2.");
  });
}

/* ---------- Placeholders de rota (substituídos nas próximas fases) ---------- */
function placeholder(label, note) {
  return (container) => {
    container.innerHTML = `
      <div class="empty" style="margin-top:40px">
        <strong style="display:block;color:var(--text-soft);font-size:1.1rem;margin-bottom:6px">${label}</strong>
        ${note}
      </div>`;
  };
}

function registerRoutes() {
  registerRoute("/hoje", {
    title: "Hoje",
    render: placeholder("Dashboard “Hoje”", "Em breve: rotinas e tarefas do dia, próximos vencimentos e projetos ativos."),
  });
  registerRoute("/rotinas", {
    title: "Rotinas",
    render: renderRoutines,
  });
  registerRoute("/tarefas", {
    title: "Tarefas",
    render: placeholder("Tarefas", "Em breve: tarefas pontuais, com ou sem data."),
  });
  registerRoute("/mais", {
    title: "Mais",
    render: placeholder("Mais", "Em breve: Projetos e Conhecimento."),
  });
}

/* ---------- Boot ---------- */
let shellMounted = false;

onAuth(async (user) => {
  if (!user) {
    shellMounted = false;
    renderAuthGate();
    return;
  }

  try {
    await ensureUserDoc(user);
  } catch (err) {
    console.error("Falha ao garantir users/{uid}:", err);
  }

  if (!shellMounted) {
    const ctx = { uid: user.uid, user };
    setContext(ctx);
    renderShell(ctx);
    registerRoutes();
    startRouter();
    shellMounted = true;
  }
});

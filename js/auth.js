// auth.js
// Autenticação via Google Sign-In. Expõe:
//  - onAuth(callback): observa login/logout e entrega o usuário (ou null)
//  - signIn(): inicia o fluxo de login com popup
//  - signOutUser(): encerra a sessão
//  - ensureUserDoc(user): cria users/{uid} no primeiro acesso
//
// A modelagem assume users/{uid} como raiz de todos os dados. Por isso, ao
// autenticar pela primeira vez, garantimos a existência desse documento.

import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./firebase.js";

const provider = new GoogleAuthProvider();

export function onAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// Erros de popup em que faz sentido cair para redirect. Em PWAs instalados
// (sobretudo Android/iOS em modo standalone) o popup costuma ser bloqueado
// ou fechado pelo sistema; o redirect é o caminho confiável nesses casos.
const POPUP_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported",
]);

export async function signIn() {
  try {
    return await signInWithPopup(auth, provider);
  } catch (err) {
    if (POPUP_FALLBACK_CODES.has(err?.code)) {
      // Não retorna: o app sai da página e volta autenticado; o resultado
      // é colhido por completeRedirectSignIn() no boot.
      await signInWithRedirect(auth, provider);
      return null;
    }
    throw err;
  }
}

// Chamada uma vez no boot: finaliza o login quando a página volta de um
// redirect. Silenciosa quando não há redirect pendente.
export async function completeRedirectSignIn() {
  try {
    await getRedirectResult(auth);
  } catch (err) {
    console.error("Falha ao completar login por redirect:", err);
  }
}

export function signOutUser() {
  return signOut(auth);
}

// Cria o documento do usuário no primeiro acesso, sem sobrescrever em acessos
// seguintes. dashboardPrefs já nasce com os campos que telas futuras (metas)
// vão ler — populá-los agora evita migração depois.
export async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: user.displayName || "",
      createdAt: serverTimestamp(),
      dashboardPrefs: {
        blocosVisiveis: [
          "rotinasHoje",
          "rotinasAtrasadas",
          "tarefasHoje",
          "tarefasAtrasadas",
          "proximosVencimentos",
          "projetosAtivos",
        ],
        metasFixadas: [], // reservado para a Fase 3 (metas)
      },
    });
  }
}

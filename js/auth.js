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

export async function signIn() {
  return signInWithPopup(auth, provider);
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

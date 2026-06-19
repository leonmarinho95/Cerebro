// firebase.js
// Inicializa o Firebase usando o SDK modular v10 via CDN (sem build step).
// Exporta as instâncias compartilhadas de auth e db para todo o app.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Cache local persistente: o app funciona offline e responde instantâneo,
// sincronizando com o servidor quando a conexão volta. Adequado a um PWA
// de uso diário e a um único usuário.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager(),
  }),
});

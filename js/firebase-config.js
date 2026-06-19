// firebase-config.js
// Substitua os valores abaixo pelas credenciais do seu projeto Firebase.
// Console do Firebase → Configurações do projeto → Seus apps → Configuração do SDK.
//
// Importante: o appId, apiKey etc. de um projeto web Firebase NÃO são segredos —
// a segurança real vem das Regras do Firestore (ver firestore.rules). Ainda assim,
// mantenha-os neste arquivo isolado para facilitar manutenção e troca de ambiente.

export const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID",
};

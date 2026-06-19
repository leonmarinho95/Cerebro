// lib/icons.js
// Ícones SVG inline (stroke), leves e sem dependência externa.
// Uso: icons.hoje, icons.rotinas, etc. Retornam string SVG.

const wrap = (inner) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const icons = {
  hoje: wrap('<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="16" r="1.6" fill="currentColor" stroke="none"/>'),
  rotinas: wrap('<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>'),
  tarefas: wrap('<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'),
  mais: wrap('<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
  search: wrap('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  google: `<svg viewBox="0 0 24 24" width="20" height="20"><path fill="#14202b" d="M21.35 11.1H12v2.9h5.35c-.25 1.4-1 2.6-2.15 3.4v2.8h3.5c2.05-1.9 3.2-4.7 3.2-8 0-.7-.06-1.4-.18-2z"/><path fill="#14202b" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.5-2.8c-.97.65-2.2 1-3.2 1-2.5 0-4.6-1.7-5.35-4H3v2.9C4.7 20.3 8.1 22 12 22z" opacity=".85"/><path fill="#14202b" d="M6.65 13.8c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8V7.3H3A10 10 0 0 0 2 12c0 1.6.4 3.2 1 4.7l3.65-2.9z" opacity=".55"/><path fill="#14202b" d="M12 5.4c1.45 0 2.75.5 3.77 1.5l2.8-2.8C16.97 2.5 14.7 1.6 12 1.6 8.1 1.6 4.7 3.3 3 6.3l3.65 2.9C7.4 7 9.5 5.4 12 5.4z" opacity=".7"/></svg>`,
  checkSmall: wrap('<path d="M20 6 9 17l-5-5"/>'),
  pencil: wrap('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
};

// Limites d'upload de saves navigateur (partagées client/serveur — AUCUN import
// server-only ici, ce fichier est importé depuis des composants Svelte).
export const MAX_FILES = 40; // Level.sav + jusqu'à 39 saves joueur
export const MAX_LEVEL_BYTES = 200 * 1024 * 1024; // 200 Mo
export const MAX_PLAYER_BYTES = 10 * 1024 * 1024; // 10 Mo
export const PLAYER_SAV_PATTERN = /^[0-9A-Fa-f]{32}\.sav$/;

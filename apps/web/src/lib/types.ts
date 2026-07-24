export type GroupUser = { id: string; username: string; avatarUrl: string | null };

// Un slot d'équipe : null = slot vide. Le partner skill n'est pas stocké
// (dérivé du pal : `partnerskill:<palId>`). Normalisé à 5 entrées côté serveur.
export type TeamSlot = { palId: string; passives: string[]; actives: string[] } | null;

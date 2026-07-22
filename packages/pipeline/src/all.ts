// Orchestrateur : transforms -> index -> verify -> data-version.
// Chaque étape est un module autonome ; l'ordre importe (verify en dernier).
await import("./transform/l10n.js");
await import("./transform/pals.js");
await import("./transform/items.js");
// await import("./transform/tech.js");
// await import("./transform/buildings.js");
// await import("./search-index.js");
// await import("./verify.js");
// await import("./data-version.js");
console.log("PIPELINE OK");

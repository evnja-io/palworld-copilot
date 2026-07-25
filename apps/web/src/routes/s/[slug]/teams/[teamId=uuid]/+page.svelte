<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { GUEST_SLUG } from '$lib/guest';
	import { getLocalTeam } from '$lib/game/localTeams';
	import { readLocalProgress } from '$lib/game/localProgress';
	import { appHref } from '$lib/nav';
	import TeamEditorScreen from './TeamEditorScreen.svelte';
	import type { EditableTeam } from './TeamEditorScreen.svelte';

	let { data } = $props();

	const guest = $derived(page.params.slug === GUEST_SLUG);

	// Invité : équipe et captures vivent en localStorage, donc invisibles au rendu
	// serveur — on les résout au montage. Introuvable => retour à la liste (un
	// error(404) côté load serait faux : le serveur ne peut pas savoir).
	let localTeam = $state<EditableTeam | null>(null);
	$effect(() => {
		if (!guest) return;
		const found = getLocalTeam(page.params.teamId!);
		if (!found) {
			goto(appHref('/teams'), { replaceState: true });
			return;
		}
		localTeam = { ...found, authorId: null, authorName: null };
	});

	const team = $derived<EditableTeam | null>(guest ? localTeam : data.team);
	const caught = $derived(
		guest ? { mine: readLocalProgress('pal_caught'), group: {} } : data.caught
	);
</script>

<!-- Clé par teamId : en navigation client entre deux équipes, ce composant est
     réutilisé ; sans {#key}, le store de l'éditeur garderait l'ancienne équipe
     (écritures silencieuses sur le mauvais id). La clé recrée tout le sous-arbre.
     (Un composant enfant est nécessaire : <svelte:window>/<svelte:head> ne
     peuvent pas apparaître dans un bloc.)
     {#if team} : côté invité l'équipe n'est connue qu'après montage. -->
{#key page.params.teamId}
	{#if team}
		<TeamEditorScreen {team} {caught} myUserId={data.myUserId} />
	{/if}
{/key}

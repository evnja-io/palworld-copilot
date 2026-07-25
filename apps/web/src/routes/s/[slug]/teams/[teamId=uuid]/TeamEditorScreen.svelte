<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { TeamEditorStore } from '$lib/game/team-editor.svelte';
	import TeamEditor from '$lib/components/teams/TeamEditor.svelte';
	import type { GroupUser, TeamSlot } from '$lib/types';

	/** Équipe éditable, qu'elle vienne de la base (membre) ou du localStorage
	 *  (invité). authorId/authorName sont null en local : un invité est seul. */
	export type EditableTeam = {
		id: string;
		name: string;
		notes: string;
		slots: TeamSlot[];
		authorId: string | null;
		authorName: string | null;
	};

	let {
		team,
		caught,
		myUserId
	}: {
		team: EditableTeam;
		caught: { mine: string[]; group: Record<string, GroupUser[]> };
		myUserId: string | null;
	} = $props();

	// Snapshot volontaire (untrack) : l'éditeur ne doit pas se re-synchroniser sur
	// `team` après l'instanciation (édition en cours vs. rechargement du load).
	// Correct car le parent monte ce composant sous {#key teamId}, et seulement
	// une fois l'équipe résolue.
	const initial = untrack(() => team);
	const owner = untrack(() => myUserId);

	const store = new TeamEditorStore(page.params.slug!, {
		id: initial.id,
		name: initial.name,
		notes: initial.notes,
		slots: initial.slots
	});
	// Une équipe locale n'a pas d'auteur : elle est toujours modifiable.
	const readonly = initial.authorId !== null && initial.authorId !== owner;
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (store.dirty && !readonly) e.preventDefault();
	}}
/>

<svelte:head>
	<title>{initial.name}</title>
	<!-- Équipe d'un visiteur : contenu personnel, jamais indexé. -->
	<meta name="robots" content="noindex" />
</svelte:head>

<TeamEditor {store} {readonly} {caught} authorName={initial.authorName ?? undefined} />

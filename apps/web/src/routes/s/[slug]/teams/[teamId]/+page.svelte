<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { TeamEditorStore } from '$lib/game/team-editor.svelte';
	import TeamEditor from '$lib/components/teams/TeamEditor.svelte';

	let { data } = $props();

	// Snapshot volontaire (untrack) : l'éditeur ne doit pas se re-synchroniser
	// sur `data` après l'instanciation (édition en cours vs. rechargement du load).
	const team = untrack(() => data.team);
	const myUserId = untrack(() => data.myUserId);

	const store = new TeamEditorStore(page.params.slug!, {
		id: team.id,
		name: team.name,
		notes: team.notes,
		slots: team.slots
	});
	const readonly = team.authorId !== myUserId;
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (store.dirty && !readonly) e.preventDefault();
	}}
/>

<svelte:head><title>{team.name}</title></svelte:head>

<TeamEditor {store} {readonly} caught={data.caught} authorName={team.authorName} />

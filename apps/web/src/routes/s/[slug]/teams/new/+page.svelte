<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { appHref } from '$lib/nav';
	import { TeamEditorStore } from '$lib/game/team-editor.svelte';
	import TeamEditor from '$lib/components/teams/TeamEditor.svelte';

	let { data } = $props();

	const store = new TeamEditorStore(page.params.slug!, {
		id: null,
		name: '',
		notes: '',
		slots: []
	});
	const readonly = false;

	// Après la première sauvegarde (id attribué par le serveur), on bascule sur
	// l'URL pérenne de l'équipe.
	$effect(() => {
		const id = store.id;
		if (id !== null) goto(appHref(`/teams/${id}`));
	});
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (store.dirty && !readonly) e.preventDefault();
	}}
/>

<svelte:head><title>{m.teams_title()}</title></svelte:head>

<TeamEditor {store} {readonly} caught={data.caught} />

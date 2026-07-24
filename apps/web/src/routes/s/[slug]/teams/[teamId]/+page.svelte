<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { TeamEditorStore } from '$lib/game/team-editor.svelte';

	let { data } = $props();

	// Squelette non stylé (Task 8) : slots/pickers détaillés dans Task 9.
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

<h1>{team.name}</h1>

{#if readonly}
	<p>{m.teams_readonly_hint({ name: team.authorName })}</p>
{/if}

<label>
	{m.teams_name_label()}
	<input
		type="text"
		placeholder={m.teams_name_placeholder()}
		bind:value={store.name}
		disabled={readonly}
	/>
</label>

<label>
	{m.teams_notes_label()}
	<textarea
		placeholder={m.teams_notes_placeholder()}
		bind:value={store.notes}
		disabled={readonly}
	></textarea>
</label>

<pre>{JSON.stringify(store.slots, null, 2)}</pre>

{#if !readonly}
	<button type="button" onclick={() => store.save()} disabled={store.status === 'saving'}>
		{#if store.status === 'saving'}
			{m.teams_saving()}
		{:else if store.status === 'saved'}
			{m.teams_saved()}
		{:else if store.status === 'error'}
			{m.teams_save_error()}
		{:else}
			{m.teams_save()}
		{/if}
	</button>

	{#if store.dirty}
		<span>{m.teams_unsaved()}</span>
	{/if}
{/if}

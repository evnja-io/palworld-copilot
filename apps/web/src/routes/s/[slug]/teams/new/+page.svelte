<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { appHref } from '$lib/nav';
	import { TeamEditorStore } from '$lib/game/team-editor.svelte';

	let { data } = $props();

	// Squelette non stylé (Task 8) : slots/pickers détaillés dans Task 9.
	const store = new TeamEditorStore(page.params.slug!, {
		id: null,
		name: '',
		notes: '',
		slots: []
	});
	const readonly = false;

	async function onSave() {
		const id = await store.save();
		if (id) await goto(appHref(`/teams/${id}`));
	}
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (store.dirty && !readonly) e.preventDefault();
	}}
/>

<svelte:head><title>{m.teams_title()}</title></svelte:head>

<h1>{m.teams_title()}</h1>

<label>
	{m.teams_name_label()}
	<input type="text" placeholder={m.teams_name_placeholder()} bind:value={store.name} />
</label>

<label>
	{m.teams_notes_label()}
	<textarea placeholder={m.teams_notes_placeholder()} bind:value={store.notes}></textarea>
</label>

<pre>{JSON.stringify(store.slots, null, 2)}</pre>

<button type="button" onclick={onSave} disabled={store.status === 'saving'}>
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

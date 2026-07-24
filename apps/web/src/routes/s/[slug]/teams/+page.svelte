<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { appHref } from '$lib/nav';

	let { data } = $props();

	// Squelette non stylé (Task 8) : mise en forme dans Task 9.
	async function deleteTeam(id: string, name: string) {
		if (!confirm(m.teams_delete_confirm({ name }))) return;
		await fetch(`/api/servers/${page.params.slug}/teams/${id}`, { method: 'DELETE' });
		await invalidateAll();
	}
</script>

<svelte:head><title>{m.teams_title()}</title></svelte:head>

<h1>{m.teams_title()}</h1>

<p class="tnum">{m.teams_count({ count: data.teams.length })}</p>

<a href={appHref('/teams/new')}>{m.teams_new()}</a>

{#if data.teams.length === 0}
	<p>{m.teams_empty()}</p>
{:else}
	<ul>
		{#each data.teams as t (t.id)}
			<li>
				<a href={appHref(`/teams/${t.id}`)}>{t.name}</a>
				<span>{m.teams_by({ name: t.authorName })}</span>
				{#if t.authorId === data.myUserId}
					<button type="button" onclick={() => deleteTeam(t.id, t.name)}>
						{m.teams_delete()}
					</button>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

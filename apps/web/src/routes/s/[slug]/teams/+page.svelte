<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';
	import { appHref } from '$lib/nav';
	import { palIcon } from '$lib/game/icons';

	let { data } = $props();

	const df = new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium' });

	async function deleteTeam(id: string, name: string) {
		if (!confirm(m.teams_delete_confirm({ name }))) return;
		const res = await fetch(`/api/servers/${page.params.slug}/teams/${id}`, {
			method: 'DELETE'
		}).catch(() => null);
		if (!res?.ok) {
			alert(m.teams_save_error());
			return;
		}
		await invalidateAll();
	}
</script>

<svelte:head><title>{m.teams_title()}</title></svelte:head>

<header class="head">
	<div>
		<h1>{m.teams_title()}</h1>
		<p class="count tnum">{m.teams_count({ count: data.teams.length })}</p>
	</div>
	<a class="new" href={appHref('/teams/new')}>{m.teams_new()}</a>
</header>

{#if data.teams.length === 0}
	<p class="empty">{m.teams_empty()}</p>
{:else}
	<ul class="cards">
		{#each data.teams as t (t.id)}
			<li class="card">
				<a class="card-link" href={appHref(`/teams/${t.id}`)}>
					<span class="card-name">{t.name}</span>
					<span class="thumbs">
						{#each t.slots as slot, i (i)}
							{#if slot && palIcon(slot.palId)}
								<img src={palIcon(slot.palId)} alt="" width="40" height="40" loading="lazy" />
							{:else}
								<span class="thumb-empty" aria-hidden="true"></span>
							{/if}
						{/each}
					</span>
					{#if t.notes}<span class="notes">{t.notes}</span>{/if}
					<span class="meta">
						{m.teams_by({ name: t.authorName })}
						<span class="sep" aria-hidden="true">·</span>
						<span class="tnum">{m.teams_updated({ date: df.format(new Date(t.updatedAt)) })}</span>
					</span>
				</a>
				{#if t.authorId === data.myUserId}
					<button class="delete" onclick={() => deleteTeam(t.id, t.name)}>
						{m.teams_delete()}
					</button>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<style>
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}
	.count {
		margin: 0;
		font-size: 12px;
		color: var(--text-3);
	}
	.new {
		display: inline-flex;
		align-items: center;
		min-height: 40px;
		padding: 8px 18px;
		background: var(--accent);
		color: var(--accent-ink);
		border-radius: var(--r-sm);
		font-weight: 600;
	}
	.new:hover {
		background: color-mix(in srgb, var(--accent) 85%, white);
		color: var(--accent-ink);
	}
	.empty {
		color: var(--text-3);
		text-align: center;
		padding: 48px 0;
	}
	.cards {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 10px;
	}
	.card {
		position: relative;
		display: flex;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		transition: border-color 140ms, background 140ms;
	}
	.card:hover {
		background: var(--surface-2);
		border-color: var(--border-strong);
	}
	.card-link {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px;
	}
	.card-link:hover {
		color: inherit;
	}
	.card-name {
		font-family: var(--font-display);
		font-size: 16px;
		font-weight: 600;
		letter-spacing: -0.02em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.thumbs {
		display: flex;
		gap: 6px;
	}
	.thumbs img {
		border-radius: var(--r-sm);
		background: var(--surface-2);
	}
	.thumb-empty {
		width: 40px;
		height: 40px;
		border: 1px dashed var(--border-strong);
		border-radius: 50%;
	}
	.notes {
		font-size: 12px;
		color: var(--text-3);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.meta {
		font-size: 11px;
		color: var(--text-4);
		display: flex;
		align-items: baseline;
		gap: 6px;
		flex-wrap: wrap;
	}
	.delete {
		align-self: flex-start;
		margin: 10px 10px 0 0;
		font-size: 12px;
		color: var(--el-fire);
		border-color: color-mix(in srgb, var(--el-fire) 30%, transparent);
		background: none;
	}
	.delete:hover {
		background: color-mix(in srgb, var(--el-fire) 12%, var(--surface-2));
		border-color: color-mix(in srgb, var(--el-fire) 45%, transparent);
	}
</style>

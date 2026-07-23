<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	let { data } = $props();
</script>

<svelte:head><title>{m.servers_title()}</title></svelte:head>

<div class="wrap">
	<header>
		<h1>{m.servers_title()}</h1>
		<a class="cta" href="/servers/new">{m.servers_create()}</a>
	</header>

	{#if data.servers.length === 0}
		<p class="empty">{m.servers_empty()}</p>
	{:else}
		<ul class="list">
			{#each data.servers as s (s.id)}
				<li>
					<a href="/s/{s.slug}">
						<span class="name">{s.name}</span>
						<span class="open">{m.servers_open()} →</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.wrap {
		max-width: 640px;
		margin: 0 auto;
		padding: 32px 16px;
	}
	header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 20px;
	}
	.cta {
		font-size: 13px;
		font-weight: 600;
		color: var(--accent);
		padding: 6px 12px;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
	}
	.empty {
		color: var(--text-3);
	}
	.list {
		list-style: none;
		display: grid;
		gap: 8px;
	}
	.list a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-1);
	}
	.list a:hover {
		border-color: var(--focus-ring);
	}
	.name {
		font-weight: 600;
		color: var(--text-1);
	}
	.open {
		font-size: 13px;
		color: var(--text-3);
	}
</style>

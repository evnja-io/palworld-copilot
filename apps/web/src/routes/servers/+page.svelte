<script lang="ts">
	import { m } from '$lib/paraglide/messages';

	let { data } = $props();

	function kindMeta(kind: 'local' | 'dedicated') {
		return kind === 'dedicated'
			? { icon: '🛰️', label: m.servers_kind_dedicated(), cls: 'ded' }
			: { icon: '🎒', label: m.servers_kind_local(), cls: 'loc' };
	}
</script>

<svelte:head><title>{m.servers_title()}</title></svelte:head>

<div class="wrap">
	<header class="exp-hero">
		<div class="hrow">
			<div class="htext">
				<h1 class="exp-grad">{m.servers_title()}</h1>
				<p class="sub">{m.servers_subtitle()}</p>
			</div>
			<a class="exp-glossy create" href="/servers/new">＋ {m.servers_create()}</a>
		</div>
	</header>

	{#if data.servers.length === 0}
		<div class="empty">
			<span class="eic">🌙</span>
			<p>{m.servers_empty()}</p>
			<a class="exp-glossy" href="/servers/new">＋ {m.servers_create()}</a>
		</div>
	{:else}
		<ul class="list">
			{#each data.servers as s (s.id)}
				{@const k = kindMeta(s.kind)}
				<li>
					<a href="/s/{s.slug}" class="card {k.cls}">
						<span class="ic">{k.icon}</span>
						<span class="body">
							<span class="name">{s.name}</span>
							<span class="badge">{k.label}</span>
						</span>
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
		padding: 32px 16px 56px;
		display: grid;
		gap: 22px;
	}

	.hrow {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.htext h1 {
		font-size: 24px;
	}
	.sub {
		color: var(--text-2);
		font-size: 13px;
		margin-top: 4px;
		max-width: 46ch;
		line-height: 1.5;
	}
	.create {
		flex: none;
		text-decoration: none;
		font-size: 14px;
	}

	.empty {
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 10px;
		padding: 44px 24px;
		border: 1px dashed var(--border-strong);
		border-radius: var(--r-lg);
		background: hsl(222 30% 6% / 0.4);
	}
	.empty .eic {
		font-size: 40px;
		filter: drop-shadow(0 0 18px hsl(199 90% 55% / 0.4));
	}
	.empty p {
		color: var(--text-2);
		font-size: 14px;
	}
	.empty .exp-glossy {
		margin-top: 6px;
		text-decoration: none;
		font-size: 14px;
	}

	.list {
		list-style: none;
		display: grid;
		gap: 10px;
	}
	.card {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 16px;
		border: 1px solid var(--border);
		border-radius: var(--r-lg);
		background: var(--surface-1);
		transition:
			border-color 140ms cubic-bezier(0.23, 1, 0.32, 1),
			background 140ms,
			transform 140ms;
	}
	.card:hover {
		border-color: var(--border-strong);
		background: var(--surface-2);
		transform: translateY(-1px);
		color: var(--text-1);
	}
	.card .ic {
		font-size: 26px;
		line-height: 1;
		width: 46px;
		height: 46px;
		display: grid;
		place-items: center;
		border-radius: var(--r-md);
		background: var(--surface-2);
		border: 1px solid var(--border);
	}
	.card.loc:hover .ic {
		border-color: color-mix(in srgb, var(--el-leaf) 40%, transparent);
	}
	.card.ded:hover .ic {
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.card .body {
		display: grid;
		gap: 4px;
		flex: 1;
	}
	.name {
		font-weight: 600;
		font-size: 15px;
		color: var(--text-1);
	}
	.badge {
		justify-self: start;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		padding: 2px 8px;
		border-radius: 999px;
	}
	.card.loc .badge {
		color: var(--el-leaf);
		background: color-mix(in srgb, var(--el-leaf) 15%, transparent);
		border: 1px solid color-mix(in srgb, var(--el-leaf) 28%, transparent);
	}
	.card.ded .badge {
		color: var(--accent);
		background: var(--accent-soft);
		border: 1px solid color-mix(in srgb, var(--accent) 28%, transparent);
	}
	.open {
		font-size: 13px;
		color: var(--text-3);
		flex: none;
	}
	.card:hover .open {
		color: var(--accent);
	}

	@media (max-width: 480px) {
		.create {
			width: 100%;
			text-align: center;
		}
	}
</style>

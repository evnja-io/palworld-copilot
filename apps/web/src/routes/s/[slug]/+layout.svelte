<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { appHref } from '$lib/nav';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import LangSwitch from '$lib/components/LangSwitch.svelte';

	let { data, children } = $props();

	let palette: CommandPalette | undefined = $state();
	const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform);

	const nav = [
		{ href: '/paldex', label: m.nav_paldex },
		{ href: '/teams', label: m.nav_teams },
		{ href: '/items', label: m.nav_items },
		{ href: '/craft', label: m.nav_craft },
		{ href: '/tech', label: m.nav_tech },
		{ href: '/buildings', label: m.nav_buildings },
		{ href: '/map', label: m.nav_map }
	];
</script>

<div class="shell">
	<header class="topbar">
		<details class="switcher">
			<summary>
				<span class="brand">{data.server.name}</span>
				<span class="chevron" aria-hidden="true">▾</span>
			</summary>
			<div class="menu">
				{#each data.myServers as s (s.id)}
					<a href="/s/{s.slug}" class:current={s.slug === data.server.slug}>{s.name}</a>
				{/each}
				<hr />
				{#if data.membership.role === 'owner'}
					<a href={appHref('/settings')}>{m.settings_nav()}</a>
				{/if}
				<a href="/servers">{m.switcher_all()}</a>
			</div>
		</details>
		<nav>
			{#each nav as item (item.href)}
				<a href={appHref(item.href)} class:active={page.url.pathname.startsWith(appHref(item.href))}>
					{item.label()}
				</a>
			{/each}
		</nav>
		<button class="search-btn" onclick={() => palette?.show()} aria-label={m.search_button()}>
			<span aria-hidden="true">🔍</span>
			<span class="search-label">{m.search_button()}</span>
			<kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
		</button>
		<div class="user">
			<a href={appHref('/import')} class="import-link" title={m.import_title()} aria-label={m.import_title()}>📥</a>
			<LangSwitch />
			{#if data.user.avatarUrl}
				<img src={data.user.avatarUrl} alt="" width="26" height="26" class="avatar" />
			{/if}
			<span class="username">{data.user.username}</span>
			<form method="POST" action="/logout">
				<button class="logout">{m.auth_logout()}</button>
			</form>
		</div>
	</header>
	<main class:fullscreen={page.route.id === '/s/[slug]/map'}>{@render children()}</main>
</div>
<CommandPalette bind:this={palette} />

<style>
	.shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 0 16px;
		height: 52px;
		border-bottom: 1px solid var(--border);
		background: var(--surface-1);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.switcher {
		position: relative;
		white-space: nowrap;
	}
	.switcher summary {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		list-style: none;
	}
	.switcher summary::-webkit-details-marker {
		display: none;
	}
	.brand {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 15px;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}
	.chevron {
		font-size: 11px;
		color: var(--text-3);
	}
	.switcher .menu {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		min-width: 200px;
		display: grid;
		gap: 2px;
		padding: 6px;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		background: var(--surface-1);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.3);
		z-index: 20;
	}
	.switcher .menu a {
		padding: 7px 10px;
		border-radius: var(--r-sm);
		color: var(--text-2);
		font-size: 13px;
	}
	.switcher .menu a:hover {
		background: var(--surface-2);
		color: var(--text-1);
	}
	.switcher .menu a.current {
		color: var(--accent);
	}
	.switcher .menu hr {
		border: none;
		border-top: 1px solid var(--border);
		margin: 4px 0;
	}
	nav {
		display: flex;
		gap: 2px;
		overflow-x: auto;
		flex: 1;
	}
	nav a {
		padding: 6px 10px;
		border-radius: var(--r-sm);
		color: var(--text-2);
		font-size: 13px;
		white-space: nowrap;
	}
	nav a:hover {
		color: var(--text-1);
		background: var(--surface-2);
	}
	nav a.active {
		color: var(--accent);
		background: var(--accent-soft);
	}
	.search-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--input-bg);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		color: var(--text-3);
		font-size: 13px;
		padding: 5px 10px;
		white-space: nowrap;
	}
	.search-btn:hover {
		color: var(--text-2);
		border-color: var(--focus-ring);
	}
	.search-btn kbd {
		font-size: 10px;
		color: var(--text-4);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 1px 5px;
	}
	.user {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.avatar {
		border-radius: 50%;
	}
	.import-link {
		font-size: 16px;
		line-height: 1;
	}
	.username {
		color: var(--text-2);
		font-size: 13px;
	}
	.logout {
		font-size: 12px;
		padding: 4px 10px;
		color: var(--text-3);
	}
	main {
		flex: 1;
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px 16px 48px;
	}
	main.fullscreen {
		max-width: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	@media (max-width: 640px) {
		.topbar {
			flex-wrap: wrap;
			height: auto;
			padding: 8px 12px;
			gap: 8px;
		}
		.user {
			margin-left: auto;
		}
		nav {
			order: 3;
			flex-basis: 100%;
			margin: 0 -12px -8px;
			padding: 0 12px 8px;
		}
		.username {
			display: none;
		}
		.search-label,
		.search-btn kbd {
			display: none;
		}
	}
</style>

<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { appHref } from '$lib/nav';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import LangSwitch from '$lib/components/LangSwitch.svelte';

	let { data, children } = $props();

	const DISCORD_URL = 'https://discord.gg/SJehy5fFJ';

	let palette: CommandPalette | undefined = $state();
	const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform);

	const nav = [
		{ href: '/paldex', label: m.nav_paldex },
		{ href: '/teams', label: m.nav_teams },
		{ href: '/breeding', label: m.nav_breeding },
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
			<a
				href={DISCORD_URL}
				target="_blank"
				rel="noopener"
				class="discord-link"
				title={m.discord_community()}
				aria-label={m.discord_community()}
			>
				<svg viewBox="0 0 127.14 96.36" width="18" height="18" aria-hidden="true" fill="currentColor">
					<path
						d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z"
					/>
				</svg>
			</a>
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
	.discord-link {
		display: inline-flex;
		align-items: center;
		color: var(--text-3);
		transition: color 140ms;
	}
	.discord-link:hover {
		color: var(--accent);
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

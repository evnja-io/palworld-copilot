<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import GlobalSearch from '$lib/components/GlobalSearch.svelte';
	import LangSwitch from '$lib/components/LangSwitch.svelte';

	let { data, children } = $props();

	const nav = [
		{ href: '/paldex', label: m.nav_paldex },
		{ href: '/items', label: m.nav_items },
		{ href: '/craft', label: m.nav_craft },
		{ href: '/tech', label: m.nav_tech },
		{ href: '/buildings', label: m.nav_buildings },
		{ href: '/map', label: m.nav_map }
	];
</script>

<div class="shell">
	<header class="topbar">
		<a href="/" class="brand">{m.app_title()}</a>
		<nav>
			{#each nav as item (item.href)}
				<a href={item.href} class:active={page.url.pathname.startsWith(item.href)}>
					{item.label()}
				</a>
			{/each}
		</nav>
		<GlobalSearch />
		<div class="user">
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
	<main>{@render children()}</main>
</div>

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
	.brand {
		font-family: var(--font-display);
		font-weight: 600;
		font-size: 15px;
		letter-spacing: -0.01em;
		white-space: nowrap;
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
	.user {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.avatar {
		border-radius: 50%;
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
	}
</style>

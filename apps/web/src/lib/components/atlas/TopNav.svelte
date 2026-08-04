<script lang="ts">
	// En-tête de la coquille tenant — écrans 1c/2a/2b/3a-3c l.820-829 (desktop)
	// et 4a l.155-159 (rangée mobile).
	//
	// Remplace AppHeader SOUS /s/[slug] uniquement : la landing et /docs, hors
	// de la coquille, gardent AppHeader (variante transparente incluse).
	import posthog from 'posthog-js';
	import { m } from '$lib/paraglide/messages';
	import { appHref } from '$lib/nav';
	import { localizeHref } from '$lib/paraglide/runtime';
	import LangSwitch from '$lib/components/LangSwitch.svelte';
	import type { NavItem } from '$lib/navItems';
	// Types uniquement : effacés à la compilation, aucun code serveur embarqué.
	import type { Membership, ServerSummary } from '$lib/server/servers';

	type HeaderUser = { id: string; username: string; avatarUrl: string | null };

	let {
		mode,
		server = null,
		membership = null,
		myServers = [],
		user = null,
		items,
		hrefOf,
		isActive,
		onsearch,
		onmenu
	}: {
		mode: 'guest' | 'member';
		server?: ServerSummary | null;
		membership?: Membership | null;
		myServers?: ServerSummary[];
		user?: HeaderUser | null;
		items: NavItem[];
		hrefOf: (path: string) => string;
		isActive: (path: string) => boolean;
		onsearch?: () => void;
		onmenu: () => void;
	} = $props();

	const DISCORD_URL = 'https://discord.gg/SJehy5fFJ';
	const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform);

	let utilities: HTMLDetailsElement | undefined = $state();
</script>

<svelte:window
	onclick={(e) => {
		// Le <details> natif ne se referme pas sur un clic extérieur.
		if (utilities?.open && !utilities.contains(e.target as Node)) utilities.open = false;
	}}
/>

<header class="topnav">
	<div class="inner">
		<!-- Marque : wordmark « Palwork. » avec le point en orange (1c l.821). -->
		<a href={localizeHref('/')} class="brand" aria-label={m.app_title()}>
			<img src="/logo.svg" alt="" width="24" height="24" />
			<span class="word">Palwork<span class="dot">.</span></span>
		</a>

		{#if mode === 'member' && server && membership}
			<details class="switcher">
				<summary>
					<span class="sname">{server.name}</span>
					<span class="chevron" aria-hidden="true">▾</span>
				</summary>
				<div class="menu">
					{#each myServers as s (s.id)}
						<a href="/s/{s.slug}" class:current={s.slug === server.slug}>{s.name}</a>
					{/each}
					<hr />
					{#if membership.role === 'owner'}
						<a href={appHref('/settings')}>{m.settings_nav()}</a>
					{/if}
					<a href="/servers">{m.switcher_all()}</a>
				</div>
			</details>
		{:else}
			<span class="guest-chip">{m.guest_badge()}</span>
		{/if}

		<nav aria-label={m.nav_primary()}>
			{#each items as item (item.href)}
				<a
					href={hrefOf(item.href)}
					class:on={isActive(item.href)}
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					{item.label()}
				</a>
			{/each}
		</nav>

		<div class="right">
			{#if onsearch}
				<button class="search" onclick={onsearch} aria-label={m.search_button()}>
					<kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
				</button>
			{/if}

			{#if mode === 'guest'}
				<a href="/login/discord" class="exp-btn cta" aria-label={m.auth_login_discord()}>
					<span class="cta-full">{m.auth_login_discord()}</span>
					<span class="cta-short">{m.auth_login_short()}</span>
				</a>
			{/if}

			<details class="utilities" bind:this={utilities}>
				<summary aria-label={m.header_menu()}>
					{#if user?.avatarUrl}
						<img src={user.avatarUrl} alt="" width="32" height="32" class="avatar" />
					{:else}
						<span class="avatar ph" aria-hidden="true"></span>
					{/if}
				</summary>
				<div class="menu">
					{#if mode === 'member' && user}
						<p class="who">{user.username}</p>
						<a href={appHref('/import')}>{m.import_title()}</a>
						<hr />
					{/if}
					<a href={DISCORD_URL} target="_blank" rel="noopener">{m.discord_community()}</a>
					<div class="lang-row"><LangSwitch /></div>
					{#if mode === 'member'}
						<hr />
						<form
							method="POST"
							action="/logout"
							onsubmit={() => {
								posthog.capture('user_logged_out');
								posthog.reset();
							}}
						>
							<button class="logout">{m.auth_logout()}</button>
						</form>
					{/if}
				</div>
			</details>
		</div>

		<!-- Rangée mobile : la navigation vit dans la barre d'onglets et la
		     feuille, ce bouton n'ouvre plus que la feuille. -->
		<button class="burger" aria-label={m.header_nav_open()} onclick={onmenu}>
			{#if user?.avatarUrl}
				<img src={user.avatarUrl} alt="" width="34" height="34" class="avatar" />
			{:else}
				<span class="avatar ph" aria-hidden="true"></span>
			{/if}
		</button>
	</div>
</header>

<style>
	.topnav {
		position: sticky;
		top: 0;
		z-index: 15;
		background: var(--color-bg);
	}
	.inner {
		display: flex;
		align-items: center;
		gap: 32px;
		padding: 18px 36px;
		max-width: 1120px;
		margin: 0 auto;
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		flex: none;
	}
	.brand:hover {
		color: inherit;
	}
	.word {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 19px;
		letter-spacing: -0.02em;
	}
	.dot {
		color: #ff7a2f;
	}

	/* Masquée dès qu'il faut de la place : le bouton « Se connecter » dit déjà
	   qu'on n'est pas connecté, la pastille est redondante. */
	@media (max-width: 1439.98px) {
		.guest-chip {
			display: none;
		}
	}
	.guest-chip {
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--color-muted);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		padding: 3px 8px;
		flex: none;
	}

	.switcher {
		position: relative;
		flex: none;
	}
	.switcher summary {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		cursor: pointer;
		list-style: none;
		font-size: 13px;
		color: var(--color-muted);
	}
	.switcher summary::-webkit-details-marker {
		display: none;
	}
	.switcher summary:hover {
		color: var(--color-text);
	}
	.sname {
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* 22 px et non les 26 du dessin : celui-ci ne connaît que 5 entrées, l'app
	   en a 9. À 26 px, la rangée mesurait exactement 1120 px en mode invité —
	   zéro marge, et le moindre libellé plus long passait sous le bouton de
	   connexion. */
	nav {
		display: flex;
		gap: 22px;
		font-size: 13.5px;
		color: var(--color-muted);
		min-width: 0;
	}
	nav a {
		white-space: nowrap;
	}
	nav a:hover {
		color: var(--color-text);
	}
	nav a.on {
		color: #fff;
		font-weight: 600;
	}

	.right {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 14px;
		flex: none;
	}

	.search {
		background: none;
		border: none;
		padding: 0;
		color: var(--color-muted);
	}
	.search:hover {
		background: none;
		color: var(--color-text);
	}
	.search kbd {
		font: inherit;
		font-size: 12.5px;
	}

	.cta {
		font-size: 13px;
		padding: 9px 16px;
	}
	.cta-short {
		display: none;
	}

	.avatar {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: block;
		object-fit: cover;
	}
	.avatar.ph {
		background: linear-gradient(135deg, var(--color-el-tenebres), #ec4899);
	}

	.utilities {
		position: relative;
	}
	.utilities summary {
		display: block;
		cursor: pointer;
		list-style: none;
	}
	.utilities summary::-webkit-details-marker {
		display: none;
	}

	.menu {
		position: absolute;
		right: 0;
		top: calc(100% + 8px);
		min-width: 190px;
		display: grid;
		gap: 2px;
		padding: 8px;
		background: var(--color-raised);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-panel);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
		z-index: 2;
	}
	.switcher .menu {
		left: 0;
		right: auto;
	}
	.menu a,
	.menu .logout {
		display: block;
		width: 100%;
		text-align: left;
		padding: 8px 10px;
		border-radius: 8px;
		font-size: 13px;
		background: none;
		border: none;
		color: var(--color-text);
	}
	.menu a:hover,
	.menu .logout:hover {
		background: rgba(255, 255, 255, 0.06);
		color: var(--color-text);
	}
	.menu a.current {
		color: #ff9450;
	}
	.menu hr {
		border: none;
		border-top: 1px solid var(--color-line);
		margin: 6px 0;
	}
	.who {
		margin: 0;
		padding: 6px 10px;
		font-size: 12px;
		color: var(--color-muted);
	}
	.lang-row {
		padding: 4px 10px;
	}

	.burger {
		display: none;
		margin-left: auto;
		padding: 0;
		background: none;
		border: none;
		/* Plancher tactile autour de l'avatar de 34 px. */
		min-width: 44px;
		min-height: 44px;
		align-items: center;
		justify-content: center;
	}
	.burger:hover {
		background: none;
	}

	/* Entre 1024 et 1280 px, neuf entrées à 26 px de gouttière débordent :
	   on resserre plutôt que de faire défiler la rangée. */
	@media (max-width: 1279.98px) and (min-width: 1024px) {
		.inner {
			gap: 20px;
			padding: 18px 24px;
		}
		nav {
			gap: 16px;
			font-size: 13px;
		}
		.guest-chip {
			display: none;
		}
	}

	@media (max-width: 1023.98px) {
		.inner {
			gap: 10px;
			padding: 18px 20px 8px;
		}
		.brand img {
			width: 22px;
			height: 22px;
		}
		.word {
			font-size: 17px;
		}
		/* La navigation descend dans la barre d'onglets et la feuille. */
		nav,
		.right,
		.guest-chip,
		.switcher {
			display: none;
		}
		.burger {
			display: flex;
		}
		.avatar {
			width: 34px;
			height: 34px;
		}
	}
</style>

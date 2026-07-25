<script lang="ts">
	import posthog from 'posthog-js';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { appHref } from '$lib/nav';
	import { GUEST_FEATURES } from '$lib/guest';
	import { localizeHref } from '$lib/paraglide/runtime';
	import LangSwitch from '$lib/components/LangSwitch.svelte';
	// Types uniquement : effacés à la compilation, aucun code serveur embarqué
	// (même convention que breeding/+page.svelte).
	import type { Membership, ServerSummary } from '$lib/server/servers';

	type HeaderUser = { id: string; username: string; avatarUrl: string | null };

	let {
		mode = 'guest',
		variant = 'solid',
		server = null,
		membership = null,
		myServers = [],
		user = null,
		onsearch
	}: {
		mode?: 'guest' | 'member';
		/** `transparent` : landing uniquement — laisse voir l'illustration du hero. */
		variant?: 'solid' | 'transparent';
		server?: ServerSummary | null;
		membership?: Membership | null;
		myServers?: ServerSummary[];
		user?: HeaderUser | null;
		/** Fourni seulement là où la palette de commandes est montée (coquille
		 *  tenant). Absent sur la landing et /docs : pas de bouton mort. */
		onsearch?: () => void;
	} = $props();

	const DISCORD_URL = 'https://discord.gg/SJehy5fFJ';
	const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform);

	const NAV = [
		{ href: '/paldex', label: m.nav_paldex },
		{ href: '/teams', label: m.nav_teams },
		{ href: '/breeding', label: m.nav_breeding },
		{ href: '/items', label: m.nav_items },
		{ href: '/craft', label: m.nav_craft },
		{ href: '/tech', label: m.nav_tech },
		{ href: '/buildings', label: m.nav_buildings },
		{ href: '/map', label: m.nav_map }
	];
	// Un invité ne voit que les fonctionnalités ouvertes. GUEST_FEATURES est la
	// même source que le reroute et le sitemap : pas de seconde liste.
	const navItems = $derived(
		mode === 'guest'
			? NAV.filter((i) => (GUEST_FEATURES as readonly string[]).includes(i.href))
			: NAV
	);

	// Hors coquille tenant (landing, /docs), page.params.slug est absent : appHref
	// renverrait « /s/undefined/… ». On localise alors le chemin directement.
	const inTenantShell = $derived(page.params.slug !== undefined);
	const featureHref = (path: string) => (inTenantShell ? appHref(path) : localizeHref(path));

	let utilities: HTMLDetailsElement | undefined = $state();
	function closeUtilities() {
		if (utilities) utilities.open = false;
	}
</script>

<svelte:window onclick={(e) => {
	// Referme le menu utilitaire sur un clic extérieur (le <details> natif ne le
	// fait pas), comme attendu d'un menu de compte.
	if (utilities?.open && !utilities.contains(e.target as Node)) closeUtilities();
}} />

<header class="topbar" class:transparent={variant === 'transparent'}>
	{#if mode === 'member' && server && membership}
		<details class="switcher">
			<summary>
				<span class="brand">{server.name}</span>
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
		<a href={localizeHref('/')} class="brand-home">
			<span class="brand">{m.app_title()}</span>
			<span class="guest-chip">{m.guest_badge()}</span>
		</a>
	{/if}

	<nav>
		{#each navItems as item (item.href)}
			<a
				href={featureHref(item.href)}
				class:active={page.url.pathname.startsWith(featureHref(item.href))}
			>
				{item.label()}
			</a>
		{/each}
	</nav>

	{#if onsearch}
		<button class="search-btn" onclick={onsearch} aria-label={m.search_button()}>
			<span aria-hidden="true">🔍</span>
			<span class="search-label">{m.search_button()}</span>
			<kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
		</button>
	{/if}

	{#if mode === 'guest'}
		<!-- Action primaire du tunnel de conversion : même primitive que « créer un
		     serveur » sur /servers (app.css .exp-btn). Libellé raccourci sur petit
		     écran pour tenir sur la même rangée que la marque ; le libellé complet
		     reste porté par aria-label. -->
		<a href="/login/discord" class="exp-btn cta-login" aria-label={m.auth_login_discord()}>
			<span class="cta-full">{m.auth_login_discord()}</span>
			<span class="cta-short">{m.auth_login_short()}</span>
		</a>
	{/if}

	<!-- Utilitaires de session, hors de la rangée de navigation. Même motif de
	     divulgation que .switcher ci-dessus : un seul mécanisme de menu. -->
	<details class="utilities" bind:this={utilities}>
		<summary aria-label={m.header_menu()}>
			{#if mode === 'member' && user?.avatarUrl}
				<img src={user.avatarUrl} alt="" width="26" height="26" class="avatar" />
			{:else}
				<span class="dots" aria-hidden="true">⋯</span>
			{/if}
		</summary>
		<div class="menu">
			{#if mode === 'member' && user}
				<p class="who">{user.username}</p>
				<a href={appHref('/import')}>{m.import_title()}</a>
				<hr />
			{/if}
			<a href={DISCORD_URL} target="_blank" rel="noopener" class="discord-item">
				<svg viewBox="0 0 127.14 96.36" width="16" height="16" aria-hidden="true" fill="currentColor">
					<path
						d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z"
					/>
				</svg>
				{m.discord_community()}
			</a>
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
</header>

<style>
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
	/* Landing : l'illustration animée du hero doit rester visible derrière. */
	.topbar.transparent {
		position: absolute;
		left: 0;
		right: 0;
		background: none;
		border-bottom: none;
		z-index: 3;
	}

	/* --- Marque et sélecteur de serveur --- */
	.switcher,
	.utilities {
		position: relative;
		white-space: nowrap;
	}
	.switcher summary,
	.utilities summary {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		list-style: none;
	}
	.switcher summary::-webkit-details-marker,
	.utilities summary::-webkit-details-marker {
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
	.brand-home {
		display: flex;
		align-items: center;
		gap: 8px;
		white-space: nowrap;
		color: var(--text-1);
	}
	.guest-chip {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-3);
		border: 1px solid var(--border);
		border-radius: 4px;
		padding: 1px 5px;
	}

	/* --- Menus (motif partagé switcher / utilities) --- */
	.menu {
		position: absolute;
		top: calc(100% + 6px);
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
	.switcher .menu {
		left: 0;
	}
	.utilities .menu {
		right: 0;
	}
	.menu a,
	.menu .logout {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 7px 10px;
		border: none;
		border-radius: var(--r-sm);
		background: none;
		color: var(--text-2);
		font-size: 13px;
		text-align: left;
	}
	.menu a:hover,
	.menu .logout:hover {
		background: var(--surface-2);
		color: var(--text-1);
	}
	.menu a.current {
		color: var(--accent);
	}
	.menu hr {
		border: none;
		border-top: 1px solid var(--border);
		margin: 4px 0;
	}
	.menu .who {
		margin: 0;
		padding: 4px 10px;
		color: var(--text-3);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.menu .lang-row {
		padding: 2px 6px;
	}
	.dots {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border: 1px solid var(--border-strong);
		border-radius: var(--r-sm);
		color: var(--text-2);
		font-size: 15px;
		line-height: 1;
	}
	.utilities summary:hover .dots {
		color: var(--text-1);
		border-color: var(--focus-ring);
	}
	.avatar {
		border-radius: 50%;
	}

	/* --- Navigation --- */
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

	/* --- Recherche et action primaire --- */
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
	/* .exp-btn fournit dégradé, police display et poids ; on ne règle ici que la
	   densité, pour tenir dans une barre de 52 px. */
	.cta-login {
		padding: 6px 14px;
		font-size: 13px;
		white-space: nowrap;
	}
	.cta-short {
		display: none;
	}

	/* Entre 900 et 1400 px, la rangée est trop courte pour porter les 8 entrées de
	   nav ET un libellé de recherche : mesuré à 1280 px, la nav débordait de
	   60 px. On compacte la recherche (le raccourci clavier reste visible)
	   plutôt que de renvoyer la nav sur une seconde rangée dès le portable. */
	@media (max-width: 1400px) {
		.search-label {
			display: none;
		}
	}

	@media (max-width: 900px) {
		/* La nav passe sur sa propre rangée avant que le débordement horizontal
		   commence à masquer des entrées. */
		.topbar {
			flex-wrap: wrap;
			height: auto;
			padding: 8px 12px;
			gap: 8px 12px;
		}
		nav {
			order: 3;
			flex-basis: 100%;
			margin: 0 -12px -8px;
			padding: 0 12px 8px;
		}
		.brand-home,
		.switcher {
			margin-right: auto;
		}
	}
	@media (max-width: 520px) {
		/* Priorité à la marque et à l'action primaire : le reste se compacte. */
		.search-label,
		.search-btn kbd {
			display: none;
		}
		.guest-chip {
			display: none;
		}
		.cta-login {
			padding: 6px 12px;
			font-size: 12.5px;
		}
		/* Libellé court : permet à l'action primaire de rester sur la rangée de la
		   marque. Sans ça, elle passe sur une rangée à elle et l'en-tête atteint
		   3 rangées (142 px, soit 17 % d'un écran de 844 px). */
		.cta-full {
			display: none;
		}
		.cta-short {
			display: inline;
		}
	}
</style>

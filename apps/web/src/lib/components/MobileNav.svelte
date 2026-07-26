<script lang="ts">
	// Menu mobile : feuille ancrée en bas, comme la barre de la carte. Sous 900 px
	// la rangée de navigation de l'en-tête ne tient pas — la faire défiler
	// horizontalement cachait la moitié des entrées sans aucune indication (le
	// pouce ne « voit » pas un débordement). Tout passe donc ici : les
	// fonctionnalités en grille, puis les utilitaires de session.
	//
	// <dialog> natif plutôt qu'un panneau maison : piège de focus, Échap et
	// inertie du fond sont fournis par la plateforme.
	import posthog from 'posthog-js';
	import { m } from '$lib/paraglide/messages';
	import LangSwitch from '$lib/components/LangSwitch.svelte';
	import type { ServerSummary } from '$lib/server/servers';

	type HeaderUser = { id: string; username: string; avatarUrl: string | null };
	type NavItem = { href: string; label: () => string };

	let {
		open = $bindable(false),
		mode,
		items,
		hrefOf,
		isActive,
		user = null,
		myServers = [],
		currentSlug = null,
		settingsHref = null,
		importHref = null,
		discordUrl
	}: {
		open?: boolean;
		mode: 'guest' | 'member';
		items: NavItem[];
		hrefOf: (path: string) => string;
		isActive: (path: string) => boolean;
		user?: HeaderUser | null;
		myServers?: ServerSummary[];
		currentSlug?: string | null;
		/** Null si l'utilisateur n'est pas propriétaire du serveur. */
		settingsHref?: string | null;
		importHref?: string | null;
		discordUrl: string;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();

	// `showModal()`/`close()` ne peuvent pas être pilotés par un attribut : le
	// `open` déclaratif d'un <dialog> ouvre une boîte NON modale (pas de backdrop,
	// pas de piège de focus). On synchronise donc l'état ici.
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});

	// Un <dialog> modal neutralise les clics du fond mais PAS son défilement :
	// arrivé au bout de la feuille, le geste continuait sur la page derrière.
	// Le nettoyage passe par le retour de l'effet, donc il s'exécute aussi au
	// démontage (navigation la feuille ouverte).
	$effect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});

	// Un <dialog> modal neutralise les clics du fond mais PAS son défilement :
	// sans ce verrou, faire défiler la feuille jusqu'au bout emporte la page
	// derrière elle. Le nettoyage passe par le retour de l'effet, donc il
	// s'exécute aussi au démontage du composant.
	$effect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});
</script>

<dialog
	bind:this={dialog}
	class="sheet"
	aria-label={m.header_nav_title()}
	onclose={() => (open = false)}
	onclick={(e) => {
		// Le backdrop appartient au <dialog> lui-même : un clic dont la cible est
		// le dialogue (et pas un enfant) vient forcément de la zone hors panneau.
		if (e.target === dialog) open = false;
	}}
>
	<div class="panel">
		<header class="head">
			<span class="grip" aria-hidden="true"></span>
			<p class="title">{m.header_nav_title()}</p>
			<button class="close" aria-label={m.header_nav_close()} onclick={() => (open = false)}>
				×
			</button>
		</header>

		<div class="body">
			<nav class="grid" aria-label={m.header_nav_title()}>
				{#each items as item (item.href)}
					<a
						href={hrefOf(item.href)}
						class="tile"
						class:active={isActive(item.href)}
						aria-current={isActive(item.href) ? 'page' : undefined}
						onclick={() => (open = false)}
					>
						{item.label()}
					</a>
				{/each}
			</nav>

			{#if mode === 'member' && myServers.length > 1}
				<p class="sect">{m.switcher_all()}</p>
				<div class="rows">
					{#each myServers as s (s.id)}
						<a
							href="/s/{s.slug}"
							class="row"
							class:current={s.slug === currentSlug}
							onclick={() => (open = false)}
						>
							{s.name}
						</a>
					{/each}
				</div>
			{/if}

			<p class="sect">{m.header_account()}</p>
			<div class="rows">
				{#if mode === 'member' && user}
					<p class="who">{user.username}</p>
					{#if importHref}
						<a href={importHref} class="row" onclick={() => (open = false)}>{m.import_title()}</a>
					{/if}
					{#if settingsHref}
						<a href={settingsHref} class="row" onclick={() => (open = false)}>{m.settings_nav()}</a>
					{/if}
				{/if}
				<a href={discordUrl} target="_blank" rel="noopener" class="row">
					<svg viewBox="0 0 127.14 96.36" width="16" height="16" aria-hidden="true" fill="currentColor">
						<path
							d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z"
						/>
					</svg>
					{m.discord_community()}
				</a>
				<div class="lang"><LangSwitch /></div>
			</div>

			{#if mode === 'guest'}
				<p class="note">{m.guest_local_notice()}</p>
				<a href="/login/discord" class="exp-btn cta">{m.auth_login_discord()}</a>
			{:else}
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
	</div>
</dialog>

<style>
	.sheet {
		/* Le <dialog> est le calque plein écran ; `.panel` est la feuille. Sans
		   `max-width/max-height: none`, l'UA le borne à ~90 % du viewport et la
		   feuille ne peut plus toucher le bas de l'écran. */
		width: 100%;
		max-width: none;
		height: 100%;
		max-height: none;
		margin: 0;
		padding: 0;
		border: none;
		background: none;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		color: var(--text-1);
	}
	.sheet::backdrop {
		background: hsl(222 40% 4% / 0.6);
	}
	.panel {
		display: flex;
		flex-direction: column;
		max-height: 88%;
		background: var(--surface-1);
		border-top: 1px solid var(--border-strong);
		border-radius: var(--r-lg) var(--r-lg) 0 0;
		/* Barre home iOS : le rembourrage vit DANS la feuille, sinon la carte ou
		   la page transparaît sous elle. */
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}
	/* Entrée depuis le bas. `allow-discrete` + @starting-style : sans support
	   (Safari < 17.4), la feuille apparaît simplement sans glissement. */
	.sheet {
		transition:
			display 200ms allow-discrete,
			overlay 200ms allow-discrete,
			opacity 200ms cubic-bezier(0.23, 1, 0.32, 1);
		opacity: 0;
	}
	.sheet[open] {
		opacity: 1;
	}
	@starting-style {
		.sheet[open] {
			opacity: 0;
		}
	}
	.panel {
		transition: transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
	}
	.sheet:not([open]) .panel {
		transform: translateY(100%);
	}
	@starting-style {
		.sheet[open] .panel {
			transform: translateY(100%);
		}
	}

	.head {
		flex: none;
		position: relative;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 12px 8px;
	}
	.grip {
		position: absolute;
		top: 6px;
		left: 50%;
		transform: translateX(-50%);
		width: 36px;
		height: 4px;
		border-radius: 999px;
		background: var(--text-4);
	}
	.title {
		flex: 1;
		margin: 0;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--text-3);
	}
	.close {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		margin: -10px 0;
		background: none;
		border: none;
		color: var(--text-2);
		font-size: 22px;
		line-height: 1;
	}

	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0 12px 14px;
	}

	/* --- Fonctionnalités --- */
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 6px;
	}
	.tile {
		display: flex;
		align-items: center;
		min-height: 52px;
		padding: 8px 13px;
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		background: var(--surface-2);
		color: var(--text-2);
		font-size: 13.5px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tile:hover {
		color: var(--text-1);
		border-color: var(--border-strong);
	}
	.tile.active {
		background: var(--accent-soft);
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
		color: var(--accent);
	}

	/* --- Sections utilitaires --- */
	.sect {
		margin: 18px 0 6px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--text-4);
	}
	.rows {
		display: grid;
		gap: 2px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 0 10px;
		border-radius: var(--r-sm);
		color: var(--text-2);
		font-size: 13px;
	}
	.row:hover {
		background: var(--surface-2);
		color: var(--text-1);
	}
	.row.current {
		color: var(--accent);
	}
	.who {
		margin: 0 0 4px;
		padding: 0 10px;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-3);
	}
	.lang {
		display: flex;
		align-items: center;
		min-height: 44px;
		padding: 0 6px;
	}
	.note {
		margin: 16px 0 8px;
		font-size: 11.5px;
		line-height: 1.45;
		text-wrap: pretty;
		color: var(--text-3);
	}
	.cta {
		display: block;
		min-height: 46px;
		line-height: 26px;
		text-align: center;
	}
	.logout {
		width: 100%;
		min-height: 44px;
		margin-top: 16px;
		color: var(--text-2);
	}
</style>

<script lang="ts">
	import posthog from 'posthog-js';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { appHref } from '$lib/nav';
	import { navFor, tabsFor } from '$lib/navItems';
	import TopNav from '$lib/components/atlas/TopNav.svelte';
	import TabBar from '$lib/components/atlas/TabBar.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import GuestImportBanner from '$lib/components/GuestImportBanner.svelte';

	let { data, children } = $props();

	// Identifier l'utilisateur authentifié à chaque montage du layout (connexion et rechargement).
	// Un invité n'a pas d'identité : appeler identify(null) planterait à l'hydratation.
	$effect(() => {
		if (browser && data.mode === 'member') {
			posthog.identify(data.user.id, { username: data.user.username });
		}
	});

	let palette: CommandPalette | undefined = $state();
	// Partagée avec `main.fullscreen` ci-dessous : seule la carte a besoin d'une
	// chaîne de hauteurs fermes (voir le commentaire sur `.mapshell`).
	const isMapRoute = $derived(page.route.id === '/s/[slug]/map');

	const navItems = $derived(navFor(data.mode));
	const tabItems = $derived(tabsFor(data.mode));
	const isActive = (path: string) => page.url.pathname.startsWith(appHref(path));

	/** Feuille mobile. Montée en permanence : le <dialog> ne coûte rien fermé,
	 *  et le monter à l'ouverture la priverait de son animation d'entrée. */
	let navOpen = $state(false);
</script>

<div class="shell" class:mapshell={isMapRoute}>
	{#if data.mode === 'member'}
		<TopNav
			mode="member"
			server={data.server}
			membership={data.membership}
			myServers={data.myServers}
			user={data.user}
			items={navItems}
			hrefOf={appHref}
			{isActive}
			onsearch={() => palette?.show()}
			onmenu={() => (navOpen = true)}
		/>
	{:else}
		<TopNav
			mode="guest"
			items={navItems}
			hrefOf={appHref}
			{isActive}
			onsearch={() => palette?.show()}
			onmenu={() => (navOpen = true)}
		/>
	{/if}
	{#if data.mode === 'guest'}
		<p class="guest-notice">{m.guest_local_notice()}</p>
	{:else}
		<!-- Proposition de reprise du travail fait en mode invité. -->
		<GuestImportBanner slug={data.server.slug} />
	{/if}
	<main class:fullscreen={isMapRoute}>{@render children()}</main>
	<!-- La carte est bord à bord sous 1024 px (écran 5b) : pas de barre
	     d'onglets, qui casserait en plus sa chaîne de hauteurs. -->
	{#if !isMapRoute}
		<TabBar items={tabItems} hrefOf={appHref} {isActive} onmore={() => (navOpen = true)} />
	{/if}
</div>

<!-- La feuille porte les 9 fonctionnalités, pas seulement celles de la barre
     d'onglets : c'est par elle qu'on atteint Reproduction, Bases, Objets,
     Technologies et Constructions sur mobile. -->
<MobileNav
	bind:open={navOpen}
	mode={data.mode}
	items={navItems}
	hrefOf={appHref}
	{isActive}
	user={data.mode === 'member' ? data.user : null}
	myServers={data.mode === 'member' ? data.myServers : []}
	currentSlug={data.mode === 'member' ? data.server.slug : null}
	settingsHref={data.mode === 'member' && data.membership.role === 'owner'
		? appHref('/settings')
		: null}
	importHref={data.mode === 'member' ? appHref('/import') : null}
	discordUrl="https://discord.gg/SJehy5fFJ"
/>
<CommandPalette bind:this={palette} />

<svelte:head>
	{#if data.mode === 'member'}
		<!-- Les pages tenant sont privées : jamais d'indexation. Les pages
		     publiques équivalentes (/paldex, …) sont les canoniques. -->
		<meta name="robots" content="noindex, nofollow" />
	{/if}
</svelte:head>

<style>
	.shell {
		/* Un plancher, pas une hauteur ferme : `.topnav` est `position: sticky` et
		   enfant direct de `.shell` - une hauteur ferme bornerait sa zone de
		   défilement à .shell (donc à un seul viewport) et ferait disparaître
		   l'en-tête sur toute page dont le contenu dépasse 100dvh (paldex, items,
		   tech, breeding...). */
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		/* Hauteur de la barre d'onglets : 12 haut + 18 glyphe + 3 + 10 libellé
		   + 22 bas. Consommée par le dégagement de <main> ci-dessous. */
		--tabbar-h: 68px;
	}
	/* Hauteur ferme, réservée à la carte : sa barre latérale a besoin d'une
	   chaîne de hauteurs définies (main.fullscreen -> .map-wrap -> .sidebar ->
	   .res) pour que sa liste défile en interne au lieu de pousser toute la
	   page. `main.fullscreen` (ci-dessous) a déjà `min-height: 0` pour pouvoir
	   se rétrécir dans cette hauteur fixée. */
	.shell.mapshell {
		height: 100dvh;
	}
	.guest-notice {
		margin: 0;
		padding: 8px 16px;
		border-bottom: 1px solid var(--color-line);
		background: var(--color-surface);
		color: var(--color-muted);
		font-size: 12px;
		text-align: center;
		text-wrap: pretty;
	}
	main {
		flex: 1;
		width: 100%;
		/* La largeur du cadre de référence du handoff. */
		max-width: 1120px;
		margin: 0 auto;
		/* Gouttière commune du handoff (36 px desktop / 20 px mobile). Publiée en
		   variable : les sections pleine largeur — le héros de la fiche Pal, le
		   cadre de la carte — s'en servent pour la reprendre en marge négative
		   via .full-bleed (app.css), plutôt que de la retirer d'ici et de laisser
		   chaque page la reposer. */
		--gutter: 36px;
		padding: 22px var(--gutter) 36px;
		padding-left: max(var(--gutter), env(safe-area-inset-left));
		padding-right: max(var(--gutter), env(safe-area-inset-right));
	}
	main.fullscreen {
		max-width: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	@media (max-width: 1023.98px) {
		main {
			--gutter: 20px;
			padding-top: 8px;
		}
		/* Dégage la barre d'onglets fixe. */
		main:not(.fullscreen) {
			padding-bottom: calc(var(--tabbar-h) + 24px + env(safe-area-inset-bottom));
		}
	}
	@media (max-width: 640px) {
		.guest-notice {
			padding: 7px 14px;
			font-size: 11.5px;
			line-height: 1.4;
		}
	}
	/* Carte : la chaîne de hauteurs est fermée à 100dvh et l'écran sert de
	   second moniteur pendant la partie. Ces deux lignes coûtaient 53 px de
	   carte en portrait, 33 en paysage — le même message reste dans le menu,
	   juste au-dessus du bouton de connexion. */
	@media (max-width: 900px) {
		.mapshell .guest-notice {
			display: none;
		}
	}
</style>

<script lang="ts">
	import posthog from 'posthog-js';
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import AppHeader from '$lib/components/AppHeader.svelte';
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
</script>

<div class="shell">
	{#if data.mode === 'member'}
		<AppHeader
			mode="member"
			server={data.server}
			membership={data.membership}
			myServers={data.myServers}
			user={data.user}
			onsearch={() => palette?.show()}
		/>
	{:else}
		<AppHeader mode="guest" onsearch={() => palette?.show()} />
	{/if}
	{#if data.mode === 'guest'}
		<p class="guest-notice">{m.guest_local_notice()}</p>
	{:else}
		<!-- Proposition de reprise du travail fait en mode invité. -->
		<GuestImportBanner slug={data.server.slug} />
	{/if}
	<main class:fullscreen={page.route.id === '/s/[slug]/map'}>{@render children()}</main>
</div>
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
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}
	.guest-notice {
		margin: 0;
		padding: 8px 16px;
		border-bottom: 1px solid var(--border);
		background: var(--surface-2);
		color: var(--text-3);
		font-size: 12px;
		text-align: center;
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
</style>

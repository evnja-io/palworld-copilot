<script lang="ts">
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import { localizeHref } from '$lib/paraglide/runtime';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? m.error_404_title() : m.error_generic_title()} — {m.app_title()}</title>
	<!-- Une page d'erreur n'a rien à faire dans l'index. -->
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="wrap">
	<p class="code tnum">{page.status}</p>
	<h1>{notFound ? m.error_404_title() : m.error_generic_title()}</h1>
	{#if notFound}
		<p class="body">{m.error_404_body()}</p>
	{/if}
	<div class="actions">
		<a class="primary" href={localizeHref('/paldex')}>{m.error_browse_paldex()}</a>
		<a href={localizeHref('/')}>{m.error_back_home()}</a>
	</div>
</div>

<style>
	.wrap {
		max-width: 520px;
		margin: 0 auto;
		padding: 80px 16px;
		text-align: center;
	}
	.code {
		margin: 0;
		font-family: var(--font-display);
		font-size: 56px;
		font-weight: 600;
		line-height: 1;
		color: var(--text-4);
	}
	h1 {
		margin: 12px 0 0;
	}
	.body {
		margin: 10px 0 0;
		color: var(--text-3);
		font-size: 14px;
	}
	.actions {
		display: flex;
		gap: 16px;
		justify-content: center;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 28px;
		font-size: 14px;
	}
	.actions a {
		color: var(--text-2);
	}
	.actions a:hover {
		color: var(--accent);
	}
	.actions .primary {
		font-weight: 500;
		color: var(--accent);
		background: var(--accent-soft);
		border: 1px solid var(--focus-ring);
		border-radius: var(--r-sm);
		padding: 8px 16px;
	}
</style>

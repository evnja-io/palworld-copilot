<script lang="ts">
	// Barre d'onglets mobile (< 1024 px) — écrans 4a l.190, 4c l.279, 5a l.95.
	// 4 fonctionnalités épinglées + « Plus » qui ouvre la feuille MobileNav.
	import { m } from '$lib/paraglide/messages';
	import type { NavItem } from '$lib/navItems';

	let {
		items,
		hrefOf,
		isActive,
		onmore
	}: {
		items: NavItem[];
		hrefOf: (path: string) => string;
		isActive: (path: string) => boolean;
		onmore: () => void;
	} = $props();
</script>

<nav class="tabbar" aria-label={m.nav_primary()}>
	{#each items as item (item.href)}
		<a
			href={hrefOf(item.href)}
			class="tab"
			class:on={isActive(item.href)}
			aria-current={isActive(item.href) ? 'page' : undefined}
		>
			<span class="glyph" aria-hidden="true">{item.glyph}</span>
			<span class="label">{item.label()}</span>
		</a>
	{/each}
	<button type="button" class="tab" onclick={onmore}>
		<span class="glyph" aria-hidden="true">⋯</span>
		<span class="label">{m.nav_more()}</span>
	</button>
</nav>

<style>
	.tabbar {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 20;
		display: flex;
		justify-content: space-around;
		align-items: center;
		padding: 12px 8px max(22px, env(safe-area-inset-bottom));
		background: rgba(13, 14, 18, 0.92);
		backdrop-filter: blur(12px);
		border-top: 1px solid var(--color-line);
	}

	.tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		min-width: 56px;
		/* Plancher tactile : le dessin fait ~46 px de haut, on complète. */
		min-height: 44px;
		padding: 0;
		border: none;
		background: none;
		color: var(--color-muted);
		text-decoration: none;
	}
	.tab:hover {
		color: var(--color-text);
		background: none;
	}
	.tab.on,
	.tab.on:hover {
		color: #ff9450;
	}

	.glyph {
		font-size: 18px;
		line-height: 1;
	}
	.label {
		font-size: 10px;
		font-weight: 600;
	}
	.tab.on .label {
		font-weight: 700;
	}

	@media (min-width: 1024px) {
		.tabbar {
			display: none;
		}
	}
</style>

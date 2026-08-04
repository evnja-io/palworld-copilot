<script lang="ts">
	// Pilule de filtre — 2a l.528-534 (par élément), 3b l.374-377 (neutre),
	// 3c l.449-451 (flottante sur la carte).
	import type { Snippet } from 'svelte';
	import { elVar } from '$lib/game/elements';

	let {
		active = false,
		element,
		tone = 'neutral',
		onclick,
		children
	}: {
		active?: boolean;
		/** Id d'élément (« Fire ») quand tone vaut 'element'. */
		element?: string;
		tone?: 'neutral' | 'element' | 'glassy';
		onclick: () => void;
		children: Snippet;
	} = $props();
</script>

<button
	type="button"
	class="pill {tone}"
	class:active
	aria-pressed={active}
	style={element ? `--el:${elVar(element)}` : ''}
	{onclick}
>
	{@render children()}
</button>

<style>
	.pill {
		flex: none;
		font-size: 12px;
		font-weight: 600;
		border-radius: 999px;
		padding: 7px 15px;
		border: 1px solid transparent;
		background: var(--color-surface);
		color: var(--color-muted);
		cursor: pointer;
		white-space: nowrap;
		transition:
			background var(--duration-hover) var(--ease-out-soft),
			border-color var(--duration-hover) var(--ease-out-soft),
			color var(--duration-hover) var(--ease-out-soft);
	}
	.pill:hover {
		color: var(--color-text);
	}

	.pill.element {
		background: color-mix(in oklab, var(--el) 14%, transparent);
		border-color: color-mix(in oklab, var(--el) 30%, transparent);
		color: color-mix(in oklab, var(--el) 55%, white);
	}
	.pill.element:hover {
		background: color-mix(in oklab, var(--el) 20%, transparent);
	}

	.pill.glassy {
		background: rgba(13, 14, 18, 0.7);
		backdrop-filter: blur(6px);
		border-color: rgba(255, 255, 255, 0.1);
	}

	/* L'état actif est blanc plein quelle que soit la tonalité (2a l.528) —
	   sauf sur la carte, où il garde la teinte de marque (3c l.449). */
	.pill.active {
		background: #fff;
		color: var(--color-bg);
		font-weight: 700;
		border-color: transparent;
	}
	.pill.glassy.active {
		background: rgba(13, 14, 18, 0.85);
		border-color: rgba(255, 122, 47, 0.4);
		color: #ff9450;
		font-weight: 700;
	}

	@media (max-width: 1023.98px) {
		.pill {
			padding: 9px 16px;
		}
	}
</style>

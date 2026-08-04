<script lang="ts">
	// Carte de statistique — 1c l.852-855 (desktop, 4 colonnes) et
	// 4b l.217-219 (mobile, 3 colonnes).
	import { elVar } from '$lib/game/elements';

	let {
		label,
		value,
		accent = false,
		element
	}: {
		label: string;
		value: number | string;
		/** La stat clé, bordée et teintée par l'élément (1c l.853). */
		accent?: boolean;
		element?: string;
	} = $props();
</script>

<div class="stat" class:accent style={accent && element ? `--el:${elVar(element)}` : ''}>
	<div class="label">{label}</div>
	<div class="value tnum">{value}</div>
</div>

<style>
	.stat {
		background: var(--color-surface);
		border: 1px solid transparent;
		border-radius: 18px;
		padding: 20px 22px;
	}
	.label {
		font-size: 11.5px;
		font-weight: 600;
		color: var(--color-muted);
		letter-spacing: 0.06em;
	}
	.value {
		font-family: var(--font-display);
		font-size: 40px;
		font-weight: 800;
		line-height: 1.1;
		margin-top: 4px;
	}

	.stat.accent {
		background: linear-gradient(
			160deg,
			color-mix(in oklab, var(--el) 16%, transparent),
			color-mix(in oklab, var(--el) 4%, transparent)
		);
		border-color: color-mix(in oklab, var(--el) 25%, transparent);
	}
	.stat.accent .label {
		color: color-mix(in oklab, var(--el) 45%, white);
	}
	.stat.accent .value {
		color: color-mix(in oklab, var(--el) 70%, white);
	}

	@media (max-width: 1023.98px) {
		.stat {
			border-radius: 14px;
			padding: 12px 14px;
		}
		.label {
			font-size: 10px;
			letter-spacing: 0.07em;
		}
		.value {
			font-size: 24px;
			margin-top: 2px;
		}
	}
</style>

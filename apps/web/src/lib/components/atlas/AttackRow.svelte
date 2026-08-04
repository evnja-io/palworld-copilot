<script lang="ts">
	// Rangée d'attaque — 1c l.860 et 4b l.223 (variante « card », sur surface),
	// 2b l.603 et 4c l.269 (variante « hero », sur fond teinté).
	//
	// Le cooldown vient de skills.json[].ct, présent dans les données mais
	// jamais affiché jusqu'ici.
	import { elLabel, elVar } from '$lib/game/elements';

	let {
		name,
		level,
		power,
		element = 'Normal',
		cooldown,
		variant = 'card'
	}: {
		name: string;
		/** Niveau d'apprentissage — variante « card » uniquement. */
		level?: number;
		power: number;
		element?: string;
		/** Secondes (skills.json[].ct) — variante « hero » uniquement. */
		cooldown?: number;
		variant?: 'card' | 'hero';
	} = $props();
</script>

<div class="row {variant} lift-sm" style="--el:{elVar(element)}">
	{#if variant === 'card'}
		<!-- Le handoff met une emoji par élément ; aucun jeu d'icônes d'élément
		     n'existe dans static/icons. La tuile porte l'initiale. -->
		<span class="tile" aria-hidden="true">{elLabel(element).charAt(0)}</span>
	{/if}
	<div class="text">
		<div class="name">{name}</div>
		{#if variant === 'card' && level !== undefined}
			<div class="meta">Niv. {level} · {elLabel(element)}</div>
		{/if}
	</div>
	{#if cooldown !== undefined}
		<span class="ct tnum">{cooldown} s</span>
	{/if}
	<span class="power tnum">{power}</span>
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 14px;
		border-radius: 14px;
		padding: 14px 18px;
	}
	.card {
		background: var(--color-surface);
	}
	.card:hover {
		background: var(--color-raised);
	}
	.hero {
		background: rgba(0, 0, 0, 0.28);
		border-radius: 12px;
		padding: 10px 16px;
		gap: 12px;
	}

	.tile {
		width: 34px;
		height: 34px;
		flex: none;
		border-radius: 10px;
		background: linear-gradient(
			135deg,
			var(--el),
			color-mix(in oklab, var(--el) 55%, white)
		);
		display: grid;
		place-items: center;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 15px;
		color: rgba(0, 0, 0, 0.55);
	}

	.text {
		flex: 1;
		min-width: 0;
	}
	.name {
		font-weight: 600;
		font-size: 14px;
	}
	.hero .name {
		font-size: 13.5px;
		color: #f1ecff;
	}
	.meta {
		font-size: 11.5px;
		color: var(--color-muted);
	}

	.ct {
		font-size: 11px;
		color: color-mix(in oklab, var(--el) 35%, white);
	}

	.power {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 20px;
		color: color-mix(in oklab, var(--el) 70%, white);
	}
	.hero .power {
		font-size: 17px;
		color: color-mix(in oklab, var(--el) 20%, white);
	}

	@media (max-width: 1023.98px) {
		.row {
			gap: 12px;
			border-radius: 13px;
			padding: 12px 15px;
		}
		.tile {
			width: 30px;
			height: 30px;
			border-radius: 9px;
			font-size: 13px;
		}
		.name {
			font-size: 13.5px;
		}
		.meta {
			font-size: 10.5px;
		}
		.power {
			font-size: 17px;
		}
		.hero {
			border-radius: 11px;
			padding: 10px 14px;
			gap: 10px;
		}
		.hero .name {
			font-size: 12.5px;
		}
		.hero .power {
			font-size: 15px;
		}
		.ct {
			font-size: 10px;
		}
	}
</style>

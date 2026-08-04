<script lang="ts">
	// Carte du Paldex — écrans 2a (desktop, 4 colonnes) et 4a (mobile, 2 colonnes).
	//
	// Le handoff dessine la pastille de capture comme un simple indicateur ; ici
	// elle reste un <button aria-pressed> : cocher un Pal depuis la grille est
	// une fonctionnalité livrée, pas une décoration.
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import { workIcon, workLabel } from '$lib/game/work';
	import { getLocale } from '$lib/paraglide/runtime';
	import { appHref } from '$lib/nav';
	import { elVars } from '$lib/game/elements';
	import { m } from '$lib/paraglide/messages';
	import ElementBadge from './ElementBadge.svelte';
	import type { Locale } from '$lib/search/tokens';

	let {
		pal,
		caught,
		groupCount,
		highlightWork = '',
		ontoggle
	}: {
		pal: {
			id: string;
			zukanIndex: number;
			zukanSuffix?: string;
			elements: string[];
			// `| undefined` : les entrées de pals.json portent des clés optionnelles
			work: Record<string, number | undefined>;
		};
		caught: boolean;
		groupCount: number;
		/** Aptitude filtrée : son niveau remonte sur la vignette. */
		highlightWork?: string;
		ontoggle: () => void;
	} = $props();

	const locale = getLocale() as Locale;
	const name = $derived(gameName(`pal:${pal.id}`));
	const num = $derived(`#${String(pal.zukanIndex).padStart(3, '0')}${pal.zukanSuffix ?? ''}`);
	const hlLevel = $derived(highlightWork ? pal.work[highlightWork] : undefined);
</script>

<div class="card lift" class:uncaught={!caught} style={elVars(pal.elements)}>
	<a href={appHref(`/paldex/${pal.id}`)} class="art" aria-label={name}>
		{#if palIcon(pal.id)}
			<img src={palIcon(pal.id)} alt="" loading="lazy" />
		{:else}
			<span class="no-icon" aria-hidden="true">?</span>
		{/if}
		<span class="num tnum">{num}</span>
		{#if hlLevel !== undefined}
			<span class="hl tnum" title={workLabel(highlightWork, locale)}>
				{#if workIcon(highlightWork)}
					<img src={workIcon(highlightWork)} alt="" width="12" height="12" loading="lazy" />
				{/if}
				{hlLevel}
			</span>
		{/if}
	</a>

	<button
		class="pip"
		class:on={caught}
		onclick={ontoggle}
		aria-pressed={caught}
		aria-label={m.pal_toggle_caught()}
	>
		{#if caught}<span aria-hidden="true">✓</span>{/if}
	</button>
	{#if groupCount > 0}
		<span class="group tnum" title={m.paldex_caught_group({ count: groupCount, total: 0 })}>
			{groupCount}
		</span>
	{/if}

	<a href={appHref(`/paldex/${pal.id}`)} class="foot">
		<span class="name">{name}</span>
		<span class="badges">
			{#each pal.elements as e (e)}<ElementBadge element={e} />{/each}
		</span>
	</a>
</div>

<style>
	.card {
		position: relative;
		border-radius: var(--radius-card);
		overflow: hidden;
		background: var(--color-surface);
	}

	.art {
		display: grid;
		place-items: center;
		position: relative;
		aspect-ratio: 1.15;
		/* Teinte d'élément + hachures diagonales (2a l.538).
		   Mélange en sRGB et non en oklab : le HTML de référence pose des rgba()
		   littéraux (.28 à .35 selon l'élément, 32 % au milieu), et
		   `color-mix(in srgb, X 32%, transparent)` les reproduit exactement.
		   En oklab, le mélange vers le transparent désature — la vitrine perdait
		   son bleu et son orange. */
		background:
			linear-gradient(
				160deg,
				color-mix(in srgb, var(--el) 32%, transparent),
				color-mix(in srgb, var(--el2, var(--el)) var(--el2-a, 5%), transparent)
			),
			repeating-linear-gradient(
				45deg,
				rgba(255, 255, 255, 0.04) 0 14px,
				transparent 14px 28px
			);
	}
	.art img {
		width: 62%;
		height: 62%;
		object-fit: contain;
		filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.45));
	}
	/* 10 Pals n'ont pas d'icône (casse divergente dans icons.json). */
	.no-icon {
		font-family: var(--font-display);
		font-size: 32px;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.18);
	}

	.num {
		position: absolute;
		top: 12px;
		left: 14px;
		font: 11px ui-monospace, Menlo, monospace;
		color: rgba(255, 255, 255, 0.45);
	}

	.hl {
		position: absolute;
		bottom: 10px;
		left: 12px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font: 11px ui-monospace, Menlo, monospace;
		color: var(--color-text);
		background: rgba(0, 0, 0, 0.45);
		backdrop-filter: blur(4px);
		border-radius: 999px;
		padding: 3px 8px;
	}

	.pip {
		position: absolute;
		top: 10px;
		right: 12px;
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-size: 11px;
		line-height: 1;
		color: #fff;
		background: transparent;
		border: 2px solid rgba(255, 255, 255, 0.25);
		transition: background var(--duration-hover) var(--ease-out-soft);
	}
	.pip.on {
		background: var(--color-el-eau);
		border-color: var(--color-el-eau);
	}
	.pip:hover {
		border-color: rgba(255, 255, 255, 0.55);
	}
	/* La pastille fait 22 px pour coller au dessin ; la zone de tap est portée
	   par un pseudo-élément pour tenir le plancher tactile de 44 px. */
	.pip::after {
		content: '';
		position: absolute;
		inset: -11px;
	}

	.group {
		position: absolute;
		top: 14px;
		right: 40px;
		font: 10px ui-monospace, Menlo, monospace;
		color: rgba(255, 255, 255, 0.55);
		background: rgba(0, 0, 0, 0.4);
		border-radius: 999px;
		padding: 2px 6px;
	}

	.foot {
		display: block;
		padding: 14px 16px 16px;
	}
	.foot:hover {
		color: inherit;
	}
	.name {
		display: block;
		font-weight: 700;
		font-size: 16px;
	}
	.badges {
		display: flex;
		gap: 6px;
		margin-top: 8px;
		flex-wrap: wrap;
	}

	/* Non capturé : silhouette (2a l.550). */
	.uncaught .art {
		filter: saturate(0.4);
	}
	.uncaught .art img {
		filter: brightness(0.22) opacity(0.85);
	}
	.uncaught .name {
		color: var(--color-muted);
	}

	@media (max-width: 1023.98px) {
		.card {
			border-radius: 18px;
		}
		.art {
			aspect-ratio: 1.1;
		}
		.art img {
			width: 64%;
			height: 64%;
		}
		.num {
			top: 9px;
			left: 11px;
			font-size: 10px;
		}
		.pip {
			top: 8px;
			right: 9px;
			width: 20px;
			height: 20px;
			font-size: 10px;
		}
		.group {
			top: 11px;
			right: 34px;
		}
		.foot {
			padding: 11px 13px 13px;
		}
		.name {
			font-size: 14.5px;
		}
		.badges {
			gap: 5px;
			margin-top: 6px;
		}
	}
</style>

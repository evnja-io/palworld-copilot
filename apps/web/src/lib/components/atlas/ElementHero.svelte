<script lang="ts">
	// Héros teinté par élément — 1c l.830 (fiche Pal), 2b l.596 (équipe),
	// 4b l.204 et 4c l.262 (mobile).
	//
	// Le HTML de référence peint des rampes à la main (#ff5a0f → #c2410c →
	// #3b1104 pour le feu, violets pour l'équipe). On les généralise en
	// color-mix sur les neuf éléments : le résultat est un cran plus sombre au
	// milieu, mais une rampe littérale ne se décline pas.
	import type { Snippet } from 'svelte';
	import { elVars } from '$lib/game/elements';

	let {
		elements,
		variant = 'pal',
		stripes = true,
		bleed = false,
		children,
		media
	}: {
		elements: readonly string[];
		/** 'pal' : rampe 160° (1c) · 'team' : rampe 150°, plus sombre (2b). */
		variant?: 'pal' | 'team';
		/** Hachures diagonales par-dessus la rampe (1c l.832). */
		stripes?: boolean;
		/** Plein cadre, sans rayon : héros mobile de la fiche Pal (4b). */
		bleed?: boolean;
		children: Snippet;
		media?: Snippet;
	} = $props();
</script>

<div class="hero {variant}" class:bleed style={elVars(elements)}>
	<div class="glow" aria-hidden="true"></div>
	{#if stripes}<div class="stripes" aria-hidden="true"></div>{/if}
	<div class="inner" class:with-media={!!media}>
		<div class="content">{@render children()}</div>
		{#if media}
			<div class="media">{@render media()}</div>
		{/if}
	</div>
</div>

<style>
	.hero {
		position: relative;
		overflow: hidden;
		border-radius: var(--radius-hero);
	}
	.hero.bleed {
		border-radius: 0;
	}

	/* Rampe de fond. Le second élément n'apparaît qu'en bi-type : en mono-type
	   --el2 vaut --el et la rampe est identique à la recette du thème. */
	.hero.pal {
		background: linear-gradient(
			160deg,
			var(--el) 0%,
			color-mix(in oklab, var(--el2, var(--el)) 55%, black) 45%,
			color-mix(in oklab, var(--el2, var(--el)) 18%, black) 100%
		);
	}
	.hero.team {
		background: linear-gradient(
			150deg,
			color-mix(in oklab, var(--el) 62%, black) 0%,
			color-mix(in oklab, var(--el2, var(--el)) 34%, black) 50%,
			color-mix(in oklab, var(--el2, var(--el)) 12%, black) 100%
		);
	}

	/* Rehaut radial en haut à droite (thème .el-hero / 1c l.831). */
	.glow {
		position: absolute;
		inset: 0;
		background: radial-gradient(
			70% 90% at 80% 10%,
			rgba(255, 255, 255, 0.3),
			transparent 55%
		);
		pointer-events: none;
	}
	.stripes {
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			-30deg,
			rgba(255, 255, 255, 0.04) 0 2px,
			transparent 2px 90px
		);
		pointer-events: none;
	}

	.inner {
		position: relative;
		padding: 44px 48px 40px;
	}
	.inner.with-media {
		display: grid;
		grid-template-columns: 1fr 380px;
		gap: 20px;
		align-items: end;
	}

	/* Héros d'équipe (2b l.597) : portrait à gauche, texte au centre, actions en
	   haut à droite.
	   Deux colonnes et non trois : le bloc de texte doit rester UNE cellule.
	   En `display: contents`, chacun de ses enfants devenait une rangée de
	   grille et le `gap` de 26 px se glissait entre tous — le héros triplait de
	   hauteur. Les actions, elles, sont détachées en absolu (elles vivent dans
	   le flux du texte côté balisage). */
	.hero.team .inner.with-media {
		grid-template-columns: 220px 1fr;
		gap: 26px;
		padding: 28px 32px;
		align-items: center;
	}
	/* Placement explicite : dans le balisage le texte précède le média, une
	   auto-placement les empilerait tous deux en colonne 1. */
	.hero.team .media {
		grid-column: 1;
		grid-row: 1;
		aspect-ratio: 1;
		background: none;
	}
	.hero.team .content {
		grid-column: 2;
		grid-row: 1;
	}

	.media {
		aspect-ratio: 1 / 1.05;
		border-radius: 20px;
		background: repeating-linear-gradient(
			45deg,
			rgba(255, 255, 255, 0.08) 0 16px,
			rgba(255, 255, 255, 0.03) 16px 32px
		);
		display: grid;
		place-items: center;
	}

	@media (max-width: 1023.98px) {
		.inner {
			padding: 18px 20px 24px;
		}
		/* 84 px en bas (4b l.204) : c'est ce qui laisse le nom passer au-dessus
		   de la feuille de contenu, qui remonte de 32 px. */
		.hero.pal .inner {
			padding-bottom: 84px;
		}
		/* Ordre du dessin 4b : badges, PUIS render, PUIS nom. Les badges et le
		   nom viennent tous deux du slot `children` — `display: contents` sur
		   .content remonte ses enfants au niveau du flex pour que le render
		   puisse s'intercaler entre eux (la page pose leurs `order`). */
		.inner.with-media {
			display: flex;
			flex-direction: column;
			/* Sans ça, le `align-items: end` du desktop devient, en colonne, un
			   alignement à DROITE sur l'axe transversal : le titre se retrouvait
			   dimensionné à son contenu et collé au bord. */
			align-items: stretch;
		}
		.content {
			display: contents;
		}
		.media {
			order: 2;
			aspect-ratio: auto;
			background: none;
			border-radius: 0;
			place-items: center;
		}

		/* Le héros d'équipe n'a pas le même ordre : le portrait vient AVANT le
		   texte (4c l.264, où il est même à sa gauche). On le remonte et on le
		   borne à 76 px plutôt que de le laisser occuper la largeur. */
		.hero.team .content {
			display: block;
		}
		.hero.team .inner.with-media {
			display: flex;
			flex-direction: column;
		}
		.hero.team .media {
			order: -1;
			width: 76px;
			margin-bottom: 14px;
		}
	}
</style>

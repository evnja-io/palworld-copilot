<script lang="ts">
	import VariantA from './VariantA.svelte';
	import VariantB from './VariantB.svelte';
	import VariantC from './VariantC.svelte';
	import VariantD from './VariantD.svelte';
	import VariantE from './VariantE.svelte';
	import FeedbackOverlay from './FeedbackOverlay.svelte';

	const variants = [
		{
			id: 'A',
			label: 'Hiérarchie « roster »',
			why: 'Lisibilité éditoriale maximale : bandeau d’équipe puis 5 cartes en colonne, tout se lit de haut en bas sans interaction.',
			diff: 'Portrait à gauche, ruban partenaire en liseré, passifs/actifs groupés par proximité. Aucune sélection : tout est visible, au prix de la longueur de page.'
		},
		{
			id: 'B',
			label: 'Layout « banc de touche »',
			why: 'Mise en scène façon team builder de jeu : 5 portraits en vedette, un seul slot détaillé à la fois.',
			diff: 'Le banc reste compact (scroll horizontal mobile), le panneau concentre l’édition. Moins de scroll, mais un slot masque les autres.'
		},
		{
			id: 'C',
			label: 'Densité « planche d’analyse »',
			why: 'Tout voir d’un coup pour comparer : grille compacte, stats chiffrées, couverture élémentaire agrégée.',
			diff: 'Tables .tnum, couverture et somme de puissance en entête, note dans la grille. La plus dense — assume un public theorycraft.'
		},
		{
			id: 'D',
			label: 'Interaction « fiche joueur »',
			why: 'Édition focalisée : liste étroite pour naviguer vite entre slots, éditeur riche à droite, barre de sauvegarde sticky.',
			diff: 'Split desktop / accordéon mobile (même éditeur, rendu deux fois via snippet). L’état dirty vit dans la barre sticky, toujours visible.'
		},
		{
			id: 'E',
			label: 'Direction expressive « expédition »',
			why: 'Pousser l’identité nocturne : halos élémentaires derrière les portraits, numéros display, ruban partenaire traité en artefact.',
			diff: 'La couleur vient des éléments (color-mix sur --el-*), jamais d’une palette nouvelle. Teste jusqu’où l’immersion tient sans kitsch.'
		}
	];
</script>

<svelte:head>
	<title>Design Lab — Team Builder</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<main class="lab">
	<header class="lab-head">
		<p class="lab-tag">Design Lab · temporaire</p>
		<h1>Team Builder — 5 pistes</h1>
		<p class="brief">
			Éditeur d'équipes de 5 slots (Pal + 4 passifs + 3 actifs), hybride app-pro/jeu,
			densité confortable, desktop et mobile à égalité. Les 5 variantes rendent la même
			équipe fictive ; les boutons sont inertes (maquettes). Survole, compare, puis utilise
			« Ajouter un feedback » (en bas à droite) pour annoter n'importe quel élément,
			remplis la direction générale et « Tout copier » pour coller le résultat dans le terminal.
		</p>
		<nav class="anchors" aria-label="Variantes">
			{#each variants as v (v.id)}
				<a href="#variant-{v.id}">{v.id} — {v.label}</a>
			{/each}
		</nav>
	</header>

	{#each variants as v (v.id)}
		<section data-variant={v.id} id="variant-{v.id}" class="variant">
			<header class="v-head">
				<h2><span class="v-badge">{v.id}</span>{v.label}</h2>
				<p class="v-why"><strong>Pourquoi cette piste :</strong> {v.why}</p>
				<p class="v-diff">{v.diff}</p>
			</header>
			<div class="v-body">
				{#if v.id === 'A'}<VariantA />{/if}
				{#if v.id === 'B'}<VariantB />{/if}
				{#if v.id === 'C'}<VariantC />{/if}
				{#if v.id === 'D'}<VariantD />{/if}
				{#if v.id === 'E'}<VariantE />{/if}
			</div>
		</section>
	{/each}

	<FeedbackOverlay />
</main>

<style>
	.lab {
		max-width: 1080px;
		margin: 0 auto;
		padding: 24px 16px 120px;
		display: flex;
		flex-direction: column;
		gap: 40px;
	}
	.lab-tag {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--accent);
	}
	.lab-head h1 {
		margin: 4px 0 8px;
	}
	.brief {
		margin: 0 0 12px;
		color: var(--text-2);
		font-size: 13px;
		max-width: 78ch;
		text-wrap: pretty;
	}
	.anchors {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.anchors a {
		font-size: 12px;
		color: var(--text-2);
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 5px 12px;
		min-height: 30px;
		display: inline-flex;
		align-items: center;
		transition: border-color 140ms, color 140ms;
	}
	.anchors a:hover {
		color: var(--accent);
		border-color: color-mix(in srgb, var(--accent) 40%, transparent);
	}
	.variant {
		scroll-margin-top: 16px;
		border-top: 1px solid var(--border);
		padding-top: 24px;
	}
	.v-head {
		margin-bottom: 16px;
	}
	.v-head h2 {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 19px;
		color: var(--text-1);
		margin-bottom: 6px;
	}
	.v-badge {
		display: inline-grid;
		place-items: center;
		width: 28px;
		height: 28px;
		font-family: var(--font-display);
		font-size: 14px;
		font-weight: 700;
		color: var(--accent);
		background: var(--accent-soft);
		border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
		border-radius: var(--r-sm);
	}
	.v-why {
		margin: 0 0 4px;
		font-size: 13px;
		color: var(--text-2);
		max-width: 82ch;
	}
	.v-why strong {
		color: var(--text-1);
		font-weight: 600;
	}
	.v-diff {
		margin: 0;
		font-size: 12px;
		color: var(--text-3);
		max-width: 82ch;
		text-wrap: pretty;
	}
</style>

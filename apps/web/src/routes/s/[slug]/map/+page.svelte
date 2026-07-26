<script lang="ts">
	import { mount, unmount, onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import type * as LType from 'leaflet';
	import markersJson from '@palworld-companion/game-data/markers.json';
	import palsJson from '@palworld-companion/game-data/pals.json';
	import { spawnCounts, defaultPhase } from '$lib/game/spawns';
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import { ProgressStore } from '$lib/game/progress.svelte';
	import LeafletMap from '$lib/map/LeafletMap.svelte';
	import MarkerPopup from '$lib/map/MarkerPopup.svelte';
	import MapSidebar from '$lib/map/sidebar/MapSidebar.svelte';
	import { MapState } from '$lib/map/mapState.svelte';
	import { SheetState } from '$lib/map/sheet.svelte';
	import { MarkerController, type MapMarker } from '$lib/map/markerController';
	import { SpawnLayer, type SpawnPhase } from '$lib/map/spawnLayer';
	import { categoryOf, countsByCategory, type CatKey } from '$lib/map/categories';
	import { bossLabel, inGameCoords } from '$lib/map/coords';
	import { runQuery, visibleMarkers } from '$lib/map/query';
	import { isGuestContext } from '$lib/nav';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();

	// Feuille glissante sous 900 px : la carte est un second écran pendant la
	// partie, la barre ne peut pas y voler la moitié de l'écran.
	//
	// `min-height` dans la condition : un téléphone en paysage n'a que ~340 px
	// de haut sous l'en-tête. Une feuille y laisserait 150 px de carte à la
	// position « moitié ». La largeur, elle, ne manque pas — on revient donc au
	// rail + panneau latéral, qui prend sur l'axe abondant. **Ce media query est
	// dupliqué dans le bloc de styles ci-dessous : garder les deux identiques.**
	const SHEET_MQ = '(max-width: 900px) and (min-height: 520px)';
	let narrow = $state(false);
	const sheet = new SheetState();
	$effect(() => {
		const mq = window.matchMedia(SHEET_MQ);
		const apply = () => (narrow = mq.matches);
		apply();
		mq.addEventListener('change', apply);
		return () => mq.removeEventListener('change', apply);
	});
	/** Hauteur du conteneur, mesurée : les positions de la feuille en dépendent,
	 *  et elle change à la rotation comme à l'apparition de la barre d'URL. */
	let wrapH = $state(0);
	$effect(() => {
		sheet.available = wrapH;
	});
	/** Hauteur effective, publiée en variable CSS : les contrôles Leaflet s'en
	 *  servent pour rester au-dessus de la feuille (voir `.leaflet-bottom`). */
	// Le canevas Leaflet est borné par cette valeur (voir `.canvas` plus bas) :
	// c'est ce qui rend Leaflet cohérent avec l'écran. Il recouvrait auparavant
	// toute la hauteur, feuille comprise, et centrait donc l'île SOUS la
	// feuille ; contrôles de zoom, auto-pan des popups et centrage sur un
	// résultat visaient tous le mauvais rectangle.
	const sheetH = $derived(narrow && wrapH ? sheet.height : 0);

	const markers = markersJson as MapMarker[];
	// Tous les marqueurs sont cochables : sert de garde-fou aux ids en
	// localStorage après une régénération de game-data.
	const MARKER_IDS = new Set(markers.map((mk) => mk.id));

	const guest = $derived(data.mode === 'guest');
	const store = new ProgressStore();
	const mapState = new MapState();
	let markerController: MarkerController | undefined = $state();
	let spawnLayer: SpawnLayer | undefined = $state();
	/** Statut du bouton de partage. `''` : rien à annoncer - le `<p role="status">`
	 *  du gabarit reste monté en permanence pour que le lecteur d'écran
	 *  perçoive le changement de texte (voir le commentaire sur `.toast`). */
	let toast: '' | 'copied' | 'failed' = $state('');

	const pals = palsJson as Array<{ id: string; elements: string[]; nocturnal?: boolean }>;
	const elementByPal = new Map(pals.map((p) => [p.id, p.elements[0]]));
	const nocturnal = new Set(pals.filter((p) => p.nocturnal).map((p) => p.id));

	/** Nom affiché d'un marqueur, par catégorie. Les boss humains n'ont ni palId
	 *  (le sentinelle « None » est retiré par le pipeline) ni entrée L10N : leur
	 *  nom est dérivé du SpawnerID. Les effigies n'ont ni l'un ni l'autre non
	 *  plus : sans les coordonnées, les 138 lignes porteraient le même libellé
	 *  (même convention que packages/pipeline/src/search-index.ts). */
	function nameOf(mk: MapMarker): string {
		if (mk.meta?.palId) return gameName(`pal:${mk.meta.palId}`);
		if (mk.nameId) return gameName(`ft:${mk.nameId}`);
		if (mk.type === 'boss') return bossLabel(mk.id);
		const [x, y] = inGameCoords(mk.px, mk.py);
		return `${m.map_relic_name()} (${x}, ${y})`;
	}
	const elementOf = (mk: MapMarker) =>
		mk.meta?.palId ? elementByPal.get(mk.meta.palId) : undefined;

	/** Portrait d'aperçu d'une catégorie pour le rail (le premier disponible). */
	function thumbOf(key: CatKey): string | undefined {
		if (key !== 'alpha') return undefined;
		const first = markers.find((mk) => categoryOf(mk) === 'alpha' && mk.meta?.palId);
		return first?.meta?.palId ? palIcon(first.meta.palId) : undefined;
	}

	/** Bascule programmatique de catégorie (hors clic utilisateur sur le rail) :
	 *  vide aussi la recherche, comme `MapSidebar.select()` le fait déjà pour un
	 *  changement manuel. Sans ça, un texte tapé pour l'ancienne catégorie fuite
	 *  dans la nouvelle - et en mode spawn, `query.search` est le champ du
	 *  sélecteur de Pal, pas un filtre carte : il afficherait la mauvaise liste. */
	function selectCategory(key: CatKey) {
		mapState.query.selected = key;
		mapState.query.search = '';
	}

	// Restauration (URL partagée ou localStorage) : un one-shot volontaire, PAS
	// un $effect. `page.url` change à chaque navigation `?focus=`/`?pal=` sur
	// cette même route (palette de recherche, fiche Pal) - dans un $effect qui
	// lirait `page.url`, chacune de ces navigations relancerait restore() et
	// écraserait l'état courant de la barre par ce qui est en localStorage.
	onMount(() => {
		mapState.restore(page.url);
	});

	// Store de progression : re-scopé sur `page.params.slug` (une primitive), pas
	// sur `page.url` - il ne doit se réinitialiser que si le tenant change (ex.
	// changement de serveur via le sélecteur d'en-tête), jamais sur un simple
	// changement de query params.
	$effect(() => {
		store.init('marker', page.params.slug!, data.progress.mine, data.progress.group, MARKER_IDS);
		store.startSync();
		return () => store.stopSync();
	});

	// markerController / spawnLayer sont des objets Leaflet construits une seule
	// fois par `onMapReady` (montage de <LeafletMap>, jamais remonté sur une
	// navigation même route) : leur destruction doit être couplée à celle du
	// composant, pas à un effet qui se relance sur chaque changement de query
	// params - sinon une navigation `?focus=` vers cette même route (c'est
	// justement ce que fait la palette de recherche, cf. lib/search/resolve.ts)
	// viderait la carte : plus aucun marqueur, plus de zones de spawn.
	onDestroy(() => {
		markerController?.destroy();
		spawnLayer?.destroy();
	});

	const counts = $derived(countsByCategory(markers, store.mine, store.group));
	const rows = $derived(runQuery(markers, mapState.query, store.mine, nameOf, elementOf));
	const visible = $derived(visibleMarkers(markers, mapState.query, store.mine));

	// Pont popup : montage d'un composant Svelte dans la popup Leaflet.
	let leafletRef: typeof LType | undefined;
	let mapRef: LType.Map | undefined;

	function onMarkerClick(marker: MapMarker, lm: LType.Marker) {
		if (!leafletRef || !mapRef) return;
		const target = document.createElement('div');
		const instance = mount(MarkerPopup, { target, props: { marker, store } });
		const popup = leafletRef
			.popup({ closeButton: true, offset: [0, -8], className: 'pal-popup' })
			.setLatLng(lm.getLatLng())
			.setContent(target);
		popup.on('remove', () => unmount(instance));
		popup.openOn(mapRef);
	}

	function onMapReady(
		leaflet: typeof LType,
		map: LType.Map,
		toLatLng: (px: number, py: number) => LType.LatLng
	) {
		leafletRef = leaflet;
		mapRef = map;
		markerController = new MarkerController(leaflet, map, toLatLng, onMarkerClick);
		spawnLayer = new SpawnLayer(leaflet, map, toLatLng);
	}

	// Svelte -> Leaflet : re-sync sur tout changement de filtre/progression.
	$effect(() => {
		markerController?.sync(visible, store.mine);
	});

	// Svelte -> Leaflet : zones de spawn du Pal sélectionné.
	$effect(() => {
		spawnLayer?.setPal(mapState.spawn.spawnPal, mapState.spawn.spawnPhase);
	});

	/** Centre la carte sur un marqueur et ouvre sa popup. Rend la catégorie
	 *  visible au besoin : cliquer une ligne dont les épingles sont masquées
	 *  ne doit pas donner une carte vide. */
	function focusMarker(mk: MapMarker) {
		const cat = categoryOf(mk);
		if (!mapState.query.visible.includes(cat)) {
			mapState.query.visible = [...mapState.query.visible, cat];
			mapState.persist();
		}
		// Après le flush des effets, le sync a (re)créé le marqueur.
		setTimeout(() => {
			const lm = markerController?.get(mk.id);
			if (!lm || !mapRef) return;
			mapRef.setView(lm.getLatLng(), 4);
			onMarkerClick(mk, lm);
		}, 0);
	}

	/** `phase` forcée : uniquement pour relayer un lien partagé. Sinon la phase
	 *  est déduite (un Pal nocturne n'a souvent rien à montrer de jour). */
	function selectSpawnPal(palId: string | null, phase?: SpawnPhase) {
		mapState.spawn.spawnPal = palId;
		if (palId) {
			mapState.spawn.spawnPhase = phase ?? defaultPhase(spawnCounts[palId], nocturnal.has(palId));
		}
		mapState.persist();
		if (!palId) return;
		void spawnLayer?.setPal(palId, mapState.spawn.spawnPhase).then(() => {
			const b = spawnLayer?.bounds();
			if (b && mapRef) mapRef.fitBounds(b.pad(0.15));
		});
	}

	async function share() {
		const href = mapState.shareHref(page.url);
		try {
			await navigator.clipboard.writeText(href);
			toast = 'copied';
		} catch {
			// Presse-papiers refusé (permission navigateur, contexte non sécurisé...) :
			// l'URL devient l'adresse courante, copiable depuis la barre du
			// navigateur. `history.replaceState` contourne volontairement le
			// routeur de SvelteKit - `page.url` reste donc périmé après cet appel,
			// mais rien ici n'en dépend au-delà de cette fonction.
			history.replaceState(history.state, '', href);
			toast = 'failed';
		}
		setTimeout(() => (toast = ''), 2000);
	}

	// Zones depuis la fiche d'un Pal : /map?pal=<palId>.
	// `zonedPal` est un `let` nu, PAS un $state : l'effet l'écrit, et le rendre
	// réactif créerait une auto-dépendance - « Effacer » le remettrait à null,
	// l'effet se relancerait avec ?pal= toujours dans l'URL, et les zones
	// reviendraient aussitôt.
	let zonedPal: string | null = null;
	$effect(() => {
		const palId = page.url.searchParams.get('pal');
		if (!spawnLayer) return;
		if (!palId) {
			zonedPal = null;
			return;
		}
		if (palId === zonedPal || !spawnCounts[palId]) return;
		zonedPal = palId;
		selectCategory('spawn');
		// `?phase=` n'est lu que s'il est valide : un lien partagé ne porte que
		// `?pal=&phase=` quand le reste de la vue est aux défauts, et
		// `fromSearchParams` l'ignore alors (pal seul ne décrit pas une vue).
		// Sans ce relais, la phase choisie par l'expéditeur serait perdue.
		const shared = page.url.searchParams.get('phase');
		selectSpawnPal(palId, shared === 'day' || shared === 'night' ? shared : undefined);
	});

	// Focus depuis la palette de recherche : /map?focus=<markerId>.
	let focusedId: string | null = null;
	$effect(() => {
		const id = page.url.searchParams.get('focus');
		if (!id) {
			focusedId = null;
			return;
		}
		if (!markerController || id === focusedId) return;
		const mk = markers.find((x) => x.id === id);
		if (!mk) return;
		focusedId = id;
		// La catégorie du marqueur passe au premier plan, et « masquer les faits »
		// est levé s'il est déjà suivi - sinon la cible resterait invisible.
		selectCategory(categoryOf(mk));
		if (mapState.query.hideTracked && store.mine.has(id)) mapState.query.hideTracked = false;
		mapState.persist();
		focusMarker(mk);
	});
</script>

<Seo
	title={m.map_title()}
	description={m.seo_map_desc()}
	path="/map"
	indexable={isGuestContext()}
/>

<div
	class="map-wrap"
	class:sheet-full={narrow && sheet.stop === 'full' && sheet.dragging === null}
	bind:clientHeight={wrapH}
	style="--sheet-h:{sheetH}px"
>
	<div
		class="sidebar"
		class:sheet={narrow}
		class:dragging={sheet.dragging !== null}
		style={narrow && wrapH ? `height:${sheetH}px` : undefined}
	>
		<MapSidebar
			bind:query={mapState.query}
			spawn={mapState.spawn}
			{counts}
			{rows}
			mine={store.mine}
			group={store.group}
			{guest}
			{nameOf}
			{elementOf}
			{thumbOf}
			onchange={() => mapState.persist()}
			onfocus={focusMarker}
			ontoggle={(mk) => store.toggle(mk.id)}
			onspawn={selectSpawnPal}
			onphase={(p: SpawnPhase) => mapState.setPhase(p)}
			onshare={share}
			asSheet={narrow}
			{sheet}
		/>
	</div>
	<div class="canvas">
		<LeafletMap onready={onMapReady} />
	</div>
	<!-- Monté en permanence (jamais {#if}) : un lecteur d'écran manque souvent
	     l'apparition d'un nœud région-live inséré et annoncé dans le même tick -
	     seul le CHANGEMENT DE TEXTE d'une région déjà présente est fiable. -->
	<p class="toast" class:show={toast !== ''} role="status">
		{toast === 'failed' ? m.map_link_copy_failed() : toast === 'copied' ? m.map_link_copied() : ''}
	</p>
</div>

<style>
	.map-wrap {
		display: flex;
		flex: 1;
		min-height: 420px;
		position: relative;
	}
	.sidebar {
		flex: none;
		/* 340 px est la largeur de confort ; la borne relative sert au repli
		   paysage (téléphone couché), où la barre ne doit pas manger la moitié
		   d'un écran de 667 px. */
		width: min(340px, 42vw);
		min-height: 0;
	}
	@media (min-width: 900px) {
		.sidebar {
			width: 340px;
		}
	}
	.canvas {
		position: relative;
		flex: 1;
		min-width: 0;
	}

	/* Doit rester identique à SHEET_MQ dans le script. */
	@media (max-width: 900px) and (min-height: 520px) {
		.map-wrap {
			display: block;
		}
		/* Le canevas s'arrête au sommet de la feuille : c'est ce rectangle-là que
		   Leaflet doit connaître (cadrage, contrôles, auto-pan des popups). Le
		   faire passer sous la feuille — l'état précédent — revenait à mentir à
		   Leaflet sur la moitié de son écran. */
		.canvas {
			position: absolute;
			inset: 0 0 var(--sheet-h, 0px) 0;
		}
		/* Ce qui apparaît dans les coins arrondis de la feuille. */
		.map-wrap {
			background: var(--bg);
		}
		/* Feuille dépliée à fond : il ne reste qu'un bandeau de carte de ~60 px,
		   trop court pour porter les boutons de zoom sans les coller à l'en-tête.
		   La carte n'est plus le sujet à cette position — les contrôles s'effacent
		   et reviennent dès qu'on la rabaisse. */
		.map-wrap.sheet-full :global(.leaflet-control-container) {
			opacity: 0;
			pointer-events: none;
		}
		:global(.leaflet-control-container) {
			transition: opacity 200ms cubic-bezier(0.23, 1, 0.32, 1);
		}
		/* La hauteur est posée en style inline depuis SheetState : trois classes
		   de palier ne suffisaient plus une fois le glissement au doigt ajouté
		   (il faut une hauteur continue). */
		.sidebar.sheet {
			position: absolute;
			inset: auto 0 0 0;
			width: 100%;
			z-index: 500;
			transition: height 240ms cubic-bezier(0.23, 1, 0.32, 1);
		}
		/* Pendant le glissement, la hauteur suit le doigt : toute transition
		   ferait traîner la feuille derrière lui. */
		.sidebar.sheet.dragging {
			transition: none;
		}
	}
	.toast {
		position: absolute;
		/* Au-dessus de la feuille : plafonné pour rester à l'écran quand elle est
		   dépliée à fond. */
		bottom: calc(16px + min(var(--sheet-h, 0px), 55%));
		left: 50%;
		transform: translateX(-50%);
		z-index: 600;
		margin: 0;
		padding: 8px 14px;
		font-size: 12px;
		color: var(--text-1);
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		/* Toujours dans le DOM (voir le gabarit) : masqué visuellement par
		   défaut, sans `display: none` qui le retirerait aussi de l'arbre
		   d'accessibilité et empêcherait son annonce. */
		opacity: 0;
		pointer-events: none;
	}
	.toast.show {
		opacity: 1;
	}
	/* Popups Leaflet aux couleurs du design system */
	:global(.pal-popup .leaflet-popup-content-wrapper) {
		background: var(--surface-2);
		color: var(--text-1);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		box-shadow: 0 0 0 1px rgb(0 0 0 / 0.4);
	}
	:global(.pal-popup .leaflet-popup-tip) {
		background: var(--surface-2);
	}
	:global(.pal-popup .leaflet-popup-content) {
		margin: 10px 12px;
	}
	:global(.leaflet-container) {
		font: inherit;
	}
	:global(.leaflet-bar a) {
		background: var(--surface-2);
		color: var(--text-1);
		border-color: var(--border-strong);
	}
	:global(.leaflet-bar a:hover) {
		background: var(--surface-3);
	}
	/* Contrôles à l'écart de l'encoche / barre home iOS en plein écran.
	   Sélecteur à deux classes, volontairement : leaflet.css est importé à
	   l'exécution (LeafletMap) donc INSÉRÉ APRÈS les styles du composant — à
	   spécificité égale, son `bottom: 0` gagnait et cette règle était morte. */
	:global(.leaflet-container .leaflet-bottom) {
		bottom: env(safe-area-inset-bottom, 0px);
	}
	:global(.leaflet-container .leaflet-right) {
		right: env(safe-area-inset-right, 0px);
	}
</style>

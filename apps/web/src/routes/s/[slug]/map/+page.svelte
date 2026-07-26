<script lang="ts">
	import { mount, unmount } from 'svelte';
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
	import { MarkerController, type MapMarker } from '$lib/map/markerController';
	import { SpawnLayer, type SpawnPhase } from '$lib/map/spawnLayer';
	import { categoryOf, countsByCategory, type CatKey } from '$lib/map/categories';
	import { runQuery, visibleMarkers } from '$lib/map/query';
	import { isGuestContext } from '$lib/nav';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();

	const markers = markersJson as MapMarker[];
	// Tous les marqueurs sont cochables : sert de garde-fou aux ids en
	// localStorage après une régénération de game-data.
	const MARKER_IDS = new Set(markers.map((mk) => mk.id));

	const guest = $derived(data.mode === 'guest');
	const store = new ProgressStore();
	const mapState = new MapState();
	let markerController: MarkerController | undefined = $state();
	let spawnLayer: SpawnLayer | undefined = $state();
	let copied = $state(false);

	const pals = palsJson as Array<{ id: string; elements: string[]; nocturnal?: boolean }>;
	const elementByPal = new Map(pals.map((p) => [p.id, p.elements[0]]));
	const nocturnal = new Set(pals.filter((p) => p.nocturnal).map((p) => p.id));

	/** Nom affiché d'un marqueur, par catégorie. Les boss humains n'ont ni palId
	 *  (le sentinelle « None » est retiré par le pipeline) ni entrée L10N : leur
	 *  nom est dérivé du SpawnerID. */
	function nameOf(mk: MapMarker): string {
		if (mk.meta?.palId) return gameName(`pal:${mk.meta.palId}`);
		if (mk.nameId) return gameName(`ft:${mk.nameId}`);
		if (mk.type === 'boss') return mk.id.replace(/^alpha_(?:BOSS_)?/i, '').replaceAll('_', ' ');
		return m.map_relic_name();
	}
	const elementOf = (mk: MapMarker) =>
		mk.meta?.palId ? elementByPal.get(mk.meta.palId) : undefined;

	/** Portrait d'aperçu d'une catégorie pour le rail (le premier disponible). */
	function thumbOf(key: CatKey): string | undefined {
		if (key !== 'alpha') return undefined;
		const first = markers.find((mk) => categoryOf(mk) === 'alpha' && mk.meta?.palId);
		return first?.meta?.palId ? palIcon(first.meta.palId) : undefined;
	}

	$effect(() => {
		mapState.restore(page.url);
		store.init('marker', page.params.slug!, data.progress.mine, data.progress.group, MARKER_IDS);
		store.startSync();
		return () => {
			store.stopSync();
			markerController?.destroy();
			spawnLayer?.destroy();
		};
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
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Presse-papiers refusé : l'URL devient l'adresse courante, copiable
			// depuis la barre du navigateur.
			history.replaceState(history.state, '', href);
		}
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
		mapState.query.selected = 'spawn';
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
		mapState.query.selected = categoryOf(mk);
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

<div class="map-wrap">
	<div class="sidebar">
		<MapSidebar
			query={mapState.query}
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
		/>
	</div>
	<div class="canvas">
		<LeafletMap onready={onMapReady} />
	</div>
	{#if copied}
		<p class="toast" role="status">{m.map_link_copied()}</p>
	{/if}
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
		width: 340px;
		min-height: 0;
	}
	.canvas {
		position: relative;
		flex: 1;
		min-width: 0;
	}
	.toast {
		position: absolute;
		bottom: 16px;
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
	/* Contrôles à l'écart de l'encoche / barre home iOS en plein écran */
	:global(.leaflet-bottom) {
		bottom: env(safe-area-inset-bottom, 0px);
	}
	:global(.leaflet-right) {
		right: env(safe-area-inset-right, 0px);
	}
</style>

<script lang="ts">
	import { mount, unmount } from 'svelte';
	import { page } from '$app/state';
	import { m } from '$lib/paraglide/messages';
	import type * as LType from 'leaflet';
	import markersJson from '@palworld-companion/game-data/markers.json';
	import spawnsIndex from '@palworld-companion/game-data/spawns-index.json';
	import palsJson from '@palworld-companion/game-data/pals.json';
	import { ProgressStore } from '$lib/game/progress.svelte';
	import LeafletMap from '$lib/map/LeafletMap.svelte';
	import MarkerPopup from '$lib/map/MarkerPopup.svelte';
	import FilterPanel from '$lib/map/FilterPanel.svelte';
	import SpawnPanel from '$lib/map/SpawnPanel.svelte';
	import { MapState } from '$lib/map/mapState.svelte';
	import { MarkerController, type MapMarker } from '$lib/map/markerController';
	import { SpawnLayer, type SpawnPhase } from '$lib/map/spawnLayer';
	import { isGuestContext } from '$lib/nav';
	import Seo from '$lib/components/Seo.svelte';

	let { data } = $props();

	const markers = markersJson as MapMarker[];
	const relics = markers.filter((mk) => mk.type === 'relic');
	const relicTotal = relics.length;
	// Seules les effigies sont cochables : sert de garde-fou aux ids en localStorage.
	const RELIC_IDS = new Set(relics.map((mk) => mk.id));

	const guest = $derived(data.mode === 'guest');
	const store = new ProgressStore();
	const mapState = new MapState();
	let markerController: MarkerController | undefined = $state();
	let spawnLayer: SpawnLayer | undefined = $state();

	const spawnCounts = spawnsIndex as Record<string, { day: number; night: number }>;
	const nocturnal = new Set(
		(palsJson as Array<{ id: string; nocturnal?: boolean }>)
			.filter((p) => p.nocturnal)
			.map((p) => p.id)
	);
	const spawnPal = $derived(mapState.filters.spawnPal);
	const spawnPhase = $derived(mapState.filters.spawnPhase);

	$effect(() => {
		mapState.restore();
		store.init('marker', page.params.slug!, data.progress.mine, data.progress.group, RELIC_IDS);
		store.startSync();
		return () => {
			store.stopSync();
			markerController?.destroy();
			spawnLayer?.destroy();
		};
	});

	const visible = $derived(
		markers.filter((mk) => {
			if (!mapState.filters[mk.type]) return false;
			if (mapState.filters.hideChecked && mk.type === 'relic' && store.mine.has(mk.id)) return false;
			return true;
		})
	);
	const counts = $derived({
		mine: store.mine.size,
		// null pour un invité : le panneau masque alors la ligne « groupe ».
		group: guest ? null : Object.keys(store.group).length,
		total: relicTotal
	});

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
		spawnLayer?.setPal(spawnPal, spawnPhase);
	});

	// Zones depuis la fiche d'un Pal : /map?pal=<palId>.
	// `zonedPal` est un `let` nu, PAS un $state : l'effet l'écrit, et le rendre
	// réactif créerait une auto-dépendance — « Effacer » le remettrait à null,
	// l'effet se relancerait avec ?pal= toujours dans l'URL, et les zones
	// reviendraient aussitôt.
	let zonedPal: string | null = null;
	$effect(() => {
		const palId = page.url.searchParams.get('pal');
		const layer = spawnLayer;
		if (!layer) return;
		if (!palId) {
			zonedPal = null;
			return;
		}
		if (palId === zonedPal || !spawnCounts[palId]) return;
		zonedPal = palId;
		mapState.filters.spawnPal = palId;
		// La phase persistée est écrasée : un Pal nocturne n'a souvent rien à
		// montrer de jour, et hériter du Pal précédent donnerait une carte vide.
		mapState.filters.spawnPhase = nocturnal.has(palId) ? 'night' : 'day';
		mapState.persist();
		// Après le flush des effets, la couche a chargé et dessiné les cercles.
		setTimeout(() => {
			const b = layer.bounds();
			if (b && mapRef) mapRef.fitBounds(b.pad(0.15));
		}, 0);
	});

	// Ne pas toucher à `zonedPal` ici : le laisser sur le Pal effacé est ce qui
	// empêche l'effet de le réafficher tant que ?pal= n'a pas changé.
	function clearSpawns() {
		mapState.filters.spawnPal = null;
		mapState.persist();
	}

	function setPhase(p: SpawnPhase) {
		mapState.filters.spawnPhase = p;
		mapState.persist();
	}

	// Focus depuis la palette de recherche : /map?focus=<markerId>.
	let focusedId: string | null = null;
	$effect(() => {
		const id = page.url.searchParams.get('focus');
		const controller = markerController;
		if (!id) {
			focusedId = null;
			return;
		}
		if (!controller || id === focusedId) return;
		const mk = markers.find((m) => m.id === id);
		if (!mk) return;
		focusedId = id;
		if (!mapState.filters[mk.type]) {
			mapState.filters[mk.type] = true;
			mapState.persist();
		}
		if (mk.type === 'relic' && mapState.filters.hideChecked && store.mine.has(id)) {
			mapState.filters.hideChecked = false;
			mapState.persist();
		}
		// Après le flush des effets, le sync a (re)créé le marqueur.
		setTimeout(() => {
			const lm = controller.get(id);
			if (!lm || !mapRef) return;
			mapRef.setView(lm.getLatLng(), 4);
			onMarkerClick(mk, lm);
		}, 0);
	});
</script>
<Seo
	title={m.map_title()}
	description={m.seo_map_desc()}
	path="/map"
	indexable={isGuestContext()}
/>

<div class="map-wrap">
	<LeafletMap onready={onMapReady} />
	<FilterPanel filters={mapState.filters} {counts} onchange={() => mapState.persist()} />
	{#if spawnPal && spawnCounts[spawnPal]}
		<SpawnPanel
			palId={spawnPal}
			phase={spawnPhase}
			counts={spawnCounts[spawnPal]}
			onphase={setPhase}
			onclear={clearSpawns}
		/>
	{/if}
</div>

<style>
	.map-wrap {
		position: relative;
		flex: 1;
		min-height: 420px;
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

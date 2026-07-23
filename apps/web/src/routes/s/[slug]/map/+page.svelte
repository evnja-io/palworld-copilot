<script lang="ts">
	import { mount, unmount } from 'svelte';
	import { page } from '$app/state';
	import type * as LType from 'leaflet';
	import markersJson from '@palworld-companion/game-data/markers.json';
	import { ProgressStore } from '$lib/game/progress.svelte';
	import LeafletMap from '$lib/map/LeafletMap.svelte';
	import MarkerPopup from '$lib/map/MarkerPopup.svelte';
	import FilterPanel from '$lib/map/FilterPanel.svelte';
	import { MapState } from '$lib/map/mapState.svelte';
	import { MarkerController, type MapMarker } from '$lib/map/markerController';

	let { data } = $props();

	const markers = markersJson as MapMarker[];
	const relicTotal = markers.filter((mk) => mk.type === 'relic').length;

	const store = new ProgressStore();
	const mapState = new MapState();
	let markerController: MarkerController | undefined = $state();

	$effect(() => {
		mapState.restore();
		store.init('marker', page.params.slug!, data.progress.mine, data.progress.group);
		store.startSync();
		return () => {
			store.stopSync();
			markerController?.destroy();
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
		group: Object.keys(store.group).length,
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
	}

	// Svelte -> Leaflet : re-sync sur tout changement de filtre/progression.
	$effect(() => {
		markerController?.sync(visible, store.mine);
	});

	// Focus depuis la palette de recherche : /map?focus=<markerId>.
	let focusedId: string | null = null;
	$effect(() => {
		const id = page.url.searchParams.get('focus');
		const controller = markerController;
		if (!id || !controller || id === focusedId) return;
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

<div class="map-wrap">
	<LeafletMap onready={onMapReady} />
	<FilterPanel filters={mapState.filters} {counts} onchange={() => mapState.persist()} />
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

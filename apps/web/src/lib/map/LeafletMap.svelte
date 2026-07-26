<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import maps from '@palworld-companion/game-data/maps.json';
	import type * as LType from 'leaflet';

	let {
		onready
	}: {
		onready: (leaflet: typeof LType, map: LType.Map, toLatLng: (px: number, py: number) => LType.LatLng) => void;
	} = $props();

	let container: HTMLDivElement;
	let map: LType.Map | undefined;
	let ro: ResizeObserver | undefined;

	onMount(async () => {
		const leaflet = (await import('leaflet')).default;
		await import('leaflet/dist/leaflet.css');

		map = leaflet.map(container, {
			crs: leaflet.CRS.Simple,
			minZoom: 1,
			maxZoom: maps.maxZoom + 2, // zoom CSS au-delà du natif
			zoomControl: false, // recréé en bas à droite (le panneau de filtres occupe le haut-gauche)
			attributionControl: false
		});
		leaflet.control.zoom({ position: 'bottomright' }).addTo(map);
		const toLatLng = (px: number, py: number) => map!.unproject([px, py], maps.maxZoom);
		const bounds = leaflet.latLngBounds(toLatLng(0, 0), toLatLng(maps.sizePx, maps.sizePx));
		leaflet
			.tileLayer(`${maps.tileBaseUrl}/tiles/${maps.tileSetId}/{z}/{x}/{y}.webp`, {
				tileSize: maps.tileSize,
				minZoom: 0,
				maxNativeZoom: maps.maxZoom,
				noWrap: true,
				bounds
			})
			.addTo(map);
		map.setMaxBounds(bounds.pad(0.05));
		map.fitBounds(bounds);
		// La hauteur du conteneur dépend du flex (topbar à hauteur variable) :
		// resync Leaflet sur tout redimensionnement, pas seulement window.resize.
		ro = new ResizeObserver(() => map?.invalidateSize());
		ro.observe(container);
		onready(leaflet, map, toLatLng);
	});

	onDestroy(() => {
		ro?.disconnect();
		map?.remove();
	});
</script>

<div class="map" bind:this={container}></div>

<style>
	.map {
		/* Remplit le wrapper positionné : height:100% ne se résout pas
		   quand la hauteur du parent vient de flex (min-height sur .shell). */
		position: absolute;
		inset: 0;
		background: hsl(200 60% 25%); /* océan de la texture, évite le noir au chargement */
	}
	/* Marqueurs (html de divIcon - hors scope Svelte, d'où :global) */
	:global(.mk) {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		font-size: 11px;
		font-style: normal;
		color: #fff;
		background: color-mix(in srgb, var(--mk-color) 85%, black);
		border: 1.5px solid color-mix(in srgb, var(--mk-color) 50%, white);
		box-shadow: 0 0 0 1px rgb(0 0 0 / 0.35);
		cursor: pointer;
		transition: transform 120ms cubic-bezier(0.23, 1, 0.32, 1);
	}
	:global(.mk:hover) {
		transform: scale(1.25);
	}
	:global(.mk-relic) {
		--mk-color: var(--el-leaf);
	}
	:global(.mk-alpha) {
		--mk-color: var(--el-fire);
	}
	:global(.mk-ft) {
		--mk-color: var(--accent);
	}
	:global(.mk-boss) {
		--mk-color: var(--el-dark);
	}
	:global(.mk-tower) {
		--mk-color: var(--el-electricity);
	}
	:global(.mk-watchtower) {
		--mk-color: var(--el-ice);
	}
	:global(.mk-checked) {
		filter: grayscale(0.9) opacity(0.55);
	}
	:global(.mk-pal) {
		padding: 1px;
	}
	:global(.mk-pal img) {
		display: block;
		width: 18px;
		height: 18px;
		object-fit: contain;
	}
	:global(.mk i) {
		position: absolute;
		bottom: -14px;
		font-size: 9px;
		font-style: normal;
		color: var(--text-2);
		background: rgb(0 0 0 / 0.55);
		border-radius: 999px;
		padding: 0 4px;
	}
	/* Zones de spawn (vecteurs Leaflet - hors scope Svelte, d'où :global).
	   L'opacité s'accumule aux recouvrements : la densité se lit d'elle-même. */
	:global(.spawn-zone) {
		fill: var(--accent);
		fill-opacity: 0.13;
	}
</style>

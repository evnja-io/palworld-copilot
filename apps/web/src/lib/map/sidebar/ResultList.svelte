<script lang="ts" module>
	import { m } from '$lib/paraglide/messages';
	import type { MapMarker } from '$lib/map/markerController';

	/** Ligne de métadonnées : élément puis coéquipiers, pluriel accordé.
	 *  Exporté depuis un bloc `module` pour être testable sans DOM.
	 *  Paraglide n'a pas de pluriel implicite dans ce projet : deux clés
	 *  explicites, le choix se fait ici. */
	export function rowMeta(elementLabel: string | undefined, groupCount: number): string {
		const team =
			groupCount === 0
				? null
				: groupCount === 1
					? m.map_group_member_one()
					: m.map_group_member_many({ count: groupCount });
		return [elementLabel || null, team].filter(Boolean).join(' · ');
	}
</script>

<script lang="ts">
	import { CATEGORIES, categoryOf } from '$lib/map/categories';
	import { palIcon } from '$lib/game/icons';
	import type { GroupUser } from '$lib/types';

	let {
		rows,
		mine,
		group,
		trackable,
		nameOf,
		elementOf,
		elementLabelOf,
		onfocus,
		ontoggle
	}: {
		rows: MapMarker[];
		mine: ReadonlySet<string>;
		group: Record<string, GroupUser[]>;
		trackable: boolean;
		nameOf: (mk: MapMarker) => string;
		elementOf: (mk: MapMarker) => string | undefined;
		elementLabelOf: (element: string | undefined) => string | undefined;
		onfocus: (mk: MapMarker) => void;
		ontoggle: (mk: MapMarker) => void;
	} = $props();

	function tint(mk: MapMarker): string {
		const el = elementOf(mk);
		return el ? `var(--el-${el.toLowerCase()})` : CATEGORIES[categoryOf(mk)].color;
	}
</script>

<ul class="res">
	{#each rows as mk (mk.id)}
		{@const done = mine.has(mk.id)}
		{@const meta = rowMeta(elementLabelOf(elementOf(mk)), group[mk.id]?.length ?? 0)}
		<li style="--c:{tint(mk)}" class:done>
			<button class="row" onclick={() => onfocus(mk)}>
				<span class="por">
					{#if mk.meta?.palId && palIcon(mk.meta.palId)}
						<img src={palIcon(mk.meta.palId)} alt="" width="28" height="28" />
					{:else}
						<span class="pg" aria-hidden="true">{CATEGORIES[categoryOf(mk)].glyph}</span>
					{/if}
				</span>
				<span class="txt">
					<b>{nameOf(mk)}</b>
					{#if meta}<span class="meta tnum">{meta}</span>{/if}
				</span>
				{#if mk.meta?.level}<span class="lvb tnum">{mk.meta.level}</span>{/if}
			</button>
			{#if trackable}
				<span class="chk">
					<input
						type="checkbox"
						checked={done}
						aria-label="{m.map_done()} — {nameOf(mk)}"
						onchange={() => ontoggle(mk)}
					/>
				</span>
			{/if}
		</li>
	{:else}
		<li class="empty">{m.map_no_results()}</li>
	{/each}
</ul>

<style>
	.res {
		flex: 1;
		min-height: 0;
		overflow: auto;
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	li {
		display: flex;
		align-items: center;
		gap: 5px;
		border-radius: var(--r-md);
		background: linear-gradient(90deg, color-mix(in srgb, var(--c) 13%, transparent), transparent 62%);
		border-left: 2px solid var(--c);
	}
	li.done {
		filter: grayscale(0.85);
		opacity: 0.55;
	}
	.empty {
		display: block;
		padding: 18px 8px;
		color: var(--text-4);
		font-size: 12px;
		background: none;
		border: none;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 9px;
		flex: 1;
		min-width: 0;
		min-height: 34px;
		background: none;
		border: none;
		padding: 5px 7px;
		text-align: left;
	}
	.row:hover {
		background: color-mix(in srgb, var(--c) 8%, transparent);
	}
	.por {
		flex: none;
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		background: var(--surface-3);
		border: 1px solid var(--border);
	}
	.pg {
		font-size: 13px;
		color: var(--c);
	}
	.txt {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.txt b {
		font-size: 13px;
		color: var(--text-1);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.meta {
		font-size: 10px;
		color: var(--text-3);
	}
	/* Badge accordé à la teinte de la ligne : en --accent, il entrait en
	   concurrence avec l'élément sur chaque ligne. */
	.lvb {
		flex: none;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-1);
		background: color-mix(in srgb, var(--c) 30%, var(--surface-3));
		border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
		border-radius: 999px;
		padding: 0 7px;
	}
	.chk {
		position: relative;
		flex: none;
		display: inline-flex;
	}
	@media (pointer: coarse) {
		.res {
			/* Absorbe le débordement de .chk::after (inset -16px) pour que la
			   zone de tap élargie reste dans la largeur défilable de la liste. */
			padding-right: 16px;
		}
		.chk::after {
			content: '';
			position: absolute;
			inset: -16px;
		}
		.row {
			/* Cible tactile principale de la feuille (centre la carte sur le
			   marqueur) : 34px de base est sous le plancher de 44px. */
			min-height: 44px;
		}
	}
</style>

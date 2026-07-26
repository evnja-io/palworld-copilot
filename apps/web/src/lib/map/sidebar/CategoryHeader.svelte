<script lang="ts">
	// En-tête : anneau de progression de la catégorie sélectionnée, compteurs,
	// interrupteur de visibilité, copie du lien.
	import { CATEGORIES, type CatCount, type CatKey } from '$lib/map/categories';
	import { catLabel, catShort } from '$lib/map/categoryLabels';
	import { m } from '$lib/paraglide/messages';

	let {
		category,
		count,
		visible,
		guest,
		onvisibility,
		onshare
	}: {
		category: CatKey;
		count: CatCount;
		visible: boolean;
		guest: boolean;
		onvisibility: () => void;
		onshare: () => void;
	} = $props();

	const meta = $derived(CATEGORIES[category]);
	const pct = $derived(count.total ? Math.round((count.mine / count.total) * 100) : 0);
</script>

<header class="hero">
	<div class="ring" style="--p:{pct};--c:{meta.color}" role="img" aria-label={m.map_counter_of({ count: count.mine, total: count.total })}>
		<!-- Disque intérieur plutôt qu'un mask : un mask découperait aussi le chiffre. -->
		<span class="tnum">{pct}<i>%</i></span>
	</div>
	<div class="htxt">
		<p class="kicker" title={catLabel(category)}>{catShort(category)}</p>
		<p class="hnum tnum">{count.mine} <i>/ {count.total}</i></p>
		{#if !guest}
			<p class="hsub tnum">{m.map_group_found({ count: count.group })}</p>
		{/if}
	</div>
	<div class="hact">
		<button class="share" aria-label={m.map_copy_link()} onclick={onshare}>⧉</button>
		{#if !meta.future}
			<label class="eye">
				<input type="checkbox" checked={visible} onchange={onvisibility} />
				<span>{m.map_on_map()}</span>
			</label>
		{/if}
	</div>
</header>

<style>
	.hero {
		position: relative;
		flex: none;
		display: flex;
		align-items: center;
		gap: 11px;
		overflow: hidden;
		padding: 11px 12px;
		border-radius: var(--r-md);
		border: 1px solid var(--border-strong);
		background: radial-gradient(120% 130% at 30% -40%, hsl(222 30% 17%), var(--surface-1) 68%);
	}
	.hero::before {
		content: '';
		position: absolute;
		top: -110px;
		left: 30%;
		width: 220px;
		height: 180px;
		background: radial-gradient(closest-side, hsl(199 90% 55% / 0.2), transparent);
		pointer-events: none;
	}
	.ring {
		position: relative;
		flex: none;
		display: grid;
		place-items: center;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: conic-gradient(var(--c) calc(var(--p) * 1%), hsl(220 30% 90% / 0.08) 0);
	}
	.ring::after {
		content: '';
		position: absolute;
		inset: 5px;
		border-radius: 50%;
		background: var(--surface-1);
	}
	.ring span {
		position: relative;
		z-index: 1;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-1);
	}
	.ring i {
		font-style: normal;
		font-size: 8px;
		color: var(--text-3);
	}
	.htxt {
		flex: 1;
		min-width: 0;
	}
	.kicker {
		margin: 0;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		color: var(--accent);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.hnum {
		margin: 1px 0 0;
		font-family: var(--font-display);
		font-size: 17px;
		color: var(--text-1);
	}
	.hnum i {
		font-style: normal;
		font-size: 12px;
		color: var(--text-3);
	}
	.hsub {
		margin: 1px 0 0;
		font-size: 10px;
		color: var(--text-3);
	}
	.hact {
		flex: none;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 6px;
	}
	.share {
		background: none;
		border: none;
		color: var(--text-3);
		padding: 2px 4px;
	}
	.eye {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		color: var(--text-3);
	}
</style>

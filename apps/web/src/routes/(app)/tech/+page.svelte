<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName, gameDesc } from '$lib/game/names';
	import { itemIcon, techIcon } from '$lib/game/icons';
	import { buildings, recipes, tech, type Tech } from '$lib/game/indexes';
	import { ProgressStore } from '$lib/game/progress.svelte';
	import GroupAvatars from '$lib/components/GroupAvatars.svelte';

	let { data } = $props();

	const store = new ProgressStore();
	$effect(() => {
		store.init('tech_unlocked', data.progress.mine, data.progress.group);
		store.startSync();
		return () => store.stopSync();
	});

	const recipeById = new Map(recipes.map((r) => [r.id, r]));
	const buildingById = new Map(buildings.map((b) => [b.id, b]));
	const techById = new Map(tech.map((t) => [t.id, t]));

	/** Résout un unlock vers un lien : recette -> item produit ; construction -> fiche. */
	function unlockTarget(u: string): { href: string; label: string; icon?: string } | null {
		const recipe = recipeById.get(u);
		if (recipe) {
			return {
				href: `/items/${recipe.productId}`,
				label: gameName(`item:${recipe.productId}`),
				icon: itemIcon(recipe.productId)
			};
		}
		const building = buildingById.get(u);
		if (building) {
			return { href: `/buildings/${building.id}`, label: gameName(`building:${building.mapObjectId}`) };
		}
		return null;
	}

	/** Rangées de l'écran Technologie du jeu : une par niveau, technos normales
	 *  à gauche (ordre du jeu, préservé par tech.json) et techno ancienne dans
	 *  la colonne de droite. */
	const byLevel = $derived.by(() => {
		const groups = new Map<number, { normal: Tech[]; ancient: Tech[] }>();
		for (const t of tech) {
			let g = groups.get(t.level);
			if (!g) groups.set(t.level, (g = { normal: [], ancient: [] }));
			(t.isBoss ? g.ancient : g.normal).push(t);
		}
		return [...groups.entries()].sort((a, b) => a[0] - b[0]);
	});

	const normals = tech.filter((t) => !t.isBoss);
	const ancients = tech.filter((t) => t.isBoss);
	const mineNormal = $derived(normals.reduce((n, t) => n + (store.mine.has(t.id) ? 1 : 0), 0));
	const mineAncient = $derived(ancients.reduce((n, t) => n + (store.mine.has(t.id) ? 1 : 0), 0));

	/** Positionne l'infobulle (fixed) sous la tuile, bornée au viewport ;
	 *  bascule au-dessus s'il n'y a pas la place dessous. */
	function tipPlacer(node: HTMLElement) {
		function place() {
			const tile = node.querySelector('.tile');
			const tip = node.querySelector<HTMLElement>('.tip');
			if (!tile || !tip) return;
			const r = tile.getBoundingClientRect();
			const w = Math.min(280, window.innerWidth - 16);
			tip.style.width = `${w}px`;
			tip.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8)}px`;
			tip.style.top = `${r.bottom + 6}px`;
			const h = tip.offsetHeight;
			if (r.bottom + 6 + h > window.innerHeight - 8) {
				tip.style.top = `${Math.max(8, r.top - 6 - h)}px`;
			}
		}
		node.addEventListener('pointerenter', place);
		node.addEventListener('focusin', place);
		return {
			destroy() {
				node.removeEventListener('pointerenter', place);
				node.removeEventListener('focusin', place);
			}
		};
	}
</script>

{#snippet node(t: Tech)}
	{@const unlocked = store.mine.has(t.id)}
	{@const rawName = gameName(`tech:${t.nameId}`)}
	{@const name =
		rawName === t.nameId
			? (t.unlocks.map(unlockTarget).find(Boolean)?.label ?? rawName)
			: rawName}
	{@const icon = techIcon(t.iconName)}
	{@const desc = t.descId ? gameDesc(`tech:${t.descId}`) : undefined}
	{@const prereq = t.requireTech ? techById.get(t.requireTech) : undefined}
	<li class="node" id={t.id} use:tipPlacer>
		<button
			class="tile"
			class:on={unlocked}
			class:ancient={t.isBoss}
			onclick={() => store.toggle(t.id)}
			aria-pressed={unlocked}
			aria-label={name}
		>
			<span class="cost tnum" aria-hidden="true"><i class="gem"></i>{t.cost}</span>
			{#if unlocked}
				<span class="tick" aria-hidden="true">✓</span>
			{:else if t.requireBoss}
				<span class="lock" aria-hidden="true">
					<svg viewBox="0 0 24 24" width="10" height="10"><path fill="currentColor" d="M17 9V7A5 5 0 0 0 7 7v2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2Zm-8-2a3 3 0 0 1 6 0v2H9Z"/></svg>
				</span>
			{/if}
			<span class="pic" aria-hidden="true">
				{#if icon}
					<img src={icon} alt="" width="40" height="40" loading="lazy" />
				{:else}
					<svg class="ph" viewBox="0 0 24 24" width="34" height="34"><path fill="currentColor" d="M12 2 3 7v10l9 5 9-5V7l-9-5Zm0 2.3L18.6 8 12 11.7 5.4 8 12 4.3ZM5 9.7l6 3.4v6.6l-6-3.3V9.7Zm14 0v6.7l-6 3.3v-6.6l6-3.4Z"/></svg>
				{/if}
			</span>
			<span class="name">{name}</span>
		</button>
		<div class="tip" role="presentation">
			<p class="tip-name">
				{name}
				{#if t.isBoss}<span class="tip-ancient">{m.tech_ancient()}</span>{/if}
			</p>
			{#if desc}<p class="tip-desc">{desc}</p>{/if}
			{#if t.requireBoss && !unlocked}<p class="tip-req">{m.tech_boss_req()}</p>{/if}
			{#if prereq}
				<p class="tip-req">{m.tech_requires({ name: gameName(`tech:${prereq.nameId}`) })}</p>
			{/if}
			{#if t.unlocks.length}
				<ul class="tip-unlocks">
					{#each t.unlocks as u (u)}
						{@const target = unlockTarget(u)}
						{#if target}
							<li>
								<a href={target.href}>
									{#if target.icon}<img src={target.icon} alt="" width="18" height="18" />{/if}
									{target.label}
								</a>
							</li>
						{/if}
					{/each}
				</ul>
			{/if}
			<GroupAvatars users={store.group[t.id] ?? []} />
		</div>
	</li>
{/snippet}

<div class="head">
	<h1>{m.tech_title()}</h1>
	<div class="points">
		<span class="chip tnum" title={m.tech_points()}>
			<i class="gem" aria-hidden="true"></i>
			<span class="sr">{m.tech_points()}</span>
			{m.tech_unlocked_me({ count: mineNormal, total: normals.length })}
		</span>
		<span class="chip ancient tnum" title={m.tech_ancient_points()}>
			<i class="gem" aria-hidden="true"></i>
			<span class="sr">{m.tech_ancient_points()}</span>
			{m.tech_unlocked_me({ count: mineAncient, total: ancients.length })}
		</span>
	</div>
</div>

<div class="tree">
	{#each byLevel as [level, g] (level)}
		<section class="lvl" aria-label={m.craft_level({ level })}>
			<div class="mark">
				<span class="lv">Lv</span>
				<span class="n tnum">{level}</span>
			</div>
			<ul class="grid">
				{#each g.normal as t (t.id)}{@render node(t)}{/each}
			</ul>
			<ul class="grid ancient-col" class:none={!g.ancient.length}>
				{#each g.ancient as t (t.id)}{@render node(t)}{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.points {
		display: flex;
		gap: 8px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		font-size: 12px;
		font-weight: 500;
		color: var(--accent);
		background: color-mix(in srgb, var(--accent) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
		border-radius: 999px;
		padding: 4px 12px;
	}
	.chip.ancient {
		color: var(--el-dark);
		background: color-mix(in srgb, var(--el-dark) 10%, transparent);
		border-color: color-mix(in srgb, var(--el-dark) 30%, transparent);
	}
	.gem {
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background: currentColor;
		transform: rotate(45deg);
		flex: none;
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}

	/* --- Rangées de niveaux, comme l'écran Technologie du jeu --- */
	.tree {
		margin-top: 12px;
	}
	.lvl {
		display: grid;
		grid-template-columns: 40px minmax(0, 1fr) 104px;
		gap: 10px;
		padding: 10px 0;
		border-top: 1px solid var(--border);
	}
	.lvl:first-child {
		border-top: none;
	}
	.mark {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-top: 6px;
		line-height: 1.1;
	}
	.mark .lv {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-4);
	}
	.mark .n {
		font-family: var(--font-display);
		font-size: 19px;
		font-weight: 600;
		color: var(--text-2);
	}
	.grid {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
		gap: 6px;
		align-content: start;
	}
	/* Colonne « Technologie ancienne » : une tuile de large, liseré violet. */
	.grid.ancient-col {
		grid-template-columns: 1fr;
		border-left: 1px solid color-mix(in srgb, var(--el-dark) 35%, transparent);
		padding-left: 10px;
	}

	/* --- Nœud / tuile --- */
	.node {
		position: relative;
		scroll-margin-top: 70px;
	}
	.tile {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 104px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start;
		gap: 6px;
		padding: 20px 6px 8px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		text-align: center;
	}
	.tile:hover {
		background: var(--surface-2);
		border-color: var(--border-strong);
	}
	.tile .pic {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		flex: none;
	}
	.tile img,
	.tile .ph {
		opacity: 0.55;
		filter: saturate(0.7);
		transition: opacity 140ms, filter 140ms;
	}
	.tile .ph {
		color: var(--text-4);
	}
	.tile .name {
		font-size: 10.5px;
		font-weight: 500;
		line-height: 1.25;
		color: var(--text-3);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		transition: color 140ms;
	}
	.cost {
		position: absolute;
		top: 4px;
		right: 4px;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		font-weight: 600;
		color: color-mix(in srgb, var(--accent) 75%, var(--text-3));
	}
	.cost .gem {
		width: 6px;
		height: 6px;
		border-radius: 1px;
	}
	.tick,
	.lock {
		position: absolute;
		top: 4px;
		left: 5px;
		font-size: 10px;
		line-height: 1;
	}
	.tick {
		color: var(--accent);
		font-weight: 700;
	}
	.lock {
		color: var(--el-fire);
		opacity: 0.8;
		display: grid;
		place-items: center;
	}

	/* Débloquée : la tuile s'allume (comportement de l'écran du jeu). */
	.tile.on {
		background: color-mix(in srgb, var(--accent) 10%, var(--surface-1));
		border-color: color-mix(in srgb, var(--accent) 45%, transparent);
	}
	.tile.on img,
	.tile.on .ph {
		opacity: 1;
		filter: none;
	}
	.tile.on .name {
		color: var(--text-1);
	}

	/* Ancienne : cadre violet, comme la colonne de droite du jeu. */
	.tile.ancient {
		border-color: color-mix(in srgb, var(--el-dark) 35%, transparent);
	}
	.tile.ancient .cost {
		color: color-mix(in srgb, var(--el-dark) 80%, var(--text-3));
	}
	.tile.ancient:hover {
		border-color: color-mix(in srgb, var(--el-dark) 55%, transparent);
	}
	.tile.ancient.on {
		background: color-mix(in srgb, var(--el-dark) 12%, var(--surface-1));
		border-color: color-mix(in srgb, var(--el-dark) 55%, transparent);
	}
	.tile.ancient .tick {
		color: var(--el-dark);
	}

	/* --- Infobulle façon jeu --- */
	.tip {
		position: fixed;
		z-index: 40;
		visibility: hidden;
		opacity: 0;
		transition: opacity 120ms cubic-bezier(0.23, 1, 0.32, 1), visibility 0s 120ms;
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		padding: 10px 12px;
	}
	.tip::before {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: -8px;
		height: 8px;
	}
	.node:hover .tip,
	.node:focus-within .tip {
		visibility: visible;
		opacity: 1;
		transition-delay: 0s;
	}
	.tip-name {
		margin: 0;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-1);
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.tip-ancient {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--el-dark);
		background: color-mix(in srgb, var(--el-dark) 14%, transparent);
		border-radius: 999px;
		padding: 1px 7px;
	}
	.tip-desc {
		margin: 6px 0 0;
		font-size: 12px;
		line-height: 1.45;
		color: var(--text-2);
		white-space: pre-line;
	}
	.tip-req {
		margin: 6px 0 0;
		font-size: 11px;
		font-weight: 500;
		color: var(--el-fire);
	}
	.tip-unlocks {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
	}
	.tip-unlocks a {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		color: var(--text-2);
	}
	.tip-unlocks a:hover {
		color: var(--accent);
	}

	/* --- Mobile : la colonne ancienne passe sous la grille, infobulles coupées --- */
	@media (max-width: 700px) {
		.lvl {
			grid-template-columns: 34px minmax(0, 1fr);
		}
		.grid.ancient-col {
			grid-column: 2;
			grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
		}
		.grid.ancient-col.none {
			display: none;
		}
		.tip {
			display: none;
		}
	}
</style>

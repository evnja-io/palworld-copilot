<script lang="ts">
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { itemIcon } from '$lib/game/icons';
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

	const byLevel = $derived.by(() => {
		const groups = new Map<number, Tech[]>();
		for (const t of tech) {
			const list = groups.get(t.level);
			if (list) list.push(t);
			else groups.set(t.level, [t]);
		}
		return [...groups.entries()].sort((a, b) => a[0] - b[0]);
	});
</script>

<div class="head">
	<h1>{m.tech_title()}</h1>
	<p class="counts tnum">
		<span class="me">{m.tech_unlocked_me({ count: store.mine.size, total: tech.length })}</span>
	</p>
</div>

{#each byLevel as [level, group] (level)}
	<section>
		<h2>{m.craft_level({ level })}</h2>
		<div class="grid">
			{#each group as t (t.id)}
				{@const unlocked = store.mine.has(t.id)}
				<div class="card" class:unlocked class:boss={t.isBoss} id={t.id}>
					<div class="row">
						<button
							class="check"
							class:on={unlocked}
							onclick={() => store.toggle(t.id)}
							aria-pressed={unlocked}
							aria-label={gameName(`tech:${t.nameId}`)}
						>
							<span class="ball" aria-hidden="true"></span>
						</button>
						<span class="name">{gameName(`tech:${t.nameId}`)}</span>
						{#if t.isBoss}<span class="badge-boss">{m.tech_boss()}</span>{/if}
						<span class="cost tnum">{m.tech_cost({ cost: t.cost })}</span>
					</div>
					{#if t.unlocks.length}
						<ul class="unlocks">
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
			{/each}
		</div>
	</section>
{/each}

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.counts {
		color: var(--text-3);
		font-size: 13px;
		margin: 0;
	}
	.counts .me {
		color: var(--accent);
		font-weight: 500;
	}
	section h2 {
		margin-top: 24px;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 8px;
	}
	.card {
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 10px 12px;
		scroll-margin-top: 70px;
	}
	.card.unlocked {
		border-color: color-mix(in srgb, var(--accent) 35%, transparent);
	}
	.card.boss {
		border-color: color-mix(in srgb, var(--el-fire) 30%, transparent);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.check {
		background: none;
		border: none;
		padding: 4px;
	}
	.ball {
		display: block;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		border: 2px solid var(--text-4);
		transition: border-color 140ms, background 140ms;
	}
	.check.on .ball {
		border-color: var(--accent);
		background: linear-gradient(to bottom, #f4f8fb 0 45%, var(--accent-ink) 45% 55%, var(--accent) 55%);
	}
	.name {
		flex: 1;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-1);
	}
	.badge-boss {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--el-fire);
		background: color-mix(in srgb, var(--el-fire) 14%, transparent);
		border-radius: 999px;
		padding: 1px 7px;
	}
	.cost {
		font-size: 12px;
		color: var(--text-3);
	}
	.unlocks {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 12px;
	}
	.unlocks a {
		display: flex;
		align-items: center;
		gap: 5px;
		font-size: 12px;
		color: var(--text-2);
	}
	.unlocks a:hover {
		color: var(--accent);
	}
</style>

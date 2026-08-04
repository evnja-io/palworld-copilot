<script lang="ts">
	// Nœud de l'arbre de fabrication — 3a l.334 (objectif) et l.340 (enfants).
	import { m } from '$lib/paraglide/messages';
	import { gameName } from '$lib/game/names';
	import { itemIcon } from '$lib/game/icons';
	import { appHref } from '$lib/nav';
	import type { CraftNode } from '$lib/game/craftTree';
	import Self from './CraftNode.svelte';

	let { node, goal = false }: { node: CraftNode; goal?: boolean } = $props();

	const name = $derived(gameName(`item:${node.itemId}`));
	// Le dessin annonce « Établi d'armes · 3 × 40 s ». Aucune donnée ne relie
	// une recette à un poste de craft : recipes.json ne porte que
	// {id, productId, count, materials, workAmount}. On affiche donc le palier
	// de technologie, qui lui existe.
	const meta = $derived(
		node.recipe
			? node.tech
				? m.craft_tech({ level: node.tech.level })
				: m.craft_no_tech()
			: m.craft_raw()
	);
</script>

<div class="node" class:goal>
	{#if itemIcon(node.itemId)}
		<img src={itemIcon(node.itemId)} alt="" loading="lazy" />
	{:else}
		<span class="no-icon" aria-hidden="true">·</span>
	{/if}
	<div class="text">
		<a class="name" href={appHref(`/items/${node.itemId}`)}>{name} ×{node.need}</a>
		<div class="meta">{meta}</div>
	</div>
	{#if goal}
		<span class="badge">{m.craft_goal()}</span>
	{/if}
</div>

{#if node.children.length}
	<div class="children">
		{#each node.children as child (child.itemId + child.depth)}
			<Self node={child} />
		{/each}
	</div>
{/if}

<style>
	.node {
		display: flex;
		align-items: center;
		gap: 12px;
		background: var(--color-surface);
		border: 1px solid transparent;
		border-radius: 14px;
		padding: 11px 16px;
		transition: background var(--duration-hover) var(--ease-out-soft);
	}
	.node:hover {
		background: var(--color-raised);
	}
	.node.goal {
		gap: 14px;
		border-radius: 16px;
		padding: 14px 18px;
		background: linear-gradient(90deg, rgba(255, 90, 15, 0.12), transparent 70%),
			var(--color-surface);
		border-color: rgba(255, 122, 47, 0.3);
	}

	img,
	.no-icon {
		width: 30px;
		height: 30px;
		object-fit: contain;
		flex: none;
	}
	.goal img,
	.goal .no-icon {
		width: 38px;
		height: 38px;
	}
	.no-icon {
		display: grid;
		place-items: center;
		color: var(--color-muted);
	}

	.text {
		flex: 1;
		min-width: 0;
	}
	.name {
		display: block;
		font-weight: 600;
		font-size: 13.5px;
	}
	.goal .name {
		font-weight: 700;
		font-size: 15px;
	}
	.meta {
		font-size: 11px;
		color: var(--color-muted);
	}
	.goal .meta {
		font-size: 11.5px;
	}

	.badge {
		font-size: 11px;
		font-weight: 700;
		color: #ff9450;
		background: rgba(255, 90, 15, 0.14);
		border-radius: 999px;
		padding: 5px 12px;
		white-space: nowrap;
	}

	/* Filet d'indentation (3a l.339). */
	.children {
		margin-left: 19px;
		border-left: 2px solid rgba(255, 255, 255, 0.09);
		padding: 10px 0 0 26px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	@media (max-width: 1023.98px) {
		.node {
			gap: 10px;
			border-radius: 13px;
			padding: 11px 13px;
		}
		.node.goal {
			border-radius: 15px;
			padding: 12px 15px;
		}
		img,
		.no-icon {
			width: 26px;
			height: 26px;
		}
		.goal img,
		.goal .no-icon {
			width: 32px;
			height: 32px;
		}
		.name {
			font-size: 12.5px;
		}
		.goal .name {
			font-size: 13.5px;
		}
		.meta {
			font-size: 10px;
		}
		.badge {
			font-size: 9.5px;
			padding: 4px 10px;
		}
		.children {
			margin-left: 15px;
			padding: 8px 0 0 18px;
			gap: 7px;
		}
	}
</style>

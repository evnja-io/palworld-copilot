<script lang="ts">
	import { gameName } from '$lib/game/names';
	import { palIcon } from '$lib/game/icons';
	import { workIcon, workLabel } from '$lib/game/work';
	import { getLocale } from '$lib/paraglide/runtime';
	import { appHref } from '$lib/nav';
	import ElementBadge from './ElementBadge.svelte';
	import type { Locale } from '$lib/search/tokens';

	let {
		pal,
		caught,
		groupCount,
		highlightWork = '',
		ontoggle
	}: {
		pal: {
			id: string;
			zukanIndex: number;
			zukanSuffix?: string;
			elements: string[];
			passives: string[];
			// `| undefined` : les entrées de pals.json portent des clés optionnelles
			work: Record<string, number | undefined>;
		};
		caught: boolean;
		groupCount: number;
		highlightWork?: string;
		ontoggle: () => void;
	} = $props();

	const locale = getLocale() as Locale;
	const works = $derived(
		Object.entries(pal.work).filter((e): e is [string, number] => typeof e[1] === 'number')
	);
</script>

<div class="card" class:caught>
	<a href={appHref(`/paldex/${pal.id}`)} class="body">
		{#if palIcon(pal.id)}
			<img src={palIcon(pal.id)} alt="" loading="lazy" width="56" height="56" />
		{:else}
			<span class="no-icon" aria-hidden="true">?</span>
		{/if}
		<span class="text">
			<span class="num tnum">#{String(pal.zukanIndex).padStart(3, '0')}{pal.zukanSuffix ?? ''}</span>
			<span class="name">{gameName(`pal:${pal.id}`)}</span>
			<span class="elements">
				{#each pal.elements as e (e)}<ElementBadge element={e} />{/each}
			</span>
			{#if works.length}
				<span class="works">
					{#each works as [w, lvl] (w)}
						<span class="work" class:hl={w === highlightWork} title={workLabel(w, locale)}>
							{#if workIcon(w)}
								<img src={workIcon(w)} alt={workLabel(w, locale)} width="14" height="14" loading="lazy" />
							{/if}
							<span class="tnum">{lvl}</span>
						</span>
					{/each}
				</span>
			{/if}
			{#if pal.passives.length}
				<span class="passives">
					{pal.passives.map((p) => gameName(`passive:${p}`)).join(' · ')}
				</span>
			{/if}
		</span>
	</a>
	<button
		class="sphere"
		class:on={caught}
		onclick={ontoggle}
		aria-pressed={caught}
		title={caught ? '✔' : '○'}
	>
		<span class="ball" aria-hidden="true"></span>
		{#if groupCount > 0}<span class="count tnum">{groupCount}</span>{/if}
	</button>
</div>

<style>
	.card {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		padding: 8px 10px;
		transition: border-color 140ms, background 140ms;
	}
	.card:hover {
		border-color: var(--border-strong);
		background: var(--surface-2);
	}
	.body {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 0;
	}
	/* Signature : non capturé = désaturé, capture = couleurs */
	.card img {
		filter: grayscale(1) opacity(0.45);
		transition: filter 200ms cubic-bezier(0.23, 1, 0.32, 1);
	}
	.card.caught img {
		filter: none;
	}
	.no-icon {
		width: 56px;
		height: 56px;
		display: grid;
		place-items: center;
		color: var(--text-4);
		background: var(--surface-2);
		border-radius: var(--r-sm);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.num {
		font-family: var(--font-display);
		font-size: 10px;
		font-weight: 500;
		color: var(--text-4);
		letter-spacing: 0.06em;
	}
	.name {
		font-weight: 500;
		font-size: 13px;
		color: var(--text-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.card.caught .name {
		color: var(--text-1);
	}
	.elements {
		display: flex;
		gap: 4px;
		margin-top: 2px;
	}
	.works {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 2px;
	}
	.work {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		font-size: 10px;
		color: var(--text-3);
	}
	.work img {
		filter: none;
	}
	.work.hl {
		color: var(--text-1);
		font-weight: 600;
		background: var(--surface-3);
		border-radius: var(--r-sm);
		padding: 1px 4px;
		margin: -1px -2px;
	}
	.passives {
		font-size: 11px;
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	/* Pal Sphere de capture */
	.sphere {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		background: none;
		border: none;
		padding: 6px;
	}
	.sphere:hover {
		background: var(--surface-3);
	}
	.ball {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 2px solid var(--text-4);
		transition: border-color 140ms, background 140ms;
	}
	.sphere.on .ball {
		border-color: var(--accent);
		background: linear-gradient(to bottom, #f4f8fb 0 45%, var(--accent-ink) 45% 55%, var(--accent) 55%);
	}
	.count {
		font-size: 10px;
		color: var(--text-3);
	}
</style>

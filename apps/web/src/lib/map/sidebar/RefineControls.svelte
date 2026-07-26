<script lang="ts">
	// Affinage : niveau minimum, et éléments quand la catégorie les porte.
	import { m } from '$lib/paraglide/messages';
	import { ELEMENT_LABELS, type Locale } from '$lib/search/tokens';
	import { getLocale } from '$lib/paraglide/runtime';

	let {
		mode,
		levelMin,
		element,
		onlevel,
		onelement
	}: {
		mode: 'level' | 'level+element';
		levelMin: number;
		element: string;
		onlevel: (v: number) => void;
		onelement: (v: string) => void;
	} = $props();

	const locale = getLocale() as Locale;
	const ELEMENTS = Object.keys(ELEMENT_LABELS);
</script>

<div class="refine">
	<label class="lvl">
		{m.map_level_min()} <b class="tnum">{levelMin}+</b>
		<input
			type="range"
			min="1"
			max="70"
			value={levelMin}
			oninput={(e) => onlevel(Number(e.currentTarget.value))}
		/>
	</label>
	{#if mode === 'level+element'}
		<div class="els">
			{#each ELEMENTS as el (el)}
				<button
					class="el"
					class:on={element === el}
					style="--c:var(--el-{el.toLowerCase()})"
					aria-label={ELEMENT_LABELS[el][locale]}
					aria-pressed={element === el}
					onclick={() => onelement(element === el ? '' : el)}
				></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.refine {
		flex: none;
		display: flex;
		flex-direction: column;
		gap: 7px;
	}
	.lvl {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: var(--text-3);
	}
	.lvl input {
		flex: 1;
	}
	.els {
		display: flex;
		gap: 5px;
	}
	.el {
		position: relative;
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 50%;
		border: 1px solid transparent;
		background: color-mix(in srgb, var(--c) 35%, transparent);
	}
	.el.on {
		background: var(--c);
		border-color: var(--text-1);
	}
	@media (pointer: coarse) {
		.el::after {
			content: '';
			position: absolute;
			inset: -11px;
		}
	}
</style>

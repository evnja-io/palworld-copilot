<script lang="ts">
	let { element }: { element: string } = $props();
</script>

<span class="element" style="--el: var(--el-{element.toLowerCase()}, var(--el-normal))">
	{element}
</span>

<style>
	.element {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 999px;
		color: var(--el);
		background: color-mix(in srgb, var(--el) 16%, transparent);
		border: 1px solid color-mix(in srgb, var(--el) 30%, transparent);
	}
</style>

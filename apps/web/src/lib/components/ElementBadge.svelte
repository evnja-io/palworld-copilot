<script lang="ts">
	// Pastille d'élément — écrans 2a / 1c / 2b du handoff « Atlas ».
	// La teinte passe par --el, posée en style inline : c'est la convention de
	// la recette .el-badge (palwork-theme.css), qui porte fond, couleur, rayon,
	// graisse et interlettrage.
	import { elLabel, elVar } from '$lib/game/elements';

	let { element, size = 'md' }: { element: string; size?: 'sm' | 'md' } = $props();
</script>

<span class="el-badge {size}" style="--el:{elVar(element)}">{elLabel(element)}</span>

<style>
	.el-badge {
		display: inline-block;
		text-transform: uppercase;
		white-space: nowrap;
	}
	/* Cartes du Paldex (2a l.539) */
	.md {
		font-size: 10.5px;
		padding: 4px 10px;
	}
	/* Slots d'équipe, plus serré (2b l.579) */
	.sm {
		font-size: 9.5px;
		letter-spacing: 0.07em;
		padding: 3px 8px;
	}
</style>

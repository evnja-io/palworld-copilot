<script lang="ts">
	// Champ de recherche en pilule — écrans 2a l.525, 3b l.379, 4a l.163, 5b l.120.
	let {
		value = $bindable(''),
		placeholder,
		width,
		glassy = false
	}: {
		value?: string;
		placeholder: string;
		/** 240px (Paldex), 220px (Objets) ; non défini = pleine largeur. */
		width?: string;
		/** Variante flottante au-dessus de la carte (5b). */
		glassy?: boolean;
	} = $props();
</script>

<div class="pill" class:glassy style={width ? `width:${width}` : ''}>
	<span class="ic" aria-hidden="true">⌕</span>
	<input type="search" bind:value {placeholder} aria-label={placeholder} />
</div>

<style>
	.pill {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: 999px;
		padding: 10px 18px;
		transition:
			border-color var(--duration-hover) var(--ease-out-soft),
			box-shadow var(--duration-hover) var(--ease-out-soft);
	}
	.pill.glassy {
		background: rgba(21, 22, 28, 0.9);
		backdrop-filter: blur(8px);
		border-color: rgba(255, 255, 255, 0.09);
	}
	/* Le focus est porté par le conteneur : l'input lui-même est dénudé, sans
	   quoi on verrait deux anneaux concentriques. */
	.pill:focus-within {
		border-color: rgba(255, 122, 47, 0.6);
		box-shadow: 0 0 0 4px rgba(255, 122, 47, 0.12);
	}
	input {
		flex: 1;
		min-width: 0;
		border: none;
		background: none;
		padding: 0;
		font-size: 13px;
		color: var(--color-text);
	}
	input::placeholder {
		color: var(--color-muted);
	}
	input:focus-visible {
		outline: none;
	}
	/* La croix native de Safari/Chrome casse l'alignement de la pilule. */
	input::-webkit-search-cancel-button {
		-webkit-appearance: none;
	}
	.ic {
		color: var(--color-muted);
		font-size: 14px;
		line-height: 1;
	}

	@media (max-width: 1023.98px) {
		.pill {
			padding: 12px 18px;
			width: 100% !important;
		}
		input {
			font-size: 13.5px;
		}
	}
</style>

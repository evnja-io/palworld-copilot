<script lang="ts">
	type Rect = { top: number; left: number; width: number; height: number };
	type Comment = {
		id: number;
		variant: string;
		descriptor: string;
		selector: string;
		text: string;
		x: number;
		y: number;
	};
	type Pending = Omit<Comment, 'text'>;

	let commenting = $state(false);
	let hoverBox = $state<Rect | null>(null);
	let pending = $state<Pending | null>(null);
	let draft = $state('');
	let comments = $state<Comment[]>([]);
	let panelOpen = $state(false);
	let direction = $state('');
	let copied = $state(false);
	let nextId = 1;

	const byVariant = $derived.by(() => {
		const groups: Record<string, Comment[]> = {};
		for (const c of comments) {
			(groups[c.variant] ??= []).push(c);
		}
		return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
	});

	function toggleCommenting() {
		commenting = !commenting;
		hoverBox = null;
		if (!commenting) cancelPending();
	}

	function ownUi(el: Element | null): boolean {
		return Boolean(el?.closest('[data-fb-ui]'));
	}

	function targetAt(x: number, y: number): Element | null {
		const el = document.elementFromPoint(x, y);
		if (!el || el === document.body || el === document.documentElement || ownUi(el)) return null;
		return el;
	}

	function onMove(ev: MouseEvent) {
		if (!commenting || pending) return;
		const el = targetAt(ev.clientX, ev.clientY);
		if (!el) {
			hoverBox = null;
			return;
		}
		const r = el.getBoundingClientRect();
		hoverBox = { top: r.top, left: r.left, width: r.width, height: r.height };
	}

	function describe(el: Element): string {
		const tag = el.tagName.toLowerCase();
		const cls = [...el.classList].filter((c) => !c.startsWith('svelte-')).slice(0, 3);
		const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
		return `${tag}${cls.length ? '.' + cls.join('.') : ''}${text ? ` « ${text} »` : ''}`;
	}

	function cssPath(el: Element): string {
		const parts: string[] = [];
		let cur: Element | null = el;
		while (cur && cur !== document.body && parts.length < 6) {
			if (cur.id) {
				parts.unshift(`#${cur.id}`);
				break;
			}
			let part = cur.tagName.toLowerCase();
			const cls = [...cur.classList].filter((c) => !c.startsWith('svelte-')).slice(0, 2);
			if (cls.length) part += '.' + cls.join('.');
			const parent = cur.parentElement;
			if (parent) {
				const same = [...parent.children].filter((s) => s.tagName === cur!.tagName);
				if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
			}
			parts.unshift(part);
			cur = cur.parentElement;
		}
		return parts.join(' > ');
	}

	function onClickCapture(ev: MouseEvent) {
		if (!commenting || pending) return;
		if (ownUi(ev.target as Element | null)) return;
		const el = targetAt(ev.clientX, ev.clientY);
		if (!el) return;
		ev.preventDefault();
		ev.stopPropagation();
		const variant =
			el.closest('[data-variant]')?.getAttribute('data-variant') ?? 'Hors variante';
		pending = {
			id: nextId++,
			variant,
			descriptor: describe(el),
			selector: cssPath(el),
			x: ev.pageX,
			y: ev.pageY
		};
		draft = '';
		hoverBox = null;
	}

	function savePending() {
		if (!pending || !draft.trim()) return;
		comments = [...comments, { ...pending, text: draft.trim() }];
		pending = null;
		draft = '';
	}

	function cancelPending() {
		if (pending) nextId--;
		pending = null;
		draft = '';
	}

	function onKeydown(ev: KeyboardEvent) {
		if (ev.key !== 'Escape') return;
		if (pending) {
			cancelPending();
			return;
		}
		if (commenting) {
			commenting = false;
			hoverBox = null;
		}
	}

	function exportMarkdown(): string {
		const lines: string[] = [
			'## Design Lab Feedback',
			'**Target:** TeamBuilder',
			`**Comments:** ${comments.length}`
		];
		for (const [variant, list] of byVariant) {
			lines.push('', `### Variant ${variant}`);
			list.forEach((c, i) => {
				lines.push(`${i + 1}. **${c.descriptor}** (\`${c.selector}\`)`, `   "${c.text}"`);
			});
		}
		lines.push('', '### Overall Direction', direction.trim() || '(non renseignée)');
		return lines.join('\n');
	}

	async function copyAll() {
		await navigator.clipboard.writeText(exportMarkdown());
		copied = true;
		setTimeout(() => (copied = false), 3000);
	}
</script>

<svelte:window onmousemove={onMove} onclickcapture={onClickCapture} onkeydown={onKeydown} />

<!-- Surbrillance de l'élément survolé -->
{#if hoverBox}
	<div
		class="hl"
		aria-hidden="true"
		style="top:{hoverBox.top}px; left:{hoverBox.left}px; width:{hoverBox.width}px; height:{hoverBox.height}px"
	></div>
{/if}

<!-- Épingles + boîte de commentaire (coordonnées page) -->
<div class="pins" aria-hidden={pending ? undefined : true}>
	{#each comments as c (c.id)}
		<span class="pin tnum" style="left:{c.x}px; top:{c.y}px" title={c.text}>{c.id}</span>
	{/each}
	{#if pending}
		<form
			class="box"
			data-fb-ui
			style="left:{Math.min(pending.x, Math.max(0, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 300))}px; top:{pending.y + 8}px"
			onsubmit={(ev) => {
				ev.preventDefault();
				savePending();
			}}
		>
			<p class="box-target">
				<strong>{pending.variant === 'Hors variante' ? '' : `Variante ${pending.variant} — `}</strong>
				{pending.descriptor}
			</p>
			<!-- svelte-ignore a11y_autofocus -->
			<textarea
				bind:value={draft}
				rows="3"
				placeholder="Ton feedback sur cet élément…"
				autofocus
			></textarea>
			<div class="box-actions">
				<button type="button" onclick={cancelPending}>Annuler</button>
				<button type="submit" class="primary" disabled={!draft.trim()}>Enregistrer</button>
			</div>
		</form>
	{/if}
</div>

<!-- Panneau des commentaires -->
{#if panelOpen}
	<aside class="panel" data-fb-ui aria-label="Commentaires de feedback">
		<header class="p-head">
			<h3 class="p-title">Feedback · {comments.length} commentaire{comments.length > 1 ? 's' : ''}</h3>
			<button type="button" class="icon" aria-label="Fermer le panneau" onclick={() => (panelOpen = false)}>×</button>
		</header>
		<div class="p-body">
			{#if comments.length === 0}
				<p class="p-empty">
					Aucun commentaire. Active « Ajouter un feedback » puis clique sur n'importe quel élément
					des variantes.
				</p>
			{/if}
			{#each byVariant as [variant, list] (variant)}
				<section class="p-group">
					<h4 class="p-variant">{variant === 'Hors variante' ? variant : `Variante ${variant}`}</h4>
					<ul>
						{#each list as c (c.id)}
							<li>
								<span class="p-pin tnum">{c.id}</span>
								<div class="p-comment">
									<span class="p-desc">{c.descriptor}</span>
									<span class="p-text">« {c.text} »</span>
								</div>
								<button
									type="button"
									class="icon"
									aria-label="Supprimer le commentaire {c.id}"
									onclick={() => (comments = comments.filter((x) => x.id !== c.id))}
								>×</button>
							</li>
						{/each}
					</ul>
				</section>
			{/each}
			<label class="p-direction">
				<span class="p-variant">Direction générale <span class="req">(requise)</span></span>
				<textarea
					bind:value={direction}
					rows="4"
					placeholder="Quelle piste retenir ? Que mixer, qu'écarter ?"
				></textarea>
			</label>
		</div>
		<footer class="p-foot">
			{#if copied}
				<span class="copied">Copié — colle-le dans le terminal</span>
			{/if}
			<button type="button" class="primary" disabled={!direction.trim()} onclick={copyAll}>
				Tout copier
			</button>
		</footer>
	</aside>
{/if}

<!-- Boutons flottants -->
<div class="fabs" data-fb-ui>
	<button type="button" class="fab" class:on={commenting} onclick={toggleCommenting}>
		{commenting ? 'Quitter le mode feedback (Échap)' : '✚ Ajouter un feedback'}
	</button>
	<button type="button" class="fab" onclick={() => (panelOpen = !panelOpen)}>
		Commentaires <span class="tnum">({comments.length})</span>
	</button>
</div>

{#if commenting}
	<div class="cursor-layer" aria-hidden="true"></div>
{/if}

<style>
	.hl {
		position: fixed;
		z-index: 1200;
		pointer-events: none;
		outline: 2px solid var(--accent);
		outline-offset: 1px;
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		border-radius: 2px;
	}
	.cursor-layer {
		position: fixed;
		inset: 0;
		z-index: 1190;
		cursor: crosshair;
		pointer-events: none;
	}
	:global(body:has(.cursor-layer)) {
		cursor: crosshair;
	}
	.pins {
		position: absolute;
		top: 0;
		left: 0;
		width: 0;
		height: 0;
		overflow: visible;
		z-index: 1210;
	}
	.pin {
		position: absolute;
		transform: translate(-50%, -100%);
		width: 24px;
		height: 24px;
		display: grid;
		place-items: center;
		font-size: 12px;
		font-weight: 700;
		font-family: var(--font-display);
		color: var(--accent-ink);
		background: var(--accent);
		border: 1px solid color-mix(in srgb, var(--accent) 60%, white);
		border-radius: 50% 50% 50% 4px;
		pointer-events: auto;
	}
	.box {
		position: absolute;
		z-index: 1220;
		width: 280px;
		display: flex;
		flex-direction: column;
		gap: 8px;
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-md);
		padding: 10px;
		box-shadow: 0 16px 48px hsl(222 40% 2% / 0.6);
	}
	.box-target {
		margin: 0;
		font-size: 11px;
		color: var(--text-3);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.box textarea,
	.p-direction textarea {
		font: inherit;
		font-size: 13px;
		color: var(--text-1);
		background: var(--input-bg);
		border: 1px solid var(--border);
		border-radius: var(--r-sm);
		padding: 6px 8px;
		resize: vertical;
	}
	.box textarea:focus-visible,
	.p-direction textarea:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 1px;
	}
	.box-actions {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
	}
	.primary {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: transparent;
		font-weight: 600;
	}
	.primary:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
	.fabs {
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 1230;
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
	}
	.fab {
		min-height: 44px;
		padding: 10px 16px;
		font-weight: 600;
		background: var(--surface-2);
		border: 1px solid var(--border-strong);
		border-radius: 999px;
		box-shadow: 0 12px 32px hsl(222 40% 2% / 0.5);
	}
	.fab.on {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: transparent;
	}
	.panel {
		position: fixed;
		right: 16px;
		bottom: 130px;
		z-index: 1225;
		width: min(360px, calc(100vw - 32px));
		max-height: min(70vh, 640px);
		display: flex;
		flex-direction: column;
		background: var(--surface-1);
		border: 1px solid var(--border-strong);
		border-radius: var(--r-lg);
		box-shadow: 0 24px 64px hsl(222 40% 2% / 0.6);
		overflow: hidden;
	}
	.p-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border);
	}
	.p-title {
		margin: 0;
		font-size: 14px;
		color: var(--text-1);
	}
	.icon {
		background: none;
		border: none;
		color: var(--text-3);
		font-size: 15px;
		padding: 4px 8px;
	}
	.icon:hover {
		color: var(--text-1);
		background: var(--surface-3);
	}
	.p-body {
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.p-empty {
		margin: 0;
		font-size: 12px;
		color: var(--text-3);
	}
	.p-group ul {
		list-style: none;
		margin: 6px 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.p-group li {
		display: flex;
		align-items: flex-start;
		gap: 8px;
	}
	.p-variant {
		margin: 0;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-4);
	}
	.req {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 400;
	}
	.p-pin {
		flex-shrink: 0;
		width: 18px;
		height: 18px;
		display: grid;
		place-items: center;
		font-size: 10px;
		font-weight: 700;
		color: var(--accent-ink);
		background: var(--accent);
		border-radius: 50%;
	}
	.p-comment {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.p-desc {
		font-size: 11px;
		color: var(--text-4);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.p-text {
		font-size: 13px;
		color: var(--text-1);
	}
	.p-direction {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.p-foot {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
		padding: 10px 14px;
		border-top: 1px solid var(--border);
	}
	.copied {
		font-size: 12px;
		color: var(--el-leaf);
	}
</style>

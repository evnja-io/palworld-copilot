<script lang="ts">
	import { enhance } from '$app/forms';
	import { m } from '$lib/paraglide/messages';
	import { getLocale } from '$lib/paraglide/runtime';

	let { data, form } = $props();

	const KIND_LABEL: Record<string, (count: number) => string> = {
		pal_caught: (count) => m.import_kind_pal_caught({ count }),
		tech_unlocked: (count) => m.import_kind_tech_unlocked({ count }),
		'raw:relic': (count) => m.import_kind_relic({ count })
	};

	function kindBadges(kinds: Record<string, number>) {
		return Object.entries(kinds).map(([kind, count]) => ({
			kind,
			label: KIND_LABEL[kind]?.(count) ?? `${kind}: ${count}`
		}));
	}

	function shortGuid(guid: string) {
		return guid.slice(0, 8);
	}

	function formatDate(iso: string) {
		const locale = getLocale();
		return new Date(iso).toLocaleDateString(locale);
	}

	function getErrorMessage(code: string): string {
		const errorMap: Record<string, string> = {
			guid_missing: m.import_err_guid_missing(),
			already_claimed_user: m.import_err_already_claimed_user(),
			guid_taken: m.import_err_guid_taken(),
			guid_unknown: m.import_err_guid_unknown()
		};
		return errorMap[code] ?? code;
	}
</script>

<div class="head">
	<h1>{m.import_title()}</h1>
</div>

{#if form?.error}
	<p class="error">{getErrorMessage(form.error)}</p>
{/if}

{#if data.snapshots.length === 0}
	<p class="empty">{m.import_empty()}</p>
{:else}
	<div class="grid">
		{#each data.snapshots as s (s.guid)}
			<div class="card" class:mine={s.guid === data.mine}>
				<div class="row">
					<code class="guid" title={s.guid}>{shortGuid(s.guid)}…</code>
					{#if s.claimedBy}
						<span class="claimed">{m.import_claimed_by({ name: s.claimedBy })}</span>
					{:else if !data.mine}
						<form method="POST" action="?/claim" use:enhance>
							<input type="hidden" name="guid" value={s.guid} />
							<button class="claim">{m.import_claim()}</button>
						</form>
					{/if}
				</div>
				<div class="badges">
					{#each kindBadges(s.kinds) as b (b.kind)}
						<span class="badge tnum">{b.label}</span>
					{/each}
				</div>
				<p class="last tnum">{m.import_last()} : {formatDate(s.lastImport)}</p>
			</div>
		{/each}
	</div>
{/if}

<aside class="help">
	<p>{m.import_help()}</p>
</aside>

<style>
	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.error {
		color: var(--el-fire);
		background: color-mix(in srgb, var(--el-fire) 12%, transparent);
		border: 1px solid color-mix(in srgb, var(--el-fire) 30%, transparent);
		border-radius: var(--r-sm);
		padding: 8px 12px;
		font-size: 13px;
	}
	.empty {
		color: var(--text-3);
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
	}
	.card.mine {
		border-color: color-mix(in srgb, var(--accent) 35%, transparent);
	}
	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}
	.guid {
		font-family: var(--font-body);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-1);
	}
	.claimed {
		font-size: 12px;
		color: var(--text-3);
	}
	.claim {
		font-size: 12px;
		padding: 4px 10px;
		color: var(--accent);
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 8px;
		margin-top: 8px;
	}
	.badge {
		font-size: 12px;
		color: var(--text-2);
		background: var(--surface-2);
		border-radius: 999px;
		padding: 2px 9px;
	}
	.last {
		margin: 8px 0 0;
		font-size: 12px;
		color: var(--text-3);
	}
	.help {
		margin-top: 24px;
		padding: 12px 14px;
		background: var(--surface-1);
		border: 1px solid var(--border);
		border-radius: var(--r-md);
		color: var(--text-3);
		font-size: 13px;
	}
	.help p {
		margin: 0;
	}
</style>

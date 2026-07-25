# Palwork — Product & Brand Context Brief

> Context document for the **Palwork** assistant (branding, marketing, social, ads, product ideation).
> Everything under "Facts" is grounded in the actual product/codebase as of 2026-07. Everything under
> "Angles / ideas" is a suggestion to explore, not an established claim. **Never invent metrics**
> (user counts, revenue, testimonials) — we don't have them yet.

---

## 1. One-liner

**Palwork is a shared companion web app for groups playing Palworld together — one place where your
whole crew's progression lives: a collective Paldex, breeding calculator, team builder, interactive
map, tech tree and crafting, synced automatically from your dedicated server's save.**

Shorter still: *"Your tribe's shared Palworld Paldex."* (this is the live hero headline).

---

## 2. Naming & brand facts (read this first)

There is a **naming split** worth resolving deliberately:

| Where | Name used |
|---|---|
| Public domain / hosted brand | **Palwork** — `palwork.evnja.gg` |
| In-app title (`app_title`) | "Palworld Companion" |
| GitHub repo | `evnja-io/palworld-copilot` |
| Parent org / studio | **evnja** (`evnja.gg`, `evnja-io` on GitHub) |

- **"Palwork"** is the strongest brand asset: short, ownable, a clean pun on Palworld + work/teamwork,
  already the domain. Recommend treating **Palwork** as *the* product name and demoting "Palworld
  Companion" to a descriptive subtitle ("Palwork — the Palworld companion for groups").
- The word **"tribe"** is the product's own term for a player group ("your tribe's shared Paldex",
  "invite your tribe"). It's good, warm, ownable brand vocabulary — lean into it.
- **Legal guardrail (non-negotiable):** Palwork is an unofficial fan project. **Not affiliated with
  Pocketpair, Inc.** Palworld and all related assets belong to their rightful owners. Every public
  surface must carry this. Do not imply endorsement, don't use Pocketpair logos, be careful with
  in-game art in paid ads.
- **License:** GPL-3.0, fully open source and self-hostable. This is a *brand value* (trust,
  transparency, no lock-in), not just a legal footnote.

---

## 3. What it actually is (product facts)

A **multi-tenant** web app. Core mechanic: one Discord login → create up to **3 "servers"** (a server
= one Palworld world shared with your group) → invite friends via revocable links → everyone's
progression shows up in one shared, private space.

Feature set (all live):

- **Shared Paldex** — who caught what, across the whole group, with stats, passives and breeding links.
- **Breeding calculator** — child of two parents, which parents reach a target Pal, and the *shortest
  breeding path*, plus a full combos index.
- **Team builder** — compose and share Pal teams (passives, active skills, loadouts), pre-filled from
  each species' innate passives and best learnset. Theorycrafting for the group.
- **Interactive map** (Leaflet) — effigies, alpha bosses, fast-travel points, checked off collectively.
- **Tech tree** — the full in-game tree with everyone's real progression.
- **Crafting & items** — recipes, materials, crafting chains, buildings, all cross-linked.
- **Automatic save import** — owner adds their dedicated server's SFTP in settings (connection test +
  auto-discovered world folder); the save imports **every 6 hours** and catches/tech/effigies tick
  themselves off. Credentials encrypted at rest (AES-256-GCM), never shown back, deletable anytime.
- **Local & co-op import** — no dedicated server? Upload your local/co-op save folder from the browser.

Content depth (real, generated from game files — usable as concrete proof points):
**288 Pals · 1,148 items · 152 alpha bosses · 138 effigies.**

Practical facts: **bilingual FR/EN**, free, no ads, no subscription, Discord sign-in only.

---

## 4. The core problem / job-to-be-done

When a group plays Palworld on a shared dedicated server, **progression is invisible and scattered**:

- No one knows *who's caught what* or *what the group still needs* for the Paldex.
- Breeding paths and team comps get worked out in Discord messages and spreadsheets that go stale.
- Map collectibles (effigies, alpha bosses) get double-done or forgotten.
- Existing tools are either **static wikis** (paldb, game8, IGN — great data, zero group state) or
  **single-player save editors** (PalEdit, save-tools — technical, solo, not shareable).

**Palwork's wedge:** the *shared, automatically-synced group tracker*. It's the layer between "static
reference site" and "raw save editor" that nobody else occupies well. The killer detail is
**automatic sync** — the group doesn't maintain anything; the save updates the app every 6 hours.

---

## 5. Audiences / personas

1. **The server owner / "the organizer"** — runs the dedicated server, sets up the group. Primary
   activation target: they do the SFTP setup and invite everyone. Motivated by *keeping the group
   coordinated* and *seeing collective progress*.
2. **The group member / "the tribe"** — joins via link, claims their character in one click. Wants to
   see their own contribution and what to catch/build next. Lowest-friction persona.
3. **The theorycrafter / min-maxer** — lives in the breeding calculator and team builder. Power-user,
   likely to share builds outward (social/Reddit/Discord).
4. **The self-hoster / privacy-minded** — cares that it's open source, GPL, self-hostable, encrypted
   credentials. Small segment but high-trust, high-advocacy.
5. **Local / co-op players** — no dedicated server; manual upload. Expands TAM beyond dedicated-server
   groups (which is important — dedicated servers are a minority of the playerbase).

---

## 6. Positioning & differentiators

**Category:** Palworld group companion / shared progression tracker.

What makes it different (lead with these):
- **Shared, not solo.** Group-first, multi-tenant, per-server privacy. Almost every competitor is
  single-player or a public wiki.
- **Automatic.** SFTP sync every 6h — zero manual upkeep. This is the "magic" moment.
- **Private by default.** Each server is fully isolated; nothing shared across servers or with third
  parties. Encrypted credentials.
- **Free & open source (GPL-3.0), self-hostable.** No ads, no subscription, no lock-in.
- **Complete.** Paldex + breeding + teams + map + tech + crafting in one app, not five browser tabs.
- **Bilingual FR/EN** out of the box (differentiator in the francophone community especially).

Honest weaknesses / things to be careful marketing:
- Automatic import needs a **dedicated server reachable over SFTP** — not everyone has that (mitigated
  by manual upload, but the "magic" story is weaker for them).
- It's a **fan project** — no official backing, sustainability rests on a small team/volunteers.
- No mobile app (web only). No public metrics/social proof yet.

---

## 7. Business & growth model (facts)

- **Free**, hosted instance, no ads, no paid tier today. Monetization is not currently a thing —
  don't market pricing you can't back.
- **Built-in viral loop:** the invite-link mechanic *is* the growth engine. One organizer brings a
  whole tribe (typically 4–15 people). Marketing should feed **organizers**, not individuals — acquire
  one, get the group. Any growth idea should ask "does this help an organizer recruit their tribe?"
- **Community hub:** Discord (`discord.gg/SJehy5fFJ`). Discord is both the auth provider *and* the
  natural community/support/announcement channel — it's central, not incidental.

---

## 8. Brand identity signals already in the product

Use these so all new brand/marketing work stays consistent with what exists:

- **Art direction:** *"night expedition"* (`expédition nocturne`) — dark UI, aurora/starfield, drifting
  columns of desaturated Pal icons on the landing. Calm, atmospheric, not loud/gamer-neon.
- **Color:** base is a blue-slate (HSL 222°), single accent = **"Pal Sphere blue"** `hsl(199 90% 55%)`
  (~`#1FA6EE`). Canonical element colors exist for game types (fire/water/leaf/electric/ice/earth/
  dark/dragon/normal) — reuse those for type-based content.
- **Typography:** display font **Space Grotesk** (tight, geometric, modern); body is system UI.
- **Visual philosophy:** depth via borders + surface tiers, *no drop shadows*; restrained, "whisper-
  quiet" surfaces. Premium-minimal, not busy.
- **Favicon/mark:** currently uses the Mega Pal Sphere icon as an ad-hoc logomark — there is **no
  dedicated Palwork logo yet** (a real branding opportunity/gap).

---

## 9. Voice & tone (from the live copy)

The existing copy is **plain, calm, confident, friend-to-friend** — and deliberately *un-hyped*.
Examples of the actual voice: "Sign in with Discord, nothing else to create." / "Free and open source."
/ "checked off together." / "theorycrafted with your tribe."

Rules for the voice:
- Plain and concrete over salesy. **No** "blazingly fast", "revolutionary", "#1", "ultimate".
- Warm and communal — "your tribe", "together", "your crew". Palworld group play is social; mirror that.
- Respect the player's intelligence; they know the game. Use real game vocabulary (Paldex, effigies,
  alpha bosses, passives, breeding paths).
- Bilingual: every marketing asset should have a clean FR and EN version (not machine-translated).
- Lead with the *shared/automatic* benefit, not a feature list.

---

## 9b. Messaging ladder (suggested)

- **Hook:** "Everyone in your Palworld group, one shared Paldex."
- **Problem:** "Who's caught what? What do we still need? Stop guessing in Discord."
- **Magic:** "Plug in your server once — it syncs itself every 6 hours."
- **Proof:** 288 Pals, 152 alpha bosses, 138 effigies, breeding + teams + map, all in one place.
- **Reassurance:** Free, open source, private per server, no ads.
- **CTA:** "Sign in with Discord and create your server."

---

## 10. Marketing angles & channels (ideas to explore — not commitments)

**Channels that fit the audience:**
- **Reddit** — r/Palworld (large, active). Value-first posts (breeding path finds, "we 100%'d the
  Paldex as a group and here's how") beat ads. Tool posts do well when genuinely useful.
- **Discord** — Palworld community/server-hosting Discords; own the community channel as support+news.
- **YouTube/TikTok** — short "set up a shared Paldex for your server in 60s" demos; the auto-sync
  reveal is the visual hook.
- **SEO** — see §11; long tail around breeding, Paldex tracking, dedicated server tools.
- **Server-host adjacency** — communities around renting/running Palworld dedicated servers are a
  concentrated pool of *organizers* (the high-value persona).

**Content themes:**
- "Group play" identity content — Palwork as the co-op/tribe companion, not a solo wiki.
- Breeding calculator as a standalone hook (highly shareable, high search intent).
- Transparency/open-source story for the trust-driven segment.
- Francophone community focus (bilingual is a real edge in FR Palworld spaces).

**Ads caution:** fan project + game IP → keep paid creative on *your* UI and original art, carry the
"not affiliated with Pocketpair" line, avoid implying official status.

---

## 11. SEO / keyword seeds (validate before relying on)

Intent clusters worth targeting: `palworld breeding calculator`, `palworld breeding combos`,
`palworld paldex tracker`, `palworld shared paldex`, `palworld dedicated server tools`,
`palworld team builder`, `palworld map effigies`, `palworld co-op progress tracker`, and FR
equivalents (`calculateur reproduction palworld`, `suivi paldex palworld`, etc.). The breeding and
Paldex-tracking terms are likely the best acquisition wedges.

---

## 12. Open questions the Palwork agent should raise (don't assume answers)

- Is **"Palwork"** the final public name? (Recommend yes — unify in-app title + repo behind it.)
- Is there any intent to monetize (donations, sponsor server hosts, self-host support)? Affects
  messaging.
- What's the actual current usage / community size? (Needed before any "social proof" claim.)
- Primary geo/language priority — FR-first, EN-first, or balanced?
- Is a real logo/wordmark commissioned? (Current mark is a placeholder game icon.)
- Which persona to prioritize for acquisition — organizers (recommended) vs individual players?

---

## 13. Quick-reference fact sheet

- **Product:** Palwork — shared Palworld companion for groups
- **URL:** https://palwork.evnja.gg · **Discord:** https://discord.gg/SJehy5fFJ · **Repo:** github.com/evnja-io/palworld-copilot
- **Model:** free, no ads, open source (GPL-3.0), self-hostable, multi-tenant (≤3 servers/account)
- **Auth:** Discord only · **Languages:** FR + EN
- **Content:** 288 Pals · 1,148 items · 152 alpha bosses · 138 effigies
- **Core loop:** Discord login → create server → invite tribe (revocable links) → claim character → SFTP auto-sync every 6h (or manual upload)
- **Differentiators:** shared + automatic + private + free/open-source + complete + bilingual
- **Legal line (always include):** Not affiliated with Pocketpair, Inc. Palworld assets belong to their rightful owners.
- **Voice:** plain, calm, communal ("your tribe"), no hype
- **Look:** night-expedition dark theme, Pal Sphere blue accent (#1FA6EE), Space Grotesk display

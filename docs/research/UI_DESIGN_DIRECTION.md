# Fluent365 — UI Design Direction

Status: research + proposal · Date: 2026-11-16 · Sources accessed 2026-11-16 (see §8)

Scope: visual and interaction direction for the React + plain-CSS PWA. Replaces the two rejected
looks: (1) "plain blue dashboard of cards" and (2) "Notion clone with emoji icons, pastel tags and
gradient covers". The owner's actual brief was "something more like Notion UI but colored": calm,
typographic, content-first, with tasteful colour and **no emoji used as icons**.

---

## 0. The direction in one paragraph — "Ink & Paper, with a teal pen"

Fluent365 should look like a well-set study notebook, not an app dashboard. The page is warm off-white paper
(dark mode: warm charcoal), and the text is near-black ink in one highly legible typeface
(**Atkinson Hyperlegible Next**). One confident colour, **deep teal (#0D6660)**, marks "the thing to do
next": the primary button, current progress and the selected answer. A warm **terracotta (#A8441C)**
is the secondary accent, used sparingly for streak/"today" warmth and for highlights in grammar notes.
Each skill (Words, Grammar, Reading, Listening, Writing, Speaking) has its own muted ink colour. It appears only as
a thin left rule, a small label and a tinted line icon. It never fills a card or a header. There are
no gradients, emoji, mascots, confetti, or pastel tag soup. Structure comes from typography, whitespace and a few hairlines, the way Linear's 2026
refresh describes it: "structure should be felt, not seen". Every screen has **one** filled
button. Sessions run in a full-screen focus mode with large type, big targets and explanatory feedback.

---

## 1. Research findings

### 1.1 What well-regarded learning and focus apps do, and what learners complain about

| App | What works | What people complain about / what to avoid |
|---|---|---|
| **Duolingo** | Extremely clear "one thing to do now" path; instant feedback; habit loop; streak with freeze/repair. | Adult reviewers call the interface "childish", say leagues and leaderboards "add nothing", and say it "feels more like a game than a serious learning tool". They also report "high engagement, low actual proficiency" and ads that break flow [1][2][3]. |
| **Babbel / Busuu** | Adult-oriented tone, explicit grammar ("understand the rules"), clear study plan on home [4][5]. | A heuristic review asks whether Babbel "dumps too much information at once" [6]. App-store complaints say Busuu iOS feels "dated" ("like a 2017 product") [2]. |
| **Praktika / Speak** | Speaking-first. Praktika is called "polished" with an "attractive interface" [7]. | Praktika lacks post-lesson error breakdowns [7]. Learners want to see *what they got wrong*, not just a score. |
| **Anki / AnkiDroid** | AnkiDroid's 2025 "new study screen" modernised the most-used screen [8][9]. | Users missed the **large answer buttons** option, disliked feedback moving to where "looking down between cards breaks focus" and the thumb covers it, and complained about gesture lag [10]. Lesson: keep answer buttons big, keep feedback near the content, and never trade responsiveness for looks. |
| **Brilliant** | "Learn by doing": an interactive problem on every screen, immediate feedback, and animated explanations of errors [11][12]. | It still layers leagues and streaks on top. |
| **Readwise Reader** | Reading view with ~65-character line length, generous margins and tuned typography. Focus mode hides side panels and highlights one paragraph [13][14]. | Not a learning app, but its reading screen is the model for Fluent365's reading and grammar text. |
| **Linear (2026 refresh)** | Moved from cool blue-grey to "warmer gray… less saturated", made the sidebar "a few notches dimmer", softened or removed separators, and **reduced and shrank icons, removing colored icon backgrounds**. "Don't compete for attention you haven't earned." [15] | This is close to the owner's brief: colour that is calm but not flat blue. |
| **Things 3** | Apple Design Award (2017). Reviews credit "whitespace, typography, and color". The UI is roughly 95% neutral, with colour reserved for meaning [16][17]. | This is the model for "colour = meaning, not decoration". |
| **Notion** | Content-first and typographic, with quiet chrome. | The emoji-as-icon, cover-image and pastel-tag habits are exactly what the owner rejected. Borrow the calm, not the decoration. |

**Synthesis: why the good ones feel engaging without being childish**
1. One obvious next action (Duolingo's path, Things' Today list).
2. Immediate, *explanatory* feedback (Brilliant, and what Praktika lacks).
3. Typography and whitespace carry the hierarchy; colour is scarce and therefore meaningful (Things, Linear).
4. Progress is visible but not competitive. Adults resent leagues [2][3].
5. Fast and responsive. AnkiDroid users notice 1.5 s of lag immediately [10].

### 1.2 Evidence on UI for learning

**Cognitive load.** Mayer's split-attention, redundancy, coherence, signaling and segmenting principles
[18][19] translate directly into UI rules:
- Put the question, its options and its feedback in **one column, close together**. Don't make the eye
  jump between a top banner and a bottom sheet (split attention). AnkiDroid users said the same [10].
- Don't show on-screen text that repeats the audio word-for-word while it plays in listening tasks (redundancy).
  Reveal the transcript *after* the questions.
- Remove decorative elements from session screens (coherence): no illustrations, no mascots, no
  background patterns.
- Show one step at a time with a "Next" button (segmenting). This is already Fluent365's core UX.
- Use bold or a highlight for the target form in grammar examples (signaling).

**Feedback design.** A meta-analysis of 40 studies on computer-based item feedback (Van der Kleij et al., 2015)
found these effect sizes: **elaborated feedback (an explanation) 0.49**, showing the correct answer 0.32,
and right/wrong only 0.05 [20][21]. So every wrong answer must show the correct answer
**and** a one-line reason (e.g. "Present perfect: the action is connected to now"). A red X on its own is
almost useless.

**Motivation and streaks.**
- Mobbin's study of 859 streak designs: most streaks rely on fear and loss aversion, and urgent copy and
  countdowns make people "defend a number". Lally's habit research found that **missing one day does
  not materially affect habit formation**, but the *feeling* of failure can trigger a "what-the-hell"
  spiral. A lower bar for a "successful day" kept 40% more people on a 7-day streak [22].
- A Journal of Consumer Research study (which included language apps) found broken streaks reduce
  engagement, and that this effect weakens when people can **repair** the streak [23]. Other research found
  people sometimes *switch languages* after a broken streak rather than restart [24].
- Even Duolingo's own blog says some "slack" is more motivating than rigid rules [25].
- **Fluent365 rule:** count *study days this week/month* (e.g. "5 of 7 days"). Allow two rest days a week
  that don't break anything. Never use a countdown, flame animation or guilt copy.

**Older adults.**
- NN/g: users 65+ are about 43% slower on websites. Mobile text is "often too small and lightly colored".
  All interfaces should let users increase text size [26][27].
- A systematic review of 41 usability studies with people 60+ (JMIR 2023) groups guidance into font, layout, icons and
  input [28]. Practitioner sources recommend ≥16 px minimum and 18–20 px for primary content,
  48 px targets as "bare minimum" and **~60 px for tremor or arthritis** [29].
- WCAG 2.2: **2.5.8 Target Size (Minimum, AA) = 24×24 CSS px**, **2.5.5 (Enhanced, AAA) = 44×44**.
  Apple recommends 44 pt and Material 48 dp [30][31].
- Contrast: 1.4.3 AA is 4.5:1, 1.4.6 AAA is 7:1 for body text, and 1.4.11 requires 3:1 for UI component borders,
  icons and focus rings. 1.4.12 requires the layout to survive line-height 1.5 and letter-spacing 0.12 em [32][33].
- **Fluent365 targets:** body text ≥ 7:1 (AAA), secondary text ≥ 4.5:1, interactive targets ≥ 48 px
  (56–64 px for session answer buttons), and a user text-size setting (S/M/L/XL).

**Dark mode.** Positive polarity (dark text on a light background) gave better proofreading and acuity performance for
**both young and older adults**, especially at small sizes. People didn't *perceive* the difference.
Dark mode may help some users with cataract [34]. **Decision:** light is the default and follows the system
setting; dark is fully supported and tuned (warm charcoal, not pure black, and text not pure white).

**Self-hosted fonts offline.** Precache woff2 files in the service worker and use `font-display: swap`.
Fontsource ships fonts as npm packages with ready-made `@font-face` rules [35][36]. Don't call
Google Fonts at runtime.

---

## 2. Design principles (10)

1. **One page, one action.** Every screen has exactly one filled (primary) button. Everything else is
   quiet: text buttons, outline buttons or links.
2. **Type first.** Hierarchy comes from size, weight and whitespace, not boxes. Use cards only when
   something is genuinely a separate object (a flashcard, a feedback panel).
3. **Colour means something.** Teal means "act / current / correct path". Terracotta means "today / highlight".
   Red and green are used only for answer feedback. Skill colours are used only to identify the skill. Keep the screen
   about 90% neutral.
4. **Explain, don't just judge.** Every incorrect answer shows the correct answer plus one short reason.
5. **Calm motivation.** Show progress as days studied and minutes done. Use a forgiving week view. No leagues, no
   countdowns, no guilt notifications.
6. **Big by default.** 18 px base text, 48 px minimum targets, 56–64 px session buttons, and a text-size
   setting up to 150%.
7. **Focus mode for sessions.** Hide the navigation. Show a thin progress bar, the step and the Next button.
   Nothing else.
8. **Line icons, never emoji.** Use one icon set with one stroke weight. Icons always sit next to a text label,
   except universally known controls (close, play, settings).
9. **Readable everywhere.** Text meets AAA 7:1 where it's practical and never falls below AA 4.5:1. Show focus rings
   clearly. Support keyboard shortcuts on the laptop (1–4, Enter, Space).
10. **Fast and offline.** No runtime network fonts. CSS-only motion under 200 ms that respects
    `prefers-reduced-motion`. No heavy UI library.

---

## 3. Foundations

### 3.1 Typeface

**Primary: Atkinson Hyperlegible Next.** Braille Institute, **SIL Open Font License 1.1** [37][38].
It was designed for low-vision legibility, with clearly distinct letterforms (I/l/1, O/0, rn/m). That
suits an 80-year-old user and IELTS reading alike. It comes in six weights plus italics [37]. Use it for UI, body text and reading
passages.

- Install: `npm i @fontsource/atkinson-hyperlegible-next` (static weights 400, 600 and 700, Latin and
  Latin-ext subsets). If a variable build is available (`@fontsource-variable/…`), use one file. Verify
  the package name when you install. Otherwise copy the woff2 files from the googlefonts repo into
  `public/fonts/` and keep `OFL.txt` next to them.
- Load only 400, 600 and 700 (plus 400 italic for example sentences). Add the woff2 files to the service worker
  precache. Use `font-display: swap`.
- **Monospace** (IPA, timers): use the system `ui-monospace` stack. Don't add another font.
- **Fallback stack:**
  `"Atkinson Hyperlegible Next", "Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif`

Alternatives considered: **Source Sans 3** (OFL, very good, more neutral and less distinctive). **Inter**
(OFL, ubiquitous and "SaaS-looking", with a tighter default that is less comfortable for elderly readers). **Geist**
(OFL, too techy/dev-tool). Atkinson gives Fluent365 a recognisable, humane voice *and* accessibility.

### 3.2 Type scale (rem, root 16 px; user text-size setting multiplies `--text-scale`)

Base body text is **18 px**. Scale ratio is about 1.2.

| Token | Size (default) | Line-height | Weight | Use |
|---|---|---|---|---|
| `--fs-xs` | 0.875rem / 14px | 1.45 | 600 | Overlines, tiny labels (sparingly, never body) |
| `--fs-sm` | 1rem / 16px | 1.5 | 400 | Secondary/meta text, captions |
| `--fs-md` | 1.125rem / 18px | 1.6 | 400 | **Body, options, buttons** |
| `--fs-lg` | 1.375rem / 22px | 1.45 | 600 | Section titles, question prompt on phone |
| `--fs-xl` | 1.75rem / 28px | 1.3 | 700 | Page titles ("Today") |
| `--fs-2xl` | 2.25rem / 36px | 1.2 | 700 | Flashcard word, big numbers on Progress |
| `--fs-3xl` | 3rem / 48px | 1.1 | 700 | Flashcard word on desktop only |

Rules: reading-text measure is `max-width: 65ch`. Paragraph spacing is 0.75em. Avoid all-caps except
`--fs-xs` overlines, which get `letter-spacing: 0.06em`. Don't put light (300) weights on body text. Use `font-variant-numeric: tabular-nums` for counters and timers.

Text-size setting: S 0.9 · **M 1.0 (default)** · L 1.15 · XL 1.3 (and browser zoom still works).
Implement it as `html { font-size: calc(100% * var(--text-scale)); }` with every size in rem.

### 3.3 Colour tokens

Contrast ratios were computed with the WCAG 2.x relative-luminance formula against the listed background.
AAA = ≥7:1, AA = ≥4.5:1, UI = ≥3:1 (1.4.11).

#### Light theme ("Paper")

| Token | Hex | Contrast (vs bg #FAF8F4 / surface #FFF) | Use |
|---|---|---|---|
| `--bg` | `#FAF8F4` | — | App background (warm paper) |
| `--surface` | `#FFFFFF` | — | Cards, flashcard, inputs |
| `--surface-sunken` | `#F3F0EA` | — | Sidebar, code/IPA wells, bottom bar |
| `--border` | `#E4DFD6` | 1.25 (decorative only) | Hairlines and dividers. Not used to identify controls |
| `--border-strong` | `#8C857A` | 3.44 / 3.65 (UI ✓) | Input borders, option outlines, checkbox |
| `--text` | `#1C1B19` | **16.2 / 17.2 (AAA)** | Body and headings |
| `--text-muted` | `#4F4B45` | **8.2 / 8.7 (AAA)** | Secondary text |
| `--text-faint` | `#6B665D` | 5.4 / 5.7 (AA) | Meta, timestamps only (≥16 px) |
| `--primary` | `#0D6660` | 6.4 / 6.8 (AA; ≥AAA-large) | Primary button bg, progress fill, links |
| `--primary-strong` | `#09504B` | **8.8 / 9.3 (AAA)** | Hover/pressed, teal text on white |
| `--on-primary` | `#FFFFFF` | 6.8 on primary · 9.3 on strong | Button label |
| `--primary-soft` | `#E2F0EE` | strong-on-soft 7.9 | Selected option bg, current nav item |
| `--accent` | `#A8441C` | 5.6 / 6.0 (AA) | Terracotta: "Today" mark, streak dots, highlights |
| `--accent-strong` | `#8A3615` | 6.8 on accent-soft | Accent text on soft bg |
| `--accent-soft` | `#FBE9DF` | — | Grammar "watch out" block bg, highlight marker |
| `--success` | `#1E6B3A` | 6.2 / 6.5 | Correct icon/text |
| `--success-soft` | `#E4F2E8` | success-on-soft 5.6 | Correct feedback panel bg |
| `--error` | `#B3261E` | 6.2 / 6.5 | Incorrect icon/text |
| `--error-strong` | `#9A1F18` | 6.9 on error-soft | Text inside error panel |
| `--error-soft` | `#FBE8E6` | — | Incorrect feedback panel bg |
| `--warning` | `#7A5000` | 6.7 / 7.1 | Timer < 1 min, notices |
| `--warning-soft` | `#FCF0D6` | warning-strong `#6B4600` 7.4 | Notice bg |
| `--focus` | `#2453C7` | 6.3 / 6.7 (UI ✓) | 3 px focus ring (blue on purpose, distinct from teal) |

Body `--text` on every soft background is ≥14.5:1.

**Skill inks (light).** Used for a 4 px left rule, an icon tint and a label. They are all ≥5.6:1 on white, so they are safe as text.

| Skill | Ink | on white | Soft bg (optional, for the skill chip) |
|---|---|---|---|
| Words (vocab/flashcards) | `#6A3EA1` violet | 7.5 | `#EFE9F8` |
| Grammar | `#2257A6` blue | 7.0 | `#E6EEF9` (ink-on-soft `#1C4A8C` 7.5) |
| Reading | `#0D6660` teal | 6.8 | `#E2F0EE` |
| Listening | `#7A5000` ochre | 7.1 | `#FCF0D6` |
| Writing | `#A8441C` terracotta | 6.0 | `#FBE9DF` |
| Speaking | `#A3325A` rose | 6.6 | `#F9E6EE` |

#### Dark theme ("Ink")

| Token | Hex | Contrast (vs bg #141311 / surface #1D1C19) | Note |
|---|---|---|---|
| `--bg` | `#141311` | — | Warm charcoal (not #000) |
| `--surface` | `#1D1C19` | — | |
| `--surface-raised` | `#262420` | — | Flashcard, menus |
| `--surface-sunken` | `#100F0E` | — | Sidebar |
| `--border` | `#34312C` | 1.4 (decorative) | |
| `--border-strong` | `#7D776C` | 4.2 / 3.8 (UI ✓) | |
| `--text` | `#EEEBE5` | **15.6 / 14.3** | Not pure white, to reduce halation |
| `--text-muted` | `#BDB7AC` | **9.3 / 8.6** | |
| `--text-faint` | `#A09A8F` | 6.6 / 6.1 | |
| `--primary` | `#5CC2B7` | **8.7 / 8.0** | Button bg |
| `--on-primary` | `#08201D` | 8.0 on primary | Dark label on light teal |
| `--primary-strong` | `#8FDCD3` | — | Hover, teal text on soft |
| `--primary-soft` | `#16302D` | strong-on-soft 8.9 | Selected option |
| `--accent` | `#F0916A` | 7.9 / 7.3 | |
| `--accent-soft` | `#3A2219` | `#F5AE8F` on it 8.0 | |
| `--success` / `--success-soft` | `#74D196` / `#16301F` | 10.0 · `#93E0AE` on soft 9.2 | |
| `--error` / `--error-soft` | `#FF8F86` / `#3A1A18` | 8.4 · `#FFB0A9` on soft 9.0 | |
| `--warning` / `--warning-soft` | `#EDC062` / `#33290F` | 10.9 · `#F2D08A` on soft 9.7 | |
| `--focus` | `#8FB0FF` | 8.7 / 8.0 | |

Skill inks (dark): Words `#C3A6F0` (8.9), Grammar `#8DB5F2` (8.9), Reading `#5CC2B7` (8.7),
Listening `#EDC062` (10.9), Writing `#F0916A` (7.9), Speaking `#F29BBC` (9.0). All are measured on bg.

**Theme switching:** use `:root` light tokens, then `@media (prefers-color-scheme: dark)` scoped to
`:root:not([data-theme="light"])`, plus `:root[data-theme="dark"]`. The Settings page offers System / Light / Dark.
Also add a **High-contrast** option: `--text-muted` becomes `--text`, `--border` becomes `--border-strong`, and controls get 2 px borders. A `@media (forced-colors: active)` block keeps focus rings and borders visible.

### 3.4 Spacing, radius, elevation, motion

```css
--space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
--space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

--radius-sm: 6px;   /* chips, small inputs */
--radius-md: 10px;  /* buttons, options, inputs */
--radius-lg: 16px;  /* flashcard, feedback panel, sheets */
--radius-full: 999px; /* progress bar, avatar, toggle */

--shadow-1: 0 1px 2px rgb(28 27 25 / .06), 0 0 0 1px rgb(28 27 25 / .04);   /* resting card */
--shadow-2: 0 4px 16px rgb(28 27 25 / .08), 0 1px 3px rgb(28 27 25 / .06);  /* flashcard, popover */
/* dark: use borders + surface-raised instead of shadows; shadow-2: 0 4px 16px rgb(0 0 0 / .5) */

--tap-min: 48px;       /* any control */
--tap-session: 56px;   /* answer options, Next button (64px at XL text) */
--measure: 65ch;
--dur-fast: 120ms; --dur: 180ms; --ease: cubic-bezier(.2,.0,.0,1);
```
Use `@media (prefers-reduced-motion: reduce)` to set all durations to 0. There's no parallax, no confetti and no bouncing.

### 3.5 Iconography

- **Set: Lucide** (`lucide-react`, tree-shaken, or paste the SVGs into a local `Icon.jsx`).
  It uses the **ISC licence**, and some icons derive from Feather (**MIT**). Keep both notices in `THIRD_PARTY_LICENSES` [39][40].
  Phosphor (MIT) is an equally valid choice. Pick one and never mix them.
- 24 px grid, **stroke-width 2** (1.75 at ≥32 px), `currentColor`. Size 20 px inline with text and 24 px in
  nav and buttons.
- **Always pair an icon with a text label** in navigation and buttons. Icon-only buttons are allowed only for close (X),
  play/pause, replay audio, record and settings gear, and they need an `aria-label` plus a 48 px hit area.
- Icons sit on bare backgrounds, with **no coloured squircle tiles** behind them (Linear removed exactly that [15]).
- Suggested mapping: Today `sun` · Words `layers` · Grammar `pilcrow` or `spell-check` · Reading
  `book-open` · Listening `headphones` · Writing `pen-line` · Speaking `mic` · Progress `chart-line` ·
  Settings `settings` · Correct `check` · Incorrect `x` · Hint `lightbulb` · Audio `volume-2` · Timer
  `timer` · Rest day `moon`.
- **No emoji anywhere in UI chrome.** Emoji may appear only if they are part of lesson *content* (rare).

---

## 4. Component specs

### 4.1 App shell

**Desktop/laptop (≥ 960 px):** a left sidebar 248 px wide on `--surface-sunken` with no right border, just the colour change,
following Linear's dimmer navigation [15]. The content column is centred with max-width 760 px (720 px for the session).
- Sidebar items: 48 px tall, a 20 px icon, an 18 px label in `--text-muted`, and radius-md. The current item uses `--primary-soft`
  bg, `--primary-strong` text and a 600 weight. Order: Today, Words, Grammar, Reading, Listening, Writing,
  Speaking, then a divider, then Progress and Settings. The app name "Fluent365" sits at the top as a wordmark in 700 weight with a small
  teal dot. There's no logo tile.
- Collapses to a 72 px icon rail between 720 and 959 px, with labels shown as tooltips **and** visible on focus.

**Phone (< 720 px):** a bottom bar 64 px tall plus the safe-area inset, on `--surface` with a 1 px top `--border`.
It has **4 items only**: Today · Practice (skill list) · Progress · Settings. Each has a 24 px icon over a 14 px label, both always
visible. Active items use teal ink and a 600 label. There's no hamburger menu and no FAB.

**In a session**, the shell hides completely (focus mode). A top bar shows ✕ Close (with a confirmation dialog), a progress bar and the step
count "7 / 24".

### 4.2 Home: "Today" screen

Purpose: the user should press **Start today's session** within 2 seconds.
- Overline (`--fs-xs`, `--text-faint`): "SUNDAY 16 NOVEMBER".
- Title (`--fs-xl`): "Good morning, Ati", or just "Today".
- One-sentence plan (`--text-muted`): "About 70 minutes · 32 cards, 1 grammar point, 1 reading, 1 writing
  task, speaking practice."
- **Primary button**: full width on phone, 360 px min on desktop, 64 px tall, label "Start today's session"
  with a `play` icon on the right. If a session is in progress, the label becomes "Continue session · step 9 of 24".
- **Plan list** (not cards): each row has a 4 px left rule in the skill ink, the skill icon (in skill ink), the skill name
  (600 weight), detail in muted text, and minutes aligned right. A completed row shows a `check` in success colour and the text
  turns `--text-muted`. Rows are 56 px tall and tappable, so the user can jump to a part, but they look secondary. Use a hairline between rows,
  not boxes.
- **This week strip**: 7 circles (28 px) labelled M T W T F S S. A studied day is filled with `--accent`, today has a ring,
  and a rest day shows the `moon` icon in faint ink. Caption: "5 of 7 days this week · 2 rest days allowed". There's no
  flame and no big streak number.
- Optional quiet footer link: "Review mistakes from yesterday (6)".

### 4.3 Session step screen (generic)

Layout is a single column: max 720 px wide on desktop, 16 px gutters on phone.
1. **Top bar** (56 px): an ✕ icon button on the left, then a thin progress bar (8 px, radius-full, `--border` track, `--primary`
   fill, width animated 180 ms), then the step count "7 / 24" on the right in tabular numbers. Below it, the section label in skill ink:
   `[icon] GRAMMAR · Present perfect vs past simple`.
2. **Prompt** (`--fs-lg`, 600 weight): the instruction is short ("Choose the correct form."). Then the item
   (`--fs-md`/`--fs-lg`), with the gap shown as a 3-character underline `____`.
3. **Options**: a vertical stack and never a grid on phone. Each option is ≥56 px tall, full width, and has a 2 px
   `--border-strong` border, radius-md, a `--surface` bg and 18 px text. A key hint ("1", "2"…) sits on the left as a small
   muted chip on desktop only. States:
   - hover: `--surface-sunken` bg
   - selected: `--primary-soft` bg, `--primary` 2 px border, and a check-circle icon
   - correct (after Check): `--success-soft` bg, `--success` border, a `check` icon and the label "Correct"
   - incorrect: `--error-soft` bg, `--error` border, and an `x` icon. The correct option is also marked as correct.
   - Colour is **never the only signal**. There's always an icon and a word.
4. **Feedback panel**: appears inline *directly under the options*, not as a bottom sheet over the thumb area.
   It has radius-lg, a soft success or error bg, and a 4 px left rule. Content: a headline ("Not quite" or "Correct"), then
   "Answer: **have lived**", then a one-line reason, then an optional "Why?" disclosure for more detail. Focus moves to the
   panel heading, with `aria-live="polite"`.
5. **Primary button**, pinned to the bottom on phone (sticky, with a `--bg` gradient-free backdrop and 16 px padding)
   and inline below the content on desktop. The single button changes label: **Check**, then **Continue**. It is disabled
   (40% opacity plus `aria-disabled`, still focusable) until an option is chosen. Enter triggers it.
6. Secondary actions are text buttons only: "Show hint", "Skip", "Play again".

Keyboard (laptop): 1–9 select an option · Enter = Check/Continue · Esc = Close (with confirmation) · R = replay audio.

### 4.4 Flashcard

- The card has `--surface`, radius-lg, `--shadow-2` and a min-height of 40 vh, and is centred. A 4 px **top** rule in Words violet
  is the only colour on it.
- Front: the word (`--fs-2xl` on phone, `--fs-3xl` on desktop, 700 weight), IPA under it in mono and muted text, and an audio
  icon button. Back: the meaning, then one or two example sentences in italic with the word in bold, then collocations as a plain
  comma list (not tag pills).
- "Show answer" is the primary button, full width and 64 px. Space bar triggers it.
- **Grading row:** 4 buttons in one row on phone (each ≥ 25% width × 64 px; at XL text they wrap to 2×2).
  Labels are **Again · Hard · Good · Easy**, with the next interval underneath in 14 px muted text ("1 m", "6 m", "1 d", "4 d").
  Style: all are outline buttons with neutral ink, except **Good, which is filled teal** (it is the expected answer, so
  still one primary). Again has an error-coloured 2 px top rule and Easy a success-coloured one. There's no red or green
  fill. Shortcuts are 1–4.
- The flip is a 180 ms cross-fade (not a 3D rotate), and it is instant with reduced motion.
- Keep large buttons always available. AnkiDroid users missed them [10].

### 4.5 Grammar blocks

- **Explanation text**: reading measure (65ch) at `--fs-md`/1.6. Examples are indented, with the target form in
  `<mark>` styled as `--accent-soft` bg and `--accent-strong` text, not yellow.
- **Rule box**: `--surface` with a 1 px `--border`, radius-lg, and a 4 px left rule in Grammar blue. An overline
  "RULE" in Grammar blue, then the rule text.
- **Notice ("Watch out")** block: `--accent-soft` bg, a 4 px `--accent` left rule, an `alert-triangle` icon
  and the heading "Watch out". Use it for common learner errors ("Not: *I am living here since 2010*").
  Wrong examples get a `line-through` plus an `x` icon. Right examples get a `check` icon.
- **Compare block** (e.g. Present perfect | Past simple): two columns on desktop (≥720 px) that stack on phone.
  Each column has a header in 600 weight with a small skill-ink underline, then **Use**, **Form** and **Example** rows aligned
  across columns. A table with `<th scope>` is acceptable and preferred for screen readers. The column backgrounds
  stay neutral, with a vertical hairline between them.

### 4.6 Reading, listening, writing, speaking (brief)

- **Reading:** passage at 65ch, `--fs-md`, line-height 1.7, with optional paragraph numbers in the margin (desktop).
  On phone, questions appear after the passage with a sticky "Back to text" link. On desktop, the passage is on the left and the questions sit in a sticky right column at ≥1200 px only.
- **Listening:** one large circular play/pause control (72 px, teal) with replay −5 s / +5 s buttons, a speed
  control (0.75× / 1× / 1.25×) as a segmented control, and a simple bar for the waveform. The transcript stays hidden until the
  questions are answered (redundancy principle).
- **Writing:** a plain textarea on `--surface` with a 2 px border-strong, 18 px text and 1.7 line-height. A word count
  and timer sit in a quiet footer row ("184 words · 23:10 left"). The timer turns `--warning` in the last 2 minutes and never
  flashes. There's a "Hide timer" toggle.
- **Speaking:** a large record button (80 px, `--error` ring when recording, a `mic`/`square` icon plus the text
  "Recording… 0:42"). After recording, the user sees playback, a "Record again" text button and the primary "Continue".

### 4.7 Progress page

- **Headline numbers** in a row of 3 (stacking on phone), in `--fs-2xl` tabular numbers with a 16 px label below and no boxes:
  "41 study days" · "52 h total" · "1 840 words learned".
- **Calendar heatmap** (last 12 weeks): 14 px squares with 4 px gaps. Teal is used in 4 steps of opacity on `--border`.
  Every cell has a `title`/`aria-label`, and a text summary goes beneath it.
- **Skill bars**: one row per skill with the skill-ink label, a horizontal bar (skill ink on `--border` track,
  12 px) and "Band ≈ 6.5 · target 7.5" in muted text. Avoid radar charts because they are hard to read.
- **Mistakes to review**: a list of top recurring errors that links into a review session.
- **Week view**: the same week strip as Home. Don't show "you broke your streak" messaging.
- Charts are hand-rolled inline SVG (no charting library). Never use colour alone, and always add a text value.

### 4.8 Settings

- Grouped list on `--surface` with section headings (overline style). Each row is 56 px tall, with the label on the left and the
  control on the right.
- Settings: **Text size** (S/M/L/XL segmented, with a live preview sentence) · **Theme** (System/Light/Dark) ·
  **High contrast** (toggle) · **Reduce motion** (System/On) · **Daily goal** (minutes) · **Rest days per
  week** (0–3) · **Sound effects** (toggle, off by default) · **Keyboard shortcuts** (view) · **Data**
  (Export / Import / Reset progress, where Reset is a text button in error ink with a confirmation dialog).
- Toggles are 52×32 px with a 3:1 border and an on-state that has teal fill **and** a check glyph in the thumb.

### 4.9 Buttons (shared)

| Variant | Style | Use |
|---|---|---|
| Primary | `--primary` bg, `--on-primary` text, 600 weight, radius-md, 56 px (48 min), no shadow | Exactly one per screen |
| Secondary | `--surface` bg, 2 px `--border-strong`, `--text` | Alternative actions |
| Quiet | no bg, `--primary-strong` text, underline on hover | Skip, hint, links |
| Danger | quiet style in `--error` | Reset |
| Focus (all) | `outline: 3px solid var(--focus); outline-offset: 2px` | `:focus-visible` |

---

## 5. Wireframes

### 5.1 Home — phone (≈ 390 px)

```
┌──────────────────────────────────────┐
│ SUNDAY 16 NOVEMBER                   │  overline, faint
│ Good morning, Ati                    │  28px bold
│ About 70 min · 32 cards, 1 grammar,  │  muted
│ 1 reading, writing, speaking         │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │   Start today's session      ▶   │ │  64px, teal fill (the ONE action)
│ └──────────────────────────────────┘ │
│                                      │
│ Today's plan                         │  22px semibold
│ ┃ ◫ Words      32 cards       15 min │  violet rule + line icon
│ ─────────────────────────────────────│
│ ┃ ¶ Grammar    Present perfect 10 min│  blue rule
│ ─────────────────────────────────────│
│ ┃ ▢ Reading    IELTS passage  20 min │  teal rule
│ ─────────────────────────────────────│
│ ┃ ✎ Writing    Task 1 letter  20 min │  terracotta rule
│ ─────────────────────────────────────│
│ ┃ ◉ Speaking   Part 2 cue     5 min  │  rose rule
│                                      │
│ This week                            │
│  M   T   W   T   F   S   S           │
│  ●   ●   ●   ☾   ●   ◎   ○           │  ● studied (terracotta) ◎ today
│ 4 of 7 days · rest days are fine     │
├──────────────────────────────────────┤
│  ☀ Today  ◫ Practice  ⌁ Progress  ⚙  │  bottom bar, icon + label
└──────────────────────────────────────┘
(glyphs above stand for Lucide line icons, NOT emoji)
```

### 5.2 Home — desktop (≈ 1280 px)

```
┌────────────────┬───────────────────────────────────────────────────────────┐
│ ● Fluent365    │                                                           │
│                │   SUNDAY 16 NOVEMBER                                      │
│ ▌☀ Today       │   Good morning, Ati                                       │
│  ◫ Words       │   About 70 minutes · 32 cards, 1 grammar point, 1 reading │
│  ¶ Grammar     │                                                           │
│  ▢ Reading     │   ┌───────────────────────────────┐                       │
│  ♫ Listening   │   │  Start today's session    ▶   │   Enter ↵             │
│  ✎ Writing     │   └───────────────────────────────┘                       │
│  ◉ Speaking    │                                                           │
│  ───────────   │   Today's plan                              This week     │
│  ⌁ Progress    │   ┃ Words     32 cards due        15 min    M T W T F S S │
│  ⚙ Settings    │   ┃ Grammar   Present perfect     10 min    ● ● ● ☾ ● ◎ ○ │
│                │   ┃ Reading   Academic passage 3  20 min    4 of 7 days   │
│ (sunken bg,    │   ┃ Writing   Task 1 letter       20 min                  │
│  dimmed ink)   │   ┃ Speaking  Part 2 cue card      5 min    Review 6      │
│                │                                             mistakes →    │
└────────────────┴───────────────────────────────────────────────────────────┘
 sidebar 248px          content max-width 760px, plan list left, week aside right
```

### 5.3 Session step — phone (grammar question, after a wrong answer)

```
┌──────────────────────────────────────┐
│ ✕   ▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱      7 / 24  │  thin teal progress
│ ¶ GRAMMAR · Present perfect          │  blue ink label
│                                      │
│ Choose the correct form.             │  22px semibold
│                                      │
│ I ____ in Cairo since 2015.          │  18–22px
│                                      │
│ ┌──────────────────────────────────┐ │
│ │ ✕  lived                         │ │  error-soft, red border + icon
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ ✓  have lived          Correct   │ │  success-soft, green border + icon
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │    am living                     │ │  neutral, 56px
│ └──────────────────────────────────┘ │
│                                      │
│ ┃ Not quite                          │  feedback panel, inline, under
│ ┃ Answer: have lived                 │  options (not over the thumb)
│ ┃ "since + point in time" → present  │
│ ┃ perfect: the action continues now. │
│ ┃ Why? ▾                             │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │            Continue              │ │  sticky, 56–64px, teal
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

### 5.4 Flashcard — desktop

```
        ✕   ▰▰▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱   12 / 32
        ◫ WORDS · review
        ┌──────────────────────────────────────────────┐ ← 4px violet top rule
        │                                              │
        │                 meticulous                   │ 48px bold
        │               /məˈtɪk.jə.ləs/   [volume-2]
        │  ──────────────────────────────────────────  │
        │  very careful and paying attention to detail │
        │  "She kept *meticulous* records of spending."│ italic, word bold
        │  meticulous planning, meticulous attention   │
        └──────────────────────────────────────────────┘
        ┌──────────┐ ┌──────────┐ ┏━━━━━━━━━━┓ ┌──────────┐
        │  Again   │ │   Hard   │ ┃   Good   ┃ │   Easy   │  64px; Good = teal fill
        │   1 m    │ │   6 m    │ ┃   1 d    ┃ │   4 d    │  keys 1·2·3·4
        └──────────┘ └──────────┘ ┗━━━━━━━━━━┛ └──────────┘
```

---

## 6. CSS skeleton (drop-in starting point)

```css
@font-face {
  font-family: "Atkinson Hyperlegible Next";
  src: url("/fonts/AtkinsonHyperlegibleNext-Regular.woff2") format("woff2");
  font-weight: 400; font-style: normal; font-display: swap;
}
/* …600, 700, 400 italic likewise; add all to SW precache */

:root {
  color-scheme: light;
  --text-scale: 1;
  --font: "Atkinson Hyperlegible Next","Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans",sans-serif;
  --mono: ui-monospace,"DejaVu Sans Mono",Menlo,Consolas,monospace;
  --bg:#FAF8F4; --surface:#FFFFFF; --surface-sunken:#F3F0EA;
  --border:#E4DFD6; --border-strong:#8C857A;
  --text:#1C1B19; --text-muted:#4F4B45; --text-faint:#6B665D;
  --primary:#0D6660; --primary-strong:#09504B; --on-primary:#FFFFFF; --primary-soft:#E2F0EE;
  --accent:#A8441C; --accent-strong:#8A3615; --accent-soft:#FBE9DF;
  --success:#1E6B3A; --success-soft:#E4F2E8;
  --error:#B3261E; --error-strong:#9A1F18; --error-soft:#FBE8E6;
  --warning:#7A5000; --warning-soft:#FCF0D6;
  --focus:#2453C7;
  --sk-words:#6A3EA1; --sk-grammar:#2257A6; --sk-reading:#0D6660;
  --sk-listening:#7A5000; --sk-writing:#A8441C; --sk-speaking:#A3325A;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { /* dark block below */ } }
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg:#141311; --surface:#1D1C19; --surface-raised:#262420; --surface-sunken:#100F0E;
  --border:#34312C; --border-strong:#7D776C;
  --text:#EEEBE5; --text-muted:#BDB7AC; --text-faint:#A09A8F;
  --primary:#5CC2B7; --primary-strong:#8FDCD3; --on-primary:#08201D; --primary-soft:#16302D;
  --accent:#F0916A; --accent-strong:#F5AE8F; --accent-soft:#3A2219;
  --success:#74D196; --success-soft:#16301F;
  --error:#FF8F86; --error-strong:#FFB0A9; --error-soft:#3A1A18;
  --warning:#EDC062; --warning-soft:#33290F;
  --focus:#8FB0FF;
  --sk-words:#C3A6F0; --sk-grammar:#8DB5F2; --sk-reading:#5CC2B7;
  --sk-listening:#EDC062; --sk-writing:#F0916A; --sk-speaking:#F29BBC;
}
html { font-size: calc(100% * var(--text-scale)); }
body { margin:0; background:var(--bg); color:var(--text); font:400 1.125rem/1.6 var(--font);
       -webkit-font-smoothing:antialiased; }
:focus-visible { outline:3px solid var(--focus); outline-offset:2px; }
.btn-primary { min-height:56px; padding:0 24px; border:0; border-radius:10px;
  background:var(--primary); color:var(--on-primary); font:600 1.125rem/1 var(--font); }
.btn-primary:hover { background:var(--primary-strong); }
.option { min-height:56px; width:100%; text-align:left; padding:12px 16px; border-radius:10px;
  border:2px solid var(--border-strong); background:var(--surface); color:var(--text); font:inherit; }
.option[aria-checked="true"] { background:var(--primary-soft); border-color:var(--primary); }
.skill-rule { border-left:4px solid var(--skill, var(--border)); padding-left:12px; }
@media (prefers-reduced-motion: reduce) { *,*::before,*::after { transition:none!important; animation:none!important; } }
```
(Duplicate the dark block inside the media query in the real file. It's abbreviated above.)

---

## 7. What to avoid (ranked by harm to this product)

1. **Emoji as icons or decoration.** The owner explicitly rejected it. It renders differently on Android and Linux, reads
   as childish and adds visual noise. Use Lucide line icons with labels.
2. **More than one primary (filled) button per screen**, or anything else competing with "Start today's session" /
   "Next". It breaks the core guided UX and confuses the 80-year-old user.
3. **Right/wrong-only feedback.** It has an effect size of about 0.05 versus 0.49 for an explanation [20]. Always show answer + reason.
4. **Small text and low-contrast grey** (e.g. #999 on white = 2.8:1), light font weights, and targets under 48 px.
   These are the main documented older-adult failures [26][29].
5. **Stress mechanics**: streak flames, countdowns, "you'll lose your streak!" notifications, leagues and
   leaderboards. Adults resent them, and they reward app opens rather than learning [2][22].
6. **Colour as the only signal** (red and green options without an icon or word). This fails colour-blind users and WCAG 1.4.1.
7. **Dashboard-of-cards layout**: a grid of same-sized boxes, each with a coloured header. It flattens hierarchy, and it is what
   the owner called "boring". Use lists, rules and type hierarchy instead.
8. **Pastel tag soup, gradient covers, coloured icon tiles** (the rejected Notion look). Linear removed
   icon backgrounds for the same reason [15].
9. **Mascots, illustrations, confetti, bouncy animations and sound by default** in sessions. They add extraneous load
   (coherence principle) and look childish [1][18].
10. **Feedback far from the answer** (top toasts, bottom sheets covering options). It splits attention, and
    AnkiDroid users complained about exactly this [10].
11. **Pure black dark mode with pure white text** (halation), or dark as the default. Light performs better for reading
    [34].
12. **Runtime web fonts / CDNs**. They break offline-first behaviour and leak privacy. Self-host and precache.
13. **Heavy UI kits or animation libraries** (MUI, Framer Motion). They're unnecessary for this design and hurt startup on
    low-end Android.
14. **Radar charts, 3D flips and parallax.** They're hard to read, cause motion sickness and add nothing.

---

## 8. Sources (all accessed 2026-11-16)

1. Duolingo review (MezzoGuild) — https://www.mezzoguild.com/duolingo-review
2. Unstar, "Duolingo, Babbel, Rosetta Stone, Busuu, Memrise ranked 2026" — https://unstar.app/blog/duolingo-babbel-rosetta-stone-busuu-memrise-language-learning-apps-ranked-2026 ; and "Language learning app reviews 2026" — https://unstar.app/blog/language-learning-app-reviews-duolingo-babbel-rosetta-stone-2026
3. Trustpilot Duolingo reviews — https://www.trustpilot.com/review/duolingo.com?page=7 ; Capterra — https://www.capterra.com/p/210401/Duolingo-for-Schools/reviews/?page=4
4. Busuu vs Babbel comparison — https://englishintake.com/busuu-vs-babbel
5. Busuu review — https://www.studyfrenchspanish.com/busuu-review
6. Uxcel heuristic evaluation of Babbel — https://app.uxcel.com/showcase/heuristic-evaluation-babbel-language-learning-app-134
7. Languatalk, Praktika review — https://languatalk.com/blog/praktika-review/
8. AnkiDroid 2025 wrapped — https://opencollective.com/ankidroid/updates/ankidroid-2025-wrapped
9. AnkiDroid 2.24.0 changelog — https://forums.ankiweb.net/t/ankidroid-2-24-0-changelog/69614
10. AnkiDroid "New study screen [Official thread]" — https://forums.ankiweb.net/t/new-study-screen-official-thread/67394
11. ustwo × Brilliant case study — https://ustwo.com/work/brilliant
12. Brilliant App Store listing — https://apps.apple.com/ch/app/id913335252
13. Readwise WiseUp Vol. 10 (focus mode) — https://wiseup.readwise.io/wiseup-vol-10-drop-into-flow-with-focus-mode-translate-quotes-and-more/
14. Readwise Reader design study — https://blakecrosley.com/guides/design/readwise-reader
15. Linear, "Behind the latest design refresh" — https://linear.app/blog/behind-the-latest-design-refresh ; changelog — https://linear.app/changelog/2026-03-12-ui-refresh
16. The Sweet Setup on Things 3 — https://thesweetsetup.com/?p=13175
17. Things design study — https://blakecrosley.com/blog/design-study-things
18. Cambridge Handbook of Multimedia Learning, split-attention principle — https://cambridge.org/core/books/cambridge-handbook-of-multimedia-learning/splitattention-principle-in-multimedia-learning/BB73E51FE9D82949C143ED4879A11C0C
19. EdTech Books, Cognitive theory of multimedia learning — https://edtechbooks.org/design_psychology/CTML
20. Van der Kleij, Feskens & Eggen (2015), Review of Educational Research 85(4), doi:10.3102/0034654314564881 — summary https://research.utwente.nl/en/publications/effects-of-feedback-in-a-computer-based-assessment-for-learning/
21. Research on feedback in learning (summary) — https://djplaner.github.io/memex/sense/Learning/learning-research/research-feedback/
22. Mobbin, "Streaks are about losing: a study of 859 streak designs" — https://mobbin.com/blog/streaks-are-about-losing-a-study-of-859-streak-designs
23. INSEAD Knowledge, "Consumer streaks are motivating — the key is keeping them alive" — https://knowledge.insead.edu/marketing/consumer-streaks-are-motivating-key-keeping-them-alive
24. CU Boulder (Barasch) on broken streaks — https://www.colorado.edu/business/node/17581
25. Duolingo blog, "How the Duolingo streak builds habit" — https://blog.duolingo.com/how-duolingo-streak-builds-habit
26. NN/g, "UX Design for Seniors" report — https://www.nngroup.com/reports/senior-citizens-on-the-web/ ; https://www.nngroup.com/articles/usability-seniors-improvements/
27. NN/g, "Why design for older adults?" — https://www.nngroup.com/alertbox/seniors.html
28. JMIR systematic review, mobile UI for adults 60+ — https://preprints.jmir.org/preprint/43186/accepted
29. Guide to interface design for older adults — https://adchitects.co/blog/guide-to-interface-design-for-older-adults ; Smashing Magazine — https://www.smashingmagazine.com/2015/02/designing-digital-technology-for-the-elderly/
30. GOV.UK WCAG primer 2.5.8 — https://alphagov.github.io/wcag-primer/sc/2.5.8.html
31. TetraLogical, "What's new in WCAG 2.2" — https://tetralogical.com/blog/2023/10/05/whats-new-wcag-2.2
32. W3C Understanding 1.4.6 Contrast (Enhanced) — https://w3c.github.io/wcag/understanding/contrast-enhanced.html
33. WebAIM contrast — https://webaim.org/articles/contrast/ ; W3C 1.4.3 — https://www.w3.org/wai/wcag22/understanding/contrast-minimum.html
34. Piepenbrock et al. (2013), Ergonomics, positive polarity advantage across age — https://informahealthcare.com/doi/abs/10.1080/00140139.2013.790485 ; TidBITS summary — https://tidbits.com/2019/05/31/the-dark-side-of-dark-mode/
35. web.dev, Optimize web fonts — https://web.dev/learn/performance/optimize-web-fonts
36. Self-hosting web font files — https://rebeccamdeprey.com/blog/self-hosting-web-font-files
37. googlefonts/atkinson-hyperlegible-next (OFL-1.1, 6 weights + italics) — https://github.com/googlefonts/atkinson-hyperlegible-next
38. Atkinson Hyperlegible (Wikipedia) — https://en.wikipedia.org/wiki/Atkinson_Hyperlegible
39. Lucide repository (ISC) — https://github.com/lucide-icons/lucide ; licence clarification (Feather MIT notice) — https://github.com/lucide-icons/lucide/discussions/4236
40. Phosphor vs Lucide comparison — https://www.allsvgicons.com/compare/phosphor-vs-lucide/

Caveats: several app-quality claims come from reviews and editorial analyses rather than controlled studies. The
Duolingo-internal numbers (e.g. +40% 7-day streaks) are company-reported, via Mobbin. Verify the exact Fontsource
package name and variable-axis availability for Atkinson Hyperlegible Next when you install it. Contrast ratios
in §3.3 were computed locally with the WCAG relative-luminance formula. Re-check them if you change any hex value.

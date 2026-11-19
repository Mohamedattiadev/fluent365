# Fluent365 --- Full Product & Development Plan

**Document status:** Product requirements and implementation plan\
**Project type:** Public, open-source, reusable English-learning
platform\
**Primary learning goal for the original installation:** B1 to IELTS
General Training 7.5+ over 365 days\
**Primary platforms:** Linux desktop/local web app and Android-friendly
GitHub Pages Pocket PWA\
**Initial budget target:** Up to ₺500/month for the original
installation\
**Core principle:** Build the platform once so anyone can create and run
their own independent Fluent365 installation.

------------------------------------------------------------------------

## 1. Product vision

Fluent365 is a personal, adaptive English-learning system that helps
learners improve grammar, vocabulary, reading, listening, writing and
speaking through structured daily practice.

It has two connected but independently usable products:

1.  **Fluent365 Local** --- a local-first application for a computer. It
    manages a learner's complete study system, private library, detailed
    progress, assessments and recommendations.
2.  **Fluent365 Pocket** --- a lightweight, installable Progressive Web
    App (PWA) that anyone can deploy to their own GitHub Pages site. It
    provides mobile access to approved public learning content and
    stores the learner's personal review progress on their device.

The public repository is the reusable product. The original developer's
learning profile, books, notes and progress are only one private
installation of it.

### Product principles

-   Public source code; private personal learning data.
-   Local-first operation; no mandatory account or cloud service.
-   Fast, predictable and usable on modest hardware and mobile devices.
-   Simple enough for a non-technical learner, including an older adult.
-   Grammar learning prioritises intuition and natural sentence
    production, not only memorising rules.
-   Progress reflects meaningful learning activity, not time spent with
    a page open.
-   Build a working MVP early; add breadth only after the core learning
    loop works.
-   Never overwrite or destroy existing projects during initial
    inspection.
-   Keep operating costs low and do not require a paid AI API.

------------------------------------------------------------------------

## 2. Who the product serves

The architecture must support many independent learners, not only the
original developer.

A user may choose: - General English improvement. - Grammar
foundations. - Vocabulary development. - Reading improvement. -
Listening improvement. - Writing improvement. - Speaking improvement. -
IELTS Academic preparation. - IELTS General Training preparation. -
Other future exam or proficiency pathways.

The initial curriculum and content should prioritise B1-to-advanced
English and IELTS General Training, but the product must not hardcode
that profile as the only possible learner journey.

### First-time learner setup

Provide a short, optional setup wizard. Ask for: - Display name
(optional). - Current English level. - Target level. - IELTS target and
exam type (optional). - Native language (optional). - Preferred
explanation language. - Daily study time. - Learning priorities. -
Preferred text size. - Light/dark theme. - Accessibility or comfortable
mode.

Allow users to skip optional questions and change settings later. Do not
require registration.

------------------------------------------------------------------------

## 3. Two products and how they work together

### 3.1 Fluent365 Local

The local application is the complete personal learning environment.

It should provide: - Dashboard and daily plan. - Grammar curriculum and
grammar-instinct trainer. - Vocabulary search and spaced-repetition
cards. - Expressions, collocations and phrasal verbs. - Personal book
library and reading plans. - Listening, writing and speaking practice. -
IELTS practice and assessments. - Mistake notebook. - Learning history,
progress and recommendations. - Local backups and restore.

Private data stays on the user's machine unless the user explicitly
exports or shares it.

### 3.2 Fluent365 Pocket

Pocket is a static, installable PWA designed for phones and quick
revision.

It should provide: - Grammar lessons and exercises. - Common words and
expressions. - Collocations and phrasal verbs. - Flashcards and daily
review. - Search and filters. - Offline access after content is
cached. - Local progress and review scheduling. - Import/export of
personal progress as JSON.

Pocket must be independently useful. It must not require the Local
application to be running.

### 3.3 Relationship between Local and Pocket

Both products may share: - Public curriculum definitions. - Approved
public vocabulary datasets. - Grammar explanations and examples. -
Exercise definitions. - Shared types and validation rules. - Visual
design tokens and selected reusable UI components.

They must not share a live database by default.

Local uses its own SQLite database. Pocket uses browser storage,
primarily IndexedDB. A static GitHub Pages website cannot directly
connect to a user's local SQLite database. Any future cross-device sync
requires a separately designed, opt-in service or a deliberate
export/import workflow.

------------------------------------------------------------------------

## 4. Public open-source distribution --- essential requirement

Fluent365 must be developed as a public, reusable, open-source platform.
It must not be a single-user application that only works for its
original creator.

### 4.1 Public repository

The public GitHub repository may contain: - Local application source
code. - Pocket PWA source code. - Shared libraries and components. -
Database schema and migrations. - Public learning curriculum. - Public
vocabulary and grammar datasets with verified licences. - Installation
and deployment scripts. - GitHub Actions workflows. - Tests and
documentation. - Example configuration with no secrets or personal data.

It must never contain: - Personal book files. - Private notes or
writing. - Personal learner profile. - Study history or assessment
results. - Private vocabulary annotations. - Local database files or
backups. - Personal recordings. - Credentials, tokens or API keys.

### 4.2 GitHub template workflow

Configure the repository as a GitHub Template Repository.

A new user should be able to:

1.  Open the public Fluent365 repository.
2.  Select **Use this template**.
3.  Create their own repository under their GitHub account.
4.  Set the required repository settings.
5.  Enable GitHub Pages or use the provided deployment workflow.
6.  Wait for GitHub Actions to build and publish Pocket.
7.  Open their own Pocket URL on a phone.
8.  Install it as a PWA where supported.

Provide a manual deployment path as well as the template workflow.
Explain that users may need to enable GitHub Pages and grant the
repository's Actions workflow permission to publish.

### 4.3 Independent deployments

Every user's deployment must work with: - Different GitHub usernames. -
Different repository names. - Different repository base paths. - A
custom domain, if they choose to configure one.

Do not hardcode the original developer's GitHub username, repository
URL, deployment URL or domain.

Configure the frontend build base path correctly for GitHub Pages. Test
both a project site under `/repository-name/` and a root/custom-domain
deployment.

### 4.4 Multiple independent learners

Every installation must have independent: - Learner settings. - Local
database or browser storage. - Grammar mastery. - Vocabulary cards and
review history. - FSRS scheduling state. - Reading library and reading
history. - Mistake notebook. - Assessment results. - Learning
analytics. - Backups.

No user should be able to read another user's private data through the
standard application.

### 4.5 Licensing and contribution

Before publication: - Select an appropriate open-source software
licence. - Decide separately how public educational content is
licensed. - Check licences for dependencies and datasets. - Provide
attribution where required. - Do not redistribute copyrighted book
content without permission. - Add `CONTRIBUTING.md`, issue templates and
pull-request guidance. - Add a versioning and release policy. - Document
how users can report security or privacy issues.

Do not assume that a dataset is reusable merely because it is publicly
downloadable.

------------------------------------------------------------------------

## 5. User experience and accessibility

The interface must be extremely easy to understand.

### 5.1 Navigation

Keep the main navigation short and predictable: - Home - Grammar -
Vocabulary - Reading - Practice - Progress - Settings

Additional areas such as IELTS, My Books, Listening, Writing and
Speaking can appear within Practice or as clearly grouped subpages.
Avoid a crowded navigation bar.

### 5.2 Accessibility requirements

-   Large, readable default text.
-   Large touch targets and buttons.
-   Strong text/background contrast.
-   Clear labels; avoid icon-only controls for important actions.
-   Consistent navigation and terminology.
-   Keyboard accessibility.
-   Screen-reader labels where appropriate.
-   Responsive layout for phone, tablet and desktop.
-   Adjustable text size.
-   Reduced-motion support.
-   Comfortable mode with less visual density.
-   Focus mode with one task at a time.
-   Clear success, error and empty states.
-   No unnecessary animation, popups or distracting gamification.

The product should be comfortable for an 80-year-old beginner to
navigate.

### 5.3 Interaction principles

-   One obvious primary action per screen.
-   Avoid unnecessary configuration before a learner can start.
-   Save progress automatically where safe.
-   Confirm destructive actions such as deleting a library or resetting
    progress.
-   Explain unfamiliar learning terms in plain language.
-   Make it easy to resume the last activity.

------------------------------------------------------------------------

## 6. Grammar-first learning system

Grammar is the most important learning area. The goal is grammatical
intuition: the learner should increasingly recognise and produce natural
English without consciously recalling a rule every time.

### 6.1 Grammar Instinct Trainer

Use a repeated learning cycle:

1.  **Notice** --- see a short, natural example.
2.  **Compare** --- compare two similar sentences.
3.  **Predict** --- anticipate the form that should come next.
4.  **Choose** --- select the natural or correct version.
5.  **Explain** --- receive a brief explanation of why it works.
6.  **Produce** --- construct a sentence independently.
7.  **Repeat** --- meet the pattern in varied contexts.
8.  **Recall** --- retrieve the pattern later without hints.
9.  **Apply** --- use it in reading, writing and IELTS-style tasks.

Do not teach grammar only as long rule pages followed by multiple-choice
tests.

### 6.2 Exercise types

Include: - Choose the sentence that sounds natural. - Compare two
sentence forms. - Fill a missing word or phrase. - Predict the next
grammatical form. - Find the unnatural sentence. - Correct an error. -
Build a sentence from blocks. - Rewrite a sentence naturally. - Change
tense, voice, condition or emphasis. - Produce a sentence from a
prompt. - Explain the difference between two forms. - Apply a grammar
pattern in a short paragraph.

Provide feedback that explains the pattern and gives another example.
Avoid feedback that only says "wrong".

### 6.3 Mastery stages

Track each grammar concept across separate dimensions: - Recognition. -
Understanding. - Controlled practice. - Independent production. -
Automaticity / fluent use.

A learner may recognise a form but still struggle to produce it. Do not
collapse these into one simplistic percentage.

### 6.4 Curriculum

Build a structured progression from foundational to advanced grammar,
including:

**Foundations** - Word classes and sentence structure. - Subject and
verb agreement. - Articles and determiners. - Singular/plural nouns and
countability. - Pronouns and possessives. - Present simple and present
continuous. - Past simple and past continuous. - Future forms. - Basic
questions and negatives. - Prepositions of time and place. - Adjectives
and adverbs. - Comparatives and superlatives.

**Intermediate** - Present perfect and present perfect continuous. -
Past perfect. - Future continuous and future perfect. - Modal verbs and
degrees of certainty. - Gerunds and infinitives. - Verb patterns. -
Passive voice. - Relative clauses. - Conditionals. - Reported speech. -
Question tags. - Linking clauses and conjunctions. - Quantifiers. -
Phrasal and prepositional verb grammar.

**Upper-intermediate and advanced** - Mixed and inverted conditionals. -
Advanced passive structures. - Cleft sentences and emphasis. -
Participle clauses. - Reduced relative clauses. - Substitution and
ellipsis. - Hedging and stance. - Complex noun phrases. - Cohesion and
reference. - Register and formality. - Complex sentence punctuation. -
Natural word order and information focus.

Teach each topic through recognition, controlled practice, production
and later retrieval.

### 6.5 Grammar mistake notebook

Record: - Concept. - Exercise type. - Learner's response. - Expected
response. - Error category. - Date and context. - Whether the learner
later corrected it. - Subsequent performance.

Use repeated error patterns to recommend focused practice. Avoid storing
unnecessary sensitive information.

------------------------------------------------------------------------

## 7. Vocabulary and expressions

### 7.1 Vocabulary collections

Provide organised, searchable collections: - High-frequency everyday
words. - Common 1,000 / 2,000 / 3,000 / 5,000 word bands where licensing
permits. - CEFR-level vocabulary. - Academic vocabulary, including
appropriately licensed Academic Word List resources. - IELTS
vocabulary. - Topic-based vocabulary. - Collocations. - Phrasal verbs. -
Idioms and common expressions. - Linking words and discourse markers. -
Formal and informal alternatives. - Word families and common
derivations.

Clearly identify source, level, part of speech and licence/attribution
requirements.

### 7.2 Vocabulary card fields

Where available, a card may include: - Headword. - Pronunciation and
audio reference. - Part of speech. - Simple definition. - Explanation in
the learner's preferred language. - Example sentence. - Common
collocations. - Related word forms. - Synonyms and antonyms. -
Register. - CEFR or topic tags. - Source attribution.

Do not invent definitions or imply that a word has only one meaning.

### 7.3 Spaced repetition

Use a recognised FSRS implementation rather than arbitrary fixed review
intervals.

Support: - Again. - Hard. - Good. - Easy.

Store review history and scheduling state. Make the next review queue
responsive to the learner's actual workload.

Start with approximately 10--15 new words per day as a configurable
suggestion, but reduce or pause new cards when the review queue becomes
too large.

### 7.4 Search and filters

Search should support: - Word or phrase. - Meaning. - Level. - Topic. -
Part of speech. - Collocation. - Phrasal verb. - Saved cards. -
Difficult cards.

Search must remain responsive on the intended dataset size.

------------------------------------------------------------------------

## 8. Personal book library and reading programme

The Local application should scan and organise the user's own collection
of approximately 100 books.

### 8.1 Supported formats

Initial support: - PDF. - EPUB. - DOCX. - TXT.

Scanned PDFs may require OCR. OCR should be optional and processed in
the background because it can be slow.

### 8.2 Library analysis

For each book, where extraction is possible: - Title and author. -
Format and file size. - Language. - Chapter and heading structure. -
Approximate word count. - Reading difficulty estimate. - Duplicate
detection. - Text extraction status. - Whether OCR may be needed.

Clearly label estimates. Do not pretend that automated difficulty
scoring is exact.

### 8.3 Reading recommendations

Recommend one to three books at a time based on: - Current English
level. - Reading difficulty. - Learner interests. - Available time. -
Reading history. - Vocabulary and grammar goals.

Do not overwhelm the learner with the entire library.

### 8.4 Reading plans and tracking

Support: - Yearly and weekly reading plans. - Chapter/page targets. -
Current reading position. - Completed chapters. - Reading sessions. -
Personal notes. - Vocabulary saved by the learner. - Optional
comprehension quizzes. - Optional summaries and discussion questions.

Do not automatically publish book text, extracts, notes or reading
history.

### 8.5 Copyright protection

Book files remain private on the local device. Do not upload, commit or
publish full books or substantial copyrighted extracts. Generated
summaries and learning questions should respect applicable copyright
rules and must not reconstruct the source text.

------------------------------------------------------------------------

## 9. Listening, writing, speaking and IELTS

These areas should be added after the core grammar, vocabulary and
tracking loop is reliable.

### Listening

-   Short listening activities.
-   Comprehension questions.
-   Transcript reveal after an attempt.
-   Vocabulary capture.
-   Repeat and review.
-   Difficulty and speed settings.

### Writing

-   Sentence and paragraph practice.
-   Task 1 and Task 2 style prompts where appropriate.
-   Planning and outlining.
-   Cohesion and coherence exercises.
-   Grammar and vocabulary self-review.
-   Saved drafts and revision history.

Do not promise an official IELTS score from an unvalidated automated
assessment.

### Speaking

-   Speaking prompts.
-   Timed practice.
-   Personal recording stored locally where supported.
-   Self-assessment checklist.
-   Fluency, coherence, vocabulary and grammar practice.
-   Pronunciation practice only when a reliable method is available.

### IELTS General Training

Include: - Reading task practice. - Listening task practice. - General
Training writing tasks. - Speaking prompts. - Timed practice. - Exam
strategies. - Progress by skill and task type.

Keep practice scores distinct from official exam results.

------------------------------------------------------------------------

## 10. Genuine learning-time tracking and adaptive recommendations

The system must measure meaningful activity, not simply how long a tab
remains open.

### 10.1 Session tracking

Record: - Session start and end. - Page or activity visited. - Activity
type. - Meaningful exercise attempts. - Completed learning tasks. -
Review actions. - Assessment attempts. - Explicit breaks or pauses where
relevant.

### 10.2 Active-time rules

-   Pause active-time counting after approximately 60--90 seconds
    without meaningful activity.
-   Resume when the learner interacts with a learning task.
-   Do not count an idle browser tab as study.
-   Do not use invasive keystroke logging or detailed mouse
    surveillance.
-   Prefer explicit learning events such as answering, checking,
    reviewing, reading progress updates or completing an exercise.
-   Make tracking behaviour transparent and documented.

Active time is an estimate, not proof of attention. Describe it
honestly.

### 10.3 Assessments

Provide: - Daily short checks. - Weekly review. - Monthly progress
assessment. - Periodic grammar production tasks. - Vocabulary recall
tests. - Reading comprehension checks. - IELTS-style practice as the
learner progresses.

Assess understanding and independent production, not just recognition.

### 10.4 Recommendations

Use actual performance to recommend: - What to revise today. - Which
grammar concept needs more practice. - Which vocabulary cards are due. -
Whether to reduce new words. - Which reading book is appropriate. -
Which skill needs attention.

Recommendations should be explainable: tell the learner briefly why an
activity is suggested.

------------------------------------------------------------------------

## 11. The 365-day learning pathway

The initial personal pathway targets B1 to IELTS General Training 7.5+
over one year, with approximately 1--2 hours of study per day.

The calendar is a guide, not a guarantee. Progress must be based on
demonstrated mastery, not merely the day number.

  -----------------------------------------------------------------------
  Period                              Main focus
  ----------------------------------- -----------------------------------
  Days 1--60                          B1 foundations, sentence accuracy,
                                      core tenses, high-frequency
                                      vocabulary

  Days 61--120                        B1 to B2 development, complex
                                      sentences, verb patterns, reading
                                      fluency

  Days 121--180                       B2 consolidation, advanced grammar,
                                      collocations, longer reading

  Days 181--240                       IELTS introduction, task formats,
                                      listening and reading strategies

  Days 241--300                       IELTS skill development, timed
                                      practice, writing and speaking

  Days 301--365                       Full practice, error correction,
                                      targeted revision and exam
                                      readiness
  -----------------------------------------------------------------------

Each day should have a manageable plan, for example: - Grammar. -
Vocabulary review. - Reading. - Listening or writing/speaking. - Short
assessment.

The system should adapt the daily workload when the learner misses days
or has a large review queue. Do not force the learner to "catch up" with
an unrealistic backlog.

------------------------------------------------------------------------

## 12. Technical architecture

Choose a simple, maintainable architecture. Avoid unnecessary services
and dependencies.

### 12.1 Suggested technology

**Local frontend** - React. - TypeScript. - Vite. - A lightweight
component system. - Tailwind CSS if it helps maintain consistent
styling. - Accessible icon set.

**Local backend** - Python. - FastAPI. - Pydantic. - SQLAlchemy. -
Alembic migrations. - SQLite.

**Pocket** - React and TypeScript, or a shared frontend package where
this does not compromise performance. - Vite. - PWA support. - IndexedDB
for local data. - Static deployment to GitHub Pages.

**Testing** - Vitest for frontend logic. - Playwright for end-to-end
workflows. - Pytest for backend. - Automated build and deployment
checks.

**Spaced repetition** - A maintained FSRS library compatible with the
chosen frontend or backend architecture.

These are proposed choices, not a reason to rewrite an existing working
project. Inspect the existing repositories first and reuse suitable,
maintainable components.

### 12.2 No required AI API

The initial product must work without an Anthropic, OpenAI or other paid
runtime API.

Use: - Pre-prepared public learning content. - Deterministic
exercises. - Rule-based recommendations. - Local search and
scheduling. - Manual copy/paste handoff to an AI assistant as an
optional workflow.

A Claude subscription used with Claude Code does not automatically
provide an API endpoint or runtime model access for the finished
application. Do not build a dependency on an API key unless a user
deliberately configures one later.

### 12.3 Local security

-   Bind the local backend to localhost by default.
-   Do not expose the local API to a public network by default.
-   Validate imported files and input.
-   Use safe file handling.
-   Avoid executing imported content.
-   Keep secrets out of source control.
-   Document backup and restore.
-   Make data deletion and export understandable.

------------------------------------------------------------------------

## 13. Data model

Design the schema to support independent users and future learning
profiles without requiring a cloud account.

Suggested entities include:

-   `learner_settings`
-   `learning_sessions`
-   `activity_events`
-   `grammar_topics`
-   `grammar_exercises`
-   `grammar_attempts`
-   `grammar_mastery`
-   `learner_mistake_patterns`
-   `vocabulary_items`
-   `vocabulary_cards`
-   `review_history`
-   `daily_assessments`
-   `assessment_attempts`
-   `learning_recommendations`
-   `books`
-   `book_chapters`
-   `reading_sessions`
-   `reading_progress`
-   `personal_notes`
-   `writing_drafts`
-   `listening_attempts`
-   `speaking_sessions`
-   `content_sources`
-   `content_licences`

Use migrations from the beginning. Add indexes for common search and
history queries. Keep public curriculum content separate from private
learner records.

For Pocket, define equivalent browser-side data structures and versioned
import/export formats.

------------------------------------------------------------------------

## 14. Pocket PWA and data portability

### 14.1 Mobile experience

Pocket must: - Work on common Android mobile browsers. - Be installable
as a PWA where supported. - Work offline after the app and content have
been cached. - Load quickly on ordinary mobile connections. - Use large,
touch-friendly controls. - Avoid requiring an account.

### 14.2 Browser storage

Use IndexedDB for: - Review state. - Review history. - Saved cards. -
User settings. - Local progress. - Optional personal notes.

Explain that browser storage is device/browser-specific and may be
cleared by the user or browser. Encourage regular exports.

### 14.3 Import and export

Provide versioned JSON export/import.

The export should include only the user's Pocket data, not the entire
public content database unless necessary.

Validate imports, show a summary before applying them, handle version
differences, and provide a backup before destructive replacement.

### 14.4 Privacy boundary

The GitHub Pages deployment contains approved public content and
application code. Personal Pocket progress stays in that user's browser
unless they deliberately turn on one of two opt-in backups: their own
private GitHub repo (`lib/cloud.ts`) or their own account in the
deployment's Supabase project (§14.5). Both send only the backup file
(no recordings, no keys or tokens) and only to the learner's own place.
No analytics, no other network calls with learner data.

Static hosting does not provide automatic sync between the Local app and
Pocket. Do not claim otherwise. The backups are "newest wins" copies of
one device, not a live item-by-item merge.

### 14.5 Optional account: Sign in with Google (Supabase) — built 2026-11-19

Owner decision (2026-11-19), built the same day:

- Settings → Account → "Sign in with Google" (Supabase Auth, Google
  provider, PKCE redirect back to the same Pages address; the hash route
  is restored after the callback). Shows the email, "Back up now",
  "Last backup", "Sign out", "Delete my cloud data" (deletes the row,
  then signs out). Strings in EN/TR/AR (Arabic right-to-left).
- Data: one table `backups (user_id pk → auth.users, data jsonb,
  updated_at)` with Row Level Security `user_id = auth.uid()` for
  select/insert/update/delete (`supabase/schema.sql`). Only the public
  anon/publishable key is in the client; the sign-in session is kept in
  IndexedDB.
- Same payload and rules as the GitHub backup (shared `lib/sync.ts`):
  automatic backup at most every ~20 h, when the app is opened or left;
  first sign-in: nothing in the cloud → upload, empty device → restore by
  itself, both have progress → "Restore it here / Replace it with this
  device"; restore keeps a safety copy.
- Opt-in only: no account is ever required; the GitHub backup and JSON
  export stay.
- Nothing hardcoded: `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` from
  the repo's Actions *Variables* at build time, or "Use my own Supabase"
  in Settings → Backup. Without either, the Account row is hidden.
- `@supabase/supabase-js` is a separate, lazily loaded file (only when
  Account is opened or the device is signed in).
- Free-tier pause (after ~1 week idle) is prevented by a scheduled
  workflow that calls `public.keepalive()` every 2 days.
- Owner's setup steps: `docs/SUPABASE_SETUP.md`. The same table may later
  carry the Local ↔ Pocket sync.

------------------------------------------------------------------------

## 15. Performance requirements

The app must feel fast and predictable.

Targets to validate on a representative modest device: - Dashboard
should render in under approximately 1 second after local data is
available. - Navigation should feel immediate, with a target below 200
ms for ordinary local transitions. - Common database searches should
target below 100 ms for normal library sizes. - Flashcard answer and
next-card actions should feel instantaneous. - Pocket should aim to
become usable within 2 seconds on a reasonable connection after
deployment.

These are engineering targets, not guarantees across all hardware.

Performance practices: - Keep dependencies small. - Avoid unnecessary
animations. - Lazy-load large modules. - Index database queries. -
Process large book imports in the background. - Avoid blocking the UI
during OCR or extraction. - Paginate or virtualise long lists when
necessary. - Cache static public content. - Measure before optimising. -
Test on a modest Android device and an ordinary Linux computer.

------------------------------------------------------------------------

## 16. Repository structure

Proposed monorepo layout:

``` text
fluent365/
├── README.md
├── LICENSE
├── CLAUDE.md
├── PLAN.md
├── CONTRIBUTING.md
├── SECURITY.md
├── .gitignore
├── apps/
│   ├── local/
│   │   ├── frontend/
│   │   └── backend/
│   └── pocket/
│       ├── src/
│       ├── public/
│       └── vite.config.ts
├── packages/
│   ├── shared-types/
│   ├── learning-content/
│   ├── exercise-engine/
│   ├── spaced-repetition/
│   └── ui/
├── content/
│   ├── grammar/
│   ├── vocabulary/
│   ├── expressions/
│   ├── collocations/
│   ├── phrasal-verbs/
│   └── curriculum/
├── scripts/
├── .github/
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── docs/
│   ├── EXISTING_PROJECT_AUDIT.md
│   ├── DEVELOPMENT_STATUS.md
│   ├── INSTALLATION.md
│   ├── QUICK_START.md
│   ├── POCKET_DEPLOYMENT.md
│   ├── ANDROID_INSTALLATION.md
│   ├── DATA_PRIVACY.md
│   ├── SELF_HOSTING.md
│   ├── TROUBLESHOOTING.md
│   └── CONTENT_LICENSING.md
└── tests/
```

Adjust the structure if the existing project audit finds a better,
simpler layout.

------------------------------------------------------------------------

## 17. Existing project audit --- do this before coding

The developer may already have projects or reusable code.

Before creating a new application: 1. Inspect only the relevant parent
directory and project folders. 2. List existing projects and identify
their purpose and technology. 3. Look for reusable components, database
code, layouts, styles, tests and deployment workflows. 4. Check licences
and dependency health. 5. Identify what can be reused safely. 6. Write
`docs/EXISTING_PROJECT_AUDIT.md`. 7. Do not delete, rename, overwrite or
modify unrelated projects. 8. Ask before inspecting unrelated
directories or changing existing files outside the agreed project. 9.
Preserve existing working functionality. 10. Recommend the smallest safe
implementation path.

Do not blindly create a new folder and start from scratch if a suitable
project already exists.

------------------------------------------------------------------------

## 18. Development process and Claude Code instructions

Use Claude Code as a development assistant, not as a required runtime
service for users.

Create and maintain: - `PLAN.md` --- this product and implementation
plan. - `CLAUDE.md` --- concise project rules and coding guidance. -
`docs/DEVELOPMENT_STATUS.md` --- current milestone, completed work,
known issues and next steps. - `docs/EXISTING_PROJECT_AUDIT.md` ---
results of the initial project inspection.

### Development rules

-   Inspect before editing.
-   Make small, testable changes.
-   Build a working MVP early.
-   Run tests after each meaningful milestone.
-   Commit after each milestone.
-   Keep the status document current.
-   Do not generate all 365 days of lessons before the learning engine
    works.
-   Do not build complex AI features before core learning workflows
    work.
-   Avoid adding dependencies without a clear benefit.
-   Never claim a feature is complete unless it has been tested.
-   Protect user data and existing projects.
-   Prefer simple solutions that can be maintained by one developer.

------------------------------------------------------------------------

## 19. Priorities and milestones

### P0 --- Working core MVP

This is the first release target.

1.  Existing-project audit.
2.  Public repository structure and documentation basics.
3.  Local application starts reliably.
4.  SQLite database and migrations.
5.  Simple, accessible dashboard.
6.  Grammar topic and exercise engine.
7.  Grammar attempts and mastery tracking.
8.  Vocabulary search.
9.  Flashcards and FSRS scheduling.
10. Genuine active-learning session tracking.
11. Daily assessment.
12. Basic book import and library listing.
13. Backup and restore.
14. Automated tests for the core learning loop.

**P0 acceptance:** A learner can open the local app, complete grammar
practice, review vocabulary, see their real activity recorded, close the
app and return without losing progress.

### P1 --- Public Pocket and full learning foundations

1.  Pocket PWA.
2.  Shared public grammar content.
3.  Public vocabulary and expressions.
4.  Mobile flashcards.
5.  IndexedDB progress.
6.  JSON import/export.
7.  GitHub template repository setup.
8.  GitHub Pages deployment workflow.
9.  Test different repository base paths.
10. Android installation guide.
11. Expanded book extraction and reading tracking.
12. 365-day adaptive curriculum.
13. IELTS General Training practice foundations.
14. Public contribution and licensing documentation.

**P1 acceptance:** A new person can create their own repository from the
template, deploy their own Pocket site, install it on Android and use it
offline without receiving the original developer's private data.

### P2 --- Advanced learning and improvements

1.  Rich reading comprehension.
2.  Listening programme.
3.  Writing practice and history.
4.  Speaking practice and local recordings.
5.  More advanced grammar production.
6.  Detailed analytics.
7.  Better adaptive recommendations.
8.  Additional content packs and learning profiles.
9.  Optional, separately designed cross-device sync (first step: §14.5
    Supabase account with Sign in with Google).
10. Optional AI-assisted workflows, only if a user configures a provider
    and understands any cost/privacy implications.

------------------------------------------------------------------------

## 20. Documentation required for public users

The repository must include:

-   `README.md` --- what Fluent365 is and screenshots or a clear feature
    overview.
-   `INSTALLATION.md` --- local installation.
-   `QUICK_START.md` --- first use for non-technical learners.
-   `POCKET_DEPLOYMENT.md` --- create and deploy a personal GitHub Pages
    Pocket.
-   `ANDROID_INSTALLATION.md` --- add Pocket to an Android home screen.
-   `DATA_PRIVACY.md` --- what is stored where.
-   `SELF_HOSTING.md` --- independent hosting options.
-   `CONTRIBUTING.md` --- contribution process.
-   `SECURITY.md` --- responsible security reporting.
-   `TROUBLESHOOTING.md` --- common setup and usage problems.
-   `CONTENT_LICENSING.md` --- source and licence records for learning
    materials.

Documentation must use clear language and avoid assuming that every user
is a programmer.

------------------------------------------------------------------------

## 21. Testing and release acceptance

### Local app

-   Fresh installation works.
-   Database migrations work.
-   Grammar exercise can be completed.
-   Attempts and mastery persist after restart.
-   Vocabulary search works.
-   FSRS review actions update scheduling.
-   Idle time is not counted as active learning.
-   Backup and restore work.
-   Book import handles supported formats and invalid files safely.
-   No personal data is committed to the repository.

### Pocket

-   Production build succeeds.
-   Project-site base path works.
-   Root/custom-domain base path can be configured.
-   PWA manifest and service worker work.
-   Offline use works after caching.
-   IndexedDB progress persists.
-   JSON export and import work.
-   Import validation rejects malformed files safely.
-   No personal data is sent to a server by default.
-   Android installation instructions are accurate.

### Public repository

-   A new user can use the repository template.
-   Deployment does not depend on the original developer's account.
-   GitHub Actions can build and publish the user's copy.
-   Licence and attribution notices are present.
-   CI runs tests and builds.
-   Secrets and personal files are excluded.

------------------------------------------------------------------------

## 22. Definition of done

Fluent365 is ready for its first public release when:

1.  The local MVP is reliable and tested.
2.  Grammar practice records meaningful progress.
3.  Vocabulary review and scheduling work.
4.  Personal data remains local and can be backed up.
5.  Pocket builds as a static PWA.
6.  A new user can deploy their own Pocket from the template.
7.  Their deployment works under their own GitHub account and repository
    path.
8.  Pocket works offline after initial caching.
9.  Pocket progress can be exported and imported.
10. No original developer's personal data or private books are included.
11. Documentation is sufficient for a non-technical user to get started.
12. Public content and software licences are documented.

------------------------------------------------------------------------

## 23. First Claude Code task

Start by opening the parent directory that contains any relevant
existing projects. Launch Claude Code there and give it this
instruction:

> Read `PLAN.md` completely. First inspect only the relevant project
> directories and identify existing code that can be safely reused. Do
> not delete, overwrite, rename or modify unrelated projects. Create
> `docs/EXISTING_PROJECT_AUDIT.md` and `docs/DEVELOPMENT_STATUS.md`.
> Recommend the smallest safe architecture that satisfies the plan,
> including the public multi-user/open-source requirement and the
> independent GitHub Pages Pocket deployment. Then begin P0 in small
> milestones. Prioritise a working local app, grammar-instinct practice,
> real learning tracking, vocabulary review, accessibility and
> performance. Test every milestone and update the status document. Do
> not build all 365 days of content before the core learning loop works.
> Do not add a required AI API. Make a Git commit after each completed
> milestone.

------------------------------------------------------------------------

## 24. Final product principle

**Fluent365 is a public platform that each learner can make their own.**

The source code and properly licensed learning content are shared. Each
person's books, profile, notes, progress, mistakes and review history
remain private to their own installation and devices unless they
deliberately export or share them.

Build the smallest reliable learning system first. Make it useful for
one learner, make it easy for anyone to deploy, and then improve it
through tested, well-documented releases.

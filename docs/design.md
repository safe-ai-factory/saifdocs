# ai docs
_Exported on 04/04/2026 at 19:14:53 CEST from Cursor (2.6.22)_

---

**User**

as an OSS maintainer, I'm constantly disappointed by the quality of documentationthat LLM agents output (e.g. see anything in ./docs/ dir). It's ok, but oftentimes very literal and short-sighted (e.g. it documented the command at hand, but doesn't consider the deeper motives, workflows beyond the codebase, and is blind to the mental states or questions that readers may go through when reading it. No consideration for how to maximize the effort to tweak the documentation to meet the user where they are.

As an example, when documenting the sandbox fature of saifctl, then LLM output:
```markdown
# Sandbox

**SaifCTL** can run agents in isolation when you do not need the full feature loop. Use `saifctl sandbox` for research, documentation, marketing copy, spikes, or agents that never touch code.

You get the same container isolation as `feat run`. Your machine stays untouched until you opt in with `--extract`.

```

Which looks fine at first sight. But then I notice sublte things like:
- user may see this before they see 'feat run'. Desribing 'sandbox' command relative to 'feat run' may not be the best approach
- OpenClaw is hugesly popular, and so users will likely search for something that can run openclaw safely, rather than for "how to run agent to do research safely". And our narrative should reflect that.

So this then leads me to question - what tools or frameworks can we use so that I don't have to do this exercise and lengthy and costly human review for every single documentation that gets written? Has the commmunity responded to this problem already?

Please do a deep research for github-based  open source projects (but also open to hear about paid products if they make my life considerably simpler) that address this.

---

**Cursor**

Good, I have enough to give a thorough, useful answer. Let me synthesize this.

This is a real and recognized gap — the OSS community is actively responding, though the tooling is still maturing. Let me give you a structured picture of what exists.

---

## The core problem you're naming

What LLM agents miss is **reader mental model modeling**: they write from the implementation outward ("here's what the command does") rather than from the reader inward ("here's what this person is searching for, what they already know, and what would make them trust us"). Your OpenClaw example is perfect — a user searching "run OpenClaw safely" doesn't map to your current framing at all.

The community has responded with two broad strategies: **automated linting / review gates** and **prompt/context engineering** at generation time. Both are needed.

---

## Layer 1: Automated review gates (post-generation)

These run in CI or on PRs to catch quality issues before they ship.

### **Fowel** — `fowel.ai` (paid, $0–$129/mo)
This is probably the most directly useful product for your use case. It's a GitHub App that reviews docs PRs across 20+ factors including:
- **Developer journey** — does onboarding flow lead to first success?
- **Structure & information architecture** — navigation, naming, cross-linking
- **Completeness** — does the full Diátaxis quadrant exist (tutorial, how-to, reference, explanation)?
- **Content accuracy** — contradictions, outdated info

It installs in 30 seconds as a GitHub App, no config files needed, and fires on every PR. The free tier gives 20 credits to evaluate it. The limitation: it's checking technical quality factors, not "does this page address what the OpenClaw community is searching for" — that's a layer above.

### **VectorLint** — [`TRocket-Labs/vectorlint`](https://github.com/TRocket-Labs/vectorlint) (OSS, 38 stars)
An LLM-as-a-judge prose linter. You define your style guide in a single prompt and it enforces it. Closer to Vale but AI-powered, so it can handle fuzzy rules like "don't document `sandbox` relative to `feat run` if the reader may not have seen `feat run`". Very early, but the approach is the right one.

### **Vale** — [`errata-ai/vale`](https://github.com/errata-ai/vale) (OSS, very mature)
The gold standard for rule-based prose linting. YAML rules that run in CI. Can enforce style guide conventions like "don't use relative references to other commands without linking them." Not AI-native, but very reliable and composable. Most serious OSS docs teams use it.

### **doc-structure-lint** — [`hawkeyexl/doc-structure-lint`](https://github.com/hawkeyexl/doc-structure-lint) (OSS)
Validates Markdown structure against YAML templates. Good for enforcing that every command doc has: "what it does → when to use it → examples → comparison to related commands → deeper reading" — i.e., the shape of a good page.

---

## Layer 2: Persona-based simulation (post-generation, before shipping)

These simulate how a specific reader type would actually read and react.

### **Impersonaid** — [`theletterf/impersonaid`](https://github.com/theletterf/impersonaid) (OSS, Apache 2.0, 54 stars)
The most directly applicable tool for your OpenClaw problem. You define personas (`expert_developer`, `beginner_who_knows_OpenClaw`, `security_engineer`) and run:
```bash
impersonaid simulate --persona openclaw_user \
  --doc ./docs/sandbox.md \
  --request "I want to run OpenClaw without it touching my machine"
```
It simulates user testing sessions with LLM-powered personas and gives feedback. CLI + web interface. Experimental but very promising.

### **OpinionatedDocReviewer** — [`jonzobrist/OpinionatedDocReviewer`](https://github.com/jonzobrist/OpinionatedDocReviewer) (OSS, AGPL-3.0)
Runs multiple AI personas in parallel, streams comments into a live feed anchored to document text, then a meta-agent synthesizes across personas. Heavier stack (FastAPI + Next.js + Redis), but the architecture is interesting — the meta-agent deduplicates and ranks feedback. Useful when you want to run "OpenClaw user", "new user who never heard of saifctl", and "security-paranoid DevOps engineer" all at once.

---

## Layer 3: Framework-level structure (generation time)

These address the issue earlier — before the LLM writes bad docs.

### **Diátaxis** + tooling
Diátaxis (tutorials / how-to guides / reference / explanation) is the dominant framework that addresses your "blind to mental states" critique. Each quadrant forces you to ask: *what does this reader need right now?* Tutorials teach; how-tos solve a goal; reference is looked up; explanations build understanding.

What's emerging:
- **[`keithpatton/diataxis-agent-skill`](https://github.com/keithpatton/diataxis-agent-skill)** — a Cursor/Claude Code skill that enforces "quadrant purity" when generating docs. If an LLM tries to mix tutorial content into a reference page, it flags it.
- **Katara** (paid) has an automated Diátaxis classifier that categorizes docs and finds gaps.

The OpenClaw-framing problem is a Diátaxis violation: your sandbox doc is trying to be a reference page but it's written like a how-to guide, and it assumes prior knowledge it shouldn't assume.

### **Richer generation-time context** (the highest leverage, no tool needed)
The honest answer is: the biggest lever isn't a linting tool — it's what you feed the agent when generating docs. What's missing from the typical "write docs for this feature" prompt:

1. **Audience context**: "Primary readers are developers who already use OpenClaw/Cursor Agent, Claude Code, etc. and are searching for a safe sandbox to run it in. Secondary readers are DevOps engineers evaluating isolation guarantees."
2. **Search intent**: "Users will likely arrive via searches like: 'run OpenClaw safely', 'sandbox for AI agents', 'docker isolation for claude code'"
3. **Framing constraint**: "Do not define features relative to other features the reader may not have seen yet."
4. **Comparable examples**: give the agent 2-3 examples of excellent developer docs from similar tools (e.g., Dagger's docs, Modal's docs)
5. **Diátaxis type**: "This page should be a how-to guide (goal-oriented, not teaching-oriented)."

Projects like **Mintlify's writing agent** and **Documentation.AI** try to bake some of this in, but they're still solving the hosted-docs use case more than the OSS maintainer who generates docs via agents.

---

## What I'd actually recommend for your situation

Given you're an OSS maintainer generating docs via agents (saifctl), the highest ROI path today is probably:

1. **Immediately**: Write a `DOC_CONTEXT.md` in your repo that every doc-generating agent prompt is required to include. Put your audience, search terms, framing rules, and Diátaxis classification in it. This is free, done in an hour, and eliminates 80% of the blindness you're describing.

2. **Add Vale to CI** with a custom rule set (30-minute setup, catches structural regressions over time).

3. **Use Impersonaid ad-hoc** before shipping major doc sections — run it with 2-3 personas specific to your tool's audience.

4. **Evaluate Fowel** on your next few PRs (free tier) to see if its 20-factor review catches the deeper issues you care about, or if it's mostly surface-level style.

5. **Longer term**: contribute a Diátaxis-aware doc generation skill to your `.cursor/skills/` setup — which would force every doc agent to classify the page type and include audience context before writing.

The gap you're frustrated by is real and the community is young on this. The best teams today are solving it with a combination of rich generation-time context + persona simulation, not purely with post-hoc linting tools.

---

**User**

let's assume that we'd go with Vale or OpinionatedDocReviewer. Basically automated AI-agent-based review process. 

Let's break down this scenario - waht are the moving parts? For example, my non-exhaustive list would include:
- user personas (who they are)
- tasks (what they are trying to achieve)
- motives (why are they trying to complete the task? (maps tasks to personas)
- prior knowledge (or experience level, etc. basically a modulator for the user persona. could be replaced by experience-level-specific personas)

What else is there? search best practices and SOTA research or blogs from people with relevant experience, etc

---

**Cursor**

Good, that's a very rich source. Let me now synthesize everything into a comprehensive taxonomy.

Here is a comprehensive taxonomy of the moving parts in an automated AI-agent-based documentation review system, grounded in research and practice.

---

## The full taxonomy of dimensions

### 1. Reader Model (who is reading)

Your list started here. This is the richest cluster and the one most LLMs underweight.

**a. Persona**
Who they are: their role, domain, stack, company size, industry. Not abstract ("a developer") but specific ("a DevOps engineer at a mid-size SaaS, responsible for container security").

**b. Prior knowledge / experience level**
What they already know — but this is multidimensional. Someone can be an expert in Docker but a novice at agentic AI. You need to model knowledge *per domain*, not just an overall "beginner/expert" slider. This is the "vocabulary gap" anti-pattern Tom Johnson's rubric flags: docs assume familiarity with concepts the reader doesn't have.

**c. Motivation / Jobs to Be Done**
*Why* they're here — Eric J. Ma's framing via Christensen: each doc type is "hired" to do a specific job. The sandbox doc is hired to answer "can I run my AI agent without wrecking my machine?" — not "what does the sandbox feature do?" These are different jobs.

**d. Emotional / trust state**
The research on developer emotions (32.85% Anger, 33.45% Sadness in Stack Overflow posts about deep learning docs) shows this matters. Is the reader:
- Evaluating skeptically (pre-commitment, hasn't bought in yet)?
- Executing under pressure (mid-task, stressed)?
- Recovering from failure (post-error, frustrated)?
- Exploring openly (discovery mode, curious)?

Each state requires different framing. Your sandbox example hits pre-commitment skeptics poorly because it assumes they already know what `feat run` is.

**e. Alternatives awareness / competitive mindset**
Do they already use a competing tool? Are they migrating from something? Readers who come from "I use Dagger/Modal/Codegen" need different framing than greenfield adopters. Docs that ignore this come across as naive or dismissive.

**f. Reading mode / time pressure**
*How* they're reading: skimming headers, ctrl+F searching for a specific term, or reading linearly because they're learning. The Atlantic's 2026 piece on "documentation for people under time pressure" makes the point that most developer doc readers are in execution mode — mid-task, stressed — and docs that assume a contemplative reading mode fail them.

---

### 2. Task Model (what they are trying to do)

**a. Task type (Diátaxis quadrant)**
- Learning a concept → needs an Explanation
- Following a workflow → needs a How-to Guide
- Looking something up → needs Reference
- Safe structured first run → needs a Tutorial

The LLM anti-pattern is writing every page as a mix of all four. "Quadrant purity" is a real quality signal.

**b. Task stage / Day N**
From the Decision-System Framework:
- **Day 0** (pre-commitment): evaluating fit, comparing to alternatives, deciding whether to adopt
- **Day 1** (onboarding): fastest path from zero to working, need clear sequences
- **Day 2** (production): crisis and troubleshooting, need "if X then Y" patterns

Your sandbox doc was probably written for Day 1 users who are already committed to the tool. But a lot of traffic is Day 0 — people evaluating whether saifctl does what they need.

**c. Success criterion**
What does task completion look like? For the sandbox feature: "I ran a command and my filesystem was untouched." The doc should make it obvious what success looks like before they start, not after.

**d. Failure modes / unwanted states**
Tom Johnson's genre schema: "goals → prerequisite states → action and reaction → unwanted states (troubleshooting)." Most LLM-generated docs omit the last one entirely.

---

### 3. Arrival Context (how they got here)

This cluster is almost entirely absent from existing tools but is highly predictive of what the reader needs.

**a. Entry point / discovery path**
Did they arrive via:
- Organic search (implies they searched for a term — that term is a clue to their mental model)
- The README (they're onboarding linearly)
- A link from another doc page (they followed information scent from elsewhere in your docs)
- A UI link or error message (they have a specific failure context)
- A colleague's Slack message (social proof already given, different trust state)

Your OpenClaw example is exactly this: users searching "run OpenClaw safely" will land on your sandbox doc via Google with a very specific vocabulary and intent. The doc's first paragraph needs to match that vocabulary.

**b. Prior pages read**
Has the reader seen `feat run` yet? If they arrived from a search engine, probably not. If they navigated through the docs linearly, probably yes. This is why "described relative to `feat run`" is a problem — it assumes a linear reading path that search-engine traffic doesn't follow.

**c. Search vocabulary**
What exact words did they type? This is distinct from "what they want" — it reveals their mental model. "Run OpenClaw safely" maps to a different framing than "saifctl sandbox isolation." Your doc should use the vocabulary of the former even if internally you think in terms of the latter.

---

### 4. Content Dimensions (the document itself)

**a. Findability**
- Is it SEO-friendly for the actual search terms users would type?
- Does it appear as a related link where users naturally follow information scent?
- Does the table of contents / navigation reflect the user's mental model of the problem domain?

**b. Framing / narrative**
- What story does the page tell? Is it product-out ("here's what sandbox does") or user-in ("here's how to safely run your agent")?
- Does the product story align with the user story? Tom Johnson calls this the most important but hardest dimension.
- Are comparisons to other tools/features appropriate and non-misleading for users who haven't seen those tools?

**c. Vocabulary alignment**
- Does the doc use the same terms the target audience uses?
- Are domain-specific terms defined before use?
- Are technical terms consistent across the doc (no synonyms that imply distinction)?

**d. Information architecture / structure**
- Can users switch between macro (overview) and micro (step-by-step) views?
- Does the structure follow genre conventions for this doc type (how-to vs reference vs tutorial)?
- Is there progressive disclosure for complexity?

**e. Completeness**
- Prerequisite states stated explicitly?
- Error states and troubleshooting covered?
- Edge cases documented?
- What are the most likely follow-up questions after reading this page? Are they answered or linked?

**f. Harmony with the landscape**
Tom Johnson's "information harmony" dimension:
- What does this page look like beside other pages on the same topic in your docs?
- What does Google show alongside it?
- Does it contradict, repeat, or harmonize with adjacent content?

---

### 5. Trust / Credibility Signals

This cluster is underappreciated but critical for pre-commitment readers.

**a. Social proof anchoring**
Mentioning well-known tools (OpenClaw, Claude Code, Cursor Agent) by name tells the reader "this tool knows my world." Generic framing ("run agents safely") misses this.

**b. Honesty about limitations**
Docs that only show the happy path read as marketing. Acknowledging when the tool isn't the right choice, or what it doesn't do, actually increases trust for technical readers.

**c. Recency signals**
Are code samples using current APIs? Are version numbers visible? Stale-looking docs make readers assume the whole project is abandoned.

**d. Semantic density** (from AEO/GEO research)
Pages with specific named entities, technical terms, and domain concepts have higher credibility signals — both to human readers and to AI systems that surface documentation. Vague prose ("run your agents more safely") scores poorly; specific prose ("run OpenClaw in a Docker-isolated environment with `--extract` opt-in") scores well.

---

### 6. Context the Review Agent Needs (meta-inputs)

For Vale or OpinionatedDocReviewer to do a good job, they need to be given these inputs — they can't infer them from the doc alone:

**a. Persona definitions** (who you've decided the audience is)
**b. Known search terms** (what your analytics or keyword research shows people actually search)
**c. Competitive landscape** (what alternatives readers may be coming from)
**d. Doc type declaration** (Diátaxis quadrant — what job is this page supposed to do)
**e. Position in reading journey** (is this page meant for linear readers or search-engine arrivals?)
**f. Adjacent pages** (what should readers already know, and what will they read next)
**g. Your product story / positioning** (so the agent can check narrative alignment)

---

## How these map to your example

The sandbox doc's specific failures, now named:

| Failure | Dimension |
|---|---|
| "Relative to `feat run`" framing | **Arrival context: prior pages read** — assumes linear reading |
| No mention of OpenClaw | **Arrival context: search vocabulary** + **Trust: social proof anchoring** |
| "Run agents to do research safely" framing | **Task model: Jobs to Be Done** — wrong job description |
| Missing "what success looks like" | **Task model: success criterion** |
| Nothing about what happens if you don't use `--extract` | **Content: failure modes / unwanted states** |
| Generic opener that could apply to any sandbox | **Content: framing / narrative** — product-out, not user-in |

---

## What this means for your tooling setup

Vale can enforce dimensions 4c (vocabulary), 4d (structure/genre), and partially 4b (framing anti-patterns via custom rules). It's rule-based — you'd need to write the rules once and they run forever in CI.

OpinionatedDocReviewer's multi-persona parallel review covers dimensions 1a–1f and 2 well, but only if you supply well-defined persona configs that include arrival context and emotional state, not just "expert developer."

Neither tool covers dimension 3 (arrival context) or 6 (meta-inputs) unless you supply that context explicitly in the persona/prompt configuration. That's the gap no tool fills automatically today — and it's where a `DOC_CONTEXT.md` approach (specifying personas, known search terms, and reading journey position per doc) gives you the most leverage for least effort.

---

**User**

I have expanded upon my line of thinking about how to have a tool that would write the docs with consistent quality and respect my source of truth for the personas, user tasks, concepts, etc. See below:

````
I'm a solo open source software maintainer. I use AI to help me write docs, but I'm consistently disappointed with the quality.

I used Sonnet 4.6. The documentation quality is ok, but oftentimes very literal and short-sighted.

* E.g. I'm building a [CLI tool](https://github.com/safe-ai-factory/saifctl). The [agent documented a command](https://github.com/safe-ai-factory/saifctl/blob/main/docs/commands/doctor.md) at hand, good. But the output doesn't consider the deeper motives, workflows beyond the codebase, and is blind to the mental states or questions that readers may go through when reading it. No consideration for how to tweak the documentation to meet the user where the user is.

Being an engineer, I understand where the failure comes from:

* AI is only as good as the context it has - you need to explicitly spell out things for it to behave certain ways. It can't consider user's perspectives if I don't spell out the user personas I want to consider.
* AI is prone to biases - e.g. a two-step process where step 1) generates text and step 2) critiques and refines the output is better than simply telling an AI "don't do this".
   * This implies that the workflow / architecture of how the prompts are orchestrated is just as important as the model quality and available context.

However, considering where the AI ecosystem is right now, I believe there should be already tools for building high-quality technical documentation.

**Has anyone had experience with such tools?** Preferably open source.

\---

If there are none, I'm keen to discuss what would it take to build such tools.

How I'm thinking about is:

* User (writer) should be still in control of the truth/world-building - personas, reader's tasks/motivation, etc.
* AI should generate documentation text from the source of truth.
* AI should also be able to identify gaps in what tasks or concerns have/haven't been addressed.
* "Testing" can be done by AI agents too, simulating visitors with specific personas and motives, see [jonzobrist/OpinionatedDocReviewer](https://github.com/jonzobrist/OpinionatedDocReviewer).

I'm struggling to conceptualize/formalize following aspects:

1. In my [project](https://github.com/safe-ai-factory/saifctl) I see that how I expect users to think of the tool and how it's implemented are 2 separate "truths".

* E.g. the code is written as a single monolith project, but it has 2 distinct use cases:
      1. For individuals who just want to run OpenClaw safely.
   * 2. For eng teams that want to build entire products as "software factories" (engineers define the boundaries of the system, AI iteratively fills in the gaps)
* I'm thinking this could be formalize as "products". So you'd write a markdown file (or a folder of files) outlining individual "products"

1. I'm familiar with [Diátaxis](https://diataxis.fr/) (I applied it in the past in [this project](https://django-components.github.io/django-components)), however, I'm unsure how to capture it.

* My intuition tells me that when I think of How-To's, tutorials, etc, these should be left up to the AI.
* However, I as the writer should define and enumerate the underlying intents (concepts to learn, user goals, etc).
* AI should take the underlying intents, user personas, their goals, product description, etc, and synthesize the actual How to article from all of that.
* When I try to break it down:
   1. How To guides should reflect user goals/tasks.
* 2. Concepts-to-explain should be explictly defined by me.
   * You could try to ask AI to extract the concepts from your definition of "products", but it's not consistently reliable.
* 3. Tutorials - Similar case as concepts - How you use a tool implicitly carries the info about how to structure the tutorial - You could take the how-to guides, and break down how the tool is used into atomic parts, and then structure the tutorials in a way that each step in the tutorial introduces a new part.
   * And again, you could try to use AI to extract tutorials concepts from How to guides and other resources, but at the end of the day you as a writer should still be responsible for the underlying tutorial design (what gets introduced at what stage).
* 4. Reference - Unsure about this. In the past when I wrote reference docs, the source of truth that dictated the format was the implementation (e.g. CLI commands were separate from the library's methods and classes. I'm not sure how to make this work with AI-generated content.

1. Tone - AI always adds fluff. So I keep telling it not to. As I'm thinking about it, there could be different levels at which we might want to configure rules / tone:

* Global - applies to all files
* Per persona - use different language when speaking to individuals vs enterprise users
* Per form (as per [Diátaxis](https://diataxis.fr/)) - e.g. be concise and easy to skim when user want to fix their problem fast (How to's), vs story-driven long-form text when explaining core concepts.
* Per "product" - If I have diffenent "products" (as defined above), different things may be important to users of different "products".

1. Templates(?) - Nice to have. But to have consistent output, it might be good to tell AI how to format:

* a) entire pages (e.g. How to guide),
* b) specific blocks (e.g. this is how to format inlined examples)

1. Anything else?

\---

So if I try to summarize how I think about it, I imagine a tool where I'd define a folder with markdown files in the format below. And the tool would:

* Use the products, personas, concepts, user tasks, etc, to generate high quality docs, ensuring consistent quality.
* Run "tests" or "review", where AI agents would simulate one or more personas with specific goals, where they'd try to navigate through the docs (preferably using only the raw markdown, HTML, or via browser), to answer their problems.



    /my-project/
      |- documentation/
         |- products/
         |  |- safe-ai-agent/
         |  |  |- rules.md
         |  |- software-factory/
         |     |- rules.md
         |
         |- personas/
         |  |- openclaw_user/
         |  |  |- tasks/
         |  |  |  |- protect-my-pc-from-deletion.md
         |  |  |- persona.md
         |  |  |- rules.md
         |  |- engineer/
         |
         |- concepts/
         |  |- ...
         |
         |- tutorials/
         |  |- ...
         |
         |- rules/
         |  |- ...
         |
         |- references/
         |  |- ???
         |
         |- templates/
         |  |- pages/
         |     |- how-to.md
         |  |- blocks/
         |     |- inlined-example.md
````

First, please check for any logical gaps. Anything missing?

---

**Cursor**

Let me read the current docs to have concrete grounding before responding.

Good — I can see you already have a `doc-meta` convention started in `branding.md`. Now let me think carefully about the gaps in your proposed system.

Your design is quite well-reasoned. Here are the gaps and tensions I see:

---

## Logical gaps

### 1. The dependency graph between nodes is unspecified

Your folder structure defines the *nodes* of knowledge but not the *edges*. The system needs to know:
- Which personas apply to which products (not always all of them)
- Which tasks belong to which personas *for which product* (an engineer persona's tasks differ when using saifctl as a sandbox vs as a software factory)
- Which concepts are prerequisites for which tasks

Without this graph, AI will either blend everything together or you'll need to re-state relationships redundantly in every file. A `mappings.md` (or YAML) file that says "product: safe-agent → personas: [openclaw_user] → tasks: [protect-my-pc]" would make the dependency structure explicit and queryable.

---

### 2. `concepts/` is orphaned from tasks and products

You have concepts as a top-level folder, but concepts only exist to support understanding. Without knowing *which task requires which concept as background knowledge*, AI can't decide whether to inline a concept explanation, link to it, or skip it. A task file should probably declare its prerequisite concepts:

```yaml
# tasks/protect-my-pc-from-deletion.md
prereq_concepts: [docker-isolation, extract-opt-in]
```

Otherwise, the generation step has to guess — and it will either over-explain or under-explain.

---

### 3. Reference docs need a separate source-of-truth declaration

You flagged this yourself and are right to be uncertain. Reference docs (CLI args, API surface) have a different epistemology from all the others: their source of truth is *the code*, not your intent. Two options to resolve this, each with different tradeoffs:

- **Code-generated reference**: the reference section is auto-generated from code (e.g., CLI help text, TypeScript types, OpenAPI). No AI synthesis needed — your existing `doc-meta` convention or JSDoc/zod schema becomes the source.
- **Intent-declared reference**: you define what *should* be in the reference (the surface), and AI reconciles that against the code. This catches gaps but requires a reconciliation step.

Either way, `references/` needs a different kind of file in it — not a human-authored intent file, but a pointer to the canonical source (e.g., `source: src/cli/commands/sandbox.ts`, `type: cli-command`).

---

### 4. `tutorials/` structure doesn't capture sequencing constraints

You noted that tutorials introduce tool concepts in stages — but the folder structure doesn't encode that. A tutorial isn't just a collection of atomic steps; it has a *narrative arc* and a *knowledge state machine* (the reader enters knowing X, exits knowing X+Y). Without capturing what knowledge state the reader should have entering and exiting each tutorial stage, AI will produce a technically correct but pedagogically arbitrary sequence.

Consider a `sequence.md` or frontmatter on each tutorial stage:
```yaml
enters_knowing: [what-sandbox-is]
exits_knowing: [how-to-run-openclaw-safely, what-extract-does]
```

---

### 5. No model for *entry points* and *arrival context*

Your folder structure models *what* to write, but not *how readers find it*. From our earlier conversation, this is the dimension that breaks your sandbox doc specifically. You need a place to declare:
- What search terms or questions bring readers to this page
- What they probably know and don't know on arrival
- Whether they're likely reading linearly (linked from README) or jumping in cold (from Google)

This could live in the persona `tasks/` file (the task carries the arrival context) or in a per-page `doc-meta` block (which you're already prototyping in `branding.md`). But right now it's absent from the folder model entirely.

---

### 6. Rules have no inheritance model

You have:
```
rules/         ← global
products/safe-agent/rules.md   ← per product
personas/openclaw_user/rules.md ← per persona
```

But what's the resolution order when rules conflict? And are product rules and persona rules the same *kind* of thing, or different? Persona rules might govern tone and vocabulary ("speak in first-person task language to individual users"). Product rules might govern scope ("never mention software-factory features on safe-agent pages"). These serve different override purposes. Without a declared precedence or composition model (global → product → persona → Diátaxis-form), AI will either apply rules inconsistently or you'll get unexpected blending.

---

### 7. No "gaps audit" mechanism

You mentioned: *"AI should also be able to identify gaps in what tasks or concerns have/haven't been addressed."* But the folder structure doesn't define what "complete" looks like. The audit step needs to know: for each (persona × product × task), is there a corresponding How-To? For each concept declared as a prerequisite, is there an explanation page? A `coverage.md` or a manifest-style file declaring expected outputs would make the gap audit deterministic rather than heuristic.

---

### 8. Templates know format but not *intent*

Your templates are structural (how to format a how-to page). But the real constraint is intent: *this template is for a reader who is mid-task, execution-mode, low patience, looking for a fast path to a specific outcome.* Without the intent embedded in the template, AI will fill the structure but not honor the spirit. Consider pairing each template with a 1-2 line intent declaration:

```markdown
# Template: How-To Guide
<!-- intent: Reader is goal-oriented, already committed to using the tool, wants fastest path to outcome. No selling, no background theory. -->
```

---

### 9. No versioning strategy

For a CLI tool especially, docs have version-dependent correctness. `--extract-include` may not exist in v0.1. Your system has no model for:
- Which version of the product a doc applies to
- How to generate version-specific docs vs. version-agnostic intent files
- What happens when a task's steps change across versions

This may be out of scope for v1, but it's a gap that will bite you as the tool matures.

---

### 10. The "two products" model is underspecified as a *framing* problem

You've identified the two products (safe-agent sandbox, software-factory), but the subtler issue is that they require different *narrative frames* even for shared features. `sandbox` the command is:
- For the openclaw user: "run your agent without touching your machine"
- For the engineering team: "isolated execution environment you can compose into a pipeline"

The same feature, same command, but the mental model, vocabulary, analogies, and what to emphasize are completely different. Your `products/` folder captures this split, but you need a mechanism to generate *the same command's reference page differently* depending on which product lens is active — or to know when to write two separate how-to pages for the same underlying feature.

---

## One thing your design gets especially right

The **separation of "writer-owned truths" from "AI-synthesized output"** is the core architectural insight and it's correct. Most tools conflate these. You're proposing a content-model-first approach where the source of truth is human-curated structured intent, and the generated prose is a derived artifact. That's the right inversion.

The `doc-meta` convention you already have in `branding.md` is a lightweight version of this — and it's already better than what most teams do. The full system you're proposing is essentially `doc-meta` formalized into a first-class folder structure.

---

**User**

can we address logical gaps 1., 2., 4., 5. with frontmatter?

Good point about 3. refrence docs about the reconcilliation step and "reference needs a pointer to the canonical source"

re 6. let's go following heuristic in case of conflicts: 1. persona has highest priority, then product rules, then global.

re 7. yes, you defined the heuristic for "gaps audit" correctly. For simplicity, coverage.md is something that could be done in next iteration, but for now we'd just go with something like "persona × product × task".

re 8. partially correct, but not always applicable. E.g. for the blocks, if my template for inlined code says "format it as JS code", then there's not really much reason to inlude the intent. So the intent should primarily come from the rest of the context (persona, whether we're building a how to guide or concepts article, etc). But I can imagine that templates could contain frontmatter with optional 'intent' key.

re 9. versioning strategy - fair enough. my take is that for simplicity, entirely of this knowlege base should represent single version. If we make a new version, we make appropriate changes, and commit all of that. If we need to support multiple concurrent versions, they will be likely as separate git branches, and so each commit in each branch would represent different version.

re 10. and framing problem - not so sure I agree (maybe i misunderstand). I definitely do not think that we'd need to define all how tos or all CLI API for each product separately. instead there'd be single set of reference docs pages, because that comes from the source code, which is the same whether we're talking about one "product" or another. Instead, the "products" should be something that should guide the tutorials, how tos, and explanation pages. To put it into perspective, if I'm on a documentation website, the "products" may be top-level navigation, which would be like "Sandbox" and "Software factory". And when I click on one or another, they'd have their own how tos and tutorials, etc. So actually, with that said, I wonder if the tutorials, how tos, concepts, etc, if all shouldn't be nested within the products. But frankly, then I think that even personas should live within products. (things like templates and rules could optionally be both at root or per product). 

---

**Cursor**

Yes, frontmatter can address 1, 2, 4, 5 cleanly. Let me think through each and then reconcile with your other points into a revised structure.

---

## Frontmatter answers for gaps 1, 2, 4, 5

**Gap 1 — dependency graph (persona × product mappings)**

Task files can declare their scope directly:

```yaml
---
product: safe-agent
persona: openclaw_user
---
```

This makes every task file self-describing. No separate `mappings.md` needed — the graph is recoverable by reading all task frontmatter. The AI generation step just filters by product+persona to assemble context.

**Gap 2 — concepts orphaned from tasks**

Task frontmatter declares prerequisite concepts:

```yaml
---
product: safe-agent
persona: openclaw_user
prereq_concepts: [docker-isolation, extract-opt-in]
arrival_context: search  # or: readme, docs-link, error-message
search_terms: ["run openclaw safely", "openclaw docker", "agent sandbox"]
---
```

The generation step can then decide: if the reader arrives via search they probably haven't seen these concepts — inline a brief explanation. If they arrive via docs-link from a concept page, skip it.

**Gap 4 — tutorial sequencing**

Tutorial stage files declare knowledge state transitions:

```yaml
---
product: safe-agent
stage: 2
enters_knowing: [what-saifctl-is, what-sandbox-means]
exits_knowing: [how-to-run-openclaw, what-extract-does]
prereq_stage: 1
---
```

This gives the AI the pedagogical contract — it knows what to assume and what to introduce, without guessing.

**Gap 5 — arrival context**

Already shown above in the task frontmatter. `arrival_context` + `search_terms` on the task file (since tasks are what motivate the how-to pages) is the right place. For reference pages, it belongs on the reference file itself since they have a different arrival pattern (usually direct search or internal link).

---

## Your point 10 reframe — products as top-level navigation

You're right, and this changes the structure significantly. The insight is:

- **Reference docs** → single set, product-agnostic, derived from code. Shared across all products.
- **Everything else** (how-tos, tutorials, concepts, personas, tasks) → product-scoped. Each product has its own version of these because the *user journey* and *mental model* differ, even if the underlying CLI commands are the same.
- **Templates and global rules** → optionally at root or per-product.

This means the structure should invert from your original: products become the top-level container, not a parallel folder.

---

## Revised folder structure

```
documentation/
│
├── rules.md                    ← global rules (lowest priority)
├── templates/
│   ├── pages/
│   │   └── how-to.md           ← optional intent: in frontmatter
│   └── blocks/
│       └── inlined-example.md
│
├── references/                 ← product-agnostic, code-derived
│   └── commands/
│       └── sandbox.md
│           # frontmatter:
│           #   source: src/cli/commands/sandbox.ts
│           #   type: cli-command
│
└── products/
    ├── safe-agent/
    │   ├── product.md          ← what this product is, positioning, value prop
    │   ├── rules.md            ← product-level rules (overrides global)
    │   │
    │   ├── personas/
    │   │   └── openclaw_user/
    │   │       ├── persona.md  ← who they are, emotional state, alternatives awareness
    │   │       ├── rules.md    ← persona-level rules (highest priority)
    │   │       └── tasks/
    │   │           └── protect-my-pc.md
    │   │               # frontmatter:
    │   │               #   prereq_concepts: [docker-isolation]
    │   │               #   arrival_context: search
    │   │               #   search_terms: ["run openclaw safely"]
    │   │               #   day_n: 0   # pre-commitment, evaluating
    │   │
    │   ├── concepts/
    │   │   └── docker-isolation.md
    │   │
    │   ├── how-tos/            ← AI-generated, from tasks + personas + concepts
    │   │
    │   └── tutorials/
    │       └── stage-1.md
    │           # frontmatter:
    │           #   stage: 1
    │           #   enters_knowing: []
    │           #   exits_knowing: [what-sandbox-is]
    │           #   prereq_stage: ~
    │
    └── software-factory/
        ├── product.md
        ├── rules.md
        ├── personas/
        │   └── engineer/
        │       ├── persona.md
        │       ├── rules.md
        │       └── tasks/
        └── concepts/
```

---

## Key structural decisions this captures

**References are shared, everything else is product-scoped.** A reference page for `saifctl sandbox` is written once, points to the code as its source of truth, and is linked from how-tos in both products. The how-tos frame the same command differently depending on the product context.

**Personas live inside products.** An "engineer" persona using saifctl as a sandbox tool has different tasks, arrival context, and emotional state than an "engineer" persona using it as a software factory. Even if they share a job title, their mental model of the tool differs. Nesting personas under products makes this explicit.

**Rules resolution order: persona → product → global.** Since persona rules are deepest in the tree and most specific, they win. This matches your stated heuristic and is intuitive — the person you're talking to takes priority over the product context, which takes priority over house style.

**Generated outputs live inside the product.** `how-tos/` and `tutorials/` are inside `products/safe-agent/` not at root — because they are product-lens-specific even when they reference the same CLI commands.

**`concepts/` per product, not shared.** This may feel redundant but is intentional. Docker isolation means something slightly different to an openclaw user ("my files won't get deleted") than to a software factory engineer ("deterministic environment for reproducible runs"). Same underlying concept, different framing. Each product defines the concepts its readers need in its own voice.

---

## One remaining open question

The `how-tos/` and `tutorials/` directories are listed as AI-generated output. Should they live in the source tree at all, or be build artifacts? Two viable positions:

- **In-tree (committed):** Human-reviewable, git-diffable, editable after generation. You can make manual tweaks. Downside: they can drift from the source-of-truth intent files.
- **Build artifacts:** Always regenerated from intent files. Stays perfectly in sync. Downside: you lose the ability to hand-edit specific pages, and review happens on the intent files, not the output.

Given your stated goal of staying in control as the writer, in-tree with a "regenerate" command (that diffs before overwriting) is probably the right call for v1.

---

**User**

re 'One remaining open question' - the how to's and tutorials I listed as dirs inside the file structure - all of those are meant to contain only the intents. potentially could be just 'how-tos.md' and 'tutorials.md' files. the point is to define what kind of tutorials we want and what concpets they should touch and for which personas they are, etc. and the AI agent would then "unroll" that into a fully generated documentation. So in other words, everything inside my proposed 'documentation' directory is meant to be internal (probably should be renamed to docs-input or sth similar). and AI would then generate proper "docs/" directory.

---

**Cursor**

That's a clean separation. So the mental model is:

```
docs-input/    ← human-authored, source of truth, never published
docs/          ← AI-generated build artifact, what users read
```

This resolves the drift problem entirely — `docs/` is always regenerated from `docs-input/`, like `dist/` from `src/`. You'd add `docs/` to `.gitignore` or commit it as a snapshot for review but treat it as non-authoritative.

A few things this clarifies or unlocks:

---

**`how-tos.md` and `tutorials.md` as intent manifests**

Flat files rather than directories makes sense at this stage. Each entry in `tutorials.md` would be a declaration like:

```yaml
- id: run-openclaw-safely
  persona: openclaw_user
  stage: 1
  introduces: [docker-isolation, extract-opt-in]
  prereq_tutorials: []
  goal: reader can run openclaw without touching their host machine
```

The AI reads this manifest and generates `docs/products/safe-agent/tutorials/run-openclaw-safely.md`. The manifest is the contract; the generated file is the fulfillment.

---

**`concepts/` can also be intent-only**

A concept file doesn't need to be the full explanation — it just needs to define the concept's scope and what a reader should understand after reading it. AI generates the explanation page. You own the *what*, AI owns the *prose*.

```yaml
# concepts/docker-isolation.md
---
id: docker-isolation
explains: how saifctl containers isolate the agent from the host filesystem
reader_exits_knowing:
  - agent changes stay inside the container
  - nothing is written to the host unless --extract is passed
analogies_to_consider: [virtual machine, sandpit]
---
```

---

**Reference docs are the exception**

They remain a special case: `docs-input/references/` contains pointers to code, and the generation step reads the actual source (CLI arg definitions, TypeScript types, etc.) to produce `docs/references/`. The intent file is minimal — just enough to declare the source and any human-authored context the code doesn't carry (e.g., when to use this command vs another).

---

**Naming**

`docs-input/` is functional but slightly awkward. Alternatives worth considering:

- `docspec/` — analogous to `spec/` in test suites; declares what docs should exist and why
- `doc-model/` — emphasizes it's a model/schema, not content
- `content-model/` — used in CMS world for exactly this pattern
- `doc-schema/` — clearest about what it is

`docspec/` probably reads best to a developer audience and makes the build metaphor (spec → artifact) immediately legible.

---

**User**

ok, sure, we can go with docspec.

Ok, so next let's move on to designing how to implement this.

So let's map each kind of output that we want to produce, and associate it with the inputs (which other files or dirs it relies on).

---

**Cursor**

Let me read a couple more files to ground this in what you actually have before mapping it out.

Good. Now I have a clear picture of your project. Here's the full input→output map.

---

## Output types and their inputs

Each row is one generation job the AI agent runs. Inputs marked `[required]` must be present; `[optional]` enrich the output if present.

---

### 1. How-To Guide

**Output:** `docs/products/<product>/how-tos/<task-id>.md`

| Input | Source | Role |
|---|---|---|
| Task intent file | `docspec/products/<product>/personas/<persona>/tasks/<task>.md` | The job to be done, success criterion, arrival context, search terms, day-N stage |
| Persona file | `docspec/products/<product>/personas/<persona>/persona.md` | Who is reading, emotional state, experience level, alternatives awareness |
| Product file | `docspec/products/<product>/product.md` | Framing, positioning, vocabulary of this product lens |
| Prereq concepts | `docspec/products/<product>/concepts/<concept>.md` for each id in `prereq_concepts` | What to assume vs. briefly explain |
| Reference pages | `docs/references/commands/<cmd>.md` (generated) | Accurate CLI args, flag names |
| Rules (cascaded) | persona `rules.md` → product `rules.md` → root `rules.md` | Tone, vocabulary, format constraints |
| Template | `docspec/templates/pages/how-to.md` | Page structure |

---

### 2. Tutorial Stage

**Output:** `docs/products/<product>/tutorials/<id>.md`

| Input | Source | Role |
|---|---|---|
| Tutorial manifest entry | `docspec/products/<product>/tutorials.md` | Stage sequence, `enters_knowing`, `exits_knowing`, persona target |
| Persona file | same as above | Who is learning |
| Concept files | `docspec/products/<product>/concepts/*.md` for concepts in `exits_knowing` | What must be introduced in this stage |
| Previous stage output | `docs/products/<product>/tutorials/<prereq-stage>.md` | What to not repeat; what vocabulary is already established |
| How-to outputs | `docs/products/<product>/how-tos/*.md` relevant to this stage | Atomic tasks this stage composes |
| Rules (cascaded) | same cascade | Tone for tutorial form (story-driven, progressive) |
| Template | `docspec/templates/pages/tutorial.md` | Page structure |

Note: tutorials depend on how-tos, so how-tos must be generated first.

---

### 3. Explanation / Concept Page

**Output:** `docs/products/<product>/concepts/<concept>.md`

| Input | Source | Role |
|---|---|---|
| Concept intent file | `docspec/products/<product>/concepts/<concept>.md` | What the reader exits knowing, suggested analogies, scope |
| Product file | `docspec/products/<product>/product.md` | Which framing to use for this concept in this product lens |
| Persona files | all personas under the product | Vocabulary level, what analogies will land |
| Rules (cascaded) | same cascade | Tone for explanation form (longer, understanding-oriented) |
| Template | `docspec/templates/pages/concept.md` | Page structure |

---

### 4. Reference Page

**Output:** `docs/references/commands/<cmd>.md` (shared, not product-scoped)

| Input | Source | Role |
|---|---|---|
| Reference pointer file | `docspec/references/commands/<cmd>.md` | `source:` path to implementation file, human-authored context not in code |
| Source file | e.g. `src/cli/commands/sandbox.ts` | Canonical truth — arg names, types, defaults, required flags |
| Global rules | `docspec/rules.md` | Tone, format for reference form (scannable, factual) |
| Template | `docspec/templates/pages/reference.md` | Page structure |

No persona or product inputs — reference is product-agnostic by design. It's pure surface documentation.

---

### 5. Product Landing Page

**Output:** `docs/products/<product>/index.md`

| Input | Source | Role |
|---|---|---|
| Product file | `docspec/products/<product>/product.md` | Positioning, value prop, target audience, narrative |
| All persona files under product | `docspec/products/<product>/personas/*/persona.md` | Who this is for; which use cases to surface |
| All task files under product | `docspec/products/<product>/personas/*/tasks/*.md` | What jobs it helps with — drives the "what can I do here?" overview |
| Generated how-tos | `docs/products/<product>/how-tos/` | Available guides to link to |
| Generated tutorials | `docs/products/<product>/tutorials/` | Available learning paths to link to |
| Rules (cascaded) | product → global | Tone, messaging |

This page is the navigation root for one product. It's the last thing generated (it links to everything else).

---

### 6. Gaps Audit Report

**Output:** `docs/audit.md` (or stdout — not a user-facing doc)

| Input | Source | Role |
|---|---|---|
| All task files | `docspec/products/*/personas/*/tasks/*.md` | Full set of declared (persona × product × task) tuples |
| All generated how-to files | `docs/products/*/how-tos/*.md` | What was actually generated |
| All concept intent files | `docspec/products/*/concepts/*.md` | Declared concepts |
| All generated concept pages | `docs/products/*/concepts/*.md` | What was actually generated |
| Tutorial manifest | `docspec/products/*/tutorials.md` | Declared tutorial stages |
| All generated tutorial files | `docs/products/*/tutorials/*.md` | What was actually generated |

Logic: for every declared (persona × product × task), check a how-to exists. For every concept referenced in `prereq_concepts`, check a concept page exists. For every tutorial stage declared, check it was generated. Emit missing items.

---

### 7. Persona Simulation / Review Run

**Output:** review report (stdout or `docs/review/<run-id>.md`)

| Input | Source | Role |
|---|---|---|
| Persona file | `docspec/products/<product>/personas/<persona>/persona.md` | Who the simulated reader is |
| Task file | `docspec/products/<product>/personas/<persona>/tasks/<task>.md` | What they are trying to accomplish; arrival context; search terms |
| Generated docs to navigate | `docs/` | The actual content under test |
| Evaluation rubric | `docspec/rules.md` + persona `rules.md` | What counts as success or failure |

The agent is told: "You are this persona, arriving from this search term, trying to accomplish this task. Navigate these docs. Report where you got stuck, what was unclear, and whether you succeeded."

---

## Dependency and generation order

```
Source code
    │
    ▼
[4] Reference pages          (no other doc inputs)
    │
    ├──► [3] Concept pages   (no doc inputs, only docspec)
    │
    ├──► [2a] How-To guides  (uses reference pages)
    │         │
    │         ▼
    │    [2b] Tutorial stages (uses how-tos + concept pages)
    │
    └──► [5] Product landing pages  (links to all of the above)
              │
              ▼
         [6] Gaps audit       (reads all generated outputs)
              │
              ▼
         [7] Review runs      (reads final docs/ tree)
```

Reference and concept pages are independent of each other and can run in parallel. How-tos depend on references. Tutorials depend on how-tos and concepts. Landing pages and audit run last.

---

**User**

looking good! Here's more specs as I thought about the design more. Please go over them, check for logical gaps / ambiguity.

- entire things should be built on nodejs, using saifctl as NPM dependency. To get started, copy the saifctl repo to vendor/, strip it to bare bones (keep cli handling same (citty), or other things that are also important). That will be our project skeleton. (Note: this will NOT contain the actual saifctl code, we'll just borrow the project / repo structure from saifctl. saifctl will be installed via NPM).
-  Name it saifdocs? (For consistent branding, and because we're using safictl for running the agents).

Commands:
- gen/generate - given the products, personas, concepts, how tos, etc, generates docs for all of them. Should be at least 4 step process 1) process CLI flags into single settings object (like we do in saifctl); 2) resolve all the moving parts / combination of which pages to generate for which persons with what concepts and rules, we should end up with register/manifest of all things to generate (allow to export this); 3) generate content - use saifctl to run an agent in sandbox to generate the docs (the task we send to the agent in the sandbox should list all fies and their metadata we want to create). To handle agent's context, maybe we could generate each file-to-generate as a markdown file that already embeds the relevant personas, relevant persona goals, relevant concepts, etc? Or should we ask the agent to look it up themselves? Either way, we'll define custom gate script to ensure the agent can't leave until it has implemented all the files we asked it for (so the gate script can just check for existence of those files and that those files are not empty.). Output dir configuring via cli option. Which type of files to export (how tos vs tutorials, etc) also configurable via cli. saifctl configurable via config file, config file path configurable via cli. 4) post-processing steps - config may optionally define fire to post-process (??? Do we actually need it? Because if we tell LLM to output it as HTML with certain format, then probs don't need the post -processing. Instead we might run validation at rerun the agent, feeding can in the errors so it fixes it in the next run. In that case the validation script would be specified as script via the cli).
- reconcile (or update? actually prefer update) - checks what changed from last commit - which personas, concepts, rules, etc, changed. Then checks which files were impacted (eg global rule change potentially impacts all docs. Changes in concepts or product or persona would affect only those output files that touch it. Optionally accept the same cli flags as generate command.
- review - Runs the persona simulation as you outlined. Agent should NOT have access to the internet (via cedar; except for the pckage registry and LLM endpoints), so it's forced to do it locally.
- clear - deletes all output artifacts.

In another chat you suggested also these commands:
- init command — nothing in the spec covers bootstrapping the docspec/ directory for a new project. Without it, every user starts from scratch. An init command that scaffolds the folder structure with example files (or introspects the codebase to generate a first-draft persona and product) would dramatically lower the barrier to adoption. Especially important for a tool that positions itself as OSS-friendly.

- validate (separate from gen) — a command that runs only the structural validation step against existing docs/ without regenerating. Useful in CI to check that generated docs haven't been manually edited (drifted from docspec). Cheap to run, high signal.

---

**Cursor**

Good — now I can see exactly how saifctl's command pattern works. Let me go through your spec systematically.

---

## What's solid

The four-step `gen` pipeline (flags → manifest → generate → validate), the `update` reconciliation approach, using saifctl's own sandbox for generation, the custom gate script for file existence checks — all of these are internally consistent and well-grounded in how saifctl actually works.

---

## Gaps and ambiguities

### 1. "Copy saifctl to vendor/ and strip to bare bones" is underspecified and potentially painful

You say strip it to keep citty CLI handling and borrow the project structure, but saifctl will be installed via npm. This means vendor/ would be a dead copy that diverges from the actual saifctl you depend on. What you actually want is probably just to scaffold the new repo in the same *style* as saifctl — same tsconfig, eslint, build tooling, directory layout — but not maintain a copy. A `create-saifdocs` scaffold template or just a README saying "modelled after saifctl's structure" accomplishes this without the maintenance burden of a vendor copy.

If you genuinely need vendor/ for something (e.g., custom agent profiles or Cedar policies you're extending), be explicit about what specific files are vendored and why, rather than "strip saifctl to bare bones."

### 2. Step 3 of `gen`: agent context delivery strategy needs a decision

You raised this yourself but left it open: do you pre-embed all context into per-file task documents, or do you let the agent look up context itself?

These have very different tradeoffs:

**Pre-embedded context files** (a `_task-<output-id>.md` file per output that already contains the relevant persona, concept excerpts, rules): the agent gets exactly what it needs with no hallucination risk from wrong lookups, gate script is simple (just check output files exist). Downside: the context files themselves are artifacts to manage, and large docspecs produce very large prompts.

**Agent self-lookup**: the agent is given the `docspec/` tree and told to look up what it needs. More flexible, mirrors how a human writer would work. Downside: the agent may miss files, prioritize wrong ones, or hallucinate content — harder to gate on quality.

A hybrid is probably right: **pre-compute the manifest** (step 2) and embed it as a structured prompt in the task file, but have the agent read the actual persona/concept/rules files from `docspec/` rather than inlining all their content. This gives structure without over-inflating the context.

### 3. Gate script logic needs to handle partial runs

Your gate script checks for file existence and non-empty content. But what if the agent generates 18 of 20 files before context limit? The gate will keep looping, but the agent may not know which 2 are missing without re-reading the manifest. The task prompt should include the manifest as a checklist the agent can check itself, and the gate script should echo which specific files are missing so the agent can target the next run precisely rather than redoing already-complete work. This is the same `fail2pass` loop pattern saifctl already uses — worth making that explicit in the design.

### 4. `gen` step 4 / post-processing: your instinct is correct but incompletely specified

You're right that if the agent outputs valid markdown/HTML, post-processing is probably unnecessary. But the validation script mentioned as a CLI option is doing two different jobs:

- **Structural validation**: does the output match the expected schema (frontmatter keys present, required sections exist)? This is cheap and deterministic — more like Vale or doc-structure-lint.
- **Quality validation**: does the output faithfully represent the intents in docspec? This requires another LLM pass.

These should be separate. Structural validation can run as a fast CI check (your `validate` command). Quality validation is essentially the `review` command. The `gen` command itself should do neither — it should generate and exit, and you run `validate` and `review` separately. This keeps `gen` fast and idempotent.

### 5. `update` (reconcile) command: "checks what changed from last commit" has a scope problem

Git diff tells you which *files* changed, but you need to know which *logical entities* changed to compute which outputs are affected. For example:

- `personas/openclaw_user/persona.md` changed → invalidates all how-tos and tutorials for that persona
- `rules.md` (global) changed → potentially invalidates everything
- `concepts/docker-isolation.md` changed → invalidates only outputs with `prereq_concepts: [docker-isolation]`

This dependency mapping needs to be computable from the manifest (step 2 of `gen`). The `update` command should reuse the manifest generation step, diff the manifest against the previous state, and then only re-run `gen` for affected outputs. Without the manifest as a stable intermediate artifact, the impact analysis becomes heuristic and fragile.

Concrete suggestion: after `gen` completes, write the manifest to `docspec/.manifest.json` (or similar). `update` reads this, computes the diff, and re-runs gen for affected items only.

### 6. `review` command: Cedar policy for internet blocking

You said "agent should NOT have access to the internet via Cedar, except for package registry and LLM endpoints." This is correct in intent. But saifctl's sandbox Cedar policy currently controls filesystem access — network access control is a separate concern and may require additional Cedar rules or network-level Docker isolation (e.g., `--network none` + allowlist). Worth checking whether saifctl's current Cedar + Docker setup can express "allow only these specific outbound endpoints" before assuming it can.

### 7. `init` command: introspection scope is underspecified

You've accepted the init command. The question is what it introspects. Options:

- **Codebase introspection**: reads your source code (CLI args, exports, config schema) to draft reference pointer files and a first-pass product.md
- **README introspection**: reads README for positioning language and drafts product.md and a persona sketch
- **Interactive wizard**: asks 3-4 questions (what does your tool do, who uses it, what are the main tasks) and scaffolds from answers

For a solo OSS maintainer, the README introspection path is probably the fastest path to something useful. The interactive wizard is the most beginner-friendly. Codebase introspection is the most powerful but most complex to implement. Pick one for v1 and call out the others as follow-up.

### 8. `validate` command: what exactly constitutes "drift"

Two distinct things could be called drift:

- **Manual edits to generated docs**: a generated file was hand-edited after generation. Detectable by comparing a hash or a content signature embedded in the generated file at gen time (e.g., a `<!-- generated-from: <manifest-entry-id>@<hash> -->` comment).
- **Docspec changes without regeneration**: the intent files changed but `gen` hasn't been re-run, so `docs/` is stale. Detectable by comparing docspec file mtimes or a stored manifest hash against the current manifest.

Both are valid. But they require different detection mechanisms. Being explicit about which one(s) `validate` checks avoids building the wrong thing.

### 9. Naming: `saifdocs` — minor but worth flagging

The name is consistent with the branding. One thing to check: does `saifdocs` as a package name read as "safe docs" or "SAIF docs"? Given the product is SaifCTL, `saifdocs` is fine. But if the tool is meant to be standalone (usable without saifctl, or with other doc systems eventually), a name that doesn't couple it to saifctl's branding might have longer legs. This is a soft concern, not a blocker.

---

## Summary of decisions needed before implementation

| # | Decision |
|---|---|
| 1 | vendor/ scope: scaffold template only, or actual vendored files (specify which) |
| 2 | Context delivery in gen step 3: pre-embedded task files, agent self-lookup, or hybrid |
| 3 | Gate script: how to communicate missing files back to agent |
| 4 | Validation: structural (fast, deterministic) vs quality (LLM) — separate into validate vs review |
| 5 | Manifest persistence: where to write it so update can do impact analysis |
| 6 | Cedar/Docker network isolation for review command: verify capability before relying on it |
| 7 | init command: pick one introspection strategy for v1 |
| 8 | validate command: define which drift type(s) to detect and how |

---

**User**

re 1) - you misunderstood. Yes, only a project skelenton in the *style* of the of saifctl - same tsconfig, eslint, build tooling, directory layout. I think I was fairly clear in that.

re "agent context delivery strategy needs a decision" - I'd rather that the agent looks it up themselves. each task may be still be in separate file, just to lower the chance of spillover when reading a single file with all the tasks. But with a lot of contexts and a lot of docs, inlining all of that info would be counterproductive. Instead, we should choose a powerful enough agent and model that can manage reading and looking up files. So yes, something like the hybrid approach.

re "Gate script logic needs to handle partial runs - yes absolutely.

re "Structural validation" - all fast, cheap, deterministic tests should be defined as a gate script. agree with what they should validate. The thing is, since we're running the agent inside the  sandbox, the sandbox setup and teardown will be the slowest part. so "keeping the gen command fast" is not necessarily achievable. So more likely, we'll want to move our review / validate scripts to run as part of the saifctl lifecycle. If we don't do that, then there will be an overhead of createing and desroying the saifctl sandbox and docker images and containers between each round. But re "These should be separate" - yes, the validate and review can be two separate CLI commands from the perspective of saifdocs.

re "docspec/.manifest.json" - sounds good.

re "Cedar policy for internet blocking" - Cedar policy files handle also networking access, not just filesystem (where did you get that incorrect idea from?)

re "init command" - screw it, don't add init command now, you're just making it complicated. we'll see at the end whether we really need it or not.

re '8. validate command: what exactly constitutes "drift"' - when a generated file is edited by hand, that's fine. We really only care if the files in docspecs have changed. we should prolly optionally allow to use AI at this step to decide whether the file changes are meaningful (meaning or intent changed) vs "changed whitespace or fixed typo".

re 'Naming: saifdocs' - saifctl is the main package. saifdocs is just a toy project to showcase what's possible with saifctl. If it gets as far as to be used standalone (without saifctl), then the future us can decide whether to rename the project or not.

---

**Cursor**

Got it, all clear. Let me consolidate the resolved decisions and flag the few remaining open questions.

---

## Resolved decisions

**1. Project skeleton** — style-copy of saifctl (tsconfig, eslint, build tooling, directory layout). saifctl installed as npm dependency. No vendored code.

**2. Agent context delivery** — hybrid. Each output gets its own task file (prevents spillover). Agent reads `docspec/` files itself rather than having everything inlined. Task file contains the manifest entry (which files to produce, which persona/concept/rules files to read) but not the full content of those files.

**3. Gate script + partial runs** — gate script checks file existence + non-empty, and echoes specifically which files are still missing so the agent can target the next loop iteration without redoing complete work.

**4. Structural validation location** — structural/deterministic checks live in the gate script (runs inside the sandbox lifecycle, avoids extra container spin-up overhead). `validate` and `review` are separate saifdocs CLI commands but each internally use the saifctl sandbox so they benefit from the same lifecycle.

**5. Manifest persistence** — written to `docspec/.manifest.json` after each `gen` run. `update` diffs against this to compute affected outputs.

**6. Cedar + networking** — Cedar policies handle both filesystem and network access. Network allow-list for `review` command: package registry + LLM endpoints only.

**7. init command** — deferred, not in scope for now.

**8. validate command** — detects docspec changes since last manifest. Optionally accepts a flag to use an LLM pass to distinguish meaningful changes (intent/meaning changed) from cosmetic changes (whitespace, typos). Manual edits to `docs/` are explicitly fine and not treated as drift.

**9. Naming** — `saifdocs`. Scoped to showcasing saifctl; rename decision deferred to if/when it becomes standalone.

---

## Two things still worth pinning down before implementation

**A. Task file format for the hybrid approach**

The task file per output needs enough structure for the agent to know what to fetch but not so much that it becomes a maintenance burden. Proposed minimal schema:

```yaml
---
output: docs/products/safe-agent/how-tos/protect-my-pc.md
type: how-to
read:
  - docspec/products/safe-agent/personas/openclaw_user/persona.md
  - docspec/products/safe-agent/personas/openclaw_user/tasks/protect-my-pc.md
  - docspec/products/safe-agent/personas/openclaw_user/rules.md
  - docspec/products/safe-agent/product.md
  - docspec/products/safe-agent/concepts/docker-isolation.md
  - docspec/rules.md
  - docspec/templates/pages/how-to.md
  - docs/references/commands/sandbox.md  # already generated
---
Generate the how-to guide for this task. Read the files listed above before writing.
```

The `read:` list is computed by the manifest step (step 2 of `gen`) using the dependency map we defined earlier. The agent has explicit instructions on where to look, but fetches the actual content itself. Does this match what you have in mind?

**B. `update` impact analysis granularity**

When a file in `docspec/` changes, the manifest diff needs to know which outputs to invalidate. Two levels:

- **File-level**: if `persona.md` changed, regenerate all outputs that listed it in their `read:` list. This is computable directly from the manifest with no AI needed.
- **Semantic-level**: optionally use LLM to decide if the change is meaningful before triggering regeneration (same optional flag as `validate`).

The file-level check is the default; semantic check is opt-in via `--ai-diff` flag (or whatever you want to call it). Agree with this approach?

---

**User**

re "A. Task file format for the hybrid approach" - looks good!

 re "B. update impact analysis granularity" - let's go with file-level only for now.

---

**Cursor**

Good. The design is fully resolved. Let me write up the complete spec as a single reference document you can use to implement or hand off.

---

## saifdocs — complete design spec

### What it is

A Node.js CLI tool that generates high-quality technical documentation from a human-authored intent model (`docspec/`). Uses saifctl's sandbox to run the generation and review agents. Documentation quality is enforced structurally via gate scripts and semantically via persona simulation.

---

### Project setup

- Node.js, TypeScript, same tsconfig/eslint/build tooling/directory layout as saifctl
- `@safe-ai-factory/saifctl` installed as npm dependency
- CLI built with citty (same as saifctl)
- Package name: `saifdocs`

---

### Directory layout

```
docspec/                          ← human-authored, source of truth, never published
  rules.md                        ← global rules (lowest priority)
  templates/
    pages/
      how-to.md                   ← optional intent: frontmatter
      tutorial.md
      concept.md
      reference.md
    blocks/
      inlined-example.md
  references/                     ← product-agnostic, code-derived
    commands/
      sandbox.md                  ← frontmatter: source:, type: cli-command
  products/
    safe-agent/
      product.md                  ← positioning, value prop, narrative
      rules.md                    ← product rules (overrides global)
      personas/
        openclaw_user/
          persona.md              ← who, emotional state, alternatives awareness
          rules.md                ← persona rules (highest priority)
          tasks/
            protect-my-pc.md     ← frontmatter: prereq_concepts, arrival_context,
                                  ←   search_terms, day_n
      concepts/
        docker-isolation.md      ← frontmatter: explains, reader_exits_knowing,
                                  ←   analogies_to_consider
      how-tos.md                  ← manifest: list of how-to intents
      tutorials.md                ← manifest: list of tutorial stages with
                                  ←   stage, enters_knowing, exits_knowing,
                                  ←   prereq_stage, persona
    software-factory/
      ...
  .manifest.json                  ← written by gen, read by update

docs/                             ← AI-generated build artifact, what users read
  products/
    safe-agent/
      index.md
      how-tos/
      tutorials/
      concepts/
  references/
    commands/
  audit.md
```

---

### Rules resolution order

Highest to lowest priority: **persona rules → product rules → global rules**

---

### Commands

#### `saifdocs gen`

Generates all documentation from `docspec/`.

**Steps:**

1. **Parse flags** into a single settings object (same pattern as saifctl's `buildOrchestratorCliInputFromFeatArgs`)

2. **Build manifest** — resolve all (persona × product × task) combinations and compute per-output dependency lists. For each output file to generate, produce a task file:

```yaml
---
output: docs/products/safe-agent/how-tos/protect-my-pc.md
type: how-to
read:
  - docspec/products/safe-agent/personas/openclaw_user/persona.md
  - docspec/products/safe-agent/personas/openclaw_user/tasks/protect-my-pc.md
  - docspec/products/safe-agent/personas/openclaw_user/rules.md
  - docspec/products/safe-agent/product.md
  - docspec/products/safe-agent/concepts/docker-isolation.md
  - docspec/rules.md
  - docspec/templates/pages/how-to.md
  - docs/references/commands/sandbox.md
---
Generate the how-to guide for this task. Read the files listed above before writing.
```

Write manifest to `docspec/.manifest.json`. Optionally export with `--export-manifest`.

3. **Generate content** — run saifctl sandbox with the task file. Agent reads `docspec/` files itself (hybrid approach — task file tells it what to read, agent fetches content). Gate script checks:
   - All expected output files exist
   - No output file is empty
   - Echoes specifically which files are missing so agent targets next loop precisely (same fail2pass pattern as saifctl)

4. **Validate** — structural validation runs as part of the gate script (inside the sandbox lifecycle, avoids extra container overhead). Optionally, a validation script path can be specified via config/CLI.

**Generation order** (respects dependencies):

```
source code
    │
    ▼
[1] Reference pages          (parallel, no doc inputs)
[2] Concept pages            (parallel, no doc inputs)
    │
    ▼
[3] How-to guides            (depends on reference pages)
    │
    ▼
[4] Tutorial stages          (depends on how-tos + concepts, ordered by prereq_stage)
    │
    ▼
[5] Product landing pages    (depends on all of the above)
    │
    ▼
[6] Gaps audit report        (reads full docs/ tree)
```

**CLI flags:**
- `--output-dir` — where to write generated docs (default: `docs/`)
- `--types` — which output types to generate (e.g. `how-tos,tutorials`, default: all)
- `--saifctl-config` — path to saifctl config file
- `--export-manifest` — write manifest to stdout or file before generating

---

#### `saifdocs update`

Regenerates only outputs affected by docspec changes since last `gen` run.

1. Read `docspec/.manifest.json` (previous state)
2. Diff changed docspec files (git diff or mtime comparison)
3. For each changed file, find all manifest entries whose `read:` list includes it
4. Re-run `gen` for affected outputs only

File-level impact analysis only (no LLM diff). Optionally accepts same flags as `gen`.

---

#### `saifdocs review`

Runs persona simulation against generated docs.

- Agent is given: persona file, task file (including arrival context and search terms), and the `docs/` tree
- Agent is told: "You are this persona, arriving from this search term, trying to accomplish this task. Navigate these docs using only what is here. Report where you got stuck, what was unclear, whether you succeeded."
- Cedar policy: network access restricted to package registry + LLM endpoints only. No open internet access.
- Output: review report to stdout or `docs/review/<run-id>.md`

---

#### `saifdocs validate`

Runs structural validation against existing `docs/` without regenerating. Useful in CI.

- Checks whether docspec files have changed since `docspec/.manifest.json` was last written
- Reports which outputs are stale (docspec changed, output not regenerated)
- Does not flag hand-edits to `docs/` as drift — manual edits are explicitly allowed
- `--ai-diff` flag (future): use LLM to distinguish meaningful changes from cosmetic ones (whitespace, typos) before reporting staleness

---

#### `saifdocs clear`

Deletes all output artifacts under `docs/` (or `--output-dir` if set). Does not touch `docspec/`.

---

### Key frontmatter schemas

**Task file** (`tasks/<task>.md`):
```yaml
---
product: safe-agent
persona: openclaw_user
prereq_concepts: [docker-isolation]
arrival_context: search        # search | readme | docs-link | error-message
search_terms: ["run openclaw safely", "openclaw docker sandbox"]
day_n: 0                       # 0=evaluating, 1=onboarding, 2=production
---
```

**Concept file** (`concepts/<concept>.md`):
```yaml
---
id: docker-isolation
explains: how saifctl containers isolate the agent from the host filesystem
reader_exits_knowing:
  - agent changes stay inside the container
  - nothing written to host unless --extract is passed
analogies_to_consider: [virtual machine, sandpit]
---
```

**Reference pointer file** (`references/commands/<cmd>.md`):
```yaml
---
source: src/cli/commands/sandbox.ts
type: cli-command
---
Human-authored context the code doesn't carry (e.g. when to use this vs feat run)
```

**Tutorial manifest entry** (`tutorials.md`):
```yaml
- id: run-openclaw-safely
  persona: openclaw_user
  stage: 1
  prereq_stage: ~
  enters_knowing: []
  exits_knowing: [what-sandbox-is, how-to-run-openclaw, what-extract-does]
  goal: reader can run openclaw without touching their host machine
```

**Template file** (`templates/pages/how-to.md`):
```yaml
---
intent: Reader is goal-oriented, already committed to using the tool, wants fastest path to outcome. No selling, no background theory.
---
```
(intent key optional, present only when it adds value beyond what persona/product/form context already implies)

---

### What is explicitly out of scope for v1

- `init` command (deferred)
- Multiple concurrent doc versions (handled via git branches — each branch is one version)
- Semantic/AI-powered impact analysis in `update` (file-level only for now)
- Coverage manifest (`coverage.md`) for gaps audit (gap detection via persona × product × task completeness check is sufficient)


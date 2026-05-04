# Installation: get saifdocs running locally

This is stage 2 of 4 in the saifdocs tutorial series. By the end of this page you will have the `saifdocs` CLI installed, verified that it can reach a [saifctl](https://docs.saif.ai/saifctl) sandbox, and confirmed the environment is ready for the next stage.

---

## Prerequisites

Before you begin:

- **Node.js 18 or later** — `node --version` should print `v18.x` or higher.
- **A saifctl account** — saifdocs delegates generation to a [saifctl](https://docs.saif.ai/saifctl) sandbox. If you do not have one, sign up at [saif.ai](https://saif.ai) before continuing. This is the only external dependency.

---

## Step 1: Install saifdocs

Install the CLI globally from npm:

```bash
npm install -g @safe-ai-factory/saifdocs
```

Or, if you prefer to keep it local to a project:

```bash
npm install --save-dev @safe-ai-factory/saifdocs
```

When installed locally, prefix every command below with `npx`, for example `npx saifdocs --version`.

---

## Step 2: Verify the CLI is available

Run:

```bash
saifdocs --version
```

You should see a version string such as `0.0.1`. If the command is not found, check that npm's global bin directory is on your `PATH`:

```bash
npm bin -g
```

Add that path to your shell's `PATH` if needed, then re-run `saifdocs --version`.

---

## Step 3: Configure your saifctl credentials

saifdocs uses [saifctl](https://docs.saif.ai/saifctl) to run one AI agent per documentation page inside an isolated sandbox. You need a `SAIFCTL_API_KEY` environment variable set before generation will work.

Export your key in your shell (or add it to your `.env` file / shell profile):

```bash
export SAIFCTL_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with the key from your saifctl account dashboard.

> **Note:** saifdocs reads `SAIFCTL_API_KEY` at generation time, not at install time. You can install saifdocs and explore its commands without a key; you only need the key when you actually run `saifdocs gen` or `saifdocs update`.

---

## Step 4: Confirm saifctl connectivity

Run the built-in connectivity check:

```bash
saifdocs gen --dry-run --docspec docspec/
```

Even without a `docspec/` directory in place yet, `--dry-run` will attempt to resolve the sandbox connection and exit with a clear error if credentials are missing or unreachable — rather than a confusing failure later during real generation. You will see output like:

```
✓ saifctl sandbox reachable
No docspec/ directory found at docspec/ — skipping manifest build.
```

The first line is what you need. If you see an authentication error instead, double-check that `SAIFCTL_API_KEY` is exported in the current shell session.

---

## Step 5: Explore available commands

Run `saifdocs --help` to see all commands:

```bash
saifdocs --help
```

The commands you will use throughout this tutorial series:

| Command | Purpose |
|---|---|
| `saifdocs gen` | Build the manifest and generate all pages |
| `saifdocs gen --dry-run` | Build the manifest only; do not invoke any agents |
| `saifdocs validate` | Check which generated pages are stale |
| `saifdocs update` | Regenerate only stale pages |
| `saifdocs audit` | Report pages declared in `docspec/` that have no output file yet |

You do not need to memorise these now. You have already used `gen --dry-run` in step 4. The others appear naturally in the next two tutorial stages.

---

## What you have set up

At this point:

- `saifdocs` is installed and on your `PATH`.
- `SAIFCTL_API_KEY` is set and the sandbox is reachable.
- You know the five core commands and what each one does.

You have not yet written any `docspec/` content or generated any pages — that is the next stage.

---

## Next step

Continue to [From docspec to docs](./docspec-to-docs.md) to write a minimal `docspec/` tree, run `saifdocs gen`, and see your first generated markdown files on disk.

// Saifdocs review sandbox — strict network (Leash Cedar)
//
// Same filesystem + process rules as review.cedar, but NetworkConnect is allowlisted
// instead of Host::"*". Use when you want persona simulation without open internet.
//
// Enable via:
//   saifdocs review ... --strict-network
// or explicitly:
//   saifdocs review ... --cedar <path-to-this-file>
//
// If installs or your LLM provider fail with connection errors, add the missing hostname
// below (same pattern as docs/leash-access-control.md in saifctl).

// ── Filesystem (same as review.cedar) ───────────────────────────────────────

permit (
    principal,
    action in [Action::"FileOpen", Action::"FileOpenReadOnly"],
    resource
) when {
    resource in [ Dir::"/" ]
};

permit (
    principal,
    action == Action::"FileOpenReadWrite",
    resource
) when {
    resource in [ Dir::"/workspace/", Dir::"/tmp/" ]
};

forbid (
    principal,
    action == Action::"FileOpenReadWrite",
    resource
) when {
    resource in [ Dir::"/workspace/.git/" ]
};

// ── Process execution ───────────────────────────────────────────────────────

permit (
    principal,
    action == Action::"ProcessExec",
    resource
) when {
    resource in [ Dir::"/" ]
};

// ── Network: package ecosystem + common LLM API hosts ───────────────────────
// Add hosts your agent / install path needs (e.g. api.deepseek.com, huggingface.co,
// *.amazonaws.com for Bedrock). Wildcard apex: Host::"*.example.com" per Leash docs.

permit (
    principal,
    action == Action::"NetworkConnect",
    resource
) when {
    resource in [
        // npm / pnpm / JSR
        Host::"registry.npmjs.org",
        Host::"npmjs.org",
        Host::"npm.jsr.io",

        // GitHub (tarballs, git deps, releases)
        Host::"github.com",
        Host::"objects.githubusercontent.com",
        Host::"codeload.github.com",

        // Anthropic
        Host::"api.anthropic.com",

        // OpenAI
        Host::"api.openai.com",

        // Google (Gemini, etc.)
        Host::"generativelanguage.googleapis.com",

        // OpenRouter (multi-provider)
        Host::"openrouter.ai",

        // xAI
        Host::"api.x.ai",

        // Groq
        Host::"api.groq.com",

        // Together AI
        Host::"api.together.xyz",

        // Mistral
        Host::"api.mistral.ai",

        // Cohere
        Host::"api.cohere.ai",

        // Fireworks
        Host::"api.fireworks.ai",

        // DeepInfra
        Host::"api.deepinfra.com",

        // Hugging Face Inference
        Host::"api-inference.huggingface.co",

        // Ollama default (local or tunneled); remove if unused
        Host::"localhost",
        Host::"127.0.0.1"
    ]
};

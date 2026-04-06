// Saifdocs review sandbox — Leash Cedar policy (permissive network)
//
// Same baseline as saifctl sandbox: read broadly, write under /workspace and /tmp,
// no writes to .git, process exec allowed, outbound NetworkConnect to any host (Host::"*").
//
// For hostname allowlisting (registry + LLM APIs only), use review-strict.cedar:
//   saifdocs review ... --strict-network
//   saifdocs review ... --cedar ./node_modules/saifdocs/review-strict.cedar

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

permit (
    principal,
    action == Action::"ProcessExec",
    resource
) when {
    resource in [ Dir::"/" ]
};

permit (
    principal,
    action == Action::"NetworkConnect",
    resource
) when {
    resource in [ Host::"*" ]
};

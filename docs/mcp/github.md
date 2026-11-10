# GitHub MCP (optional)

**Job**: issues, pull requests, code search and reviews from Claude Code.

**Honest note**: for a solo project the `gh` CLI does most of this with less context overhead. Install the MCP if you want richer issue and PR tooling, skip it if you want a lighter setup.

## Install

1. Create a **fine-grained** personal access token on GitHub limited to the `plainly` repository. Give it only Contents (read), Issues (read/write) and Pull requests (read/write).
2. Export it and add the server:

```bash
export GITHUB_PAT="github_pat_..."
claude mcp add --scope project --transport http github \
  https://api.githubcopilot.com/mcp/ \
  --header "Authorization: Bearer ${GITHUB_PAT}"
```

Manual config:

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${GITHUB_PAT}" }
    }
  }
}
```

## Verify

Ask: "List open issues in the plainly repository."

## Use

```
Create one GitHub issue per phase in PRD section 11 with its "done when" criteria as a checklist.
```

```
Open a pull request for this branch. Title in Conventional Commits style. Body: what changed, how to test, screenshots.
```

## Alternative without MCP

```bash
gh auth login
gh issue create --title "Phase 2: Analysis" --body-file docs/phase-2.md
gh pr create --fill
```

# Humanizer MCP

**Job**: reviews text for typical AI-writing patterns (filler vocabulary, stock phrases, rhythm) and tells Claude what to change, so your copy reads like a person wrote it. Use it on landing copy, empty states, error messages, the README and the case study.

## Prerequisite

`uv` (gives you `uvx`):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

## Install (recommended: `humanizer-mcp`, PyPI)

```bash
claude mcp add --scope project humanizer -- uvx humanizer-mcp
```

Manual config:

```json
{ "mcpServers": { "humanizer": { "command": "uvx", "args": ["humanizer-mcp"] } } }
```

Try it without a client:

```bash
npx @modelcontextprotocol/inspector uvx humanizer-mcp
```

## Alternative: `@infracortex/humanizer-mcp`

Exposes `humanize_text`, `detect_ai_patterns` and `apply_voice_profile` (brand voice). It calls the Anthropic API, so it needs a key:

```json
{
  "mcpServers": {
    "humanizer": {
      "command": "npx",
      "args": ["-y", "@infracortex/humanizer-mcp"],
      "env": { "ANTHROPIC_API_KEY": "sk-ant-..." }
    }
  }
}
```

Keep the key in your shell environment, never in git.

## Optional: the Humanizer skill

A Claude Code skill based on Wikipedia's "Signs of AI writing" guide. Copy its `SKILL.md` to `~/.claude/skills/humanizer/` and restart Claude Code. It works well next to the MCP.

## Verify

`/mcp` shows `humanizer` and its tool names. Use the names shown there, they can differ by version.

## Use

```
Run this hero copy through the humanizer, keep the meaning and the length, and show a before/after table.
```

```
Check every string in messages/en.json for AI patterns. Fix the worst 10. Do not touch placeholders like {name}.
```

## A word of advice

The tool removes patterns. It does not give you a voice. After it runs, read the text out loud and change anything you would never say. Specific details (a real example from your own paperwork) beat any filter. Translate to fr and zh from the humanized English, then humanize again in each language, because patterns differ.

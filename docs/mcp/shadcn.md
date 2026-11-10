# shadcn MCP

**Job**: lets Claude search, preview and install components from the shadcn registry and any registry you add, such as React Bits. You get real source files in your repo, not a locked dependency.

## Install

Inside the Next.js project (after `shadcn init`):

```bash
pnpm dlx shadcn@latest mcp init --client claude
```

This writes the server entry in `.mcp.json`. Manual form:

```json
{ "mcpServers": { "shadcn": { "command": "npx", "args": ["shadcn@latest", "mcp"] } } }
```

## Add the React Bits registry

Open the component you want on reactbits.dev, go to its **Installation** tab, choose the shadcn option and copy the exact command. If it uses a registry alias, add the registry to `components.json` as shown on the site, for example:

```json
{
  "registries": {
    "@react-bits": "https://reactbits.dev/r/{name}.json"
  }
}
```

Registry URLs can change. The command on the component page is the source of truth.

## Verify

`claude mcp list` shows `shadcn`. Ask: "List the shadcn components available."

## Use

```
Use shadcn MCP to add Button, Input, Tabs, Sheet, Badge, Skeleton and Sonner, then restyle them
with the tokens in docs/DESIGN.md.
```

```
Add the React Bits background I choose from reactbits.dev as a lazy client component under
src/shared/ui/effects/, with a static fallback for reduced motion.
```

## Notes

React Bits components are copied into your repo. Read them once before shipping: check bundle size, `"use client"`, and cleanup of WebGL contexts.

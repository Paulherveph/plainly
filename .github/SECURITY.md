# Security policy

## Reporting a vulnerability

**Please don't open a public issue.**

Use GitHub's private reporting: the **Security** tab → **Report a vulnerability**. Only the maintainer can see the report.

Please include:

- what is affected (page, route, function),
- the steps to reproduce it,
- what an attacker could do with it.

You'll get a reply within 7 days. Once a fix ships, you're credited in the advisory unless you'd rather stay anonymous.

## Scope

In scope: this repository's code, database policies (RLS), and the handling of uploaded documents and AI output.

Out of scope: third-party services (Supabase, AI providers, Vercel), and findings that need a compromised device or leaked keys.

## Supported versions

Only the latest `main` gets security fixes.

The controls already in place, and how each one was checked, are in [docs/SECURITY.md](../docs/SECURITY.md).

# Contributing to Plainly

Thanks for taking the time. Plainly is open source under the [MIT license](LICENSE): fork it, learn from it, build on it.

## Ways to help

- **Report a bug.** Open an [issue](../../issues/new/choose) with the steps to reproduce it. Never attach a real personal document: use the files in [`test-documents/`](test-documents/) or a made-up one.
- **Suggest a feature.** Open an issue first, so we can agree on it before you write code. Check the non-goals in [PRD.md](PRD.md).
- **Send a pull request.** Small and focused is best: one fix or one feature per PR.
- **Security problem?** Don't open a public issue. Follow [SECURITY.md](.github/SECURITY.md).

## How changes get in

`main` is protected. Nobody pushes to it directly, the maintainer included. Every change goes through a pull request that:

1. comes from a branch in **your fork**,
2. passes CI (`pnpm check` and the end-to-end tests),
3. is reviewed and approved by the maintainer ([CODEOWNERS](.github/CODEOWNERS)).

## Set up

Follow the [Quick start](README.md#quick-start) and the project rules in [AGENTS.md](AGENTS.md). For a ready account with any plan and credits, see [Test accounts](docs/TEST_ACCOUNTS.md). The fake AI (`USE_FAKE_AI=true`) is enough for most work: it is free, offline and deterministic.

```bash
git clone https://github.com/<you>/plainly.git
cd plainly
git remote add upstream https://github.com/paulherveph/plainly.git
git switch -c fix/short-description
```

## Before you open the PR

```bash
pnpm check     # Biome, TypeScript, unit tests, dependency rules
pnpm e2e       # if you changed a page or a flow
```

Then check this list:

- [ ] It follows the dependency rule `domain ← application ← infrastructure / ui` ([ARCHITECTURE.md](docs/ARCHITECTURE.md)).
- [ ] Domain logic has a test. No test was weakened or skipped.
- [ ] User-facing text lives in `apps/web/messages/{en,fr,zh}.json`, in all three files.
- [ ] No document content in logs, URLs or error messages.
- [ ] No secrets, keys or `.env*` files, and no real documents (`pnpm check` fails on a PDF, image or Office file outside the fixture folders).
- [ ] No new dependency without a one-line reason in the PR.
- [ ] UI changes include screenshots at 375, 768 and 1440 px.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.

```
fix(chat): keep the citation when the answer is one sentence
```

## Code of conduct

Be kind and constructive. See [CODE_OF_CONDUCT.md](.github/CODE_OF_CONDUCT.md).

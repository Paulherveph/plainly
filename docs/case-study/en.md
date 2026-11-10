# Plainly: reading paperwork in a second language

## Problem

A lease in French, a residence permit letter, a job offer full of clauses. When the document is in a language you read slowly, the risk is in what you miss: a deposit due in nine days, a lease that renews unless you write three months ahead, a non-compete you never noticed. Translation tools give you the words, but they don't tell you what to do or by when.

Plainly takes one document and returns a plain summary, the key facts, the actions with their dates, the clauses to watch, and a chat that answers only from that document. Explanations come in English, French or Chinese, whatever language the original is in.

## Constraints

- **Privacy.** People upload documents with their address, salary or immigration status. Files live in a private bucket behind row-level security, open through 60-second signed links, and are deleted after 30 days or with one button. Document text never reaches logs.
- **Cost.** A guest can try it without signing up, so usage has to stay bounded: 10 MB and 20 pages per file, 5 analyses a day for guests and 20 for members, one cached analysis per document and language.
- **Trust.** A model that invents a deadline is worse than no tool at all. Every claim has to be checkable.

## Key decisions

1. **Claude reads the original file.** There is no OCR pipeline or vector database. The PDF or photo goes to the model as is, and page text is extracted only to check quotes.
2. **Quote verification decides what you see.** Every fact, action and warning carries a verbatim quote. The app checks each quote against the page text after normalising spacing, case and line-break hyphens. If the quote isn't there, the claim is removed and the page says so. The chat follows the same rule: no verified quote, no answer.
3. **Ports and adapters.** Use cases depend on interfaces. Each AI port has a Claude adapter and a deterministic fake, so the whole app, including end-to-end tests in CI, runs offline at no cost.
4. **Guests first.** Visitors get an anonymous account the first time they open the app, and keep their documents when they sign in with Google or an email link.

## Results

- 66 unit and use-case tests, 24 database assertions proving one user can't read or change another's rows, 19 end-to-end tests on desktop and mobile.
- Eval set of 10 documents in three languages. On the deterministic baseline, 98% of claims pass quote verification and no unstated dates appear. Live model scores: _to add after the first run with an API key_.
- Lighthouse on mobile: accessibility 100, best practices 100, performance 93 to 96 with an observed LCP of about half a second.
- Code per layer: domain 508 lines, application 561, infrastructure 1,158, UI 1,756.
- Demo video: _to add_.

## What I would do next

Compare two versions of a document and show what changed, send a reminder email before a deadline, and run the eval on every pull request so a prompt change can't lower the verification rate unnoticed.

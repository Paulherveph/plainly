/**
 * Keeps real documents out of the repository. Fails if a tracked PDF, image or Office file sits
 * outside the folders that hold fictional fixtures and design assets. Runs in `pnpm check` (CI).
 *   node scripts/check-files.mjs
 * A new fixture folder must be added to ALLOWED in the same pull request, with a reason.
 */
import { execFileSync } from "node:child_process";

const DOCUMENT_FILE =
  /\.(pdf|png|jpe?g|webp|gif|avif|heic|heif|tiff?|bmp|svg|docx?|xlsx?|pptx?|odt|ods|odp|rtf|pages|numbers|key|zip|eml|msg)$/i;
const MEDIA = /\.(png|jpe?g|webp|gif|avif|svg|ico)$/i; // screenshots, icons, posters
const ANY = /./;

/** Folder → which of those files it may hold. Site and design folders take images only, never PDFs or Office files. */
const ALLOWED = [
  ["apps/web/samples/", /\.pdf$/i], // built-in fictional samples
  ["test-documents/", ANY], // fictional documents for manual testing
  ["apps/web/public/", MEDIA], // icons, screenshots and video posters served by the site
  ["apps/web/src/app/", MEDIA], // favicon and app icons
  ["assets/media/", MEDIA], // screenshots and the walkthrough
  ["docs/gate-reports/", MEDIA], // quality-gate screenshots of the app
];

const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const outside = tracked.filter(
  (f) => DOCUMENT_FILE.test(f) && !ALLOWED.some(([dir, types]) => f.startsWith(dir) && types.test(f)),
);

if (outside.length > 0) {
  console.error("These files look like documents or images outside the allowed fixture folders:");
  for (const f of outside) console.error(`  ${f}`);
  console.error(
    `Never commit real documents. Allowed: ${ALLOWED.map(([dir, types]) => `${dir} (${types === ANY ? "any" : types.source})`).join(", ")}`,
  );
  process.exit(1);
}
console.log(`check-files: ${tracked.length} tracked files, no documents outside fixture folders`);

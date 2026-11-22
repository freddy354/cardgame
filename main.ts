// main.ts — Three Lanterns, the hand-in program (Node 22, stdlib only).
// The game itself is game/ (plain static files a desktop browser loads
// offline) and the screenshots are screenshots/ (real renders of the game).
// This program copies both into the output directory and writes
// dossier.json, the summary the judge reads, using the vendored make.fun
// library. It does the same thing every run: same files in, same bytes out.
//
// Run it outside the grader's container with MAKEFUN_OUTPUT_DIR:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The dossier text cap is the scorer's own limit (see the kit's gate);
// naming it keeps the number in one place instead of buried in the call.
const DOSSIER_TEXT_MAX_BYTES = 163840;

// Fail fast with a clear message if the game folder is missing, instead
// of letting cpSync throw a cryptic ENOENT halfway through the copy.
if (!existsSync(join(here, 'game'))) {
  throw new Error(`game/ not found next to main.ts (looked in ${here})`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The caps are the scorer's own (see the kit's gate): only text_max_bytes
// shapes the dossier's bytes; the rest refuse an entry the scorer would
// refuse — more than 4 screenshots or one over 256 KiB, more than 993
// entries under game/ or 48 MiB of game files, or a game path over 1000
// bytes. Passing them here makes this program fail where the scorer would.
const dossierCaps = {
  text_max_bytes: DOSSIER_TEXT_MAX_BYTES,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Build the dossier twice and refuse to write it unless both builds agree
// byte for byte: the dossier must be deterministic, and catching a
// difference here beats the scorer refusing the entry later.
const dossier = buildDossier(out, dossierCaps);
const dossierAgain = buildDossier(out, dossierCaps);
if (!Buffer.from(dossier).equals(Buffer.from(dossierAgain))) {
  throw new Error('dossier.json is not deterministic: two builds differ');
}
writeFileSync(join(out, 'dossier.json'), dossier);

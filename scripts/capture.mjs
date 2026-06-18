// stabilType README visual capture (reproducible harness).
// Serves the repo over HTTP, renders scripts/capture.html in headless Chromium,
// drives the real applyStabilType algorithm from the built dist bundle, and writes:
//   assets/states.png  — three static cards at rest / mid / peak velocity
//   assets/hero.gif     — a card reacting through a scroll arc (rest → fast → settle)
//
// Prereqs: `npm run build` (so dist/index.js exists) and ffmpeg on PATH.
// Run:     node scripts/capture.mjs   (or: npm run capture)

import { createServer } from "node:http";
import { readFile, mkdir, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright";

const ROOT = process.cwd();
const MIME = {
	".html": "text/html", ".js": "application/javascript", ".mjs": "application/javascript",
	".css": "text/css", ".json": "application/json", ".map": "application/json",
	".png": "image/png", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff",
};

const server = createServer(async (req, res) => {
	try {
		const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
		const path = join(ROOT, url === "/" ? "/scripts/capture.html" : url);
		const data = await readFile(path);
		res.writeHead(200, { "Content-Type": MIME[extname(path)] ?? "application/octet-stream" });
		res.end(data);
	} catch {
		res.writeHead(404);
		res.end("not found");
	}
});

await new Promise((r) => server.listen(0, r));
const { port } = server.address();

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.goto(`http://localhost:${port}/scripts/capture.html`, { waitUntil: "networkidle" });
await page.evaluate(() => window.__ready ?? document.fonts.ready);
await page.waitForTimeout(500); // let the variable font paint

// ── Static still: the three-state ramp ──────────────────────────────────────
const states = await page.$("#states");
await states.screenshot({ path: "assets/states.png", omitBackground: true });
console.log("captured assets/states.png");

// ── Hero loop: scripted scroll arc, one PNG frame per velocity sample ────────
const FRAMES_DIR = join(ROOT, "assets", "_frames");
await rm(FRAMES_DIR, { recursive: true, force: true });
await mkdir(FRAMES_DIR, { recursive: true });

// Velocity arc: hold at rest, accelerate to peak, hold, decay back to rest.
// y drives the main adaptation + downward tilt; a touch of x adds a subtle lateral tilt.
function arc(t) {
	// t in [0,1) over the whole loop
	if (t < 0.12) return 0;                         // rest
	if (t < 0.42) return (t - 0.12) / 0.30;         // ramp up to 1
	if (t < 0.58) return 1;                         // hold at peak
	if (t < 0.92) return 1 - (t - 0.58) / 0.34;     // decay to 0
	return 0;                                       // rest tail
}

const FRAME_COUNT = 48;
const hero = await page.$("#hero");
for (let i = 0; i < FRAME_COUNT; i++) {
	const t = i / FRAME_COUNT;
	const vy = arc(t);
	const vx = vy * 0.18; // small coupled lateral component for depth
	await page.evaluate(([x, y]) => window.__setHero(x, y), [vx, vy]);
	await page.waitForTimeout(16); // let the style write paint
	const n = String(i).padStart(3, "0");
	await hero.screenshot({ path: join(FRAMES_DIR, `f${n}.png`), omitBackground: false });
}
console.log("captured %d hero frames", FRAME_COUNT);

await browser.close();
server.close();

// ── Assemble the GIF with ffmpeg ─────────────────────────────────────────────
// Single pass: scale to a README-friendly width, generate a diff palette, and
// dither — tuned to keep the file ~1.2 MB while preserving the dark gradient.
const gif = spawnSync("ffmpeg", [
	"-y", "-framerate", "24", "-i", join(FRAMES_DIR, "f%03d.png"),
	"-vf", "fps=18,scale=760:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5",
	"-loop", "0", "assets/hero.gif",
], { stdio: "inherit" });
if (gif.status !== 0) { console.error("ffmpeg gif failed"); process.exit(1); }

await rm(FRAMES_DIR, { recursive: true, force: true });
console.log("assembled assets/hero.gif");

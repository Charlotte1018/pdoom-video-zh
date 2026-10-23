#!/usr/bin/env bun
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP = resolve(import.meta.dir, '..');
const OUT = resolve(APP, '../out/verification-zh');
const port = 5400 + Math.floor(Math.random() * 400);
const url = `http://127.0.0.1:${port}`;
const server = Bun.spawn(['bunx', 'vite', '--port', String(port), '--strictPort'], {
  cwd: APP,
  stdout: 'ignore',
  stderr: 'ignore',
  env: { ...process.env, PDOOM_NO_HMR: '1' },
});

async function reachable() {
  try { return (await fetch(url, { signal: AbortSignal.timeout(800) })).ok; }
  catch { return false; }
}

for (let i = 0; i < 150 && !(await reachable()); i++) await Bun.sleep(100);
if (!(await reachable())) throw new Error(`Vite did not start at ${url}`);

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
});

try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) browserErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) browserErrors.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`${url}/?export=1`);
  await page.waitForFunction(
    () => (window as any).__pdoom?.ready || (window as any).__pdoom?.error,
    null,
    { timeout: 120_000 },
  );

  const report = await page.evaluate(async () => {
    const P = (window as any).__pdoom;
    if (P.error) throw new Error(P.error);
    if (P.project !== 'pdoom-video-zh') throw new Error(`Wrong project: ${P.project}`);

    const cols = 5, cw = 384, ch = 216, label = 24;
    const rows = Math.ceil(P.timeline.length / cols);
    const sheet = document.createElement('canvas');
    sheet.width = cols * cw;
    sheet.height = rows * (ch + label);
    const sc = sheet.getContext('2d')!;
    sc.fillStyle = '#111';
    sc.fillRect(0, 0, sheet.width, sheet.height);
    const source = document.getElementById('c') as HTMLCanvasElement;
    const samples: { scene: string; t: number; milliseconds: number; energy: number }[] = [];
    const sampleAt = async (scene: string, t: number) => {
      const before = performance.now();
      P.still(t, 1, 0.3);
      const pixels = await P.engine.readPixelsAsync();
      let energy = 0;
      for (let i = 0; i < pixels.length; i += 4096) energy += pixels[i] + pixels[i + 1] + pixels[i + 2];
      samples.push({ scene, t, milliseconds: performance.now() - before, energy });
    };

    const checkpoints: { scene: string; t: number; sheetIndex?: number }[] = [];
    for (let index = 0; index < P.timeline.length; index++) {
      const entry = P.timeline[index];
      checkpoints.push({ scene: entry.id, t: entry.start + 0.02 });
      checkpoints.push({ scene: entry.id, t: (entry.start + entry.end) / 2, sheetIndex: index });
      checkpoints.push({ scene: entry.id, t: entry.end - 0.02 });
    }
    // Exercise every sung word window as well as scene boundaries. Many labels only
    // appear for a fraction of a scene, so three scene samples alone cannot audit them.
    for (const line of P.engine.lyrics.lines) {
      for (let index = 0; index < line.words.length; index++) {
        const word = line.words[index];
        checkpoints.push({ scene: `歌词 ${line.i + 1}/${index + 1}`, t: (word.start + word.end) / 2 });
      }
    }
    checkpoints.sort((a, b) => a.t - b.t);
    for (const checkpoint of checkpoints) {
      await sampleAt(checkpoint.scene, checkpoint.t);
      if (checkpoint.sheetIndex === undefined) continue;
      const index = checkpoint.sheetIndex;
      const x = (index % cols) * cw;
      const y = Math.floor(index / cols) * (ch + label);
      sc.drawImage(source, x, y, cw, ch);
      sc.fillStyle = '#111';
      sc.fillRect(x, y + ch, cw, label);
      sc.fillStyle = '#eee';
      sc.font = '16px "Noto Sans SC", sans-serif';
      sc.fillText(`${index + 1}. ${checkpoint.t.toFixed(2)} 秒`, x + 8, y + ch + 17);
    }

    // Mixed Latin/CJK scenes must advance by each rendered glyph's real width.
    // A fixed Latin monospace cell makes the wider Chinese fallback glyphs collide.
    const layoutFailures: string[] = [];
    const metric = document.createElement('canvas').getContext('2d')!;
    const promptIds = ['prompt1', 'prompt2', 'prompt3'];
    for (const id of promptIds) {
      const scene = P.engine.loaded.get(id)?.scene as any;
      const chars = Array.from(String(scene?.text ?? ''));
      const xs = scene?.glyphXs as number[] | undefined;
      if (!xs || xs.length !== chars.length + 1) {
        layoutFailures.push(`${id}: missing per-glyph advance map`);
        continue;
      }
      metric.font = `60px "${scene.fam}", "NotoSansSC"`;
      for (let i = 0; i < chars.length; i++) {
        const advance = xs[i + 1]! - xs[i]!;
        const required = metric.measureText(chars[i]!).width;
        if (advance + 0.5 < required) {
          layoutFailures.push(`${id}: glyph ${JSON.stringify(chars[i])} advances ${advance.toFixed(2)}px, needs ${required.toFixed(2)}px`);
          break;
        }
      }
    }

    const bureau = P.engine.loaded.get('bureau')?.scene as any;
    metric.font = '50px "Plex-500", "NotoSansSC"';
    for (const name of ['findings', 'conclusion'] as const) {
      const chars = (bureau?.[name] ?? []) as { ch: string; x: number; y: number }[];
      for (let i = 0; i + 1 < chars.length; i++) {
        const current = chars[i]!, next = chars[i + 1]!;
        if (current.y !== next.y) continue;
        const advance = next.x - current.x;
        const required = metric.measureText(current.ch).width;
        if (advance + 0.5 < required) {
          layoutFailures.push(`bureau.${name}: glyph ${JSON.stringify(current.ch)} advances ${advance.toFixed(2)}px, needs ${required.toFixed(2)}px`);
          break;
        }
      }
    }

    const audit = ((globalThis as any).__zhTextAudit ?? []) as { source: string; output: string }[];
    return {
      project: P.project,
      duration: P.duration,
      scenes: P.timeline.length,
      samples,
      audit,
      layoutFailures,
      engineErrors: P.errors,
      sheet: sheet.toDataURL('image/jpeg', 0.88),
    };
  });

  const allowed = [
    /^(?:P\(?DOOM\)?|P\(?doom\)?|P\(Ω\)|Q\*|AGI|GPU|MLP|RLHF|NVDA|FOOM|SRR|PDR|CDR|TRR)$/u,
    /^(?:ChatGPT|Sydney|Gato|Chinchilla|Loom)[\p{P}\p{S}]*$/u,
    /^(?:T|N|B|C|H|L|O|Q|K|V|DC|CH\d)$/u,
    /^(?:top-p|seed|FLOP\/s|rgb24|v\d+(?:\.\d+)*)$/iu,
    /^[A-Z]\d?(?:[−-]\d+)?$/u,
    /^(?:\\begin|\\end|\\draw|\\fill|\\foreach)\b/u,
    /^(?:\d+\s+)?P\((?:DOOM|doom)\)(?:\s+[\d.]+)?$/u,
    /^PC · IR · ACC · MAR · MDR$/u,
    /^NV 10³⁰ \d+ A$/u,
    /^字宽 [\d.]+  ·  d\(智能爆炸\)\/dt > 0$/u,
    /TikZ/u,
    /Substack/u,
    /^Archi(?:vo)?/u,
    /P\(d(?:o(?:o(?:m\)?)?)?)?/iu,
  ];
  const untranslated = report.audit
    .filter(({ source, output }) => source === output && /[A-Za-z]{2}/u.test(output))
    .map(({ output }) => output.trim())
    .filter((value, index, all) => value && all.indexOf(value) === index)
    .filter((value) => !allowed.some((pattern) => pattern.test(value)))
    .sort((a, b) => a.localeCompare(b));
  const blankFrames = report.samples.filter((sample) => sample.energy === 0);

  mkdirSync(OUT, { recursive: true });
  const { sheet, ...json } = report;
  writeFileSync(resolve(OUT, 'report.json'), JSON.stringify({ ...json, browserErrors, untranslated, blankFrames }, null, 2));
  writeFileSync(resolve(OUT, 'contact-sheet.jpg'), Buffer.from(sheet.split(',')[1]!, 'base64'));

  console.log(JSON.stringify({
    project: report.project,
    scenes: report.scenes,
    checkedFrames: report.samples.length,
    browserErrors: browserErrors.length,
    engineErrors: report.engineErrors.length,
    blankFrames: blankFrames.length,
    layoutFailures: report.layoutFailures,
    untranslated,
  }, null, 2));

  const failures = [
    ...browserErrors,
    ...report.engineErrors,
    ...blankFrames.map((frame) => `Blank frame: ${frame.scene} @ ${frame.t}`),
    ...report.layoutFailures.map((failure) => `Overlapping text: ${failure}`),
    ...untranslated.map((text) => `Untranslated canvas text: ${text}`),
  ];
  if (failures.length) throw new Error(failures.join('\n'));
} finally {
  await browser.close();
  server.kill();
}

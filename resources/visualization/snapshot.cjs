#!/usr/bin/env node
/**
 * snapshot.js — convert a hey-d visualization fragment into a standalone HTML file.
 *
 * Usage:
 *   node snapshot.js <fragment.html> [--out <output.html>] [--title <title>]
 *
 * Behaviour:
 *   - Reads the input fragment. If it contains <main>...</main>, extracts the
 *     inner content; otherwise uses the whole file as content.
 *   - Inlines (in order, cascade wins):
 *       - tailwind.css from <plugin>/resources/visualization/
 *       - theme.css from plugin
 *       - optional theme override from <cwd>/.agents/config/visualization/theme.css
 *       - components.js from plugin
 *       - optional components override from <cwd>/.agents/config/visualization/components.js
 *   - Writes a self-contained HTML file to <output> (default: <input>.snapshot.html).
 */

'use strict';

const fs = require('fs');
const path = require('path');

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.error('Usage: snapshot.js <fragment.html> [--out <output>] [--title <title>]');
    process.exit(args.length === 0 ? 1 : 0);
  }

  const input = args[0];
  const outIdx = args.indexOf('--out');
  const output = outIdx >= 0 ? args[outIdx + 1] : input.replace(/\.html$/, '') + '.snapshot.html';
  const titleIdx = args.indexOf('--title');
  const title = titleIdx >= 0 ? args[titleIdx + 1] : path.basename(input, '.html');

  const here = __dirname;
  const fragment = fs.readFileSync(input, 'utf-8');

  // Extract <main> content if present, else use whole file
  const mainMatch = fragment.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  const content = mainMatch ? mainMatch[1] : fragment;

  // Load resources (with graceful fallback for missing optional files)
  const tailwindCss = readOrEmpty(path.join(here, 'tailwind.css'));
  const themeCss = readOrEmpty(path.join(here, 'theme.css'));
  const componentsJs = readOrEmpty(path.join(here, 'components.js'));

  const projectRoot = process.cwd();
  const projectThemeCss = readOrEmpty(path.join(projectRoot, '.agents/config/visualization/theme.css'));
  const projectComponentsJs = readOrEmpty(path.join(projectRoot, '.agents/config/visualization/components.js'));

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${tailwindCss}</style>
  <style>${themeCss}</style>${projectThemeCss ? `
  <style>${projectThemeCss}</style>` : ''}
  <script>${componentsJs}</script>${projectComponentsJs ? `
  <script>${projectComponentsJs}</script>` : ''}
</head>
<body>
  <main>
${content}
  </main>
</body>
</html>
`;

  fs.writeFileSync(output, html);
  console.log(`Wrote ${output} (${(html.length / 1024).toFixed(1)} KB)`);
}

function readOrEmpty(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return ''; }
}

function escapeHtml(s) {
  return s.replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

main();

// Builds self-contained HyperFrames compositions: src/*.html -> build/*.html
// Inlines SVGs from ../design (Bruno moods and recolour vars only work inline) and the word list.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const design = join(here, '..', 'design');
const read = p => readFileSync(p, 'utf8');
const svg = rel => read(join(design, rel)).replace(/<\?xml[^>]*>\s*/, '').trim();

const words = JSON.parse(read(join(design, 'words.json')));
const wordMap = Object.fromEntries(words.map(w => [w.letter, { word: w.word, svg: svg(w.file) }]));
const common = read(join(here, 'src', 'common.css'));

mkdirSync(join(here, 'build'), { recursive: true });
for (const f of readdirSync(join(here, 'src')).filter(f => f.endsWith('.html'))) {
  let html = read(join(here, 'src', f));
  html = html.replace('{{COMMON_CSS}}', common);
  html = html.replace(/\{\{SVG:([\w\-/.]+)\}\}/g, (_, rel) => svg(rel));
  html = html.replace('{{WORDS_JSON}}', () => JSON.stringify(wordMap).replace(/<\/script/gi, '<\\/script'));
  writeFileSync(join(here, 'build', f), html);
  console.log('built build/' + f, (html.length / 1024).toFixed(1) + ' KB');
}

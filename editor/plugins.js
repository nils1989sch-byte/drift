// DRIFT-Editor – Plugin-Liste.
// Andere Agenten tragen hier ihre Module ein (Pfade relativ zu DIESER Datei, z. B. './tools/smart-terrain.js').
// Jedes Modul exportiert `default function (editor) { … }` (oder `export function register(editor)`).
// Fehler in einem Plugin werden abgefangen und als Hinweis angezeigt – sie blockieren den Editor nicht.
// API: docs/EDITOR.md
export default [
  // './tools/index.js',
  // './inspectors/index.js',
  './importer/index.js',
];

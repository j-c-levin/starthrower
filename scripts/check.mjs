import { readdirSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const files = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = `${dir}/${f}`;
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.js')) files.push(p);
  }
})('js');
for (const f of files) await import(pathToFileURL(f));
console.log(`ok: imported ${files.length} modules`);

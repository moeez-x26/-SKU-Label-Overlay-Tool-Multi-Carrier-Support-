// PDF.js auxiliary resources are served from the same local origin.
import {cpSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
const root=dirname(require.resolve('pdfjs-dist/package.json'));
for(const dir of ['standard_fonts','cmaps','wasm']) {
 mkdirSync(join('public',dir),{recursive:true});
 cpSync(join(root,dir),join('public',dir),{recursive:true});
}

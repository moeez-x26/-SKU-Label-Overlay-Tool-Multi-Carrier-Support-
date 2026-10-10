import {defineConfig} from 'vite';
import {cpSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
export default defineConfig({
 build:{target:'es2022',chunkSizeWarningLimit:1500},
 plugins:[{name:'pdf-resources',closeBundle(){const root=dirname(require.resolve('pdfjs-dist/package.json'));for(const dir of ['standard_fonts','cmaps','wasm']){mkdirSync('dist/'+dir,{recursive:true});cpSync(join(root,dir),'dist/'+dir,{recursive:true});}}}]
});

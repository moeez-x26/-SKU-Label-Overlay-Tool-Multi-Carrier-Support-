import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {build} from 'vite';
import {PDFDocument,StandardFonts} from 'pdf-lib';

test('browser bundle opens and reopens PDFs without Workers or module downloads',async()=>{
 const built=await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,target:'es2022',lib:{entry:fileURLToPath(new URL('../src/pdf.js',import.meta.url)),name:'LabelPDF',formats:['iife']}}});
 const bundle=Array.isArray(built)?built[0]:built;
 const code=bundle.output.find(item=>item.type==='chunk').code;
 let workerAttempts=0,networkAttempts=0;
 const context=vm.createContext({
  console:{log(){},warn(){},error(){}},setTimeout,clearTimeout,performance,
  URL,URLSearchParams,Blob,TextDecoder,TextEncoder,ReadableStream,WritableStream,TransformStream,structuredClone,
  AbortController,AbortSignal,Response,Request,Headers,Event,EventTarget,DOMException,MessageChannel,MessagePort,
  atob,btoa,queueMicrotask,crypto,
  // Text extraction does not use canvas transforms, but PDF.js creates its
  // rendering matrix at module initialisation in a browser.
  DOMMatrix:class DOMMatrix{},
  Worker:class Worker{constructor(){workerAttempts++;throw Error('Workers blocked by host');}},
  fetch:async()=>{networkAttempts++;throw Error('External assets unavailable');},
  navigator:{language:'en-GB',platform:'test',userAgent:'Mozilla/5.0'},
 });
 vm.runInContext(code,context,{timeout:10000});
 context.LabelPDF.pdfOptions.standardFontDataUrl=null;
 const source=await PDFDocument.create();const font=await source.embedFont(StandardFonts.Helvetica);
 source.addPage([298,420]).drawText('TRACKING-123 / 1x TEST-SKU',{x:20,y:200,font,size:14});
 source.addPage([298,420]).drawText('TRACKING-456 / 2x SECOND-SKU',{x:20,y:200,font,size:14});
 const saved=await source.save(),bytes=saved.buffer.slice(saved.byteOffset,saved.byteOffset+saved.byteLength);
 const progress=[];
 const first=await context.LabelPDF.readPDF(bytes,(n,total)=>progress.push([n,total]));
 assert.equal(first.pages.length,2);
 assert.match(first.pages[0].text,/TRACKING-123/);
 assert.match(first.pages[1].text,/SECOND-SKU/);
 assert.deepEqual(progress,[[1,2],[2,2]]);
 await first.doc.destroy();
 const second=await context.LabelPDF.readPDF(bytes);
 assert.equal(second.pages.length,2);
 await second.doc.destroy();
 assert.equal(workerAttempts,0,'The loader must work when browser Workers are blocked');
 assert.equal(networkAttempts,0,'PDF loading must not fetch a worker module');
});

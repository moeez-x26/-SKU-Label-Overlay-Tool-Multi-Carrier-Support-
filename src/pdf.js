import {PDFDocument, StandardFonts, rgb, degrees} from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {WorkerMessageHandler} from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import {carrierOf,findExisting,defaultOverlay} from './core.js';
// Register PDF.js's parser in this bundle. Its supported main-thread mode
// then needs neither a separate worker URL nor a blob/data worker permitted
// by the host's CSP. This also prevents the fallback from importing a missing
// asset after a deployment or when browser workers are unavailable.
globalThis.pdfjsWorker={WorkerMessageHandler};
pdfjs.GlobalWorkerOptions.workerPort=null;
export const pdfOptions={cMapUrl:'/cmaps/',cMapPacked:true,standardFontDataUrl:'/standard_fonts/',wasmUrl:'/wasm/'};
let metrics;
export async function getMetrics() {
 if(!metrics) {const d=await PDFDocument.create(); metrics={regular:await d.embedFont(StandardFonts.Helvetica),bold:await d.embedFont(StandardFonts.HelveticaBold)};}
 return metrics;
}
export async function readPDF(bytes,onProgress=()=>{}) {
 const doc=await pdfjs.getDocument({data:new Uint8Array(bytes.slice(0)),...pdfOptions}).promise;
 const pages=[];
 if(doc.numPages>1000) throw Error('This PDF exceeds 1,000 pages. Split it into smaller batches.');
 for(let i=0;i<doc.numPages;i++) {
  const proxy=await doc.getPage(i+1), viewport=proxy.getViewport({scale:1}), content=await proxy.getTextContent();
  const items=content.items.filter(i=>typeof i.str==='string' && i.str.trim()).map(i=>{
   const t=pdfjs.Util.transform(viewport.transform,i.transform); const height=Math.hypot(t[2],t[3]);
   return {str:i.str,x:t[4],y:t[5]-height,width:i.width,height};
  });
  const text=content.items.map(i=>i.str||'').join('\n');
  const page={index:i,proxy,viewport,width:viewport.width,height:viewport.height,items,text,carrier:carrierOf(text),existing:findExisting(items),match:{status:'review',reason:'Upload and match the order sheet',groupId:null,candidates:[]}};
  page.overlay=defaultOverlay(page); pages.push(page); onProgress(i+1,doc.numPages);
  // Let the browser paint progress between pages when parsing on this thread.
  await new Promise(resolve=>setTimeout(resolve,0));
 }
 return {doc,pages};
}
export async function renderPage(page,canvas,scale=1.5) {
 const viewport=page.proxy.getViewport({scale});canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
 await page.proxy.render({canvasContext:canvas.getContext('2d',{willReadFrequently:true}),viewport,background:'#ffffff'}).promise;
 return canvas;
}

export * from './pdf-engine.js';

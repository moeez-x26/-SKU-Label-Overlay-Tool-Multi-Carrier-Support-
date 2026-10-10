// Local QA utility. Input files are never copied into the repository.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createCanvas} from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {parseCSV,tableFromRows,detectMapping,groupOrders,matchPage,findExisting,carrierOf,skuText,parseSkuLines,sameItems,defaultOverlay,applyDuplicateGuard} from '../src/core.js';
import {suggestPosition,placementWarning,exportPDF} from '../src/pdf-engine.js';
const require=createRequire(import.meta.url),root=path.dirname(require.resolve('pdfjs-dist/package.json'));
const [sheetPath,pdfPath,outputPath]=process.argv.slice(2);
if(!sheetPath||!pdfPath)throw Error('Usage: node scripts/check-batch.mjs orders.csv labels.pdf [output.pdf]');
const table=tableFromRows(parseCSV(await fs.readFile(sheetPath,'utf8')));const groups=groupOrders(table,detectMapping(table.headers));
const bytes=await fs.readFile(pdfPath);const doc=await pdfjs.getDocument({data:new Uint8Array(bytes),standardFontDataUrl:root+'/standard_fonts/',cMapUrl:root+'/cmaps/',cMapPacked:true,wasmUrl:root+'/wasm/'}).promise;
const fontDoc=await PDFDocument.create();const fonts={regular:await fontDoc.embedFont(StandardFonts.Helvetica),bold:await fontDoc.embedFont(StandardFonts.HelveticaBold)};
const pages=[];let existingCount=0,blankCount=0;const summaries=[];
for(let i=0;i<doc.numPages;i++){
 const proxy=await doc.getPage(i+1),viewport=proxy.getViewport({scale:1}),content=await proxy.getTextContent();
 const items=content.items.filter(i=>i.str?.trim()).map(i=>{const t=pdfjs.Util.transform(viewport.transform,i.transform);const height=Math.hypot(t[2],t[3]);return {str:i.str,x:t[4],y:t[5]-height,width:i.width,height}});
 const text=content.items.map(i=>i.str||'').join('\n');const page={index:i,proxy,viewport,width:viewport.width,height:viewport.height,items,text,carrier:carrierOf(text),existing:findExisting(items)};
 page.match=matchPage(page,groups);const g=groups.find(g=>g.id===page.match.groupId);page.overlay=defaultOverlay(page,g?skuText(g):'');
 if(g&&page.existing.length&&sameItems(parseSkuLines(page.existing.map(i=>i.str).join('\n')),g.items)){page.overlay.existingConfirmed=true;page.overlay.approved=true;existingCount++;}
 const canvas=createCanvas(Math.ceil(page.width),Math.ceil(page.height));await proxy.render({canvasContext:canvas.getContext('2d'),viewport,canvas,background:'#fff'}).promise;
 if(g&&!page.overlay.existingConfirmed){const p=suggestPosition(page,page.overlay,fonts,canvas);if(p){Object.assign(page.overlay,p);blankCount++;}}
 const warning=placementWarning(page,page.overlay,fonts,canvas);if(warning)throw Error('Unsafe placement on label '+(i+1)+': '+warning);
 if(page.match.status!=='matched')throw Error('Unmatched label '+(i+1)+': '+page.match.reason);
 page.overlay.approved=true;pages.push(page);summaries.push({label:i+1,carrier:page.carrier,itemCount:g.items.length,quantity:g.items.reduce((n,i)=>n+i.quantity,0),existing:page.overlay.existingConfirmed,fontSize:page.overlay.fontSize,x:page.overlay.x,y:page.overlay.y});
}
applyDuplicateGuard(pages);if(pages.some(p=>p.match.status==='review'))throw Error('Duplicate parcel match');
if(outputPath){const out=await exportPDF(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),pages,fonts);await fs.writeFile(outputPath,out);}
console.log(JSON.stringify({itemRows:table.data.length,parcels:groups.length,labels:pages.length,matched:pages.filter(p=>p.match.status==='matched').length,existingCount,blankCount,summaries},null,2));
await doc.destroy();

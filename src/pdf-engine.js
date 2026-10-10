import {PDFDocument,StandardFonts,rgb,degrees} from 'pdf-lib';
export function wrapText(text,width,font,size) {
 const lines=[];
 for(const original of text.split('\n')) {
   if(!original) {lines.push('');continue;}
   let current='';
   for(const char of original) {
     // Character wrapping retains spaces and punctuation in exact SKUs.
     if(current && font.widthOfTextAtSize(current+char,size)>width) {lines.push(current);current=char;}
     else current+=char;
   }
   lines.push(current);
 }
 return lines;
}
export function textLayout(o,fonts) {
 const font=o.bold?fonts.bold:fonts.regular;
 const lines=wrapText(o.text,o.width,font,o.fontSize);
 return {font,lines,height:Math.max(1,lines.length)*o.fontSize*1.2,ascent:font.heightAtSize(o.fontSize,{descender:false})};
}

export function intersects(a,b,padding=0) {return a.x < b.x+b.width+padding && a.x+a.width+padding > b.x && a.y < b.y+b.height+padding && a.y+a.height+padding > b.y;}
export function boundsError(page,o,fonts) {
 if(!o.include || o.existingConfirmed) return '';
 if(!o.text.trim()) return 'SKU text is empty.';
 if(!Number.isFinite(o.fontSize)||o.fontSize<5||o.fontSize>72) return 'Font size must be between 5 and 72 pt.';
 if(!Number.isFinite(o.width)||o.width<10) return 'Text box width must be at least 10 pt.';
 try {
  const layout=textLayout(o,fonts);
  if(o.x<0||o.y<0||o.x+o.width>page.width+.01||o.y+layout.height>page.height+.01) return 'The SKU box goes outside the label. Move it or reduce its size.';
 }catch {return 'This text contains characters unsupported by the label font. Use standard Latin SKU characters.';}
 return '';
}
export function existingBoxes(page) {return page.existing.map(i=>({x:i.x-1,y:i.y-1,width:i.width+2,height:i.height+3}));}
export function inkScore(canvas,page,box,ignore=[]) {
 const sx=canvas.width/page.width,sy=canvas.height/page.height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});
 const x=Math.max(0,Math.floor(box.x*sx)),y=Math.max(0,Math.floor(box.y*sy));
 const w=Math.min(canvas.width-x,Math.ceil(box.width*sx)),h=Math.min(canvas.height-y,Math.ceil(box.height*sy));
 if(w<=0||h<=0) return 1;
 const data=ctx.getImageData(x,y,w,h).data;let dark=0,total=0;
 for(let yy=0;yy<h;yy+=2) for(let xx=0;xx<w;xx+=2) {
   const px=(x+xx)/sx,py=(y+yy)/sy;
   if(ignore.some(b=>px>=b.x&&px<=b.x+b.width&&py>=b.y&&py<=b.y+b.height)) continue;
   const idx=(yy*w+xx)*4;total++;if(Math.min(data[idx],data[idx+1],data[idx+2])<210)dark++;
 }
 return total?dark/total:0;
}
export function textBoxes(o,fonts,padding=3) {
 const l=textLayout(o,fonts);
 return l.lines.filter(line=>line.length).map((line,i)=>{const width=l.font.widthOfTextAtSize(line,o.fontSize);const x=o.x+(o.align==='center'?(o.width-width)/2:o.align==='right'?o.width-width:0);return {x:x-padding,y:o.y+i*o.fontSize*1.2-padding,width:width+padding*2,height:o.fontSize*1.2+padding*2}});
}
export function placementWarning(page,o,fonts,canvas) {
 const err=boundsError(page,o,fonts);if(err)return err;
 if(!o.include||o.existingConfirmed)return '';
 if(o.replaceExisting && existingBoxes(page).some(b=>page.items.some(i=>!page.existing.includes(i)&&!page.existing.some(e=>e.str===i.str&&e.x===i.x&&e.y===i.y)&&intersects(b,i)))) return 'An existing SKU is too close to other label text to erase safely. Use a clean original PDF.';
 const layout=textLayout(o,fonts);
 if(textBoxes(o,fonts).some(box=>inkScore(canvas,page,box,o.replaceExisting?existingBoxes(page):[])>.001)) return 'SKU text may overlap existing print or a barcode. Move it into blank space.';
 return '';
}
export function suggestPosition(page,o,fonts,canvas) {
 const candidates=[];const destination=page.items.find(i=>/Destination|Customer reference:/i.test(i.str));
 const preferred=page.carrier==='Evri'?destination?.y-32:page.carrier==='Royal Mail'?destination?.y-22:12;
 for(const size of [o.fontSize,12,10,8]) {
  if(size>o.fontSize) continue;
  const candidate={...o,fontSize:size};const h=textLayout(candidate,fonts).height;
  for(let y=8;y+h<page.height-6;y+=3) {
    const margin=18;const box={x:margin,y,width:page.width-2*margin,height:h};
    const ink=Math.max(0,...textBoxes({...candidate,...box},fonts).map(b=>inkScore(canvas,page,b,existingBoxes(page))));
    if(ink<.001) candidates.push({x:box.x,y,width:box.width,fontSize:size,rank:Math.abs(y-(preferred??12))+(o.fontSize-size)*10});
  }
  if(candidates.length)break;
 }
 if(!candidates.length)return null;
 candidates.sort((a,b)=>a.rank-b.rank);const {rank,...position}=candidates[0];return position;
}
export async function exportPDF(bytes,pages,fonts,onProgress=()=>{}) {
 const document=await PDFDocument.load(bytes.slice(0));
 const outputFonts={regular:await document.embedFont(StandardFonts.Helvetica),bold:await document.embedFont(StandardFonts.HelveticaBold)};
 for(const page of pages) {
  const o=page.overlay;
  if(!o.include||o.existingConfirmed)continue;
  const err=boundsError(page,o,fonts);if(err)throw Error(`Label ${page.index+1}: ${err}`);
  const target=document.getPage(page.index),angle=page.proxy.rotate||0, font=o.bold?outputFonts.bold:outputFonts.regular;
  const drawBox=b=>{
    // Compute all screen corners so rotation and crop offsets are preserved.
    const corners=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>page.viewport.convertToPdfPoint(x,y));
    const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
    target.drawRectangle({x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys),color:rgb(1,1,1)});
  };
  if(o.replaceExisting)for(const box of existingBoxes(page))drawBox(box);
  const layout=textLayout(o,fonts);
  layout.lines.forEach((line,i)=>{
    const width=font.widthOfTextAtSize(line,o.fontSize);
    const left=o.x+(o.align==='center'?(o.width-width)/2:o.align==='right'?o.width-width:0);
    const [x,y]=page.viewport.convertToPdfPoint(left,o.y+layout.ascent+i*o.fontSize*1.2);
    target.drawText(line,{x,y,size:o.fontSize,font,color:rgb(0,0,0),rotate:degrees(angle)});
  });
  onProgress(page.index+1,pages.length);
 }
 document.setTitle('SKU-labelled shipping labels');document.setProducer('SKU Label Studio');
 return document.save();
}

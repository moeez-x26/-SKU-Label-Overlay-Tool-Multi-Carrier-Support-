import './style.css';
import {version} from '../package.json';
import {fields,detectMapping,parseCSV,tableFromRows,groupOrders,matchPage,skuText,normal,sameItems,parseSkuLines,applyDuplicateGuard,escapeHTML as esc,layoutKey,auditCSV} from './core.js';
import {readPDF,renderPage,getMetrics,textLayout,boundsError,placementWarning,suggestPosition,exportPDF,existingBoxes} from './pdf.js';

const $=s=>document.querySelector(s);
const state={table:null,mapping:{},groups:[],pages:[],doc:null,bytes:null,index:0,fonts:null,filter:'all',search:'',scale:1.5,busy:false,history:[],renderToken:0,labelsName:'',ordersName:'',workbook:null};
const icon={upload:'↑',download:'↓',chevron:'→'};
$('#app').innerHTML=`
<header class="topbar"><a class="brand" href="/" aria-label="SKU Label Studio home"><span class="brand-mark">▤</span><span>SKU Label <b>Studio</b></span><span class="version">${version}</span></a><span class="private-badge"><i></i> Files stay in your browser</span><button class="quiet" id="helpBtn">How it works</button></header>
<main>
<section class="intro"><div><div class="eyebrow">YOUR DISPATCH WORKSPACE</div><h1>The right SKU.<br><span>On the right label.</span></h1><p>Match your orders, make a few adjustments, and get your labels ready to print.</p></div><div class="intro-note"><span class="note-icon">✓</span><div><strong>Built for everyday dispatch</strong><p>Evri, Royal Mail, Yodel and other carriers.<br>Multiple SKUs. One parcel. All accounted for.</p></div></div></section>
<section class="upload-grid" aria-label="Upload your files">
<div class="upload-card" id="ordersDrop"><div class="step">01</div><div class="upload-content"><h2>Order sheet</h2><p id="ordersInfo">Drop a CSV or XLSX file here</p><label class="file-button" for="ordersFile">Choose order sheet <span>↑</span></label><input id="ordersFile" type="file" accept=".csv,.tsv,.xlsx" class="file-input" aria-label="Order sheet file"></div><span class="file-tag">CSV / XLSX</span></div>
<div class="upload-card" id="labelsDrop"><div class="step">02</div><div class="upload-content"><h2>Shipping labels</h2><p id="labelsInfo">Drop your labels PDF here</p><label class="file-button" for="labelsFile">Choose labels PDF <span>↑</span></label><input id="labelsFile" type="file" accept=".pdf" class="file-input" aria-label="Shipping labels PDF file"></div><span class="file-tag">PDF</span></div>
</section>
<section class="mapping panel" id="mappingPanel" hidden><div class="section-heading"><div><h2>Check your columns</h2><p>We’ve picked the likely columns. Make sure SKU means your seller SKU.</p></div><label id="worksheetLabel" hidden>Worksheet <select id="worksheet"></select></label></div><div class="mapping-fields" id="mappingFields"></div><div class="mapping-footer"><span id="tableInfo"></span><button class="primary" id="matchBtn" disabled>Match orders to labels <span>→</span></button></div></section>
<div id="notice" class="notice" role="status" aria-live="polite" hidden></div>
<section id="workspace" hidden>
<div class="workspace-bar"><div><h2>Label workspace <span id="totalCount" class="counter"></span></h2><p id="batchSummary"></p></div><div class="actions"><button class="secondary" id="saveBtn">Save project</button><button class="secondary" id="auditBtn">Download match report</button><button class="primary" id="exportBtn">Download labels PDF ↓</button></div></div>
<div class="studio-grid">
<aside class="label-list panel"><div class="list-head"><h3>Your labels</h3><input id="search" type="search" placeholder="Search SKU, order or tracking…" aria-label="Search labels"><div class="filter-tabs"><button data-filter="all" class="active">All</button><button data-filter="review">Review <span id="reviewCount">0</span></button><button data-filter="ready">Ready</button></div></div><div id="labelRows" class="label-rows"></div><div class="list-foot"><button class="quiet" id="approveSafeBtn">Approve safe matches</button><div id="unmatchedInfo"></div></div></aside>
<section class="preview-panel panel"><div class="preview-toolbar"><div class="page-nav"><button id="prevBtn" class="square" aria-label="Previous label">‹</button><span id="pageNum"></span><button id="nextBtn" class="square" aria-label="Next label">›</button></div><div class="zoom"><button id="zoomOut" class="square" aria-label="Zoom out">−</button><span id="zoomLevel">150%</span><button id="zoomIn" class="square" aria-label="Zoom in">+</button><button id="fitBtn" class="quiet">Fit</button></div></div><div class="preview-scroll" id="previewScroll"><div id="paper" class="paper"><canvas id="pdfCanvas" aria-label="Shipping label preview"></canvas><div id="masks"></div><div id="overlay" class="sku-overlay" tabindex="0" role="group" aria-label="SKU text box. Drag to move, or use arrow keys."><div class="drag-hint">DRAG TO MOVE</div><svg id="skuSVG" xmlns="http://www.w3.org/2000/svg"></svg><span class="resize-handle" id="resizeHandle" title="Drag to resize text box"></span></div></div></div><div class="preview-foot"><span id="pageSize"></span><span>Drag the text box · Arrow keys to move · Shift for larger steps</span></div></section>
<aside class="editor panel"><div class="editor-head"><h3>Label details</h3><span id="carrierBadge" class="tag"></span></div><div id="matchEvidence" class="evidence"></div><label class="field">Matched parcel<select id="parcelSelect"></select></label><div id="parcelDetails" class="parcel-details"></div><div class="divider"></div><div class="text-label"><label for="skuText">SKU & quantity</label><button class="quiet" id="resetTextBtn">From order</button></div><textarea id="skuText" rows="4" spellcheck="false" placeholder="1x YOUR-SKU"></textarea><div id="existingInfo" class="existing-info" hidden></div><div class="field-grid"><label class="field">Font size (pt)<input id="fontSize" type="number" min="5" max="72" step="1"></label><label class="field">Alignment<select id="align"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label></div><label class="check"><input id="bold" type="checkbox"> Bold text</label><div class="field-grid"><label class="field">X position (pt)<input id="posX" type="number" min="0" step="1"></label><label class="field">Y position (pt)<input id="posY" type="number" min="0" step="1"></label></div><label class="field">Text box width (pt)<input id="boxWidth" type="number" min="10" step="1"></label><div class="editor-buttons"><button class="secondary" id="autoPlaceBtn">Find blank space</button><button class="secondary" id="applyLayoutBtn">Apply to same layout</button></div><p class="small">Position, font and alignment are applied. Each label keeps its own SKU.</p><label class="check"><input id="include" type="checkbox"> Add SKU to this label</label><div id="warning" class="warning" role="status" hidden></div><div class="editor-bottom"><button class="quiet" id="undoBtn">↶ Undo</button><button class="primary" id="approveBtn">Approve label ✓</button></div></aside>
</div>
<div class="batch-footer"><p id="exportHint"></p><button id="nextReviewBtn" class="quiet">Go to next label needing review →</button></div>
</section>
<section class="empty-state" id="emptyState"><div class="empty-grid-icon">▤</div><h2>Your next batch starts here</h2><p>Upload your orders and labels above. Match by exact tracking or order ID,<br>then edit and place every SKU with confidence.</p><div class="feature-row"><span>✓ Exact identifier matching</span><span>✓ Edit & drag SKU text</span><span>✓ Print-ready PDF export</span></div></section>
<footer><span>SKU Label Studio</span><div><button class="quiet" id="openProjectBtn">Open saved project</button><input id="projectFile" type="file" accept=".labelstudio" class="file-input" aria-label="Saved project file"><button class="quiet" id="clearBtn">Clear workspace</button></div></footer>
</main>
<dialog id="helpDialog"><div class="dialog-head"><h2>From order sheet to printed label</h2><button id="closeHelp" class="square" aria-label="Close help">×</button></div><ol><li>Upload a CSV or XLSX order sheet and your labels PDF.</li><li>Check the column mapping, then match. Tracking IDs and order IDs are matched exactly, ignoring spaces and hyphens.</li><li>Open each label. Verify its parcel and SKU. Edit the text, drag the box, or choose “Find blank space”.</li><li>Approve labels after checking the preview. Conflicting records need manual selection. A postcode alone never selects an order.</li><li>Download the PDF. Print at 100% / actual size. The original page sizes and barcodes are preserved.</li></ol><p>Already printed SKUs are checked against the sheet. Matching text is kept; replacement is optional. Image-only labels require manual matching. Use one label per PDF page; pages with several parcel identifiers are sent for review.</p><p>Files are processed locally in your browser. Save a project to resume later; closing or refreshing the tab otherwise clears the uploaded files.</p></dialog>
`;

function notice(message,type='info') {const el=$('#notice');el.textContent=message;el.className=`notice ${type}`;el.hidden=!message;}
function busy(value,message='') {state.busy=value;for(const el of document.querySelectorAll('#workspace button, #workspace input, #workspace select, #workspace textarea, #mappingPanel select, #ordersFile, #labelsFile'))el.disabled=value;$('#matchBtn').disabled=value||!state.table||!state.pages.length;$('#exportBtn').disabled=value||!state.pages.length||state.pages.some(reviewNeeded); $('#approveBtn').disabled=value||!!current()?.warning||!current()?.overlay.include;$('#prevBtn').disabled=value||state.index===0;$('#nextBtn').disabled=value||state.index===state.pages.length-1;if(message)notice(message);}
function current(){return state.pages[state.index];}
function checkpoint() {const p=current();if(p){state.history.push({index:p.index,overlay:structuredClone(p.overlay),match:structuredClone(p.match)});if(state.history.length>60)state.history.shift();}}
function group(p=current()) {return state.groups.find(g=>g.id===p?.match.groupId);}
function reviewNeeded(p) {return p.overlay.include && (!p.overlay.approved || (p.match.status==='review') || !p.overlay.text.trim());}
function touch(){const p=current();p.overlay.approved=false;p.overlay.edited=true;if(p.overlay.existingConfirmed){p.overlay.existingConfirmed=false;p.overlay.replaceExisting=!!p.existing.length;}renderOverlay();updateSummary();renderList();}
function option(v,label,selected=false){return `<option value="${esc(v)}" ${selected?'selected':''}>${esc(label)}</option>`;}

async function loadOrders(file) {
 if(state.busy)return;
 busy(true,'Reading your order sheet…');
 try {
  if(file.size>30*1024*1024)throw Error('Order sheets must be smaller than 30 MB.');
  let rows;
  if(/\.xlsx$/i.test(file.name)) {
   const {default:ExcelJS}=await import('exceljs');const book=new ExcelJS.Workbook();await book.xlsx.load(await file.arrayBuffer());state.workbook=book;
   const select=$('#worksheet');select.innerHTML=book.worksheets.map((s,i)=>option(i,s.name)).join('');$('#worksheetLabel').hidden=book.worksheets.length<2;
   rows=excelRows(book.worksheets[0]);
  } else if(/\.(csv|tsv)$/i.test(file.name)) {state.workbook=null;$('#worksheetLabel').hidden=true;rows=parseCSV(await file.text());}
  else throw Error('Choose a CSV, TSV or XLSX order sheet.');
  state.table=tableFromRows(rows);state.ordersName=file.name;state.mapping=detectMapping(state.table.headers);state.groups=[];
  invalidateMatches();$('#ordersInfo').textContent=file.name;$('#ordersDrop').classList.add('loaded');renderMapping();notice('Order sheet loaded. Check the columns, then match.');
 }catch(e){notice(e.message,'error')}finally{busy(false)}
}
function excelRows(sheet){const rows=[];sheet.eachRow({includeEmpty:true},r=>{rows.push(r.values.slice(1).map(v=>{const value=v?.richText?v.richText.map(t=>t.text).join(''):v?.result??v?.text??v??'';if(typeof value==='number'&&Number.isInteger(value)&&!Number.isSafeInteger(value))throw Error('This XLSX stores a long ID as a number, which can lose digits. Store IDs as text or export a CSV.');return value;}))});return rows;}
function invalidateMatches(){for(const p of state.pages){p.match={status:'review',reason:'The order sheet or mapping changed. Match again.',groupId:null,candidates:[]};p.overlay.approved=false;p.overlay.text='';p.overlay.existingConfirmed=false;p.overlay.replaceExisting=false;}if(state.pages.length){renderList();updateSummary();renderEditor();renderOverlay();}}
async function loadLabels(file) {
 if(state.busy)return;
 busy(true,'Reading your labels PDF…');
 try {
  if(!/\.pdf$/i.test(file.name))throw Error('Choose a PDF labels file.');
  if(file.size>80*1024*1024)throw Error('Labels PDFs must be smaller than 80 MB.');
  const bytes=await file.arrayBuffer();const {doc,pages}=await readPDF(bytes,(n,total)=>notice(`Reading label ${n} of ${total}…`));
  if(state.doc) await state.doc.destroy();state.doc=doc;state.bytes=bytes;state.pages=pages;state.labelsName=file.name;state.index=0;state.history=[];
  state.fonts=await getMetrics();$('#labelsInfo').textContent=`${file.name} · ${pages.length} labels`;$('#labelsDrop').classList.add('loaded');showWorkspace();await showPage(0);notice('Labels loaded. Match them with your order sheet.');
 }catch(e){notice(e.message,'error')}finally{busy(false)}
}
function renderMapping() {
 $('#mappingPanel').hidden=!state.table;
 $('#mappingFields').innerHTML=fields.map(([key,label])=>`<label class="field">${label}${['sku','quantity'].includes(key)?' *':''}<select data-map="${key}">${option('','Not available',!state.mapping[key])}${state.table.headers.map(h=>option(h,h,state.mapping[key]===h)).join('')}</select></label>`).join('');
 $('#tableInfo').textContent=`${state.table.data.length} item rows · ${state.table.headers.length} columns`;
 busy(false);
}
function showWorkspace() {$('#workspace').hidden=false;$('#emptyState').hidden=true;renderList();updateSummary();}
async function matchAll() {
 if(state.busy)return;busy(true,'Matching exact tracking and order IDs…');
 try {
  const groups=groupOrders(state.table,state.mapping);state.groups=groups;state.history=[];
  for(const p of state.pages) {
   p.match=matchPage(p,groups);p.overlay={...p.overlay,approved:false,edited:false,replaceExisting:false,existingConfirmed:false};
   const g=group(p);p.overlay.text=g?skuText(g):'';
   if(g && p.existing.length) {
    const existingText=p.existing.map(i=>i.str).join('\n');
    if(sameItems(parseSkuLines(existingText),g.items)) {p.overlay.existingConfirmed=true;p.overlay.approved=true;}
    else {p.match.status='review';p.match.reason='Existing SKU text differs from the order sheet. Choose whether to replace it.';}
   }
   if(g && !p.overlay.existingConfirmed) {
    const canvas=document.createElement('canvas');await renderPage(p,canvas,1);
    const pos=suggestPosition(p,p.overlay,state.fonts,canvas);if(pos)Object.assign(p.overlay,pos);
    p.positionFound=!!pos;
   }
  }
  applyDuplicateGuard(state.pages);for(const p of state.pages)if(p.match.status==='review')p.overlay.approved=false;
  showWorkspace();await showPage(state.pages.findIndex(reviewNeeded)<0?0:state.pages.findIndex(reviewNeeded));
  notice(`${state.pages.filter(p=>p.match.status==='matched').length} exact matches found. Review positioning, then approve your labels.`,'success');
 }catch(e){notice(e.message,'error')}finally{busy(false);updateSummary()}
}
function updateSummary() {
 const included=state.pages.filter(p=>p.overlay.include),pending=included.filter(reviewNeeded),ready=included.length-pending.length;
 $('#totalCount').textContent=state.pages.length;$('#reviewCount').textContent=pending.length;
 $('#batchSummary').textContent=`${ready} ready · ${pending.length} to review · ${state.pages.length-included.length} kept unchanged`;
 $('#exportHint').textContent=pending.length?`${pending.length} labels need review before PDF export. You can leave a label unchanged by switching off “Add SKU”.`:'All included labels are approved. Print the downloaded PDF at actual size.';
 $('#exportBtn').disabled=state.busy||pending.length>0||!state.pages.length;
 const used=new Set(state.pages.map(p=>p.match.groupId).filter(Boolean));
 $('#unmatchedInfo').textContent=state.groups.length?`${state.groups.filter(g=>!used.has(g.id)).length} parcels in the sheet have no label match.`:'';
}
function renderList() {
 const rows=state.pages.filter(p=>{const g=group(p);const hay=[p.index+1,p.carrier,p.overlay.text,g?.tracking,g?.orderIds.join(' '),g?.names.join(' ')].join(' ').toLowerCase();return (!state.search||hay.includes(state.search.toLowerCase()))&&(state.filter==='all'||state.filter==='review'&&reviewNeeded(p)||state.filter==='ready'&&!reviewNeeded(p))});
 $('#labelRows').innerHTML=rows.length?rows.map(p=>{
  const g=group(p),ready=!reviewNeeded(p);return `<button class="label-row ${p.index===state.index?'selected':''}" data-page="${p.index}"><span class="label-number">${String(p.index+1).padStart(2,'0')}</span><span class="label-row-body"><strong>${esc(g?.names[0]||p.carrier)}</strong><span>${esc(p.overlay.text.split('\n')[0]||'Match required')}</span><small>${esc(g?.tracking||g?.orderIds[0]||p.carrier)}</small></span><i class="status-dot ${ready?'ready':'review'}" title="${ready?'Ready':'Needs review'}"></i></button>`;
 }).join(''):'<p class="no-results">No labels in this view.</p>';
}
async function showPage(index) {
 if(index<0||index>=state.pages.length)return;
 state.index=index;renderList();const p=current(),token=++state.renderToken;
 $('#pageNum').textContent=`${index+1} / ${state.pages.length}`;$('#prevBtn').disabled=index===0;$('#nextBtn').disabled=index===state.pages.length-1;
 $('#carrierBadge').textContent=p.carrier;$('#pageSize').textContent=`${Math.round(p.width)} × ${Math.round(p.height)} pt`;
 $('#zoomLevel').textContent=`${Math.round(state.scale*100)}%`;
 $('#paper').style.width=p.width*state.scale+'px';$('#paper').style.height=p.height*state.scale+'px';
 // Render offscreen so rapid navigation never shares a canvas between PDF tasks.
 const canvas=document.createElement('canvas');await renderPage(p,canvas,state.scale);
 if(token!==state.renderToken)return;
 const visible=$('#pdfCanvas');visible.width=canvas.width;visible.height=canvas.height;visible.getContext('2d').drawImage(canvas,0,0);
 renderEditor();renderOverlay();
}
function renderEditor() {
 const p=current(),o=p.overlay,g=group(p);
 $('#matchEvidence').innerHTML=`<span class="evidence-label">${p.match.status==='matched'?'MATCH EVIDENCE':p.match.status==='manual'?'MANUAL SELECTION':'REVIEW REQUIRED'}</span><strong>${esc(p.match.reason)}</strong>`;
 $('#matchEvidence').className='evidence '+(p.match.status==='review'?'needs-review':'');
 $('#parcelSelect').innerHTML=option('','Select a parcel',!g)+option('__manual','Enter SKU manually',p.match.status==='manual'&&!g)+state.groups.map(item=>option(item.id,`${item.names[0]||'Recipient'} · ${item.tracking||item.orderIds[0]||item.postcodes[0]} · ${skuText(item).replace(/\n/g,' / ')}`,g?.id===item.id)).join('');
 $('#parcelDetails').innerHTML=g?`<div><span>Tracking</span><strong>${esc(g.tracking||'Not in sheet')}</strong></div><div><span>Order</span><strong>${esc(g.orderIds.join(', ')||'Not in sheet')}</strong></div><div><span>Postcode</span><strong>${esc(g.postcodes.join(', ')||'Not in sheet')}</strong></div><div><span>Source rows</span><strong>${esc(g.rowNumbers.join(', '))}</strong></div>${g.issues.length?`<p class="error-text">${esc(g.issues.join('; '))}</p>`:''}`:'';
 for(const [id,val] of [['skuText',o.text],['fontSize',o.fontSize],['posX',Math.round(o.x*10)/10],['posY',Math.round(o.y*10)/10],['boxWidth',Math.round(o.width*10)/10],['align',o.align]])$('#'+id).value=val;
 $('#bold').checked=o.bold;$('#include').checked=o.include;
 $('#existingInfo').hidden=!p.existing.length;
 $('#existingInfo').innerHTML=p.existing.length?`<strong>SKU text is already on this label</strong><span>${esc(p.existing.map(i=>i.str).join(' / '))}</span><label class="check"><input type="checkbox" id="replaceExisting" ${o.replaceExisting?'checked':''}> Replace the existing SKU text</label><span class="small">${o.existingConfirmed?'It matches the order sheet and will be kept.':'Review the original text. Replacement covers only its detected text area.'}</span>`:'';
 $('#approveBtn').textContent=o.approved?'Approved ✓':'Approve label ✓';
}
function renderOverlay() {
 const p=current();if(!p||!state.fonts)return;
 const o=p.overlay,s=state.scale,el=$('#overlay');el.hidden=!o.include||o.existingConfirmed||!o.text;
 el.style.left=o.x*s+'px';el.style.top=o.y*s+'px';el.style.width=o.width*s+'px';
 let warning='';
 try {
  const layout=textLayout(o,state.fonts);el.style.height=layout.height*s+'px';
  const svg=$('#skuSVG');svg.setAttribute('width',o.width*s);svg.setAttribute('height',layout.height*s);svg.setAttribute('viewBox',`0 0 ${o.width} ${layout.height}`);
  svg.innerHTML=layout.lines.map((line,i)=>`<text x="${o.align==='left'?0:o.align==='center'?o.width/2:o.width}" y="${layout.ascent+i*o.fontSize*1.2}" font-size="${o.fontSize}" font-family="Arial, Helvetica, sans-serif" font-weight="${o.bold?700:400}" text-anchor="${o.align==='left'?'start':o.align==='center'?'middle':'end'}">${esc(line)}</text>`).join('');
  warning=placementWarning(p,o,state.fonts,$('#pdfCanvas'));
 }catch {warning='Unsupported text or invalid formatting. Use standard Latin SKU characters.';}
 $('#masks').innerHTML=o.replaceExisting?existingBoxes(p).map(b=>`<div style="left:${b.x*s}px;top:${b.y*s}px;width:${b.width*s}px;height:${b.height*s}px"></div>`).join(''):'';
 if(p.existing.length&&!o.existingConfirmed&&!o.replaceExisting&&o.include)warning='This label already has SKU text. Choose replacement before adding another SKU.';
 $('#warning').textContent=warning;$('#warning').hidden=!warning;el.classList.toggle('unsafe',!!warning);
 p.warning=warning;$('#approveBtn').disabled=!!warning||!o.include;
 $('#posX').value=Math.round(o.x*10)/10;$('#posY').value=Math.round(o.y*10)/10;$('#boxWidth').value=Math.round(o.width*10)/10;
}
async function autoPlace(){if(state.busy)return;checkpoint();const p=current();if(p.overlay.existingConfirmed){notice('The existing SKU already matches. Enable replacement to reposition it.');return;}
 const pos=suggestPosition(p,p.overlay,state.fonts,$('#pdfCanvas'));if(!pos){notice('No blank area large enough was found. Reduce font size or position the text manually.','error');return;}Object.assign(p.overlay,pos);touch();renderEditor();renderOverlay();}
function approve(){const p=current();if(p.warning){notice(p.warning,'error');return;}if(!p.overlay.text.trim()){notice('Enter the SKU text first.','error');return;}if(!p.match.groupId&&p.match.status!=='manual'){notice('Select a parcel or choose “Enter SKU manually” before approving.','error');return;}
 if(p.match.status==='review'&&!p.overlay.edited){notice('Select the correct parcel manually to resolve this conflict.','error');return;}
 checkpoint();p.overlay.approved=true;if(p.match.status==='review')p.match.status='manual';renderEditor();updateSummary();renderList();notice(`Label ${p.index+1} approved.`,'success');}
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),15000);}
async function doExport(){if(state.busy)return;if(state.pages.some(reviewNeeded)){notice('Review all included labels before exporting.','error');return;}
 busy(true,'Checking all label positions before export…');try{
  for(const p of state.pages)if(p.overlay.include&&!p.overlay.existingConfirmed){const c=document.createElement('canvas');await renderPage(p,c,1);const warning=placementWarning(p,p.overlay,state.fonts,c);if(warning){p.overlay.approved=false;await showPage(p.index);throw Error(`Label ${p.index+1}: ${warning}`);}}
  const bytes=await exportPDF(state.bytes,state.pages,state.fonts);download(bytes,state.labelsName.replace(/\.pdf$/i,'')+'-SKU-labels.pdf','application/pdf');notice('Your PDF is ready. Print at 100% / actual size.','success');
 }catch(e){notice(e.message,'error')}finally{busy(false);updateSummary();renderList()}}

$('#ordersFile').addEventListener('change',e=>{if(e.target.files[0])loadOrders(e.target.files[0]);e.target.value=''});
$('#labelsFile').addEventListener('change',e=>{if(e.target.files[0])loadLabels(e.target.files[0]);e.target.value=''});
for(const [id,fn] of [['ordersDrop',loadOrders],['labelsDrop',loadLabels]]){const el=$('#'+id);el.addEventListener('dragover',e=>{e.preventDefault();el.classList.add('dragover')});el.addEventListener('dragleave',()=>el.classList.remove('dragover'));el.addEventListener('drop',e=>{e.preventDefault();el.classList.remove('dragover');if(e.dataTransfer.files[0])fn(e.dataTransfer.files[0])})}
$('#worksheet').addEventListener('change',e=>{state.table=tableFromRows(excelRows(state.workbook.worksheets[Number(e.target.value)]));state.mapping=detectMapping(state.table.headers);state.groups=[];invalidateMatches();renderMapping()});
$('#mappingFields').addEventListener('change',e=>{if(e.target.dataset.map){state.mapping[e.target.dataset.map]=e.target.value;invalidateMatches()}});
$('#matchBtn').addEventListener('click',matchAll);
$('#labelRows').addEventListener('click',e=>{const button=e.target.closest('[data-page]');if(button&&!state.busy)showPage(Number(button.dataset.page))});
$('#search').addEventListener('input',e=>{state.search=e.target.value;renderList()});
$('.filter-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-filter]');if(b){state.filter=b.dataset.filter;for(const el of document.querySelectorAll('[data-filter]'))el.classList.toggle('active',el===b);renderList()}});
$('#prevBtn').onclick=()=>!state.busy&&showPage(state.index-1);$('#nextBtn').onclick=()=>!state.busy&&showPage(state.index+1);
$('#zoomOut').onclick=()=>{state.scale=Math.max(.5,state.scale-.25);showPage(state.index)};$('#zoomIn').onclick=()=>{state.scale=Math.min(3,state.scale+.25);showPage(state.index)};$('#fitBtn').onclick=()=>{state.scale=Math.min(2.5,Math.max(.5,($('#previewScroll').clientWidth-70)/current().width));showPage(state.index)};
$('#parcelSelect').addEventListener('change',e=>{checkpoint();const p=current(),g=state.groups.find(g=>g.id===e.target.value);p.match={status:e.target.value?'manual':'review',reason:g?'Parcel selected manually':e.target.value==='__manual'?'SKU entered manually':'Select a parcel',groupId:g?.id||null,candidates:g?[g.id]:[]};p.overlay.text=g?skuText(g):p.overlay.text;p.overlay.edited=true;p.overlay.approved=false;p.overlay.existingConfirmed=!!g&&sameItems(parseSkuLines(p.existing.map(i=>i.str).join('\n')),g.items);p.overlay.replaceExisting=false;renderEditor();renderOverlay();updateSummary();renderList()});
for(const [id,key,type] of [['skuText','text','text'],['fontSize','fontSize','num'],['align','align','text'],['posX','x','num'],['posY','y','num'],['boxWidth','width','num'],['bold','bold','check'],['include','include','check']]) {
 const el=$('#'+id);el.addEventListener('focus',checkpoint);el.addEventListener(type==='check'?'change':'input',e=>{if(!current()||state.busy)return;let v=type==='check'?e.target.checked:type==='num'?Number(e.target.value):e.target.value;
 if(type==='num'&&!Number.isFinite(v))return;
 if(key==='fontSize')v=Math.min(72,Math.max(5,v));if(key==='width')v=Math.min(current().width,Math.max(10,v));
 current().overlay[key]=v;touch();renderOverlay()});
}
$('#existingInfo').addEventListener('change',e=>{if(e.target.id==='replaceExisting'){checkpoint();const p=current();p.overlay.replaceExisting=e.target.checked;p.overlay.existingConfirmed=!e.target.checked&&!!group()&&sameItems(parseSkuLines(p.existing.map(i=>i.str).join('\n')),group().items);p.overlay.approved=false;p.overlay.edited=true;renderOverlay();updateSummary();renderList()}});
$('#resetTextBtn').onclick=()=>{if(group()){checkpoint();current().overlay.text=skuText(group());touch();renderEditor();renderOverlay()}};
$('#autoPlaceBtn').onclick=autoPlace;
$('#applyLayoutBtn').onclick=()=>{const p=current(),o=p.overlay;let count=0;for(const other of state.pages)if(other!==p&&layoutKey(other)===layoutKey(p)&&!other.overlay.existingConfirmed){for(const k of ['x','y','width','fontSize','bold','align'])other.overlay[k]=o[k];other.overlay.approved=false;count++;}notice(`Formatting and position applied to ${count} other labels. Review their placement.`);updateSummary();renderList()};
$('#approveBtn').onclick=approve;
$('#undoBtn').onclick=async()=>{const h=state.history.pop();if(h){state.pages[h.index].overlay=h.overlay;state.pages[h.index].match=h.match;await showPage(h.index);updateSummary()}};
$('#nextReviewBtn').onclick=()=>{const list=state.pages.filter(reviewNeeded);const next=list.find(p=>p.index>state.index)||list[0];if(next)showPage(next.index);else notice('All included labels are approved.','success')};
$('#approveSafeBtn').onclick=async()=>{if(state.busy)return;busy(true,'Checking safe matches…');let count=0;try{for(const p of state.pages)if(p.match.status==='matched'&&p.overlay.include&&!p.overlay.edited){const c=document.createElement('canvas');await renderPage(p,c,1);if(!placementWarning(p,p.overlay,state.fonts,c)&&(p.overlay.existingConfirmed||!p.existing.length)){p.overlay.approved=true;count++;}}notice(`${count} labels approved. Conflicting matches and manual edits still need individual review.`,'success');}catch(e){notice(e.message,'error')}finally{busy(false);renderEditor();renderList();updateSummary()}};
$('#exportBtn').onclick=doExport;
$('#auditBtn').onclick=()=>download(auditCSV(state.pages,state.groups),'SKU-match-report.csv','text/csv;charset=utf-8');

let drag;
$('#overlay').addEventListener('pointerdown',e=>{if(state.busy||e.button!==0)return;checkpoint();const o=current().overlay;drag={resize:e.target.id==='resizeHandle',x:e.clientX,y:e.clientY,ox:o.x,oy:o.y,width:o.width};$('#overlay').setPointerCapture(e.pointerId);e.preventDefault()});
$('#overlay').addEventListener('pointermove',e=>{if(!drag)return;const p=current(),o=p.overlay,dx=(e.clientX-drag.x)/state.scale,dy=(e.clientY-drag.y)/state.scale;
 if(drag.resize)o.width=Math.max(30,Math.min(p.width-o.x,drag.width+dx));
 else {o.x=Math.max(0,Math.min(p.width-o.width,drag.ox+dx));let h;try{h=textLayout(o,state.fonts).height}catch{h=30}o.y=Math.max(0,Math.min(p.height-h,drag.oy+dy));}
 touch()});
$('#overlay').addEventListener('pointerup',()=>{drag=null;renderEditor();renderOverlay()});$('#overlay').addEventListener('pointercancel',()=>{drag=null});
$('#overlay').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||state.busy)return;e.preventDefault();checkpoint();const o=current().overlay,step=e.shiftKey?10:1;const axis=e.key==='ArrowLeft'||e.key==='ArrowRight'?'x':'y';o[axis]=Math.max(0,o[axis]+(['ArrowLeft','ArrowUp'].includes(e.key)?-step:step));touch()});

$('#saveBtn').onclick=()=>{if(state.busy||!state.bytes)return;const u=new Uint8Array(state.bytes);let binary='';for(let i=0;i<u.length;i+=8192)binary+=String.fromCharCode(...u.subarray(i,i+8192));const project={version:1,labelsName:state.labelsName,ordersName:state.ordersName,pdf:btoa(binary),table:state.table,mapping:state.mapping,pages:state.pages.map(p=>({index:p.index,overlay:p.overlay,match:p.match}))};download(JSON.stringify(project),'dispatch-project.labelstudio','application/json');notice('Project saved. It includes your PDF, order sheet and adjustments.','success')};
$('#openProjectBtn').onclick=()=>$('#projectFile').click();
$('#projectFile').addEventListener('change',async e=>{if(!e.target.files[0]||state.busy)return;busy(true,'Opening saved project…');try{const f=e.target.files[0];if(f.size>150*1024*1024)throw Error('Project file is too large.');const project=JSON.parse(await f.text());if(project.version!==1||typeof project.pdf!=='string'||!Array.isArray(project.pages))throw Error('Invalid project file.');const bytes=Uint8Array.from(atob(project.pdf),c=>c.charCodeAt(0)).buffer;const {doc,pages}=await readPDF(bytes);if(pages.length!==project.pages.length)throw Error('Project label count does not match its PDF.');state.fonts=await getMetrics();for(const p of pages){const saved=project.pages[p.index];if(saved.index!==p.index||typeof saved.overlay?.text!=='string'||!['left','center','right'].includes(saved.overlay.align))throw Error('Invalid saved label settings.');p.overlay={...p.overlay,...saved.overlay};p.match=saved.match;if(boundsError(p,p.overlay,state.fonts))p.overlay.approved=false;}
 if(state.doc)await state.doc.destroy();Object.assign(state,{doc,pages,bytes,table:project.table,mapping:project.mapping||{},ordersName:project.ordersName,labelsName:project.labelsName,history:[],workbook:null,index:0});state.groups=state.table?groupOrders(state.table,state.mapping):[];
 $('#ordersInfo').textContent=state.ordersName||'No order sheet';$('#labelsInfo').textContent=`${state.labelsName} · ${pages.length} labels`;$('#worksheetLabel').hidden=true;if(state.table)renderMapping();showWorkspace();await showPage(0);notice('Project restored. Your edits and approvals are available.','success');
 }catch(err){notice(err.message,'error')}finally{busy(false);updateSummary();e.target.value=''}});
$('#clearBtn').onclick=()=>{if(!state.busy&&confirm('Clear the uploaded files and edits? Save your project first if you want to keep them.'))location.reload()};
$('#helpBtn').onclick=()=>$('#helpDialog').showModal();$('#closeHelp').onclick=()=>$('#helpDialog').close();
window.addEventListener('beforeunload',e=>{if(state.pages.some(p=>p.overlay.edited)){e.preventDefault();e.returnValue=''}});

/** Matching uses exact identifiers. A postcode alone never selects a parcel. */
export const clean = v => String(v ?? '').replace(/^\uFEFF/, '').trim();
export const normal = v => clean(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
export const masked = v => !clean(v) || /\*/.test(v);
export const fields = [
  ['sku', 'Seller SKU', ['seller sku', 'merchant sku', 'sku', 'item sku', 'product sku']],
  ['quantity', 'Quantity', ['quantity', 'qty', 'item quantity', 'purchased quantity']],
  ['tracking', 'Tracking ID', ['tracking id', 'tracking number', 'tracking no', 'tracking', 'shipment tracking number']],
  ['order', 'Order ID', ['order id', 'order number', 'order no', 'order']],
  ['name', 'Recipient', ['recipient', 'recipient name', 'buyer name', 'customer name', 'ship to name', 'name']],
  ['postcode', 'Postcode', ['zipcode', 'zip code', 'postcode', 'postal code', 'shipping postcode']],
  ['street', 'Street / address', ['street name', 'shipping address', 'address', 'address 1', 'address line 1']],
  ['house', 'House name / number', ['house name or number', 'house number']],
];
export function detectMapping(headers) {
  const out = {};
  for (const [key,, aliases] of fields) {
    out[key] = aliases.map(a => headers.find(h => normal(h) === normal(a))).find(Boolean) || '';
  }
  return out;
}
export function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/)[0];
  const delimiters = [',', ';', '\t'];
  const delimiter = delimiters.sort((a,b) => firstLine.split(b).length-firstLine.split(a).length)[0];
  const rows = []; let row = [], value = '', quote = false;
  for (let i=0; i<text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quote && text[i+1] === '"') { value += '"'; i++; }
      else if (quote || !value) quote = !quote;
      else value += c;
    } else if (c === delimiter && !quote) { row.push(value); value = ''; }
    else if ((c === '\n' || c === '\r') && !quote) {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(value); if (row.some(v=>clean(v))) rows.push(row);
      row=[]; value='';
    } else value += c;
  }
  if (quote) throw Error('The CSV has an unclosed quoted field. Please export it again.');
  row.push(value); if (row.some(v=>clean(v))) rows.push(row);
  return rows;
}
export function tableFromRows(rows) {
  const headerIndex = rows.findIndex(row => row.filter(v=>clean(v)).length > 1);
  if (headerIndex<0) throw Error('No table found in this file.');
  const headers = rows[headerIndex].map((v,i)=>clean(v)||`Column ${i+1}`);
  if (new Set(headers).size !== headers.length) throw Error('Duplicate column names. Give each column a unique name.');
  const data = rows.slice(headerIndex+1).filter(r=>r.some(v=>clean(v))).map((r,i)=>({
    rowNumber:headerIndex+i+2, values:Object.fromEntries(headers.map((h,j)=>[h,clean(r[j])]))
  }));
  if (!data.length) throw Error('The order sheet is empty.');
  return {headers, data};
}
export function groupOrders(table, mapping) {
  if (!mapping.sku || !mapping.quantity) throw Error('Choose the SKU and quantity columns.');
  if (!mapping.tracking && !mapping.order && !(mapping.name && mapping.postcode && mapping.street)) {
    throw Error('Map tracking ID, order ID, or recipient + postcode + address.');
  }
  const groups = new Map();
  for (const row of table.data) {
    const get = key => clean(row.values[mapping[key]]);
    const tracking=get('tracking'), order=get('order'), name=get('name'), postcode=get('postcode');
    const street=get('street'), house=get('house'), sku=get('sku'), q=get('quantity');
    const quantity = /^\d+$/.test(q) ? Number(q) : NaN;
    const key = normal(tracking) ? `t:${normal(tracking)}` : normal(order) ? `o:${normal(order)}` : `a:${normal(name)}:${normal(postcode)}:${normal(street)}:${normal(house)}`;
    if (!groups.has(key)) groups.set(key, {id:key, tracking, orderIds:[], names:[], postcodes:[], streets:[], houses:[], items:[], rowNumbers:[], issues:[]});
    const g=groups.get(key); g.rowNumbers.push(row.rowNumber);
    for(const [list,val] of [['orderIds',order],['names',name],['postcodes',postcode],['streets',street],['houses',house]]) {
      if (val && !g[list].some(x=>normal(x)===normal(val))) g[list].push(val);
    }
    if (!sku) g.issues.push(`Row ${row.rowNumber}: missing SKU`);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) g.issues.push(`Row ${row.rowNumber}: quantity must be a positive whole number`);
    if(sku && Number.isSafeInteger(quantity) && quantity>0) {
      // Preserve SKU case and punctuation; aggregate only identical strings.
      const existing=g.items.find(i=>i.sku===sku);
      if(existing) existing.quantity+=quantity; else g.items.push({sku,quantity});
    }
  }
  for (const g of groups.values()) {
    if(g.orderIds.length>1) g.issues.push('One tracking number belongs to different order IDs');
    if(g.postcodes.length>1) g.issues.push('Conflicting postcodes for one parcel');
    if(g.names.filter(n=>!masked(n)).length>1) g.issues.push('Conflicting recipient names for one parcel');
  }
  return [...groups.values()];
}
export function containsId(text, id) {
  const n=normal(id); if(n.length<4) return false;
  const pattern=n.split('').join('[\\s-]*');
  return new RegExp(`(?:^|[^A-Z0-9])${pattern}(?=$|[^A-Z0-9])`,'i').test(text);
}
export function getPostcodes(text) {
  return [...text.toUpperCase().matchAll(/\b(?:GIR\s*0AA|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/g)].map(m=>normal(m[0]));
}
const includesPhrase=(text, value)=>!masked(value) && normal(value).length>2 && normal(text).includes(normal(value));
export function extractTracking(text) {
  const patterns=[/\bH[\s-]*\d{3}[A-Z][\s-]*[A-Z][\s-]*\d(?:[\s-]*\d){9}\b/gi,/\b[A-Z]{2}[\s-]*\d(?:[\s-]*\d){8}[\s-]*GB\b/gi,/\bRELR[A-Z0-9]{7,14}\b/gi];
  return [...new Set(patterns.flatMap(pattern=>[...text.matchAll(pattern)].map(m=>normal(m[0]))))];
}
export function matchPage(page, groups) {
  const tracking=groups.filter(g=>g.tracking && containsId(page.text,g.tracking));
  const order=groups.filter(g=>g.orderIds.some(id=>containsId(page.text,id)));
  const fail=(reason,candidates=[])=>({status:'review',reason,groupId:null,candidates:candidates.map(g=>g.id)});
  let candidate, basis;
  if(tracking.length>1) return fail('Several tracking numbers match this page. Review the label layout.',tracking);
  if(tracking.length===1) {
    candidate=tracking[0]; basis='Exact tracking ID';
    if(order.length && !order.some(g=>g.id===candidate.id)) return fail('Tracking ID and order ID point to different parcels.',[...tracking,...order]);
  } else if(order.length===1) { candidate=order[0]; basis='Exact order ID'; }
  else if(order.length>1) return fail('This order has several parcels. Select the correct tracking number.',order);
  else {
    const address=groups.filter(g=>g.names.some(n=>includesPhrase(page.text,n)) && g.postcodes.some(p=>containsId(page.text,p)) && g.streets.some(s=>includesPhrase(page.text,s)) && (!g.houses.length||g.houses.some(h=>masked(h)||includesPhrase(page.text,h))));
    if(address.length!==1) return fail(page.text.trim()?'No unique exact match. Select a parcel manually.':'This is an image-only label. Read the preview and select its parcel manually.',address);
    candidate=address[0]; basis='Exact recipient, postcode and address';
  }
  const visibleTracking=extractTracking(page.text);
  if(candidate.tracking && visibleTracking.length && !visibleTracking.includes(normal(candidate.tracking))) return fail('The label tracking number differs from the matched order.',[candidate]);
  if(candidate.issues.length) return fail(candidate.issues.join('; '),[candidate]);
  const postcodes=getPostcodes(page.text);
  // Royal Mail includes a return postcode, so presence of the recipient code is enough.
  if(postcodes.length && candidate.postcodes.length && !candidate.postcodes.some(p=>postcodes.includes(normal(p)))) return fail('The label postcode conflicts with the order sheet.',[candidate]);
  return {status:'matched',reason:basis,groupId:candidate.id,candidates:[candidate.id]};
}
export const skuText=g=>g.items.map(i=>`${i.quantity}x ${i.sku}`).join('\n');
export function findExisting(items) {
  return items.filter(i=>/^\s*\d+\s*[x×]\s+\S/i.test(i.str)).map(i=>({...i}));
}
export function parseSkuLines(text) {
  const matches=[...text.matchAll(/(?:^|\n|,\s*)(\d+)\s*[x×]\s+(.+?)(?=,\s*\d+\s*[x×]\s|\n|$)/gmi)];
  return matches.map(m=>({quantity:Number(m[1]),sku:clean(m[2])}));
}
export function sameItems(a,b) {
  const key=items=>{const sums=new Map();for(const i of items) sums.set(i.sku,(sums.get(i.sku)||0)+i.quantity);return JSON.stringify([...sums].sort((a,b)=>a[0].localeCompare(b[0])))};
  return key(a)===key(b);
}
export function carrierOf(text) {
  if(/Customer reference:|Tracked 24|Royal Mail|Tracked 48/i.test(text)) return 'Royal Mail';
  if(/C-ROUND|COU-PNET|EVRI|H-?\d{3}[A-Z]/i.test(text)) return 'Evri';
  if(/Fulfilled by:\s*TikTok CBT|RELR|Yodel/i.test(text)) return 'Yodel / TikTok';
  if(/DPD/i.test(text)) return 'DPD';
  return 'Other carrier';
}
export function defaultOverlay(page,text='') {
  return {text,x:12,y:12,width:Math.max(80,page.width-24),fontSize:14,bold:true,align:'left',include:true,approved:false,edited:false,existingConfirmed:false,replaceExisting:false};
}
export function layoutKey(p) {return `${p.carrier}:${Math.round(p.width)}x${Math.round(p.height)}`;}
export function applyDuplicateGuard(pages) {
  const matched=new Map();
  for(const p of pages) if(p.match.groupId && p.match.status==='matched') {
    const prior=matched.get(p.match.groupId);
    if(prior) {p.match={...p.match,status:'review',reason:`Duplicate parcel: also matched on label ${prior.index+1}. Review before printing.`};}
    else matched.set(p.match.groupId,p);
  }
}
export const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function auditCSV(pages,groups) {
  const quote=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const out=[['Label','Carrier','Status','Match evidence','Tracking ID','Order IDs','Source rows','SKU text','Action','Font size','X','Y']];
  for(const p of pages) {const g=groups.find(g=>g.id===p.match.groupId);const o=p.overlay;out.push([p.index+1,p.carrier,p.match.status,p.match.reason,g?.tracking,g?.orderIds.join(' / '),g?.rowNumbers.join(' / '),o.text,!o.include?'Skipped':o.existingConfirmed?'Kept original SKU':o.replaceExisting?'Replaced existing SKU':'Added SKU',o.fontSize,o.x,o.y])}
  return '\uFEFF'+out.map(row=>row.map(quote).join(',')).join('\r\n');
}

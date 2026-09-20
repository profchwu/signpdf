import * as pdfjs from './vendor/pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
const $ = id => document.getElementById(id);
let pdf, original, filename, pageNumber = 1, viewport, source, selected = null, stamps = [], busy = false, renderTask, noticeTimer;
const notify = (message, error = false) => { $('status').textContent = message; $('status').className = 'visible' + (error ? ' error' : ''); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => $('status').className = '', error ? 10000 : 4500); };
function sync() {
  $('prev').disabled = busy || !pdf || pageNumber <= 1; $('next').disabled = busy || !pdf || pageNumber >= pdf.numPages;
  $('add').disabled = busy || !pdf || !source; $('download').disabled = busy || !pdf || !stamps.length;
  $('pdf-input').disabled = busy; $('image-input').disabled = busy;
  const s = stamps.find(s => s.id === selected); $('size').disabled = busy || !s; $('remove').disabled = busy || !s;
  $('size-value').value = s ? Math.round(s.w * 100) + '%' : '—'; if (s) $('size').value = s.w * 100;
  $('count').textContent = stamps.length ? `${stamps.length} 個簽名` : '尚未加入簽名'; $('page-label').textContent = pdf ? `${pageNumber} / ${pdf.numPages}` : '— / —';
}
function constrain(s) { s.w = Math.max(.03, Math.min(s.w, .98, .98 * viewport.height / (viewport.width * s.ratio))); s.h = s.w * viewport.width / viewport.height * s.ratio; s.x = Math.max(0, Math.min(s.x, 1 - s.w)); s.y = Math.max(0, Math.min(s.y, 1 - s.h)); }
function styleStamp(el, s) { Object.assign(el.style, {left:s.x*100+'%', top:s.y*100+'%', width:s.w*100+'%', height:s.h*100+'%'}); el.classList.toggle('selected', s.id === selected); }
function drawStamps() {
  $('overlay').replaceChildren();
  stamps.filter(s => s.page === pageNumber).forEach(s => {
    const el = document.createElement('div'); el.className = 'stamp'; el.tabIndex = 0; el.role = 'button'; el.setAttribute('aria-label','簽名圖片，使用方向鍵移動，Delete 刪除');
    const img = document.createElement('img'); img.src = s.data; img.alt = ''; img.draggable = false;
    const handle = document.createElement('span'); handle.className = 'handle'; handle.setAttribute('aria-hidden','true'); el.append(img,handle); styleStamp(el,s);
    el.onpointerdown = e => {
      if (busy) return; e.preventDefault(); e.stopPropagation(); selected=s.id; el.focus(); [...$('overlay').children].forEach(c=>c.classList.remove('selected')); styleStamp(el,s); sync();
      const bounds=$('page').getBoundingClientRect(), resize=e.target===handle;
      el.setPointerCapture(e.pointerId);
      const px=e.clientX, py=e.clientY, sx=s.x, sy=s.y, sw=s.w;
      el.onpointermove = event => {if(resize){s.w=sw+(event.clientX-px)/bounds.width;}else{s.x=sx+(event.clientX-px)/bounds.width;s.y=sy+(event.clientY-py)/bounds.height;} constrain(s);styleStamp(el,s);sync();};
      const end=()=>{el.onpointermove=null;el.onpointerup=null;el.onpointercancel=null;};el.onpointerup=end;el.onpointercancel=end;
    };
    el.onkeydown=e=>{if(busy)return;selected=s.id;const delta=e.shiftKey?.02:.003; if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Backspace'].includes(e.key)){e.preventDefault();if(e.key==='Delete'||e.key==='Backspace'){remove();return;}if(e.key==='ArrowLeft')s.x-=delta;if(e.key==='ArrowRight')s.x+=delta;if(e.key==='ArrowUp')s.y-=delta;if(e.key==='ArrowDown')s.y+=delta;constrain(s);styleStamp(el,s);sync();}};
    el.onfocus=()=>{selected=s.id;[...$('overlay').children].forEach(c=>c.classList.remove('selected'));styleStamp(el,s);sync();}; $('overlay').append(el);
  }); sync();
}
async function renderPage() {
  busy=true;sync();
  try {const p=await pdf.getPage(pageNumber);viewport=p.getViewport({scale:1});
    const available=Math.max(160,$('viewport').clientWidth-(innerWidth<760?32:72));const width=Math.min(viewport.width,available);const scale=width/viewport.width;
    const vp=p.getViewport({scale:scale*Math.min(devicePixelRatio||1,2)});const canvas=$('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
    $('page').style.width=width+'px';$('page').style.height=width*viewport.height/viewport.width+'px';$('page').hidden=false;$('empty').hidden=true;
    renderTask=p.render({canvasContext:canvas.getContext('2d'),viewport:vp});await renderTask.promise;drawStamps();
  }catch(e){notify('這一頁無法顯示，請嘗試其他頁面或另一份 PDF。',true);console.error(e);}finally{busy=false;sync();}
}
async function loadPDF(file) {
  if(!file||busy)return;if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'){notify('請選擇 PDF 格式的文件。',true);return;}
  busy=true;sync();notify('正在讀取 PDF…');let next;
  try {const bytes=new Uint8Array(await file.arrayBuffer());await PDFLib.PDFDocument.load(bytes);next=await pdfjs.getDocument({data:bytes.slice(),isEvalSupported:false}).promise;
    await next.getPage(1);if(pdf)await pdf.destroy();pdf=next;original=bytes;filename=file.name;pageNumber=1;stamps=[];selected=null;
    $('doc-title').textContent=filename;$('file-info').hidden=false;$('file-info').textContent=`${filename} · ${pdf.numPages} 頁`;
    await renderPage();notify('PDF 已就緒，請上傳簽名圖片。');
  }catch(e){if(next&&next!==pdf)await next.destroy();notify(/encrypt|password/i.test(String(e))?'這份 PDF 有密碼保護，請先解除密碼後再上傳。':'無法讀取這份 PDF，請確認檔案完整且格式正確。',true);console.error(e);}finally{busy=false;$('pdf-input').value='';sync();}
}
$('pdf-input').onchange=e=>loadPDF(e.target.files[0]);
['dragenter','dragover'].forEach(name=>$('drop').addEventListener(name,e=>{e.preventDefault();$('drop').classList.add('drag');}));
['dragleave','drop'].forEach(name=>$('drop').addEventListener(name,e=>{e.preventDefault();$('drop').classList.remove('drag');}));$('drop').addEventListener('drop',e=>loadPDF(e.dataTransfer.files[0]));
$('image-input').onchange=async e=>{const file=e.target.files[0];if(!file||busy)return;busy=true;sync();let url;
  try{if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('format');url=URL.createObjectURL(file);const img=new Image();img.src=url;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw Error('image');const c=document.createElement('canvas');const scale=Math.min(1,2400/Math.max(img.naturalWidth,img.naturalHeight));c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));c.getContext('2d').drawImage(img,0,0,c.width,c.height);source={data:c.toDataURL('image/png'),ratio:c.height/c.width};$('source-image').src=source.data;$('signature-preview').hidden=false;busy=false;if(pdf)addSignature();else notify('簽名圖片已就緒，請上傳 PDF。');
  }catch(err){notify('無法讀取圖片，請使用 PNG、JPG 或 WebP。',true);}finally{if(url)URL.revokeObjectURL(url);e.target.value='';busy=false;sync();}};
function addSignature(){if(busy||!pdf||!source)return;const s={...source,id:crypto.randomUUID(),page:pageNumber,x:.35,y:.4,w:.28};constrain(s);stamps.push(s);selected=s.id;drawStamps();notify('簽名已加入，可以拖曳移動與縮放。');}
$('add').onclick=addSignature;
function remove(){stamps=stamps.filter(s=>s.id!==selected);selected=null;drawStamps();} $('remove').onclick=remove;
$('size').oninput=e=>{const s=stamps.find(s=>s.id===selected);if(s){s.w=Number(e.target.value)/100;constrain(s);drawStamps();}};
$('overlay').onpointerdown=e=>{if(e.target===$('overlay')){selected=null;drawStamps();}};
async function navigate(n){if(busy||!pdf||!Number.isInteger(n)||n<1||n>pdf.numPages)throw Error('無效頁碼或文件忙碌中');pageNumber=n;selected=null;await renderPage();return{page:pageNumber,total:pdf.numPages};}
$('prev').onclick=()=>navigate(pageNumber-1);$('next').onclick=()=>navigate(pageNumber+1);
export async function createSignedPDF(bytes, items, getViewport){const doc=await PDFLib.PDFDocument.load(bytes);const cache=new Map();for(const s of items){let image=cache.get(s.data);if(!image){image=await doc.embedPng(s.data);cache.set(s.data,image);}const v=await getViewport(s.page);const x=s.x*v.width,y=s.y*v.height,w=s.w*v.width,h=s.h*v.height;const origin=v.convertToPdfPoint(x,y+h),right=v.convertToPdfPoint(x+w,y+h),top=v.convertToPdfPoint(x,y);doc.getPage(s.page-1).drawImage(image,{x:origin[0],y:origin[1],width:Math.hypot(right[0]-origin[0],right[1]-origin[1]),height:Math.hypot(top[0]-origin[0],top[1]-origin[1]),rotate:PDFLib.degrees(Math.atan2(right[1]-origin[1],right[0]-origin[0])*180/Math.PI)});}return doc.save();}
$('download').onclick=async()=>{if(busy||!stamps.length)return;busy=true;sync();$('download').textContent='正在儲存…';try{const bytes=await createSignedPDF(original,stamps,async n=>(await pdf.getPage(n)).getViewport({scale:1}));const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=filename.replace(/\.pdf$/i,'')+'_已簽名.pdf';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);notify('已產生簽名 PDF，下載已開始。');}catch(e){notify('儲存失敗，請重試或換一份 PDF。',true);console.error(e);}finally{busy=false;$('download').textContent='下載已簽名 PDF ↓';sync();}};
let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(pdf&&!busy)renderPage();},200);});
if(document.modelContext?.registerTool){try{Promise.resolve(document.modelContext.registerTool({name:'navigate_pdf_page',description:'切換已載入 PDF 的預覽頁面。',inputSchema:{type:'object',properties:{page:{type:'integer',minimum:1}},required:['page'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>navigate(input.page)})).catch(console.warn);}catch(e){console.warn(e);}}
sync();

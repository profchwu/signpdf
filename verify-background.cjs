const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const {PDFDocument,rgb}=require('./dist/vendor/pdf-lib.min.js');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
 const page=await browser.newPage();await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>window.PDFLib);
 const doc=await PDFDocument.create();for(let i=0;i<2;i++){const p=doc.addPage([600,800]);p.drawRectangle({x:0,y:0,width:600,height:800,color:rgb(.3,.6,.8)});}
 await page.locator('#pdf-input').setInputFiles({name:'test.pdf',mimeType:'application/pdf',buffer:Buffer.from(await doc.save())});
 await page.waitForFunction(()=>!document.querySelector('#image-input').disabled);
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=40;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,100,40);x.fillStyle='black';x.fillRect(30,10,10,20);x.fillStyle='blue';x.fillRect(50,10,10,20);x.fillStyle='rgb(210,210,210)';x.fillRect(80,0,20,40);x.clearRect(0,0,2,2);return c.toDataURL().split(',')[1];});
 await page.locator('#image-input').setInputFiles({name:'white-paper.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.waitForSelector('.stamp');
 async function pixels(){return page.locator('#source-image').evaluate(async img=>{await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const x=c.getContext('2d');x.drawImage(img,0,0);return [x.getImageData(5,5,1,1).data[3],x.getImageData(35,15,1,1).data[3],x.getImageData(55,15,1,1).data[3],x.getImageData(85,5,1,1).data[3],x.getImageData(0,0,1,1).data[3]];});}
 let p=await pixels();if(p[0]!==0||p[1]!==255||p[2]!==255||p[4]!==0)throw Error('alpha/ink preservation failed '+p);
 await page.locator('#remove-background').uncheck();p=await pixels();if(p[0]!==255||p[3]!==255||p[4]!==0)throw Error('restore failed');
 await page.locator('#remove-background').check();await page.locator('#background-strength').fill('100');await page.locator('#background-strength').dispatchEvent('input');p=await pixels();if(p[3]!==0)throw Error('strength failed');
 await page.locator('#next').click();await page.waitForFunction(()=>!document.querySelector('#add').disabled);await page.locator('#add').click();
 await page.locator('#remove-background').uncheck();await page.locator('#prev').click();await page.waitForFunction(()=>!document.querySelector('#add').disabled);
 let same=await page.evaluate(()=>document.querySelector('.stamp img').src===document.querySelector('#source-image').src);if(!same)throw Error('multi-page update failed');
 await page.locator('#remove-background').check();
 const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('#download').click()]);fs.mkdirSync('test-output',{recursive:true});await dl.saveAs('test-output/background-signed.pdf');
 const bytes=fs.readFileSync('test-output/background-signed.pdf');
 await page.evaluate(async data=>{const pdfjs=await import('./vendor/pdf.mjs');const pdf=await pdfjs.getDocument({data:new Uint8Array(data)}).promise;for(let n=1;n<=2;n++){const p=await pdf.getPage(n),v=p.getViewport({scale:1}),c=document.createElement('canvas');c.width=v.width;c.height=v.height;const ctx=c.getContext('2d');await p.render({canvasContext:ctx,viewport:v}).promise;const sample=ctx.getImageData(218,328,1,1).data;if(Math.abs(sample[0]-77)>3||Math.abs(sample[1]-153)>3||Math.abs(sample[2]-204)>3)throw Error('white box in exported PDF '+sample);}},[...bytes]);
 console.log('PASS: white removal, black/color preservation, transparent PNG, original restore, strength, multi-page update and exported transparency.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

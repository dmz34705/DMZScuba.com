const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://local.test');let file=path.join(root,decodeURIComponent(url.pathname));
  if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
  if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end();return;}
  const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);
});
const record=(kind,id,data)=>({kind,id,revision:1,deleted:false,data:{id,...data}});
const samples=Array.from({length:301},(_,i)=>({t:i*10,depth:i===0||i===300?0:20+Math.sin(i/20)*5,tempC:24-i/30,pressureBar:210-i/2,pressuresByTank:{0:210-i/2,1:180-i/3},ppo2:1.25+Math.sin(i/12)*.05,setpoint:1.3,ndl:Math.max(0,1200-i*4),cns:i/10,rbt:3000-i*10,deco:{type:i>240?'safetystop':'ndl',depth:i>240?5:0,seconds:i>240?180:0},extraSensor:{raw:i}}));
function fixtures(){return [
  record('dive','d1',{number:81,startTime:'2026-10-01T12:00:00Z',source:'computer',primaryLogId:'c1',logIds:['c1','c2'],durationSeconds:3000,site:{name:'Blue Hole',country:'Belize'},water:{maxDepthMeters:25},gas:{mixes:[{o2:.32,label:'EAN32'}]}}),
  record('computerLog','c1',{device:{vendor:'Shearwater',product:'Perdix'},durationSeconds:3000,profile:{samples,events:[{t:2400,type:'gaschange',note:'Switch to oxygen'}]}}),
  record('computerLog','c2',{device:{vendor:'Garmin',product:'Descent'},profile:{samples:samples.map((s)=>({t:s.t,depth:s.depth,tempC:s.tempC-.5,pressureBar:s.pressureBar-4})),events:[]}}),
  record('gear','reg',{name:'Travel regulator',category:'Regulator',condition:'Ready',components:[{id:'first',name:'First stage',type:'First stage'},{id:'second',name:'Second stage',type:'Second stage'}],accessoryItemIds:[]}),
  record('gear','mask',{name:'Backup mask',category:'Mask',condition:'Ready',components:[],accessoryItemIds:[]}),
  record('setup','s1',{name:'Boat setup',type:'Single tank',itemIds:['reg'],checkedIds:[],accessoryChoices:{},completeness:{done:true}}),
  record('plan','p1',{kind:'trip',title:'Belize week',status:'planned',startDate:'2027-02-10',endDate:'2027-02-12',destination:{name:'Belize'},setupId:'s1',extraItemIds:['mask'],packedIds:[],requirements:{certs:['advanced']},confirmed:{},travel:{},tasks:[],segments:[{id:'stay',type:'stay',title:'Reef hotel',provider:'Reef hotel',startDate:'2027-02-10',endDate:'2027-02-12',startTime:'15:00',endTime:'10:00',reference:'HOTEL123'},{id:'dive',type:'diving',title:'Two tank charter',startDate:'2027-02-11',startTime:'08:00',endTime:'13:00',dives:2,reference:'DIVE123'}]})
];}
(async()=>{
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME?{executablePath:process.env.PLAYWRIGHT_CHROME}:{})});
  try{
    for(const {width,height} of [{width:1440,height:900},{width:1366,height:768},{width:1024,height:768},{width:390,height:844},{width:390,height:667}]){
      const rows=fixtures(),errors=[],writes=[];
      rows.push(record('plan','p2',{...structuredClone(rows.find((row)=>row.id==='p1').data),id:'p2',title:'Second trip',startDate:'2028-02-10',endDate:'2028-02-12'}));
      const page=await browser.newPage({viewport:{width,height},acceptDownloads:true});
      page.on('pageerror',(error)=>errors.push(error.message));
      await page.addInitScript(()=>sessionStorage.setItem('dmzCustomerAccessToken','app-port-test'));
      await page.route('**/api/**',async(route)=>{
        const url=new URL(route.request().url()),req=route.request();let data={ok:true};
        if(url.pathname==='/api/account/auth/status')data={ok:true,enabled:true};
        else if(url.pathname==='/api/account')data={ok:true,profile:{userId:'test-owner',firstName:'Diver'},certifications:[{certificationName:'Rescue Diver'}]};
        else if(url.pathname==='/api/account/sync')data={ok:true,records:rows.filter((row)=>url.searchParams.get('include').split(',').includes(row.kind)),next:null};
        else if(url.pathname.startsWith('/api/account/sync/')){
          const [,kind,id]=url.pathname.match(/\/sync\/([^/]+)\/([^/]+)$/)||[];
          const row=rows.find((entry)=>entry.kind===kind&&entry.id===id);
          if(req.method()==='PUT'){const body=req.postDataJSON();writes.push({kind,id,...body});Object.assign(row,{data:body.data,revision:row.revision+1});}
          data={ok:true,record:row};
        }
        await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/pages/account/`);
      await page.click('.account-nav-menu [data-account-view="logbook"]');
      await page.waitForSelector('[data-select="d1"]');
      if(width<760)await page.click('[data-select="d1"]');
      await page.waitForSelector('[data-profile-plot]');
      await page.click('[data-diving-logbook] .tool-record-menu > summary');
      assert.equal(await page.locator('[data-diving-logbook] [data-delete]').isVisible(),true);
      await page.click('[data-diving-logbook] .record-workspace-title h3');
      assert.equal(await page.locator('[data-diving-logbook] [data-delete]').isVisible(),false,'secondary actions close when focus returns to the record');
      assert.equal(await page.locator('[data-curve="temperature"]').count(),1);
      assert.equal(await page.locator('[data-curve="pressure"]').count(),3,'two tanks plus a second computer');
      assert.equal(await page.locator('[data-curve="oxygen"]').count(),1);
      const fit=await page.evaluate(()=>{
        const selectors=['[data-profile-plot]','[data-profile-readout]','.profile-static','.profile-timeline'];
        return selectors.map((selector)=>{const el=document.querySelector(selector),box=el.getBoundingClientRect();return {selector,top:box.top,bottom:box.bottom,left:box.left,right:box.right,viewportWidth:innerWidth,viewportHeight:innerHeight};});
      });
      await page.screenshot({path:path.join(process.env.TEMP,`dmz-fit-${width}-${height}.png`),fullPage:true});
      for(const box of fit)assert.ok(box.top>=0&&box.bottom<=height+1&&box.left>=0&&box.right<=width+1,`Full profile and readings must fit without scrolling at ${width}x${height}: ${JSON.stringify(box)}`);
      assert.equal(await page.evaluate(()=>document.scrollingElement.scrollHeight<=innerHeight+1),true,'tool view has no document scroll');
      const plot=page.locator('[data-profile-plot]');await plot.scrollIntoViewIfNeeded();const box=await plot.boundingBox();
      await page.mouse.move(box.x+box.width*.3,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.7,box.y+box.height*.5,{steps:8});await page.mouse.up();
      const first=Number(await page.locator('[data-profile-scrub]').inputValue());await page.screenshot({path:path.join(process.env.TEMP,`dmz-app-drag-${width}.png`),fullPage:true});assert.ok(first>120&&first<280,`drag inspects a recorded sample (index ${first}, box ${JSON.stringify(box)})`);
      await plot.press('ArrowLeft');assert.equal(Number(await page.locator('[data-profile-scrub]').inputValue()),first-1);
      await page.click('[data-overlay="temperature"]');assert.equal(await page.locator('[data-curve="temperature"]').count(),0);
      await page.click('[data-overlay="temperature"]');
      await page.click('[data-profile-zoom="in"]');await page.click('[data-profile-reset]');
      await page.click('[data-profile-expand]');assert.equal(await page.locator('.profile-fullscreen').evaluate((el)=>el.open),true);
      await page.keyboard.press('Escape');assert.equal(await page.locator('.profile-fullscreen').evaluate((el)=>el.open),false);
      await page.screenshot({path:path.join(process.env.TEMP,`dmz-app-profile-${width}.png`),fullPage:true});
      await page.click('[data-tool-tab="data"]');
      assert.match(await page.locator('[data-samples-count]').innerText(),/1–100 of 602 samples/);
      assert.match(await page.locator('.sample-table thead').innerText(),/extraSensor.raw/);
      await page.click('[data-samples-page="1"]');assert.match(await page.locator('[data-samples-count]').innerText(),/101–200/);
      const downloaded=page.waitForEvent('download');await page.click('[data-samples-export]');const file=await (await downloaded).path();const csv=fs.readFileSync(file,'utf8');assert.equal(csv.split('\r\n').length,603,'every sample exported without decimation');
      await page.locator('[data-sample-index="100"]').first().click();assert.equal(await page.locator('[data-profile-scrub]').inputValue(),'100');
      await page.click('.account-nav-menu [data-account-view="gear"]');await page.click('[data-gear-page="setups"]');
      if(width<760)await page.click('[data-setup="s1"]');
      await page.waitForSelector('.packing-total');assert.match(await page.locator('.packing-total').innerText(),/0\s*\/\s*3/);
      await page.locator('[data-pack-keys]').first().check();await page.waitForFunction(()=>document.querySelector('.packing-total').textContent.includes('3 / 3'));
      const setupWrite=writes.filter((write)=>write.kind==='setup').at(-1);
      assert.deepEqual(setupWrite.data.checkedIds,['reg','reg::component::first','reg::component::second'],'packing keys match the app');
      await page.locator('.packing-part input').first().uncheck();await page.waitForFunction(()=>document.querySelector('.packing-total').textContent.includes('2 / 3'));
      assert.equal(await page.locator('[data-pack-keys]').first().evaluate((el)=>el.indeterminate),true);
      await page.screenshot({path:path.join(process.env.TEMP,`dmz-app-gear-${width}.png`),fullPage:true});
      if(width<760)await page.click('[data-diving-gear] [data-mobile-back]');
      await page.click('[data-gear-page="inventory"]');await page.click('[data-diving-gear] [data-select="reg"]');await page.click('[data-diving-gear] [data-tool-tab="service"]');
      await page.locator('.diving-components button').first().click();await page.fill('[name="serialNumber"]','PART-123');await page.click('.diving-dialog [type="submit"]');await page.waitForFunction(()=>!document.querySelector('.diving-dialog').open);
      assert.equal(rows.find((row)=>row.id==='reg').data.components[0].serialNumber,'PART-123','component edits preserve the original component ID and packing key');
      await page.click('.account-nav-menu [data-account-view="planner"]');await page.waitForSelector('[data-plan-select="p1"]');
      const tripRow=await page.locator('[data-plan-select="p1"]').boundingBox();
      assert.ok(tripRow.height<170,'trip selector uses a compact row rather than stacked metric boxes');
      assert.match(await page.locator('[data-plan-select="p1"]').innerText(),/Feb 10.*12, 2027/);
      if(width<760)await page.click('[data-plan-select="p1"]');
      await page.click('[data-tool-tab="itinerary"]');assert.equal(await page.locator('.trip-day').count(),3);
      assert.ok((await page.locator('.trip-leg').first().boundingBox()).height<100,'booking rows remain compact on desktop and phones');
      assert.equal(await page.locator('[data-plan-detail]').evaluate((el)=>el.scrollWidth<=el.clientWidth+1),true,'agenda fits horizontally');
      assert.equal(await page.locator('.trip-day').nth(1).locator('[data-leg-edit="stay"]').count(),1,'stay continues across each occupied day');
      await page.locator('[data-leg-edit="dive"]').first().click();await page.fill('[name="title"]','Updated charter');await page.click('.planner-dialog [type="submit"]');await page.waitForSelector('text=Updated charter');
      await page.screenshot({path:path.join(process.env.TEMP,`dmz-app-trip-${width}.png`),fullPage:true});
      await page.click('[data-plan-detail] [data-tool-tab="packing"]');assert.match(await page.locator('[data-plan-detail] .packing-total').innerText(),/0\s*\/\s*4/,'trip has independent checks including extra gear');
      await page.locator('[data-plan-detail] [data-pack-keys]').first().check();await page.waitForFunction(()=>document.querySelector('[data-plan-detail] .packing-total').textContent.includes('3 / 4'));
      assert.equal(rows.find((row)=>row.kind==='setup').data.checkedIds.length,2,'trip packing does not overwrite quick-dive packing');
      await page.click('[data-plan-detail] [data-tool-tab="overview"]');await page.fill('[data-task-add] input','Confirm tanks');await page.click('[data-task-add] button');await page.waitForSelector('text=Confirm tanks');
      await page.click('[data-tool-tab="readiness"]');assert.doesNotMatch(await page.locator('.planner-alerts').innerText(),/Advanced Open Water card/,'Rescue card satisfies Advanced, as in the app');
      await page.click('[data-tool-tab="itinerary"]');await page.click('[data-booking-import]');
      await page.fill('[data-booking-text]','Booking confirmation HOTEL789\nHilton Hotel\nCheck-in: February 10, 2027\nCheck-out: February 12, 2027');await page.click('[data-import-read]');await page.waitForSelector('[data-import-save]');await page.click('[data-import-save]');await page.waitForFunction(()=>!document.querySelector('.planner-dialog').open);
      assert.ok(rows.find((row)=>row.kind==='plan').data.segments.some((leg)=>leg.provider.includes('Hilton')),'reviewed email booking saved through app parser');
      if(width<760)await page.click('[data-plan-mobile-back]');
      await page.fill('[data-plan-search]','Second');
      await page.click('[data-plan-select="p2"]');
      await page.click('[data-plan-detail] [data-tool-tab="itinerary"]');
      await page.route('**/pages/travel/**',(route)=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Atlas navigation test</title><h1>Atlas</h1>'}));
      await page.click('[data-plan-detail] a:has-text("Open in Atlas")');
      await page.waitForURL('**/pages/travel/**');
      await page.goBack();
      await page.waitForSelector('[data-plan-select="p2"][aria-pressed="true"]',{state:'attached'});
      assert.equal(await page.locator('[data-plan-detail] [data-tool-tab="itinerary"]').getAttribute('aria-selected'),'true','Back from Atlas restores the trip and itinerary tab');
      assert.equal(await page.locator('[data-plan-detail]').isVisible(),true,'phone returns to trip detail, not the selector');
      await page.reload();
      await page.waitForSelector('[data-plan-select="p2"][aria-pressed="true"]',{state:'attached'});
      assert.equal(await page.locator('[data-plan-detail] [data-tool-tab="itinerary"]').getAttribute('aria-selected'),'true','reload also restores without relying on the back-forward cache');
      assert.equal(await page.locator('[data-plan-search]').inputValue(),'Second','trip search survives the round trip');
      assert.equal(await page.evaluate(()=>window.DMZWorkspace.read('another-owner','planner')),null,'workspace state is scoped to the signed-in account');
      await page.click('.account-nav-menu [data-account-view="gear"]');
      await page.waitForSelector('[data-diving-gear] [data-select="reg"]',{state:'attached'});
      if(width<760 && await page.locator('[data-diving-gear] [data-mobile-back]').isVisible())await page.click('[data-diving-gear] [data-mobile-back]');
      await page.click('[data-diving-gear] [data-select="reg"]');
      await page.click('[data-diving-gear] [data-tool-tab="service"]');
      await page.reload();
      await page.waitForSelector('[data-diving-gear] [data-select="reg"][aria-pressed="true"]',{state:'attached'});
      assert.equal(await page.locator('[data-diving-gear] [data-tool-tab="service"]').getAttribute('aria-selected'),'true','gear selection and service tab survive reload');
      await page.click('.account-nav-menu [data-account-view="logbook"]');
      await page.waitForSelector('[data-select="d1"]',{state:'attached'});
      if(width<760 && await page.locator('[data-select="d1"]').isVisible())await page.click('[data-select="d1"]');
      await page.click('[data-diving-logbook] [data-tool-tab="details"]');
      await page.reload();
      await page.waitForSelector('[data-diving-logbook] [data-tool-tab="details"][aria-selected="true"]');
      await page.click('.account-more > summary');await page.click('.account-more [data-account-view="profile"]');
      assert.equal(await page.locator('[data-account-view-panel="profile"]').isVisible(),true,'account settings remain accessible in the compact navigation');
      assert.equal(await page.locator('.account-more').evaluate((el)=>el.open),false);
      assert.equal(await page.evaluate(()=>document.body.classList.contains('is-account-tools')),false,'account forms restore normal page scrolling');
      await page.click('.account-more > summary');await page.click('[data-logout]');
      await page.waitForSelector('[data-account-auth]:not([hidden])');
      assert.equal(await page.evaluate(()=>history.state?.dmzWorkspace),undefined,'sign out clears saved workspace state');
      assert.equal(await page.evaluate(()=>document.body.classList.contains('is-account-tools')),false,'sign out clears the viewport layout');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no page overflow');
      assert.deepEqual(errors,[],'no browser runtime errors');await page.close();
    }
    console.log('PASS: pointer/keyboard profile inspection, overlays, zoom, expansion, all-sample CSV, app packing keys, independent trip checks, day itinerary editing, readiness and booking import on desktop/mobile.');
  }finally{await browser.close();server.close();}
})().catch((error)=>{console.error(error);server.close();process.exitCode=1;});

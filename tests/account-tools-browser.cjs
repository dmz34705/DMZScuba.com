const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const types = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon' };
const server = http.createServer((request,response) => {
  const url = new URL(request.url,'http://local.test');
  let file = path.join(root,decodeURIComponent(url.pathname).replace(/^\/+/,''));
  if (url.pathname.endsWith('/')) file=path.join(file,'index.html');
  if (!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){response.writeHead(404);response.end('not found');return;}
  response.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(response);
});
const records = [
  {kind:'plan',id:'plan-1',revision:1,deleted:false,data:{id:'plan-1',kind:'trip',status:'planned',title:'Cozumel week',startDate:'2027-02-10',endDate:'2027-02-17',destination:{name:'Paraíso Reef',siteId:'mx-cozumel-paraiso',latitude:20.4735,longitude:-86.9797,area:'Cozumel',country:'Mexico'},operator:{name:'Local operator'},dives:6,setupId:'setup-1',packedIds:[],requirements:{certs:['nitrox']},segments:[{id:'leg-1',type:'diving',title:'Two-tank boat dives',startDate:'2027-02-11',dives:2}],tasks:[{id:'task-1',label:'Confirm tanks',done:false}],notes:'Check currents.'}},
  {kind:'setup',id:'setup-1',revision:1,deleted:false,data:{id:'setup-1',name:'Warm-water travel',type:'Travel',itemIds:['gear-1'],checkedIds:[]}},
  {kind:'gear',id:'gear-1',revision:1,deleted:false,data:{id:'gear-1',name:'Travel BCD',category:'BCD',condition:'Ready'}},
  {kind:'dive',id:'dive-1',revision:1,deleted:false,data:{id:'dive-1',number:42,startTime:'2026-08-01T15:00:00Z',durationSeconds:3300,source:'computer',site:{name:'Lake Wazee',country:'US',latitude:44.3,longitude:-90.7},water:{maxDepthMeters:28,avgDepthMeters:16,tempMinC:8,visibilityMeters:10},gas:{mixes:[{label:'Air'}]},tags:['training'],notes:'Good dive.'}},
];
(async()=>{
  await new Promise((resolve)=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME ? { executablePath:process.env.PLAYWRIGHT_CHROME } : {})});
  try {
    for (const viewport of [{width:1440,height:1000},{width:1000,height:800},{width:390,height:844}]) {
      const page=await browser.newPage({viewport});
      await page.goto(`http://127.0.0.1:${server.address().port}/pages/account/`,{waitUntil:'domcontentloaded'});
      await page.evaluate((rows)=>{
        const mock=async(path,options={})=>{
          if(path.includes('?include='))return {ok:true,records:rows,next:null};
          if(options.method==='PUT'){const body=JSON.parse(options.body);return {ok:true,record:{kind:path.split('/').at(-2),id:body.data.id,revision:2,deleted:body.deleted,data:body.data}};}
          return {ok:true,record:rows.find((row)=>path.endsWith(row.id))};
        };
        const account={profile:{userId:'browser-test'},certifications:[{certificationName:'Enriched Air Nitrox'}]};
        window.DMZPlanner.connect({request:mock,account});window.DMZPlanner.open();
        window.DMZDiving.connect({request:mock,account});window.DMZDiving.open('logbook');
        document.querySelector('[data-account-dashboard]').hidden=false;
        document.querySelector('[data-account-intro]').hidden=true;
        document.querySelector('[data-account-auth]').hidden=true;
        document.querySelector('[data-account-view-panel="home"]').hidden=true;
        document.querySelector('[data-dashboard-status]').textContent='';
        document.querySelector('[data-account-view-panel="planner"]').hidden=false;
      },records);
      await page.waitForSelector('text=Cozumel week');
      await page.click('[data-plan-select="plan-1"]');
      if (viewport.width <= 760) {
        assert.equal(await page.locator('.planner-detail').evaluate((el) => el.closest('.diving-layout').classList.contains('is-mobile-detail')), true);
        await page.click('[data-plan-mobile-back]');
        assert.equal(await page.locator('.planner-detail').evaluate((el) => el.closest('.diving-layout').classList.contains('is-mobile-detail')), false);
        await page.click('[data-plan-select="plan-1"]');
      }
      await page.click('[data-plan-detail] [data-tool-tab="readiness"]');
      await page.waitForSelector('text=Atlas + Gear Locker suggestion');
      assert.match(await page.locator('[data-plan-detail]').innerText(),/Atlas \+ Gear Locker suggestion/);
      await page.click('[data-plan-detail] [data-tool-tab="itinerary"]');
      assert.match(await page.locator('[data-plan-detail]').innerText(),/Two-tank boat dives/);
      await page.click('[data-plan-new]');
      await page.fill('[name="title"]','Draft that must survive');
      await page.click('.planner-dialog [data-tool-tab="section-3"]');
      await page.click('[data-add-segment]');
      assert.equal(await page.locator('.planner-segment').count(),1);
      assert.equal(await page.locator('[name="title"]').inputValue(),'Draft that must survive');
      await page.click('[data-cancel]');
      await page.evaluate(()=>{document.querySelector('[data-account-view-panel="planner"]').hidden=true;document.querySelector('[data-account-view-panel="logbook"]').hidden=false;});
      await page.click('[data-diving-logbook] [data-select="dive-1"]');
      if (viewport.width <= 760) {
        assert.equal(await page.locator('[data-diving-logbook] .diving-layout').evaluate((el) => el.classList.contains('is-mobile-detail')), true);
        await page.click('[data-diving-logbook] [data-mobile-back]');
        assert.equal(await page.locator('[data-diving-logbook] .diving-layout').evaluate((el) => el.classList.contains('is-mobile-detail')), false);
        await page.click('[data-diving-logbook] [data-select="dive-1"]');
      }
      await page.click('[data-diving-logbook] [data-tool-tab="details"]');
      assert.equal(await page.locator('[data-diving-logbook] .record-sections .record-section').count(),4);
      assert.match(await page.locator('[data-diving-logbook] [data-detail]').innerText(),/Visibility/);
      await page.click('[data-diving-logbook] [data-tool-tab="data"]');
      await page.waitForSelector('[data-diving-logbook] .diving-raw');
      await page.click('[data-diving-logbook] .diving-raw > summary');
      assert.match(await page.locator('[data-full-record]').innerText(),/"maxDepthMeters": 28/);
      assert.equal(await page.locator('[data-diving-logbook] [data-export-csv]').count(),1);
      await page.screenshot({path:path.join(process.env.TEMP||root,`dmz-detail-${viewport.width}.png`),fullPage:true});
      const overflow=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter((el)=>el.getBoundingClientRect().right>innerWidth+1&&el.getBoundingClientRect().width).map((el)=>({tag:el.tagName,class:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})).slice(0,8));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`no horizontal page overflow at ${viewport.width}: ${JSON.stringify(overflow)}`);
      if(viewport.width>760){
        assert.equal(await page.locator('[data-diving-logbook] .diving-layout').evaluate((el)=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2,'tablet and desktop keep two columns');
      }else{
        assert.equal(await page.locator('[data-diving-logbook] .diving-toolbar').isVisible(),false,'mobile details hide list controls');
        await page.click('[data-diving-logbook] [data-mobile-back]');
      }
      await page.click('[data-log-page="stats"]');
      assert.equal(await page.locator('[data-log-analytics]').isVisible(),true);
      await page.screenshot({path:path.join(process.env.TEMP||root,`dmz-tools-${viewport.width}.png`),fullPage:true});
      await page.close();
    }
    // Exercise the real account request path (rather than the UI-only mock above).
    // A temporary 503 must recover without clearing the session or reloading the page.
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    let syncAttempts=0,profileFetches=0,savedPlan;
    const samplePlan=structuredClone(records[0]);
    samplePlan.data.appOnlyField={preserve:true};
    samplePlan.data.segments[0].appOnlyFlightField='Keep this';
    const dive=structuredClone(records.find((row)=>row.kind==='dive'));
    dive.data.primaryLogId='computer-1';
    const computer={kind:'computerLog',id:'computer-1',revision:1,deleted:false,data:{id:'computer-1',profile:{samples:[{t:0,depth:0,tempC:20},{t:60,depth:28,tempC:8,pressureBar:180}]}}};
    await page.addInitScript(()=>sessionStorage.setItem('dmzCustomerAccessToken','test-session'));
    await page.route('**/api/**',async(route)=>{
      const url=new URL(route.request().url());
      let data={ok:true},status=200;
      if(url.pathname==='/api/account/auth/status')data={ok:true,enabled:true};
      else if(url.pathname==='/api/account')data={ok:true,profile:{userId:'real-path-test',firstName:'Test',email:'test@example.com'},certifications:[]};
      else if(url.pathname==='/api/account/sync'){
        syncAttempts++;
        assert.ok(!url.searchParams.get('include').split(',').includes('computerLog'),'initial list never downloads every profile');
        if(syncAttempts<=2){status=503;data={ok:false,error:'Temporary upstream failure'};}
        else data={ok:true,records:[samplePlan,dive,...Array.from({length:60},(_,i)=>({kind:'dive',id:`old-${i}`,revision:1,data:{id:`old-${i}`,site:{name:`Older dive ${i}`},startTime:'2010-01-01T12:00:00Z',durationSeconds:1200}})),...records.filter((row)=>['gear','setup'].includes(row.kind))],next:null};
      }else if(url.pathname.endsWith('/computerLog/computer-1')){profileFetches++;data={ok:true,record:computer};}
      else if(route.request().method()==='PUT'){
        savedPlan=route.request().postDataJSON();data={ok:true,record:{...samplePlan,revision:2,data:savedPlan.data}};
      }
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/pages/account/`);
    await page.click('.account-nav-menu [data-account-view="logbook"]');
    await page.waitForSelector('[data-select="dive-1"]');
    assert.equal(syncAttempts,3,'real sync reads automatically recover from two transient 503s');
    await page.waitForSelector('[data-profile-scrub]');
    assert.equal(await page.locator('[data-diving-logbook] [data-select]').count(),1,'older years are collapsed without rendering their records');
    await page.click('[data-browser-group="year:2010"] > summary');
    await page.click('[data-browser-group="month:2010:0"] > summary');
    await page.waitForSelector('[data-browser-group="month:2010:0"] [data-select]');
    assert.equal(await page.locator('[data-browser-group="month:2010:0"] [data-select]').count(),24,'expanded months use bounded batches');
    await page.click('[data-group-more="month:2010:0"]');
    assert.equal(await page.locator('[data-browser-group="month:2010:0"] [data-select]').count(),48,'show more expands only this month');
    await page.click('[data-diving-logbook] [data-groups-action="collapse"]');
    await page.fill('[data-diving-logbook] [data-search]','Older');
    await page.waitForSelector('[data-diving-logbook] [data-select="old-0"]');
    assert.equal(await page.locator('[data-browser-group="year:2010"]').evaluate((el)=>el.open),true,'search reveals matching records even inside collapsed years');
    await page.fill('[data-diving-logbook] [data-search]','');
    assert.equal(await page.locator('[data-browser-group="year:2010"]').evaluate((el)=>el.open),false,'clearing search restores collapsed-state preference');
    await page.click('[data-diving-logbook] .browser-filters > summary');
    await page.selectOption('[data-diving-logbook] [data-organization]','flat');
    await page.click('[data-diving-logbook] .browser-filters > summary');
    assert.equal(await page.locator('[data-diving-logbook] [data-select]').count(),24,'flat-list alternative keeps bounded pagination');
    await page.click('[data-diving-logbook] [data-list-page="1"]');
    assert.match(await page.locator('[data-diving-logbook] .tool-list-pagination').innerText(),/25–48 of 61/);
    await page.click('[data-diving-logbook] [data-list-page="-1"]');
    await page.click('[data-tool-tab="profile"]');
    await page.waitForSelector('[data-profile-scrub]');
    assert.equal(profileFetches,1,'only the selected computer profile is requested');
    await page.locator('[data-profile-scrub]').fill('1');
    assert.match(await page.locator('[data-profile-readout]').innerText(),/28.0 m/);
    await page.click('.account-nav-menu [data-account-view="planner"]');
    await page.click('[data-plan-edit="plan-1"]');
    await page.fill('[name="title"]','Preserved trip');
    await page.click('.planner-dialog [type="submit"]');
    await page.waitForFunction(()=>!document.querySelector('.planner-dialog').open);
    assert.deepEqual(savedPlan.data.appOnlyField,{preserve:true});
    assert.equal(savedPlan.data.segments[0].appOnlyFlightField,'Keep this','website editing preserves app-only itinerary fields');
    await page.close();
    console.log('PASS: desktop and mobile planner, Atlas/Gear readiness, itinerary, rich log details, and export controls.');
  } finally { await browser.close();server.close(); }
})().catch((error)=>{console.error(error);server.close();process.exitCode=1;});

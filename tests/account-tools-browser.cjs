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
    for (const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
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
      await page.waitForSelector('text=Atlas + Gear Locker suggestion');
      await page.locator('[data-plan-detail] .planner-disclosure').nth(1).locator('summary').click();
      assert.match(await page.locator('[data-plan-detail]').innerText(),/Atlas \+ Gear Locker suggestion/);
      assert.match(await page.locator('[data-plan-detail]').innerText(),/Two-tank boat dives/);
      await page.click('[data-plan-new]');
      await page.click('[data-add-segment]');
      assert.equal(await page.locator('.planner-segment').count(),1);
      await page.click('[data-cancel]');
      await page.evaluate(()=>{document.querySelector('[data-account-view-panel="planner"]').hidden=true;document.querySelector('[data-account-view-panel="logbook"]').hidden=false;});
      await page.click('[data-diving-logbook] [data-select="dive-1"]');
      if (viewport.width <= 760) {
        assert.equal(await page.locator('[data-diving-logbook] .diving-layout').evaluate((el) => el.classList.contains('is-mobile-detail')), true);
        await page.click('[data-diving-logbook] [data-mobile-back]');
        assert.equal(await page.locator('[data-diving-logbook] .diving-layout').evaluate((el) => el.classList.contains('is-mobile-detail')), false);
        await page.click('[data-diving-logbook] [data-select="dive-1"]');
      }
      await page.waitForSelector('[data-diving-logbook] .diving-raw');
      assert.equal(await page.locator('[data-diving-logbook] .diving-stat').count(),6);
      assert.equal(await page.locator('[data-diving-logbook] .record-sections details').count(),4);
      assert.equal(await page.locator('[data-diving-logbook] .record-sections details[open]').count(),1);
      assert.match(await page.locator('[data-diving-logbook] [data-detail]').innerText(),/Visibility/);
      assert.equal(await page.locator('[data-diving-logbook] [data-export-csv]').count(),1);
      await page.close();
    }
    console.log('PASS: desktop and mobile planner, Atlas/Gear readiness, itinerary, rich log details, and export controls.');
  } finally { await browser.close();server.close(); }
})().catch((error)=>{console.error(error);server.close();process.exitCode=1;});

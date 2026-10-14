// Regenerate the browser's pure domain modules from a reviewed app revision.
// Usage: node scripts/build-account-app-port.cjs <app-repo> [--check]
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const app=process.argv[2];if(!app)throw new Error('Supply the dmzscuba-app checkout path.');
const ref='6cccd64',root=path.resolve(__dirname,'..');
const modules=[['DMZGearModel','src/features/gearChecklist/model.js'],['DMZInsuranceModel','src/features/insurance/model.js'],['DMZPlannerModel','src/features/planner/model.js'],['DMZFlightParser','src/features/planner/bookingImport/parseFlightText.js'],['DMZBookingParser','src/features/planner/bookingImport/parseBookingText.js'],['DMZBookingImport','src/features/planner/bookingImport/planImport.js']];
const aliases={'../gearChecklist/model':'DMZGearModel','../insurance/model':'DMZInsuranceModel','./parseFlightText':'DMZFlightParser','../model':'DMZPlannerModel'};
const read=(file)=>execFileSync('git',['-C',app,'show',`${ref}:${file}`],{encoding:'utf8',maxBuffer:5e6}).replace(/\r\n/g,'\n').trimEnd();
function output(file,content){
  const target=path.join(root,file),expected=content.trimEnd()+'\n';
  if(process.argv.includes('--check')){
    if(fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n')!==expected)throw new Error(`${file} differs from the reviewed app source.`);
    console.log(`PASS ${file} matches app ${ref}`);
  }else fs.writeFileSync(target,expected);
}
let content=`// Pure domain logic ported from dmzscuba-app at ${ref}.
// UI adapters use the same packing keys, component rules, readiness checks, timeline,
// and deterministic booking parsers as the app. See docs/account-app-port.md.
`;
for(const [namespace,file]of modules){
  const source=read(file),names=[...source.matchAll(/^export (?:function|const|class) (\w+)/gm)].map((match)=>match[1]);
  const body=source.replace(/^import \{([\s\S]*?)\} from ['"]([^'"]+)['"];?/gm,(_,spec,from)=>{if(!aliases[from])throw new Error(`Unhandled app dependency: ${from}`);return `const {${spec}} = window.${aliases[from]};`;}).replace(/^export /gm,'');
  content+=`\n// ${file}\n(() => {\n'use strict';\n${body}\nwindow.${namespace} = { ${names.join(', ')} };\n})();\n`;
}
output('js/account-app-models.js',content);
output('js/dive-profile-geometry.js',`// Ported without geometry changes from dmzscuba-app/src/lib/diveLog/profileChart.js
// Source: dmzscuba-app origin/main (${ref}). Keep numeric behavior in sync with the app.
(() => {
'use strict';
${read('src/lib/diveLog/profileChart.js').replace('export function buildLogProfileGeometry','function buildLogProfileGeometry')}
window.DMZProfileGeometry = { buildLogProfileGeometry };
})();`);

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function makeApp(values = new Map(), session = { authorized:false }, route = '/') {
  const handlers = new Map();
  const elements = new Map();
  const downloads = [];
  const exported = [];
  const localStorage = { getItem:k=>values.get(k)??null, setItem:(k,v)=>values.set(k,String(v)), removeItem:k=>values.delete(k) };
  const element = selector => {
    if(!elements.has(selector)) elements.set(selector,{innerHTML:'',textContent:'',value:'',dataset:{},classList:{add(){},remove(){},toggle(){}},
      addEventListener:(name,fn)=>handlers.set(`${selector}:${name}`,fn),click(){this.onclick?.()},focus(){},scrollIntoView(){}});
    return elements.get(selector);
  };
  const document={hidden:false,querySelector:element,querySelectorAll:()=>[],addEventListener:(n,fn)=>handlers.set(`document:${n}`,fn),createElement:()=>({click(){downloads.push(this.download)}})};
  const location={pathname:route};Object.defineProperty(location,'href',{set:v=>{location.pathname=new URL(v,'http://localhost').pathname}});
  const window={ENIGMA_CASE:undefined,location,addEventListener:(n,fn)=>handlers.set(`window:${n}`,fn),dispatchEvent(){}};
  class FakeFormData { constructor(){ } get(k){return ({team:'Cipher Pair',p1:'Asha',p2:'Rohan',pin:'98765432'})[k]||''} }
  class FakeBlob {constructor(parts){this.parts=parts} text(){return Promise.resolve(this.parts.join(''))}}
  session.teams ||= [];session.event ||= {state:'live',startedAt:Date.now(),closedAt:null};
  const fetch=async(url,options={})=>{if(url==='/api/event'){if(options.method==='POST'){session.event=JSON.parse(options.body);return{ok:true,json:async()=>session.event}}return{ok:true,json:async()=>session.event}}if(url==='/api/organizer-session'){if(options.method==='POST'){const valid=JSON.parse(options.body).pin==='98765432';session.authorized=valid;return{ok:valid,json:async()=>({authorized:valid})}}if(options.method==='DELETE'){session.authorized=false;return{ok:true,json:async()=>({authorized:false})}}return{ok:true,json:async()=>({authorized:session.authorized})}}if(url==='/api/teams/import'){if(!session.authorized)return{ok:false,json:async()=>({})};const body=JSON.parse(options.body);for(const t of body.teams)if(!session.teams.some(x=>x.id===t.id))session.teams.push({...t,syncToken:'legacy'});return{ok:true,json:async()=>({imported:[]})}}if(url==='/api/teams'&&options.method==='GET')return{ok:session.authorized,json:async()=>session.teams.map(({syncToken,...t})=>t)};if(url==='/api/teams'&&options.method==='POST'){const team=JSON.parse(options.body),syncToken='owner-'+team.id;session.teams.push({...team,syncToken});return{ok:true,json:async()=>({syncToken})}}if(url.startsWith('/api/teams/')&&options.method==='PUT'){const id=url.split('/').pop(),team=session.teams.find(t=>t.id===id);if(team)Object.assign(team,JSON.parse(options.body));return{ok:true,json:async()=>({saved:true})}}return{ok:false,json:async()=>({})}};
  const context={window,document,localStorage,FormData:FakeFormData,Blob:FakeBlob,fetch,URL:{createObjectURL:blob=>{exported.push(blob);return 'blob:test'},revokeObjectURL(){}},
    setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},Event:class{},Math,Date,console};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('content.js','utf8'),context);
  vm.runInContext(fs.readFileSync('app.js','utf8'),context);
  const click=(selector)=>{const el=element(selector);const fn=handlers.get(`${selector}:click`)||el.onclick;assert.ok(fn,`missing click handler for ${selector}`);fn.call(el)};
  return {element,handlers,click,localStorage,downloads,exported,context,session,values};
}

test('complete team case, hint accounting, persistence, ranking and exports',async()=>{
  const store=new Map(),session={authorized:false,teams:[],event:{state:'live',startedAt:Date.now(),closedAt:null}};
  let app=makeApp(store,session,'/organizer');
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(app.element('#app').innerHTML,/Organizer access/);
  app.element('#organizer-pin').value='98765432';
  await app.handlers.get('#organizer-login-form:submit')({preventDefault(){}});
  assert.match(app.element('#app').innerHTML,/Organizer console/);
  assert.match(app.element('#app').innerHTML,/Participants can begin their cases/);
  app=makeApp(store,session,'/');
  await new Promise(resolve=>setImmediate(resolve));
  const submit=app.handlers.get('#register-form:submit');
  assert.ok(submit,'registration form is available before the case starts');
  await submit({preventDefault(){},currentTarget:{querySelector:()=>({disabled:false})}});
  let db=JSON.parse(app.localStorage.getItem('enigma-v1'));
  let team=db.teams[0];
  assert.equal(team.status,'registered');
  assert.match(team.id,/^EN-/);
  assert.ok(['A','B','C','D'].includes(team.variant));
  app.click('#begin-case');
  db=JSON.parse(app.localStorage.getItem('enigma-v1'));team=db.teams[0];
  assert.equal(team.status,'active');
  assert.doesNotMatch(app.element('#app').innerHTML,/Variant [A-D]|SET [A-D]/);
  const start=team.startedAt;
  app.click('#hint-btn');
  app.click('#hint-btn');
  app.click('#modal-confirm');
  db=JSON.parse(app.localStorage.getItem('enigma-v1'));team=db.teams[0];
  assert.equal(team.freeHints,1);assert.equal(team.penaltyHints,1);assert.equal(team.penaltySeconds,60);
  const variants=app.context.window.ENIGMA_CASE.variants;
  const rounds=app.context.window.ENIGMA_CASE.rounds;
  for(let round=0;round<rounds.length;round++){
    db=JSON.parse(app.localStorage.getItem('enigma-v1'));team=db.teams[0];
    const v=variants.find(x=>x.id===team.variant);
    const answer=[v.trail.answer,v.decode.answer,'KAPOOR',v.locked.answer,v.final.answer][round];
    const submitAnswer=app.handlers.get('#answer-form:submit');
    assert.ok(submitAnswer,`answer form for round ${round+1}`);
    if(round===0){for(const bad of ['wrong one','wrong two','wrong three']){app.element('#answer').value=bad;submitAnswer({preventDefault(){}})}db=JSON.parse(app.localStorage.getItem('enigma-v1'));team=db.teams[0];assert.equal(team.wrongAttemptsByRound['0'],3);assert.equal(team.penaltySeconds,420);assert.equal(app.element('#timer').textContent,'38:00')}
    if(round===1){app.element('#answer').value='wrong';submitAnswer({preventDefault(){}});db=JSON.parse(app.localStorage.getItem('enigma-v1'));team=db.teams[0];assert.equal(team.wrongAttemptsByRound['1'],1);assert.equal(team.penaltySeconds,480)}
    app.element('#answer').value=answer;
    submitAnswer({preventDefault(){}});
    if(round<4) app.click('#continue-round');
  }
  db=JSON.parse(app.localStorage.getItem('enigma-v1'));team=db.teams[0];
  assert.equal(team.status,'completed');assert.equal(team.round,5);assert.equal(team.penaltySeconds,480);
  assert.equal(team.startedAt,start);
  assert.match(app.element('#app').innerHTML,/Case solved/);
  await new Promise(resolve=>setImmediate(resolve));
  const slower={...team,id:'EN-SLOW-001',name:'Second Team',status:'completed',startedAt:Date.now()-600000,completedAt:Date.now(),expiredAt:null,penaltySeconds:0,freeHints:0,penaltyHints:0,round:5};
  db.teams.push(slower);app.localStorage.setItem('enigma-v1',JSON.stringify(db));
  app=makeApp(store,session,'/organizer');
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(app.element('#app').innerHTML,/COMPLETED/);
  assert.match(app.element('#app').innerHTML,/Cipher Pair/);
  assert.match(app.element('#app').innerHTML,/<td class="rank">01<\/td>/);
  assert.doesNotMatch(app.element('#app').innerHTML,/data-filter="expired"|data-filter="registered"/);
  app.click('#sort-by-time');assert.match(app.element('#app').innerHTML,/TIME: FASTEST FIRST/);
  app.click('#export-csv');
  assert.deepEqual(app.downloads,['enigma-results.csv']);
  assert.equal(app.exported.length,1);
  const csv=await app.exported[0].text();
  assert.match(csv,/Cipher Pair/);assert.match(csv,/Second Team/);
});

test('all hidden puzzle packets decode to internally consistent recovery keys',()=>{
  const app=makeApp();
  const packets=app.context.window.ENIGMA_CASE.variants;
  const routes={NORTH:'1',EAST:'2',SOUTH:'3',WEST:'4'};
  for(const v of packets){
    const shift=Number(v.trail.answer.at(-1));
    const decoded=v.cipher.replace(/[A-Z]/g,char=>String.fromCharCode((char.charCodeAt(0)-65-shift+26)%26+65));
    assert.equal(decoded,v.direction,`Caesar fragment for packet ${v.id}`);
    assert.equal(v.key,`${v.trail.answer.at(-1)}${routes[v.direction]}${v.issuerBadge}${v.trail.file.at(-1)}`,`recovery key for packet ${v.id}`);
    assert.equal(v.final.answer,`${v.direction}-KAPOOR-${v.key}`);
  }
});

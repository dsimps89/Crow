'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const PORT=Number(process.env.PORT||3000),PASSWORD=process.env.CROW_PASSWORD||'2348',USER=process.env.CROW_USER||'crow',DB=process.env.DATA_FILE||path.join(__dirname,'observations.json');
const VENUES=[['Crow Brewhouse',180],['Elephant’s Nest',210],['Sons of Kent',320],['Downtown venue 4 (unverified)',116],['Downtown venue 5 (unverified)',130],['Downtown venue 6 (unverified)',320]].map(([name,capacity],id)=>({id,name,capacity}));
let archive=[];try{let v=JSON.parse(fs.readFileSync(DB,'utf8'));if(Array.isArray(v))archive=v.filter(x=>Number.isInteger(x.venueId)&&Number.isInteger(x.count)&&Number.isFinite(x.timestamp))}catch{}
const sessions=new Map(),listeners=new Set(),DAY=86400000,ROOT=__dirname;
function state(){const now=Date.now(),reports={};for(const x of archive){if(now-x.timestamp>=0&&now-x.timestamp<DAY)reports[x.venueId]=x}return {type:'state',venues:VENUES,reports,archive:archive.slice(-2000)}}
function send(res,status,obj){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj))}
function broadcast(){let msg='event: state\ndata: '+JSON.stringify(state())+'\n\n';for(let res of listeners){try{res.write(msg)}catch{listeners.delete(res)}}}
function body(req){return new Promise((resolve,reject)=>{let a='',size=0;req.on('data',c=>{size+=c.length;if(size>8192){reject(Error('Too large'));req.destroy();return}a+=c});req.on('end',()=>{try{resolve(JSON.parse(a||'{}'))}catch{reject(Error('Invalid JSON'))}});req.on('error',reject)})}
function auth(req){let token=(req.headers.authorization||'').replace(/^Bearer /,'');let exp=sessions.get(token);if(!exp||exp<Date.now())return false;return true}
function safeEq(a,b){let x=crypto.createHash('sha256').update(String(a)).digest(),y=crypto.createHash('sha256').update(String(b)).digest();return crypto.timingSafeEqual(x,y)}
const failures=new Map();
const server=http.createServer(async(req,res)=>{try{
let url=new URL(req.url,'http://localhost');if(req.method==='GET'&&url.pathname==='/api/state')return send(res,200,state());
if(req.method==='GET'&&url.pathname==='/api/stream'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write('retry: 3000\n\n');listeners.add(res);res.write('event: state\ndata: '+JSON.stringify(state())+'\n\n');req.on('close',()=>listeners.delete(res));return}
if(req.method==='POST'&&url.pathname==='/api/login'){let ip=req.socket.remoteAddress||'unknown',f=failures.get(ip)||{n:0,until:0};if(f.until>Date.now())return send(res,429,{error:'Try again later'});let x=await body(req);if(x.username!==USER||!safeEq(x.password,PASSWORD)){f.n++;if(f.n>=5){f.until=Date.now()+300000;f.n=0}failures.set(ip,f);return send(res,401,{error:'Invalid login'})}failures.delete(ip);let token=crypto.randomBytes(32).toString('hex');sessions.set(token,Date.now()+8*3600000);return send(res,200,{token})}
if(req.method==='POST'&&url.pathname==='/api/report'){if(!auth(req))return send(res,401,{error:'Operator login required'});let x=await body(req);if(!Number.isInteger(x.venueId)||x.venueId<0||x.venueId>=VENUES.length||!Number.isInteger(x.count)||x.count<0||x.count>300||!['manual','door','estimate'].includes(x.source))return send(res,400,{error:'Invalid venue, count or source'});let record={id:crypto.randomUUID(),venueId:x.venueId,count:x.count,source:x.source,timestamp:Date.now()};archive.push(record);fs.writeFileSync(DB,JSON.stringify(archive,null,2));broadcast();return send(res,200,record)}
if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html'||url.pathname==='/app.js')){let f=url.pathname==='/app.js'?'app.js':'index.html';res.writeHead(200,{'Content-Type':f.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});return fs.createReadStream(path.join(ROOT,f)).pipe(res)}
return send(res,404,{error:'Not found'})
}catch(e){if(!res.headersSent)send(res,500,{error:'Server error'});console.error(e.message)}});
setInterval(()=>{for(let res of listeners){try{res.write(': heartbeat\n\n')}catch{listeners.delete(res)}}for(let [t,exp]of sessions)if(exp<Date.now())sessions.delete(t)},20000).unref();
setInterval(broadcast,60000).unref();
server.listen(PORT,()=>console.log('City Signal running at http://localhost:'+PORT));

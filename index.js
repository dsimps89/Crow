'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const admin=require('firebase-admin');
admin.initializeApp();
const db=admin.firestore();
const TZ='America/Toronto',DAY=86400000;
function localParts(ms){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,weekday:'short',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(p=>[p.type,p.value]));}
function toUTC(y,m,d,h){const target=Date.UTC(y,m-1,d,h);let guess=target+4*3600000;for(let i=0;i<4;i++){const p=localParts(guess);guess+=target-Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);}return guess;}
function cycle(ms){const p=localParts(ms),wd={Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6}[p.weekday];const d=new Date(Date.UTC(+p.year,+p.month-1,+p.day));d.setUTCDate(d.getUTCDate()-((wd-5+7)%7));let start=toUTC(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),20);if(start>ms){d.setUTCDate(d.getUTCDate()-7);start=toUTC(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),20);}return {id:d.toISOString().slice(0,10).replaceAll('-',''),start};}
exports.getVoteStatus=onCall({region:'us-central1',enforceAppCheck:false},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Sign in first');
 const snap=await db.collection('voters').doc(request.auth.uid).get();const v=snap.data()||{};
 return {lockedUntil:Math.max(0,(v.lastVoteAt||0)+DAY),lastStage:Number.isInteger(v.lastStage)?v.lastStage:null};
});
exports.castVote=onCall({region:'us-central1',enforceAppCheck:false,maxInstances:20},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','Sign in first');
 const {stage,inputs}=request.data||{};
 if(!Number.isInteger(stage)||stage<0||stage>6)throw new HttpsError('invalid-argument','Choose a valid stage');
 if(!inputs||typeof inputs!=='object'||Array.isArray(inputs)||JSON.stringify(inputs).length>5000)throw new HttpsError('invalid-argument','Invalid input snapshot');
 const safe={};for(const [k,v] of Object.entries(inputs)){if(!/^[a-zA-Z]{1,30}$/.test(k)||typeof v!=='string'||v.length>120)continue;safe[k]=v;}
 const uid=request.auth.uid,now=Date.now(),c=cycle(now),voter=db.collection('voters').doc(uid),aggregate=db.collection('cycles').doc(c.id);
 const vote=db.collection('votes').doc();
 const expires=admin.firestore.Timestamp.fromMillis(now+DAY);
 const result=await db.runTransaction(async tx=>{
  const [prev,totals]=await Promise.all([tx.get(voter),tx.get(aggregate)]);
  const last=prev.exists?(prev.data().lastVoteAt||0):0;
  if(last+DAY>now)throw new HttpsError('resource-exhausted','You already voted. Try again after 24 hours.');
  const old=totals.exists?totals.data():{};
  const counts=Array.isArray(old.counts)&&old.counts.length===7?old.counts.slice():Array(7).fill(0);
  counts[stage]=(Number(counts[stage])||0)+1;
  tx.set(voter,{lastVoteAt:now,lastStage:stage,updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  tx.set(aggregate,{counts,total:counts.reduce((a,b)=>a+b,0),updatedAt:admin.firestore.FieldValue.serverTimestamp()},{merge:true});
  tx.set(vote,{uid,stage,cycle:c.id,createdAt:admin.firestore.FieldValue.serverTimestamp(),expiresAt:expires,inputs:safe});
  return {lockedUntil:now+DAY,cycle:c.id};
 });
 return result;
});

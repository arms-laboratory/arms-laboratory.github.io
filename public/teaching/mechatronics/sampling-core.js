(function(root){
'use strict';
const mod=(n,m)=>((n%m)+m)%m;
function design(c){const capacity=2**c.bits,p=c.cycles*c.decode,rate=c.rpm*p/60,q=rate*c.ts;return {capacity,half:capacity/2,p,rate,q,limit:rate?capacity/(2*Math.abs(rate)):Infinity};}
function sample(c,k){const d=design(c),count=j=>c.initial+Math.floor(d.q*j+.25+1e-9);let software=c.initial;for(let j=1;j<=k;j++){const raw=mod(count(j)-count(j-1),d.capacity);software+=mod(raw+d.half,d.capacity)-d.half;}const actual=count(k),prev=count(Math.max(0,k-1)),raw=mod(actual,d.capacity),previous=mod(prev,d.capacity),difference=raw-previous,delta=k?mod(difference+d.half,d.capacity)-d.half:0;return {k,t:k*c.ts,actual,raw,previous,difference,delta,software,movement:k?actual-prev:0,tie:k>0&&Math.abs(delta)===d.half,correct:software===actual,stepCorrect:k===0||delta===actual-prev};}
const api={mod,design,sample};if(typeof module!=='undefined')module.exports=api;root.SamplingCore=api;
})(typeof window!=='undefined'?window:globalThis);

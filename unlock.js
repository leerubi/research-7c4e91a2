'use strict';
const statusText=document.getElementById('status');
const frame=document.getElementById('portfolio');
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
const params=()=>new URLSearchParams(location.hash.slice(1));
let entries,urls={},accessKey;
function showPage(requested='index.html',push=false){
  const target=new URL(requested,'https://portfolio.invalid/');
  let path=target.pathname.slice(1)||'index.html';
  if(!entries[path]||!path.endsWith('.html'))path='index.html';
  const html=new TextDecoder().decode(bytes(entries[path].data));
  const doc=new DOMParser().parseFromString(html,'text/html');
  doc.querySelectorAll('link[rel="canonical"],meta[property^="og:"],meta[name="twitter:card"]').forEach(el=>el.remove());
  for(const el of doc.querySelectorAll('[href],[src],[data]'))for(const attr of ['href','src','data']){
    const value=el.getAttribute(attr);if(!value)continue;
    if(attr==='href'&&value.startsWith('#')){el.setAttribute('data-private-path',path+value);el.setAttribute('href','#');continue;}
    if(/^(https?:|mailto:|data:|blob:)/.test(value))continue;
    const resolved=new URL(value,'https://portfolio.invalid/'+path),name=resolved.pathname.slice(1);
    if(!entries[name])continue;
    if(attr==='href'&&name.endsWith('.html')){el.setAttribute('data-private-path',name+resolved.hash);el.setAttribute('href','#');}
    else el.setAttribute(attr,urls[name]);
  }
  const meta=doc.createElement('meta');meta.name='referrer';meta.content='no-referrer';doc.head.append(meta);
  const robots=doc.createElement('meta');robots.name='robots';robots.content='noindex,nofollow,noarchive';doc.head.append(robots);
  const navigation=doc.createElement('script');
  navigation.textContent="document.addEventListener('click',function(e){var a=e.target.closest('a[data-private-path]');if(a){e.preventDefault();parent.postMessage({type:'portfolio:navigate',path:a.dataset.privatePath},'*');}});window.addEventListener('load',function(){var id="+JSON.stringify(target.hash.slice(1))+";if(id)document.getElementById(id)?.scrollIntoView();});";
  doc.body.append(navigation);
  frame.srcdoc='<!doctype html>'+doc.documentElement.outerHTML;
  frame.hidden=false;document.body.classList.add('open');
  if(push){const p=new URLSearchParams({k:accessKey,p:path+target.hash});history.pushState(null,'','#'+p.toString());}
}
window.addEventListener('message',event=>{if(event.source===frame.contentWindow&&event.origin===location.origin&&event.data?.type==='portfolio:navigate'&&typeof event.data.path==='string')showPage(event.data.path,true);});
window.addEventListener('popstate',()=>{if(entries)showPage(params().get('p')||'index.html');});
(async()=>{
  accessKey=params().get('k');if(!accessKey||!/^[\w-]{43}$/.test(accessKey))return;
  statusText.textContent='Opening portfolio…';
  try{
    const response=await fetch('portfolio.bin',{cache:'no-store'});if(!response.ok)throw Error('load');
    const encrypted=new Uint8Array(await response.arrayBuffer());
    if(new TextDecoder().decode(encrypted.slice(0,4))!=='DP01')throw Error('format');
    const key=await crypto.subtle.importKey('raw',bytes(accessKey),{name:'AES-GCM'},false,['decrypt']);
    const compressed=await crypto.subtle.decrypt({name:'AES-GCM',iv:encrypted.slice(4,16),additionalData:new TextEncoder().encode('DajinPortfolio-v1'),tagLength:128},key,encrypted.slice(16));
    const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    entries=JSON.parse(await new Response(stream).text());
    for(const [name,item] of Object.entries(entries))urls[name]=URL.createObjectURL(new Blob([bytes(item.data)],{type:item.type}));
    showPage(params().get('p')||'index.html');
  }catch{statusText.textContent='This access link could not be opened. Please request a complete private link.';}
})();

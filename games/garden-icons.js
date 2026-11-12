/* 花園操作圖示：只替換按鈕中的操作 emoji；種子、裝飾和使用者答案保留原樣。 */
(function(){
  'use strict';
  var icons={
    '🔊':'<path d="M4 9h4l5-4v14l-5-4H4V9Zm12-1a5 5 0 0 1 0 8m2-11a9 9 0 0 1 0 14"/>',
    '🔇':'<path d="M4 9h4l5-4v14l-5-4H4V9Zm12 1 4 4m0-4-4 4"/>',
    '💧':'<path class="fill-blue" d="M12 3s-6 6.6-6 10.5a6 6 0 0 0 12 0C18 9.6 12 3 12 3Z"/><path d="M9 14a3 3 0 0 0 2 2.8"/>',
    '🌱':'<path d="M12 20v-8"/><path class="fill-green" d="M12 16c-4.3 0-6.5-2.1-6.5-5.5C9.5 10.5 12 12 12 16Zm0-4c0-4 2.5-6.5 6.5-6.5 0 4-2.5 6.5-6.5 6.5Z"/><path d="M6 20h12"/>',
    '🌳':'<path class="fill-green" d="M7 14a4 4 0 0 1-1-7 4 4 0 0 1 7-2 4 4 0 0 1 5 3 3.5 3.5 0 0 1-1 6Z"/><path d="M12 12v8m-3 0h6m-3-5-2-2"/>',
    '🌸':'<path class="fill-pink" d="M12 7c-2-4-5-2-4 1-4-1-5 2-2 4-3 2-2 5 2 4-1 3 2 5 4 1 2 4 5 2 4-1 4 1 5-2 2-4 3-2 2-5-2-4 1-3-2-5-4-1Z"/><circle class="fill-yellow" cx="12" cy="12" r="2"/>',
    '🪴':'<path d="M8 15h8l-1 5H9l-1-5Zm4 0V8"/><path class="fill-green" d="M12 12C8 12 7 10 7 7c3 0 5 2 5 5Zm0-2c0-4 2-6 5-6 0 3-1 6-5 6Z"/>',
    '🎮':'<path class="fill-green" d="M7 7h10c2 0 3 2 3.5 4l.5 5c.2 2-2 3-3.5 1l-1.5-2h-8l-1.5 2C5 19 2.8 18 3 16l.5-5C4 9 5 7 7 7Z"/><path d="M7 9v4m-2-2h4m7-1h.1m2 2h.1"/>',
    '🏅':'<path class="fill-green" d="m7 3 3 6m7-6-3 6"/><circle class="fill-yellow" cx="12" cy="14" r="5"/><path d="m10.5 14 1 1 2-2"/>',
    '🖼':'<rect x="3" y="4" width="18" height="16" rx="2"/><circle class="fill-yellow" cx="8" cy="9" r="1.5"/><path class="fill-green" d="m5 18 5-5 3 3 2-2 4 4Z"/>',
    '📸':'<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle class="fill-green" cx="12" cy="13" r="3"/>',
    '📮':'<path class="fill-pink" d="M6 20V8a4 4 0 0 1 8 0v12M4 20h14M14 8h4v5h-4M8 8h4"/>',
    '📬':'<path class="fill-pink" d="M6 20V8a4 4 0 0 1 8 0v12M4 20h14M14 8h4v5h-4M8 8h4"/>',
    '💌':'<rect class="fill-pink" x="3" y="6" width="18" height="13" rx="2"/><path d="m4 8 8 6 8-6"/>',
    '✉️':'<rect class="fill-pink" x="3" y="6" width="18" height="13" rx="2"/><path d="m4 8 8 6 8-6"/>',
    '✍️':'<path d="m5 19 1-4L16 5l3 3L9 18l-4 1Zm9-12 3 3M5 21h14"/>',
    '✏️':'<path d="m5 19 1-4L16 5l3 3L9 18l-4 1Zm9-12 3 3M5 21h14"/>',
    '📖':'<path class="fill-yellow" d="M12 7c-2-2-5-2-8-1v12c3-1 6-1 8 1 2-2 5-2 8-1V6c-3-1-6-1-8 1Zm0 0v12"/>',
    '✨':'<path class="fill-yellow" d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Zm6 12 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z"/>',
    '🎉':'<path class="fill-yellow" d="m5 19 3-10 7 7-10 3Z"/><path d="m8 9 7 7M14 4l1 2m4 1-2 1m2 4h2M10 4l1 2"/>',
    '🔥':'<path class="fill-yellow" d="M12 3c1 4-4 5-4 9-1-1-1-2-1-3-4 5-1 11 5 11s8-5 5-9c0 2-1 2-1 2 0-4-2-7-4-10Z"/>',
    '💗':'<path class="fill-pink" d="M12 20S4 15 4 9a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 6-8 11-8 11Z"/>',
    '💾':'<path d="M4 4h13l3 3v13H4V4Zm3 0v6h9V4M7 20v-7h10v7"/>',
    '🔄':'<path d="M19 9a7 7 0 0 0-12-3L5 8m0-4v4h4M5 15a7 7 0 0 0 12 3l2-2m0 4v-4h-4"/>',
    '↔️':'<path d="M4 12h16M8 8l-4 4 4 4m8-8 4 4-4 4"/>',
    '🏡':'<path class="fill-yellow" d="M4 10 12 4l8 6v9H4v-9Z"/><path d="M9 19v-6h6v6"/>',
    '💬':'<path class="fill-green" d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 10h8m-8 3h5"/>',
    '⚖️':'<path d="M12 4v16M6 20h12M5 8h14M7 8l-3 6h6L7 8Zm10 0-3 6h6l-3-6Z"/>',
    '🏍️':'<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="m6 17 4-6 3 6H6m7 0 3-7h3m-9 1h4M8 8h3"/>',
    '🐛':'<circle class="fill-green" cx="6" cy="14" r="3"/><circle class="fill-green" cx="11" cy="14" r="3"/><circle class="fill-green" cx="16" cy="14" r="3"/><path d="m16 11-1-3m2 3 2-3m-3 6h.1"/>',
    '🐌':'<path class="fill-yellow" d="M12 18H5c-2 0-2-3 0-3h3a5 5 0 1 1 8 3h3c1 0 1-2 1-3v-4m-1 0V9m2 2V9"/><path d="M12 16a2 2 0 1 0-2-2"/>',
    '🪲':'<path class="fill-green" d="M8 10a4 4 0 0 1 8 0v4a4 4 0 0 1-8 0v-4Zm4 0v8M9 7 7 5m8 2 2-2M8 11H5m11 0h3M8 15H5m11 0h3"/>'
  };
  var keys=Object.keys(icons).sort(function(a,b){return b.length-a.length;}),re=new RegExp(keys.map(function(k){return k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('|'),'g');
  function icon(key){var s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('class','garden-action-icon');s.setAttribute('aria-hidden','true');s.innerHTML=icons[key];return s;}
  function scan(root){
    var buttons=[];if(root.nodeType===1&&root.matches('button'))buttons.push(root);if(root.querySelectorAll)buttons=buttons.concat(Array.from(root.querySelectorAll('button')));
    buttons.forEach(function(b){if(b.closest('.seeds,.plot,.ftree,.q-opts,.who-pick,.alb')||b.hasAttribute('data-a')||b.hasAttribute('data-k'))return;
      var walk=document.createTreeWalker(b,NodeFilter.SHOW_TEXT),nodes=[],n;while(n=walk.nextNode())if(!n.parentElement.closest('svg')&&re.test(n.nodeValue)){nodes.push(n);re.lastIndex=0;}else re.lastIndex=0;
      nodes.forEach(function(node){var str=node.nodeValue,frag=document.createDocumentFragment(),last=0,m;re.lastIndex=0;while((m=re.exec(str))){frag.appendChild(document.createTextNode(str.slice(last,m.index)));frag.appendChild(icon(m[0]));last=m.index+m[0].length;}frag.appendChild(document.createTextNode(str.slice(last)));node.replaceWith(frag);});
    });
  }
  scan(document.body);
  var observer=new MutationObserver(function(changes){changes.forEach(function(c){if(c.type==='characterData'){if(c.target.parentElement){var b=c.target.parentElement.closest('button');if(b)scan(b);}}else c.addedNodes.forEach(function(n){if(n.nodeType===1){var b=n.closest('button');scan(b||n);}else if(n.nodeType===3&&n.parentElement){var b=n.parentElement.closest('button');if(b)scan(b);}});});});
  observer.observe(document.body,{childList:true,subtree:true,characterData:true});
})();

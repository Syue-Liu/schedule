/* 小遊戲共用：這支手機是誰、每天的獎勵次數、把獎勵和分數交給班表、排行榜、開始卡片、倒數、結算畫面。
   不直接寫雲端：先排進這支手機的 gameRewards，回到班表時由班表加進寵物紀錄（飼料、每人每款前 5 高分），
   再照平常一樣同步，兩支手機的排行榜就會一樣。 */
var G=(function(){
  var SCENES={
    whack:{label:'菜園小幫手',kind:'反應挑戰',time:'30 秒',goal:'25 分獲得三星',color:'#E8EED7'},
    fish:{label:'雪湖慢時光',kind:'時機與手感',time:'5 次拋竿',goal:'10 分獲得三星',color:'#E2EAF4',cover:'cover-winter.svg'},
    camp:{label:'星空營火夜',kind:'火候控制',time:'40 秒',goal:'14 分獲得三星',color:'#F4DFCC'},
    spring:{label:'雪國探險家',kind:'溫度推理',time:'12 把鏟子',goal:'13 分獲得三星',color:'#E2EAF4'},
    moto:{label:'三寵兜風日',kind:'跳躍冒險',time:'40 秒',goal:'70 分獲得三星',color:'#F5E9C9'}
  };
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  var CAP=3,NAMES={syue:'學',ling:'綾'};
  var PET={cat:{name:'Pillow',art:'snowball'},pg:{name:'雪球',art:'dudu'},dg:{name:'薩摩耶',art:'samoyed'}};
  function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){return null;}}
  function json(k,d){try{var v=JSON.parse(ls(k)||'null');return v==null?d:v;}catch(e){return d;}}
  function pad(n){return (n<10?'0':'')+n;}
  function today(){var t=new Date();return t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate());}
  function who(){var m=ls('catMe');return m==='syue'||m==='ling'?m:'';}
  function queue(){var q=json('gameRewards',[]);return Array.isArray(q)?q:[];}
  // 今天這款拿過幾次飼料：班表已經收下的（寵物紀錄裡的 d.gm）＋還在排隊的
  function played(game){
    var me=who(),day=today(),n=0,r=(json('catV1',{})||{})[me];
    if(r&&r.d&&r.d.day===day&&r.d.gm)n+=+r.d.gm[game]||0;
    queue().forEach(function(q){if(q.who===me&&q.game===game&&q.day===day&&q.kib>0)n++;});
    return n;
  }
  function left(game){return who()?Math.max(0,CAP-played(game)):0;}
  // 玩完一局：有得分就記（排行榜用），飼料看今天還有沒有次數；回傳拿到幾包。0 分不記也不給飼料
  function record(game,score,kib){
    if(!who()||!(score>0))return 0;
    var got=kib>0&&left(game)?kib:0,q=queue();
    q.push({who:who(),game:game,day:today(),kib:got,score:score,at:Date.now()});ls('gameRewards',JSON.stringify(q));
    return got;
  }
  // 排行榜：兩個人各自的前 5 高分（班表同步過來的）＋這支手機還沒交給班表的
  function board(game){
    var d=json('catV1',{})||{},list=[];
    ['syue','ling'].forEach(function(u){var r=d[u],g=r&&r.gs&&r.gs[game];if(Array.isArray(g))g.forEach(function(x){list.push({who:u,s:+x.s||0,d:x.d||''});});});
    queue().forEach(function(q){if(q.game===game&&q.score!=null)list.push({who:q.who,s:+q.score||0,d:q.day,mine:true});});
    return list.sort(function(a,b){return b.s-a.s||(a.d<b.d?-1:1);}).slice(0,10);
  }
  function best(game,u){var b=board(game).filter(function(x){return x.who===u;})[0];return b?b.s:null;}
  // 寵物名字：兩個人誰最後取的就用誰的（跟班表一樣）
  function petName(k){
    var d=json('catV1',{})||{},best=null;
    ['syue','ling'].forEach(function(u){var r=d[u];if(!r)return;var s=k==='cat'?r:r[k];if(s&&s.name&&(!best||s.nameAt>best.nameAt))best=s;});
    return best?best.name:PET[k].name;
  }
  function petImg(k,pose){return '../assets/pets/'+PET[k].art+'-'+pose+'.svg';}
  function el(html){var d=document.createElement('div');d.innerHTML=html.trim();return d.firstChild;}
  function float(x,y,text,cls){var f=el('<div class="g-float '+(cls||'')+'"></div>');f.textContent=text;f.style.left=x+'px';f.style.top=y+'px';document.body.appendChild(f);if(cls!=='bad'&&document.querySelectorAll('.g-hit-spark').length<4){var sp=el('<div class="g-hit-spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>');sp.style.left=x+'px';sp.style.top=y+'px';document.body.appendChild(sp);setTimeout(function(){sp.remove();},650);}setTimeout(function(){f.remove();},950);}
  function pets(){return '<div class="g-pets"><img src="'+petImg('cat','happy')+'" alt=""><img class="pg" src="'+petImg('pg','happy')+'" alt=""><img src="'+petImg('dg','happy')+'" alt=""></div>';}
  function leftTxt(game){
    if(!who())return '在班表選好你是誰，才能領飼料獎勵';
    var n=left(game);return n?'今天還有 '+n+' 次飼料獎勵（每天 '+CAP+' 次）':'今天這款的飼料獎勵領完了，還是可以玩';
  }
  function intro(o){
    var meta=SCENES[o.game],rules=o.desc.split(/<br\s*\/?\s*>/i);
    var ov=el('<div class="g-ov"><section class="g-card g-intro" role="dialog" aria-modal="true" aria-labelledby="introTitle" style="--scene:'+meta.color+'"><div class="g-cover"><img src="../assets/games/'+o.game+'/'+(meta.cover||'cover.svg')+'" alt=""><button class="g-cover-back" data-lobby>‹ 大廳</button><span class="g-cover-stamp">'+meta.label+'</span></div><div class="g-card-body"><div class="g-eyebrow">'+meta.kind+' · '+meta.time+'</div><h2 id="introTitle">'+o.title+'</h2><ol class="g-rules">'+rules.map(function(t){return '<li>'+t+'</li>';}).join('')+'</ol><div class="g-goal"><img src="../assets/games/ui/star.svg" alt="">'+meta.goal+'</div><p class="g-small">'+leftTxt(o.game)+'</p><div class="g-btns"><button class="g-btn" data-go>一起出發 <span aria-hidden="true">→</span></button></div></div></section></div>');
    document.body.appendChild(ov);
    ov.querySelector('[data-lobby]').onclick=function(){location.href='./';};
    ov.querySelector('[data-go]').onclick=function(){ov.remove();countdown(o.start);};
  }
  function countdown(cb){
    var c=el('<div class="g-count" aria-live="assertive"></div>'),seq=['3','2','1','開始！'],i=0;document.body.appendChild(c);
    (function tick(){if(i>=seq.length){c.remove();cb();return;}c.innerHTML='<span>'+seq[i]+'</span>';i++;setTimeout(tick,i===seq.length?600:750);})();
  }
  // 結算：分數→星星→飼料（1～3 包），每天每款前 3 次有獎勵
  function finish(o){
    var stars=o.score>0?o.stars:0,me=who(),prev=me?best(o.game,me):null,got=record(o.game,o.score,stars);
    var brd=board(o.game),rank=-1;
    for(var i=0;i<brd.length;i++)if(brd[i].mine&&brd[i].s===o.score&&brd[i].who===me){rank=i+1;break;}
    var rec=me&&o.score>0&&(prev==null||o.score>prev);
    var head=stars>=3?'太厲害了！':stars===2?'好棒！':'完成了！';
    var rw=got?'<div class="g-reward"><img src="../assets/games/ui/kib.svg" alt="">獲得飼料 ×'+got+'<span class="g-small" style="margin:0 0 0 4px">回班表就會收到</span></div>'
      :'<div class="g-reward none">'+(!who()?'在班表選好你是誰，才能領飼料':o.score>0?'今天這款的飼料獎勵領完了':'這局沒有得分，沒有飼料')+'</div>';
    var st='';for(var i=0;i<3;i++)st+='<img class="g-star'+(i<stars?' on':'')+'" src="../assets/games/ui/star.svg" alt="">';
    var rk=me&&o.score>0?'<div class="g-rank">'+(rec?'<b>🏆 '+NAMES[me]+'的新紀錄！</b>':'')+(rank>0?'<span>排行榜第 '+rank+' 名</span>':'<span>這局沒進前 10 名</span>')+'</div>':'';
    var ov=el('<div class="g-ov"><section class="g-card g-result" role="dialog" aria-modal="true" aria-label="遊戲結算"><div class="g-result-ribbon">'+SCENES[o.game].label+' · 冒險完成</div>'+pets()+'<h2>'+head+'</h2><div class="g-stars">'+st+'</div><div class="g-score">'+o.score+'<span style="font-size:16px"> '+o.unit+'</span></div>'+rk+(o.note?'<p>'+o.note+'</p>':'')+rw+
      '<p class="g-small">'+leftTxt(o.game)+'</p><div class="g-btns g-result-actions"><button class="g-btn" data-again>再玩一次 ↻</button><button class="g-btn ghost" data-lobby>冒險大廳</button><button class="g-btn ghost" data-home>回班表</button></div></section></div>');
    document.body.appendChild(ov);
    ov.querySelector('[data-again]').onclick=function(){ov.remove();o.again();};
    ov.querySelector('[data-lobby]').onclick=function(){location.href='./';};
    ov.querySelector('[data-home]').onclick=function(){location.href='../';};
  }
  // 圖片先載好再開始，避免玩到一半才跑出來
  function preload(list,cb){var n=list.length;if(!n)return cb();list.forEach(function(src){var im=new Image();im.onload=im.onerror=function(){if(--n===0)cb();};im.src=src;});}
  // 排行榜卡片（大廳用）：前 10 名，第一名戴皇冠
  function boardHtml(game,unit){
    var b=board(game);
    if(!b.length)return '<div class="g-empty">還沒有人玩過，搶下第一名吧！</div>';
    return '<ol class="g-board">'+b.map(function(x,i){return '<li class="'+x.who+'"><span class="g-rk">'+(i<3?['🥇','🥈','🥉'][i]:i+1)+'</span><span class="g-who">'+NAMES[x.who]+'</span><span class="g-d">'+(x.d||'').slice(5).replace('-','/')+'</span><b>'+x.s+' '+unit+'</b></li>';}).join('')+'</ol>';
  }
  return {SCENES:SCENES,escapeHtml:escapeHtml,CAP:CAP,NAMES:NAMES,today:today,who:who,left:left,record:record,board:board,best:best,boardHtml:boardHtml,petName:petName,petImg:petImg,el:el,float:float,intro:intro,countdown:countdown,finish:finish,preload:preload,leftTxt:leftTxt,setWho:function(u){ls('catMe',u);}};
})();


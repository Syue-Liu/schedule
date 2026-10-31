/* 連線對戰：兩支手機用班表同一個 Firebase、同一個同步代碼。
   房間 banbiao/<代碼>_vs：{遊戲:{syue:{on,pet,at,sid}, ling:{…}, go:{id,seed,at,p}, win:{syue,ling,last}}}
     on＝在這款遊戲的對戰房間等（每 8 秒報到一次），go＝開局（關卡種子＋開始時間），win＝戰績。
   比賽中每個人一份 banbiao/<代碼>_vs_<誰>，每 0.3 秒寫一次自己的狀態（m＝主要成績、sb＝次要成績、d＝結束了），對方即時收到。
   時間都用「伺服器時間」：連上時寫一個伺服器時間再讀回來，算出這支手機的時鐘差多少。
   每款遊戲只要 VS.setup({...}) 接上：開始卡片的按鈕、房間、倒數、上面那排對手狀態、等對方、結果和戰績都在這裡。 */
var VS=(function(){
  var CFG={apiKey:'AIzaSyCOrBO2bs1VmSCUd14bqNJJ2GBeieR2ELo',authDomain:'syue-work-schedule.firebaseapp.com',projectId:'syue-work-schedule',storageBucket:'syue-work-schedule.firebasestorage.app',messagingSenderId:'785105764126',appId:'1:785105764126:web:6ca5aa11e53a85f4bf930f'};
  var SDK='https://www.gstatic.com/firebasejs/10.12.0/',FRESH=25000,SEND=300;
  var NAMES={climb:'爬樓梯',whack:'打地鼠',fish:'釣魚',tower:'蓋房子'},ORDER=['climb','whack','fish','tower'];
  var fs=null,db=null,off=0,ready=null,sid=Math.random().toString(36).slice(2,8);
  function ls(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function noop(){}
  function warn(e){console.warn('vs',e);}
  function code(){var c=ls('syncCode')||'';return c&&c!=='LOCAL'?c:'';}
  function me(){return G.who();}
  function other(){var m=me();return m==='syue'?'ling':m==='ling'?'syue':'';}
  function can(){return !!(code()&&me());}
  function ms(v){return v&&v.toMillis?v.toMillis():+v||0;}
  function now(){return Date.now()+off;}
  // 關卡用的亂數：兩支手機用同一個種子，出來的東西一模一樣
  function seeded(a){return function(){a|=0;a=a+0x6D2B79F5|0;var k=Math.imul(a^a>>>15,1|a);k=k+Math.imul(k^k>>>7,61|k)^k;return((k^k>>>14)>>>0)/4294967296;};}
  // 對時：寫兩次伺服器時間，取來回最快的那次（第一次常常卡在建立連線）
  function ping(){
    var ref=fs.doc(db,'banbiao',code()+'_vs_'+me()),t0=Date.now(),t1;
    return fs.setDoc(ref,{clk:fs.serverTimestamp()},{merge:true}).then(function(){t1=Date.now();return fs.getDoc(ref);}).then(function(s){var c=ms((s.data()||{}).clk);return c?{rtt:t1-t0,off:c-(t0+t1)/2}:null;});
  }
  function connect(){
    if(ready)return ready;
    if(!can())return Promise.reject(new Error('no code'));
    ready=Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-firestore.js')]).then(function(m){
      fs=m[1];db=fs.getFirestore(m[0].initializeApp(CFG));
      return ping().then(function(a){return ping().then(function(b){var x=[a,b].filter(Boolean).sort(function(p,q){return p.rtt-q.rtt;})[0];if(x)off=x.off;});});
    });
    ready.catch(function(){ready=null;});
    return ready;
  }
  function roomRef(){return fs.doc(db,'banbiao',code()+'_vs');}
  function liveRef(u){return fs.doc(db,'banbiao',code()+'_vs_'+u);}
  // 房間有變就通知：watch 拿這款遊戲那一格，watchAll 拿全部（大廳的邀請用）
  function watchAll(cb){return fs.onSnapshot(roomRef(),function(s){cb(s.exists()?s.data():{});},function(e){console.warn('vs room',e);});}
  function watch(game,cb){return watchAll(function(d){cb(d[game]||{});});}
  function put(game,data){var o={};o[game]=data;return fs.setDoc(roomRef(),o,{merge:true});}
  // 我在不在房間：on＝等開局；另一支手機也用同一個身份時 sid 會不一樣
  function hello(game,on,pet){var o={};o[me()]={on:!!on,pet:pet||'',at:now(),sid:sid};return put(game,o);}
  function present(slot){return !!(slot&&slot.on&&Math.abs(now()-ms(slot.at))<FRESH);}
  function clash(r){var s=r[me()];return present(s)&&s.sid!==sid;}
  function send(data){return fs.setDoc(liveRef(me()),data);}
  function listen(u,cb){return fs.onSnapshot(liveRef(u),function(s){cb(s.exists()?s.data():null);},function(e){console.warn('vs live',e);});}

  /* ── 對戰流程（每款遊戲共用） ──
     cfg：game、time（限時幾秒）、rules（房間裡的規則）、pet()（房間裡顯示哪隻）、extra()/mountExtra(box)（房間多放的東西）、
          begin(M)（開局前準備好場地）、start(M)（倒數完開始）、live(d,M)（收到對方的狀態）、opDone(M)（對方結束了）、
          bar(M)（上面那排對方的狀態）、settle(M)（算結果前最後對齊成績）、clock（false＝遊戲自己有倒數，上面那排不用再放）、fmt(m,sb)（成績怎麼寫）、solo()（結果卡片按「自己玩」） */
  var cfg=null,room={},roomOff=null,inRoom=false,hb=0,goSeen='',going=0,M=null,bar=null,barTxt='';
  function opName(){return G.NAMES[other()]||'對方';}
  function petOf(){return cfg.pet?cfg.pet():(cfg.icon||'pg');}
  // 比輸贏：先比主要成績，一樣再比次要的；1＝前面那個贏、-1＝後面那個贏、0＝平手
  function cmp(a,b,c,d){return a!==c?(a>c?1:-1):b!==d?(b>d?1:-1):0;}
  function setup(o){
    cfg=o;
    if(can())watchRoom().catch(warn);
    addEventListener('pagehide',function(){if(inRoom)hello(cfg.game,false,petOf()).catch(noop);});
  }
  // 從邀請點進來（網址有 ?vs=1）：開始卡片出來之後直接進房間
  function auto(){if(/[?&]vs=1/.test(location.search))openRoom();}
  function watchRoom(){
    if(roomOff)return Promise.resolve();
    return connect().then(function(){if(!roomOff)roomOff=watch(cfg.game,onRoom);});
  }
  function onRoom(r){
    room=r||{};paintEntry();
    if(inRoom){paintRoom();maybeGo();}
    var tl=document.getElementById('vsTally');if(tl)tl.textContent=tally();
  }
  // 開始卡片、結算卡片多一顆「連線對戰」；對方在房間等的時候，卡片最上面多一條邀請（按鈕在下面要捲才看得到）
  function mount(ov){
    var row=ov.querySelector('.g-btns');if(!row||!cfg)return;
    var b=document.createElement('button');b.type='button';b.className='g-btn ghost';b.setAttribute('data-vs','');row.appendChild(b);
    b.onclick=function(){SND.sfx('tap');openRoom();};
    var body=ov.querySelector('.g-card-body'),inv=document.createElement('button');inv.type='button';inv.className='vs-inv';inv.setAttribute('data-vsinv','');inv.hidden=true;
    if(body)body.insertBefore(inv,body.firstChild);else{var rb=ov.querySelector('.g-result-ribbon');if(rb)rb.after(inv);}
    inv.onclick=b.onclick;
    paintEntry();
  }
  function paintEntry(){
    var wait=can()&&present(room[other()]);
    document.querySelectorAll('[data-vs]').forEach(function(b){b.textContent=wait?'💌 '+opName()+' 在等你！加入對戰':'📱 和'+(can()?opName():'另一半')+'連線對戰';b.classList.toggle('hot',wait);});
    document.querySelectorAll('[data-vsinv]').forEach(function(b){b.hidden=!wait;b.textContent='💌 '+opName()+' 在等你連線對戰！點這裡加入';});
  }
  function tally(){var w=room.win||{},a=+w.syue||0,b=+w.ling||0;return a||b?'戰績　學 '+a+' : '+b+' 綾':'還沒有對戰紀錄';}
  function slot(u,pet,here,txt,crown){return '<div class="vs-slot '+u+(here?'':' away')+'">'+(crown?'<span class="crown">👑</span>':'')+'<img src="'+G.petImg(pet||'pg','happy')+'" alt=""><b>'+G.NAMES[u]+'</b><span>'+txt+'</span></div>';}
  // 對戰房間：兩個人都進來（每 8 秒報到一次）就自動開始
  function openRoom(){
    var old=document.querySelector('[data-room]');if(old)old.remove();
    if(!can()){
      var info=G.el('<div class="g-ov" data-room><section class="g-card" role="dialog" aria-modal="true" aria-label="連線對戰"><h2>📱 連線對戰</h2><p>兩支手機要用同一個同步代碼，<br>而且各自選好你是誰（學／綾），才能連線對戰。<br>回班表的 ⚙️ 設定就能設定同步代碼。</p><div class="g-btns"><button class="g-btn ghost" data-cancel>知道了</button></div></section></div>');
      document.body.appendChild(info);info.querySelector('[data-cancel]').onclick=function(){info.remove();};return;
    }
    var ov=G.el('<div class="g-ov" data-room><section class="g-card" role="dialog" aria-modal="true" aria-label="連線對戰"><h2>📱 連線對戰・'+NAMES[cfg.game]+'</h2><div id="vsRoom"><p>連線中…</p></div><div class="g-btns"><button class="g-btn ghost" data-cancel>取消</button></div></section></div>');
    document.body.appendChild(ov);ov.querySelector('[data-cancel]').onclick=function(){SND.sfx('tap');leaveRoom();};
    watchRoom().then(function(){
      if(!document.body.contains(ov))return;
      inRoom=true;hello(cfg.game,true,petOf()).catch(roomErr);clearInterval(hb);hb=setInterval(function(){if(inRoom)hello(cfg.game,true,petOf()).catch(roomErr);},8000);
      paintRoom();maybeGo();
    }).catch(roomErr);
  }
  function roomErr(e){warn(e);var b=document.getElementById('vsRoom');if(b)b.innerHTML='<p>連不上，確認網路後再試一次</p>';}
  function leaveRoom(){inRoom=false;clearInterval(hb);if(roomOff)hello(cfg.game,false,petOf()).catch(noop);var ov=document.querySelector('[data-room]');if(ov)ov.remove();}
  // 房間裡換了寵物之類的：重新報到、重畫
  function changed(){if(inRoom){hello(cfg.game,true,petOf()).catch(noop);paintRoom();}}
  function paintRoom(){
    var box=document.getElementById('vsRoom');if(!box)return;
    var m=me(),op=other(),o=room[op],here=present(o);
    box.innerHTML='<div class="vs-row">'+slot(m,petOf(),true,'準備好了 ✓')+'<span class="vs-x">VS</span>'+slot(op,(o&&o.pet)||petOf(),here,here?'準備好了 ✓':'還沒進來…')+'</div>'+
      (clash(room)?'<div class="vs-warn">另一支手機也是「'+G.NAMES[m]+'」！到班表的寵物狀態，把其中一支換成另一個人</div>':'')+
      '<p>'+(here?'兩個人都到了，馬上開始！':'叫'+G.NAMES[op]+'也打開「'+NAMES[cfg.game]+'」按「連線對戰」，<br>兩個人都進來就自動開始')+'</p>'+
      '<ol class="g-rules vs-rules">'+cfg.rules.concat(['贏的人拿 1 包飼料（算在每天 '+G.CAP+' 包裡）']).map(function(x){return '<li>'+x+'</li>';}).join('')+'</ol>'+
      (cfg.extra?cfg.extra():'')+'<div class="vs-tally" id="vsTally">'+tally()+'</div>';
    if(cfg.mountExtra)cfg.mountExtra(box);
  }
  // 學的手機負責開局：兩個人都在房間，就寫下關卡種子和 4 秒後的開始時間
  function maybeGo(){
    if(!inRoom)return;
    var g=room.go,T=now(),m=me();
    if(g&&g.id!==goSeen&&g.p&&g.p[m]&&ms(g.at)>T-3000&&ms(g.at)<T+15000){goSeen=g.id;startVs(g);return;}
    if(m==='syue'&&Date.now()-going>6000&&present(room.syue)&&present(room.ling)&&!clash(room)){
      going=Date.now();var p={syue:petOf(),ling:room.ling.pet||petOf()};
      put(cfg.game,{go:{id:Math.random().toString(36).slice(2,10),seed:Math.floor(Math.random()*4294967295),at:Math.round(now()+4000),p:p}}).catch(roomErr);
    }
  }
  function startVs(g){
    inRoom=false;clearInterval(hb);hello(cfg.game,false,petOf()).catch(noop);
    document.querySelectorAll('.g-ov').forEach(function(o){o.remove();});
    if(M&&M.unsub)M.unsub();
    var op=other(),m=me();
    M={id:g.id,seed:g.seed,at:ms(g.at),op:op,pet:g.p[m],opPet:g.p[op],rx:0,sent:0,done:0,opDone:0,opM:0,opS:0,myM:0,myS:0,lost:0,shown:0};
    M.rx=Date.now()+Math.max(0,M.at-now());
    M.unsub=listen(op,onLive);
    barTxt='';cfg.begin(M);
    SND.music(cfg.game);countdown(M.at,function(){cfg.start(M);});
  }
  // 倒數照伺服器時間：兩支手機同一刻開始
  function countdown(at,cb){
    var c=G.el('<div class="g-count" aria-live="assertive"></div>'),n0=-1;document.body.appendChild(c);
    (function loop(){
      var r=at-now();
      if(r<=0){c.innerHTML='<span>開始！</span>';SND.sfx('go');setTimeout(function(){c.remove();},600);cb();return;}
      var n=Math.ceil(r/1000);if(n!==n0){n0=n;c.innerHTML='<span'+(n>3?' style="font-size:52px"':'')+'>'+(n>3?'配對成功！':n)+'</span>';SND.sfx('tick');}
      setTimeout(loop,40);
    })();
  }
  function onLive(d){
    if(!M||!d||d.g!==M.id)return;
    M.rx=Date.now();M.opM=+d.m||0;M.opS=+d.sb||0;M.last=d;
    if(cfg.live)cfg.live(d,M);
    if(+d.d&&!M.opDone){M.opDone=1;if(cfg.opDone)cfg.opDone(M);}
    if(M.done)after();
  }
  // 開局到現在幾秒（伺服器時間，兩支手機一樣）
  function time(){return M?(now()-M.at)/1000:0;}
  function sendLive(cur,d){var o={g:M.id,d:d?1:0};for(var k in cur)o[k]=cur[k];M.myM=+cur.m||0;M.myS=+cur.sb||0;M.sent=now();return send(o).catch(noop);}
  // 每一格呼叫：到時間就送出自己的狀態、看對方斷線沒、更新上面那排。回傳 'time'（時間到）、'ahead'（對方停了、我已經贏了）
  function frame(cur){
    if(!M||M.done)return '';
    M.myM=+cur.m||0;M.myS=+cur.sb||0;
    if(now()-M.sent>=SEND)sendLive(cur,0);
    if(!M.opDone&&Date.now()-M.rx>10000){M.opDone=1;M.lost=1;if(cfg.opDone)cfg.opDone(M);}
    paintBar();
    if(time()>=cfg.time)return 'time';
    if(M.opDone&&cmp(M.myM,M.myS,M.opM,M.opS)>0)return 'ahead';
    return '';
  }
  // 馬上送出（丟東西給對方的時候，不用等下一次）
  function push(cur){if(M&&!M.done)sendLive(cur,0);}
  function paintBar(){
    if(!bar){bar=document.createElement('div');bar.className='vsbar';document.body.appendChild(bar);}
    bar.hidden=false;
    var lead=cmp(M.opM,M.opS,M.myM,M.myS)>0;
    var txt=(cfg.clock===false?'':'<b class="clk">⏱ '+Math.max(0,Math.ceil(cfg.time-time()))+'</b>')+'<b class="'+M.op+(lead?' lead':'')+'">'+G.NAMES[M.op]+' '+cfg.bar(M)+(M.opDone?(M.lost?'・斷線':'・停了'):'')+'</b>';
    if(txt!==barTxt){barTxt=txt;bar.innerHTML=txt;}
  }
  function hideBar(){if(bar)bar.hidden=true;barTxt='';}
  // 這局結束了（時間到、愛心用完…）：送出最後的成績；對方還沒結束就等
  function finish(cur,why){if(!M||M.done)return;M.myM=+cur.m||0;M.myS=+cur.sb||0;M.done=1;M.why=why;sendLive(cur,1);paintBar();setTimeout(after,900);}
  function after(){
    if(!M||!M.done||M.shown)return;
    if(!M.opDone){wait();return;}
    M.shown=1;clearInterval(M.waitT);
    // 兩邊的最後資料都到了：需要的遊戲在這裡把成績對齊（例如打地鼠兩個人同時敲到同一隻）
    if(cfg.settle)cfg.settle(M);
    var w=document.querySelector('[data-wait]');if(w)w.remove();
    result();
  }
  function wait(){
    var ov=document.querySelector('[data-wait]');
    if(!ov){
      ov=G.el('<div class="g-ov" data-wait><section class="g-card" role="dialog" aria-modal="true" aria-label="等對方"><div id="vsWaitBox"></div><div class="g-btns"><button class="g-btn ghost" data-lobby>冒險大廳</button></div></section></div>');
      document.body.appendChild(ov);ov.querySelector('[data-lobby]').onclick=function(){location.href='./';};
      // 每秒更新；對方 10 秒沒消息就當斷線
      var v=M;v.waitT=setInterval(function(){if(v.shown||v!==M){clearInterval(v.waitT);return;}if(!v.opDone&&Date.now()-v.rx>10000){v.opDone=1;v.lost=1;}after();},1000);
    }
    var left=Math.max(0,Math.ceil(cfg.time-time()));
    document.getElementById('vsWaitBox').innerHTML='<h2>'+cfg.fmt(M.myM,M.myS)+'</h2><p>'+M.why+'<br>等'+opName()+'玩完…現在 <b>'+cfg.fmt(M.opM,M.opS)+'</b>（還有 '+left+' 秒）</p>';
  }
  function result(){
    var m=me(),op=M.op,c=cmp(M.myM,M.myS,M.opM,M.opS),w=c>0?m:c<0?op:'';
    // 戰績：贏的一方加一（兩支手機都可能寫，寫的值一樣；用這局的 id 擋重複）
    var win=room.win||{};
    if(w&&win.last!==M.id){var o={last:M.id};o[w]=(+win[w]||0)+1;room.win=Object.assign({},win,o);put(cfg.game,{win:o}).catch(noop);}
    var got=w===m&&M.myM>0?G.record(cfg.game+'vs',M.myM,1):0;
    var head=!w?'平手！':w===m?'🏆 你贏了！':opName()+'贏了，再來一局！';
    var mine=cfg.fmt(M.myM,M.myS),theirs=cfg.fmt(M.opM,M.opS);
    var why=G.NAMES[m]+' '+mine+' vs '+G.NAMES[op]+' '+theirs;
    var rw=w===m?(got?'<div class="g-reward"><img src="../assets/games/ui/kib.svg" alt="">獲得飼料 ×1<span class="g-small" style="margin:0 0 0 4px">回班表就會收到</span></div>':(M.myM>0?'<div class="g-reward none">今天的 '+G.CAP+' 包飼料已經拿完了</div>':'')):'';
    var ov=G.el('<div class="g-ov" data-vsres><section class="g-card g-result" role="dialog" aria-modal="true" aria-label="對戰結果"><div class="g-result-ribbon">'+G.SCENES[cfg.game].label+' · 連線對戰</div><div class="vs-row">'+slot(m,M.pet,true,mine,w===m)+'<span class="vs-x">VS</span>'+slot(op,M.opPet,true,theirs+(M.lost?'・斷線':''),w===op)+'</div><h2>'+head+'</h2><p>'+why+'</p>'+rw+'<div class="vs-tally" id="vsTally">'+tally()+'</div><div class="g-btns g-result-actions"><button class="g-btn" data-again>再來一局 ↻</button><button class="g-btn ghost" data-solo>自己玩</button><button class="g-btn ghost" data-lobby>冒險大廳</button></div></section></div>');
    document.body.appendChild(ov);
    SND.stop();SND.sfx('fanfare',w===m?3:1);
    if(M.unsub){M.unsub();M.unsub=null;}
    ov.querySelector('[data-again]').onclick=function(){SND.sfx('tap');openRoom();};
    ov.querySelector('[data-solo]').onclick=function(){ov.remove();M=null;hideBar();SND.music(cfg.game);cfg.solo();};
    ov.querySelector('[data-lobby]').onclick=function(){location.href='./';};
  }
  return {NAMES:NAMES,ORDER:ORDER,can:can,me:me,other:other,connect:connect,now:now,ms:ms,seeded:seeded,watch:watch,watchAll:watchAll,present:present,
    setup:setup,auto:auto,mount:mount,changed:changed,frame:frame,push:push,finish:finish,time:time,opName:opName,
    match:function(){return M;},cfg:function(){return cfg;},inRoom:function(){return inRoom;},sid:function(){return sid;}};
})();

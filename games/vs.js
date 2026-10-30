/* 連線對戰：兩支手機用班表同一個 Firebase、同一個同步代碼。
   房間 banbiao/<代碼>_vs：{遊戲:{syue:{on,pet,at,sid}, ling:{…}, go:{id,seed,at,p}, win:{syue,ling,last}}}
     on＝在對戰房間等（每 8 秒報到一次），go＝開局（關卡種子＋開始時間），win＝戰績。
   比賽中每個人一份 banbiao/<代碼>_vs_<誰>，每 0.3 秒寫一次自己的位置，對方即時收到。
   時間都用「伺服器時間」：連上時寫一個伺服器時間再讀回來，算出這支手機的時鐘差多少。 */
var VS=(function(){
  var CFG={apiKey:'AIzaSyCOrBO2bs1VmSCUd14bqNJJ2GBeieR2ELo',authDomain:'syue-work-schedule.firebaseapp.com',projectId:'syue-work-schedule',storageBucket:'syue-work-schedule.firebasestorage.app',messagingSenderId:'785105764126',appId:'1:785105764126:web:6ca5aa11e53a85f4bf930f'};
  var SDK='https://www.gstatic.com/firebasejs/10.12.0/',FRESH=25000;
  var fs=null,db=null,off=0,ready=null,sid=Math.random().toString(36).slice(2,8);
  function ls(k){try{return localStorage.getItem(k);}catch(e){return null;}}
  function code(){var c=ls('syncCode')||'';return c&&c!=='LOCAL'?c:'';}
  function me(){return G.who();}
  function other(){var m=me();return m==='syue'?'ling':m==='ling'?'syue':'';}
  function can(){return !!(code()&&me());}
  function ms(v){return v&&v.toMillis?v.toMillis():+v||0;}
  function now(){return Date.now()+off;}
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
  // 房間有變就通知（拿到的是這款遊戲那一格）
  function watch(game,cb){return fs.onSnapshot(roomRef(),function(s){var d=s.exists()?s.data():{};cb(d[game]||{});},function(e){console.warn('vs room',e);});}
  function put(game,data){var o={};o[game]=data;return fs.setDoc(roomRef(),o,{merge:true});}
  // 我在不在房間：on＝等開局；另一支手機也用同一個身份時 sid 會不一樣
  function hello(game,on,pet){var o={};o[me()]={on:!!on,pet:pet||'',at:now(),sid:sid};return put(game,o);}
  function present(slot){return !!(slot&&slot.on&&Math.abs(now()-ms(slot.at))<FRESH);}
  function clash(room){var s=room[me()];return present(s)&&s.sid!==sid;}
  function send(data){return fs.setDoc(liveRef(me()),data);}
  function listen(u,cb){return fs.onSnapshot(liveRef(u),function(s){cb(s.exists()?s.data():null);},function(e){console.warn('vs live',e);});}
  return {can:can,code:code,me:me,other:other,connect:connect,now:now,ms:ms,watch:watch,put:put,hello:hello,present:present,clash:clash,send:send,listen:listen,sid:function(){return sid;}};
})();

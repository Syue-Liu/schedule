/* 小遊戲的配樂和音效：全部用 Web Audio 即時合成，不用音樂檔。
   iPhone 要點過畫面才能出聲，所以第一次點的時候才開；右上角 🔊／🔇 可以關，會記在這支手機。
   聲音類型設成 ambient：手機開靜音時不會出聲，也不會把正在聽的音樂停掉。 */
var SND=(function(){
  var KEY='gameSound',MUSIC=.3,ctx=null,out=null,want=null,cur=null,timer=0,tempo=1,level=.5;
  function on(){try{return localStorage.getItem(KEY)!=='off';}catch(e){return true;}}
  function setOn(v){try{localStorage.setItem(KEY,v?'on':'off');}catch(e){}}
  // 音名→頻率（A4＝440）
  var SEMI={C:-9,D:-7,E:-5,F:-4,G:-2,A:0,B:2};
  function hz(n){var m=/^([A-G])(#|b)?(-?\d)$/.exec(n);if(!m)return 0;return 440*Math.pow(2,(SEMI[m[1]]+(m[2]==='#'?1:m[2]==='b'?-1:0)+(+m[3]-4)*12)/12);}

  // 每個聲音環境（手機上的、預覽用的離線）各自一套：壓縮→總音量→配樂／音效
  function chain(c){
    var comp=c.createDynamicsCompressor();comp.threshold.value=-12;comp.ratio.value=4;comp.connect(c.destination);
    var master=c.createGain();master.gain.value=.85;master.connect(comp);
    var music=c.createGain();music.gain.value=MUSIC;music.connect(master);
    var fx=c.createGain();fx.gain.value=.75;fx.connect(master);
    var nb=c.createBuffer(1,c.sampleRate,c.sampleRate),nd=nb.getChannelData(0);for(var i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
    return {c:c,music:music,fx:fx,noise:nb,pl:{},amb:0,cri:0};
  }
  // 基本零件：一個音（可以滑音）、一段濾過的雜音
  function tone(o,d,t,f,type,a,v,dec,f2){
    var c=o.c,os=c.createOscillator(),g=c.createGain();os.type=type;os.frequency.setValueAtTime(f,t);
    if(f2)os.frequency.exponentialRampToValueAtTime(f2,t+a+dec);
    os.connect(g);g.connect(d);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+dec);
    os.start(t);os.stop(t+a+dec+.05);
  }
  function noise(o,d,t,type,fq,q,a,v,dec,fq2){
    var c=o.c,s=c.createBufferSource(),fl=c.createBiquadFilter(),g=c.createGain();s.buffer=o.noise;s.loop=true;
    fl.type=type;fl.frequency.setValueAtTime(fq,t);if(fq2)fl.frequency.exponentialRampToValueAtTime(fq2,t+a+dec);fl.Q.value=q||1;
    s.connect(fl);fl.connect(g);g.connect(d);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+dec);
    s.start(t,Math.random()*.5);s.stop(t+a+dec+.05);
  }
  // 撥弦（Karplus-Strong）：先算好一段波形存起來，同一個音重複用
  function ks(o,f){
    var k=Math.round(f*10);if(o.pl[k])return o.pl[k];
    var sr=o.c.sampleRate,n=Math.round(sr*1.4),b=o.c.createBuffer(1,n,sr),d=b.getChannelData(0),p=Math.max(2,Math.round(sr/f)),w=new Float32Array(p),i,j=0,pk=0;
    for(i=0;i<p;i++)w[i]=Math.random()*2-1;
    for(i=1;i<p;i++)w[i]=(w[i]+w[i-1])*.5;
    var dec=.9965-Math.min(.004,f/250000);
    for(i=0;i<n;i++){var a=w[j],nx=w[(j+1)%p];w[j]=(a+nx)*.5*dec;d[i]=a;if(Math.abs(a)>pk)pk=Math.abs(a);j=(j+1)%p;}
    for(i=0;i<n;i++)d[i]/=pk||1;
    return o.pl[k]=b;
  }
  // 樂器：(環境, 接到哪, 時間, 頻率, 長度秒, 音量)
  var INST={
    xylo:function(o,d,t,f,len,v){tone(o,d,t,f,'sine',.002,v,.28*Math.min(1.5,500/f+.5));tone(o,d,t,f*4,'sine',.001,v*.16,.06);},
    box:function(o,d,t,f,len,v){tone(o,d,t,f,'sine',.002,v,1.1);tone(o,d,t,f*2,'sine',.002,v*.22,.4);tone(o,d,t,f*3.01,'sine',.001,v*.07,.18);},
    bell:function(o,d,t,f,len,v){tone(o,d,t,f,'sine',.002,v,1.6);tone(o,d,t,f*2.76,'sine',.001,v*.25,.5);tone(o,d,t,f*5.4,'sine',.001,v*.1,.2);},
    pluck:function(o,d,t,f,len,v){
      var c=o.c,s=c.createBufferSource(),g=c.createGain(),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=Math.min(5000,f*6+800);
      s.buffer=ks(o,f);g.gain.value=v;s.connect(lp);lp.connect(g);g.connect(d);s.start(t);s.stop(t+1.4);
    },
    bass:function(o,d,t,f,len,v){
      var c=o.c,os=c.createOscillator(),g=c.createGain(),lp=c.createBiquadFilter();os.type='triangle';os.frequency.value=f;lp.type='lowpass';lp.frequency.value=900;
      os.connect(lp);lp.connect(g);g.connect(d);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.01);g.gain.setTargetAtTime(v*.55,t+.04,.12);
      var e=t+Math.max(.08,len-.02);g.gain.setTargetAtTime(0,e,.04);os.start(t);os.stop(e+.3);
    },
    pad:function(o,d,t,f,len,v){
      var c=o.c,g=c.createGain(),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1400;lp.connect(g);g.connect(d);
      [-6,6].forEach(function(ct){var os=c.createOscillator();os.type='triangle';os.frequency.value=f;os.detune.value=ct;os.connect(lp);os.start(t);os.stop(t+len+1);});
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.35);g.gain.setTargetAtTime(0,t+len,.25);
    },
    flute:function(o,d,t,f,len,v){
      var c=o.c,os=c.createOscillator(),lfo=c.createOscillator(),lg=c.createGain(),g=c.createGain();os.type='sine';os.frequency.value=f;
      lfo.frequency.value=5;lg.gain.value=f*.006;lfo.connect(lg);lg.connect(os.frequency);os.connect(g);g.connect(d);
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.07);g.gain.setTargetAtTime(v*.8,t+.1,.2);g.gain.setTargetAtTime(0,t+Math.max(.1,len-.05),.07);
      os.start(t);lfo.start(t);os.stop(t+len+.5);lfo.stop(t+len+.5);
    },
    lead:function(o,d,t,f,len,v){
      var c=o.c,os=c.createOscillator(),g=c.createGain(),lp=c.createBiquadFilter();os.type='square';os.frequency.value=f;lp.type='lowpass';lp.frequency.value=1800;
      os.connect(lp);lp.connect(g);g.connect(d);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.008);g.gain.setTargetAtTime(v*.5,t+.03,.08);
      var e=t+Math.max(.06,len-.02);g.gain.setTargetAtTime(0,e,.03);os.start(t);os.stop(e+.25);
    }
  };
  // 打擊：k 大鼓、s 小鼓、h 腳踏鈸、x 沙鈴、w 木魚、j 鈴鐺
  var DR={
    k:function(o,d,t,v){tone(o,d,t,140,'sine',.002,v,.2,42);},
    s:function(o,d,t,v){noise(o,d,t,'bandpass',1900,.8,.001,v*.5,.13);tone(o,d,t,190,'triangle',.001,v*.35,.07,120);},
    h:function(o,d,t,v){noise(o,d,t,'highpass',7500,.7,.001,v*.28,.035);},
    x:function(o,d,t,v){noise(o,d,t,'bandpass',6500,1.2,.012,v*.26,.06);},
    w:function(o,d,t,v){tone(o,d,t,1150,'sine',.001,v*.45,.05,820);noise(o,d,t,'bandpass',2600,4,.001,v*.25,.025);},
    j:function(o,d,t,v){[2637,3136,3520].forEach(function(f,i){tone(o,d,t+i*.012,f,'sine',.001,v*.12,.25);});noise(o,d,t,'highpass',8000,.7,.005,v*.15,.12);}
  };

  // 樂譜：一格一個八分音符；「.」休息、「-」延長前一個音、「C4+E4+G4」和弦、「|」只是方便看的小節線
  function rep(s,n){return Array(n+1).join(s+' | ');}
  var TR={
    // 冒險大廳：音樂盒主題曲（C 大調）
    lobby:{bpm:112,parts:[
      {i:'box',v:.42,n:'G5 . E5 . G5 . C6 . | B5 . A5 G5 D5 . G5 . | A5 . C6 . E5 . A5 . | G5 . F5 E5 F5 . . . | E5 . G5 . C6 . D6 . | B5 . G5 . D5 . G5 . | A5 . C6 . B5 . D6 . | C6 . . . G5 . E5 .'},
      {i:'bass',v:.42,n:'C3 - - - G2 - - - | G2 - - - D3 - - - | A2 - - - E3 - - - | F2 - - - C3 - - - | C3 - - - G2 - - - | G2 - - - D3 - - - | F2 - - - G2 - - - | C3 - - - G2 - C3 -'},
      {i:'pluck',v:.2,n:'. . C4+E4+G4 . . . C4+E4+G4 . | . . B3+D4+G4 . . . B3+D4+G4 . | . . A3+C4+E4 . . . A3+C4+E4 . | . . A3+C4+F4 . . . A3+C4+F4 . | . . C4+E4+G4 . . . C4+E4+G4 . | . . B3+D4+G4 . . . B3+D4+G4 . | . . A3+C4+F4 . . . B3+D4+G4 . | . . C4+E4+G4 . . . C4+E4+G4 .'},
      {d:1,v:.45,n:rep('k . x . k x x .',8)}
    ]},
    // 打地鼠：蹦蹦跳跳的木琴（F 大調）
    whack:{bpm:138,parts:[
      {i:'xylo',v:.42,n:'C5 F5 A5 F5 C6 . A5 . | G5 . E5 . C5 E5 G5 . | D5 F5 A5 F5 D6 . A5 . | Bb5 . A5 . G5 . E5 . | F5 A5 C6 A5 F6 . C6 . | E6 . D6 C6 G5 . E5 . | D6 . C6 Bb5 A5 . G5 . | F5 . A5 . F5 . . .'},
      {i:'bass',v:.5,n:'F2 . C3 . F2 . C3 . | C3 . G2 . C3 . G2 . | D3 . A2 . D3 . A2 . | Bb2 . F2 . C3 . G2 . | F2 . C3 . F2 . C3 . | C3 . G2 . C3 . G2 . | Bb2 . F2 . C3 . G2 . | F2 . C3 . F2 . . .'},
      {i:'pluck',v:.16,n:'. . A3+C4+F4 . . . A3+C4+F4 . | . . G3+C4+E4 . . . G3+C4+E4 . | . . A3+D4+F4 . . . A3+D4+F4 . | . . Bb3+D4+F4 . . . G3+C4+E4 . | . . A3+C4+F4 . . . A3+C4+F4 . | . . G3+C4+E4 . . . G3+C4+E4 . | . . Bb3+D4+F4 . . . G3+C4+E4 . | . . A3+C4+F4 . . . A3+C4+F4 .'},
      {d:1,v:.5,n:rep('k h w h k w w h',8)}
    ]},
    // 釣魚：慢慢的撥弦＋長笛（G 大調，有一點搖擺）
    fish:{bpm:88,sw:.16,parts:[
      {i:'pluck',v:.3,n:'G3 D4 G4 B4 D5 B4 G4 D4 | E3 B3 E4 G4 B4 G4 E4 B3 | C3 G3 C4 E4 G4 E4 C4 G3 | D3 A3 D4 F#4 A4 F#4 D4 A3 | G3 D4 G4 B4 D5 B4 G4 D4 | E3 B3 E4 G4 B4 G4 E4 B3 | C3 G3 C4 E4 D3 A3 D4 F#4 | G3 D4 G4 B4 D5 B4 G4 D4'},
      {i:'flute',v:.2,n:'B4 - - - D5 - - - | E5 - - - D5 - B4 - | C5 - - - E5 - G5 - | F#5 - - - A5 - - - | G5 - - - B5 - A5 G5 | E5 - - - G5 - - - | E5 - - - F#5 - D5 - | G5 - - - - - . .'},
      {i:'bass',v:.3,n:'G2 - - - - - - - | E2 - - - - - - - | C2 - - - - - - - | D2 - - - - - - - | G2 - - - - - - - | E2 - - - - - - - | C2 - - - D2 - - - | G2 - - - - - - -'},
      {d:1,v:.32,n:rep('. . x . . . x .',8)}
    ]},
    // 露營：夜晚的吉他分解和弦＋墊音，背景有營火劈啪聲和蟲叫（B 小調）
    camp:{bpm:72,amb:'camp',parts:[
      {i:'pluck',v:.33,n:'B2 F#3 B3 D4 F#4 D4 B3 F#3 | G2 D3 G3 B3 D4 B3 G3 D3 | D3 A3 D4 F#4 A4 F#4 D4 A3 | A2 E3 A3 C#4 E4 C#4 A3 E3 | B2 F#3 B3 D4 F#4 D4 B3 F#3 | G2 D3 G3 B3 D4 B3 G3 D3 | E2 B2 E3 G3 B3 G3 E3 B2 | F#2 C#3 F#3 A#3 C#4 A#3 F#3 C#3'},
      {i:'pad',v:.07,n:'B3+D4+F#4 - - - - - - - | G3+B3+D4 - - - - - - - | A3+D4+F#4 - - - - - - - | A3+C#4+E4 - - - - - - - | B3+D4+F#4 - - - - - - - | G3+B3+D4 - - - - - - - | G3+B3+E4 - - - - - - - | A#3+C#4+F#4 - - - - - - -'},
      {i:'flute',v:.17,n:'F#5 - - - - - E5 D5 | D5 - - - B4 - - - | A4 - - - D5 - F#5 - | E5 - - - - - . . | F#5 - - - - - A5 G5 | G5 - - - D5 - B4 - | B4 - - - E5 - G5 - | F#5 - - - - - . .'}
    ]},
    // 溫泉：三拍子的音樂盒＋鈴鐺（C 大調，一小節 6 格）
    spring:{bpm:104,parts:[
      {i:'box',v:.46,n:'E5 - G5 - C6 - | B5 - A5 - E5 - | F5 - A5 - C6 - | B5 - - - G5 - | E5 - G5 - C6 - | D6 - C6 - A5 - | F5 - A5 - B5 D6 | C6 - - - - -'},
      {i:'bass',v:.3,n:'C3 - - - - - | A2 - - - - - | F2 - - - - - | G2 - - - - - | C3 - - - - - | A2 - - - - - | D3 - - - G2 - | C3 - - - - -'},
      {i:'box',v:.11,n:'. . E4+G4 . E4+G4 . | . . C4+E4 . C4+E4 . | . . A4+C5 . A4+C5 . | . . B4+D5 . B4+D5 . | . . E4+G4 . E4+G4 . | . . C4+E4 . C4+E4 . | . . F4+A4 . B4+D5 . | . . E4+G4 . E4+G4 .'},
      {d:1,v:.3,n:rep('j . x . x .',8)}
    ]},
    // 摩托車：輕快的兜風曲（A 大調），車子越快節奏越快
    moto:{bpm:144,parts:[
      {i:'lead',v:.17,n:'E5 . A5 . C#6 . A5 B5 | C#6 . A5 . F#5 . A5 . | F#5 . A5 . D6 . C#6 B5 | B5 . G#5 . E5 . . . | E5 . A5 . C#6 . E6 . | D6 . C#6 . A5 . F#5 . | F#5 . A5 . B5 . C#6 D6 | E6 . . . B5 . G#5 .'},
      {i:'bass',v:.45,n:rep('A2 . A3 A2 . A2 A3 . | F#2 . F#3 F#2 . F#2 F#3 . | D2 . D3 D2 . D2 D3 . | E2 . E3 E2 . E2 E3 .',2)},
      {i:'xylo',v:.14,n:rep('. A4+C#5+E5 . . . A4+C#5+E5 . . | . F#4+A4+C#5 . . . F#4+A4+C#5 . . | . F#4+A4+D5 . . . F#4+A4+D5 . . | . E4+G#4+B4 . . . E4+G#4+B4 . .',2)},
      {d:1,v:.48,n:rep('k h s h k k s h',8)}
    ]},
    // 爬樓梯：一直往上跳的木琴（D 大調）
    climb:{bpm:128,parts:[
      {i:'xylo',v:.4,n:'D5 F#5 A5 D6 . A5 F#5 A5 | C#5 E5 A5 C#6 . A5 E5 A5 | B4 D5 F#5 B5 . F#5 D5 F#5 | G4 B4 D5 G5 . D5 B4 D5 | D5 F#5 A5 D6 . E6 F#6 . | E6 . C#6 . A5 . E5 . | G5 B5 D6 B5 A5 C#6 E6 C#6 | D6 . A5 . F#5 . D5 .'},
      {i:'bass',v:.45,n:'D3 . D3 . A2 . A2 . | A2 . A2 . E3 . E3 . | B2 . B2 . F#2 . F#2 . | G2 . G2 . D3 . D3 . | D3 . D3 . A2 . A2 . | A2 . A2 . E3 . E3 . | G2 . G2 . A2 . A2 . | D3 . A2 . D3 . . .'},
      {i:'box',v:.12,n:'. . D4+F#4+A4 . . . D4+F#4+A4 . | . . C#4+E4+A4 . . . C#4+E4+A4 . | . . B3+D4+F#4 . . . B3+D4+F#4 . | . . B3+D4+G4 . . . B3+D4+G4 . | . . D4+F#4+A4 . . . D4+F#4+A4 . | . . C#4+E4+A4 . . . C#4+E4+A4 . | . . B3+D4+G4 . . . C#4+E4+A4 . | . . D4+F#4+A4 . . . D4+F#4+A4 .'},
      {d:1,v:.42,n:rep('k . h . s . h h',8)}
    ]}
  };
  function parse(tr){
    if(tr.len)return;
    tr.len=0;
    tr.parts.forEach(function(p){
      var tk=p.n.split(/\s+/).filter(function(x){return x&&x!=='|';}),seq=[];
      tk.forEach(function(x,i){
        if(x==='.'||x==='-'){seq.push(null);if(x==='-')for(var j=i-1;j>=0;j--)if(seq[j]){seq[j].len++;break;}else if(tk[j]!=='-')break;return;}
        seq.push({n:p.d?x.split('+'):x.split('+').map(hz),len:1});
      });
      p.seq=seq;tr.len=Math.max(tr.len,seq.length);
    });
  }
  function playStep(o,tr,step,t,sd){
    tr.parts.forEach(function(p){var e=p.seq[step%p.seq.length];if(!e)return;
      if(p.d)e.n.forEach(function(k){DR[k]&&DR[k](o,o.music,t,p.v);});
      else e.n.forEach(function(f){INST[p.i](o,o.music,t,f,e.len*sd,p.v);});
    });
  }
  // 營火劈啪聲（火越大越密）和蟲叫
  function ambient(o,t0,t1,lv){
    if(!o.amb)o.amb=t0;if(!o.cri)o.cri=t0+.5;
    while(o.amb<t1){
      if(Math.random()<.25+lv*.6)noise(o,o.music,o.amb,'highpass',1500+Math.random()*3500,.7,.001,(.08+lv*.35)*Math.random(),.008+Math.random()*.02);
      if(Math.random()<.04*lv)noise(o,o.music,o.amb,'lowpass',700,1,.002,.35*lv,.05);
      o.amb+=.03+Math.random()*(.12-lv*.07);
    }
    while(o.cri<t1){
      for(var i=0;i<3;i++)tone(o,o.music,o.cri+i*.055,4300+Math.random()*120,'sine',.006,.05,.03);
      o.cri+=.9+Math.random()*1.8;
    }
  }
  function pump(){
    if(!cur||!ctx)return;
    var tr=cur.tr,sd=60/(tr.bpm*tempo)/2,until=ctx.currentTime+.15;
    while(cur.next<until){playStep(out,tr,cur.step,cur.next+(cur.step%2?sd*(tr.sw||0):0),sd);cur.next+=sd;cur.step=(cur.step+1)%tr.len;}
    if(tr.amb)ambient(out,ctx.currentTime,until,level);
  }
  function startTrack(name){
    stopTrack(true);var tr=TR[name];if(!tr||!ctx)return;parse(tr);
    var t=ctx.currentTime;cur={tr:tr,step:0,next:t+.08};out.amb=0;out.cri=0;
    out.music.gain.cancelScheduledValues(t);out.music.gain.setValueAtTime(0,t);out.music.gain.linearRampToValueAtTime(MUSIC,t+.5);
    clearInterval(timer);timer=setInterval(pump,25);pump();
  }
  function stopTrack(now){
    clearInterval(timer);timer=0;cur=null;
    if(ctx&&!now){var t=ctx.currentTime;out.music.gain.cancelScheduledValues(t);out.music.gain.setValueAtTime(out.music.gain.value,t);out.music.gain.linearRampToValueAtTime(0,t+.4);}
  }

  // 音效
  function arp(o,d,t,notes,gap,inst,v){notes.forEach(function(n,i){INST[inst](o,d,t+i*gap,hz(n),.2,v);});}
  var SFX={
    tap:function(o,d,t){tone(o,d,t,700,'sine',.001,.18,.05,900);},
    tick:function(o,d,t){INST.xylo(o,d,t,hz('A5'),.1,.5);},
    go:function(o,d,t){arp(o,d,t,['A5','E6'],.07,'xylo',.5);INST.box(o,d,t+.14,hz('A6'),.3,.3);},
    star:function(o,d,t,i){INST.box(o,d,t,hz(['E6','G6','C7'][i||0]),.3,.45);},
    fanfare:function(o,d,t,s){
      if(!s)return arp(o,d,t,['E5','C5','G4'],.16,'xylo',.45);
      arp(o,d,t,s>=2?['C5','E5','G5','C6']:['C5','E5','G5'],.09,'xylo',.45);
      if(s>=3){arp(o,d,t+.4,['E6','G6','C7'],.06,'box',.25);['C5','E5','G5'].forEach(function(n){INST.box(o,d,t+.4,hz(n),.5,.2);});}
    },
    // 打地鼠
    pop:function(o,d,t){tone(o,d,t,420,'sine',.005,.1,.07,820);},
    bonk:function(o,d,t){tone(o,d,t,240,'triangle',.001,.55,.12,90);noise(o,d,t,'bandpass',900,1,.001,.35,.05);tone(o,d,t+.04,1300,'sine',.005,.16,.09,1900);},
    gold:function(o,d,t){SFX.bonk(o,d,t);arp(o,d,t+.05,['C6','E6','G6','C7'],.05,'xylo',.35);},
    ouch:function(o,d,t){tone(o,d,t,330,'square',.002,.12,.3,95);tone(o,d,t,165,'triangle',.002,.3,.3,60);},
    swish:function(o,d,t){noise(o,d,t,'bandpass',900,1.2,.02,.12,.1,3000);},
    // 釣魚
    cast:function(o,d,t){noise(o,d,t,'bandpass',500,1,.08,.28,.35,2600);},
    plop:function(o,d,t){tone(o,d,t,720,'sine',.002,.4,.13,170);noise(o,d,t,'lowpass',900,1,.001,.18,.09);},
    nibble:function(o,d,t){tone(o,d,t,620,'sine',.001,.14,.05,500);},
    bite:function(o,d,t){noise(o,d,t,'bandpass',1500,.7,.002,.45,.25);tone(o,d,t,1250,'triangle',.001,.25,.1);tone(o,d,t+.1,1650,'triangle',.001,.25,.12);},
    click:function(o,d,t){noise(o,d,t,'highpass',3200,1,.001,.14,.012);},
    catch:function(o,d,t){noise(o,d,t,'bandpass',1400,.7,.002,.3,.2);arp(o,d,t+.05,['G5','B5','D6','G6'],.07,'xylo',.42);},
    boot:function(o,d,t){tone(o,d,t,320,'triangle',.002,.4,.25,150);tone(o,d,t+.28,260,'triangle',.002,.35,.3,110);},
    escape:function(o,d,t){tone(o,d,t,620,'sine',.01,.25,.45,190);},
    // 露營
    log:function(o,d,t){tone(o,d,t,150,'triangle',.002,.5,.12,75);noise(o,d,t,'lowpass',700,1,.001,.3,.07);},
    puff:function(o,d,t){noise(o,d,t,'lowpass',300,.8,.04,.3,.35,1600);},
    yum:function(o,d,t,g){noise(o,d,t,'bandpass',1200,1,.002,.18,.04);arp(o,d,t+.05,g?['E6','G6','C7']:['E6','C6'],.08,'xylo',.35);},
    burnt:function(o,d,t){noise(o,d,t,'highpass',2800,.7,.05,.22,.55);tone(o,d,t,180,'sawtooth',.01,.06,.4,90);},
    wind:function(o,d,t){noise(o,d,t,'bandpass',380,1.4,.6,.28,1.4,900);},
    // 溫泉：挖到的溫度越高，叮的聲音越高
    dig:function(o,d,t){noise(o,d,t,'bandpass',1900,.6,.004,.42,.11,700);noise(o,d,t+.11,'bandpass',1500,.6,.004,.3,.1,600);},
    temp:function(o,d,t,c){var f=260*Math.pow(2,((c==null?10:c)+30)/26);INST.box(o,d,t,f,.3,.35);if(c<4)tone(o,d,t+.05,f*1.5,'sine',.002,.06,.25);},
    treasure:function(o,d,t){arp(o,d,t,['E6','G6','B6','E7'],.06,'box',.3);},
    spring:function(o,d,t){noise(o,d,t,'bandpass',1200,.7,.003,.45,.35);for(var i=0;i<7;i++)tone(o,d,t+.15+i*.07,500+Math.random()*700,'sine',.002,.09,.07,1500+Math.random()*900);arp(o,d,t+.2,['C6','E6','G6','C7'],.09,'bell',.25);},
    // 摩托車
    jump:function(o,d,t){tone(o,d,t,300,'triangle',.004,.28,.16,760);},
    land:function(o,d,t){tone(o,d,t,110,'sine',.001,.35,.08,55);noise(o,d,t,'lowpass',380,1,.001,.14,.05);},
    coin:function(o,d,t){tone(o,d,t,988,'triangle',.001,.3,.05);tone(o,d,t+.055,1319,'triangle',.001,.3,.18);},
    fishup:function(o,d,t){arp(o,d,t,['C6','E6','G6','C7'],.045,'xylo',.38);},
    bump:function(o,d,t){noise(o,d,t,'lowpass',1300,1,.001,.5,.25,200);tone(o,d,t,140,'sine',.001,.5,.25,45);},
    crash:function(o,d,t){SFX.bump(o,d,t);noise(o,d,t+.12,'bandpass',2500,1,.002,.25,.4,900);tone(o,d,t+.2,520,'triangle',.01,.18,.6,130);},
    // 爬樓梯：踩台階彈一下、彈簧、雪階塌掉、掉下去
    hop:function(o,d,t){tone(o,d,t,380,'sine',.003,.18,.12,720);},
    boing:function(o,d,t){tone(o,d,t,220,'triangle',.004,.35,.38,1200);tone(o,d,t+.02,440,'sine',.004,.12,.3,1700);},
    crack:function(o,d,t){noise(o,d,t,'bandpass',1400,.7,.002,.4,.18,500);tone(o,d,t,160,'triangle',.001,.2,.1,90);},
    fall:function(o,d,t){tone(o,d,t,900,'sine',.01,.22,.9,150);}
  };

  // 第一次點畫面才開聲音（iPhone 規定）
  function ensure(){
    if(!on())return;
    if(!ctx){
      try{if(navigator.audioSession)navigator.audioSession.type='ambient';}catch(e){}
      var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
      try{ctx=new AC();}catch(e){return;}out=chain(ctx);
      // resume 是非同步的：真的開始跑了才放配樂
      ctx.onstatechange=function(){if(ctx.state==='running'&&want&&!cur&&on())startTrack(want);};
    }
    if(ctx.state!=='running')ctx.resume();
    if(want&&!cur)startTrack(want);
  }
  ['pointerdown','pointerup','touchend','click','keydown'].forEach(function(ev){addEventListener(ev,ensure,true);});
  document.addEventListener('visibilitychange',function(){if(!ctx)return;if(document.hidden)ctx.suspend();else if(on())ctx.resume();});

  // 工具列上的 🔊／🔇
  function paint(){var b=document.querySelector('.g-snd');if(b){var v=on();b.textContent=v?'🔊':'🔇';b.classList.toggle('off',!v);b.setAttribute('aria-label',v?'關掉聲音':'打開聲音');}}
  function button(){
    var bar=document.querySelector('.g-bar');if(!bar||bar.querySelector('.g-snd'))return;
    var b=document.createElement('button');b.className='g-snd';b.type='button';
    var t=bar.querySelector('.g-title');if(t&&t.nextSibling)bar.insertBefore(b,t.nextSibling);else bar.appendChild(b);
    b.addEventListener('click',function(){var v=!on();setOn(v);paint();if(v){ensure();if(ctx&&ctx.state==='running'){if(want&&!cur)startTrack(want);SFX.tap(out,out.fx,ctx.currentTime);}}else stopTrack();});
    paint();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',button);else button();

  // 預覽用：在離線環境把一段配樂（或一串音效）算成聲音
  function render(name,sec,fxList){
    var sr=32000,oc=new OfflineAudioContext(1,Math.round(sr*sec),sr),o=chain(oc);
    if(name){var tr=TR[name];parse(tr);var sd=60/tr.bpm/2,t=.1,s=0;while(t<sec-.5){playStep(o,tr,s,t+(s%2?sd*(tr.sw||0):0),sd);t+=sd;s=(s+1)%tr.len;}if(tr.amb)ambient(o,.05,sec-.3,.55);o.music.gain.setValueAtTime(MUSIC,sec-1.2);o.music.gain.linearRampToValueAtTime(0,sec-.2);}
    (fxList||[]).forEach(function(x){SFX[x[1]](o,o.fx,x[0],x[2]);});
    return oc.startRendering();
  }

  return {
    music:function(name){want=name||null;if(!name)return stopTrack();if(!ctx||!on())return;if(ctx.state==='running')startTrack(name);else ctx.resume();},
    stop:function(){want=null;stopTrack();},
    sfx:function(name,arg){if(!ctx||!on()||ctx.state!=='running'||!SFX[name])return;SFX[name](out,out.fx,ctx.currentTime+.005,arg);},
    tempo:function(m){tempo=m>0?m:1;},
    level:function(v){level=Math.max(0,Math.min(1,v));},
    on:on,render:render,tracks:TR
  };
})();

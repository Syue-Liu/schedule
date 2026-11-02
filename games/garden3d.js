/* 記憶小森林的 3D 花園（three.js 0.160）：浮在天上的小島，中間六塊土，長大的植物圍成一圈森林，三隻寵物在島上散步。
   拖曳轉一圈、兩指（或滑鼠滾輪）拉近拉遠；點土種樹、點植物澆水、點森林裡的樹看回憶。天空跟著現在幾點變，晚上有星星和螢火蟲。
   garden.html 用法：Garden3D.init(盒子, {plot(slot), plant(id), tree(id)}) → update({slots, forest}) → water(id)、hop()。
   植物的種類、顏色、要長多少都用 garden.html 的 SP。 */
var Garden3D=(function(){
  var SRC='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
  var T=null,R,scene,cam,box,hooks,clock,GM,mats={},geos={},cloudMat,dropMat;
  var plots=[],trees={},pets=[],fx=[],stars,flies=[],clouds,sun,hemi,skyAt=0,night=0;
  var az=.45,el=.62,rad=0,fitR=-1,tgt,ptrs={},pinch0=0,rad0=0,down=null,idleAt=0,running=false,vis=true;
  // 六塊土：後排 0～2、前排 3～5
  var PLOT=[[-2.5,-1.4],[0,-1.4],[2.5,-1.4],[-2.5,1.4],[0,1.4],[2.5,1.4]];
  var LEAF='#9CCB85',LEAF2='#7FB36E',TRUNK='#B98B6B',SOIL='#9C7258',GRASS='#A7CF8E',PS=1.45; // PS：植物整體放大

  /* ── 小工具：卡通材質（三階明暗）、共用的形狀 ── */
  function M(c){if(!mats[c])mats[c]=new T.MeshToonMaterial({color:new T.Color(c),gradientMap:GM});return mats[c];}
  function mesh(g,c,x,y,z){var m=new T.Mesh(g,typeof c==='string'?M(c):c);m.position.set(x||0,y||0,z||0);m.castShadow=true;m.receiveShadow=true;return m;}
  function ball(r,d){var k='b'+r+'_'+d;return geos[k]||(geos[k]=new T.IcosahedronGeometry(r,d==null?1:d));}
  function cyl(a,b,h,s){var k='c'+[a,b,h,s];return geos[k]||(geos[k]=new T.CylinderGeometry(a,b,h,s||8));}
  function cone(r,h,s){var k='k'+[r,h,s];return geos[k]||(geos[k]=new T.ConeGeometry(r,h,s||8));}
  function rnd(i){var x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);}

  /* ── 植物：照種類和階段（0 種子～4 長大）用簡單的形狀拼 ── */
  function stem(g,h,r,x,z,tilt){var s=mesh(cyl(r*.8,r,h,6),LEAF2,x||0,h/2,z||0);if(tilt){s.rotation.z=tilt;s.position.x+=Math.sin(-tilt)*h/2;}g.add(s);}
  function leaf(g,y,ang,s){var l=mesh(ball(.16),LEAF);l.scale.set(s,.26*s,.5*s);l.position.set(Math.cos(ang)*.14*s,y,Math.sin(ang)*.14*s);l.rotation.set(0,-ang,.5);g.add(l);}
  function leaves(g,ys,s){ys.forEach(function(y,i){leaf(g,y,i*2.1,s);leaf(g,y-.03,i*2.1+Math.PI,s*.9);});}
  function sunflower(g,y,k,c){var h=new T.Group();h.add(mesh(cyl(.19,.19,.08,12),'#8C6A55'));for(var i=0;i<12;i++){var a=i*Math.PI/6,p=mesh(ball(.1),c);p.scale.set(1.1,.25,.5);p.position.set(Math.cos(a)*.27,0,Math.sin(a)*.27);p.rotation.y=-a;h.add(p);}h.rotation.x=1.05;h.position.y=y;h.scale.setScalar(k);g.add(h);}
  function tulip(g,y,k,c){var h=new T.Group();for(var i=0;i<3;i++){var a=i*Math.PI*2/3,p=mesh(ball(.13),c);p.scale.set(.75,1.35,.75);p.position.set(Math.cos(a)*.07,0,Math.sin(a)*.07);p.rotation.set(Math.sin(a)*.25,0,-Math.cos(a)*.25);h.add(p);}h.position.y=y;h.scale.setScalar(k);g.add(h);}
  function plant(sp,stage){var w=new T.Group(),g=model(sp,stage);g.scale.setScalar(PS);w.add(g);return w;}
  function model(sp,stage){
    var S=window.SP[sp],g=new T.Group();
    if(stage===0){var sd=mesh(ball(.12),'#E2B88E',0,.06,0);sd.scale.y=.7;g.add(sd);return g;}
    if(stage===1){stem(g,.38,.035);leaf(g,.36,0,.9);leaf(g,.34,Math.PI,.9);return g;}
    if(S.kind==='flower'){
      if(sp==='lavender'){var H=[0,0,.75,1,1.15][stage],col=stage===2?LEAF:S.c;[-.12,0,.12].forEach(function(dx,i){var hh=H-(i===1?0:.12),st=new T.Group();stem(st,hh,.025);for(var j=0;j<6;j++){var b=mesh(ball(.055,0),col,(j%2?.03:-.03),hh-.04-j*.07,0);st.add(b);}st.position.x=dx;st.rotation.z=-dx*1.4;g.add(st);});leaf(g,.15,0,.8);leaf(g,.13,Math.PI,.8);return g;}
      if(sp==='succulent'){var k2=[0,0,.6,.8,1][stage];for(var i=0;i<8;i++){var a=i*Math.PI/4,l=mesh(ball(.14),S.c);l.scale.set(.5,.32,1.2);l.position.set(Math.cos(a)*.18*k2,.08,Math.sin(a)*.18*k2);l.rotation.set(0,-a+Math.PI/2,0);l.rotateX(-.55);l.scale.multiplyScalar(k2);g.add(l);}for(var j=0;j<5;j++){var b2=j*Math.PI*2/5+.3,m2=mesh(ball(.1),S.c);m2.scale.set(.5,.4,1);m2.position.set(Math.cos(b2)*.07*k2,.16*k2,Math.sin(b2)*.07*k2);m2.rotation.set(0,-b2+Math.PI/2,0);m2.rotateX(-1);m2.scale.multiplyScalar(k2);g.add(m2);}if(stage===4){stem(g,.5,.02);g.add(mesh(ball(.07),'#F8C8D4',0,.52,0));}return g;}
      var h2=[0,0,.75,1,1.2][stage];stem(g,h2,.04);leaves(g,stage===2?[.3,.5]:[.3,.55,.8],stage===2?.9:1);
      if(stage===2)g.add(mesh(ball(.1),sp==='sunflower'?LEAF:S.c,0,h2+.04,0));
      else if(sp==='sunflower')sunflower(g,h2+.05,stage===3?.7:1,S.c);
      else tulip(g,h2+.1,stage===3?.75:1,S.c);
      return g;
    }
    // 樹：樹幹＋樹冠（圓的、扇形的銀杏、一層一層的松樹）；長大了換成那種樹的顏色、掛上花或果子
    var k=[0,0,.5,.8,1][stage],Ht=[0,0,.5,.8,1][stage],col2=stage===4||S.shape==='pine'?S.c:LEAF;
    g.add(mesh(cyl(.09*k+.02,.15*k+.02,Ht,7),TRUNK,0,Ht/2,0));
    var spots=[];
    if(S.shape==='pine'){[[.75,.85,.25],[.58,.75,.75],[.4,.62,1.18]].forEach(function(c){var m=mesh(cone(c[0]*k,c[1]*k,8),col2,0,Ht+c[2]*k,0);g.add(m);});
      if(stage===4){[[.25,.62],[.7,.45],[1.12,.3]].forEach(function(c){var sn=mesh(cone(c[1]*.55,.18,8),'#FFFFFF',0,Ht+c[0]+.42,0);g.add(sn);});var st2=mesh(new T.OctahedronGeometry(.13),'#F6D27A',0,Ht+1.62,0);g.add(st2);}
      return g;}
    if(S.shape==='fan'){var f=mesh(cone(.8*k,1.05*k,7),col2,0,Ht+.48*k,0);f.rotation.x=Math.PI;f.scale.z=.45;g.add(f);spots=[[-.35,.75,.15],[.3,.8,.15],[0,.95,.18],[-.15,.55,.2],[.2,.6,-.2]];}
    else{[[0,.5,0,.62],[-.4,.25,.12,.46],[.4,.27,-.08,.46],[0,.3,-.36,.44],[.05,.28,.38,.42]].forEach(function(c){g.add(mesh(ball(c[3]*k),col2,c[0]*k,Ht+c[1]*k,c[2]*k));});
      for(var i2=0;i2<10;i2++){var a2=i2*2.39996,yy=.15+rnd(i2+3)*.75;spots.push([Math.cos(a2)*.55*(1-yy*.3),yy+.08,Math.sin(a2)*.55*(1-yy*.3)]);}}
    if(stage===4&&S.dot){var r=sp==='cherry'||sp==='maple'||sp==='ginkgo'?.06:.085;spots.forEach(function(p){var o=new T.Vector3(p[0],0,p[2]).normalize();g.add(mesh(ball(r,0),S.dot,p[0]+o.x*.08,Ht+p[1]*k,p[2]+o.z*.08));});}
    return g;
  }
  // 植物最高點（世界座標的高度）：標籤放在上面
  function height(g){return new T.Box3().setFromObject(g).max.y;}

  /* ── 標籤：名字＋長大進度（畫在小畫布上，永遠看得到） ── */
  function label(){var c=document.createElement('canvas');c.width=320;c.height=120;var t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;var s=new T.Sprite(new T.SpriteMaterial({map:t,transparent:true,depthTest:false}));s.renderOrder=10;s.center.set(.5,0);s.scale.set(2.7,1.01,1);s.userData={c:c,t:t,key:''};return s;}
  function rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath();}
  function drawLabel(s,o){
    var key=JSON.stringify(o);if(s.userData.key===key)return;s.userData.key=key;
    var c=s.userData.c,x=c.getContext('2d');x.clearRect(0,0,320,120);
    x.font='30px Huninn, "PingFang TC", sans-serif';var tw=Math.min(296,Math.max(150,x.measureText(o.text).width+44)),l=(320-tw)/2;
    x.globalAlpha=o.empty?.82:1;rr(x,l,6,tw,52,26);x.fillStyle=o.ready?'#FDF2D2':'#FFFCF6';x.fill();x.lineWidth=5;x.strokeStyle='#594C43';x.stroke();
    x.fillStyle=o.empty?'#8C6A55':'#3E3A39';x.textAlign='center';x.textBaseline='middle';x.fillText(o.text,160,33);
    if(o.frac!=null){rr(x,70,68,180,22,11);x.fillStyle='#FFFCF6';x.fill();x.lineWidth=4;x.stroke();if(o.frac>0){rr(x,72,70,Math.max(18,176*o.frac),18,9);x.fillStyle=o.thirsty?'#A8D3E6':'#7FB36E';x.fill();}}
    if(o.sub){x.font='22px Huninn, sans-serif';x.fillStyle='#3E7FA0';x.fillText(o.sub,160,108);}
    s.userData.t.needsUpdate=true;
  }

  /* ── 場景 ── */
  function build(){
    scene=new T.Scene();
    cam=new T.PerspectiveCamera(38,1,.1,200);tgt=new T.Vector3(0,.7,0);
    var d=new Uint8Array([110,190,255]);GM=new T.DataTexture(d,3,1,T.RedFormat);GM.minFilter=GM.magFilter=T.NearestFilter;GM.needsUpdate=true;
    hemi=new T.HemisphereLight('#FFFFFF','#8DBF7A',1.1);scene.add(hemi);
    sun=new T.DirectionalLight('#FFF4D6',1.6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);var sc=sun.shadow.camera;sc.left=sc.bottom=-9;sc.right=sc.top=9;sc.near=1;sc.far=40;sun.shadow.bias=-.0015;scene.add(sun);scene.add(sun.target);
    // 小島：上面是草地、下面是倒過來的土
    var top=mesh(new T.CylinderGeometry(6.4,6.25,.5,40),GRASS,0,-.25,0);top.castShadow=false;scene.add(top);
    scene.add(mesh(new T.CylinderGeometry(6.27,5.9,.5,40),'#C9A884',0,-.72,0));
    var under=mesh(new T.ConeGeometry(5.95,4.4,40),TRUNK,0,-3.17,0);under.rotation.x=Math.PI;scene.add(under);
    for(var i=0;i<7;i++){var a=i*.9+.4,rk=mesh(new T.DodecahedronGeometry(.25+rnd(i)*.25),'#C9C2BB',Math.cos(a)*(6.1-rnd(i+9)*.3),-.05,Math.sin(a)*(6.1-rnd(i+9)*.3));rk.scale.y=.6;scene.add(rk);}
    for(var j=0;j<26;j++){var b=j*2.39996,rr2=4.4+rnd(j+40)*1.6,fl=mesh(ball(.07,0),['#FFFFFF','#F8C8D4','#F6D27A','#B9A6DE'][j%4],Math.cos(b)*rr2,.04,Math.sin(b)*rr2);fl.castShadow=false;scene.add(fl);}
    // 六塊土（點的範圍做大一點、看不到）
    PLOT.forEach(function(p,i){
      var base=new T.Group();base.position.set(p[0],0,p[1]);scene.add(base);
      base.add(mesh(cyl(.62,.76,.18,16),SOIL,0,.07,0));
      var coll=new T.Mesh(cyl(.95,.95,3.4,8),M('#000000'));coll.position.y=1.6;coll.visible=false;coll.userData={slot:i};base.add(coll);
      var lab=label();lab.position.set(p[0],.6,p[1]);scene.add(lab);
      var pg=new T.Group();pg.position.y=.15;base.add(pg);
      plots.push({i:i,x:p[0],z:p[1],base:base,holder:pg,coll:coll,lab:lab,key:'',id:null,stage:-1,top:.3,pop:1,sc:1,spk:[]});
    });
    // 雲：繞著小島慢慢飄
    cloudMat=new T.MeshToonMaterial({color:'#FFFFFF',gradientMap:GM,transparent:true,opacity:.95});
    clouds=new T.Group();for(var c=0;c<7;c++){var cg=new T.Group(),ca=c*.9+rnd(c)*.5,cr=10+rnd(c+20)*4;[[0,0,0,.9],[.8,-.15,.1,.65],[-.8,-.1,0,.7],[.2,.3,-.2,.6]].forEach(function(q){var m=new T.Mesh(ball(q[3],1),cloudMat);m.position.set(q[0],q[1],q[2]);cg.add(m);});cg.position.set(Math.cos(ca)*cr,-2.5+rnd(c+5)*5,Math.sin(ca)*cr);cg.scale.setScalar(.8+rnd(c+1)*.6);clouds.add(cg);}scene.add(clouds);
    dropMat=new T.MeshBasicMaterial({color:'#7FC4E4'});
    // 星星、螢火蟲（晚上才看得到）
    var sp=[];for(var k=0;k<320;k++){var u=rnd(k+100)*Math.PI*2,v=.08+rnd(k+700)*.9,R0=60;sp.push(Math.cos(u)*Math.cos(v)*R0,Math.sin(v)*R0-6,Math.sin(u)*Math.cos(v)*R0);}
    var sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(sp,3));
    stars=new T.Points(sg,new T.PointsMaterial({color:'#FFF4D6',size:.5,transparent:true,opacity:0,depthWrite:false,fog:false}));scene.add(stars);
    for(var f=0;f<12;f++){var fm=new T.Mesh(ball(.05,0),new T.MeshBasicMaterial({color:'#FFF2A0',transparent:true,opacity:0}));fm.userData={a:rnd(f)*6.28,r:1.5+rnd(f+3)*3.4,y:.5+rnd(f+6)*1.4,s:.3+rnd(f+8)*.5};scene.add(fm);flies.push(fm);}
    sky();
  }
  // 天空：跟著現在幾點（清晨粉橘、白天藍、黃昏橘、晚上深藍）
  var SKY=[[0,'#2A3563','#B4C6F0',.75,.95],[5,'#2E3968','#B4C6F0',.75,.95],[6.5,'#F6C9B4','#FFD9B0',1.1,1],[9,'#BFE3F2','#FFF4D6',1.7,1.15],[16,'#BFE3F2','#FFF4D6',1.7,1.15],[18,'#F3B28C','#FFB98A',1.2,1],[19.5,'#4F5F92','#C9B8F0',.85,.9],[21,'#2A3563','#B4C6F0',.75,.95],[24,'#2A3563','#B4C6F0',.75,.95]];
  function sky(){
    var t=new Date(),h=t.getHours()+t.getMinutes()/60,i=1;while(i<SKY.length-1&&h>=SKY[i][0])i++;
    var A=SKY[i-1],B=SKY[i],k=(h-A[0])/(B[0]-A[0]),bg=new T.Color(A[1]).lerp(new T.Color(B[1]),k),lc=new T.Color(A[2]).lerp(new T.Color(B[2]),k);
    scene.background=bg;scene.fog=new T.Fog(bg,30,70);
    sun.color=lc;sun.intensity=A[3]+(B[3]-A[3])*k;hemi.intensity=A[4]+(B[4]-A[4])*k;hemi.color=new T.Color('#FFFFFF').lerp(bg,.25);
    var ang=(h-6)/12*Math.PI;sun.position.set(Math.cos(ang)*12,Math.max(4,Math.sin(Math.abs(ang))*14+4),6);
    night=h<5.5||h>19.5?1:h<6.5?(6.5-h):h>18.5?(h-18.5):0;night=Math.max(0,Math.min(1,night));
    stars.material.opacity=night;pets.forEach(function(p){p.spr.material.color=new T.Color('#FFFFFF').lerp(new T.Color('#8C96B8'),night*.7);});
  }

  /* ── 三隻寵物：在土和森林中間那一圈散步，偶爾停下來 ── */
  function tex(src){return new Promise(function(ok){var im=new Image();im.onload=function(){var c=document.createElement('canvas');c.width=256;c.height=Math.round(256*im.height/im.width);c.getContext('2d').drawImage(im,0,0,c.width,c.height);var t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;ok({t:t,a:im.height/im.width});};im.onerror=function(){ok(null);};im.src=src;});}
  function addPets(){
    return Promise.all(['cat','pg','dg'].map(function(k,i){
      return Promise.all(['walk-a','walk-b','happy'].map(function(p){return tex(G.petImg(k,p));})).then(function(ts){
        if(!ts[2])return;
        var spr=new T.Sprite(new T.SpriteMaterial({map:ts[2].t,transparent:true}));spr.center.set(.5,.04);var H=k==='pg'?.95:1.1;spr.scale.set(H/ts[2].a,H,1);
        var sh=new T.Mesh(new T.CircleGeometry(.36,16),new T.MeshBasicMaterial({color:'#000000',transparent:true,opacity:.16,depthWrite:false}));sh.rotation.x=-Math.PI/2;
        scene.add(spr);scene.add(sh);
        pets.push({k:k,spr:spr,sh:sh,ts:ts,H:H,ang:i*2.1+.6,r:4.1,ta:i*2.1+.6,wait:1+i,walkT:0,hop:0,flip:false,cur:2});
      });
    }));
  }
  function setTex(p,n){var t=p.ts[n]||p.ts[2];if(p.cur===n&&!p.dirty)return;p.cur=n;p.dirty=false;t.t.repeat.x=p.flip?-1:1;t.t.offset.x=p.flip?1:0;p.spr.material.map=t.t;p.spr.material.needsUpdate=true;p.spr.scale.set(p.H/t.a,p.H,1);}
  function movePets(dt){
    var right=new T.Vector3().setFromMatrixColumn(cam.matrixWorld,0);
    pets.forEach(function(p){
      if(p.wait>0){p.wait-=dt;setTex(p,2);if(p.wait<=0){p.ta=p.ang+(rnd(p.ang*7+Date.now()%97)-.5)*2.4;}}
      else{var d=p.ta-p.ang,st=.45/p.r*dt;if(Math.abs(d)<st){p.ang=p.ta;p.wait=1.5+Math.random()*3;}else{var x0=Math.cos(p.ang),z0=Math.sin(p.ang);p.ang+=Math.sign(d)*st;var v=new T.Vector3(Math.cos(p.ang)-x0,0,Math.sin(p.ang)-z0),fl=v.dot(right)<0;if(fl!==p.flip){p.flip=fl;p.dirty=true;}p.walkT+=dt;setTex(p,Math.floor(p.walkT/.18)%2);}}
      var y=0;if(p.hop>0){p.hop=Math.max(0,p.hop-dt);y=Math.sin((1-p.hop/.5)*Math.PI)*.5;}
      var x=Math.cos(p.ang)*p.r,z=Math.sin(p.ang)*p.r;p.spr.position.set(x,y,z);p.sh.position.set(x,.02,z);p.sh.scale.setScalar(1-y*.6);
    });
  }
  function hop(k){var list=k?pets.filter(function(p){return p.k===k;}):[pets[Math.floor(Math.random()*pets.length)]];list.forEach(function(p){if(p&&p.hop<=0)p.hop=.5;});}

  /* ── 森林：長大的植物一圈一圈排在小島外圍 ── */
  function forestSpot(i){var ring=i<16?0:1,n=ring?20:16,j=ring?(i-16)%20:i,r=ring?5.75:5.0,a=j*(Math.PI*2/n)+(ring?.16:0)+.1;return {x:Math.cos(a)*r,z:Math.sin(a)*r,ry:rnd(i+50)*6.28};}
  function setForest(list){
    var keep={};
    list.forEach(function(f,i){
      keep[f.id]=1;if(trees[f.id]&&trees[f.id].i===i)return;
      if(trees[f.id])scene.remove(trees[f.id].g);
      var g=new T.Group(),p=forestSpot(i),pl=plant(f.sp,4),fw=window.SP[f.sp].kind==='flower';
      pl.scale.setScalar(fw?.85:.72);g.add(pl);g.position.set(p.x,0,p.z);g.rotation.y=p.ry;
      var coll=new T.Mesh(cyl(.7,.7,3,8),M('#000000'));coll.position.y=1.4;coll.visible=false;coll.userData={tree:f.id};g.add(coll);
      scene.add(g);trees[f.id]={g:g,i:i,born:trees[f.id]?1:0};
    });
    Object.keys(trees).forEach(function(id){if(!keep[id]){scene.remove(trees[id].g);delete trees[id];}});
  }

  /* ── 特效：澆水的小雨雲、水滴、漣漪；長大彈一下＋星星 ── */
  function addFx(o){o.t=0;fx.push(o);}
  function rain(p){
    var g=new T.Group();[[0,0,0,.32],[.32,-.05,.05,.24],[-.32,-.04,0,.26],[.1,.12,-.12,.22]].forEach(function(c){var m=new T.Mesh(ball(c[3],1),cloudMat);m.position.set(c[0],c[1],c[2]);g.add(m);});
    var y=p.top+1.1;g.position.set(p.x,y,p.z);g.scale.setScalar(.01);scene.add(g);
    addFx({dur:1.5,up:function(f){var k=f.t/f.dur;g.scale.setScalar(k<.15?k/.15:k>.85?(1-k)/.15:1);if(k>.1&&k<.75&&Math.random()<.55)drop(p.x+(Math.random()-.5)*.6,y-.18,p.z+(Math.random()-.5)*.4);},end:function(){scene.remove(g);}});
  }
  function drop(x,y,z){
    var m=new T.Mesh(ball(.045,0),dropMat);m.scale.set(1,1.7,1);m.position.set(x,y,z);scene.add(m);var v=0;
    addFx({dur:2,up:function(f,dt){v+=10*dt;m.position.y-=v*dt;if(m.position.y<.22){f.t=f.dur;if(Math.random()<.45)ripple(x,z);}},end:function(){scene.remove(m);}});
  }
  function ripple(x,z){
    var m=new T.Mesh(new T.RingGeometry(.06,.1,18),new T.MeshBasicMaterial({color:'#A8D3E6',transparent:true,opacity:.9,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,.2,z);scene.add(m);
    addFx({dur:.55,up:function(f){var k=f.t/f.dur;m.scale.setScalar(1+k*4);m.material.opacity=.9*(1-k);},end:function(){scene.remove(m);m.geometry.dispose();m.material.dispose();}});
  }
  function burst(x,y,z,n,col){
    for(var i=0;i<n;i++)(function(i){var m=new T.Mesh(new T.OctahedronGeometry(.07),new T.MeshBasicMaterial({color:col||'#F6D27A',transparent:true}));m.position.set(x,y,z);scene.add(m);var a=i/n*Math.PI*2,vx=Math.cos(a)*1.4,vz=Math.sin(a)*1.4,vy=1.6+Math.random();
      addFx({dur:.8,up:function(f,dt){vy-=4*dt;m.position.x+=vx*dt;m.position.z+=vz*dt;m.position.y+=vy*dt;m.rotation.y+=dt*6;m.material.opacity=1-f.t/f.dur;},end:function(){scene.remove(m);m.geometry.dispose();m.material.dispose();}});})(i);
  }
  function pop(p){p.pop=0;burst(p.x,p.top*.8+.2,p.z,8);}

  /* ── 鏡頭：拖曳轉、兩指拉近；沒人動的時候自己慢慢轉 ── */
  function place(){var x=Math.cos(el)*Math.sin(az),y=Math.sin(el),z=Math.cos(el)*Math.cos(az);cam.position.set(tgt.x+x*rad,tgt.y+y*rad,tgt.z+z*rad);cam.lookAt(tgt);}
  function bind(cv){
    cv.addEventListener('pointerdown',function(e){ptrs[e.pointerId]={x:e.clientX,y:e.clientY};try{cv.setPointerCapture(e.pointerId);}catch(_){}idleAt=Date.now();var ids=Object.keys(ptrs);if(ids.length===1)down={x:e.clientX,y:e.clientY,t:Date.now(),moved:0};else{down=null;pinch0=dist();rad0=rad;}});
    cv.addEventListener('pointermove',function(e){var p=ptrs[e.pointerId];if(!p)return;var dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;idleAt=Date.now();
      var ids=Object.keys(ptrs);if(ids.length>=2){var d=dist();if(pinch0)rad=Math.max(10,Math.min(34,rad0*pinch0/d));return;}
      az-=dx*.009;el=Math.max(.3,Math.min(1.12,el+dy*.005));if(down)down.moved+=Math.abs(dx)+Math.abs(dy);});
    function up(e){var d=down;delete ptrs[e.pointerId];if(Object.keys(ptrs).length<2)pinch0=0;if(d&&d.moved<10&&Date.now()-d.t<600)pick(e);down=null;}
    cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',function(e){delete ptrs[e.pointerId];down=null;pinch0=0;});
    cv.addEventListener('wheel',function(e){e.preventDefault();rad=Math.max(10,Math.min(34,rad*(1+e.deltaY*.001)));idleAt=Date.now();},{passive:false});
  }
  function dist(){var p=Object.keys(ptrs).map(function(k){return ptrs[k];});return p.length<2?1:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}
  // 點到什麼：土 → 種、植物 → 澆水卡片、森林的樹 → 回憶、寵物 → 跳一下
  function pick(e){
    var r=R.domElement.getBoundingClientRect(),v=new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),ray=new T.Raycaster();ray.setFromCamera(v,cam);
    var ph=ray.intersectObjects(pets.map(function(p){return p.spr;}))[0];if(ph){var pp=pets.filter(function(p){return p.spr===ph.object;})[0];if(pp){pp.hop=.5;SND.sfx('pop');}return;}
    var objs=plots.map(function(p){return p.coll;});Object.keys(trees).forEach(function(id){objs.push(trees[id].g.children[1]);});
    var h=ray.intersectObjects(objs)[0];if(!h)return;var u=h.object.userData;
    if(u.tree)hooks.tree(u.tree);else if(u.plant)hooks.plant(u.plant);else if(u.slot!=null)hooks.plot(u.slot);
  }

  /* ── 每一格 ── */
  function tick(dt){
    if(Date.now()-idleAt>6000)az+=dt*.05;
    place();
    if(Date.now()-skyAt>20000){skyAt=Date.now();sky();}
    clouds.rotation.y+=dt*.012;
    movePets(dt);
    plots.forEach(function(p){
      if(p.pop<1){p.pop=Math.min(1,p.pop+dt/.5);}
      var b=p.pop<1?1+.28*Math.sin(p.pop*Math.PI)*(1-p.pop*.4):1;p.holder.scale.setScalar(p.sc*b);
      p.spk.forEach(function(s,i){var a=Date.now()/700+i*Math.PI/2;s.position.set(p.x+Math.cos(a)*.55,p.top*.85+.1+Math.sin(a*1.7)*.12,p.z+Math.sin(a)*.55);s.rotation.y+=dt*3;});
    });
    flies.forEach(function(f){var u=f.userData;u.a+=dt*u.s;f.position.set(Math.cos(u.a)*u.r,u.y+Math.sin(u.a*2.3)*.25,Math.sin(u.a)*u.r);f.material.opacity=night*(.55+.45*Math.sin(u.a*5));});
    for(var i=fx.length-1;i>=0;i--){var f=fx[i];f.t+=dt;f.up(f,dt);if(f.t>=f.dur){if(f.end)f.end();fx.splice(i,1);}}
  }
  function loop(){if(!running)return;requestAnimationFrame(loop);if(!vis||document.hidden){clock.getDelta();return;}var dt=Math.min(.05,clock.getDelta());tick(dt);R.render(scene,cam);}
  // 畫面變大小：直的畫面比較窄，鏡頭退遠一點讓整座島放得下
  function fit(){var a=cam.aspect,t=Math.tan(cam.fov*Math.PI/360)*Math.min(1,a);return Math.max(17,Math.min(24,6.2/t));}
  function size(){var w=box.clientWidth||300,h=box.clientHeight||300,f0=rad===fitR;R.setSize(w,h,false);cam.aspect=w/h;cam.fov=w/h<.8?44:36;cam.updateProjectionMatrix();fitR=fit();if(f0||!rad)rad=fitR;}

  /* ── 給 garden.html 用的 ── */
  function init(el0,hk){
    box=el0;hooks=hk;
    return import(SRC).then(function(m){
      T=m;
      var cv=document.createElement('canvas');box.insertBefore(cv,box.firstChild);
      R=new T.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'low-power'});
      if(!R.getContext())throw new Error('no webgl');
      R.setPixelRatio(Math.min(2,window.devicePixelRatio||1));R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;
      build();bind(cv);size();
      if(window.ResizeObserver)new ResizeObserver(size).observe(box);else addEventListener('resize',size);
      if(window.IntersectionObserver)new IntersectionObserver(function(es){vis=es[0].isIntersecting;}).observe(box);
      clock=new T.Clock();running=true;rad=fitR;place();loop();
      return addPets();
    });
  }
  // st.slots：六格，每格 null 或 {id, sp, stage, frac, r, name, ready, thirsty}；st.forest：[{id, sp}]（舊的在前）
  function update(st){
    if(!T)return;
    st.slots.forEach(function(s,i){
      var p=plots[i],key=s?[s.id,s.sp,s.stage].join(':'):'';
      if(key!==p.key){
        var grew=s&&(p.id===s.id?s.stage>p.stage:p.key==='');
        p.key=key;p.id=s?s.id:null;p.stage=s?s.stage:-1;
        while(p.holder.children.length)p.holder.remove(p.holder.children[0]);
        if(s){p.holder.add(plant(s.sp,s.stage));p.holder.scale.setScalar(1);p.top=height(p.holder);if(grew)pop(p);}else p.top=.3;
        p.coll.userData=s?{plant:s.id}:{slot:i};
      }
      p.sc=s&&s.stage>0?.9+.1*(s.frac||0):1;
      p.holder.rotation.z=s&&s.thirsty?.17:0;
      // 長大了：旁邊繞著四顆小星星
      var want=s&&s.ready?4:0;
      while(p.spk.length<want){var m=new T.Mesh(new T.OctahedronGeometry(.08),new T.MeshBasicMaterial({color:'#F6D27A'}));scene.add(m);p.spk.push(m);}
      while(p.spk.length>want){scene.remove(p.spk.pop());}
      drawLabel(p.lab,s?{text:(s.ready?'✨ ':'')+s.name,frac:s.r,ready:s.ready,thirsty:s.thirsty,sub:s.thirsty?'口渴了…':''}:{text:'＋ 種一棵',empty:true});
      p.lab.position.y=(s?p.top+.3:.45);
    });
    setForest(st.forest||[]);
  }
  function water(id){var p=plots.filter(function(q){return q.id===id;})[0];if(!p)return;rain(p);hop();}
  // 測試用：某一格／森林某棵樹在畫面上的位置、現在有幾個特效
  function screen(o){var v=typeof o==='number'?new T.Vector3(PLOT[o][0],.5,PLOT[o][1]):trees[o]?trees[o].g.position.clone().setY(.8):null;if(!v)return null;v.project(cam);var r=R.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};}
  return {init:init,update:update,water:water,hop:hop,active:function(){return !!T&&running;},screen:screen,fxCount:function(){return fx.length;}};
})();

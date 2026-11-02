/* 記憶小森林的 3D 花園（three.js 0.160）
   地上的小島：一片花園空地，中間是土（花園升級最多 12 塊），外圍一圈森林、一圈沙土小路；一邊有小山，山腳的泉水流成小溪繞過花園、流進旁邊的小湖；
   外面是一直到地平線的草原、小山丘和樹，遠方一圈山脈。
   學和綾、三隻寵物在島上散步，偶爾走去摸摸寵物、跟對方打招呼；蝴蝶、蜜蜂、小鳥會飛來玩，害蟲會跑到植物上。
   拖曳轉一圈、兩指（或滾輪）拉近；點土種樹、點植物澆水、點害蟲抓走、點小鳥收禮物、點森林的樹看回憶。天空跟著現在幾點變。
   garden.html：Garden3D.init(盒子,{plot,plant,tree,pest,bird}) → update({slots,forest}) → water(id)、shoo(id)、hop()。
   植物的種類、顏色都用 garden.html 的 SP。 */
var Garden3D=(function(){
  var SRC='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
  var T=null,R,scene,cam,box,hooks,clock,GM,mats={},geos={},cloudMat,dropMat,waterMat,heartTex,hitMat;
  var plots=[],trees={},pets=[],people=[],visitors=[],fx=[],flecks=[],ducks=[],lake=null,stars,flies=[],clouds,sun,hemi,skyAt=0,night=0,nextVisit=0,spots=[],flow=[];
  var az=.45,el=.62,rad=0,fitR=-1,tgt,ptrs={},pinch0=0,rad0=0,down=null,idleAt=0,running=false,vis=true,now=0;
  // 小島半徑、散步的那一圈、小山在哪個方向、溪水往小湖流出去的方向
  var ISL=8.6,RING=[4.65,7.1],MT=-2.2,WF=-.15;
  // 十二塊土：中間六塊先開，升級再開前後、左右
  var PLOT=[[-2.2,-1.1],[0,-1.1],[2.2,-1.1],[-2.2,1.1],[0,1.1],[2.2,1.1],[-1.1,-3],[1.1,-3],[-1.1,3],[1.1,3],[-4.1,0],[4.1,0]];
  var LEAF='#9CCB85',LEAF2='#7FB36E',TRUNK='#B98B6B',SOIL='#9C7258',GRASS='#A7CF8E',WATER='#7FC4E4',PS=1.45;

  /* ── 小工具：卡通材質（三階明暗）、共用的形狀 ── */
  function M(c){if(!mats[c])mats[c]=new T.MeshToonMaterial({color:new T.Color(c),gradientMap:GM});return mats[c];}
  function mesh(g,c,x,y,z){var m=new T.Mesh(g,typeof c==='string'?M(c):c);m.position.set(x||0,y||0,z||0);m.castShadow=true;m.receiveShadow=true;return m;}
  function ball(r,d){var k='b'+r+'_'+d;return geos[k]||(geos[k]=new T.IcosahedronGeometry(r,d==null?1:d));}
  function cyl(a,b,h,s){var k='c'+[a,b,h,s];return geos[k]||(geos[k]=new T.CylinderGeometry(a,b,h,s||8));}
  function cone(r,h,s){var k='k'+[r,h,s];return geos[k]||(geos[k]=new T.ConeGeometry(r,h,s||8));}
  function rnd(i){var x=Math.sin(i*127.1+311.7)*43758.5453;return x-Math.floor(x);}
  function polar(r,a){return {x:Math.cos(a)*r,z:Math.sin(a)*r};}
  function hit(r,data){var m=new T.Mesh(ball(r,0),hitMat);m.visible=false;m.userData=data;return m;}
  function angDiff(a,b){var d=a-b;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;}

  /* ── 植物：照種類和階段（0 種子～4 長大）用簡單的形狀拼 ── */
  function stem(g,h,r){g.add(mesh(cyl(r*.8,r,h,6),LEAF2,0,h/2,0));}
  function leaf(g,y,ang,s){var l=mesh(ball(.16),LEAF);l.scale.set(s,.26*s,.5*s);l.position.set(Math.cos(ang)*.14*s,y,Math.sin(ang)*.14*s);l.rotation.set(0,-ang,.5);g.add(l);}
  function leaves(g,ys,s){ys.forEach(function(y,i){leaf(g,y,i*2.1,s);leaf(g,y-.03,i*2.1+Math.PI,s*.9);});}
  function petals(g,y,k,c,n,len,disk,dr){var h=new T.Group();h.add(mesh(cyl(dr,dr,.07,12),disk));for(var i=0;i<n;i++){var a=i*Math.PI*2/n,p=mesh(ball(.1),c);p.scale.set(len,.22,.45);p.position.set(Math.cos(a)*(dr+.085*len),0,Math.sin(a)*(dr+.085*len));p.rotation.y=-a;h.add(p);}h.rotation.x=1.05;h.position.y=y;h.scale.setScalar(k);g.add(h);}
  function tulip(g,y,k,c){var h=new T.Group();for(var i=0;i<3;i++){var a=i*Math.PI*2/3,p=mesh(ball(.13),c);p.scale.set(.75,1.35,.75);p.position.set(Math.cos(a)*.07,0,Math.sin(a)*.07);p.rotation.set(Math.sin(a)*.25,0,-Math.cos(a)*.25);h.add(p);}h.position.y=y;h.scale.setScalar(k);g.add(h);}
  function rose(g,y,k,c){var h=new T.Group();h.add(mesh(ball(.09),c));for(var i=0;i<5;i++){var a=i*1.2566,p=mesh(ball(.09),c);p.scale.set(1,.9,.55);p.position.set(Math.cos(a)*.08,-.02,Math.sin(a)*.08);p.rotation.y=-a+Math.PI/2;h.add(p);}for(var j=0;j<5;j++){var b=j*1.2566+.6,q=mesh(ball(.1),c);q.scale.set(1.1,.8,.5);q.position.set(Math.cos(b)*.14,-.05,Math.sin(b)*.14);q.rotation.y=-b+Math.PI/2;q.rotateX(.4);h.add(q);}h.position.y=y;h.scale.setScalar(k);g.add(h);}
  function hydra(g,y,k,c){var h=new T.Group();for(var i=0;i<14;i++){var u=i*2.39996,v=Math.acos(1-(i+.5)/14);h.add(mesh(ball(.075,0),i%3?c:'#C9B8F0',Math.sin(v)*Math.cos(u)*.2,Math.cos(v)*.16,Math.sin(v)*Math.sin(u)*.2));}h.position.y=y;h.scale.setScalar(k);g.add(h);}
  function head(sp,g,y,k,c){if(sp==='sunflower')petals(g,y,k,c,12,1.1,'#8C6A55',.19);else if(sp==='daisy')petals(g,y,k,c,12,.9,'#F6D27A',.1);else if(sp==='cosmos')petals(g,y,k,c,8,1.2,'#F6D27A',.08);else if(sp==='rose')rose(g,y,k,c);else if(sp==='hydrangea')hydra(g,y,k,c);else tulip(g,y+.05,k,c);}
  function plant(sp,stage){var w=new T.Group(),g=model(sp,stage);g.scale.setScalar(PS);w.add(g);return w;}
  function model(sp,stage){
    var S=window.SP[sp],g=new T.Group();
    if(stage===0){var sd=mesh(ball(.12),'#E2B88E',0,.06,0);sd.scale.y=.7;g.add(sd);return g;}
    if(stage===1){stem(g,.38,.035);leaf(g,.36,0,.9);leaf(g,.34,Math.PI,.9);return g;}
    if(S.kind==='flower'){
      if(sp==='lavender'){var H=[0,0,.75,1,1.15][stage],col=stage===2?LEAF:S.c;[-.12,0,.12].forEach(function(dx,i){var hh=H-(i===1?0:.12),st=new T.Group();stem(st,hh,.025);for(var j=0;j<6;j++)st.add(mesh(ball(.055,0),col,(j%2?.03:-.03),hh-.04-j*.07,0));st.position.x=dx;st.rotation.z=-dx*1.4;g.add(st);});leaf(g,.15,0,.8);leaf(g,.13,Math.PI,.8);return g;}
      if(sp==='succulent'){var k2=[0,0,.6,.8,1][stage];for(var i=0;i<8;i++){var a=i*Math.PI/4,l=mesh(ball(.14),S.c);l.scale.set(.5,.32,1.2);l.position.set(Math.cos(a)*.18*k2,.08,Math.sin(a)*.18*k2);l.rotation.set(0,-a+Math.PI/2,0);l.rotateX(-.55);l.scale.multiplyScalar(k2);g.add(l);}for(var j=0;j<5;j++){var b2=j*Math.PI*2/5+.3,m2=mesh(ball(.1),S.c);m2.scale.set(.5,.4,1);m2.position.set(Math.cos(b2)*.07*k2,.16*k2,Math.sin(b2)*.07*k2);m2.rotation.set(0,-b2+Math.PI/2,0);m2.rotateX(-1);m2.scale.multiplyScalar(k2);g.add(m2);}if(stage===4){stem(g,.5,.02);g.add(mesh(ball(.07),'#F8C8D4',0,.52,0));}return g;}
      var h2=[0,0,.75,1,1.2][stage];stem(g,h2,.04);leaves(g,stage===2?[.3,.5]:[.3,.55,.8],stage===2?.9:1);
      if(stage===2)g.add(mesh(ball(.1),sp==='sunflower'||sp==='hydrangea'?LEAF:S.c,0,h2+.04,0));
      else head(sp,g,h2+.05,stage===3?.72:1,S.c);
      return g;
    }
    // 竹子：一根一根、一節一節
    if(S.shape==='bamboo'){var n=stage-1,BH=[0,0,.9,1.4,1.9][stage];for(var b=0;b<n;b++){var hh2=BH*(1-.12*(b%2)),st2=new T.Group();st2.add(mesh(cyl(.05,.06,hh2,7),S.c,0,hh2/2,0));for(var y2=.28;y2<hh2;y2+=.3)st2.add(mesh(cyl(.064,.064,.035,7),'#6FA35E',0,y2,0));for(var lf=0;lf<3;lf++){var la=lf*2.1+b,lm=mesh(ball(.12),LEAF2);lm.scale.set(1.3,.18,.4);lm.position.set(Math.cos(la)*.14,hh2-.1-lf*.12,Math.sin(la)*.14);lm.rotation.set(0,-la,-.4);st2.add(lm);}st2.position.set((b-(n-1)/2)*.2,0,b%2?.08:-.06);g.add(st2);}return g;}
    // 椰子樹：彎彎的樹幹、大葉子，長大有椰子
    if(S.shape==='palm'){var seg=[0,0,2,4,6][stage],c3=stage===4?S.c:LEAF,x=0,y=0;for(var s2=0;s2<seg;s2++){var sm=mesh(cyl(.08-.004*s2,.1-.004*s2,.3,7),s2%2?'#C9A884':'#B39275',x,y+.15,0);sm.rotation.z=-.08*s2;g.add(sm);x+=.03*s2;y+=.29;}var fr=[0,0,4,6,7][stage];for(var f=0;f<fr;f++){var fa=f*Math.PI*2/fr,fm=mesh(ball(.2),c3);fm.scale.set(2.1,.14,.5);fm.position.set(x+Math.cos(fa)*.32,y-.02,Math.sin(fa)*.32);fm.rotation.set(0,-fa,-.45);g.add(fm);}if(stage===4)for(var cc=0;cc<3;cc++)g.add(mesh(ball(.07),S.dot,x+Math.cos(cc*2.1)*.1,y-.1,Math.sin(cc*2.1)*.1));return g;}
    // 其他樹：樹幹＋樹冠（圓的、扇形的銀杏、一層一層的松樹）；長大了換成那種樹的顏色、掛上花或果子
    var k=[0,0,.5,.8,1][stage],Ht=[0,0,.5,.8,1][stage],col2=stage===4||S.shape==='pine'?S.c:LEAF;
    g.add(mesh(cyl(.09*k+.02,.15*k+.02,Ht,7),TRUNK,0,Ht/2,0));
    var spots2=[];
    if(S.shape==='pine'){[[.75,.85,.25],[.58,.75,.75],[.4,.62,1.18]].forEach(function(c){g.add(mesh(cone(c[0]*k,c[1]*k,8),col2,0,Ht+c[2]*k,0));});
      if(stage===4){[[.25,.62],[.7,.45],[1.12,.3]].forEach(function(c){g.add(mesh(cone(c[1]*.55,.18,8),'#FFFFFF',0,Ht+c[0]+.42,0));});g.add(mesh(new T.OctahedronGeometry(.13),'#F6D27A',0,Ht+1.62,0));}
      return g;}
    if(S.shape==='fan'){var fn=mesh(cone(.8*k,1.05*k,7),col2,0,Ht+.48*k,0);fn.rotation.x=Math.PI;fn.scale.z=.45;g.add(fn);spots2=[[-.35,.75,.15],[.3,.8,.15],[0,.95,.18],[-.15,.55,.2],[.2,.6,-.2]];}
    else{[[0,.5,0,.62],[-.4,.25,.12,.46],[.4,.27,-.08,.46],[0,.3,-.36,.44],[.05,.28,.38,.42]].forEach(function(c){g.add(mesh(ball(c[3]*k),col2,c[0]*k,Ht+c[1]*k,c[2]*k));});
      for(var i2=0;i2<10;i2++){var a2=i2*2.39996,yy=.15+rnd(i2+3)*.75;spots2.push([Math.cos(a2)*.55*(1-yy*.3),yy+.08,Math.sin(a2)*.55*(1-yy*.3)]);}}
    if(stage===4&&S.dot){var r=sp==='cherry'||sp==='maple'||sp==='ginkgo'?.06:.085;spots2.forEach(function(p){var o=new T.Vector3(p[0],0,p[2]).normalize();g.add(mesh(ball(r,0),S.dot,p[0]+o.x*.08,Ht+p[1]*k,p[2]+o.z*.08));});}
    return g;
  }
  // 植物最高點（世界座標）：標籤放在上面
  function height(g){return new T.Box3().setFromObject(g).max.y;}

  /* ── 害蟲：毛毛蟲、蝸牛、甲蟲 ── */
  function pestModel(kind){
    var g=new T.Group();
    if(kind==='bug'){for(var i=0;i<5;i++){var b=mesh(ball(.075,1),i%2?'#A8D86E':'#8CC456',-i*.1,.07,0);b.userData.seg=i;g.add(b);}g.add(mesh(ball(.09,1),'#7FB36E',.11,.11,0));g.add(mesh(ball(.022,0),'#3E3A39',.19,.15,.04));g.add(mesh(ball(.022,0),'#3E3A39',.19,.15,-.04));}
    else if(kind==='snail'){var sh=mesh(ball(.14,1),'#C9A884',0,.17,0);sh.scale.set(1,1,.8);g.add(sh);var sp=new T.Mesh(new T.TorusGeometry(.07,.025,6,14),M('#8C6A55'));sp.position.set(0,.17,.11);g.add(sp);var bd=mesh(ball(.1,1),'#E8D9B8',.08,.05,0);bd.scale.set(2,.5,.7);g.add(bd);[.04,-.04].forEach(function(z){g.add(mesh(cyl(.01,.01,.12,4),'#E8D9B8',.25,.14,z));g.add(mesh(ball(.022,0),'#3E3A39',.25,.2,z));});}
    else{var sh2=mesh(ball(.13,1),'#6B5B95',0,.09,0);sh2.scale.set(1.2,.6,1);g.add(sh2);g.add(mesh(ball(.07,1),'#3E3A39',.14,.07,0));g.add(mesh(new T.BoxGeometry(.24,.02,.015),'#3E3A39',0,.155,0));}
    g.scale.setScalar(1.4);return g;
  }
  function setPest(p,kind,key){
    if(p.pest&&p.pest.key===key)return;
    if(p.pest){scene.remove(p.pest.g);p.pest=null;}
    if(!kind)return;
    var a=(key.length*1.7+key.charCodeAt(key.length-1))%6.28,pos=polar(.62,a),g=pestModel(kind);
    g.position.set(p.x+pos.x,.12,p.z+pos.z);g.rotation.y=-a+Math.PI/2;
    var hb=hit(.5,{pest:p.id});hb.position.y=.15;g.add(hb);
    scene.add(g);p.pest={g:g,key:key,kind:kind,hb:hb,y0:.12};
  }
  // 抓走：跳起來飛走
  function shoo(id){
    var p=plots.filter(function(q){return q.id===id;})[0];if(!p||!p.pest)return;
    var g=p.pest.g,v=new T.Vector3((Math.random()-.5)*3,4,(Math.random()-.5)*3);p.pest=null;burst(g.position.x,g.position.y+.3,g.position.z,6,'#FFFFFF');
    addFx({dur:.9,up:function(f,dt){v.y-=9*dt;g.position.addScaledVector(v,dt);g.rotation.x+=dt*10;g.scale.multiplyScalar(1-dt*1.2);},end:function(){scene.remove(g);}});
  }

  /* ── 標籤：名字＋長大進度（畫在小畫布上，永遠看得到） ── */
  function label(w,h,sx,sy){var c=document.createElement('canvas');c.width=w||320;c.height=h||120;var t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;var s=new T.Sprite(new T.SpriteMaterial({map:t,transparent:true,depthTest:false}));s.renderOrder=10;s.center.set(.5,0);s.scale.set(sx||2.6,sy||.98,1);s.userData={c:c,t:t,key:''};return s;}
  function rr(x,a,b,w,h,r){x.beginPath();x.moveTo(a+r,b);x.arcTo(a+w,b,a+w,b+h,r);x.arcTo(a+w,b+h,a,b+h,r);x.arcTo(a,b+h,a,b,r);x.arcTo(a,b,a+w,b,r);x.closePath();}
  function drawLabel(s,o){
    var key=JSON.stringify(o);if(s.userData.key===key)return;s.userData.key=key;
    var c=s.userData.c,x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);
    x.font='30px Huninn, "PingFang TC", sans-serif';var tw=Math.min(296,Math.max(o.empty?60:150,x.measureText(o.text).width+44)),l=(320-tw)/2;
    x.globalAlpha=o.empty?.82:1;rr(x,l,6,tw,52,26);x.fillStyle=o.pest?'#FCE6E1':o.ready?'#FDF2D2':'#FFFCF6';x.fill();x.lineWidth=5;x.strokeStyle='#594C43';x.stroke();
    x.fillStyle=o.empty?'#8C6A55':'#3E3A39';x.textAlign='center';x.textBaseline='middle';x.fillText(o.text,160,33);
    if(o.frac!=null){rr(x,70,68,180,22,11);x.fillStyle='#FFFCF6';x.fill();x.lineWidth=4;x.stroke();if(o.frac>0){rr(x,72,70,Math.max(18,176*o.frac),18,9);x.fillStyle=o.thirsty?'#A8D3E6':'#7FB36E';x.fill();}}
    if(o.sub){x.font='22px Huninn, sans-serif';x.fillStyle='#3E7FA0';x.fillText(o.sub,160,108);}
    s.userData.t.needsUpdate=true;
  }
  // 人物頭上的名字
  function nameTag(text,bg){var s=label(160,64,1.25,.5),c=s.userData.c,x=c.getContext('2d');x.font='34px Huninn, "PingFang TC", sans-serif';rr(x,30,6,100,52,26);x.fillStyle=bg;x.fill();x.lineWidth=5;x.strokeStyle='#594C43';x.stroke();x.fillStyle='#3E3A39';x.textAlign='center';x.textBaseline='middle';x.fillText(text,80,33);s.userData.t.needsUpdate=true;return s;}
  function heartTexture(){var c=document.createElement('canvas');c.width=c.height=64;var x=c.getContext('2d');x.fillStyle='#F2A497';x.strokeStyle='#594C43';x.lineWidth=4;x.beginPath();x.moveTo(32,54);x.bezierCurveTo(6,36,6,12,22,12);x.bezierCurveTo(28,12,32,18,32,22);x.bezierCurveTo(32,18,36,12,42,12);x.bezierCurveTo(58,12,58,36,32,54);x.closePath();x.fill();x.stroke();var t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
  function hearts(x,y,z,n){for(var i=0;i<(n||3);i++)(function(i){var s=new T.Sprite(new T.SpriteMaterial({map:heartTex,transparent:true,depthWrite:false}));s.scale.setScalar(.38);s.position.set(x+(Math.random()-.5)*.5,y,z+(Math.random()-.5)*.5);scene.add(s);var d=i*.18;addFx({dur:1.3+d,up:function(f,dt){if(f.t<d)return;s.position.y+=dt*.9;s.material.opacity=1-(f.t-d)/1.3;},end:function(){scene.remove(s);s.material.dispose();}});})(i);}

  /* ── 場景：花園空地、小山、溪流、小橋、小湖、草原、遠方的山 ── */
  function ribbon(pts,w,y,mat){
    var pos=[],idx=[];
    pts.forEach(function(p,i){var a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],tx=b.x-a.x,tz=b.z-a.z,l=Math.hypot(tx,tz)||1,nx=-tz/l,nz=tx/l,ww=(typeof w==='function'?w(i/(pts.length-1)):w)/2;pos.push(p.x+nx*ww,y,p.z+nz*ww,p.x-nx*ww,y,p.z-nz*ww);if(i)idx.push(2*i-2,2*i,2*i-1,2*i-1,2*i,2*i+1);});
    var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
    var m=new T.Mesh(g,mat);m.receiveShadow=true;return m;
  }
  function along(t){var n=flow.length-1,f=Math.max(0,Math.min(n-1e-6,t*n)),i=Math.floor(f),k=f-i,a=flow[i],b=flow[i+1];return {x:a.x+(b.x-a.x)*k,z:a.z+(b.z-a.z)*k};}
  function inMountain(a){return Math.abs(angDiff(a,MT))<.7;}
  /* ── 樹屋：在小島左前方，陽台朝向預設鏡頭；陽台上有兩人座長椅（學和綾可以一起坐），梯子在靠島中間那邊 ── */
  var TH_A=2.35,TH_R=6.3,TH_ROT=Math.PI-2.35,treeHome=null; // TH_ROT：讓梯子那邊朝島中間、陽台朝前面
  function prism(r,len,h,col,x,y,z){var m=mesh(cyl(r,r,len,3),col,x,y,z);m.rotation.set(-Math.PI/2,0,Math.PI/2);m.scale.set(1,1,h);return m;}
  function addTreehouse(){
    var c=polar(TH_R,TH_A),g=new T.Group(),Y=2.38,CZ=-.82,BZ=.42;g.position.set(c.x,0,c.z);g.rotation.y=TH_ROT;scene.add(g);
    function box(w,h,d,col,x,y,z){var m=mesh(new T.BoxGeometry(w,h,d),col,x,y,z);g.add(m);return m;}
    // 大樹幹、樹根、撐住平台的斜枝
    g.add(mesh(cyl(.42,.66,6.6,14),'#8E6A55',0,3.3,-.75));
    for(var i=0;i<5;i++){var a=i*1.26+.3,rt=mesh(cone(.2,1,6),'#8E6A55',Math.cos(a)*.62,.2,-.75+Math.sin(a)*.62);rt.rotation.set(Math.sin(a)*1.15,0,-Math.cos(a)*1.15);g.add(rt);}
    [-1,1].forEach(function(s2){var br=mesh(cyl(.08,.13,2.1,7),'#8E6A55',s2*.95,1.45,-.35);br.rotation.z=s2*.78;g.add(br);});
    // 平台＋木板
    box(3.9,.18,2.9,'#A97853',0,Y-.09,0);
    for(var k=0;k<10;k++)box(3.86,.025,.27,k%2?'#D6AD81':'#C99A6F',0,Y+.005,-1.3+k*.29);
    // 小木屋：牆、木紋、門、窗、花台、愛心牌、屋頂
    box(2.4,1.5,1.15,'#E9CBA3',0,Y+.75,CZ);
    for(var l=0;l<5;l++)box(2.42,.02,1.17,'#D8B48C',0,Y+.22+l*.28,CZ);
    box(.58,.94,.05,'#88644F',.62,Y+.47,CZ+.59);box(.48,.84,.05,'#A97959',.62,Y+.47,CZ+.61);g.add(mesh(ball(.04,2),'#EBC77F',.79,Y+.47,CZ+.65));
    box(.64,.56,.05,'#FFF1CF',-.5,Y+.88,CZ+.59);box(.52,.44,.06,'#8FC6D1',-.5,Y+.88,CZ+.6);box(.03,.45,.07,'#F8E8CB',-.5,Y+.88,CZ+.61);box(.52,.03,.07,'#F8E8CB',-.5,Y+.88,CZ+.61);
    box(.72,.14,.18,'#B9845E',-.5,Y+.53,CZ+.68);[-.74,-.6,-.46,-.32].forEach(function(x,i){g.add(mesh(ball(.065,1),['#F2A497','#F6D27A','#F8C8D4','#B9A6DE'][i],x,Y+.64,CZ+.7));});
    box(.34,.26,.04,'#FFFCF6',.62,Y+1.12,CZ+.6);g.add(mesh(ball(.055,1),'#F2A497',.59,Y+1.13,CZ+.63));g.add(mesh(ball(.055,1),'#F2A497',.65,Y+1.13,CZ+.63));var tip=mesh(cone(.07,.08,4),'#F2A497',.62,Y+1.07,CZ+.63);tip.rotation.z=Math.PI;g.add(tip);
    g.add(prism(.8,2.7,.78,'#A9694F',0,Y+1.5+.2,CZ));box(2.74,.1,.1,'#8C5440',0,Y+2.14,CZ);
    g.add(mesh(cyl(.08,.1,.42,8),'#A97959',.75,Y+2.0,CZ-.2));
    // 陽台：兩人座長椅＋兩個坐墊（粉紅是綾、綠色是學）
    box(1.8,.08,.44,'#B9845E',0,Y+.3,BZ);box(1.8,.44,.07,'#B9845E',0,Y+.56,BZ-.22);box(1.86,.06,.09,'#956C50',0,Y+.8,BZ-.22);
    [-.8,.8].forEach(function(x){box(.08,.3,.08,'#956C50',x,Y+.15,BZ+.15);box(.08,.3,.08,'#956C50',x,Y+.15,BZ-.15);});
    box(.62,.07,.38,'#CDE6BF',-.42,Y+.375,BZ);box(.62,.07,.38,'#F8C8D4',.42,Y+.375,BZ);
    // 欄杆：前面、左邊，右邊留梯子的口
    function post(x,z){box(.08,.62,.08,'#956C50',x,Y+.31,z);}
    for(var px=-1.86;px<=1.87;px+=.62)post(px,1.39);
    box(3.82,.06,.08,'#B9845E',0,Y+.6,1.39);box(3.82,.05,.06,'#B9845E',0,Y+.32,1.39);
    for(var pz=-1.3;pz<=1.4;pz+=.54)post(-1.89,pz);box(.08,.06,2.8,'#B9845E',-1.89,Y+.6,.05);
    for(var pz2=-1.3;pz2<=.1;pz2+=.5)post(1.89,pz2);box(.08,.06,1.5,'#B9845E',1.89,Y+.6,-.6);
    // 串燈：沿著前面欄杆垂下來，晚上也亮亮的
    for(var li=0;li<11;li++){var lx=-1.8+li*.36,sag=Math.sin(li/10*Math.PI)*.12;var bulb=new T.Mesh(ball(.05,1),new T.MeshBasicMaterial({color:['#FFE7A2','#F8C8D4','#CDE6BF','#A8D3E6'][li%4]}));bulb.position.set(lx,Y+.92-sag,1.39);g.add(bulb);}
    var wire=mesh(new T.TorusGeometry(1.9,.008,4,24,Math.PI),'#594C43',0,Y+.94,1.39);wire.rotation.z=Math.PI;wire.scale.y=.07;g.add(wire);
    var lan=new T.Mesh(ball(.11,2),new T.MeshBasicMaterial({color:'#F5CE79'}));lan.position.set(1.08,Y+1.3,CZ+.68);g.add(lan);box(.05,.12,.05,'#594C43',1.08,Y+1.45,CZ+.66);
    // 梯子：右邊（靠島中間），斜斜的
    var lx0=2.5,lx1=1.92,LZ=.85,len=Math.hypot(lx1-lx0,Y),tilt=Math.atan2(lx1-lx0,Y);
    [-.22,.22].forEach(function(dz){var rail=box(.07,len+.1,.07,'#987052',(lx0+lx1)/2,Y/2,LZ+dz);rail.rotation.z=-tilt;});
    for(var j=0;j<8;j++){var f=(j+.6)/8.6;box(.07,.06,.48,'#DAB58A',lx0+(lx1-lx0)*f,Y*f,LZ);}
    // 盪鞦韆：左邊樹枝垂下來
    var bough=mesh(cyl(.07,.1,2.1,7),'#8E6A55',-1.3,3.55,-.4);bough.rotation.z=Math.PI/2+.15;g.add(bough);
    [-.22,.22].forEach(function(dz){var rp=mesh(cyl(.012,.012,2.3,4),'#C9A884',-2.2,2.4,-.4+dz);g.add(rp);});
    box(.32,.05,.6,'#B9845E',-2.2,1.25,-.4);
    // 大樹冠蓋在屋頂上
    [[0,6.25,-.85,1.6,'#86B67C'],[-1.3,5.85,-.5,1.15,'#9AC58C'],[1.35,5.95,-.7,1.2,'#77AA74'],[.15,5.8,.05,1.05,'#9AC58C'],[-.35,6.7,-1.35,1.05,'#86B67C'],[.9,6.75,-1.15,.9,'#9AC58C']].forEach(function(q){var m=mesh(ball(q[3],2),q[4],q[0],q[1],q[2]);m.scale.set(1.15,.82,1.05);g.add(m);});
    [[-1.45,5.5,0],[1.5,5.6,-.2],[.6,5.4,.65],[-.6,5.45,.6]].forEach(function(q,i){g.add(mesh(ball(.09,1),['#F8C8D4','#FFFFFF','#F6D27A','#F8C8D4'][i],q[0],q[1],q[2]));});
    // 人物用的位置（世界座標）
    g.updateMatrixWorld(true);
    function w(x,y,z){return g.localToWorld(new T.Vector3(x,y,z));}
    treeHome={g:g,Y:Y,occ:[null,null],entry:w(2.75,0,LZ),top:w(1.62,Y,LZ),seats:[w(-.42,Y+.1,BZ+.04),w(.42,Y+.1,BZ+.04)],c:c};
  }
  function nearTree(x,z){return treeHome&&Math.hypot(x-treeHome.c.x,z-treeHome.c.z)<2.6;}
  function build(){
    scene=new T.Scene();
    cam=new T.PerspectiveCamera(38,1,.1,260);tgt=new T.Vector3(0,.7,0);
    var d=new Uint8Array([110,190,255]);GM=new T.DataTexture(d,3,1,T.RedFormat);GM.minFilter=GM.magFilter=T.NearestFilter;GM.needsUpdate=true;
    hitMat=new T.MeshBasicMaterial();heartTex=heartTexture();
    hemi=new T.HemisphereLight('#FFFFFF','#8DBF7A',1.1);scene.add(hemi);
    sun=new T.DirectionalLight('#FFF4D6',1.6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);var sc=sun.shadow.camera;sc.left=sc.bottom=-13;sc.right=sc.top=13;sc.near=1;sc.far=60;sun.shadow.bias=-.0015;scene.add(sun);scene.add(sun.target);
    // 地面：一直到地平線的草原；花園空地顏色亮一點，外圍一圈沙土小路
    var ground=new T.Mesh(new T.CircleGeometry(170,72),M('#97C383'));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;ground.receiveShadow=true;scene.add(ground);
    var yard=new T.Mesh(new T.CircleGeometry(ISL,64),M(GRASS));yard.rotation.x=-Math.PI/2;yard.position.y=-.005;yard.receiveShadow=true;scene.add(yard);
    var path=new T.Mesh(new T.RingGeometry(ISL+.1,ISL+.85,72),M('#E3CFA0'));path.rotation.x=-Math.PI/2;path.position.y=-.012;path.receiveShadow=true;scene.add(path);
    // 小山：三座，最高那座有雪
    [[7.45,MT-.4,1.05,2.5],[7.5,MT,1.35,3.7],[7.35,MT+.42,1,2.2]].forEach(function(m,i){var p=polar(m[0],m[1]),mt=mesh(cone(m[2],m[3],7),['#9FB58C','#93AA84','#A6BB92'][i],p.x,m[3]/2-.05,p.z);mt.rotation.y=i;scene.add(mt);var cap=mesh(cone(m[2]*.4,m[3]*.36,7),'#FFFFFF',p.x,m[3]*.82+.01,p.z);cap.rotation.y=i;scene.add(cap);});
    for(var r0=0;r0<9;r0++){var rp=polar(6.6+rnd(r0+70)*1.4,MT+(rnd(r0+80)-.5)*1.4),rk=mesh(new T.DodecahedronGeometry(.18+rnd(r0)*.22),'#C9C2BB',rp.x,.02,rp.z);rk.scale.y=.6;scene.add(rk);}
    // 溪流：山腳的小池塘出發，沿著花園外圈流，最後穿過小路流進旁邊的小湖
    var pond=polar(6.15,MT+.02);
    flow=[{x:pond.x,z:pond.z}];for(var a=MT+.16;a<=WF-.38;a+=.07){var p2=polar(6.25+Math.sin(a*4)*.16,a);flow.push(p2);}
    [[6.6,WF-.24],[7.25,WF-.13],[7.95,WF-.05],[ISL+.1,WF],[9.5,WF+.03]].forEach(function(q){flow.push(polar(q[0],q[1]));});
    waterMat=new T.MeshToonMaterial({color:WATER,gradientMap:GM,transparent:true,opacity:.92});
    scene.add(ribbon(flow,function(t){return .78+t*.25;},.012,M('#8CBF78')));
    scene.add(ribbon(flow,function(t){return .55+t*.2;},.03,waterMat));
    var pd=mesh(cyl(.62,.62,.05,20),waterMat,pond.x,.03,pond.z);pd.castShadow=false;scene.add(pd);
    for(var s0=0;s0<9;s0++){var sa=s0*.7,st=mesh(new T.DodecahedronGeometry(.12+rnd(s0+30)*.08),'#D9D2CA',pond.x+Math.cos(sa)*.7,.03,pond.z+Math.sin(sa)*.7);st.scale.y=.55;scene.add(st);}
    for(var fl=0;fl<16;fl++){var fk=mesh(ball(.035,0),'#FFFFFF');fk.scale.set(2.2,.4,1);fk.castShadow=false;fk.userData.t=fl/16;scene.add(fk);flecks.push(fk);}
    // 小木橋：跨過溪流
    var bt=.36,bp=along(bt),bq=along(bt+.02),dir=Math.atan2(bq.z-bp.z,bq.x-bp.x),bridge=new T.Group();
    for(var pk=-3;pk<=3;pk++){var plank=mesh(new T.BoxGeometry(.16,.06,.9),pk%2?'#C9A884':'#B98B6B',pk*.17,.16+.09*Math.cos(pk/3*1.3),0);bridge.add(plank);}
    [-.42,.42].forEach(function(z){for(var q=-3;q<=3;q+=2){bridge.add(mesh(cyl(.025,.025,.3,5),'#8C6A55',q*.17,.32+.09*Math.cos(q/3*1.3),z));}var rail=mesh(cyl(.02,.02,1.1,5),'#8C6A55',0,.46,z);rail.rotation.z=Math.PI/2;bridge.add(rail);});
    bridge.position.set(bp.x,0,bp.z);bridge.rotation.y=-dir-Math.PI/2;scene.add(bridge);
    // 小湖：溪水流進來；沙岸、荷葉（有的開花）、蘆葦、兩隻小鴨子
    var LK=polar(12.5,WF+.05),LR=3.4;lake={x:LK.x,z:LK.z,r:LR};
    var lw=new T.Mesh(new T.CircleGeometry(LR,48),waterMat);lw.rotation.x=-Math.PI/2;lw.position.set(LK.x,.02,LK.z);scene.add(lw);
    var sand=new T.Mesh(new T.RingGeometry(LR-.05,LR+.75,48),M('#E8D5A8'));sand.rotation.x=-Math.PI/2;sand.position.set(LK.x,.008,LK.z);sand.receiveShadow=true;scene.add(sand);
    for(var lp=0;lp<7;lp++){var la=lp*.9+.4,lr=1+rnd(lp+150)*1.9,pad=mesh(cyl(.32,.32,.02,12),'#7FB36E',LK.x+Math.cos(la)*lr,.035,LK.z+Math.sin(la)*lr);pad.castShadow=false;scene.add(pad);if(lp%3===0)scene.add(mesh(ball(.09,1),'#F8C8D4',pad.position.x,.09,pad.position.z));}
    for(var rd=0;rd<14;rd++){var ra=rd*.45+2.2,rp2=polar(LR+.15,ra),rx=LK.x+rp2.x,rz=LK.z+rp2.z,rh=.7+rnd(rd+170)*.5;scene.add(mesh(cyl(.02,.025,rh,4),'#6FA35E',rx,rh/2,rz));if(rd%2)scene.add(mesh(cyl(.045,.045,.18,6),'#8C6A55',rx,rh+.02,rz));}
    for(var dk=0;dk<2;dk++){var duck=new T.Group(),bd=mesh(ball(.2,1),'#FFFFFF');bd.scale.set(1.25,.75,.95);duck.add(bd);duck.add(mesh(ball(.12,1),'#FFFFFF',.2,.17,0));var bk=mesh(cone(.045,.12,6),'#F2A15B',.33,.16,0);bk.rotation.z=-Math.PI/2;duck.add(bk);[-.05,.05].forEach(function(z){duck.add(mesh(ball(.018,0),'#3E3A39',.27,.21,z));});var tl=mesh(cone(.07,.14,5),'#FFFFFF',-.25,.08,0);tl.rotation.z=Math.PI/2+.5;duck.add(tl);duck.userData={a:dk*Math.PI,r:1.6+dk*.6,s:dk?-.12:.15};scene.add(duck);ducks.push(duck);}
    // 草地上的小花、溪邊的石頭
    for(var j=0;j<44;j++){var b=j*2.39996,rr2=4.4+rnd(j+40)*3.9,fp=polar(rr2,b);if(inMountain(b)&&rr2>6.2)continue;var near=flow.some(function(q){return Math.hypot(q.x-fp.x,q.z-fp.z)<.55;});if(near)continue;var fo=mesh(ball(.07,0),['#FFFFFF','#F8C8D4','#F6D27A','#B9A6DE'][j%4],fp.x,.04,fp.z);fo.castShadow=false;scene.add(fo);}
    for(var k=0;k<10;k++){var q=along(.08+k*.085),side=k%2?1:-1,nb=along(.08+k*.085+.01),tx=nb.x-q.x,tz=nb.z-q.z,l=Math.hypot(tx,tz)||1,rs=mesh(new T.DodecahedronGeometry(.1+rnd(k+60)*.1),'#C9C2BB',q.x-tz/l*.42*side,.03,q.z+tx/l*.42*side);rs.scale.y=.6;scene.add(rs);}
    // 遠方的山：一圈，站在地面上，越遠越淡（霧）
    for(var mm=0;mm<20;mm++){var ma=mm/20*Math.PI*2+rnd(mm)*.25,mr=62+rnd(mm+5)*18,mh=14+rnd(mm+9)*18,mw=12+rnd(mm+3)*9,mp=polar(mr,ma),mo=mesh(cone(mw,mh,6),['#A9C3B4','#9DB3C6','#B7C9A8','#AFC0CF'][mm%4],mp.x,mh/2-1,mp.z);mo.castShadow=mo.receiveShadow=false;mo.rotation.y=mm;scene.add(mo);if(mh>24){var cp=mesh(cone(mw*.34,mh*.3,6),'#F4F6F8',mp.x,mh*.85-.95,mp.z);cp.castShadow=false;cp.rotation.y=mm;scene.add(cp);}}
    // 草原上起伏的小山丘
    for(var hl=0;hl<14;hl++){var ha=hl/14*Math.PI*2+rnd(hl+200)*.3,hr=30+rnd(hl+210)*20,hs=7+rnd(hl+220)*8,hp=polar(hr,ha),hm=mesh(ball(1,2),['#93C07E','#A1CB8B','#8CB878'][hl%3],hp.x,-hs*.1,hp.z);hm.scale.set(hs*1.4,hs*.32,hs);hm.rotation.y=ha;hm.castShadow=hm.receiveShadow=false;scene.add(hm);}
    // 草原上的樹：圓樹和松樹（同一種形狀一次畫完）
    var nT=56,dmy=new T.Object3D(),col=new T.Color(),wm=M('#FFFFFF'),trI=new T.InstancedMesh(cyl(.14,.22,1,6),M('#8E6A55'),nT),crI=new T.InstancedMesh(ball(1,1),wm,nT*2),cnI=new T.InstancedMesh(cone(1,1,7),wm,nT*3),nt=0,nc=0,nk=0;
    function inst(m,i,x,y,z,sx,sy,sz,c){dmy.position.set(x,y,z);dmy.scale.set(sx,sy,sz);dmy.rotation.set(0,rnd(i+77)*6,0);dmy.updateMatrix();m.setMatrixAt(i,dmy.matrix);if(c)m.setColorAt(i,col.set(c));}
    for(var ti=0;ti<nT*3&&nt<nT;ti++){var tr=13.5+rnd(ti+300)*22,ta=rnd(ti+310)*Math.PI*2,tp=polar(tr,ta);if(Math.hypot(tp.x-lake.x,tp.z-lake.z)<lake.r+2.2)continue;
      var pine=rnd(ti+320)<.4,th=pine?.9:1.2+rnd(ti+330)*.7,ts=.9+rnd(ti+340)*.6;inst(trI,nt++,tp.x,th*ts/2,tp.z,ts,th*ts,ts);
      if(pine){[[1.25,1.3,.5],[.98,1.1,1.25],[.7,.9,1.9]].forEach(function(c2,k){inst(cnI,nk++,tp.x,(th+c2[2])*ts,tp.z,c2[0]*ts,c2[1]*ts,c2[0]*ts,['#6FA37E','#7FB08A','#6A9C78'][k]);});}
      else{var cc=['#86B67C','#9AC58C','#77AA74','#A6CC8F'][ti%4];inst(crI,nc++,tp.x,(th+.75)*ts,tp.z,1.15*ts,.95*ts,1.15*ts,cc);inst(crI,nc++,tp.x+.45*ts,(th+.35)*ts,tp.z+.2*ts,.75*ts,.65*ts,.75*ts,cc);}}
    trI.count=nt;crI.count=nc;cnI.count=nk;[trI,crI,cnI].forEach(function(m){m.castShadow=m.receiveShadow=false;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.instanceMatrix.needsUpdate=true;scene.add(m);});
    // 小路外面的小灌木
    for(var bu=0;bu<22;bu++){var ba=bu*.29+rnd(bu+400)*.2,bp=polar(ISL+1.4+rnd(bu+410)*2.5,ba);if(Math.hypot(bp.x-lake.x,bp.z-lake.z)<lake.r+1)continue;var bs=mesh(ball(.35+rnd(bu+420)*.25,1),['#86B67C','#9AC58C'][bu%2],bp.x,.15,bp.z);bs.scale.y=.75;scene.add(bs);if(bu%4===0)scene.add(mesh(ball(.07,0),'#F8C8D4',bp.x+.15,.42,bp.z));}
    // 森林可以放的位置：兩圈，避開小山和溪水出口
    [[7.15,22,0],[7.95,26,.12]].forEach(function(rg){for(var i=0;i<rg[1];i++){var fa=i/rg[1]*Math.PI*2+rg[2]+.05;if(Math.abs(angDiff(fa,MT))<.62||Math.abs(angDiff(fa,WF))<.2||Math.abs(angDiff(fa,TH_A))<.5)continue;spots.push({r:rg[0],a:fa});}});
    // 十二塊土（點的範圍做大一點、看不到）；還沒開放的先藏起來
    PLOT.forEach(function(p,i){
      var base=new T.Group();base.position.set(p[0],0,p[1]);scene.add(base);
      base.add(mesh(cyl(.62,.76,.18,16),SOIL,0,.07,0));
      var coll=new T.Mesh(cyl(.95,.95,3.4,8),hitMat);coll.position.y=1.6;coll.visible=false;coll.userData={slot:i};base.add(coll);
      var lab=label();lab.position.set(p[0],.6,p[1]);scene.add(lab);
      var pg=new T.Group();pg.position.y=.15;base.add(pg);
      base.visible=lab.visible=false;
      plots.push({i:i,x:p[0],z:p[1],base:base,holder:pg,coll:coll,lab:lab,key:'',id:null,stage:-1,top:.3,pop:1,sc:1,spk:[],on:false,grow:1,pest:null});
    });
    // 雲：高高的、遠遠的，繞著天空慢慢飄（拉遠鏡頭也碰不到）
    cloudMat=new T.MeshToonMaterial({color:'#FFFFFF',gradientMap:GM,transparent:true,opacity:.95});
    clouds=new T.Group();for(var c=0;c<10;c++){var cg=new T.Group(),ca=c*.63+rnd(c)*.5,cr=52+rnd(c+20)*20;[[0,0,0,.9],[.8,-.15,.1,.65],[-.8,-.1,0,.7],[.2,.3,-.2,.6]].forEach(function(q2){var m=new T.Mesh(ball(q2[3],1),cloudMat);m.position.set(q2[0],q2[1],q2[2]);cg.add(m);});cg.position.set(Math.cos(ca)*cr,20+rnd(c+5)*9,Math.sin(ca)*cr);cg.scale.setScalar(3.2+rnd(c+1)*2.3);clouds.add(cg);}scene.add(clouds);
    dropMat=new T.MeshBasicMaterial({color:'#7FC4E4'});
    // 星星、螢火蟲（晚上才看得到）
    var sp=[];for(var k3=0;k3<360;k3++){var u=rnd(k3+100)*Math.PI*2,v=.08+rnd(k3+700)*.9,R0=90;sp.push(Math.cos(u)*Math.cos(v)*R0,Math.sin(v)*R0-6,Math.sin(u)*Math.cos(v)*R0);}
    var sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(sp,3));
    stars=new T.Points(sg,new T.PointsMaterial({color:'#FFF4D6',size:.6,transparent:true,opacity:0,depthWrite:false,fog:false}));scene.add(stars);
    for(var f=0;f<14;f++){var fm=new T.Mesh(ball(.05,0),new T.MeshBasicMaterial({color:'#FFF2A0',transparent:true,opacity:0}));fm.userData={a:rnd(f)*6.28,r:1.5+rnd(f+3)*5,y:.5+rnd(f+6)*1.4,s:.3+rnd(f+8)*.5};scene.add(fm);flies.push(fm);}
    sky();
  }
  // 天空：跟著現在幾點（清晨粉橘、白天藍、黃昏橘、晚上深藍）
  var SKY=[[0,'#2A3563','#B4C6F0',.75,.95],[5,'#2E3968','#B4C6F0',.75,.95],[6.5,'#F6C9B4','#FFD9B0',1.1,1],[9,'#BFE3F2','#FFF4D6',1.7,1.15],[16,'#BFE3F2','#FFF4D6',1.7,1.15],[18,'#F3B28C','#FFB98A',1.2,1],[19.5,'#4F5F92','#C9B8F0',.85,.9],[21,'#2A3563','#B4C6F0',.75,.95],[24,'#2A3563','#B4C6F0',.75,.95]];
  function sky(){
    var t=new Date(),h=t.getHours()+t.getMinutes()/60,i=1;while(i<SKY.length-1&&h>=SKY[i][0])i++;
    var A=SKY[i-1],B=SKY[i],k=(h-A[0])/(B[0]-A[0]),bg=new T.Color(A[1]).lerp(new T.Color(B[1]),k),lc=new T.Color(A[2]).lerp(new T.Color(B[2]),k);
    scene.background=bg;scene.fog=new T.Fog(bg,40,135);
    sun.color=lc;sun.intensity=A[3]+(B[3]-A[3])*k;hemi.intensity=A[4]+(B[4]-A[4])*k;hemi.color=new T.Color('#FFFFFF').lerp(bg,.25);
    var ang=(h-6)/12*Math.PI;sun.position.set(Math.cos(ang)*14,Math.max(5,Math.sin(Math.abs(ang))*16+5),7);
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
        pets.push({k:k,spr:spr,sh:sh,ts:ts,H:H,ang:i*2.1+.9,r:5.25,ta:i*2.1+.9,tr:5.25,wait:1+i,walkT:0,hop:0,flip:false,cur:2,x:0,z:0});
      });
    }));
  }
  function setTex(p,n){var t=p.ts[n]||p.ts[2];if(p.cur===n&&!p.dirty)return;p.cur=n;p.dirty=false;t.t.repeat.x=p.flip?-1:1;t.t.offset.x=p.flip?1:0;p.spr.material.map=t.t;p.spr.material.needsUpdate=true;p.spr.scale.set(p.H/t.a,p.H,1);}
  function movePets(dt){
    var right=new T.Vector3().setFromMatrixColumn(cam.matrixWorld,0);
    pets.forEach(function(p){
      if(p.wait>0){p.wait-=dt;setTex(p,2);if(p.wait<=0){for(var n=0;n<6;n++){p.ta=p.ang+(Math.random()-.5)*3.2;p.tr=RING[0]+Math.random()*(RING[1]-RING[0]);if(!nearTree(Math.cos(p.ta)*p.tr,Math.sin(p.ta)*p.tr))break;}}}
      else{var da=angDiff(p.ta,p.ang),dr=p.tr-p.r,dist=Math.hypot(da*p.r,dr),step=.5*dt;if(dist<step){p.ang=p.ta;p.r=p.tr;p.wait=1.5+Math.random()*3;}else{var x0=Math.cos(p.ang)*p.r,z0=Math.sin(p.ang)*p.r,k=step/dist;p.ang+=da*k;p.r+=dr*k;var v=new T.Vector3(Math.cos(p.ang)*p.r-x0,0,Math.sin(p.ang)*p.r-z0),fl=v.dot(right)<0;if(fl!==p.flip){p.flip=fl;p.dirty=true;}p.walkT+=dt;setTex(p,Math.floor(p.walkT/.18)%2);}}
      var y=0;if(p.hop>0){p.hop=Math.max(0,p.hop-dt);y=Math.sin((1-p.hop/.5)*Math.PI)*.5;}
      p.x=Math.cos(p.ang)*p.r;p.z=Math.sin(p.ang)*p.r;p.spr.position.set(p.x,y,p.z);p.sh.position.set(p.x,.02,p.z);p.sh.scale.setScalar(1-y*.6);
    });
  }
  function hop(k){var list=k?pets.filter(function(p){return p.k===k;}):[pets[Math.floor(Math.random()*pets.length)]];list.forEach(function(p){if(p&&p.hop<=0)p.hop=.5;});}

  /* ── 學和綾：Q 版人物，在小島上散步；偶爾走去摸摸寵物、或跟對方打招呼 ── */
  function hairCap(c,tilt){var m=mesh(new T.SphereGeometry(.29,18,10,0,Math.PI*2,0,Math.PI*.56),c,0,.02,-.01);m.rotation.x=-tilt;return m;}
  function human(o){
    var g=new T.Group(),b=new T.Group();b.scale.y=1.23;g.add(b);
    o.skin=new T.MeshToonMaterial({color:new T.Color(o.skin),gradientMap:GM,emissive:new T.Color('#6B4636'),emissiveIntensity:.22});
    // 腿：大腿（褲子或絲襪）＋小腿＋襪子＋鞋子
    function leg(x){var pv=new T.Group();pv.position.set(x,.4,0);
      pv.add(mesh(cyl(.066,.07,.26,10),o.legs,0,-.13,0));pv.add(mesh(cyl(.058,.064,.16,10),o.shin||o.legs,0,-.31,0));
      if(o.socks)pv.add(mesh(cyl(.062,.062,.05,10),o.socks,0,-.37,0));
      var sh=mesh(ball(.075,2),o.shoe,0,-.4,.03);sh.scale.set(1,.6,1.45);pv.add(sh);var sole=mesh(ball(.075,2),'#E9DCCB',0,-.425,.045);sole.scale.set(1.02,.16,1.45);pv.add(sole);
      b.add(pv);return pv;}
    // 手：袖子＋袖口＋手掌
    function arm(x){var pv=new T.Group();pv.position.set(x,.8,0);
      pv.add(mesh(cyl(.054,.056,.2,10),o.top,0,-.1,0));pv.add(mesh(cyl(.047,.051,.15,10),o.fore||o.top,0,-.265,0));
      pv.add(mesh(cyl(.053,.053,.03,10),o.cuff,0,-.345,0));var hand=mesh(ball(.05,2),o.skin,0,-.385,.005);hand.scale.set(.9,1.12,.8);pv.add(hand);
      pv.rotation.z=x>0?.12:-.12;b.add(pv);return pv;}
    var L1=leg(-.09),L2=leg(.09);
    var torso=mesh(new T.CylinderGeometry(.175,.20,.44,18),o.top,0,.62,0);torso.scale.z=.76;b.add(torso);
    var shoulder=mesh(ball(.17,2),o.top,0,.79,0);shoulder.scale.set(1.22,.48,.76);b.add(shoulder);
    if(o.skirt){b.add(mesh(cone(.28,.34,16),o.skirt,0,.46,0));b.add(mesh(cyl(.28,.28,.025,18),'#596A8A',0,.295,0));}
    b.add(mesh(cyl(.105,.13,.035,16),'#F8EFE2',0,.835,.01));
    var A1=arm(-.23),A2=arm(.23);
    if(o.k==='syue'){
      // 學：外套裡面一件白襯衫、扣子、口袋、皮帶、手錶
      b.add(mesh(new T.BoxGeometry(.105,.25,.025),'#DFE5E7',0,.67,.194));
      [-1,1].forEach(function(side){var lap=mesh(new T.BoxGeometry(.055,.24,.025),'#344C70',side*.08,.69,.195);lap.rotation.z=side*.13;b.add(lap);});
      for(var j=0;j<3;j++)b.add(mesh(ball(.012,1),'#E7C990',0,.72-j*.07,.215));
      b.add(mesh(new T.BoxGeometry(.075,.055,.015),'#344C70',-.105,.66,.183));
      var belt=mesh(cyl(.2,.2,.04,18),'#5A4A42',0,.42,0);belt.scale.z=.78;b.add(belt);b.add(mesh(new T.BoxGeometry(.05,.036,.02),'#E7C990',0,.42,.16));
      A1.add(mesh(cyl(.056,.056,.03,10),'#3E3A39',0,-.32,0));A1.add(mesh(new T.BoxGeometry(.03,.012,.03),'#DFE5E7',0,-.32,.05));
    }else{
      // 綾：上衣胸前一片白、扣子、斜背小包包
      b.add(mesh(new T.BoxGeometry(.12,.16,.022),'#FFF9EF',0,.735,.19));
      for(var j2=0;j2<3;j2++)b.add(mesh(ball(.011,1),'#C8A484',0,.715-j2*.055,.215));
      var strap=mesh(new T.BoxGeometry(.025,.5,.02),'#B98D76',.02,.63,.2);strap.rotation.z=.62;b.add(strap);
      var bag=mesh(new T.BoxGeometry(.15,.12,.06),'#C9A27E',.17,.45,.14);b.add(bag);b.add(mesh(new T.BoxGeometry(.15,.05,.065),'#B98D76',.17,.49,.145));b.add(mesh(ball(.012,1),'#E7C990',.17,.465,.18));
    }
    var hd=new T.Group();hd.position.y=1.1;hd.scale.setScalar(.82);b.add(hd);
    var face=mesh(new T.SphereGeometry(.27,26,18),o.skin);face.scale.set(1,.97,.96);hd.add(face);
    [-1,1].forEach(function(side){var ear=mesh(ball(.055,2),o.skin,side*.265,-.015,-.005);ear.scale.set(.68,1,.7);hd.add(ear);});
    o.hair(hd);
    // 臉：眼睛（亮點）、眉毛、腮紅、鼻子、嘴巴；綾有睫毛
    var eyes=[];
    [-.09,.09].forEach(function(x){
      var ey=new T.Group();ey.position.set(x,0,.244);hd.add(ey);
      var eye=mesh(ball(.031,2),'#362B29');eye.scale.set(.8,1.12,.5);ey.add(eye);ey.add(mesh(ball(.008,1),'#FFF9F1',-.008,.013,.016));ey.add(mesh(ball(.004,1),'#FFF9F1',.008,-.01,.016));
      if(o.k==='ling'){var lash=mesh(ball(.009,1),'#362B29',x>0?.022:-.022,.03,0);lash.scale.set(1.4,.45,.4);ey.add(lash);}
      eyes.push(ey);
      var brow=mesh(ball(.03,1),o.brow,x,.08,.23);brow.scale.set(1,.18,.2);brow.rotation.z=x>0?-.12:.12;hd.add(brow);
      var blush=mesh(ball(.04,1),'#F7B5A8',x*1.62,-.065,.21);blush.scale.set(1,.5,.3);hd.add(blush);
    });
    var nose=mesh(ball(.017,2),'#E5B9A6',0,-.055,.257);nose.scale.set(.7,.6,.5);hd.add(nose);
    var smile=mesh(new T.TorusGeometry(.035,.006,6,16,Math.PI),'#A76C65',0,-.094,.245);smile.rotation.z=Math.PI;hd.add(smile);
    var tag=nameTag(o.name,o.bg);tag.position.y=1.94;g.add(tag);
    var sh2=new T.Mesh(new T.CircleGeometry(.32,16),new T.MeshBasicMaterial({color:'#000000',transparent:true,opacity:.16,depthWrite:false}));sh2.rotation.x=-Math.PI/2;sh2.position.y=.02;g.add(sh2);
    var hb=hit(.5,{person:o.k});hb.position.y=1;hb.scale.set(1,2.15,1);g.add(hb);
    g.scale.setScalar(1.15);scene.add(g);
    return {k:o.k,g:g,b:b,legs:[L1,L2],arms:[A1,A2],hd:hd,eyes:eyes,sh:sh2,ang:o.ang,r:5.3,ta:o.ang,tr:5.3,state:'idle',timer:1+Math.random()*2,walkT:0,face:0,with:null,act:0,ph:Math.random()*6,blink:2+Math.random()*3,waveT:0,seat:-1};
  }
  function addPeople(){
    var SK='#F6D8C4';
    // 學：短黑髮（頭頂、瀏海、鬢角、後腦）、深藍外套、灰褲子
    people.push(human({k:'syue',name:'學',bg:'#EEF6E8',ang:.3,skin:SK,top:'#4A5F86',legs:'#7C7F86',shoe:'#584B43',cuff:'#DFE5E7',brow:'#2E2A2A',hair:function(h){
      var c='#2E2A2A';h.add(hairCap(c,.42));var crown=mesh(ball(.21,2),'#403735',-.065,.19,-.04);crown.scale.set(1.1,.5,1);h.add(crown);
      [-.13,-.04,.05,.13].forEach(function(x,i){var t=mesh(ball(.07,2),c,x,.19-(i%2)*.025,.215);t.scale.set(1.15,.62,.8);t.rotation.z=(x)*1.4;h.add(t);});
      [-1,1].forEach(function(sd){var sb=mesh(ball(.07,2),c,sd*.245,.04,.06);sb.scale.set(.55,1.25,.9);h.add(sb);});
      var nape=mesh(ball(.2,2),c,0,-.06,-.12);nape.scale.set(1.15,.75,.85);h.add(nape);}}));
    // 綾：咖啡色及肩髮（瀏海、兩側、後面捲捲的髮尾）、黑色漁夫帽（帽帶、小花）、米白上衣、灰藍裙子、白襪
    people.push(human({k:'ling',name:'綾',bg:'#FDEEEA',ang:.75,skin:SK,top:'#F6E7D8',legs:'#F1D2C0',shin:'#F1D2C0',socks:'#FFFFFF',shoe:'#816B60',skirt:'#6E7C9A',cuff:'#FFF9EF',brow:'#6B4A3A',hair:function(h){
      var c='#6B4A3A';h.add(hairCap(c,.36));
      [-.13,-.045,.045,.13].forEach(function(x,i){var bang=mesh(ball(.068,2),'#795343',x,.16-(i===1||i===2?.03:0),.205);bang.scale.set(1.05,.72,.7);h.add(bang);});
      var bk=mesh(ball(.22,2),c,0,-.16,-.14);bk.scale.set(1.15,1.25,.7);h.add(bk);
      [-.25,.25].forEach(function(x){var sd=mesh(ball(.1,2),c,x,-.12,.02);sd.scale.set(.7,1.5,.8);h.add(sd);var tipc=mesh(ball(.06,2),'#795343',x*1.05,-.27,.05);tipc.scale.set(1,.8,.9);h.add(tipc);});
      [-.16,0,.16].forEach(function(x){var cu=mesh(ball(.075,2),'#795343',x,-.38,-.15);cu.scale.set(1,.75,.8);h.add(cu);});
      h.add(mesh(cyl(.25,.3,.16,16),'#3E3A39',0,.24,-.01));h.add(mesh(cyl(.38,.38,.035,28),'#3E3A39',0,.16,0));h.add(mesh(cyl(.255,.255,.035,22),'#B98D76',0,.195,-.01));
      for(var pf=0;pf<5;pf++){var a=pf*1.2566;h.add(mesh(ball(.024,1),'#F8C8D4',.24+Math.cos(a)*.03,.215+Math.sin(a)*.03,.07));}h.add(mesh(ball(.018,1),'#F6D27A',.24,.215,.08));}}));
  }
  function pos(o){return {x:Math.cos(o.ang)*o.r,z:Math.sin(o.ang)*o.r};}
  var _v=null;
  // 樹屋：爬上去 → 走到長椅 → 坐著（兩個人都在就一起坐、靠在一起冒愛心）→ 走回梯子 → 爬下來
  var TREE_STATES={climb:1,toSeat:1,sit:1,fromSeat:1,descend:1};
  function goTree(p,i){treeHome.occ[i]=p;p.seat=i;p.with=null;p.toTree=true;var e=treeHome.entry;p.ta=Math.atan2(e.z,e.x);p.tr=Math.hypot(e.x,e.z);p.state='walk';}
  function movePeople(dt){
    if(!_v)_v=new T.Vector3();
    var both=people.length===2&&people.every(function(o){return o.state==='sit';});
    people.forEach(function(p){
      var q=pos(p),st;
      if(p.state==='idle'){p.timer-=dt;if(p.timer<=0)choose(p);}
      else if(p.state==='walk'){
        if(p.with){var w=p.with;var wa=w.ang!=null?w.ang:0,side=angDiff(p.ang,wa)>0?1:-1;p.ta=wa+side*.16;p.tr=w.r+(w.spr?.05:0);}
        var da=angDiff(p.ta,p.ang),dr=p.tr-p.r,step=(p.toTree?1:.75)*dt,dist=Math.hypot(da*p.r,dr);
        if(dist<.08){if(p.toTree){p.toTree=false;p.state='climb';p.t=0;}else if(p.with)play(p);else{p.state='idle';p.timer=1.5+Math.random()*3;}}
        else{var k=Math.min(1,step/dist);p.ang+=da*k;p.r+=dr*k;p.walkT+=dt;var nq=pos(p);p.face=Math.atan2(nq.x-q.x,nq.z-q.z);}
      }else if(TREE_STATES[p.state]){
        var D=p.state==='climb'||p.state==='descend'?2.8:1.1;p.t=Math.min(1,p.t+dt/D);if(p.state!=='sit')p.walkT+=dt;
        if(p.state==='sit'){p.timer-=dt;if(both&&p.k==='syue'){p.hT=(p.hT||0)-dt;if(p.hT<=0){p.hT=3.2;var s0=treeHome.seats[0],s1=treeHome.seats[1];hearts((s0.x+s1.x)/2,s0.y+1.7,(s0.z+s1.z)/2,3);}}if(p.timer<=0){p.state='fromSeat';p.t=0;}}
        else if(p.t>=1){
          if(p.state==='climb'){p.state='toSeat';p.t=0;}
          else if(p.state==='toSeat'){p.state='sit';var o2=people.filter(function(o){return o!==p;})[0];p.timer=8+Math.random()*6;if(o2&&o2.state==='sit'){var tt=Math.max(p.timer,o2.timer,10+Math.random()*5);p.timer=o2.timer=tt;}}
          else if(p.state==='fromSeat'){p.state='descend';p.t=0;}
          else{var e=treeHome.entry;p.state='idle';p.timer=1.5;p.ang=Math.atan2(e.z,e.x);p.r=Math.hypot(e.x,e.z);treeHome.occ[p.seat]=null;p.seat=-1;}
        }
      }else if(p.state==='play'){
        p.timer-=dt;var o=p.with;if(o){var op=o.spr?{x:o.x,z:o.z}:pos(o);p.face=Math.atan2(op.x-q.x,op.z-q.z);}
        if(p.act>0&&p.timer<p.act){p.act=0;hearts(q.x,1.5,q.z,2);if(o&&o.spr)o.hop=.5;}
        if(p.timer<=0){p.state='idle';p.timer=1+Math.random()*2;p.with=null;}
      }
      // 動作：走路擺手擺腳、爬梯子、坐著、摸寵物蹲下、揮手
      st=p.state;var climbing=st==='climb'||st==='descend',onDeck=st==='toSeat'||st==='fromSeat',sit=st==='sit',walking=st==='walk'||climbing||onDeck,sw=walking?Math.sin(p.walkT*9)*.6:0,pl=st==='play',pet=pl&&p.with&&p.with.spr;
      if(p.waveT>0)p.waveT-=dt;
      p.legs[0].rotation.x=sit?-1.38:climbing?Math.sin(p.walkT*6)*.5-.3:sw;p.legs[1].rotation.x=sit?-1.38:climbing?-Math.sin(p.walkT*6)*.5-.3:-sw;
      p.arms[0].rotation.x=climbing?-2.4+Math.sin(p.walkT*6)*.35:sit?-.35:-sw*.8;
      p.arms[1].rotation.x=pl||p.waveT>0?-2.4+Math.sin(now*10)*.35:climbing?-2.4-Math.sin(p.walkT*6)*.35:sit?-.35:sw*.8;
      p.b.position.y=walking&&!climbing?Math.abs(Math.sin(p.walkT*9))*.05:sit?-.23:pet?-.12:0;
      p.b.rotation.x=pet?.28:0;
      // 呼吸、眨眼、東張西望；兩個人一起坐的時候頭靠向對方
      p.b.scale.y=1.23*(1+Math.sin(now*2.2+p.ph)*.012);
      p.blink-=dt;var bl=p.blink<0&&p.blink>-.13;p.eyes.forEach(function(e){e.scale.y=bl?.12:1;});if(p.blink<=-.13)p.blink=2.5+Math.random()*3;
      p.hd.rotation.y=st==='idle'?Math.sin(now*.7+p.ph)*.35:0;
      p.hd.rotation.z=sit&&both?(p.seat===0?-.2:.2):0;
      if(climbing){var u=st==='climb'?p.t:1-p.t;_v.lerpVectors(treeHome.entry,treeHome.top,u);p.g.position.copy(_v);p.face=TH_ROT-Math.PI/2;}
      else if(onDeck){var u2=st==='toSeat'?p.t:1-p.t,sp=treeHome.seats[p.seat];_v.lerpVectors(treeHome.top,sp,u2);var dx=sp.x-treeHome.top.x,dz=sp.z-treeHome.top.z;p.face=st==='toSeat'?Math.atan2(dx,dz):Math.atan2(-dx,-dz);p.g.position.copy(_v);}
      else if(sit){p.g.position.copy(treeHome.seats[p.seat]);p.face=TH_ROT;}
      else{q=pos(p);p.g.position.set(q.x,0,q.z);}
      p.sh.visible=!(climbing||onDeck||sit);
      var cur=p.g.rotation.y,df=angDiff(p.face,cur);p.g.rotation.y=cur+df*Math.min(1,dt*8);
    });
  }
  // 下一步做什麼：去樹屋（另一個人在上面的話很想去陪）、去摸寵物、去找另一個人、散步（不走進樹屋底下）
  function choose(p){
    var r=Math.random(),other=people.filter(function(o){return o!==p;})[0],free=treeHome?treeHome.occ.indexOf(null):-1;
    if(free>=0&&other&&(other.state==='sit'||other.state==='toSeat'||other.state==='climb')&&Math.random()<.7)goTree(p,free);
    else if(free>=0&&r<.15)goTree(p,free);
    else if(r<.42&&pets.length){var pt=pets.slice().sort(function(a,b){return Math.abs(angDiff(a.ang,p.ang))-Math.abs(angDiff(b.ang,p.ang));})[0];p.with=pt;pt.wait=Math.max(pt.wait,8);p.state='walk';}
    else if(r<.54&&other&&other.state==='idle'&&!other.with&&!other.toTree){p.with=other;p.state='walk';other.state='idle';other.timer=6;}
    else{p.with=null;for(var n=0;n<6;n++){p.ta=p.ang+(Math.random()-.5)*2.2;p.tr=RING[0]+Math.random()*(RING[1]-RING[0]);if(!nearTree(Math.cos(p.ta)*p.tr,Math.sin(p.ta)*p.tr))break;}p.state='walk';}
  }
  function play(p){
    p.state='play';p.timer=2.8;p.act=2.2;
    // 對方已經在去樹屋的路上或坐在樹屋：只在下面揮揮手
    var o=p.with;if(o&&!o.spr&&!TREE_STATES[o.state]&&!o.toTree){o.state='play';o.with=p;o.timer=2.8;o.act=1.6;}else if(o&&!o.spr){p.with=null;p.waveT=1.6;}
    if(o&&o.spr){o.wait=Math.max(o.wait,3);o.hop=.5;}
  }

  /* ── 來玩的：蝴蝶、蜜蜂、小鳥（點小鳥會送一滴水） ── */
  function makeVisitor(kind){
    var g=new T.Group(),wings=[],col;
    if(kind==='butterfly'){
      col=['#F8C8D4','#B9A6DE','#F6D27A','#A8D3E6','#FFFFFF'][Math.floor(Math.random()*5)];var wm=new T.MeshBasicMaterial({color:col,side:T.DoubleSide});
      var bd=mesh(cyl(.014,.014,.18,4),'#3E3A39');bd.rotation.x=Math.PI/2;g.add(bd);
      [-1,1].forEach(function(s){var pv=new T.Group(),w=new T.Mesh(new T.CircleGeometry(.13,10),wm);w.scale.set(1,1.3,1);w.position.set(s*.12,0,-.02);w.rotation.x=-Math.PI/2;pv.add(w);var w2=new T.Mesh(new T.CircleGeometry(.08,10),wm);w2.position.set(s*.08,0,.11);w2.rotation.x=-Math.PI/2;pv.add(w2);g.add(pv);wings.push(pv);});
    }else if(kind==='bee'){
      var bb=mesh(ball(.07,1),'#F6D27A');bb.scale.set(1,1,1.4);g.add(bb);[-.04,.04].forEach(function(z){var ring=mesh(cyl(.072,.072,.022,10),'#3E3A39',0,0,z);ring.rotation.x=Math.PI/2;g.add(ring);});
      var bw=new T.MeshBasicMaterial({color:'#FFFFFF',transparent:true,opacity:.75,side:T.DoubleSide});[-1,1].forEach(function(s){var pv=new T.Group(),w=new T.Mesh(new T.CircleGeometry(.06,8),bw);w.position.set(s*.06,.05,0);w.rotation.x=-Math.PI/2;pv.add(w);g.add(pv);wings.push(pv);});
    }else{
      col=['#A8D3E6','#F2A497','#F6D27A','#C9A884'][Math.floor(Math.random()*4)];
      var body=mesh(ball(.15,1),col);body.scale.set(1,.85,1.25);g.add(body);g.add(mesh(ball(.1,1),col,0,.13,.14));g.add(mesh(ball(.07,1),'#FFFCF6',0,-.03,.12));
      var bk=mesh(cone(.035,.09,6),'#F2A15B',0,.12,.26);bk.rotation.x=Math.PI/2;g.add(bk);[-.06,.06].forEach(function(x){g.add(mesh(ball(.018,0),'#3E3A39',x,.17,.21));});
      var tl=mesh(ball(.08,1),col,0,.03,-.2);tl.scale.set(.6,.25,1.3);g.add(tl);
      [-1,1].forEach(function(s){var pv=new T.Group();pv.position.set(s*.1,.04,0);var w=mesh(ball(.1,1),col,s*.08,0,-.02);w.scale.set(1.3,.25,.8);pv.add(w);g.add(pv);wings.push(pv);});
    }
    var hb=hit(kind==='bird'?.5:.45,{visitor:1});g.add(hb);
    scene.add(g);
    var a=Math.random()*6.28,far=polar(16,a);g.position.set(far.x,kind==='bird'?7:3,far.z);
    var v={kind:kind,g:g,wings:wings,hb:hb,t:0,life:kind==='bird'?18:22+Math.random()*8,state:'in',target:null,rest:0,from:g.position.clone()};
    hb.userData.v=v;visitors.push(v);
    if(kind==='bird')perch(v);else pickSpot(v);
    return v;
  }
  // 蝴蝶、蜜蜂要飛去哪：有植物的土上面，或草地上隨便一個地方
  function pickSpot(v){
    var ps=plots.filter(function(p){return p.on&&p.id;}),p=ps.length&&Math.random()<.75?ps[Math.floor(Math.random()*ps.length)]:null;
    if(p)v.target=new T.Vector3(p.x+(Math.random()-.5)*.4,p.top+.15,p.z+(Math.random()-.5)*.4);
    else{var q=polar(2+Math.random()*4,Math.random()*6.28);v.target=new T.Vector3(q.x,.8+Math.random(),q.z);}
  }
  // 小鳥停哪：森林裡的樹上，沒有樹就停草地上
  function perch(v){
    var ids=Object.keys(trees),t=ids.length?trees[ids[Math.floor(Math.random()*ids.length)]]:null;
    if(t){var top=new T.Box3().setFromObject(t.g.children[0]).max.y;v.target=new T.Vector3(t.g.position.x,top+.05,t.g.position.z);}
    else{var q=polar(RING[0]+.2+Math.random()*.4,Math.random()*6.28);v.target=new T.Vector3(q.x,.02,q.z);}
    v.from=v.g.position.clone();v.t=0;
  }
  function leave(v){if(v.state==='out')return;v.state='out';var q=polar(18,Math.random()*6.28);v.from=v.g.position.clone();v.target=new T.Vector3(q.x,8,q.z);v.t=0;}
  function moveVisitors(dt){
    if(now>nextVisit){nextVisit=now+18+Math.random()*22;if(visitors.length<3)makeVisitor(['butterfly','butterfly','bee','bird'][Math.floor(Math.random()*4)]);}
    for(var i=visitors.length-1;i>=0;i--){
      var v=visitors[i],g=v.g,pos0=g.position;v.life-=dt;
      if(v.kind==='bird'){
        // 小鳥：飛過來（弧線）→ 停著跳一跳、啄一啄、叫幾聲 → 飛走
        if(v.state==='in'||v.state==='out'){v.t=Math.min(1,v.t+dt/2.4);var k=v.t,np=v.from.clone().lerp(v.target,k);np.y+=Math.sin(k*Math.PI)*1.5;var d=np.clone().sub(pos0);if(d.lengthSq()>1e-6)g.rotation.y=Math.atan2(d.x,d.z);pos0.copy(np);
          v.wings.forEach(function(w,j){w.rotation.z=(j?-1:1)*Math.sin(now*22)*.9;});
          if(k>=1){if(v.state==='out'){scene.remove(g);visitors.splice(i,1);continue;}v.state='sit';v.rest=0;SND.sfx('chirp');}}
        else{v.rest+=dt;v.wings.forEach(function(w,j){w.rotation.z=(j?-1:1)*.15;});var hp=(v.rest%2.6)<.25?Math.sin((v.rest%2.6)/.25*Math.PI)*.12:0;pos0.y=v.target.y+hp;g.rotation.x=(v.rest%3.7)<.3?.5:0;if(Math.random()<dt*.15)SND.sfx('chirp');if(v.life<=0)leave(v);}
        continue;
      }
      // 蝴蝶、蜜蜂：飛向目標、停一下、再換地方；時間到就飛走
      var spd=v.kind==='bee'?1.8:1.1,to=v.target.clone().sub(pos0),dist=to.length();
      if(v.state==='out'){pos0.addScaledVector(to.normalize(),spd*1.6*dt);if(dist<1||pos0.length()>17){scene.remove(g);visitors.splice(i,1);continue;}}
      else if(v.rest>0){v.rest-=dt;if(v.rest<=0)pickSpot(v);}
      else if(dist<.12){v.rest=v.kind==='bee'?.8:2+Math.random()*2;}
      else{to.normalize();pos0.addScaledVector(to,spd*dt);pos0.y+=Math.sin(now*(v.kind==='bee'?14:5)+i)*dt*(v.kind==='bee'?.8:.5);g.rotation.y=Math.atan2(to.x,to.z);}
      if(v.state!=='out'&&v.life<=0)leave(v);
      var fs=v.kind==='bee'?40:(v.rest>0?5:15);v.wings.forEach(function(w,j){w.rotation.z=(j?-1:1)*Math.sin(now*fs)*(v.kind==='bee'?.5:.9);});
    }
  }

  /* ── 森林：長大的植物一圈一圈排在小島外圍 ── */
  function forestSpot(i){var s=spots[i%spots.length],extra=Math.floor(i/spots.length);return {x:Math.cos(s.a+extra*.09)*(s.r-extra*.35),z:Math.sin(s.a+extra*.09)*(s.r-extra*.35),ry:rnd(i+50)*6.28};}
  function setForest(list){
    var keep={};
    list.forEach(function(f,i){
      keep[f.id]=1;if(trees[f.id]&&trees[f.id].i===i)return;
      if(trees[f.id])scene.remove(trees[f.id].g);
      var g=new T.Group(),p=forestSpot(i),pl=plant(f.sp,4),fw=window.SP[f.sp].kind==='flower';
      pl.scale.setScalar(fw?.85:.72);g.add(pl);g.position.set(p.x,0,p.z);g.rotation.y=p.ry;
      var coll=new T.Mesh(cyl(.7,.7,3,8),hitMat);coll.position.y=1.4;coll.visible=false;coll.userData={tree:f.id};g.add(coll);
      scene.add(g);trees[f.id]={g:g,i:i};
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
      var ids=Object.keys(ptrs);if(ids.length>=2){var d=dist();if(pinch0)rad=Math.max(10,Math.min(40,rad0*pinch0/d));return;}
      az-=dx*.006;el=Math.max(.3,Math.min(1.12,el+dy*.0035));if(down)down.moved+=Math.abs(dx)+Math.abs(dy);});
    function up(e){var d=down;delete ptrs[e.pointerId];if(Object.keys(ptrs).length<2)pinch0=0;if(d&&d.moved<10&&Date.now()-d.t<600)pick(e);down=null;}
    cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',function(e){delete ptrs[e.pointerId];down=null;pinch0=0;});
    cv.addEventListener('wheel',function(e){e.preventDefault();rad=Math.max(10,Math.min(40,rad*(1+e.deltaY*.001)));idleAt=Date.now();},{passive:false});
  }
  function dist(){var p=Object.keys(ptrs).map(function(k){return ptrs[k];});return p.length<2?1:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}
  // 點到什麼：小鳥 → 送水、蝴蝶蜜蜂 → 飛走、害蟲 → 抓走、寵物 → 跳一下、人 → 揮手、土 → 種、植物 → 澆水卡片、森林的樹 → 回憶
  function pick(e){
    var r=R.domElement.getBoundingClientRect(),v=new T.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),ray=new T.Raycaster();ray.setFromCamera(v,cam);
    var vh=ray.intersectObjects(visitors.map(function(q){return q.hb;}))[0];
    if(vh){var vv=vh.object.userData.v;hearts(vv.g.position.x,vv.g.position.y+.2,vv.g.position.z,vv.kind==='bird'?3:1);if(vv.kind==='bird'){if(vv.state!=='out')hooks.bird();}else SND.sfx('pop');leave(vv);return;}
    var pt=ray.intersectObjects(plots.filter(function(p){return p.pest;}).map(function(p){return p.pest.hb;}))[0];if(pt){hooks.pest(pt.object.userData.pest);return;}
    var ph=ray.intersectObjects(pets.map(function(p){return p.spr;}))[0];if(ph){var pp=pets.filter(function(p){return p.spr===ph.object;})[0];if(pp){pp.hop=.5;SND.sfx('pop');hearts(pp.x,1.2,pp.z,1);}return;}
    var hu=ray.intersectObjects(people.map(function(p){return p.g.children[3];}))[0];if(hu){var who=people.filter(function(p){return p.k===hu.object.userData.person;})[0];if(who){if(TREE_STATES[who.state]||who.toTree)who.waveT=1.6;else if(who.state!=='play'){who.state='play';who.with=null;who.timer=1.6;who.act=1.2;who.face=Math.atan2(cam.position.x-who.g.position.x,cam.position.z-who.g.position.z);}SND.sfx('tap');}return;}
    var objs=plots.filter(function(p){return p.on;}).map(function(p){return p.coll;});Object.keys(trees).forEach(function(id){objs.push(trees[id].g.children[1]);});
    var h=ray.intersectObjects(objs)[0];if(!h)return;var u=h.object.userData;
    if(u.tree)hooks.tree(u.tree);else if(u.plant)hooks.plant(u.plant);else if(u.slot!=null)hooks.plot(u.slot);
  }

  /* ── 每一格 ── */
  function tick(dt){
    now+=dt;
    place();
    if(Date.now()-skyAt>20000){skyAt=Date.now();sky();}
    clouds.rotation.y+=dt*.012;
    movePets(dt);movePeople(dt);moveVisitors(dt);
    // 溪水往下流、湖上的小鴨子游來游去
    flecks.forEach(function(f){f.userData.t=(f.userData.t+dt*.045)%1;var p=along(f.userData.t),p2=along(Math.min(.999,f.userData.t+.01));f.position.set(p.x,.05,p.z);f.rotation.y=-Math.atan2(p2.z-p.z,p2.x-p.x);});
    ducks.forEach(function(d){var u=d.userData;u.a+=dt*u.s;d.position.set(lake.x+Math.cos(u.a)*u.r,.05+Math.sin(now*2.4+u.r)*.02,lake.z+Math.sin(u.a)*u.r);d.rotation.y=-u.a+(u.s>0?-Math.PI/2:Math.PI/2);});
    plots.forEach(function(p){
      if(p.pop<1){p.pop=Math.min(1,p.pop+dt/.5);}
      if(p.grow<1){p.grow=Math.min(1,p.grow+dt/.6);p.base.scale.setScalar(.01+.99*(1-Math.pow(1-p.grow,3)));}
      var b=p.pop<1?1+.28*Math.sin(p.pop*Math.PI)*(1-p.pop*.4):1;p.holder.scale.setScalar(p.sc*b);
      p.spk.forEach(function(s,i){var a=now*1.4+i*Math.PI/2;s.position.set(p.x+Math.cos(a)*.55,p.top*.85+.1+Math.sin(a*1.7)*.12,p.z+Math.sin(a)*.55);s.rotation.y+=dt*3;});
      if(p.pest){var pg=p.pest.g;pg.position.y=p.pest.y0+Math.abs(Math.sin(now*6))*.03;pg.children.forEach(function(c){if(c.userData.seg!=null)c.position.y=.07+Math.sin(now*8+c.userData.seg)*.025;});pg.rotation.z=Math.sin(now*3)*.08;}
    });
    flies.forEach(function(f){var u=f.userData;u.a+=dt*u.s;f.position.set(Math.cos(u.a)*u.r,u.y+Math.sin(u.a*2.3)*.25,Math.sin(u.a)*u.r);f.material.opacity=night*(.55+.45*Math.sin(u.a*5));});
    for(var i=fx.length-1;i>=0;i--){var f=fx[i];f.t+=dt;f.up(f,dt);if(f.t>=f.dur){if(f.end)f.end();fx.splice(i,1);}}
  }
  function loop(){if(!running)return;requestAnimationFrame(loop);if(!vis||document.hidden){clock.getDelta();return;}var dt=Math.min(.05,clock.getDelta());tick(dt);R.render(scene,cam);}
  // 畫面變大小：直的畫面比較窄，鏡頭退遠一點讓整座島放得下
  function fit(){var a=cam.aspect,t=Math.tan(cam.fov*Math.PI/360)*Math.min(1,a);return Math.max(21,Math.min(31,7.6/t));}
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
      build();addTreehouse();addPeople();bind(cv);size();
      if(window.ResizeObserver)new ResizeObserver(size).observe(box);else addEventListener('resize',size);
      if(window.IntersectionObserver)new IntersectionObserver(function(es){vis=es[0].isIntersecting;}).observe(box);
      clock=new T.Clock();running=true;rad=fitR;nextVisit=6;place();loop();
      return addPets();
    });
  }
  // st.slots：開放的每一格 null 或 {id, sp, stage, frac, r, name, ready, thirsty, pest, pkey}；st.forest：[{id, sp}]（舊的在前）
  function update(st){
    if(!T)return;
    plots.forEach(function(p,i){
      var open=i<st.slots.length,s=open?st.slots[i]:null;
      if(open!==p.on){p.on=open;p.base.visible=p.lab.visible=open;if(open&&p.key===''&&p.stage===-1&&p.seen){p.grow=0;burst(p.x,.4,p.z,10);}p.seen=true;}
      if(!open){setPest(p,null);return;}
      var key=s?[s.id,s.sp,s.stage].join(':'):'';
      if(key!==p.key){
        var grew=s&&(p.id===s.id?s.stage>p.stage:p.key==='');
        p.key=key;p.id=s?s.id:null;p.stage=s?s.stage:-1;
        while(p.holder.children.length)p.holder.remove(p.holder.children[0]);
        if(s){p.holder.add(plant(s.sp,s.stage));p.holder.scale.setScalar(1);p.top=height(p.holder);if(grew)pop(p);}else p.top=.3;
        p.coll.userData=s?{plant:s.id}:{slot:i};
      }
      p.sc=s&&s.stage>0?.9+.1*(s.frac||0):1;
      p.holder.rotation.z=s&&s.thirsty?.17:0;
      setPest(p,s&&s.pest,s&&s.pkey);
      // 長大了：旁邊繞著四顆小星星
      var want=s&&s.ready?4:0;
      while(p.spk.length<want){var m=new T.Mesh(new T.OctahedronGeometry(.08),new T.MeshBasicMaterial({color:'#F6D27A'}));scene.add(m);p.spk.push(m);}
      while(p.spk.length>want){scene.remove(p.spk.pop());}
      var PN={bug:'🐛',snail:'🐌',beetle:'🪲'};
      drawLabel(p.lab,s?{text:(s.pest?PN[s.pest]+' ':s.ready?'✨ ':'')+s.name,frac:s.r,ready:s.ready,pest:!!s.pest,thirsty:s.thirsty,sub:s.thirsty&&!s.pest?'口渴了…':''}:{text:'＋',empty:true});
      p.lab.position.y=(s?p.top+.3:.45);
    });
    setForest(st.forest||[]);
  }
  function water(id){var p=plots.filter(function(q){return q.id===id;})[0];if(!p)return;rain(p);hop();}
  // 測試用：某個東西在畫面上的位置、特效和訪客數量、叫一隻訪客來
  function screen(o){
    var v=null;
    if(typeof o==='number')v=new T.Vector3(PLOT[o][0],.5,PLOT[o][1]);
    else if(typeof o==='string'&&trees[o])v=trees[o].g.position.clone().setY(.8);
    else if(o&&o.pest){var p=plots.filter(function(q){return q.id===o.pest&&q.pest;})[0];if(p)v=p.pest.g.position.clone().setY(.3);}
    else if(o&&o.visitor!=null&&visitors[o.visitor])v=visitors[o.visitor].g.position.clone();
    else if(o&&o.person){var h=people.filter(function(q){return q.k===o.person;})[0];if(h)v=h.g.position.clone().setY(.9);}
    if(!v)return null;v.project(cam);var r=R.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};
  }
  return {resetView:function(){az=.45;el=.62;rad=fitR;tgt.set(0,.7,0);idleAt=Date.now();place();},init:init,update:update,water:water,shoo:shoo,hop:hop,active:function(){return !!T&&running;},screen:screen,
    fxCount:function(){return fx.length;},visitors:function(){return visitors.map(function(v){return v.kind+':'+v.state;});},
    spawn:function(k){var v=makeVisitor(k);return visitors.indexOf(v);},people:function(){return people.map(function(p){return p.k+':'+p.state+(p.with?'>'+(p.with.k||'?'):'');});},
    look:function(a,e2,r2,tx,ty,tz){az=a;el=e2;if(r2)rad=r2;if(tx!=null)tgt.set(tx,ty,tz);idleAt=Date.now()+1e9;},
    toTree:function(k){var p=people.filter(function(o){return o.k===k;})[0],i=treeHome.occ.indexOf(null);if(p&&i>=0&&!TREE_STATES[p.state]&&!p.toTree){p.timer=0;goTree(p,i);}},tree:function(){return {c:treeHome.c,rot:TH_ROT,entry:treeHome.entry,occ:treeHome.occ.map(function(o){return o&&o.k;}),pp:people.map(function(p){return [p.k,p.state,+p.ang.toFixed(2),+p.r.toFixed(2),+p.ta.toFixed(2),+p.tr.toFixed(2),!!p.toTree];})};}};
})();


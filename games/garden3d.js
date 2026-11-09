/* 記憶小森林的 3D 花園（three.js 0.160）
   地上的小島：一片花園空地，中間是土（花園升級最多 12 塊），外圍一圈森林、一圈沙土小路；一邊有個小泉水池，泉水流成小溪繞過花園、流進旁邊的小湖；
   外面是一直到地平線的草原、小山丘和樹，遠方一圈山脈。升級會開放新土地（用小路接到花園外面），每塊多三塊土、也多很多地方種森林。
   森林的樹可以「移植」：點空地選新位置；長大中的植物可以搬到別塊土（點有植物的土就交換）。
   花園左後方的草地跟著時間換：白天溜滑梯、盪鞦韆，傍晚長椅看夕陽，晚上營火烤棉花糖；學和綾會自己過去玩，點它們也會叫他們來。
   季節（春櫻花瓣、夏天更多螢火蟲、秋天落葉和紅樹、冬天淡淡的）和天氣（晴、多雲、下雨撐傘、下雪）跟著 garden.html 算好的日期走，兩支手機一樣。
   裝飾品（信箱、路燈、花拱門、風車、稻草人、鳥屋、野餐墊）從 garden.html 的 D.decor 傳進來；擺放、移動跟移植一樣點草地選位置。
   紀念日（st.party）：氣球、彩帶紙片、空中的橫幅、生日蛋糕、壽星的派對帽，晚上放煙火。
   學和綾會走去開放的新土地散步：從花園的路口走到外圈沙土小路、沿著小路走到那塊地（過溪走橋），逛一逛再走回來。
   學和綾、三隻寵物在島上散步，偶爾走去摸摸寵物、跟對方打招呼；蝴蝶、蜜蜂、小鳥會飛來玩，害蟲會跑到植物上。
   拖曳轉一圈、兩指（或滾輪）拉近；點土種樹、點植物澆水、點害蟲抓走、點小鳥收禮物、點森林的樹看回憶。天空跟著現在幾點變。
   garden.html：Garden3D.init(盒子,{plot,plant,tree,pest,bird,land,moveSel}) → update({slots,open,lands,forest}) → water(id)、shoo(id)、hop()；
   移植：move('tree'|'plot',id) 開始 → 使用者點了目標就呼叫 hooks.moveSel → moveEnd()；freeSpot()、forestPos() 給 garden.html 存位置。
   植物的種類、顏色都用 garden.html 的 SP。 */
var Garden3D=(function(){
  var SRC='https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';
  var T=null,R,scene,cam,box,hooks,clock,GM,mats={},geos={},cloudMat,dropMat,waterMat,heartTex,hitMat;
  var plots=[],trees={},pets=[],people=[],visitors=[],fx=[],flecks=[],ducks=[],lake=null,stars,flies=[],clouds,sun,hemi,skyAt=0,night=0,nextVisit=0,spots=[],flow=[],bridges=[],lands={},pondP=null,mv=null,lastSt=null,tgoal=null,rgoal=0,agoal=null,egoal=null;
  var tScale=1,az=.45,el=.62,rad=0,fitR=-1,tgt,ptrs={},pinch0=0,rad0=0,down=null,idleAt=0,running=false,vis=true,now=0;
  // 小島半徑、散步的那一圈、泉水池（溪的源頭）在哪個方向、溪水往小湖流出去的方向
  var ISL=8.6,RING=[4.65,7.1],MT=-2.2,WF=-.15;
  // 遊樂區：花園左後方的草地（中心的方向、離中間多遠）；裡面用「區域座標」：x 沿著圓周、z 往外（正的是外面）
  var AREA_A=-2.75,AREA_R=7.35,AREA_ROT=Math.atan2(Math.cos(AREA_A),Math.sin(AREA_A)),SLIDE_Y=1.26,SWING_Y=1.95;
  function AWp(x,z){var c=Math.cos(AREA_A),s=Math.sin(AREA_A);return {x:c*AREA_R+x*s+z*c,z:s*AREA_R-x*c+z*s};}
  function AP(x,z){var q=AWp(x,z);return {a:Math.atan2(q.z,q.x),r:Math.hypot(q.x,q.z)};}
  function toArea(x,z){var c=Math.cos(AREA_A),s=Math.sin(AREA_A),dx=x-c*AREA_R,dz=z-s*AREA_R;return {x:dx*s-dz*c,z:dx*c+dz*s};}
  function inArea(x,z,m){var l=toArea(x,z);m=m||0;return l.x>-2.6-m&&l.x<2.6+m&&l.z>-.8-m&&l.z<1.45+m;}
  // 溪流最後往外流進小湖的幾個點（半徑、方向）
  var FLOW_OUT=[[6.6,WF-.24],[7.25,WF-.13],[7.95,WF-.05],[ISL+.1,WF],[9.5,WF+.03]];
  // 十二塊土：中間六塊先開，升級再開前後、左右
  var PLOT=[[-2.2,-1.1],[0,-1.1],[2.2,-1.1],[-2.2,1.1],[0,1.1],[2.2,1.1],[-1.1,-3],[1.1,-3],[-1.1,3],[1.1,3],[-4.1,0],[4.1,0]];
  // 新土地：四塊，從花園外圈的小路接出去（a 方向、r 中心離島中間多遠、R 半徑、vo 看它的時候鏡頭偏一點，避開樹屋）；每塊三塊土排一排
  var LAND_IDS=['orchard','west','hill','lake'],LAND_GEO={orchard:{a:-.95,r:14.6,R:4.6},west:{a:3.0,r:14.6,R:4.6,vo:.9},hill:{a:-1.95,r:14.8,R:4.4},lake:{a:.75,r:14.6,R:4.4}};
  LAND_IDS.forEach(function(id){var L=LAND_GEO[id];L.id=id;var cx=Math.cos(L.a)*L.r,cz=Math.sin(L.a)*L.r,vx=-Math.sin(L.a),vz=Math.cos(L.a);L.c={x:cx,z:cz};L.p0=PLOT.length;[-1.7,0,1.7].forEach(function(k){PLOT.push([+(cx+vx*k).toFixed(2),+(cz+vz*k).toFixed(2)]);});});
  function landOf(i){for(var j=0;j<LAND_IDS.length;j++){var L=LAND_GEO[LAND_IDS[j]];if(i>=L.p0&&i<L.p0+3)return L;}return null;}
  // 這個點在不在新土地上（m 多留一點邊）；草原上的樹和灌木要讓開
  function onLand(x,z,m){for(var j=0;j<LAND_IDS.length;j++){var L=LAND_GEO[LAND_IDS[j]];if(Math.hypot(x-L.c.x,z-L.c.z)<L.R+m)return true;var u=x*Math.cos(L.a)+z*Math.sin(L.a),v=-x*Math.sin(L.a)+z*Math.cos(L.a);if(u>ISL&&u<L.r&&Math.abs(v)<.8+m)return true;}return false;}
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
  /* ── 省效能：把一起動（或都不動）的小零件合成一個，同一種材質合成一份，畫一格少很多次 ──
     root 底下的 mesh 照材質分堆合起來（座標換成 root 自己的）；會自己動的東西標 userData.dyn、或放在 stop 裡就不合 */
  function mergeList(list,inv){
    var pos=[],nor=[],m=new T.Matrix4(),nm=new T.Matrix3(),v=new T.Vector3(),n=new T.Vector3();
    list.forEach(function(c){
      var g=c.geometry.index?c.geometry.toNonIndexed():c.geometry,P=g.attributes.position,N=g.attributes.normal;
      m.multiplyMatrices(inv,c.matrixWorld);nm.getNormalMatrix(m);var flip=m.determinant()<0;
      for(var i=0;i<P.count;i++){var j=flip?i-i%3+2-i%3:i;v.fromBufferAttribute(P,j).applyMatrix4(m);pos.push(v.x,v.y,v.z);if(N){n.fromBufferAttribute(N,j).applyMatrix3(nm).normalize();nor.push(n.x,n.y,n.z);}else nor.push(0,1,0);}
      if(g!==c.geometry)g.dispose();
    });
    var geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(nor,3));geo.computeBoundingSphere();return geo;
  }
  function bake(root,stop){
    root.updateMatrixWorld(true);
    var inv=new T.Matrix4().copy(root.matrixWorld).invert(),bins={};
    (function walk(o){o.children.slice().forEach(function(c){
      if(c.userData.dyn||(stop&&stop.indexOf(c)>=0))return;
      if(c.isMesh&&!c.isInstancedMesh&&c.visible&&c.material!==hitMat&&!Array.isArray(c.material)&&!c.children.length){var k=c.material.uuid+(c.castShadow?'c':'')+(c.receiveShadow?'r':'');(bins[k]=bins[k]||{m:c.material,cs:c.castShadow,rs:c.receiveShadow,list:[]}).list.push(c);}
      else if(!c.isMesh&&!c.isSprite&&!c.isPoints&&!c.isLight)walk(c);
    });})(root);
    Object.keys(bins).forEach(function(k){var B=bins[k];if(B.list.length<2)return;var mm=new T.Mesh(mergeList(B.list,inv),B.m);mm.castShadow=B.cs;mm.receiveShadow=B.rs;B.list.forEach(function(c){c.parent.remove(c);});root.add(mm);});
    return root;
  }
  function angDiff(a,b){var d=a-b;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;}

  /* ── 植物：照種類和階段（0 種子～4 長大）用簡單的形狀拼 ── */
  function stem(g,h,r){g.add(mesh(cyl(r*.8,r,h,6),LEAF2,0,h/2,0));}
  function leaf(g,y,ang,s){var l=mesh(ball(.16),LEAF);l.scale.set(s,.26*s,.5*s);l.position.set(Math.cos(ang)*.14*s,y,Math.sin(ang)*.14*s);l.rotation.set(0,-ang,.5);g.add(l);}
  function leaves(g,ys,s){ys.forEach(function(y,i){leaf(g,y,i*2.1,s);leaf(g,y-.03,i*2.1+Math.PI,s*.9);});}
  function petals(g,y,k,c,n,len,disk,dr){var h=new T.Group();h.add(mesh(cyl(dr,dr,.07,12),disk));for(var i=0;i<n;i++){var a=i*Math.PI*2/n,p=mesh(ball(.1),c);p.scale.set(len,.22,.45);p.position.set(Math.cos(a)*(dr+.085*len),0,Math.sin(a)*(dr+.085*len));p.rotation.y=-a;h.add(p);}h.rotation.x=1.05;h.position.y=y;h.scale.setScalar(k);g.add(h);}
  function tulip(g,y,k,c){var h=new T.Group();for(var i=0;i<3;i++){var a=i*Math.PI*2/3,p=mesh(ball(.13),c);p.scale.set(.75,1.35,.75);p.position.set(Math.cos(a)*.07,0,Math.sin(a)*.07);p.rotation.set(Math.sin(a)*.25,0,-Math.cos(a)*.25);h.add(p);}h.position.y=y;h.scale.setScalar(k);g.add(h);}
  function rose(g,y,k,c){var h=new T.Group();h.add(mesh(ball(.09),c));for(var i=0;i<5;i++){var a=i*1.2566,p=mesh(ball(.09),c);p.scale.set(1,.9,.55);p.position.set(Math.cos(a)*.08,-.02,Math.sin(a)*.08);p.rotation.y=-a+Math.PI/2;h.add(p);}for(var j=0;j<5;j++){var b=j*1.2566+.6,q=mesh(ball(.1),c);q.scale.set(1.1,.8,.5);q.position.set(Math.cos(b)*.14,-.05,Math.sin(b)*.14);q.rotation.y=-b+Math.PI/2;q.rotateX(.4);h.add(q);}h.position.y=y;h.scale.setScalar(k);g.add(h);}
  function hydra(g,y,k,c){var h=new T.Group();for(var i=0;i<14;i++){var u=i*2.39996,v=Math.acos(1-(i+.5)/14);h.add(mesh(ball(.075,0),i%3?c:'#C9B8F0',Math.sin(v)*Math.cos(u)*.2,Math.cos(v)*.16,Math.sin(v)*Math.sin(u)*.2));}h.position.y=y;h.scale.setScalar(k);g.add(h);}
  function lilyH(g,y,k,c){var h=new T.Group();for(var i=0;i<6;i++){var a=i*Math.PI/3,p=mesh(ball(.1),c);p.scale.set(1.5,.2,.45);p.position.set(Math.cos(a)*.13,.06,Math.sin(a)*.13);p.rotation.set(0,-a,.6);h.add(p);h.add(mesh(ball(.028,0),'#F2A0B5',Math.cos(a)*.1,.07,Math.sin(a)*.1));}for(var j=0;j<3;j++){var b=j*2.1;h.add(mesh(ball(.022,0),'#E8913A',Math.cos(b)*.04,.17,Math.sin(b)*.04));}h.rotation.x=.45;h.position.y=y;h.scale.setScalar(k);g.add(h);}
  function puff(g,y,k){var h=new T.Group();h.add(mesh(ball(.2,1),'#FFFFFF'));for(var i=0;i<18;i++){var u=i*2.39996,v=Math.acos(1-(i+.5)/9);h.add(mesh(ball(.03,0),'#E9E2D6',Math.sin(v)*Math.cos(u)*.21,Math.cos(v)*.21,Math.sin(v)*Math.sin(u)*.21));}h.position.y=y+.12;h.scale.setScalar(k);g.add(h);}
  function head(sp,g,y,k,c){if(sp==='bellflower')petals(g,y,k,c,5,1.15,'#F4F1FF',.05);else if(sp==='lily')lilyH(g,y,k,c);else if(sp==='dandelion'){if(k<1)petals(g,y,k,c,16,.7,'#F2B83A',.07);else puff(g,y,k);}else if(sp==='sunflower')petals(g,y,k,c,12,1.1,'#8C6A55',.19);else if(sp==='daisy')petals(g,y,k,c,12,.9,'#F6D27A',.1);else if(sp==='cosmos')petals(g,y,k,c,8,1.2,'#F6D27A',.08);else if(sp==='rose')rose(g,y,k,c);else if(sp==='hydrangea')hydra(g,y,k,c);else tulip(g,y+.05,k,c);}
  function plant(sp,stage){var w=new T.Group(),g=model(sp,stage);g.scale.setScalar(PS);w.add(g);return bake(w);}
  function model(sp,stage){
    var S=window.SP[sp],g=new T.Group();
    if(stage===0){var sd=mesh(ball(.12),'#E2B88E',0,.06,0);sd.scale.y=.7;g.add(sd);return g;}
    if(stage===1){stem(g,.38,.035);leaf(g,.36,0,.9);leaf(g,.34,Math.PI,.9);return g;}
    if(S.kind==='flower'){
      if(sp==='lavender'){var H=[0,0,.75,1,1.15][stage],col=stage===2?LEAF:S.c;[-.12,0,.12].forEach(function(dx,i){var hh=H-(i===1?0:.12),st=new T.Group();stem(st,hh,.025);for(var j=0;j<6;j++)st.add(mesh(ball(.055,0),col,(j%2?.03:-.03),hh-.04-j*.07,0));st.position.x=dx;st.rotation.z=-dx*1.4;g.add(st);});leaf(g,.15,0,.8);leaf(g,.13,Math.PI,.8);return g;}
      if(sp==='succulent'){var k2=[0,0,.6,.8,1][stage];for(var i=0;i<8;i++){var a=i*Math.PI/4,l=mesh(ball(.14),S.c);l.scale.set(.5,.32,1.2);l.position.set(Math.cos(a)*.18*k2,.08,Math.sin(a)*.18*k2);l.rotation.set(0,-a+Math.PI/2,0);l.rotateX(-.55);l.scale.multiplyScalar(k2);g.add(l);}for(var j=0;j<5;j++){var b2=j*Math.PI*2/5+.3,m2=mesh(ball(.1),S.c);m2.scale.set(.5,.4,1);m2.position.set(Math.cos(b2)*.07*k2,.16*k2,Math.sin(b2)*.07*k2);m2.rotation.set(0,-b2+Math.PI/2,0);m2.rotateX(-1);m2.scale.multiplyScalar(k2);g.add(m2);}if(stage===4){stem(g,.5,.02);g.add(mesh(ball(.07),'#F8C8D4',0,.52,0));}return g;}
      if(sp==='strawberry'){var k3=[0,0,.75,.9,1][stage];
        for(var i3=0;i3<5;i3++){var a3=i3*1.2566+.3,lg=new T.Group();lg.position.set(Math.cos(a3)*.15*k3,0,Math.sin(a3)*.15*k3);lg.rotation.y=-a3;lg.add(mesh(cyl(.012,.015,.16*k3,4),LEAF2,0,.08*k3,0));
          for(var j3=0;j3<3;j3++){var b3=(j3-1)*.75,l3=mesh(ball(.07),LEAF);l3.scale.set(1.2,.3,.9);l3.position.set(Math.cos(b3)*.06*k3+.05*k3,.16*k3,Math.sin(b3)*.06*k3);l3.rotation.y=-b3;lg.add(l3);}g.add(lg);}
        if(stage===3)[[.12,.08],[-.1,-.1]].forEach(function(c){var f=new T.Group();petals(f,0,.35,'#FFFFFF',5,.9,'#F6D27A',.05);f.children[0].rotation.x=0;f.position.set(c[0],.3,c[1]);g.add(f);});
        if(stage===4)[[.21,.06],[-.19,.09],[.03,-.21],[-.07,.22]].forEach(function(c){var br=mesh(cone(.07,.15,8),S.c,c[0],.1,c[1]);br.rotation.x=Math.PI;g.add(br);var cx=mesh(ball(.045,0),LEAF2,c[0],.18,c[1]);cx.scale.y=.4;g.add(cx);for(var sd=0;sd<3;sd++)g.add(mesh(ball(.01,0),'#F6E06E',c[0]+Math.cos(sd*2.1)*.05,.11,c[1]+Math.sin(sd*2.1)*.05));});
        return g;}
      if(sp==='lilyvalley'||sp==='orchid'){var k4=[0,0,.75,.9,1][stage],orc=sp==='orchid';
        if(orc)for(var i4=0;i4<3;i4++){var a4=i4*2.1+.4,l4=mesh(ball(.16),LEAF2);l4.scale.set(1.5*k4,.18,.55*k4);l4.position.set(Math.cos(a4)*.17*k4,.06,Math.sin(a4)*.17*k4);l4.rotation.y=-a4;l4.rotateZ(-.15);g.add(l4);}
        else[-1,1].forEach(function(sd){var l5=mesh(ball(.12),sd<0?LEAF:LEAF2);l5.scale.set(1.05,2.3*k4,.16);l5.position.set(sd*.08,.27*k4,-.02);l5.rotation.set(-.12,sd*.35,sd*-.32);g.add(l5);});
        if(stage>=3){var P0=new T.Vector3(0,orc?.05:0,.03),P1=new T.Vector3(orc?-.05:.02,(orc?1.25:1.3)*k4,.05),P2=new T.Vector3((orc?.42:.36)*k4,(orc?.92:.82)*k4,.12),Q=function(t){return new T.Vector3().addScaledVector(P0,(1-t)*(1-t)).addScaledVector(P1,2*(1-t)*t).addScaledVector(P2,t*t);};
          for(var s4=0;s4<6;s4++)rod(g,Q(s4/6),Q((s4+1)/6),.013,orc?'#7FA86A':LEAF2);
          (orc?[.55,.75,.95]:[.38,.52,.66,.8,.93]).forEach(function(t,i){var p=Q(t);
            if(!orc){var rb=stage===4?.08-i*.005:.05,bl=mesh(ball(rb,1),stage===4?S.c:'#E9F3DE',p.x,p.y-.05-rb,p.z);bl.scale.y=.9;g.add(bl);var lip=mesh(cyl(rb*1.05,rb*1.15,rb*.35,8),stage===4?S.c:'#E9F3DE',p.x,p.y-.05-rb*1.55,p.z);g.add(lip);rod(g,p,new T.Vector3(p.x,p.y-.06,p.z),.007,LEAF2);return;}
            if(stage===3){g.add(mesh(ball(.045,1),S.c,p.x,p.y-.05,p.z));return;}
            var f=new T.Group();f.position.set(p.x,p.y-.09,p.z+.03);[[0,.075,.055,.065],[-.08,0,.075,.07],[.08,0,.075,.07],[-.045,-.06,.04,.04],[.045,-.06,.04,.04]].forEach(function(q){var pt=mesh(ball(q[2]),S.c,q[0],q[1],0);pt.scale.set(1,q[3]/q[2],.3);f.add(pt);});
            var lip=mesh(ball(.035),'#C94A8A',0,-.035,.025);lip.scale.set(1,.8,.5);f.add(lip);f.add(mesh(ball(.012,0),'#F6D27A',0,0,.035));f.scale.setScalar(i===2?.85:1);g.add(f);});}
        return g;}
      var h2=[0,0,.75,1,1.2][stage];stem(g,h2,.04);leaves(g,stage===2?[.3,.5]:[.3,.55,.8],stage===2?.9:1);
      if(stage===2)g.add(mesh(ball(.1),sp==='sunflower'||sp==='hydrangea'?LEAF:S.c,0,h2+.04,0));
      else head(sp,g,h2+.05,stage===3?.72:1,S.c);
      return g;
    }
    // 竹子：一根一根、一節一節
    if(S.shape==='bamboo'){var n=stage-1,BH=[0,0,.9,1.4,1.9][stage];for(var b=0;b<n;b++){var hh2=BH*(1-.12*(b%2)),st2=new T.Group();st2.add(mesh(cyl(.05,.06,hh2,7),S.c,0,hh2/2,0));for(var y2=.28;y2<hh2;y2+=.3)st2.add(mesh(cyl(.064,.064,.035,7),'#6FA35E',0,y2,0));for(var lf=0;lf<3;lf++){var la=lf*2.1+b,lm=mesh(ball(.12),LEAF2);lm.scale.set(1.3,.18,.4);lm.position.set(Math.cos(la)*.14,hh2-.1-lf*.12,Math.sin(la)*.14);lm.rotation.set(0,-la,-.4);st2.add(lm);}st2.position.set((b-(n-1)/2)*.2,0,b%2?.08:-.06);g.add(st2);}return g;}
    // 椰子樹：彎彎的樹幹、大葉子，長大有椰子
    if(S.shape==='palm'){var seg=[0,0,2,4,6][stage],c3=stage===4?S.c:LEAF,x=0,y=0;for(var s2=0;s2<seg;s2++){var sm=mesh(cyl(.08-.004*s2,.1-.004*s2,.3,7),s2%2?'#C9A884':'#B39275',x,y+.15,0);sm.rotation.z=-.08*s2;g.add(sm);x+=.03*s2;y+=.29;}var fr=[0,0,4,6,7][stage];for(var f=0;f<fr;f++){var fa=f*Math.PI*2/fr,fm=mesh(ball(.2),c3);fm.scale.set(2.1,.14,.5);fm.position.set(x+Math.cos(fa)*.32,y-.02,Math.sin(fa)*.32);fm.rotation.set(0,-fa,-.45);g.add(fm);}if(stage===4)for(var cc=0;cc<3;cc++)g.add(mesh(ball(.07),S.dot,x+Math.cos(cc*2.1)*.1,y-.1,Math.sin(cc*2.1)*.1));return g;}
    // 梅花樹：深色彎彎的枝幹，長大開滿粉白色的小花
    if(S.shape==='branch'){var k6=[0,0,.55,.8,1][stage],H6=.7*k6,tips=[];
      g.add(mesh(cyl(.07*k6+.02,.12*k6+.02,H6,6),'#6E5449',0,H6/2,0));
      [[-.5,.75,.2],[.45,.7,-.1],[-.2,.95,-.35],[.25,1.0,.3],[0,1.15,0]].slice(0,stage===2?3:5).forEach(function(b){var a=new T.Vector3(0,H6*.85,0),e=new T.Vector3(b[0]*k6*1.3,H6+b[1]*k6*.7,b[2]*k6*1.3);rod(g,a,e,.035*k6+.012,'#6E5449');var m=a.clone().lerp(e,.55),tw=m.clone().add(new T.Vector3(b[2]*.25*k6,.2*k6,-b[0]*.25*k6));rod(g,m,tw,.02*k6+.008,'#6E5449');tips.push(e,tw,a.clone().lerp(e,.8));});
      if(stage>=3)tips.forEach(function(t,i){if(stage===3){g.add(mesh(ball(.035,0),S.dot,t.x,t.y,t.z));return;}for(var j=0;j<3;j++)g.add(mesh(ball(.055,0),j===0?S.dot:(i%3?S.c:'#F7B8C8'),t.x+(rnd(i*7+j)-.5)*.14,t.y+(rnd(i*5+j+1)-.5)*.1,t.z+(rnd(i*3+j+2)-.5)*.14));});
      return g;}
    // 柳樹：小小的樹冠，細細的枝條垂下來
    if(S.shape==='willow'){var k7=[0,0,.55,.82,1][stage],H7=.95*k7,col7=stage===4?S.c:LEAF;
      g.add(mesh(cyl(.07*k7+.02,.13*k7+.03,H7,7),TRUNK,0,H7/2,0));var cr=mesh(ball(.45*k7),col7,0,H7+.12*k7,0);cr.scale.set(1.15,.55,1.15);g.add(cr);
      for(var i7=0;i7<16;i7++){var a7=i7*2.39996,r7=(.3+.08*(i7%3))*k7,len=(.55+rnd(i7+9)*.35)*k7,st7=mesh(ball(.1),i7%2?col7:LEAF2);st7.scale.set(.35,len*5,.35);st7.position.set(Math.cos(a7)*r7,H7+.12*k7-len/2,Math.sin(a7)*r7);st7.rotation.set(Math.sin(a7)*.12,0,-Math.cos(a7)*.12);g.add(st7);}
      return g;}
    // 仙人掌：一根圓柱、兩隻手，長大頭上開一朵花
    if(S.shape==='cactus'){var k8=[0,0,.5,.8,1][stage],H8=1.05*k8,R8=.17*k8+.05;
      g.add(mesh(cyl(R8,R8,H8,10),S.c,0,H8/2,0));g.add(mesh(ball(R8,2),S.c,0,H8,0));
      for(var i8=0;i8<14;i8++){var a8=i8*2.39996;g.add(mesh(ball(.014,0),'#FFFCF6',Math.cos(a8)*R8*1.02,(.12+.8*((i8*.37)%1))*H8,Math.sin(a8)*R8*1.02));}
      if(stage>=3)[[-1,.45,.32],[1,.6,.26]].forEach(function(c){var ay=H8*c[1],ar=R8*.62,ax=c[0]*(R8+.13*k8),hz=mesh(cyl(ar,ar,Math.abs(ax),8),S.c,ax/2,ay,0);hz.rotation.z=Math.PI/2;g.add(hz);var up=H8*c[2];g.add(mesh(cyl(ar,ar,up,8),S.c,ax,ay+up/2,0));g.add(mesh(ball(ar,1),S.c,ax,ay+up,0));g.add(mesh(ball(ar,1),S.c,ax,ay,0));});
      if(stage===4){var f8=new T.Group();petals(f8,0,.55,S.dot,8,.9,'#F6D27A',.05);f8.children[0].rotation.x=0;f8.position.y=H8+R8*.9;g.add(f8);}
      return g;}
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
    if(stage===4&&S.shape==='drape'){for(var c9=0;c9<11;c9++){var a9=c9*.571+.2,n9=4+(c9%2),r9=.62+(c9%3)*.05;g.add(mesh(cyl(.006,.006,.12,3),'#8C9A55',Math.cos(a9)*r9,Ht-.02,Math.sin(a9)*r9));for(var j9=0;j9<n9;j9++)g.add(mesh(ball(.05-j9*.004,0),S.dot,Math.cos(a9)*r9+(j9%2?.012:-.012),Ht-.1-j9*.085,Math.sin(a9)*r9));}return g;}
    if(stage===4&&S.dot){var r=sp==='cherry'||sp==='maple'||sp==='ginkgo'||sp==='jacaranda'?.06:.085;var out=sp==='persimmon'?.17:.08;spots2.forEach(function(p){var o=new T.Vector3(p[0],0,p[2]).normalize();g.add(mesh(ball(r,0),S.dot,p[0]+o.x*out,Ht+p[1]*k,p[2]+o.z*out));});}
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

  /* ── 場景：花園空地、泉水池、溪流、小橋、小湖、草原、遠方的山 ── */
  function ribbon(pts,w,y,mat){
    var pos=[],idx=[];
    pts.forEach(function(p,i){var a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],tx=b.x-a.x,tz=b.z-a.z,l=Math.hypot(tx,tz)||1,nx=-tz/l,nz=tx/l,ww=(typeof w==='function'?w(i/(pts.length-1)):w)/2;pos.push(p.x+nx*ww,y,p.z+nz*ww,p.x-nx*ww,y,p.z-nz*ww);if(i)idx.push(2*i-2,2*i,2*i-1,2*i-1,2*i,2*i+1);});
    var g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();
    var m=new T.Mesh(g,mat);m.receiveShadow=true;return m;
  }
  function along(t){var n=flow.length-1,f=Math.max(0,Math.min(n-1e-6,t*n)),i=Math.floor(f),k=f-i,a=flow[i],b=flow[i+1];return {x:a.x+(b.x-a.x)*k,z:a.z+(b.z-a.z)*k};}
  /* ── 樹屋：在小島左前方，陽台朝向預設鏡頭；陽台上有兩人座長椅（學和綾可以一起坐），梯子在靠島中間那邊 ── */
  var holdAI=false,TH_A=2.35,TH_R=6.3,TH_ROT=Math.PI-2.35,treeHome=null,TSW={x:-2.25,z:-.4,py:3.43,L:2.93}; // TH_ROT：讓梯子那邊朝島中間、陽台朝前面
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
    // 盪鞦韆：左邊樹枝垂下來，學和綾可以來盪（兩個人的話一個坐、一個在後面推）
    var bough=mesh(cyl(.07,.1,2.5,7),'#8E6A55',-1.5,3.55,-.4);bough.rotation.z=Math.PI/2+.15;g.add(bough);
    var sw=new T.Group();sw.position.set(TSW.x,TSW.py,TSW.z);sw.userData.dyn=true;g.add(sw);
    [-.2,.2].forEach(function(dx){sw.add(mesh(cyl(.014,.014,TSW.L,4),'#C9A884',dx,-TSW.L/2,0));});
    sw.add(mesh(new T.BoxGeometry(.56,.06,.3),'#B9845E',0,-TSW.L,0));sw.add(mesh(ball(.045,1),'#F8C8D4',.19,-TSW.L+.045,.07));sw.add(mesh(ball(.035,1),'#FFFFFF',.13,-TSW.L+.04,.09));
    bake(sw);
    var swHit=new T.Mesh(cyl(.6,.6,3.2,12),hitMat);swHit.position.set(TSW.x,1.6,TSW.z);swHit.rotation.y=.13;swHit.visible=false;swHit.userData={act:'tswing',hr:.85};g.add(swHit);
    ACTS.tswing={occ:[null,null],x:[TSW.x,TSW.x],phi:0,vel:0,amp:0,t:0,g:sw};ACTS.hits.all=[swHit];
    // 大樹冠蓋在屋頂上
    [[0,6.25,-.85,1.6,'#86B67C'],[-1.3,5.85,-.5,1.15,'#9AC58C'],[1.35,5.95,-.7,1.2,'#77AA74'],[.15,5.8,.05,1.05,'#9AC58C'],[-.35,6.7,-1.35,1.05,'#86B67C'],[.9,6.75,-1.15,.9,'#9AC58C']].forEach(function(q){var m=mesh(ball(q[3],2),q[4],q[0],q[1],q[2]);m.scale.set(1.15,.82,1.05);g.add(m);});
    [[-1.45,5.5,0],[1.5,5.6,-.2],[.6,5.4,.65],[-.6,5.45,.6]].forEach(function(q,i){g.add(mesh(ball(.09,1),['#F8C8D4','#FFFFFF','#F6D27A','#F8C8D4'][i],q[0],q[1],q[2]));});
    // 人物用的位置（世界座標）
    g.updateMatrixWorld(true);
    function w(x,y,z){return g.localToWorld(new T.Vector3(x,y,z));}
    bake(g);
    treeHome={g:g,Y:Y,occ:[null,null],entry:w(2.75,0,LZ),top:w(1.62,Y,LZ),seats:[w(-.42,Y+.1,BZ+.04),w(.42,Y+.1,BZ+.04)],c:c,trunk:w(0,0,-.75)};
  }
  function THp(x,z){var c=treeHome.c,cs=Math.cos(TH_ROT),sn=Math.sin(TH_ROT),px=c.x+x*cs+z*sn,pz=c.z-x*sn+z*cs;return {a:Math.atan2(pz,px),r:Math.hypot(px,pz)};}
  function THw(x,y,z){return treeHome.g.localToWorld(new T.Vector3(x,y,z));}
  function bakeScene(){
    var st=new T.Group();scene.add(st);
    scene.children.slice().forEach(function(c){if(c===st||c.userData.dyn)return;if((c.isMesh&&!c.isInstancedMesh&&c.material!==hitMat&&!c.children.length)||(c.isGroup&&c.userData.still))st.attach(c);});
    bake(st);
  }
  function nearTree(x,z){return treeHome&&Math.hypot(x-treeHome.c.x,z-treeHome.c.z)<2.6;}
  // 散步的目的地：避開樹屋、移植進來的樹、溪水和泉水池
  function blocked(x,z){
    if(nearTree(x,z)||inArea(x,z,.2))return true;
    for(var id in trees){if(Math.hypot(trees[id].x-x,trees[id].z-z)<.8)return true;}
    for(var di in decors){if(Math.hypot(decors[di].x-x,decors[di].z-z)<(DECOR_R[decors[di].k]||.5)+.4)return true;}
    for(var j=0;j<flow.length-1;j++)if(segDist(x,z,flow[j],flow[j+1])<.6)return true;
    return !!pondP&&Math.hypot(x-pondP.x,z-pondP.z)<.95;
  }
  /* ── 過溪：溪水把花園分成「這邊」和「溪的對面」；不能直接走過水，要從橋上過 ── */
  // 這個方向上，溪水（或泉水池）在多遠：比它遠就是對面
  function waterR(a){
    a=angDiff(a,0);if(a<MT-.12||a>WF+.03)return Infinity;
    if(a<MT+.16)return 5.5;
    if(a<=WF-.38)return 6.25+Math.sin(a*4)*.16;
    var pts=[[6.25+Math.sin((WF-.38)*4)*.16,WF-.38]].concat(FLOW_OUT);
    for(var i=0;i<pts.length-1;i++){var A=pts[i],B=pts[i+1];if(a<=B[1])return A[0]+(B[0]-A[0])*(a-A[1])/(B[1]-A[1]);}
    return Infinity;
  }
  function far(a,r){return r>waterR(a);}
  // 從 (a0,r0) 走到 (a1,r1)（走路是方向、距離一起慢慢變）中間有沒有跑到另一邊
  function crosses(a0,r0,a1,r1){var s0=far(a0,r0),da=angDiff(a1,a0);for(var i=1;i<=14;i++){var k=i/14;if(far(a0+da*k,r0+(r1-r0)*k)!==s0)return true;}return false;}
  // 橋的兩頭：先走到自己這邊的橋頭、過橋、再走到對面
  function bridgeVia(fromFar){var B=bridges[0],e=[1,-1].map(function(sg){var x=B.x+B.ux*.8*sg,z=B.z+B.uz*.8*sg;return {a:Math.atan2(z,x),r:Math.hypot(x,z)};});if(far(e[0].a,e[0].r)!==fromFar)e.reverse();return e;}
  // 路線不要踩進泉水池
  function hitsPond(a0,r0,a1,r1){var da=angDiff(a1,a0),tk=treeHome&&treeHome.trunk;for(var i=0;i<=16;i++){var k=i/16,a=a0+da*k,r=r0+(r1-r0)*k,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.hypot(x-pondP.x,z-pondP.z)<.9||inArea(x,z,0)||(tk&&Math.hypot(x-tk.x,z-tk.z)<.95))return true;}return false;}
  // 路線不要貼著溪走到水裡（溪邊的草地可以，水裡不行）
  function wetPath(a0,r0,a1,r1){var da=angDiff(a1,a0);for(var i=0;i<=14;i++){var k=i/14,a=a0+da*k,r=r0+(r1-r0)*k,x=Math.cos(a)*r,z=Math.sin(a)*r;for(var j=0;j<flow.length-1;j++)if(segDist(x,z,flow[j],flow[j+1])<.45)return true;}return false;}
  function legOk(a0,r0,a1,r1){return !crosses(a0,r0,a1,r1)&&!wetPath(a0,r0,a1,r1);}
  function pathOk(a0,r0,a1,r1){if(hitsPond(a0,r0,a1,r1))return false;var s0=far(a0,r0);if(s0===far(a1,r1))return legOk(a0,r0,a1,r1);var v=bridgeVia(s0);return legOk(a0,r0,v[0].a,v[0].r)&&legOk(v[1].a,v[1].r,a1,r1);}
  function needVia(p){if((!p.via||!p.via.length)&&far(p.ang,p.r)!==far(p.ta,p.tr))p.via=bridgeVia(far(p.ang,p.r));}
  function legTarget(p){return p.via&&p.via.length?p.via[0]:{a:p.ta,r:p.tr};}
  // 走在橋上：跟著拱起來的橋面高一點（橋頭有個小斜坡）
  function bridgeY(x,z){for(var i=0;i<bridges.length;i++){var B=bridges[i],dx=x-B.x,dz=z-B.z,u=Math.abs(dx*B.ux+dz*B.uz)/B.s,w=Math.abs(-dx*B.uz+dz*B.ux);if(w>.5||u>.8)continue;var top=function(t){return .19+.09*Math.cos(Math.min(1,t/.51)*1.3);};return u<=.51?top(u):top(.51)*(.8-u)/.29;}return 0;}
  function addBridge(t,sc){
    var bp=along(t),bq=along(Math.min(1,t+.02)),dir=Math.atan2(bq.z-bp.z,bq.x-bp.x),g=new T.Group();
    for(var pk=-3;pk<=3;pk++){var plank=mesh(new T.BoxGeometry(.16,.06,.9),pk%2?'#C9A884':'#B98B6B',pk*.17,.16+.09*Math.cos(pk/3*1.3),0);g.add(plank);}
    [-.42,.42].forEach(function(z){for(var q=-3;q<=3;q+=2){g.add(mesh(cyl(.025,.025,.3,5),'#8C6A55',q*.17,.32+.09*Math.cos(q/3*1.3),z));}var rail=mesh(cyl(.02,.02,1.1,5),'#8C6A55',0,.46,z);rail.rotation.z=Math.PI/2;g.add(rail);});
    g.position.set(bp.x,0,bp.z);g.rotation.y=-dir-Math.PI/2;g.scale.set(sc,1,1);g.userData.still=true;scene.add(g);
    return {x:bp.x,z:bp.z,ux:-Math.sin(dir),uz:Math.cos(dir),s:sc};
  }
  /* ── 新土地：草地、一圈沙土小路、接回花園的小路、幾朵小花；路口有木牌（點了鏡頭飛過去）。還沒開放的只有木牌和小柵欄 ── */
  function addLands(){
    LAND_IDS.forEach(function(id,j){
      var L=LAND_GEO[id],g=new T.Group(),ca=Math.cos(L.a),sa=Math.sin(L.a);g.position.set(L.c.x,0,L.c.z);scene.add(g);L.g=g;
      var yd=new T.Mesh(new T.CircleGeometry(L.R,48),M(GRASS));yd.rotation.x=-Math.PI/2;yd.position.y=-.006;yd.receiveShadow=true;g.add(yd);
      var rg=new T.Mesh(new T.RingGeometry(L.R+.05,L.R+.7,56),M('#E3CFA0'));rg.rotation.x=-Math.PI/2;rg.position.y=-.013;rg.receiveShadow=true;g.add(rg);
      var r0=ISL+.45,r1=L.r-L.R+.25,cg=new T.Group();cg.position.set(-L.c.x,0,-L.c.z);cg.rotation.y=-L.a;g.add(cg);
      var cn=new T.Mesh(new T.PlaneGeometry(r1-r0,1.3),M('#E3CFA0'));cn.rotation.x=-Math.PI/2;cn.position.set((r0+r1)/2,-.011,0);cn.receiveShadow=true;cg.add(cn);
      for(var f=0;f<12;f++){var fa=rnd(j*40+f)*6.28,fr=.6+rnd(j*40+f+20)*(L.R-1),fx0=Math.cos(fa)*fr,fz0=Math.sin(fa)*fr,u=fx0*ca+fz0*sa;if(Math.abs(u)<.9&&Math.hypot(fx0,fz0)<2.8)continue;var fo=mesh(ball(.07,0),['#FFFFFF','#F8C8D4','#F6D27A','#B9A6DE'][f%4],fx0,.04,fz0);fo.castShadow=false;g.add(fo);}
      for(var k=0;k<3;k++){var sa2=L.a+Math.PI+.9+k*1.6,st=mesh(new T.DodecahedronGeometry(.14+rnd(j*9+k)*.1),'#C9C2BB',Math.cos(sa2)*(L.R+.9),.02,Math.sin(sa2)*(L.R+.9));st.scale.y=.6;g.add(st);}
      // 森林在這塊地上可以放的位置：靠外圈一圈（避開接回花園的路口、土）
      L.spots=[];for(var q=0;q<20;q++){var qa=q/20*Math.PI*2+.08,sp=polar(L.R-.8,qa),wx=L.c.x+sp.x,wz=L.c.z+sp.z;if(Math.abs(angDiff(qa,L.a+Math.PI))<.45)continue;if(PLOT.slice(L.p0,L.p0+3).some(function(pp){return Math.hypot(pp[0]-wx,pp[1]-wz)<1.25;}))continue;L.spots.push({x:wx,z:wz});}
      // 路口的木牌（朝花園中間）＋還沒開放時的小柵欄
      var sp0=polar(ISL+1.2,L.a),off=1.05,sx=sp0.x-sa*off,sz=sp0.z+ca*off,face=Math.atan2(-ca,-sa);
      var sg=new T.Group();sg.position.set(sx,0,sz);sg.rotation.y=face;scene.add(sg);
      sg.add(mesh(cyl(.05,.06,1.05,6),'#8C6A55',0,.52,0));sg.add(mesh(new T.BoxGeometry(.86,.4,.06),'#C99A6F',0,.92,.04));sg.add(mesh(new T.BoxGeometry(.92,.06,.07),'#A97853',0,1.14,.04));
      var lb=label(320,120,1.7,.64);lb.position.set(sx,1.25,sz);scene.add(lb);
      var hb=hit(.75,{land:id});hb.position.set(sx,.9,sz);scene.add(hb);
      var lk=new T.Group(),fp=polar(ISL+.95,L.a);lk.position.set(fp.x,0,fp.z);lk.rotation.y=face;scene.add(lk);
      [-.75,0,.75].forEach(function(x){lk.add(mesh(cyl(.045,.05,.6,6),'#8C6A55',x,.3,0));});lk.add(mesh(new T.BoxGeometry(1.6,.07,.05),'#B9845E',0,.45,0));lk.add(mesh(new T.BoxGeometry(1.6,.06,.05),'#B9845E',0,.22,0));
      sg.userData.still=true;bake(g);bake(lk);
      L.sign={g:sg,lb:lb,hb:hb};L.lock=lk;L.open=false;g.visible=false;
    });
  }
  function build(){
    scene=new T.Scene();
    cam=new T.PerspectiveCamera(38,1,.1,260);tgt=new T.Vector3(0,.7,0);tgoal=tgt.clone();
    var d=new Uint8Array([110,190,255]);GM=new T.DataTexture(d,3,1,T.RedFormat);GM.minFilter=GM.magFilter=T.NearestFilter;GM.needsUpdate=true;
    hitMat=new T.MeshBasicMaterial();heartTex=heartTexture();
    hemi=new T.HemisphereLight('#FFFFFF','#8DBF7A',1.1);scene.add(hemi);
    sun=new T.DirectionalLight('#FFF4D6',1.6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);var sc=sun.shadow.camera;sc.left=sc.bottom=-13;sc.right=sc.top=13;sc.near=1;sc.far=60;sun.shadow.bias=-.0015;scene.add(sun);scene.add(sun.target);
    // 地面：一直到地平線的草原；花園空地顏色亮一點，外圍一圈沙土小路
    var ground=new T.Mesh(new T.CircleGeometry(170,72),M('#97C383'));ground.rotation.x=-Math.PI/2;ground.position.y=-.03;ground.receiveShadow=true;scene.add(ground);
    var yard=new T.Mesh(new T.CircleGeometry(ISL,64),M(GRASS));yard.rotation.x=-Math.PI/2;yard.position.y=-.005;yard.receiveShadow=true;scene.add(yard);
    var path=new T.Mesh(new T.RingGeometry(ISL+.1,ISL+.85,72),M('#E3CFA0'));path.rotation.x=-Math.PI/2;path.position.y=-.012;path.receiveShadow=true;scene.add(path);
    // 溪流：山腳的小池塘出發，沿著花園外圈流，最後穿過小路流進旁邊的小湖
    var pond=polar(6.15,MT+.02);pondP=pond;
    flow=[{x:pond.x,z:pond.z}];for(var a=MT+.16;a<=WF-.38;a+=.07){var p2=polar(6.25+Math.sin(a*4)*.16,a);flow.push(p2);}
    FLOW_OUT.forEach(function(q){flow.push(polar(q[0],q[1]));});
    waterMat=new T.MeshToonMaterial({color:WATER,gradientMap:GM,transparent:true,opacity:.92});
    scene.add(ribbon(flow,function(t){return .78+t*.25;},.012,M('#8CBF78')));
    scene.add(ribbon(flow,function(t){return .55+t*.2;},.03,waterMat));
    var pd=mesh(cyl(.62,.62,.05,20),waterMat,pond.x,.03,pond.z);pd.castShadow=false;scene.add(pd);
    for(var s0=0;s0<9;s0++){var sa=s0*.7,st=mesh(new T.DodecahedronGeometry(.12+rnd(s0+30)*.08),'#D9D2CA',pond.x+Math.cos(sa)*.7,.03,pond.z+Math.sin(sa)*.7);st.scale.y=.55;scene.add(st);}
    for(var fl=0;fl<16;fl++){var fk=mesh(ball(.035,0),'#FFFFFF');fk.scale.set(2.2,.4,1);fk.castShadow=false;fk.userData.t=fl/16;fk.userData.dyn=true;scene.add(fk);flecks.push(fk);}
    // 小木橋：花園裡那座是學和綾、寵物過溪走的；外圈沙土小路被溪切斷的地方也有一座
    bridges.push(addBridge(.36,1));var nf=flow.length-1;bridges.push(addBridge((nf-1+.46)/nf,1.25));
    // 小湖：溪水流進來；沙岸、荷葉（有的開花）、蘆葦、兩隻小鴨子
    var LK=polar(12.5,WF+.05),LR=3.4;lake={x:LK.x,z:LK.z,r:LR};
    var lw=new T.Mesh(new T.CircleGeometry(LR,48),waterMat);lw.rotation.x=-Math.PI/2;lw.position.set(LK.x,.02,LK.z);scene.add(lw);
    var sand=new T.Mesh(new T.RingGeometry(LR-.05,LR+.75,48),M('#E8D5A8'));sand.rotation.x=-Math.PI/2;sand.position.set(LK.x,.008,LK.z);sand.receiveShadow=true;scene.add(sand);
    for(var lp=0;lp<7;lp++){var la=lp*.9+.4,lr=1+rnd(lp+150)*1.9,pad=mesh(cyl(.32,.32,.02,12),'#7FB36E',LK.x+Math.cos(la)*lr,.035,LK.z+Math.sin(la)*lr);pad.castShadow=false;scene.add(pad);if(lp%3===0)scene.add(mesh(ball(.09,1),'#F8C8D4',pad.position.x,.09,pad.position.z));}
    for(var rd=0;rd<14;rd++){var ra=rd*.45+2.2,rp2=polar(LR+.15,ra),rx=LK.x+rp2.x,rz=LK.z+rp2.z,rh=.7+rnd(rd+170)*.5;scene.add(mesh(cyl(.02,.025,rh,4),'#6FA35E',rx,rh/2,rz));if(rd%2)scene.add(mesh(cyl(.045,.045,.18,6),'#8C6A55',rx,rh+.02,rz));}
    for(var dk=0;dk<2;dk++){var duck=new T.Group(),bd=mesh(ball(.2,1),'#FFFFFF');bd.scale.set(1.25,.75,.95);duck.add(bd);duck.add(mesh(ball(.12,1),'#FFFFFF',.2,.17,0));var bk=mesh(cone(.045,.12,6),'#F2A15B',.33,.16,0);bk.rotation.z=-Math.PI/2;duck.add(bk);[-.05,.05].forEach(function(z){duck.add(mesh(ball(.018,0),'#3E3A39',.27,.21,z));});var tl=mesh(cone(.07,.14,5),'#FFFFFF',-.25,.08,0);tl.rotation.z=Math.PI/2+.5;duck.add(tl);duck.userData={a:dk*Math.PI,r:1.6+dk*.6,s:dk?-.12:.15};scene.add(bake(duck));ducks.push(duck);}
    // 草地上的小花、溪邊的石頭
    for(var j=0;j<44;j++){var b=j*2.39996,rr2=4.4+rnd(j+40)*3.9,fp=polar(rr2,b);if(Math.hypot(fp.x-pond.x,fp.z-pond.z)<.95||inArea(fp.x,fp.z,.1))continue;var near=flow.some(function(q){return Math.hypot(q.x-fp.x,q.z-fp.z)<.55;});if(near)continue;var fo=mesh(ball(.07,0),['#FFFFFF','#F8C8D4','#F6D27A','#B9A6DE'][j%4],fp.x,.04,fp.z);fo.castShadow=false;scene.add(fo);}
    for(var k=0;k<10;k++){var q=along(.08+k*.085),side=k%2?1:-1,nb=along(.08+k*.085+.01),tx=nb.x-q.x,tz=nb.z-q.z,l=Math.hypot(tx,tz)||1,rs=mesh(new T.DodecahedronGeometry(.1+rnd(k+60)*.1),'#C9C2BB',q.x-tz/l*.42*side,.03,q.z+tx/l*.42*side);rs.scale.y=.6;scene.add(rs);}
    // 遠方的山：一圈，站在地面上，越遠越淡（霧）；遊樂區外面那個方向留一個缺口，傍晚看得到夕陽、晚上看得到月亮
    for(var mm=0;mm<20;mm++){var ma=mm/20*Math.PI*2+rnd(mm)*.25;if(Math.abs(angDiff(ma,AREA_A))<.5)continue;var mr=62+rnd(mm+5)*18,mh=14+rnd(mm+9)*18,mw=12+rnd(mm+3)*9,mp=polar(mr,ma),mo=mesh(cone(mw,mh,6),['#A9C3B4','#9DB3C6','#B7C9A8','#AFC0CF'][mm%4],mp.x,mh/2-1,mp.z);mo.castShadow=mo.receiveShadow=false;mo.rotation.y=mm;scene.add(mo);if(mh>24){var cp=mesh(cone(mw*.34,mh*.3,6),'#F4F6F8',mp.x,mh*.85-.95,mp.z);cp.castShadow=false;cp.rotation.y=mm;scene.add(cp);}}
    // 草原上起伏的小山丘
    for(var hl=0;hl<14;hl++){var ha=hl/14*Math.PI*2+rnd(hl+200)*.3,hr=30+rnd(hl+210)*20,hs=7+rnd(hl+220)*8,hp=polar(hr,ha),hm=mesh(ball(1,2),['#93C07E','#A1CB8B','#8CB878'][hl%3],hp.x,-hs*.1,hp.z);hm.scale.set(hs*1.4,hs*.32,hs);hm.rotation.y=ha;hm.castShadow=hm.receiveShadow=false;scene.add(hm);}
    // 草原上的樹：圓樹和松樹（同一種形狀一次畫完）
    var nT=56,dmy=new T.Object3D(),col=new T.Color(),wm=M('#FFFFFF'),trI=new T.InstancedMesh(cyl(.14,.22,1,6),M('#8E6A55'),nT),crI=new T.InstancedMesh(ball(1,1),wm,nT*2),cnI=new T.InstancedMesh(cone(1,1,7),wm,nT*3),nt=0,nc=0,nk=0;
    function inst(m,i,x,y,z,sx,sy,sz,c){dmy.position.set(x,y,z);dmy.scale.set(sx,sy,sz);dmy.rotation.set(0,rnd(i+77)*6,0);dmy.updateMatrix();m.setMatrixAt(i,dmy.matrix);if(c)m.setColorAt(i,col.set(c));}
    for(var ti=0;ti<nT*3&&nt<nT;ti++){var tr=13.5+rnd(ti+300)*22,ta=rnd(ti+310)*Math.PI*2,tp=polar(tr,ta);if(Math.hypot(tp.x-lake.x,tp.z-lake.z)<lake.r+2.2||onLand(tp.x,tp.z,2))continue;
      var pine=rnd(ti+320)<.4,th=pine?.9:1.2+rnd(ti+330)*.7,ts=.9+rnd(ti+340)*.6;inst(trI,nt++,tp.x,th*ts/2,tp.z,ts,th*ts,ts);
      if(pine){[[1.25,1.3,.5],[.98,1.1,1.25],[.7,.9,1.9]].forEach(function(c2,k){inst(cnI,nk++,tp.x,(th+c2[2])*ts,tp.z,c2[0]*ts,c2[1]*ts,c2[0]*ts,['#6FA37E','#7FB08A','#6A9C78'][k]);});}
      else{var cc=['#86B67C','#9AC58C','#77AA74','#A6CC8F'][ti%4];inst(crI,nc++,tp.x,(th+.75)*ts,tp.z,1.15*ts,.95*ts,1.15*ts,cc);inst(crI,nc++,tp.x+.45*ts,(th+.35)*ts,tp.z+.2*ts,.75*ts,.65*ts,.75*ts,cc);}}
    trI.count=nt;crI.count=nc;cnI.count=nk;crI0=crI;crN=nc;crBase=[];for(var ci=0;ci<nc;ci++){var cb=new T.Color();crI.getColorAt(ci,cb);crBase.push(cb);}[trI,crI,cnI].forEach(function(m){m.castShadow=m.receiveShadow=false;if(m.instanceColor)m.instanceColor.needsUpdate=true;m.instanceMatrix.needsUpdate=true;scene.add(m);});
    // 小路外面的小灌木
    for(var bu=0;bu<22;bu++){var ba=bu*.29+rnd(bu+400)*.2,bp=polar(ISL+1.4+rnd(bu+410)*2.5,ba);if(Math.hypot(bp.x-lake.x,bp.z-lake.z)<lake.r+1||onLand(bp.x,bp.z,.9))continue;var bs=mesh(ball(.35+rnd(bu+420)*.25,1),['#86B67C','#9AC58C'][bu%2],bp.x,.15,bp.z);bs.scale.y=.75;scene.add(bs);if(bu%4===0)scene.add(mesh(ball(.07,0),'#F8C8D4',bp.x+.15,.42,bp.z));}
    // 森林可以放的位置：兩圈，避開泉水池、溪水出口、樹屋，還有新土地的路口（學和綾從那裡走出去）
    [[7.15,22,0],[7.95,26,.12]].forEach(function(rg){for(var i=0;i<rg[1];i++){var fa=i/rg[1]*Math.PI*2+rg[2]+.05;var sp0=polar(rg[0],fa);if(Math.hypot(sp0.x-pond.x,sp0.z-pond.z)<1.5||inArea(sp0.x,sp0.z,.45)||Math.abs(angDiff(fa,WF))<.2||Math.abs(angDiff(fa,TH_A))<.5||LAND_IDS.some(function(id){return Math.abs(angDiff(fa,LAND_GEO[id].a))<.2;}))continue;spots.push({r:rg[0],a:fa});}});
    addLands();
    // 土：中間十二塊＋每塊新土地三塊（點的範圍做大一點、看不到）；還沒開放的先藏起來
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
    clouds=new T.Group();for(var c=0;c<10;c++){var cg=new T.Group(),ca=c*.63+rnd(c)*.5,cr=52+rnd(c+20)*20;[[0,0,0,.9],[.8,-.15,.1,.65],[-.8,-.1,0,.7],[.2,.3,-.2,.6]].forEach(function(q2){var m=new T.Mesh(ball(q2[3],1),cloudMat);m.position.set(q2[0],q2[1],q2[2]);cg.add(m);});cg.position.set(Math.cos(ca)*cr,20+rnd(c+5)*9,Math.sin(ca)*cr);cg.scale.setScalar(3.2+rnd(c+1)*2.3);clouds.add(bake(cg));}scene.add(clouds);
    dropMat=new T.MeshBasicMaterial({color:'#7FC4E4'});
    // 星星、螢火蟲（晚上才看得到）
    var sp=[];for(var k3=0;k3<360;k3++){var u=rnd(k3+100)*Math.PI*2,v=.08+rnd(k3+700)*.9,R0=90;sp.push(Math.cos(u)*Math.cos(v)*R0,Math.sin(v)*R0-6,Math.sin(u)*Math.cos(v)*R0);}
    var sg=new T.BufferGeometry();sg.setAttribute('position',new T.Float32BufferAttribute(sp,3));
    stars=new T.Points(sg,new T.PointsMaterial({color:'#FFF4D6',size:.6,transparent:true,opacity:0,depthWrite:false,fog:false}));scene.add(stars);
    for(var f=0;f<28;f++){var fm=new T.Mesh(ball(.05,0),new T.MeshBasicMaterial({color:'#FFF2A0',transparent:true,opacity:0}));fm.userData={a:rnd(f)*6.28,r:1.5+rnd(f+3)*5,y:.5+rnd(f+6)*1.4,s:.3+rnd(f+8)*.5};scene.add(fm);fm.userData.dyn=true;flies.push(fm);}
    sky();
  }
  // 天空：跟著現在幾點（清晨粉橘、白天藍、黃昏橘、晚上深藍）
  var SKY=[[0,'#2A3563','#B4C6F0',.75,.95],[5,'#2E3968','#B4C6F0',.75,.95],[6.5,'#F6C9B4','#FFD9B0',1.1,1],[9,'#BFE3F2','#FFF4D6',1.7,1.15],[16,'#BFE3F2','#FFF4D6',1.7,1.15],[18,'#F3B28C','#FFB98A',1.2,1],[19.5,'#4F5F92','#C9B8F0',.85,.9],[21,'#2A3563','#B4C6F0',.75,.95],[24,'#2A3563','#B4C6F0',.75,.95]];
  function sky(){
    var t=new Date(),h=t.getHours()+t.getMinutes()/60,i=1;while(i<SKY.length-1&&h>=SKY[i][0])i++;
    var A=SKY[i-1],B=SKY[i],k=(h-A[0])/(B[0]-A[0]),bg=new T.Color(A[1]).lerp(new T.Color(B[1]),k),lc=new T.Color(A[2]).lerp(new T.Color(B[2]),k);
    var wet=wx.w==='rain'||wx.w==='snow',nt0=h<5.5||h>19.5;
    if(wet)bg.lerp(new T.Color(nt0?'#252C3C':'#A9B3BB'),nt0?.3:.5);else if(wx.w==='cloudy'&&!nt0)bg.lerp(new T.Color('#CDD6DA'),.3);
    scene.background=bg;scene.fog=new T.Fog(bg,wet?30:40,wet?110:135);
    sun.color=lc;sun.intensity=(A[3]+(B[3]-A[3])*k)*(wet?.6:wx.w==='cloudy'?.82:1);hemi.intensity=(A[4]+(B[4]-A[4])*k)*(wet?.93:1);hemi.color=new T.Color('#FFFFFF').lerp(bg,.25);
    if(cloudMat)cloudMat.color.set(wet?'#D5D9DE':wx.w==='cloudy'?'#EEF0F2':'#FFFFFF');
    var ang=(h-6)/12*Math.PI;sun.position.set(Math.cos(ang)*14,Math.max(5,Math.sin(Math.abs(ang))*16+5),7);
    night=h<5.5||h>19.5?1:h<6.5?(6.5-h):h>18.5?(h-18.5):0;night=Math.max(0,Math.min(1,night));
    if(actG){setPhase(phaseOf(h),!phase);sunAt(h);}
    stars.material.opacity=night*(wet?.15:wx.w==='cloudy'?.6:1);if(sunDisc){sunDisc.visible=phase==='eve'&&!wet;moonDisc.visible=phase==='night'&&!wet;}pets.forEach(function(p){p.spr.material.color=new T.Color('#FFFFFF').lerp(new T.Color('#8C96B8'),night*.7);});
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
      if(p.wait>0){p.wait-=dt;setTex(p,2);if(p.wait<=0){p.via=[];var okT=false;for(var n=0;n<6&&!okT;n++){if(n<2&&Math.random()<(phase==='night'?.45:.12)){var fp=AP((Math.random()-.5)*3.6,-1.3);p.ta=fp.a;p.tr=fp.r;}else{p.ta=p.ang+(Math.random()-.5)*3.2;p.tr=RING[0]+Math.random()*(RING[1]-RING[0]);}okT=!blocked(Math.cos(p.ta)*p.tr,Math.sin(p.ta)*p.tr)&&pathOk(p.ang,p.r,p.ta,p.tr);}if(!okT){p.ta=p.ang;p.tr=p.r;}}}
      else{needVia(p);var lg=legTarget(p),da=angDiff(lg.a,p.ang),dr=lg.r-p.r,dist=Math.hypot(da*p.r,dr),step=.5*dt;if(dist<step){p.ang=lg.a;p.r=lg.r;if(p.via&&p.via.length)p.via.shift();else p.wait=1.5+Math.random()*3;}else{var x0=Math.cos(p.ang)*p.r,z0=Math.sin(p.ang)*p.r,k=step/dist;p.ang+=da*k;p.r+=dr*k;var v=new T.Vector3(Math.cos(p.ang)*p.r-x0,0,Math.sin(p.ang)*p.r-z0),fl=v.dot(right)<0;if(fl!==p.flip){p.flip=fl;p.dirty=true;}p.walkT+=dt;setTex(p,Math.floor(p.walkT/.18)%2);}}
      var y=0;if(p.hop>0){p.hop=Math.max(0,p.hop-dt);y=Math.sin((1-p.hop/.5)*Math.PI)*.5;}
      p.x=Math.cos(p.ang)*p.r;p.z=Math.sin(p.ang)*p.r;var by=bridgeY(p.x,p.z);p.spr.position.set(p.x,y+by,p.z);p.sh.position.set(p.x,.02+by,p.z);p.sh.scale.setScalar(1-y*.6);
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
    var hat=new T.Group();hat.add(mesh(cone(.16,.38,12),o.k==='syue'?'#A8D3E6':'#F8C8D4',0,.42,0));hat.add(mesh(new T.TorusGeometry(.15,.025,5,14),'#F6D27A',0,.25,0));hat.children[1].rotation.x=Math.PI/2;hat.add(mesh(ball(.05,1),'#F6D27A',0,.63,0));hat.rotation.z=-.15;hat.visible=false;hd.add(hat);bake(hat);
    var lift=o.k==='ling'?.1:0,santa=new T.Group();santa.add(mesh(cone(.17,.36,12),'#E2554A',0,.43+lift,0));var sbr=mesh(new T.TorusGeometry(.17,.045,6,16),'#FFFFFF',0,.26+lift,0);sbr.rotation.x=Math.PI/2;santa.add(sbr);santa.add(mesh(ball(.06,1),'#FFFFFF',0,.63+lift,0));santa.rotation.z=-.2;santa.visible=false;hd.add(santa);bake(santa);
    var pom=new T.Group();pom.add(mesh(new T.SphereGeometry(.26,14,6,0,Math.PI*2,0,Math.PI/2),'#D3DC6A',0,.17+lift,0));pom.add(mesh(cyl(.02,.025,.08,5),'#7A6A3A',0,.45+lift,0));var plf=mesh(ball(.05,1),'#8DBB5E',.06,.46+lift,0);plf.scale.set(1.6,.4,.8);pom.add(plf);pom.visible=false;hd.add(pom);bake(pom);
    var umb=new T.Group();umb.add(mesh(cyl(.014,.014,.95,5),'#594C43',.2,1.3,.06));var can=mesh(cone(.62,.3,10),o.k==='syue'?'#7FA8CB':'#F2A497',.2,1.86,.06);umb.add(can);umb.add(mesh(ball(.035,1),'#594C43',.2,2.03,.06));umb.visible=false;g.add(umb);bake(umb);
    g.scale.setScalar(1.15);scene.add(g);
    [L1,L2,A1,A2].concat(eyes).forEach(function(n){bake(n);});bake(hd,eyes.concat([hat,santa,pom]));bake(b,[L1,L2,A1,A2,hd]);
    return {hat:hat,santa:santa,pomelo:pom,umb:umb,k:o.k,g:g,b:b,legs:[L1,L2],arms:[A1,A2],hd:hd,eyes:eyes,sh:sh2,ang:o.ang,r:5.3,ta:o.ang,tr:5.3,state:'idle',timer:1+Math.random()*2,walkT:0,face:0,with:null,act:0,ph:Math.random()*6,blink:2+Math.random()*3,waveT:0,seat:-1};
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
  function goTree(p,i){if(p.goAct||p.A)endAct(p);treeHome.occ[i]=p;p.seat=i;p.with=null;p.toTree=true;p.via=[];p.goPic=null;var e=treeHome.entry;p.ta=Math.atan2(e.z,e.x);p.tr=Math.hypot(e.x,e.z);p.state='walk';}
  function movePeople(dt){
    if(!_v)_v=new T.Vector3();
    var both=people.length===2&&people.every(function(o){return o.state==='sit';});
    people.forEach(function(p){
      var q=pos(p),st;
      if(p.state==='idle'){p.timer-=dt;if(p.timer<=0)choose(p);}
      else if(p.state==='walk'){
        if(p.with){var w=p.with;var wa=w.ang!=null?w.ang:0,side=angDiff(p.ang,wa)>0?1:-1;p.ta=wa+side*(.85/Math.max(1,w.r));p.tr=w.r+(w.spr?.05:0);}
        needVia(p);
        var lg=legTarget(p),da=angDiff(lg.a,p.ang),dr=lg.r-p.r,step=(p.toTree||p.goAct?1:.75)*dt,dist=Math.hypot(da*p.r,dr);
        if(dist<.08&&p.via&&p.via.length)p.via.shift();
        else if(dist<.08){if(p.toTree){p.toTree=false;p.state='climb';p.t=0;}else if(p.goAct)startAct(p);else if(p.goPic){p.state='pic';p.picT=14+Math.random()*6;var po=partner(p);if(po&&po.state==='pic'){var tt=Math.max(p.picT,po.picT);p.picT=po.picT=tt;}}else if(p.with)play(p);else{p.state='idle';p.timer=1.5+Math.random()*3;}}
        else{var k=Math.min(1,step/dist);p.ang+=da*k;p.r+=dr*k;p.walkT+=dt;var nq=pos(p);p.face=Math.atan2(nq.x-q.x,nq.z-q.z);}
      }else if(p.state==='act'){actStep(p,dt);
      }else if(p.state==='pic'){p.picT-=dt;var pp2=partner(p);if(pp2&&pp2.state==='pic'&&p.k==='syue'){p.hT=(p.hT||0)-dt;if(p.hT<=0){p.hT=3.6;hearts((p.g.position.x+pp2.g.position.x)/2,1.2,(p.g.position.z+pp2.g.position.z)/2,3);}}if(p.picT<=0){p.state='idle';p.timer=1+Math.random();p.goPic=null;}
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
      if(st==='pic'&&p.goPic){var gp=p.goPic;p.legs[0].rotation.x=p.legs[1].rotation.x=-1.38;p.arms[0].rotation.x=-.35;p.arms[1].rotation.x=-.35;p.b.position.y=-.23;p.g.position.set(gp.x,-.27,gp.z);p.face=gp.face;if(hol&&hol.k==='moon')p.arms[1].rotation.x=-.35-Math.pow(Math.max(0,Math.sin(now*1.1+p.ph)),6)*1.5;var pq=partner(p);p.hd.rotation.z=pq&&pq.state==='pic'?(gp.i===0?-.18:.18):0;}
      else if(st==='act'&&p.A)actPose(p);
      else if(climbing){var u=st==='climb'?p.t:1-p.t;_v.lerpVectors(treeHome.entry,treeHome.top,u);p.g.position.copy(_v);p.face=TH_ROT-Math.PI/2;}
      else if(onDeck){var u2=st==='toSeat'?p.t:1-p.t,sp=treeHome.seats[p.seat];_v.lerpVectors(treeHome.top,sp,u2);var dx=sp.x-treeHome.top.x,dz=sp.z-treeHome.top.z;p.face=st==='toSeat'?Math.atan2(dx,dz):Math.atan2(-dx,-dz);p.g.position.copy(_v);}
      else if(sit){p.g.position.copy(treeHome.seats[p.seat]);p.face=TH_ROT;}
      else{q=pos(p);p.g.position.set(q.x,bridgeY(q.x,q.z),q.z);}
      p.sh.visible=!(climbing||onDeck||sit||st==='act'||st==='pic');
      var uv=wx.w==='rain'&&!(climbing||onDeck||sit||st==='act'||st==='pic');p.umb.visible=uv;if(uv&&!pl)p.arms[1].rotation.x=-1.05;
      var cur=p.g.rotation.y,df=angDiff(p.face,cur);p.g.rotation.y=cur+df*Math.min(1,dt*8);
    });
  }
  /* ── 裝飾品：每一種一個小模型（不動的零件合起來）；信箱的小旗子、風車的葉片會動 ── */
  var decors={},DECOR_R={mailbox:.45,lantern:.4,arch:.95,windmill:.6,scarecrow:.5,birdhouse:.45,picnic:1.05},lampMat=null,mailUp=false,picnics=[];
  function decorModel(k){
    var g=new T.Group(),parts={};
    function box(w,h,d,c,x,y,z){var m=mesh(new T.BoxGeometry(w,h,d),c,x,y,z);g.add(m);return m;}
    if(k==='mailbox'){
      g.add(mesh(cyl(.05,.06,1.0,6),'#8C6A55',0,.5,0));box(.42,.3,.56,'#E2675A',0,1.12,0);
      var top=mesh(new T.CylinderGeometry(.21,.21,.56,12,1,false,0,Math.PI),'#E2675A',0,1.27,0);top.rotation.x=Math.PI/2;top.rotation.z=Math.PI/2;g.add(top);
      var dr=mesh(cyl(.13,.13,.02,12),'#F8E8CB',0,1.17,.29);dr.rotation.x=Math.PI/2;g.add(dr);g.add(mesh(ball(.045,1),'#F2A497',0,1.18,.3));
      var fl=new T.Group();fl.position.set(.23,1.1,-.12);fl.add(mesh(cyl(.012,.012,.36,4),'#594C43',0,.18,0));fl.add(mesh(new T.BoxGeometry(.03,.12,.16),'#F6D27A',0,.3,.08));fl.userData.dyn=true;g.add(fl);parts.flag=fl;
    }else if(k==='lantern'){
      if(!lampMat)lampMat=new T.MeshBasicMaterial({color:'#EDE3C8'});
      g.add(mesh(cyl(.14,.17,.12,8),'#594C43',0,.06,0));g.add(mesh(cyl(.035,.045,1.55,6),'#594C43',0,.8,0));
      box(.22,.04,.22,'#594C43',0,1.58,0);var bl=new T.Mesh(ball(.12,2),lampMat);bl.position.set(0,1.72,0);g.add(bl);g.add(mesh(cone(.19,.16,4),'#594C43',0,1.9,0));
    }else if(k==='arch'){
      [-.8,.8].forEach(function(x){g.add(mesh(cyl(.05,.06,1.3,6),'#B98B6B',x,.65,0));});
      var ar=mesh(new T.TorusGeometry(.8,.06,6,18,Math.PI),'#B98B6B',0,1.3,0);g.add(ar);
      for(var i=0;i<15;i++){var a=i/14*Math.PI,lx=Math.cos(a)*.8,ly=1.3+Math.sin(a)*.8;g.add(mesh(ball(.13,1),i%2?'#86B67C':'#9AC58C',lx,ly,(i%3-1)*.05));if(i%2===0)g.add(mesh(ball(.07,1),['#F8C8D4','#FFFFFF','#F2A497'][i%3],lx+.05,ly+.06,.1));}
      [-.8,.8].forEach(function(x){for(var j=0;j<3;j++)g.add(mesh(ball(.11,1),'#86B67C',x+(j%2?.06:-.06),.35+j*.35,.06));g.add(mesh(ball(.06,1),'#F8C8D4',x+.08,.8,.12));});
    }else if(k==='windmill'){
      g.add(mesh(cone(.36,1.1,4),'#FFFCF6',0,.55,0));box(.2,.26,.04,'#C98A4B',0,.2,.24);
      g.add(mesh(cone(.2,.22,4),'#E2675A',0,1.2,0));
      var bl2=new T.Group();bl2.position.set(0,1.0,.24);for(var b=0;b<4;b++){var bd=new T.Group();bd.rotation.z=b*Math.PI/2;bd.add(mesh(new T.BoxGeometry(.06,.62,.02),'#F2A497',0,.33,0));bd.add(mesh(new T.BoxGeometry(.12,.38,.015),'#FFFFFF',.06,.42,.01));bl2.add(bd);}bl2.add(mesh(ball(.05,1),'#F6D27A',0,0,.02));bl2.userData.dyn=true;g.add(bl2);parts.blades=bl2;
    }else if(k==='scarecrow'){
      g.add(mesh(cyl(.035,.04,1.5,5),'#8C6A55',0,.75,0));var cb=mesh(cyl(.03,.03,1.0,5),'#8C6A55',0,1.12,0);cb.rotation.z=Math.PI/2;g.add(cb);
      box(.42,.46,.24,'#7FA8CB',0,1.0,0);box(.12,.12,.02,'#F2A497',.1,.92,.13);
      [-.36,.36].forEach(function(x){var sl=mesh(cyl(.07,.08,.3,6),'#7FA8CB',x,1.12,0);sl.rotation.z=Math.PI/2;g.add(sl);g.add(mesh(ball(.05,1),'#E9CBA3',x*1.38,1.12,0));});
      g.add(mesh(ball(.17,2),'#F6E7C8',0,1.42,0));[-.06,.06].forEach(function(x){g.add(mesh(ball(.02,1),'#3E3A39',x,1.45,.15));});g.add(mesh(new T.TorusGeometry(.04,.01,4,8,Math.PI),'#A76C65',0,1.38,.16));
      g.add(mesh(cyl(.3,.3,.03,14),'#E0B347',0,1.55,0));g.add(mesh(cone(.16,.22,12),'#E0B347',0,1.67,0));g.add(mesh(cyl(.165,.165,.04,12),'#E2675A',0,1.59,0));
    }else if(k==='birdhouse'){
      g.add(mesh(cyl(.04,.05,1.2,6),'#8C6A55',0,.6,0));box(.34,.34,.32,'#F6D27A',0,1.37,0);
      var rf=mesh(cyl(.27,.27,.4,3),'#A9694F',0,1.62,0);rf.rotation.set(Math.PI/2,0,Math.PI/2);rf.scale.set(1,1,.62);g.add(rf);
      var hole=mesh(cyl(.06,.06,.02,10),'#594C43',0,1.4,.165);hole.rotation.x=Math.PI/2;g.add(hole);var perch=mesh(cyl(.012,.012,.12,4),'#594C43',0,1.3,.2);perch.rotation.x=Math.PI/2;g.add(perch);
    }else if(k==='picnic'){
      box(1.6,.03,1.2,'#F2A497',0,.016,0);for(var q=-1;q<=1;q++){box(1.61,.035,.14,'#FFFCF6',0,.018,q*.36);box(.14,.036,1.21,'#FFFCF6',q*.5,.019,0);}
      box(.36,.2,.26,'#C99A6F',.35,.12,-.25);var hd=mesh(new T.TorusGeometry(.13,.015,4,10,Math.PI),'#956C50',.35,.22,-.25);g.add(hd);
      [['#E2675A',-.25,.15],['#F6D27A',-.12,.22],['#9CCB85',-.3,.3]].forEach(function(f){g.add(mesh(ball(.07,1),f[0],f[1],.07,f[2]));});
    }
    bake(g);g.userData.parts=parts;return g;
  }
  function decorHit(r,id){var m=new T.Mesh(cyl(r,r,1.8,10),hitMat);m.position.y=.9;m.rotation.y=.13;m.visible=false;m.userData={decor:id};return m;}
  function spinTo(o,to){var from=o.rotation.y,d=Math.atan2(Math.sin(to-from),Math.cos(to-from));if(Math.abs(d)<.01){o.rotation.y=to;return;}addFx({dur:.35,up:function(f){var k=1-Math.pow(1-f.t/f.dur,3);o.rotation.y=from+d*k;},end:function(){o.rotation.y=from+d;}});}
  var ROT=Math.PI/4;
  function setDecor(list){
    var keep={};picnics=[];
    list.forEach(function(d){
      keep[d.id]=1;var o=decors[d.id],ry=Math.atan2(-d.x,-d.z)+(d.rot||0)*ROT;
      if(d.k==='picnic')picnics.push({id:d.id,x:+d.x,z:+d.z,ry:ry});
      if(o){if(Math.hypot(o.x-d.x,o.z-d.z)>.05){var g0=o.g,x0=o.x,z0=o.z;o.x=+d.x;o.z=+d.z;o.rot=d.rot||0;burst(x0,.3,z0,8,'#9C7258');addFx({dur:.3,up:function(f){g0.scale.setScalar(Math.max(.01,1-f.t/f.dur));},end:function(){g0.position.set(o.x,0,o.z);g0.rotation.y=Math.atan2(-o.x,-o.z)+o.rot*ROT;growIn(g0,o.x,o.z);SND.sfx('plant');}});}
        else if((o.rot||0)!==(d.rot||0)){o.rot=d.rot||0;spinTo(o.g,ry);}return;}
      var g=decorModel(d.k);g.position.set(+d.x,0,+d.z);g.rotation.y=ry;g.add(decorHit(DECOR_R[d.k]||.5,d.id));scene.add(g);
      decors[d.id]={g:g,k:d.k,x:+d.x,z:+d.z,rot:d.rot||0,parts:g.userData.parts};if(setDecor.done)growIn(g,+d.x,+d.z);
    });
    setDecor.done=true;
    Object.keys(decors).forEach(function(id){if(!keep[id]){scene.remove(decors[id].g);delete decors[id];}});
  }
  function hasDecor(k){for(var id in decors)if(decors[id].k===k)return true;return false;}
  var envS=null,envT=0;
  function envSprite(){
    var s0=label(160,120,.62,.47),c=s0.userData.c,x=c.getContext('2d');x.clearRect(0,0,160,120);x.lineJoin='round';x.lineWidth=7;x.strokeStyle='#3E3A39';
    x.fillStyle='#FFF4EE';rr(x,10,14,140,94,12);x.fill();x.stroke();
    x.beginPath();x.moveTo(13,18);x.lineTo(80,68);x.lineTo(147,18);x.closePath();x.fillStyle='#F8C8D4';x.fill();x.stroke();
    x.beginPath();x.moveTo(80,86);x.bezierCurveTo(58,70,62,52,74,54);x.bezierCurveTo(78,54,80,58,80,60);x.bezierCurveTo(80,58,82,54,86,54);x.bezierCurveTo(98,52,102,70,80,86);x.closePath();x.fillStyle='#F2A497';x.fill();x.lineWidth=5;x.stroke();
    s0.center.set(.5,.5);s0.material.depthTest=true;s0.renderOrder=0;s0.userData.t.needsUpdate=true;s0.visible=false;scene.add(s0);return s0;}
  function tickEnv(dt){
    var mb=null,mid='';for(var id in decors)if(decors[id].k==='mailbox'){mb=decors[id];mid=id;break;}
    if(!mailUp||!mb||mv){if(envS)envS.visible=false;return;}
    if(!envS)envS=envSprite();
    envS.visible=true;envS.userData.id=mid;var b=Math.sin(now*2.4);envS.position.set(mb.x,1.78+b*.09,mb.z);envS.material.rotation=Math.sin(now*1.7)*.12;var sc=1+.06*Math.sin(now*4.8);envS.scale.set(.62*sc,.47*sc,1);
    envT-=dt;if(envT<=0){envT=2.6;hearts(mb.x,2.05,mb.z,1);}
  }
  function tickDecor(dt){
    tickEnv(dt);
    for(var id in decors){var d=decors[id],P=d.parts;
      if(P.blades)P.blades.rotation.z-=dt*(wx.w==='rain'||wx.w==='snow'?3.2:1.4);
      if(P.flag){var want=mailUp?0:-Math.PI/2;P.flag.rotation.z+=(want-P.flag.rotation.z)*Math.min(1,dt*4);}
    }
    if(lampMat)lampMat.color.set(night>.5?'#FFE08A':phase==='eve'?'#FFEBB8':'#EDE3C8');
  }

  /* ── 紀念日布置：garden.html 傳 st.party＝{title, bday:[誰生日]}；沒有就收起來 ── */
  var party=null,partyKey='',fwT=0;
  function balloons(x,z,n,seed){var g=new T.Group();g.position.set(x,0,z);for(var i=0;i<n;i++){var a=i/n*6.28+seed,r=.18,bx=Math.cos(a)*r,bz=Math.sin(a)*r,h=1.7+rnd(seed*10+i)*.6;var b=mesh(ball(.2,2),['#F2A497','#F6D27A','#A8D3E6','#B9A6DE','#9CCB85','#F8C8D4'][(i+seed)%6],bx,h,bz);b.scale.y=1.15;b.castShadow=false;g.add(b);g.add(mesh(cyl(.006,.006,h-.15,3),'#FFFFFF',bx/2,(h-.15)/2,bz/2));}g.add(mesh(cyl(.05,.06,.1,6),'#8C6A55',0,.05,0));bake(g);g.userData.dyn=true;return g;}
  function bannerSprite(text){var s0=label(640,150,6.4,1.5),c=s0.userData.c,x=c.getContext('2d');x.clearRect(0,0,640,150);x.font='54px Huninn, "PingFang TC", sans-serif';var tw=Math.min(620,x.measureText(text).width+80),l=(640-tw)/2;
    x.fillStyle='#FFFCF6';rr(x,l,20,tw,96,48);x.fill();x.lineWidth=7;x.strokeStyle='#594C43';x.stroke();x.fillStyle='#3E3A39';x.textAlign='center';x.textBaseline='middle';x.fillText(text,320,70);
    for(var i=0;i<9;i++){x.fillStyle=['#F2A497','#F6D27A','#A8D3E6','#9CCB85'][i%4];x.beginPath();var fx=l+20+i*(tw-40)/8;x.moveTo(fx-12,122);x.lineTo(fx+12,122);x.lineTo(fx,146);x.closePath();x.fill();}
    s0.material.depthTest=true;s0.userData.t.needsUpdate=true;return s0;}
  function cake(){var g=new T.Group();g.add(mesh(cyl(.34,.38,.5,10),'#C99A6F',0,.25,0));g.add(mesh(cyl(.3,.3,.03,16),'#FFFCF6',0,.52,0));
    g.add(mesh(cyl(.26,.27,.2,16),'#FFFCF6',0,.63,0));g.add(mesh(cyl(.27,.27,.04,16),'#F8C8D4',0,.66,0));g.add(mesh(cyl(.19,.2,.16,16),'#FFFCF6',0,.81,0));
    for(var i=0;i<6;i++){var a=i/6*6.28;g.add(mesh(ball(.035,1),'#E2675A',Math.cos(a)*.2,.74,Math.sin(a)*.2));}
    var fl=[];for(var j=0;j<3;j++){var cx=(j-1)*.08;g.add(mesh(cyl(.012,.012,.12,4),['#A8D3E6','#F6D27A','#F2A497'][j],cx,.95,0));var f=new T.Mesh(cone(.022,.06,6),new T.MeshBasicMaterial({color:'#FFB347'}));f.position.set(cx,1.04,0);f.userData.dyn=true;g.add(f);fl.push(f);}
    bake(g);g.userData.flames=fl;return g;}
  function setParty(pt){
    var key=pt?pt.title+'|'+(pt.bday||[]).join(',')+'|'+(pt.hol||'')+'|'+(pt.plain===false?0:1):'';if(key===partyKey)return;partyKey=key;
    if(party){party.objs.forEach(function(o){scene.remove(o);});(party.confetti&&party.confetti.geometry.dispose());party=null;}
    people.forEach(function(p){if(p.hat)p.hat.visible=!!pt&&(pt.bday||[]).indexOf(p.k)>=0;});
    setHoliday(pt&&pt.hol||'');
    if(!pt)return;
    var plain=pt.plain!==false,fest=plain||pt.hol==='nye',objs=[],th=treeHome.c,tq=AWp(-3.0,.6),cq=AWp(0,-.5);
    if(fest)[[th.x+1.6,th.z-.8,4,1],[tq.x,tq.z,5,2],[polar(8.1,.95).x,polar(8.1,.95).z,4,3],[polar(8.1,-.35).x,polar(8.1,-.35).z,3,4]].forEach(function(b){var g=balloons(b[0],b[1],b[2],b[3]);scene.add(g);objs.push(g);});
    var bn=bannerSprite(pt.title);bn.position.set(0,4.4,-5.4);scene.add(bn);objs.push(bn);
    var ck=null;if((pt.bday||[]).length){ck=cake();var tb=new T.Group();tb.add(mesh(cyl(.42,.42,.05,14),'#FFFCF6',0,.62,0));tb.add(mesh(cyl(.05,.07,.6,6),'#B98B6B',0,.3,0));bake(tb);var cg=new T.Group();cg.add(tb);ck.position.y=.64;ck.scale.setScalar(.6);cg.add(ck);cg.position.set(cq.x,0,cq.z);scene.add(cg);objs.push(cg);}
    // 彩帶紙片：在花園上空慢慢飄
    var N=90,geo=new T.BufferGeometry(),cl=new Float32Array(N*3),c=new T.Color(),D=[];for(var i=0;i<N;i++){D.push({x:(Math.random()-.5)*18,y:Math.random()*6,z:(Math.random()-.5)*18,s:.3+Math.random()*.3,ph:Math.random()*6.28});c.set(['#F2A497','#F6D27A','#A8D3E6','#B9A6DE','#9CCB85','#F8C8D4'][i%6]);cl.set([c.r,c.g,c.b],i*3);}
    geo.setAttribute('position',new T.BufferAttribute(new Float32Array(N*3),3));geo.setAttribute('color',new T.BufferAttribute(cl,3));if(!petalT)petalT=texDot(true);
    var cf=new T.Points(geo,new T.PointsMaterial({size:.22,map:petalT,vertexColors:true,transparent:true,depthWrite:false,alphaTest:.1}));cf.frustumCulled=false;cf.userData.dyn=true;if(fest){scene.add(cf);objs.push(cf);}else{geo.dispose();cf=null;}
    party={objs:objs,banner:bn,cake:ck,confetti:cf,D:D,N:N,plain:plain};
  }
  // 煙火：晚上每隔幾秒在花園上空開一朵（一朵＝一團點，一次畫完）
  function firework(){var N=70,geo=new T.BufferGeometry(),pos=new Float32Array(N*3),V=[],cx=(Math.random()-.5)*14,cy=9+Math.random()*4,cz=-4+(Math.random()-.5)*8,col=new T.Color(['#F2A497','#F6D27A','#A8D3E6','#B9A6DE','#FFFFFF'][Math.floor(Math.random()*5)]);
    for(var i=0;i<N;i++){var u=Math.random()*6.28,w=Math.acos(2*Math.random()-1),sp=3+Math.random()*1.5;V.push([Math.sin(w)*Math.cos(u)*sp,Math.cos(w)*sp,Math.sin(w)*Math.sin(u)*sp]);pos[i*3]=cx;pos[i*3+1]=cy;pos[i*3+2]=cz;}
    geo.setAttribute('position',new T.BufferAttribute(pos,3));if(!dotT)dotT=texDot(false);
    var pts=new T.Points(geo,new T.PointsMaterial({color:col,size:.35,map:dotT,transparent:true,depthWrite:false,fog:false}));pts.frustumCulled=false;scene.add(pts);
    addFx({dur:1.8,up:function(f,dt){var a=geo.attributes.position.array;for(var i=0;i<N;i++){V[i][1]-=2.2*dt;a[i*3]+=V[i][0]*dt;a[i*3+1]+=V[i][1]*dt;a[i*3+2]+=V[i][2]*dt;V[i][0]*=.985;V[i][2]*=.985;}geo.attributes.position.needsUpdate=true;pts.material.opacity=1-Math.pow(f.t/f.dur,2);},end:function(){scene.remove(pts);geo.dispose();pts.material.dispose();}});
    SND.sfx('pop');}
  function tickParty(dt){
    if(!party)return;
    party.objs.forEach(function(o,i){if(o.isGroup&&o!==party.cake)o.position.y=Math.sin(now*1.3+i)*.06;});
    if(party.banner)party.banner.position.y=4.4+Math.sin(now*.9)*.12;
    if(party.cake)party.cake.userData.flames.forEach(function(f,j){f.scale.y=.8+.35*Math.sin(now*14+j*2);});
    if(party.confetti){var a=party.confetti.geometry.attributes.position.array;for(var k=0;k<party.N;k++){var e=party.D[k];e.y-=e.s*dt;e.x+=Math.sin(now*1.1+e.ph)*.5*dt;if(e.y<0){e.y+=6;e.x=(Math.random()-.5)*18;e.z=(Math.random()-.5)*18;}a[k*3]=e.x;a[k*3+1]=e.y+.2;a[k*3+2]=e.z;}party.confetti.geometry.attributes.position.needsUpdate=true;}
    var hk=hol&&hol.k,nye=hk==='nye';
    if(night>.5&&(party.plain||nye||hk==='cny')){fwT-=dt;if(fwT<=0){fwT=nye?.45+Math.random()*.8:1.8+Math.random()*2.2;firework();}}
  }

  /* ── 節日布置：garden.html 在 st.party.hol 傳今天是哪個節日（每個節日一套自己的布置，過了就收起來）
     xmas 聖誕：聖誕樹（彩燈、星星、樹下禮物，點了拿一份禮物）、雪人、樹屋掛彩燈、學和綾戴聖誕帽、寵物也戴
     nye 跨年：晚上滿天煙火、最後十秒倒數，學和綾喜歡坐到樹屋上一起看
     cny 過年：樹屋下掛紅燈籠、門口貼春聯和福、花園裡燈籠柱、鞭炮劈哩啪啦、晚上放煙火
     val 情人節：愛心氣球、愛心往上飄、玫瑰花瓣往下飄
     qixi 七夕：晚上銀河、喜鵲在花園上空搭鵲橋，兩端是牛郎星和織女星；白天飄愛心
     moon 中秋：大月亮、兔子燈籠、月餅野餐墊（傍晚、晚上學和綾坐在那裡吃月餅賞月）、戴柚子帽
     hween 萬聖節：南瓜燈（晚上臉會亮）、蝙蝠繞著樹屋飛、寵物戴巫師帽 ── */
  var hol=null,holKey='',holPic=null,FRONT=1.12;
  function holAdd(o){scene.add(o);hol.objs.push(o);return o;}
  function bmat(c){var m=new T.MeshBasicMaterial({color:c});hol.mats.push(m);return m;}
  function ringC(rs,as){var o=[];rs.forEach(function(r){as.forEach(function(a){o.push([r,a]);});});return o;}
  function aroundFront(rs){var o=[];for(var i=0;i<26;i++){var a=FRONT+(i%2?1:-1)*Math.ceil(i/2)*.24;rs.forEach(function(r){o.push([r,a]);});}return o;}
  // 找一塊空地（不壓到土、樹、裝飾、溪、遊樂區、樹屋，也不跟別的節日布置擠在一起）
  function holSpot(r,cands){
    for(var i=0;i<cands.length;i++){var q=polar(cands[i][0],cands[i][1]),ok=canPlace(q.x,q.z,null,r)==='';
      for(var j=0;ok&&j<hol.taken.length;j++)if(Math.hypot(hol.taken[j].x-q.x,hol.taken[j].z-q.z)<r+hol.taken[j].r+.35)ok=false;
      if(ok){hol.taken.push({x:q.x,z:q.z,r:r});return q;}}
    return null;}
  function canvasSprite(w,h,draw,sx,sy,depth){var c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');x.lineJoin='round';x.lineCap='round';draw(x,w,h);var t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;hol.texs.push(t);var s=new T.Sprite(new T.SpriteMaterial({map:t,transparent:true,depthWrite:false,depthTest:depth!==false}));hol.mats.push(s.material);s.scale.set(sx,sy,1);return s;}
  function canvasPlane(w,h,pw,ph,draw){var c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');draw(x,w,h);var t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;hol.texs.push(t);var m=new T.MeshBasicMaterial({map:t,transparent:true});hol.mats.push(m);var g=new T.PlaneGeometry(pw,ph);hol.geos.push(g);return new T.Mesh(g,m);}
  function heartShape(s){var h=new T.Shape();h.moveTo(0,-.9*s);h.bezierCurveTo(-1.1*s,-.2*s,-1.0*s,.75*s,-.5*s,.8*s);h.bezierCurveTo(-.2*s,.82*s,0,.6*s,0,.45*s);h.bezierCurveTo(0,.6*s,.2*s,.82*s,.5*s,.8*s);h.bezierCurveTo(1.0*s,.75*s,1.1*s,-.2*s,0,-.9*s);return h;}
  // 飄的東西（愛心往上、花瓣往下）：一團點，每格移一下
  function floaters(N,tex,size,cols,up,R,H){
    var geo=new T.BufferGeometry(),pos=new Float32Array(N*3),cl=new Float32Array(N*3),c=new T.Color(),D=[];
    for(var i=0;i<N;i++){D.push({x:(Math.random()-.5)*R*2,y:Math.random()*H,z:(Math.random()-.5)*R*2,s:.25+Math.random()*.35,ph:Math.random()*6.28});c.set(cols[i%cols.length]);cl.set([c.r,c.g,c.b],i*3);}
    geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('color',new T.BufferAttribute(cl,3));hol.geos.push(geo);
    var m=new T.PointsMaterial({size:size,map:tex,vertexColors:true,transparent:true,depthWrite:false,alphaTest:.1});hol.mats.push(m);
    var pts=new T.Points(geo,m);pts.frustumCulled=false;holAdd(pts);
    hol.tick.push(function(dt){var a=geo.attributes.position.array;for(var k=0;k<N;k++){var e=D[k];e.y+=(up?1:-1)*e.s*dt;e.x+=Math.sin(now*1.1+e.ph)*.35*dt;if(up&&e.y>H){e.y=0;e.x=(Math.random()-.5)*R*2;e.z=(Math.random()-.5)*R*2;}if(!up&&e.y<0){e.y+=H;e.x=(Math.random()-.5)*R*2;e.z=(Math.random()-.5)*R*2;}a[k*3]=e.x;a[k*3+1]=e.y+.1;a[k*3+2]=e.z;}geo.attributes.position.needsUpdate=true;});
  }
  // 寵物的帽子（寵物是圖片，所以帽子也是一張小圖，跟著頭走）
  // 頭頂在圖片的哪裡（高度比例、左右偏移）
  var PET_HEAD={cat:[.74,.1],pg:[.74,0],dg:[.78,.06]};
  function petHats(draw){
    pets.forEach(function(p){var s=canvasSprite(64,64,draw,.42,.42);s.center.set(.5,.12);holAdd(s);
      hol.tick.push(function(){var hd=PET_HEAD[p.k]||[.8,0],sp=p.spr.position,e=cam.matrixWorld.elements,off=hd[1]*(p.flip?-1:1)*p.H,up=p.H*hd[0];s.position.set(sp.x+e[0]*off+e[4]*up,sp.y+e[1]*off+e[5]*up,sp.z+e[2]*off+e[6]*up);s.material.color.copy(p.spr.material.color);});});
  }
  function santaDraw(x){x.lineWidth=4;x.strokeStyle='#3E3A39';x.fillStyle='#E2554A';x.beginPath();x.moveTo(10,50);x.quadraticCurveTo(18,10,48,12);x.quadraticCurveTo(44,32,54,50);x.closePath();x.fill();x.stroke();x.fillStyle='#FFFFFF';rr(x,5,44,54,14,7);x.fill();x.stroke();x.beginPath();x.arc(50,13,7,0,6.29);x.fill();x.stroke();}
  function witchDraw(x){x.lineWidth=4;x.strokeStyle='#3E3A39';x.fillStyle='#6E4E9E';x.beginPath();x.moveTo(18,48);x.lineTo(36,4);x.quadraticCurveTo(40,20,46,48);x.closePath();x.fill();x.stroke();x.fillStyle='#5A3E86';x.beginPath();x.ellipse(32,50,28,7,0,0,6.29);x.fill();x.stroke();x.fillStyle='#F6D27A';x.fillRect(21,39,24,6);x.strokeRect(21,39,24,6);}
  function lantern(mats){var g=new T.Group();var b=new T.Mesh(ball(.2,2),mats[0]);b.scale.set(1,.85,1);g.add(b);[.15,-.15].forEach(function(y){g.add(mesh(cyl(.09,.09,.05,10),'#F6C343',0,y,0));});g.add(mesh(cyl(.012,.012,.22,4),'#F6C343',0,-.29,0));[-.1,0,.1].forEach(function(x){var r=new T.Mesh(cyl(.006,.006,.3,3),mats[1]);r.position.set(x*.9,0,.17);g.add(r);});return g;}
  function setHoliday(k){
    if(k===holKey)return;holKey=k;
    if(hol){hol.objs.forEach(function(o){scene.remove(o);});hol.texs.forEach(function(t){t.dispose();});hol.mats.forEach(function(m){m.dispose();});hol.geos.forEach(function(g){g.dispose();});hol=null;}
    holPic=null;if(moonDisc){moonDisc.scale.set(16,16,1);moonDisc.material.color.set('#FFFFFF');moonDisc.visible=phase==='night'&&wx.w!=='rain'&&wx.w!=='snow';}
    people.forEach(function(p){if(p.santa)p.santa.visible=k==='xmas';if(p.pomelo)p.pomelo.visible=k==='moon';});
    if(!k||!treeHome)return;
    hol={k:k,objs:[],texs:[],mats:[],geos:[],tick:[],hits:[],taken:[]};
    var B=HOL_BUILD[k];if(B)B();
  }
  var HOL_BUILD={
    xmas:function(){
      var cols=['#FF6B6B','#FFD166','#6EC6FF','#B9F3A1'],mats=cols.map(bmat);
      var q=holSpot(1.15,aroundFront([5.8,6.4,5.2,7.0,4.8]))||holSpot(.8,aroundFront([5.8,6.4,5.2,7.0,4.8]));
      if(q){
        var g=new T.Group();g.position.set(q.x,0,q.z);g.rotation.y=.45;
        g.add(mesh(cyl(.13,.17,.4,8),'#8E6A55',0,.2,0));
        var L=[[1.0,1.2,.35],[.8,1.05,.98],[.58,.9,1.55],[.36,.72,2.1]];
        L.forEach(function(c,i){g.add(mesh(cone(c[0],c[1],12),['#3E7D59','#468863','#4F936A','#5AA073'][i],0,c[2]+c[1]/2,0));var sn=mesh(cyl(c[0]*.98,c[0],.05,12),'#F4F7F8',0,c[2]+.03,0);g.add(sn);});
        for(var i=0;i<34;i++){var c=L[i%4],t=.12+Math.random()*.62,y=c[2]+c[1]*t,r0=c[0]*(1-t)+.035,a=Math.random()*6.28,b=new T.Mesh(ball(.055,1),mats[i%4]);b.position.set(Math.cos(a)*r0,y,Math.sin(a)*r0);g.add(b);}
        var st=new T.Shape();for(var j=0;j<10;j++){var rr0=j%2?.11:.26,aa=j/10*Math.PI*2+Math.PI/2,sx=Math.cos(aa)*rr0,sy=Math.sin(aa)*rr0;if(j)st.lineTo(sx,sy);else st.moveTo(sx,sy);}st.closePath();
        var sg=new T.ExtrudeGeometry(st,{depth:.07,bevelEnabled:false});sg.translate(0,0,-.035);hol.geos.push(sg);var star=new T.Mesh(sg,bmat('#FFD54A'));star.position.y=2.98;star.userData.dyn=true;g.add(star);
        [[.78,.25,'#F2A497','#F6D27A'],[-.72,.42,'#A8D3E6','#FFFFFF'],[.2,.85,'#9CCB85','#E2675A'],[-.5,-.62,'#F6D27A','#E2675A'],[.62,-.5,'#B9A6DE','#F6D27A'],[-.15,.95,'#F8C8D4','#FFFFFF']].forEach(function(p,i){var s=.26+(i%2)*.09,gg=new T.Group();gg.position.set(p[0],0,p[1]);gg.rotation.y=i*.7;gg.add(mesh(new T.BoxGeometry(s,s*.8,s),p[2],0,s*.4,0));gg.add(mesh(new T.BoxGeometry(s+.012,s*.8+.012,.05),p[3],0,s*.4,0));gg.add(mesh(new T.BoxGeometry(.05,s*.8+.012,s+.012),p[3],0,s*.4,0));g.add(gg);});
        var hb=hit(1.05,{xtree:1});hb.position.y=1.4;hb.scale.set(1,1.65,1);g.add(hb);hol.hits.push(hb);
        bake(g);holAdd(g);hol.tree={x:q.x,z:q.z,g:g,star:star};
      }
      // 雪人
      var q2=holSpot(.55,ringC([5.6,6.3,5.0],[FRONT+.75,FRONT+.95,FRONT-.85,FRONT-1.05,FRONT+1.15]));
      if(q2){var s=new T.Group();s.position.set(q2.x,0,q2.z);s.rotation.y=.45;
        [[.36,.34],[.26,.86],[.19,1.25]].forEach(function(b){s.add(mesh(ball(b[0],2),'#FAFBFC',0,b[1],0));});
        [-.065,.065].forEach(function(x){s.add(mesh(ball(.026,1),'#2E2A2A',x,1.3,.17));});
        var nose=mesh(cone(.035,.17,6),'#F08A2C',0,1.25,.27);nose.rotation.x=Math.PI/2;s.add(nose);
        var sc=mesh(new T.TorusGeometry(.2,.05,6,14),'#E2554A',0,1.07,0);sc.rotation.x=Math.PI/2;s.add(sc);s.add(mesh(new T.BoxGeometry(.09,.3,.04),'#E2554A',.12,.93,.17));
        [.75,.88,1.0].forEach(function(y,i){s.add(mesh(ball(.025,1),'#2E2A2A',0,y-.02*i,.25-.02*i));});
        [-1,1].forEach(function(sd){var arm=mesh(cyl(.018,.022,.5,4),'#8E6A55',sd*.42,1.0,0);arm.rotation.z=sd*-1.05;s.add(arm);});
        s.add(mesh(cyl(.22,.22,.03,12),'#2E2A2A',0,1.4,0));s.add(mesh(cyl(.14,.15,.2,12),'#2E2A2A',0,1.52,0));s.add(mesh(cyl(.15,.15,.04,12),'#E2554A',0,1.45,0));
        bake(s);holAdd(s);}
      // 樹屋掛彩燈：屋簷、左右欄杆
      var Y=2.38,bl=new T.Group(),n=0;function bulb(x,y,z){var w=THw(x,y,z),b=new T.Mesh(ball(.05,1),mats[(n++)%4]);b.position.copy(w);bl.add(b);}
      for(var bx=-1.3;bx<=1.31;bx+=.26)bulb(bx,Y+1.3,-.08);
      for(var bz=-1.25;bz<=1.36;bz+=.32)bulb(-1.89,Y+.66,bz);
      for(var bz2=-1.25;bz2<=.11;bz2+=.34)bulb(1.89,Y+.66,bz2);
      bake(bl);holAdd(bl);
      petHats(santaDraw);
      hol.tick.push(function(dt){mats.forEach(function(m,i){m.color.set(cols[i]);if(Math.sin(now*2.4+i*1.57)<-.25)m.color.multiplyScalar(.3);});if(hol.tree){var sr=hol.tree.star;sr.rotation.y+=dt*.9;sr.scale.setScalar(1+.08*Math.sin(now*4));}});
    },
    nye:function(){
      // 倒數：12/31 晚上 11:59:50 開始，天上出現大大的數字；0 點一到放一整排煙火
      var num=canvasSprite(256,256,function(){},5,5,false);num.visible=false;num.renderOrder=11;num.position.set(0,8.5,-2);holAdd(num);var shown='',boom=false;
      hol.tick.push(function(){var d=new Date(),txt='';
        if(d.getMonth()===11&&d.getDate()===31&&d.getHours()===23&&d.getMinutes()===59&&d.getSeconds()>=50)txt=String(60-d.getSeconds());
        else if(d.getMonth()===0&&d.getDate()===1&&d.getHours()===0&&d.getMinutes()===0&&d.getSeconds()<12){txt=String(d.getFullYear());if(!boom){boom=true;for(var i=0;i<10;i++)setTimeout(firework,i*220);}}
        num.visible=!!txt;if(txt&&txt!==shown){shown=txt;var c=num.material.map.image,x=c.getContext('2d');x.clearRect(0,0,256,256);x.font=(txt.length>2?'86':'150')+'px Huninn, "PingFang TC", sans-serif';x.textAlign='center';x.textBaseline='middle';x.lineWidth=12;x.strokeStyle='#594C43';x.strokeText(txt,128,134);x.fillStyle='#FFE08A';x.fillText(txt,128,134);num.material.map.needsUpdate=true;}
        if(num.visible)num.scale.setScalar(5+.6*Math.sin(now*9));});
    },
    cny:function(){
      var red=bmat('#E5483C'),gold=bmat('#F6C343'),Y=2.38;
      // 樹屋陽台下掛一排紅燈籠
      [-1.45,-.5,.5,1.45].forEach(function(x,i){var top=THw(x,Y-.18,1.36),l=lantern([red,gold]);l.position.set(top.x,top.y-.55-(i%2)*.12,top.z);l.add(mesh(cyl(.006,.006,.36+(i%2)*.12,3),'#594C43',0,.33+(i%2)*.06,0));holAdd(l);});
      // 門口春聯、門上的福
      var tf=function(txt){return function(x,w,h){x.fillStyle='#D8392F';x.fillRect(0,0,w,h);x.strokeStyle='#F6C343';x.lineWidth=6;x.strokeRect(5,5,w-10,h-10);x.fillStyle='#2E2A2A';x.font='44px Huninn, "PingFang TC", sans-serif';x.textAlign='center';x.textBaseline='middle';for(var i=0;i<txt.length;i++)x.fillText(txt[i],w/2,(i+.5)*h/txt.length);};};
      [[.22,'花開富貴'],[1.02,'竹報平安']].forEach(function(c){var p=canvasPlane(64,300,.13,.66,tf(c[1])),w=THw(c[0],Y+.5,-.2);p.position.copy(w);p.rotation.y=TH_ROT;holAdd(p);});
      var fu=canvasPlane(128,128,.3,.3,function(x){x.translate(64,64);x.rotate(Math.PI/4);x.fillStyle='#D8392F';x.fillRect(-42,-42,84,84);x.strokeStyle='#F6C343';x.lineWidth=5;x.strokeRect(-38,-38,76,76);x.rotate(-Math.PI/4);x.fillStyle='#2E2A2A';x.font='58px Huninn, "PingFang TC", sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('福',0,3);});
      var fw=THw(.62,Y+.55,-.19);fu.position.copy(fw);fu.rotation.y=TH_ROT;holAdd(fu);
      // 花園裡三根燈籠柱
      for(var k=0;k<3;k++){var q=holSpot(.35,ringC([5.7,6.4,5.1],[FRONT-.15,FRONT+.45,FRONT-.7,FRONT+.95,FRONT-1.1]));if(!q)continue;var g=new T.Group();g.position.set(q.x,0,q.z);g.add(mesh(cyl(.04,.05,1.9,6),'#8E6A55',0,.95,0));g.add(mesh(new T.BoxGeometry(.5,.05,.05),'#8E6A55',.2,1.86,0));var l2=lantern([red,gold]);l2.position.set(.4,1.5,0);g.add(l2);g.add(mesh(cyl(.006,.006,.18,3),'#594C43',.4,1.77,0));g.rotation.y=k*1.3;bake(g);holAdd(g);}
      // 鞭炮：白天偶爾、晚上常常劈哩啪啦
      var crT=2;hol.tick.push(function(dt){crT-=dt;if(crT>0)return;crT=night>.5||phase==='eve'?1+Math.random()*1.6:4+Math.random()*5;
        var e=treeHome.entry,q=polar(5.4+Math.random()*1.4,FRONT+(Math.random()-.5)*1.6),x=Math.random()<.4?e.x+.6:q.x,z=Math.random()<.4?e.z+.6:q.z;
        for(var i=0;i<4;i++)setTimeout(function(){burst(x+(Math.random()-.5)*.5,.2,z+(Math.random()-.5)*.5,7,Math.random()<.5?'#E5483C':'#F6C343');},i*110);SND.sfx('pop');});
      hol.tick.push(function(){var g=.75+.25*Math.sin(now*3);red.color.set('#E5483C').multiplyScalar(night>.4?1.05:g*.25+.8);});
    },
    val:function(){
      [['#E8506A',FRONT-.2],['#F8A5C2',FRONT+.35]].forEach(function(c,i){var q=holSpot(.45,ringC([5.6,6.2,5.0],[c[1],c[1]+.3,c[1]-.3,c[1]+.6,c[1]-.6]));if(!q)return;
        var g=new T.Group();g.position.set(q.x,0,q.z);var hg=new T.ExtrudeGeometry(heartShape(.42),{depth:.16,bevelEnabled:true,bevelThickness:.05,bevelSize:.05,bevelSegments:2});hg.translate(0,0,-.08);hol.geos.push(hg);
        var h=mesh(hg,c[0],0,2.0+i*.25,0);g.add(h);g.add(mesh(cyl(.006,.006,1.6+i*.25,3),'#FFFFFF',0,(1.6+i*.25)/2,0));g.add(mesh(cyl(.06,.07,.1,6),'#8C6A55',0,.05,0));g.rotation.y=.45;holAdd(g);
        hol.tick.push(function(){h.position.y=2.0+i*.25+Math.sin(now*1.4+i)*.08;h.rotation.y=Math.sin(now*.8+i)*.35;h.rotation.z=Math.sin(now*1.1+i)*.06;});});
      floaters(34,heartTex,.38,['#FFFFFF'],true,8,6);
      if(!petalT)petalT=texDot(true);floaters(80,petalT,.2,['#E8506A','#F2A497','#F8C8D4','#C93B55'],false,9,6);
    },
    qixi:function(){
      floaters(20,heartTex,.32,['#FFFFFF'],true,8,6);
      // 銀河：天上一條淡淡的光帶，滿滿的小星星（晚上才看得到）
      var mw=canvasSprite(512,128,function(x,w,h){var g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(170,160,255,0)');g.addColorStop(.5,'rgba(215,205,255,.55)');g.addColorStop(1,'rgba(170,160,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);for(var i=0;i<420;i++){var y=h/2+(Math.random()+Math.random()+Math.random()-1.5)*h*.42;x.fillStyle='rgba(255,255,255,'+(.35+Math.random()*.65)+')';x.fillRect(Math.random()*w,y,Math.random()<.1?3:1.6,Math.random()<.1?3:1.6);}},230,46);
      mw.material.fog=false;var mp=polar(140,FRONT+Math.PI);mw.position.set(mp.x,34,mp.z);mw.material.rotation=.3;holAdd(mw);
      // 鵲橋：喜鵲在花園上空排成一座拱橋，兩端是牛郎星、織女星
      var tx=-Math.sin(FRONT),tz=Math.cos(FRONT),cx=-Math.cos(FRONT)*1.6,cz=-Math.sin(FRONT)*1.6,birds=[];
      for(var i=0;i<17;i++){var s=(i/16-.5)*9.5,b=canvasSprite(128,64,function(x){x.fillStyle='#2E2A2A';x.strokeStyle='#2E2A2A';x.lineWidth=3;x.beginPath();x.ellipse(64,36,20,10,0,0,6.29);x.fill();x.beginPath();x.moveTo(44,34);x.lineTo(8,30);x.lineTo(12,40);x.closePath();x.fill();x.beginPath();x.arc(88,30,9,0,6.29);x.fill();x.fillStyle='#F6C343';x.beginPath();x.moveTo(96,30);x.lineTo(106,32);x.lineTo(96,34);x.fill();x.fillStyle='#FFFFFF';x.beginPath();x.ellipse(64,40,12,5,0,0,6.29);x.fill();x.fillStyle='#3E4C78';x.beginPath();x.moveTo(52,30);x.quadraticCurveTo(60,2,78,6);x.quadraticCurveTo(72,22,74,30);x.closePath();x.fill();x.fillStyle='#FFFFFF';x.fillRect(60,16,8,6);},.75,.38);
        b.position.set(cx+tx*s,4.4+2.3*(1-Math.pow(s/4.75,2)),cz+tz*s);b.userData.ph=i*.7;holAdd(b);birds.push(b);}
      var stars2=[-1,1].map(function(sd,i){var s=canvasSprite(64,64,function(x){var g=x.createRadialGradient(32,32,0,32,32,30);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,i?'rgba(255,214,150,.9)':'rgba(180,215,255,.9)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);},1,1);s.material.fog=false;var e=5.6;s.position.set(cx+tx*sd*e,4.3,cz+tz*sd*e);holAdd(s);return s;});
      hol.tick.push(function(){var v=Math.max(night,phase==='eve'?.35:0),show=v>.2;mw.visible=show;mw.material.opacity=v*(wx.w==='rain'||wx.w==='snow'?.25:1);
        birds.forEach(function(b){b.visible=show;b.scale.set(.75,.38*(.55+.45*Math.abs(Math.sin(now*6+b.userData.ph))),1);});
        stars2.forEach(function(s,i){s.visible=show;s.scale.setScalar(.9+.35*Math.abs(Math.sin(now*2.2+i*1.3)));});});
    },
    moon:function(){
      // 月餅野餐墊：傍晚、晚上學和綾會來坐著吃月餅賞月
      var q2=holSpot(1.05,aroundFront([5.3,5.9,6.5,4.9,7.0]))||holSpot(.85,aroundFront([5.3,5.9,6.5,4.9,7.0]));
      if(q2){var ry=Math.atan2(-q2.x,-q2.z),m=new T.Group();m.position.set(q2.x,0,q2.z);m.rotation.y=ry;
        m.add(mesh(new T.BoxGeometry(1.6,.03,1.2),'#F2D58A',0,.016,0));for(var s2=-1;s2<=1;s2++){m.add(mesh(new T.BoxGeometry(1.61,.035,.12),'#C8553D',0,.018,s2*.38));}
        m.add(mesh(cyl(.24,.24,.02,16),'#FFFCF6',-.05,.04,-.22));[[-.13,-.28],[.03,-.3],[-.1,-.13],[.06,-.15]].forEach(function(c){m.add(mesh(cyl(.075,.075,.05,12),'#D49A55',c[0],.075,c[1]));m.add(mesh(cyl(.058,.058,.008,12),'#E8BC80',c[0],.104,c[1]));});
        [[.42,-.28],[.56,-.12]].forEach(function(c){m.add(mesh(ball(.11,2),'#D7E06B',c[0],.11,c[1]));});
        m.add(mesh(ball(.09,2),'#FFFCF6',-.45,.1,-.3));var sp=mesh(cone(.025,.12,5),'#FFFCF6',-.36,.13,-.3);sp.rotation.z=-1.1;m.add(sp);[-.6,-.52].forEach(function(x){m.add(mesh(cyl(.035,.03,.05,8),'#FFFCF6',x,.05,-.12));});
        bake(m);holAdd(m);holPic={id:'moon',x:q2.x,z:q2.z,ry:ry};}
      // 兔子燈籠
      var white=bmat('#FFF7EF'),pink=bmat('#FFD3DD'),reye=bmat('#E2554A');
      for(var k=0;k<5;k++){var q=holSpot(.35,ringC([5.4,6.1,6.8],[FRONT+.2,FRONT-.4,FRONT+.7,FRONT-.85,FRONT+1.15,FRONT-1.25,FRONT+1.5,FRONT-1.6]));if(!q)continue;
        var g=new T.Group();g.position.set(q.x,0,q.z);g.rotation.y=.45+(k%2?.6:-.6);
        var bd=new T.Mesh(ball(.2,2),white);bd.scale.set(1.5,1,1);bd.position.y=.42;g.add(bd);var hd=new T.Mesh(ball(.14,2),white);hd.position.set(.28,.56,0);g.add(hd);
        [-.05,.05].forEach(function(z){var ear=new T.Mesh(ball(.05,1),pink);ear.scale.set(.9,3,.7);ear.position.set(.22,.78,z);ear.rotation.z=.35;g.add(ear);var ey=new T.Mesh(ball(.022,1),reye);ey.position.set(.39,.59,z*1.1);g.add(ey);});
        [-.15,.15].forEach(function(x){[-.13,.13].forEach(function(z){var wh=mesh(new T.TorusGeometry(.065,.02,5,10),'#8C6A55',x,.08,z);g.add(wh);});});
        g.add(mesh(cyl(.015,.015,.7,4),'#8C6A55',-.42,.62,0));g.children[g.children.length-1].rotation.z=.6;
        bake(g);holAdd(g);}
      hol.tick.push(function(){if(!moonDisc)return;var wet=wx.w==='rain'||wx.w==='snow';moonDisc.visible=(phase==='night'||phase==='eve')&&!wet;moonDisc.scale.set(36,36,1);moonDisc.material.color.set('#FFE6A6');});
    },
    hween:function(){
      var face=bmat('#3B2A1A');
      for(var k=0;k<6;k++){var q=holSpot(.4,ringC([5.4,6.2,6.9],[FRONT,FRONT+.45,FRONT-.45,FRONT+.9,FRONT-.9,FRONT+1.3,FRONT-1.3]));if(!q)continue;
        var g=new T.Group();g.position.set(q.x,0,q.z);g.rotation.y=.45+(Math.random()-.5)*.5;var sc=.8+(k%3)*.18;g.scale.setScalar(sc);
        g.add(mesh(ball(.27,2),'#F08A2C',0,.24,0));g.children[0].scale.set(1.25,.85,1.15);
        for(var l=0;l<6;l++){var a=l/6*6.28,lb=mesh(ball(.17,2),l%2?'#E9792A':'#F39A3E',Math.cos(a)*.17,.24,Math.sin(a)*.15);lb.scale.set(.85,1.2,.85);g.add(lb);}
        g.add(mesh(cyl(.03,.045,.14,6),'#6B8E3A',0,.5,0));
        var tri=new T.CircleGeometry(.07,3);hol.geos.push(tri);[-.1,.1].forEach(function(x){var e=new T.Mesh(tri,face);e.position.set(x,.3,.335);e.rotation.z=Math.PI/2;g.add(e);});
        var mo=new T.Shape();mo.moveTo(-.15,0);for(var t2=0;t2<=6;t2++){mo.lineTo(-.15+t2*.05,t2%2?-.04:0);}mo.lineTo(.15,-.02);mo.quadraticCurveTo(0,-.13,-.15,-.02);mo.closePath();var mg=new T.ShapeGeometry(mo);hol.geos.push(mg);var mm=new T.Mesh(mg,face);mm.position.set(0,.2,.34);g.add(mm);
        bake(g);holAdd(g);}
      // 蝙蝠：繞著樹屋和遊樂區飛
      var bats=[];for(var i=0;i<9;i++){var c0=i<6?treeHome.c:AWp(0,0),b=canvasSprite(128,64,function(x){x.fillStyle='#2E2A2A';x.beginPath();x.moveTo(64,40);x.quadraticCurveTo(44,10,8,18);x.quadraticCurveTo(22,26,18,36);x.quadraticCurveTo(30,30,36,40);x.quadraticCurveTo(46,34,52,44);x.closePath();x.fill();x.beginPath();x.moveTo(64,40);x.quadraticCurveTo(84,10,120,18);x.quadraticCurveTo(106,26,110,36);x.quadraticCurveTo(98,30,92,40);x.quadraticCurveTo(82,34,76,44);x.closePath();x.fill();x.beginPath();x.ellipse(64,40,9,11,0,0,6.29);x.fill();x.beginPath();x.moveTo(58,32);x.lineTo(56,22);x.lineTo(62,30);x.moveTo(70,32);x.lineTo(72,22);x.lineTo(66,30);x.fill();x.fillStyle='#FFD54A';x.fillRect(59,36,3,3);x.fillRect(67,36,3,3);},.6,.3);
        b.userData={c:c0,r:1.6+Math.random()*2,h:4+Math.random()*2,sp:(Math.random()<.5?-1:1)*(.5+Math.random()*.5),ph:Math.random()*6.28};holAdd(b);bats.push(b);}
      petHats(witchDraw);
      hol.tick.push(function(){bats.forEach(function(b){var u=b.userData,a=now*u.sp+u.ph;b.position.set(u.c.x+Math.cos(a)*u.r,u.h+Math.sin(now*1.7+u.ph)*.35,u.c.z+Math.sin(a)*u.r);b.scale.set(.6*(.35+.65*Math.abs(Math.sin(now*11+u.ph))),.3,1);});
        face.color.set('#3B2A1A').lerp(new T.Color('#FFC24A'),Math.max(night,phase==='eve'?.6:0));});
    }
  };
  function tickHol(dt){if(hol)hol.tick.forEach(function(f){f(dt);});}
  // 點聖誕樹：一份小禮物（每個人每天一份，garden.html 決定給不給）
  function giftPop(){
    if(!hol||!hol.tree)return;var T0=hol.tree,ok=hooks.gift?hooks.gift():false;
    if(!ok){var g=T0.g;addFx({dur:.5,up:function(f){g.rotation.z=Math.sin(f.t*40)*.03*(1-f.t/f.dur);},end:function(){g.rotation.z=0;}});SND.sfx('tap');return;}
    var bx=new T.Group();bx.add(mesh(new T.BoxGeometry(.3,.24,.3),'#E2554A',0,0,0));bx.add(mesh(new T.BoxGeometry(.31,.25,.06),'#F6D27A',0,0,0));bx.add(mesh(new T.BoxGeometry(.06,.25,.31),'#F6D27A',0,0,0));
    bx.position.set(T0.x,.3,T0.z);scene.add(bx);burst(T0.x,.6,T0.z,14,'#F6D27A');
    addFx({dur:1.3,up:function(f){var k=f.t/f.dur;bx.position.y=.3+k*2.2;bx.rotation.y+=.12;bx.scale.setScalar(1-k*.6);},end:function(){scene.remove(bx);hearts(T0.x,2.6,T0.z,3);}});
  }

  /* ── 季節、天氣：garden.html 用日期算好（兩支手機一樣）傳進來；地面、樹的顏色跟著換，雨、雪、花瓣、落葉從天上飄下來 ── */
  var wx={w:'',s:''},precip=null,drift=null,tintBase={},crI0=null,crBase=null,crN=0,dotT=null,petalT=null;
  var SEASON={spring:{g:'#ABD68E',gk:.45,c:'#A6D391',ck:.25,tr:'#F6C6D4',trk:.6,every:3,drift:['#F8C8D4','#FBE0E8','#F4B6C8']},
    summer:{g:'#86BF72',gk:.35,c:'#76AF69',ck:.25},
    autumn:{g:'#BFBE78',gk:.55,c:'#D9A35A',ck:.42,tr:['#E59A52','#D9654F','#F2C14E','#C9873F'],trk:.75,drift:['#E59A52','#D9654F','#F2C14E','#C98A4B']},
    winter:{g:'#BCCBB7',gk:.5,c:'#A9B8A5',ck:.35,tr:'#AEBDA8',trk:.45}};
  function tintMat(c,to,k,snow,sk){var m=M(c);if(!tintBase[c])tintBase[c]=m.color.clone();m.color.copy(tintBase[c]);if(to)m.color.lerp(new T.Color(to),k);if(snow)m.color.lerp(new T.Color('#F2F6F7'),sk);}
  function texDot(petal){var c=document.createElement('canvas');c.width=c.height=32;var x=c.getContext('2d');x.fillStyle='#FFFFFF';x.beginPath();if(petal)x.ellipse(16,16,13,7,.6,0,Math.PI*2);else x.arc(16,16,13,0,Math.PI*2);x.fill();var t=new T.CanvasTexture(c);return t;}
  function setWeather(w,s){
    if(!T||(wx.w===w&&wx.s===s))return;wx.w=w;wx.s=s;var S=SEASON[s]||{},sn=w==='snow',col=new T.Color();
    tintMat('#97C383',S.g,S.gk,sn,.6);tintMat(GRASS,S.g,S.gk*.7,sn,.5);tintMat('#E3CFA0',null,0,sn,.35);
    ['#93C07E','#A1CB8B','#8CB878'].forEach(function(c){tintMat(c,S.g,S.gk,sn,.5);});
    ['#86B67C','#9AC58C','#77AA74'].forEach(function(c){tintMat(c,S.c,S.ck,sn,.3);});
    if(crI0){for(var i=0;i<crN;i++){var t=Math.floor(i/2);col.copy(crBase[i]);if(S.tr&&(!S.every||t%S.every===0))col.lerp(new T.Color(Array.isArray(S.tr)?S.tr[t%S.tr.length]:S.tr),S.trk);if(sn)col.lerp(new T.Color('#F2F6F7'),.45);crI0.setColorAt(i,col);}crI0.instanceColor.needsUpdate=true;}
    makePrecip(w);makeDrift(w==='rain'||sn?null:S.drift);
    if(ACTS.slideG){var wt=w==='rain'||sn;ACTS.slideG.visible=!wt;ACTS.gazebo.visible=wt;people.forEach(function(p){var k=(p.A&&p.A.k)||(p.goAct&&p.goAct.k);if((wt&&k==='slide')||(!wt&&k==='cafe'))endAct(p);});}
    flies.forEach(function(f,i){f.visible=i<14||s==='summer';});
    sky();
  }
  // 雨（一條一條的線）、雪（白點）：在鏡頭看的地方附近一圈落下
  function makePrecip(w){
    if(precip){scene.remove(precip.o);precip.o.geometry.dispose();precip.o.material.dispose();precip=null;}
    if(w!=='rain'&&w!=='snow')return;
    var rain=w==='rain',N=rain?520:620,D=[],geo=new T.BufferGeometry();
    for(var i=0;i<N;i++)D.push({x:(Math.random()-.5)*32,y:Math.random()*16,z:(Math.random()-.5)*32,s:.8+Math.random()*.4,ph:Math.random()*6.28});
    geo.setAttribute('position',new T.BufferAttribute(new Float32Array(N*(rain?6:3)),3));
    if(!dotT)dotT=texDot(false);
    var o=rain?new T.LineSegments(geo,new T.LineBasicMaterial({color:'#C6D8E6',transparent:true,opacity:.6})):new T.Points(geo,new T.PointsMaterial({color:'#FFFFFF',size:.24,map:dotT,transparent:true,depthWrite:false,alphaTest:.1}));
    o.frustumCulled=false;o.userData.dyn=true;scene.add(o);precip={o:o,D:D,rain:rain,N:N};
  }
  // 春天的花瓣、秋天的落葉：在花園上空慢慢飄下來
  function makeDrift(cols){
    if(drift){scene.remove(drift.o);drift.o.geometry.dispose();drift.o.material.dispose();drift=null;}
    if(!cols)return;
    var N=110,D=[],geo=new T.BufferGeometry(),cl=new Float32Array(N*3),c=new T.Color();
    for(var i=0;i<N;i++){D.push({x:(Math.random()-.5)*24,y:Math.random()*7,z:(Math.random()-.5)*24,s:.25+Math.random()*.3,ph:Math.random()*6.28});c.set(cols[i%cols.length]);cl[i*3]=c.r;cl[i*3+1]=c.g;cl[i*3+2]=c.b;}
    geo.setAttribute('position',new T.BufferAttribute(new Float32Array(N*3),3));geo.setAttribute('color',new T.BufferAttribute(cl,3));
    if(!petalT)petalT=texDot(true);
    var o=new T.Points(geo,new T.PointsMaterial({size:.26,map:petalT,vertexColors:true,transparent:true,depthWrite:false,alphaTest:.1}));o.frustumCulled=false;o.userData.dyn=true;scene.add(o);drift={o:o,D:D,N:N};
  }
  function tickWeather(dt){
    if(precip){var P=precip,a=P.o.geometry.attributes.position.array,cx=tgt.x,cz=tgt.z;
      for(var i=0;i<P.N;i++){var d=P.D[i];d.y-=(P.rain?13:1.1)*d.s*dt;if(!P.rain)d.x+=Math.sin(now*1.3+d.ph)*.3*dt;if(d.y<0){d.y+=16;d.x=(Math.random()-.5)*32;d.z=(Math.random()-.5)*32;}
        var x=cx+d.x,z=cz+d.z;if(P.rain){var j=i*6;a[j]=x;a[j+1]=d.y;a[j+2]=z;a[j+3]=x+.05;a[j+4]=d.y+.6;a[j+5]=z+.02;}else{var j2=i*3;a[j2]=x;a[j2+1]=d.y;a[j2+2]=z;}}
      P.o.geometry.attributes.position.needsUpdate=true;}
    if(drift){var Q=drift,b=Q.o.geometry.attributes.position.array;
      for(var k=0;k<Q.N;k++){var e=Q.D[k];e.y-=e.s*dt;e.x+=Math.sin(now*.9+e.ph)*.4*dt;e.z+=Math.cos(now*.7+e.ph)*.3*dt;if(e.y<0){e.y+=7;e.x=(Math.random()-.5)*24;e.z=(Math.random()-.5)*24;}b[k*3]=e.x;b[k*3+1]=e.y;b[k*3+2]=e.z;}
      Q.o.geometry.attributes.position.needsUpdate=true;}
  }
  /* ── 遊樂區：白天溜滑梯＋盪鞦韆、傍晚長椅看夕陽、晚上營火烤棉花糖（跟著現在幾點換） ── */
  var actG=null,ACTS={hits:{}},phase='',sunDisc=null,moonDisc=null,fireLight=null,sparkT=0,bothT=0;
  var FACE_OUT=AREA_ROT,FACE_IN=AREA_ROT+Math.PI,FACE_X=Math.atan2(Math.sin(AREA_A),-Math.cos(AREA_A));
  function AW(x,y,z){var q=AWp(x,z);return new T.Vector3(q.x,y,q.z);}
  function rod(g,a,b,r,col){var d=new T.Vector3().subVectors(b,a),m=mesh(cyl(r,r,d.length(),6),col);m.position.copy(a).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());g.add(m);return m;}
  function chuteAt(t){return new T.Vector3(-1.5+1.32*t,.16+1.1*Math.pow(1-t,1.7),.2);}
  function phaseOf(h){return h>=5.5&&h<16.5?'day':h>=16.5&&h<19?'eve':'night';}
  function discTex(a,b){var c=document.createElement('canvas');c.width=c.height=128;var x=c.getContext('2d'),g=x.createRadialGradient(64,64,4,64,64,64);g.addColorStop(0,a);g.addColorStop(.42,a);g.addColorStop(.5,b);g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128);var t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
  function addActs(){
    actG=new T.Group();var c=AWp(0,0);actG.position.set(c.x,0,c.z);actG.rotation.y=AREA_ROT;scene.add(actG);
    var V=function(x,y,z){return new T.Vector3(x,y,z);};
    function grp(){var g=new T.Group();g.visible=false;actG.add(g);return g;}
    function hitBox(g,kind,x,z,r,h){var m=new T.Mesh(cyl(r,r,h,12),hitMat);m.position.set(x,h/2,z);m.rotation.y=.13;m.visible=false;m.userData={act:kind};g.add(m);return m;}
    function box(g,w,h,d,col,x,y,z){var m=mesh(new T.BoxGeometry(w,h,d),col,x,y,z);g.add(m);return m;}
    // 白天：溜滑梯（左邊，有小屋頂）
    var day=grp(),Y=SLIDE_Y;ACTS.day=day;
    var sl=new T.Group();sl.userData.dyn=true;day.add(sl);ACTS.slideG=sl;
    [[-2.06,-.06],[-2.06,.46],[-1.5,-.06],[-1.5,.46]].forEach(function(q){sl.add(mesh(cyl(.04,.04,Y+.75,6),'#E9CBA3',q[0],(Y+.75)/2,q[1]));});
    box(sl,.66,.08,.66,'#C99A6F',-1.78,Y-.04,.2);
    var roof=mesh(cone(.56,.42,4),'#F6D27A',-1.78,Y+.96,.2);roof.rotation.y=Math.PI/4;sl.add(roof);
    [-.02,.42].forEach(function(z){rod(sl,V(-2.5,0,z),V(-2.08,Y,z),.03,'#B98B6B');});
    for(var k=1;k<=5;k++){var f=k/6,rg=mesh(cyl(.022,.022,.46,5),'#DAB58A',-2.5+.42*f,Y*f,.2);rg.rotation.x=Math.PI/2;sl.add(rg);}
    for(var sg=0;sg<8;sg++){var a=chuteAt(sg/8),b=chuteAt((sg+1)/8),d=b.clone().sub(a),ang=Math.atan2(d.y,d.x),m=box(sl,d.length()+.03,.05,.5,'#F2A497',(a.x+b.x)/2,(a.y+b.y)/2,.2);m.rotation.z=ang;
      [-.27,.27].forEach(function(dz){var rl=box(sl,d.length()+.03,.1,.04,'#F6D27A',(a.x+b.x)/2,(a.y+b.y)/2+.06,.2+dz);rl.rotation.z=ang;});}
    ACTS.slide={occ:null};
    // 下雨天：溜滑梯收起來，換成一座涼亭（裡面一張小圓桌、兩張椅子，兩杯咖啡、蛋糕和馬卡龍）
    var gz=new T.Group();gz.userData.dyn=true;gz.visible=false;day.add(gz);ACTS.gazebo=gz;var GX=-1.4,GZ=.25;
    gz.add(mesh(cyl(1.1,1.15,.1,6),'#C99A6F',GX,.05,GZ));
    var postA=[];for(var pa=0;pa<6;pa++){var th=pa*Math.PI/3;postA.push([GX+Math.cos(th)*.95,GZ+Math.sin(th)*.95]);gz.add(mesh(cyl(.045,.05,1.85,6),'#FFFCF6',postA[pa][0],1.0,postA[pa][1]));}
    for(var ri=0;ri<6;ri++){if(ri===4)continue;var q0=postA[ri],q1=postA[(ri+1)%6];rod(gz,V(q0[0],.5,q0[1]),V(q1[0],.5,q1[1]),.025,'#FFFCF6');rod(gz,V(q0[0],.32,q0[1]),V(q1[0],.32,q1[1]),.02,'#FFFCF6');}
    gz.add(mesh(cyl(1.18,1.18,.08,6),'#FFFCF6',GX,1.94,GZ));gz.add(mesh(cone(1.42,.75,6),'#D98C6C',GX,2.34,GZ));gz.add(mesh(ball(.08,1),'#F6D27A',GX,2.75,GZ));
    gz.add(mesh(cyl(.32,.32,.04,14),'#FFFCF6',GX,.64,GZ));gz.add(mesh(cyl(.04,.06,.54,6),'#956C50',GX,.37,GZ));gz.add(mesh(cyl(.18,.2,.04,10),'#956C50',GX,.12,GZ));
    [-1,1].forEach(function(sd){var cx=GX+sd*.5;gz.add(mesh(cyl(.19,.19,.06,10),sd<0?'#CDE6BF':'#F8C8D4',cx,.43,GZ));[[.12,.12],[.12,-.12],[-.12,.12],[-.12,-.12]].forEach(function(l){gz.add(mesh(cyl(.02,.02,.4,4),'#956C50',cx+l[0],.2,GZ+l[1]));});box(gz,.06,.42,.36,'#956C50',cx+sd*.19,.66,GZ);});
    box(gz,.02,.02,.02,'#FFFFFF',GX,.1,GZ);
    gz.add(mesh(cyl(.13,.13,.015,14),'#FFFCF6',GX,.67,GZ+.08));var ck=mesh(new T.CylinderGeometry(.11,.11,.08,10,1,false,0,Math.PI/2.2),'#FFF1CF',GX-.02,.72,GZ+.06);gz.add(ck);gz.add(mesh(ball(.03,1),'#E2675A',GX+.03,.78,GZ+.1));gz.add(mesh(cyl(.06,.07,.02,8),'#F8C8D4',GX+.04,.765,GZ+.1));
    [['#F8C8D4',-.08],['#B9DAA5',0],['#F6D27A',.08]].forEach(function(mc){[.0,.035].forEach(function(dy){var m=mesh(ball(.035,1),mc[0],GX+mc[1],.68+dy,GZ-.12);m.scale.y=.55;gz.add(m);});});
    gz.add(mesh(cyl(.03,.035,.1,8),'#A8D3E6',GX+.1,.71,GZ+.2));gz.add(mesh(ball(.035,1),'#F2A497',GX+.1,.79,GZ+.2));
    var lamp=new T.Mesh(ball(.09,2),new T.MeshBasicMaterial({color:'#FFE3A0'}));lamp.position.set(GX,1.7,GZ);gz.add(lamp);gz.add(mesh(cyl(.008,.008,.2,3),'#594C43',GX,1.82,GZ));
    // 兩個人的咖啡杯（會拿起來喝，所以不合起來）
    ACTS.cafe={occ:[null,null],x:[GX-.5,GX+.5],gx:GX,gz:GZ,cups:[],steamT:0};
    [-1,1].forEach(function(sd){var c=new T.Group();c.position.set(GX+sd*.17,.66,GZ-.02);c.add(mesh(cyl(.09,.09,.012,12),'#FFFCF6',0,0,0));c.add(mesh(cyl(.05,.04,.08,10),'#FFFCF6',0,.05,0));var cf=mesh(cyl(.045,.045,.005,10),'#6B4636',0,.09,0);c.add(cf);var hd=mesh(new T.TorusGeometry(.025,.008,4,8),'#FFFCF6',sd*.055,.05,0);hd.rotation.y=Math.PI/2;c.add(hd);c.userData.dyn=true;c.userData.rest=c.position.clone();gz.add(c);ACTS.cafe.cups.push(c);});
    // 盪鞦韆（右邊，兩個位子：綠的是學、粉紅的是綾）
    var SY=SWING_Y;
    [.45,2.35].forEach(function(x){rod(day,V(x,0,-.62),V(x,SY,0),.045,'#8FB9D9');rod(day,V(x,0,.62),V(x,SY,0),.045,'#8FB9D9');});
    rod(day,V(.42,SY,0),V(2.38,SY,0),.05,'#7FA8CB');
    ACTS.swing={occ:[null,null],x:[1.0,1.8],seat:[],phi:[0,0],vel:[0,0],amp:[0,0]};
    ACTS.swing.x.forEach(function(x,i){var g=new T.Group();g.position.set(x,SY,0);g.userData.dyn=true;day.add(g);[-.2,.2].forEach(function(dx){g.add(mesh(cyl(.012,.012,1.5,4),'#C9A884',dx,-.75,0));});g.add(mesh(new T.BoxGeometry(.5,.05,.26),['#9CCB85','#F2A497'][i],0,-1.5,0));ACTS.swing.seat.push(g);});
    ACTS.hits.day=[hitBox(sl,'slide',-1.6,.2,1.0,2.3),hitBox(day,'swing',1.4,0,1.05,2.2),hitBox(gz,'cafe',GX,GZ,1.15,2.4)];
    // 傍晚：長椅面向外面（夕陽那邊），後面一盞路燈
    var eve=grp();ACTS.eve=eve;
    box(eve,1.8,.07,.44,'#B9845E',0,.43,.42);box(eve,1.8,.36,.06,'#B9845E',0,.74,.19);box(eve,1.86,.06,.08,'#956C50',0,.95,.19);
    [-.8,.8].forEach(function(x){box(eve,.07,.43,.07,'#956C50',x,.21,.6);box(eve,.07,.92,.07,'#956C50',x,.46,.2);});
    box(eve,.6,.05,.36,'#CDE6BF',-.42,.48,.42);box(eve,.6,.05,.36,'#F8C8D4',.42,.48,.42);
    eve.add(mesh(cyl(.04,.05,2.1,6),'#594C43',-1.25,1.05,-.1));
    var bulb=new T.Mesh(ball(.13,2),new T.MeshBasicMaterial({color:'#FFE3A0'}));bulb.position.set(-1.25,2.17,-.1);eve.add(bulb);eve.add(mesh(cone(.2,.16,6),'#594C43',-1.25,2.33,-.1));
    for(var fl=0;fl<6;fl++){var fx0=(fl<3?-1:1)*(1.15+fl%3*.22),fz0=.5+(fl%3)*.25;eve.add(mesh(ball(.06,0),['#F8C8D4','#F6D27A','#FFFFFF'][fl%3],fx0,.05,fz0));}
    ACTS.bench={occ:[null,null],x:[-.42,.42]};
    ACTS.hits.eve=[hitBox(eve,'bench',0,.35,1.1,1.3)];
    // 晚上：營火（石頭圍一圈、木頭搭起來、火會跳）、外面一根大木頭可以坐
    var night=grp();ACTS.night=night;
    for(var st=0;st<10;st++){var sa=st/10*Math.PI*2,sm=mesh(new T.DodecahedronGeometry(.1),'#A9A39D',Math.cos(sa)*.42,.05,.3+Math.sin(sa)*.42);sm.scale.y=.7;night.add(sm);}
    [0,2.1,4.2].forEach(function(a){rod(night,V(Math.cos(a)*.3,0,.3+Math.sin(a)*.3),V(0,.5,.3),.05,'#8E6A55');});
    ACTS.flames=[];[['#FF8A3D',.24,.62,0,0],['#FFB347',.17,.48,.06,.03],['#FFE08A',.1,.32,-.05,-.03]].forEach(function(q){var m=new T.Mesh(cone(q[1],q[2],7),new T.MeshBasicMaterial({color:q[0],transparent:true,opacity:.92}));m.position.set(q[3],.1+q[2]/2,.3+q[4]);m.userData.dyn=true;night.add(m);ACTS.flames.push({m:m,h:q[2]});});
    var lg=mesh(cyl(.16,.16,1.9,8),'#8E6A55',0,.16,1.15);lg.rotation.z=Math.PI/2;night.add(lg);
    [-.95,.95].forEach(function(x){var ec=mesh(cyl(.13,.13,.02,8),'#D9B48A',x,.16,1.15);ec.rotation.z=Math.PI/2;night.add(ec);});
    box(night,.26,.14,.18,'#F6E7D8',1.25,.07,1.05);for(var mm=0;mm<3;mm++)night.add(mesh(cyl(.04,.04,.06,8),'#FFFFFF',1.17+mm*.08,.17,1.05));
    ACTS.fire={occ:[null,null],x:[-.42,.42],c:AW(0,.5,.3)};
    ACTS.hits.night=[hitBox(night,'fire',0,.55,1.2,1.4)];
    bake(sl);bake(gz);bake(day);bake(eve);bake(night);ACTS.swing.seat.forEach(function(g){bake(g);});
    fireLight=new T.PointLight('#FFA552',0,9,1.4);fireLight.position.copy(AW(0,.9,.3));scene.add(fireLight);
    // 夕陽（傍晚在長椅前面慢慢落下）、月亮（晚上）
    sunDisc=new T.Sprite(new T.SpriteMaterial({map:discTex('#FFE2A0','rgba(255,160,110,.5)'),fog:false,depthWrite:false,transparent:true}));sunDisc.scale.set(34,34,1);sunDisc.visible=false;scene.add(sunDisc);
    moonDisc=new T.Sprite(new T.SpriteMaterial({map:discTex('#FFF8E2','rgba(255,248,226,.22)'),fog:false,depthWrite:false,transparent:true}));moonDisc.scale.set(16,16,1);moonDisc.visible=false;scene.add(moonDisc);
    var mp=polar(150,AREA_A+.22);moonDisc.position.set(mp.x,25,mp.z);
  }
  // 換時段：舊的東西縮起來、新的長出來；正在玩的人先下來
  function setPhase(ph,quiet){
    if(ph===phase)return;var old=phase;phase=ph;
    people.forEach(function(p){if(p.state==='act'||p.goAct)endAct(p);});
    ['day','eve','night'].forEach(function(k){var g=ACTS[k];
      if(k===ph){g.visible=true;if(old&&!quiet){var cc=AWp(0,.2);growIn(g,cc.x,cc.z);}}
      else if(g.visible){if(old&&!quiet)addFx({dur:.4,up:function(f){g.scale.setScalar(Math.max(.01,1-f.t/f.dur));},end:function(){g.visible=false;g.scale.setScalar(1);}});else g.visible=false;}});
    var wet=wx.w==='rain'||wx.w==='snow';sunDisc.visible=ph==='eve'&&!wet;moonDisc.visible=ph==='night'&&!wet;if(ph!=='night')fireLight.intensity=0;
    if(old&&!quiet&&hooks.phase)hooks.phase(ph);
  }
  function sunAt(h){var k=Math.max(0,Math.min(1,(h-16.5)/2.5)),q=polar(150,AREA_A);sunDisc.position.set(q.x,20-22*k,q.z);sunDisc.material.color.set('#FFFFFF').lerp(new T.Color('#FF9C70'),k);}
  function freeP(p){return p.state!=='act'&&p.state!=='pic'&&!p.goPic&&!p.goAct&&!p.toTree&&!TREE_STATES[p.state]&&!p.land&&p.state!=='play';}
  function partner(p){return people.filter(function(o){return o!==p;})[0];}
  // 走去玩：從現在的位置（溪對面先過橋）走到遊樂區旁邊，再走到那個東西前面；不好走就繞花園內圈
  function goAct(p,k,i,n){
    var S=ACTS[k],v=[],t,sd=i===0?-1:1;
    if(k==='tswing'){
      // 樹屋鞦韆：從樹屋前面或後面繞過去，不穿過鞦韆盪的地方；坐的人站到座位前面，推的人站到後面
      S.occ[i]=p;var p0=far(p.ang,p.r)?bridgeVia(true):[],f0=p0.length?p0[1]:{a:p.ang,r:p.r},back=angDiff(f0.a,TH_A)>0;
      if(i===0){v=back?[THp(-.4,-2.9),THp(-2.95,-2.1),THp(-2.95,1.6)]:[THp(-.4,2.4)];t=THp(TSW.x,.9);}
      else{v=back?[THp(-.4,-2.9)]:[THp(-.4,2.4),THp(-2.95,1.6),THp(-2.95,-2.1)];t=THp(TSW.x,-2.15);}
    }
    else if(k==='slide'){S.occ=p;v=[AP(-2.85,-1.1)];t=AP(-2.78,.2);}
    else{S.occ[i]=p;var x=S.x[i];
      if(k==='swing')t=AP(x,-1.05);
      else if(k==='cafe')t=AP(S.gx+sd*.22,-1.15);
      else if(k==='bench'){v=[AP(sd*1.75,-1.1)];t=AP(sd*1.45,.95);}
      else{v=[AP(sd*1.95,-1.1)];t=AP(sd*1.6,.95);}}
    var pre=far(p.ang,p.r)?bridgeVia(true):[],from=pre.length?pre[1]:{a:p.ang,r:p.r},first=v[0]||t;
    if(hitsPond(from.a,from.r,first.a,first.r)||wetPath(from.a,from.r,first.a,first.r))pre=pre.concat([{a:from.a,r:Math.min(from.r,5.1)},{a:first.a,r:5.1}]);
    p.with=null;p.goPic=null;p.via=pre.concat(v);p.ta=t.a;p.tr=t.r;p.goAct={k:k,i:i,n:n||1};p.state='walk';
  }
  // 選一個空的位子：學喜歡綠色那邊、綾粉紅那邊
  function seatFor(p,k){var S=ACTS[k],pref=p.k==='syue'?0:1;if(!S.occ[pref])return pref;if(!S.occ[1-pref])return 1-pref;return -1;}
  function tryAct(p,force){
    var o=partner(p),ph=phase,r=Math.random(),TS=ACTS.tswing;
    if(TS&&!force){
      if(o&&TS.occ[0]===o&&!TS.occ[1]&&r<.75){goAct(p,'tswing',1);return true;}
      if(!TS.occ[0]&&!TS.occ[1]&&ph!=='night'&&wx.w!=='rain'&&wx.w!=='snow'&&Math.random()<.035){goAct(p,'tswing',0);return true;}
    }
    if(ph==='day'&&(wx.w==='rain'||wx.w==='snow')){
      var ci=seatFor(p,'cafe');
      if(o&&o.A&&o.A.k==='cafe'&&ci>=0&&(force||r<.85)){goAct(p,'cafe',ci);return true;}
      if(!force&&r>.35)return false;
      if(ci>=0&&Math.random()<.8){goAct(p,'cafe',ci);return true;}
      if(seatFor(p,'swing')>=0){goAct(p,'swing',seatFor(p,'swing'));return true;}
      return false;
    }
    if(ph==='day'){
      if(o&&o.A&&o.A.k==='swing'&&seatFor(p,'swing')>=0&&(force||r<.7)){goAct(p,'swing',seatFor(p,'swing'));return true;}
      if(!force&&r>.22)return false;
      if(!ACTS.slide.occ&&(Math.random()<.5||seatFor(p,'swing')<0)){goAct(p,'slide',0,2+Math.floor(Math.random()*2));return true;}
      if(seatFor(p,'swing')>=0){goAct(p,'swing',seatFor(p,'swing'));return true;}
      return false;
    }
    var kk=ph==='eve'?'bench':'fire',i=seatFor(p,kk);if(i<0)return false;
    if(o&&o.A&&o.A.k===kk&&(force||r<.8)){goAct(p,kk,i);return true;}
    if(force||r<(ph==='eve'?.3:.35)){goAct(p,kk,i);return true;}
    return false;
  }
  // 點遊樂區的東西：叫有空的人過來（長椅、營火兩個人都叫）
  function callAct(k){
    var who=[];
    if(k==='tswing'){
      // 樹屋鞦韆：有空的人過來；兩個都有空的話綾坐、學在後面推
      var TS=ACTS.tswing;if(!TS.occ[0])TS.vel+=.7;
      people.filter(freeP).sort(function(a,b){return (a.k==='ling'?0:1)-(b.k==='ling'?0:1);}).forEach(function(p){
        if(!TS.occ[0]){goAct(p,'tswing',0);who.push(p.k);}else if(!TS.occ[1]){goAct(p,'tswing',1);who.push(p.k);}});
      var rd=TS.occ[0];if(who.length===2||(who.length===1&&rd&&rd.k!==who[0])){k='tswingPush';who=[rd.k,TS.occ[1].k];}
      SND.sfx('tap');if(hooks.act)hooks.act(k,who);return who;
    }
    if(k==='fire')for(var b=0;b<14;b++)spark();
    if(k==='swing')ACTS.swing.vel=ACTS.swing.vel.map(function(v,i){return ACTS.swing.occ[i]?v:v+1.4;});
    people.filter(freeP).sort(function(a,b){return Math.hypot(a.r*Math.cos(a.ang)-actG.position.x,a.r*Math.sin(a.ang)-actG.position.z)-Math.hypot(b.r*Math.cos(b.ang)-actG.position.x,b.r*Math.sin(b.ang)-actG.position.z);}).forEach(function(p){
      if(who.length&&k==='slide')return;
      if(k==='slide'){if(!ACTS.slide.occ){goAct(p,'slide',0,2);who.push(p.k);}return;}
      var i=seatFor(p,k);if(i>=0){goAct(p,k,i);who.push(p.k);}
    });
    SND.sfx(k==='fire'?'pop':'tap');
    if(hooks.act)hooks.act(k,who);
    return who;
  }
  function startAct(p){
    var g=p.goAct;p.goAct=null;p.via=[];p.state='act';p.A={k:g.k,i:g.i,n:g.n,step:g.k==='slide'?'climb':'on',t:0,left:0,roast:0,eat:0};
    var A=p.A;
    if(A.k==='swing')A.left=9+Math.random()*5;
    if(A.k==='tswing'){var rd=ACTS.tswing.occ[0];A.left=A.i===1&&rd&&rd.A&&rd.A.k==='tswing'?Math.max(6,rd.A.left):16+Math.random()*8;}
    if(A.k==='bench')A.left=14+Math.random()*6;
    if(A.k==='fire'){A.left=18+Math.random()*8;A.roastNeed=5+Math.random()*3;}
    if(A.k==='cafe'){A.left=18+Math.random()*8;A.next=1.2+Math.random();A.sip=0;A.bite=0;}
    if(A.k==='slide')SND.sfx('tap');
  }
  function next(A,s){A.step=s;A.t=0;}
  // 下來以後站在哪（之後自己走出遊樂區）
  function offSpot(p){var A=p.A,sd=A.i===0?-1:1;if(A.k==='tswing')return THp(TSW.x,A.i===0?.9:-2.15);if(A.k==='slide')return AP(-.05,.2);if(A.k==='swing')return AP(ACTS.swing.x[A.i],-1.05);if(A.k==='cafe')return AP(ACTS.cafe.gx+sd*.22,-1.15);if(A.k==='bench')return AP(sd*1.45,.95);return AP(sd*1.6,.95);}
  function endAct(p){
    var g=p.A||p.goAct;
    if(g){var S=ACTS[g.k];if(g.k==='slide'){if(S.occ===p)S.occ=null;}else if(S.occ[g.i]===p)S.occ[g.i]=null;}
    if(p.A&&p.state==='act'){var o=offSpot(p);p.ang=o.a;p.r=o.r;}
    if(p.stick){scene.remove(p.stick);scene.remove(p.marsh);p.stick=p.marsh=null;}
    if(p.bite){scene.remove(p.bite);p.bite=null;}
    if(g&&g.k==='cafe'&&ACTS.cafe){var cp=ACTS.cafe.cups[g.i];if(cp)cp.position.copy(cp.userData.rest);}
    p.A=null;p.goAct=null;p.via=[];p.state='idle';p.timer=.3+Math.random();p.b.rotation.x=0;
  }
  function actStep(p,dt){
    var A=p.A;A.t+=dt;
    if(A.k==='slide'){
      if(A.step==='climb'&&A.t>1.3)next(A,'top');
      else if(A.step==='top'&&A.t>.45){next(A,'down');SND.sfx('swish');}
      else if(A.step==='down'&&A.t>.85)next(A,'land');
      else if(A.step==='land'&&A.t>.45){
        if(--A.n>0){var e=AP(-.05,.2);p.ang=e.a;p.r=e.r;p.A=null;p.state='walk';p.goAct={k:'slide',i:0,n:A.n};p.via=[AP(-.05,-1.1),AP(-2.85,-1.1)];var t=AP(-2.78,.2);p.ta=t.a;p.tr=t.r;}
        else endAct(p);
      }
      return;
    }
    if(A.step==='on'){if(A.t>.55)next(A,'use');return;}
    if(A.step==='use'){
      A.left-=dt;
      if(A.k==='tswing'&&A.i===1&&!ACTS.tswing.occ[0])A.left=0;
      if(A.k==='cafe'){
        if(A.sip>0)A.sip-=dt;
        else if(A.bite>0){A.bite-=dt;if(A.bite<=0){var hp2=p.feed?partner(p):p,hv2=new T.Vector3();hp2.hd.getWorldPosition(hv2);hearts(hv2.x,hv2.y+.3,hv2.z,p.feed?3:1);if(p.feed)SND.sfx('chime');p.feed=false;}}
        else{A.next-=dt;if(A.next<=0){A.next=2.2+Math.random()*2.6;if(Math.random()<.55)A.sip=1.4;else{var po2=partner(p);p.feed=!!(po2&&po2.A&&po2.A.k==='cafe'&&po2.A.step==='use'&&Math.random()<.35);A.bite=1.1;}}}
      }
      if(A.k==='fire'){
        if(A.eat>0){A.eat-=dt;if(A.eat<=0){A.roast=0;A.roastNeed=5+Math.random()*3;var hp=p.feed?partner(p):p;var hv=new T.Vector3();hp.hd.getWorldPosition(hv);hearts(hv.x,hv.y+.3,hv.z,p.feed?3:1);if(p.feed)SND.sfx('chime');p.feed=false;}}
        else{A.roast+=dt;if(A.roast>A.roastNeed){var o=partner(p);p.feed=!!(o&&o.A&&o.A.k==='fire'&&o.A.step==='use'&&Math.random()<.4);A.eat=1;}}
      }
      if(A.left<=0)next(A,'off');
      return;
    }
    if(A.step==='off'&&A.t>.55)endAct(p);
  }
  function sitPose(p,arms){p.legs[0].rotation.x=p.legs[1].rotation.x=-1.38;p.arms[0].rotation.x=p.arms[1].rotation.x=arms==null?-.35:arms;p.b.position.y=-.23;p.b.rotation.x=0;}
  // 每一格：照現在在做什麼放好位置、擺好姿勢
  function actPose(p){
    var A=p.A,k=A.k,u,pos,face=FACE_OUT,o=partner(p),both=o&&o.A&&o.A.k===k&&o.A.step==='use'&&A.step==='use';
    p.hd.rotation.z=0;
    if(k==='slide'){
      if(A.step==='climb'){u=Math.min(1,A.t/1.3);pos=AW(-2.5+.5*u,SLIDE_Y*u,.2);face=FACE_X;var cl=Math.sin(A.t*9);p.legs[0].rotation.x=cl*.5-.3;p.legs[1].rotation.x=-cl*.5-.3;p.arms[0].rotation.x=-2.4+cl*.35;p.arms[1].rotation.x=-2.4-cl*.35;p.b.position.y=0;}
      else if(A.step==='top'){pos=AW(-1.7,SLIDE_Y-.27,.2);face=FACE_X;sitPose(p);}
      else if(A.step==='down'){u=Math.min(1,A.t/.85);u=u*u*(3-2*u);var c=chuteAt(u);pos=AW(c.x,c.y-.27,.2);face=FACE_X;sitPose(p,-2.7);p.b.rotation.x=-.2;}
      else{pos=AW(-.05,0,.2);face=FACE_X;p.legs[0].rotation.x=p.legs[1].rotation.x=0;p.arms[0].rotation.x=p.arms[1].rotation.x=-2.5+Math.sin(now*10)*.3;p.b.position.y=Math.abs(Math.sin(A.t*7))*.08;}
    }else{
      var sd=A.i===0?-1:1,x=ACTS[k].x[A.i],from,seat;
      if(k==='tswing'){var TS=ACTS.tswing,Lp=TSW.L+.285,tp=TS.phi;
        if(A.i===0){from=THw(TSW.x,0,.9);seat=THw(TSW.x,TSW.py-Lp*Math.cos(tp),TSW.z+Lp*Math.sin(tp));}
        else{var pk=TS.amp>.05?Math.pow(Math.max(0,-tp/TS.amp),4):0;A.push=A.step==='use'&&TS.occ[0]&&TS.occ[0].A&&TS.occ[0].A.step==='use'?pk:0;from=seat=THw(TSW.x,0,-2.15+A.push*.12);}
        face=TH_ROT;}
      else if(k==='swing'){var ph=ACTS.swing.phi[A.i],L=1.785;from=AW(x,0,-1.05);seat=AW(x,SWING_Y-L*Math.cos(ph),-L*Math.sin(ph));face=FACE_IN;}
      else if(k==='bench'){from=AW(sd*1.45,0,.95);seat=AW(x,.195,.44);face=FACE_OUT;}
      else if(k==='cafe'){var C=ACTS.cafe;from=AW(C.gx+sd*.22,0,-1.15);seat=AW(x,.14,C.gz);face=A.i===0?FACE_X:FACE_X+Math.PI;}
      else{from=AW(sd*1.6,0,.95);seat=AW(x,.01,1.15);face=FACE_IN;}
      u=A.step==='on'?Math.min(1,A.t/.55):A.step==='off'?1-Math.min(1,A.t/.55):1;
      pos=from.clone().lerp(seat,u);
      if(u<.5){p.legs[0].rotation.x=p.legs[1].rotation.x=0;p.arms[0].rotation.x=p.arms[1].rotation.x=0;p.b.position.y=0;p.b.rotation.x=0;}
      else if(k==='swing'){sitPose(p,-2.25);p.b.rotation.x=ACTS.swing.phi[A.i]*.5;}
      else if(k==='tswing'){
        if(A.i===0){sitPose(p,-2.3);var tp2=ACTS.tswing.phi;p.b.rotation.x=-tp2*.7;p.legs[0].rotation.x=p.legs[1].rotation.x=-1.38-tp2*.8;}
        else{var ps=A.push||0,rdy=ACTS.tswing.occ[0]&&ACTS.tswing.occ[0].A&&ACTS.tswing.occ[0].A.step==='use';p.legs[0].rotation.x=-.25*ps;p.legs[1].rotation.x=.3*ps;p.arms[0].rotation.x=p.arms[1].rotation.x=rdy?-1.15-ps*.4:-.15;p.b.position.y=0;p.b.rotation.x=.14*ps;}}
      else if(k==='bench'){sitPose(p,both?-.55:-.35);if(both)p.hd.rotation.z=A.i===0?-.2:.2;}
      else if(k==='cafe'){
        sitPose(p,-.75);var C2=ACTS.cafe,cup=C2.cups[A.i],gzg=ACTS.gazebo,hv3=new T.Vector3(),fw3=new T.Vector3(Math.sin(face),0,Math.cos(face));
        // 喝咖啡：杯子從桌上拿到嘴邊再放回去
        var ks=A.step==='use'&&A.sip>0?Math.sin((1-A.sip/1.4)*Math.PI):0;p.arms[1].rotation.x=-.75-ks*1.25;
        p.hd.getWorldPosition(hv3);var mouth=hv3.clone().addScaledVector(fw3,.2).add(new T.Vector3(0,-.12,0)),rest=gzg.localToWorld(cup.userData.rest.clone());cup.position.copy(gzg.worldToLocal(rest.lerp(mouth,ks)));
        // 吃甜點：一小塊從盤子飛到嘴邊（餵的話飛到對方嘴邊）
        if(A.step==='use'&&A.bite>0){if(!p.bite){p.bite=mesh(ball(.035,1),['#F8C8D4','#FFF1CF','#B9DAA5'][Math.floor(Math.random()*3)]);scene.add(p.bite);}var kb=1-A.bite/1.1,who3=p.feed?o:p,hb3=new T.Vector3();who3.hd.getWorldPosition(hb3);var mo=hb3.add(new T.Vector3(Math.sin(who3.g.rotation.y),0,Math.cos(who3.g.rotation.y)).multiplyScalar(.2)).add(new T.Vector3(0,-.1,0)),pl3=AW(C2.gx,.72,C2.gz+.06);p.bite.position.copy(pl3.lerp(mo,Math.min(1,kb*1.4)));p.bite.visible=kb<.8;p.arms[1].rotation.x=-.75-Math.sin(Math.min(1,kb*1.3)*Math.PI)*1.1;}
        else if(p.bite){scene.remove(p.bite);p.bite=null;}
        if(both)p.hd.rotation.z=A.i===0?-.1:.1;
      }
      else{var eating=A.eat>0;sitPose(p);p.arms[1].rotation.x=eating?-1.9:-1.1;if(both)p.hd.rotation.z=A.i===0?-.12:.12;}
      // 烤棉花糖：手上一根樹枝，前面插著棉花糖，烤得越久越金黃；烤好就吃掉（有時候餵另一個人）
      if(k==='fire'&&A.step==='use'){
        if(!p.stick){p.stick=mesh(cyl(.012,.012,1,4),'#B98B6B');p.marsh=new T.Mesh(cyl(.05,.05,.1,10),new T.MeshToonMaterial({color:'#FFFFFF',gradientMap:GM}));scene.add(p.stick);scene.add(p.marsh);}
        var sh=new T.Vector3();p.arms[1].getWorldPosition(sh);var fw=new T.Vector3(Math.sin(face),0,Math.cos(face)),hand=sh.clone().addScaledVector(fw,.32).add(new T.Vector3(0,-.12,0)),tip;
        if(A.eat>0){var who=p.feed?o:p,hv=new T.Vector3();who.hd.getWorldPosition(hv);var mouth=hv.add(new T.Vector3(Math.sin(who.g.rotation.y),0,Math.cos(who.g.rotation.y)).multiplyScalar(.22)).add(new T.Vector3(0,-.08,0));tip=hand.clone().lerp(mouth,Math.min(1,(1-A.eat)*2.5));}
        else tip=ACTS.fire.c.clone().add(new T.Vector3(sd*.12,.12+Math.sin(now*1.7+A.i)*.03,0));
        var dv=tip.clone().sub(hand),len=dv.length();p.stick.position.copy(hand).addScaledVector(dv,.5);p.stick.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dv.clone().normalize());p.stick.scale.set(1,len,1);
        p.marsh.position.copy(tip);p.marsh.quaternion.copy(p.stick.quaternion);p.marsh.visible=!(A.eat>0&&A.eat<.45);
        var rf=Math.min(1,A.roast/A.roastNeed);p.marsh.material.color.set('#FFFFFF').lerp(new T.Color(rf<.7?'#F6D58A':'#C98A4B'),rf<.7?rf/.7:1).lerp(new T.Color('#B9773F'),rf<.7?0:(rf-.7)/.3*.6);
      }else if(p.stick){scene.remove(p.stick);scene.remove(p.marsh);p.stick=p.marsh=null;}
    }
    p.g.position.copy(pos);p.face=face;
  }
  function spark(){var c=ACTS.fire.c,m=new T.Mesh(new T.OctahedronGeometry(.03),new T.MeshBasicMaterial({color:Math.random()<.5?'#FFB347':'#FFE08A',transparent:true}));m.position.set(c.x+(Math.random()-.5)*.25,c.y,c.z+(Math.random()-.5)*.25);scene.add(m);var vx=(Math.random()-.5)*.3,vz=(Math.random()-.5)*.3;
    addFx({dur:1.1+Math.random()*.6,up:function(f,dt){m.position.y+=dt*(1.1-f.t*.4);m.position.x+=vx*dt;m.position.z+=vz*dt;m.material.opacity=1-f.t/f.dur;},end:function(){scene.remove(m);m.geometry.dispose();m.material.dispose();}});}
  // 遊樂區每一格：鞦韆擺、火跳、兩個人一起的時候冒愛心
  function tickActs(dt){
    var TS=ACTS.tswing;
    if(TS){var rd=TS.occ[0],ps=TS.occ[1],riding=!!(rd&&rd.A&&rd.A.k==='tswing'&&rd.A.step==='use'),pushing=riding&&!!(ps&&ps.A&&ps.A.k==='tswing'&&ps.A.step==='use');
      if(riding){var goal=pushing?.4:.24;TS.amp+=Math.max(-dt*.05,Math.min(dt*(pushing?.08:.05),goal-TS.amp));TS.t+=dt*1.85;TS.phi=TS.amp*Math.sin(TS.t);TS.vel=0;}
      else{TS.amp=Math.max(0,TS.amp-dt*.4);TS.t=0;TS.vel+=(-3.3*TS.phi-.7*TS.vel)*dt;TS.phi+=TS.vel*dt;if(rd&&rd.A)TS.phi*=.9;}
      TS.g.rotation.x=-TS.phi;}
    var S=ACTS.swing;
    for(var i=0;i<2;i++){var o=S.occ[i];
      if(o&&o.A&&o.A.k==='swing'&&o.A.step==='use'){S.amp[i]=Math.min(.55,S.amp[i]+dt*.18);S.phi[i]=S.amp[i]*Math.sin(now*2.35+i*.9);S.vel[i]=0;}
      else{S.amp[i]=Math.max(0,S.amp[i]-dt*.5);S.vel[i]+=(-6*S.phi[i]-.8*S.vel[i])*dt;S.phi[i]+=S.vel[i]*dt;if(o&&o.A)S.phi[i]*=.9;}
      S.seat[i].rotation.x=S.phi[i];}
    if(phase==='night'){
      ACTS.flames.forEach(function(f,j){var sc=.85+.25*Math.sin(now*(9+j*3))+.1*Math.sin(now*23+j);f.m.scale.set(1,sc,1);f.m.position.y=.1+f.h*sc/2;f.m.rotation.y+=dt*(j+1);});
      fireLight.intensity=2.2+.5*Math.sin(now*11)+.3*Math.sin(now*29);
      sparkT-=dt;if(sparkT<=0){sparkT=.18+Math.random()*.3;spark();}
    }
    if(ACTS.gazebo&&ACTS.gazebo.visible&&phase==='day'){var C=ACTS.cafe;C.steamT-=dt;if(C.steamT<=0){C.steamT=.45+Math.random()*.3;C.cups.forEach(function(cup){var w=new T.Vector3();cup.getWorldPosition(w);var m=new T.Mesh(ball(.025,1),new T.MeshBasicMaterial({color:'#FFFFFF',transparent:true,opacity:.6,depthWrite:false}));m.position.set(w.x+(Math.random()-.5)*.03,w.y+.12,w.z);scene.add(m);addFx({dur:1.4,up:function(f,dt2){m.position.y+=dt2*.22;m.position.x+=Math.sin(f.t*3)*.002;m.scale.setScalar(1+f.t*1.4);m.material.opacity=.6*(1-f.t/f.dur);},end:function(){scene.remove(m);m.material.dispose();}});});}}
    var a=people[0],b=people[1];
    if(a&&b&&a.A&&b.A&&a.A.k===b.A.k&&a.A.step==='use'&&b.A.step==='use'&&a.A.k!=='slide'){
      // 兩個人一起：一起多待一下、每隔幾秒冒愛心
      var m=Math.max(a.A.left,b.A.left);a.A.left=b.A.left=m;
      bothT-=dt;if(bothT<=0){bothT=3.4;var mid=a.g.position.clone().add(b.g.position).multiplyScalar(.5);hearts(mid.x,mid.y+1.6,mid.z,a.A.k==='swing'?2:3);}
    }
  }
  // 下一步做什麼：去樹屋（另一個人在上面的話很想去陪）、去摸寵物、去找另一個人、散步（不走進樹屋底下）
  /* ── 去新土地散步：先走到花園的路口（溪這邊是西邊花田、湖畔小園的方向，溪對面是果樹坡、山腳草地的方向），
     走上外圈沙土小路、沿著小路走到那塊地的路口（經過溪的地方走橋），進去逛幾個地方，再照原路走回花園 ── */
  var RINGW=8.95,EXIT_R=7.6,INNER=5.3;
  function openLands(){return LAND_IDS.map(function(id){return LAND_GEO[id];}).filter(function(L){return L.open;});}
  function landPoint(L){
    for(var n=0;n<12;n++){var a=Math.random()*6.28,d=Math.random()*(L.R-.8),x=L.c.x+Math.cos(a)*d,z=L.c.z+Math.sin(a)*d,ok=!blocked(x,z);
      for(var i=L.p0;i<L.p0+3&&ok;i++)if(Math.hypot(PLOT[i][0]-x,PLOT[i][1]-z)<1.15)ok=false;
      if(ok)return {a:Math.atan2(z,x),r:Math.hypot(x,z)};}
    return {a:L.a,r:L.r-L.R+.9};
  }
  function exitTo(ids,a){var X=null,bd=9;ids.forEach(function(id){var d=Math.abs(angDiff(LAND_GEO[id].a,a));if(d<bd){bd=d;X=LAND_GEO[id];}});return X;}
  function gate(L){return {a:L.a,r:L.r-L.R+.4};}
  function goLand(p,L){
    var isFar=far(p.ang,p.r),X=exitTo(isFar?['orchard','hill']:['west','lake'],L.a),v=[];
    if(!isFar)v.push({a:p.ang,r:Math.min(p.r,INNER)},{a:X.a,r:INNER});
    v.push({a:X.a,r:EXIT_R},{a:X.a,r:RINGW},{a:L.a,r:RINGW},gate(L));
    var t=landPoint(L);p.goPic=null;p.via=v;p.ta=t.a;p.tr=t.r;p.land=L;p.landN=2+Math.floor(Math.random()*3);p.with=null;p.state='walk';
  }
  function leaveLand(p){
    var L=p.land,X=exitTo(['west','lake','orchard','hill'],L.a),t=null;
    for(var n=0;n<8&&!t;n++){var ta=X.a+(Math.random()-.5)*1.2,tr=RING[0]+Math.random()*(RING[1]-RING[0]);if(!blocked(Math.cos(ta)*tr,Math.sin(ta)*tr)&&pathOk(X.a,EXIT_R,ta,tr))t={a:ta,r:tr};}
    if(!t)t={a:X.a,r:EXIT_R};
    p.via=[gate(L),{a:L.a,r:RINGW},{a:X.a,r:RINGW},{a:X.a,r:EXIT_R}];p.ta=t.a;p.tr=t.r;p.land=null;p.with=null;p.state='walk';
  }
  // 在新土地上：再逛幾個地方（另一個人也在的話常常走過去找他），逛夠了就回花園
  function landChoose(p,other){
    if(p.landN-->0){
      if(other&&other.land===p.land&&other.state==='idle'&&!other.with&&Math.random()<.45){p.via=[];p.with=other;p.state='walk';other.timer=6;return;}
      var t=landPoint(p.land);p.via=[];p.ta=t.a;p.tr=t.r;p.state='walk';return;
    }
    leaveLand(p);
  }
  // 野餐：中間花園裡有野餐墊的話，偶爾走過去坐在上面（另一個人在的話很想去陪）
  function allPics(){return holPic?picnics.concat([holPic]):picnics;}
  function goPic(p){
    var P=(holPic&&hol&&hol.k==='moon'?[holPic]:[]).concat(allPics().filter(function(q){return Math.hypot(q.x,q.z)<ISL-1;}))[0];if(!P)return false;
    var o=partner(p),i=o&&o.goPic&&o.goPic.i===0?1:0,lx=i===0?-.36:.36,lz=.12,c=Math.cos(P.ry),sn=Math.sin(P.ry),x=P.x+lx*c+lz*sn,z=P.z-lx*sn+lz*c,a=Math.atan2(z,x),r=Math.hypot(x,z);
    if(!pathOk(p.ang,p.r,a,r))return false;
    p.with=null;p.via=[];p.ta=a;p.tr=r;p.goPic={i:i,x:x,z:z,face:P.ry};p.state='walk';return true;
  }
  function choose(p){
    if(holdAI){p.timer=1;return;}
    p.goPic=null;
    var r=Math.random(),other=people.filter(function(o){return o!==p;})[0],free=treeHome?treeHome.occ.indexOf(null):-1,ls=openLands();
    if(p.land){landChoose(p,other);return;}
    var px=Math.cos(p.ang)*p.r,pz=Math.sin(p.ang)*p.r;
    if(inArea(px,pz,.05)){var la=toArea(px,pz),ex=AP(Math.max(-2.4,Math.min(2.4,la.x)),-1.1);p.via=[];p.with=null;p.ta=ex.a;p.tr=ex.r;p.state='walk';return;}
    var op0=partner(p);
    var pics=allPics().length;
    if(pics&&op0&&(op0.state==='pic'||op0.goPic)&&Math.random()<.75&&goPic(p))return;
    if(hol&&hol.k==='moon'&&holPic&&(phase==='eve'||phase==='night')&&Math.random()<.7&&goPic(p))return;
    if(hol&&hol.k==='nye'&&night>.3&&free>=0&&Math.random()<.8){goTree(p,free);return;}
    if(pics&&Math.random()<.09&&goPic(p))return;
    if(phase&&tryAct(p))return;
    if(ls.length&&other&&other.land&&Math.random()<.5){goLand(p,other.land);return;}
    if(ls.length&&Math.random()<.14){goLand(p,ls[Math.floor(Math.random()*ls.length)]);return;}
    if(free>=0&&other&&(other.state==='sit'||other.state==='toSeat'||other.state==='climb')&&Math.random()<.7)goTree(p,free);
    else if(free>=0&&r<.15)goTree(p,free);
    else if(r<.42&&pets.length){p.via=[];var pt=pets.slice().sort(function(a,b){return Math.abs(angDiff(a.ang,p.ang))-Math.abs(angDiff(b.ang,p.ang));})[0];p.with=pt;pt.wait=Math.max(pt.wait,8);p.state='walk';}
    else if(r<.54&&other&&other.state==='idle'&&!other.with&&!other.toTree&&!other.land){p.via=[];p.with=other;p.state='walk';other.state='idle';other.timer=6;}
    else{p.with=null;p.via=[];var okT=false;for(var n=0;n<6&&!okT;n++){p.ta=p.ang+(Math.random()-.5)*2.2;p.tr=RING[0]+Math.random()*(RING[1]-RING[0]);okT=!blocked(Math.cos(p.ta)*p.tr,Math.sin(p.ta)*p.tr)&&pathOk(p.ang,p.r,p.ta,p.tr);}if(okT)p.state='walk';else{p.state='idle';p.timer=1;}}
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
    var bhs=Object.keys(decors).filter(function(id){return decors[id].k==='birdhouse';});
    if(bhs.length&&Math.random()<.5){var bd=decors[bhs[Math.floor(Math.random()*bhs.length)]];v.target=new T.Vector3(bd.x,1.82,bd.z);v.from=v.g.position.clone();v.t=0;return;}
    var ids=Object.keys(trees),t=ids.length?trees[ids[Math.floor(Math.random()*ids.length)]]:null;
    if(t){var top=new T.Box3().setFromObject(t.g.children[0]).max.y;v.target=new T.Vector3(t.g.position.x,top+.05,t.g.position.z);}
    else{var q=polar(RING[0]+.2+Math.random()*.4,Math.random()*6.28);v.target=new T.Vector3(q.x,.02,q.z);}
    v.from=v.g.position.clone();v.t=0;
  }
  function leave(v){if(v.state==='out')return;v.state='out';var q=polar(18,Math.random()*6.28);v.from=v.g.position.clone();v.target=new T.Vector3(q.x,8,q.z);v.t=0;}
  function moveVisitors(dt){
    if(now>nextVisit){var bh=hasDecor('birdhouse');nextVisit=now+(18+Math.random()*22)*(bh?.6:1);if(visitors.length<3)makeVisitor((bh?['butterfly','bee','bird','bird']:['butterfly','butterfly','bee','bird'])[Math.floor(Math.random()*4)]);}
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

  /* ── 森林：長大的植物排在小島外圍；移植過的（pos）種在存下來的位置 ── */
  function forestSpot(i){var s=spots[i%spots.length],extra=Math.floor(i/spots.length);return {x:Math.cos(s.a+extra*.09)*(s.r-extra*.35),z:Math.sin(s.a+extra*.09)*(s.r-extra*.35)};}
  function idNum(id){var n=0;for(var i=0;i<id.length;i++)n=(n*31+id.charCodeAt(i))%9973;return n;}
  // 每棵樹在哪：有存位置的先放；其他的照順序排在外圈，碰到別的樹就往後找空位（兩支手機算出來一樣）
  function layoutForest(list){
    var out={},placed=[];
    list.forEach(function(f){if(f.pos&&isFinite(f.pos.x)&&isFinite(f.pos.z)){out[f.id]={x:+f.pos.x,z:+f.pos.z};placed.push(out[f.id]);}});
    list.forEach(function(f,i){if(out[f.id])return;var k=i,p;do{p=forestSpot(k++);}while(k<i+300&&placed.some(function(q){return Math.hypot(q.x-p.x,q.z-p.z)<.8;}));out[f.id]=p;placed.push(p);});
    return out;
  }
  function setForest(list){
    var keep={},at=layoutForest(list),first=!Object.keys(trees).length&&!setForest.done;setForest.done=true;
    list.forEach(function(f){
      var p=at[f.id],t=trees[f.id];keep[f.id]=1;
      if(t){if(Math.hypot(t.x-p.x,t.z-p.z)>.05)moveTree(t,p.x,p.z);if((t.rot||0)!==(f.rot||0)){t.rot=f.rot||0;spinTo(t.g,t.base+t.rot*ROT);}return;}
      var g=new T.Group(),pl=plant(f.sp,4),fw=window.SP[f.sp].kind==='flower';
      pl.scale.setScalar(fw?.85:.72);g.add(pl);g.position.set(p.x,0,p.z);var base=rnd(idNum(f.id))*6.28;g.rotation.y=base+(f.rot||0)*ROT;
      var coll=new T.Mesh(cyl(.7,.7,3,8),hitMat);coll.position.y=1.4;coll.visible=false;coll.userData={tree:f.id};g.add(coll);
      scene.add(g);trees[f.id]={g:g,x:p.x,z:p.z,sp:f.sp,base:base,rot:f.rot||0};
      if(!first)growIn(g,p.x,p.z);
    });
    Object.keys(trees).forEach(function(id){if(!keep[id]){scene.remove(trees[id].g);delete trees[id];}});
  }
  // 種下去：從小長大彈一下；移植：在原地縮小、土噴起來，到新位置再長出來
  function growIn(g,x,z){g.scale.setScalar(.01);burst(x,.4,z,10);addFx({dur:.6,up:function(f){var k=f.t/f.dur;g.scale.setScalar(.01+.99*(1-Math.pow(1-k,3))*(1+.2*Math.sin(k*Math.PI)));},end:function(){g.scale.setScalar(1);}});}
  function moveTree(t,x,z){
    var g=t.g,x0=t.x,z0=t.z;t.x=x;t.z=z;burst(x0,.3,z0,8,'#9C7258');
    addFx({dur:.35,up:function(f){g.scale.setScalar(Math.max(.01,1-f.t/f.dur));},end:function(){g.position.set(x,0,z);growIn(g,x,z);SND.sfx('plant');}});
  }
  // 這裡能不能種森林的樹：要在開放的土地上、不能壓到土、小溪、泉水池、樹屋、別的樹；回傳原因（空字串＝可以）
  function segDist(x,z,a,b){var dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l)):0;return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);}
  function canPlace(x,z,self){
    var ok=Math.hypot(x,z)<ISL-.45;
    LAND_IDS.forEach(function(id){var L=LAND_GEO[id];if(L.open&&Math.hypot(x-L.c.x,z-L.c.z)<L.R-.45)ok=true;});
    if(!ok)return '要種在花園的草地上';
    for(var i=0;i<PLOT.length;i++){var lo=landOf(i);if((!lo||lo.open)&&Math.hypot(PLOT[i][0]-x,PLOT[i][1]-z)<1.2)return '這裡是種花的土';}
    for(var j=0;j<flow.length-1;j++)if(segDist(x,z,flow[j],flow[j+1])<.62)return '這裡是小溪';
    if(pondP&&Math.hypot(x-pondP.x,z-pondP.z)<1)return '這裡是泉水池';
    if(inArea(x,z,.3))return '這裡是遊樂區';
    if(treeHome&&Math.hypot(x-treeHome.c.x,z-treeHome.c.z)<3)return '這裡是樹屋';
    if(treeHome){var s0=THw(TSW.x,0,-2.4),s1=THw(TSW.x,0,1.1);if(segDist(x,z,s0,s1)<.95)return '這裡是樹屋的鞦韆';}
    var rr=arguments[3]||.45;
    for(var id in trees)if(id!==self&&Math.hypot(trees[id].x-x,trees[id].z-z)<rr+.4)return '太靠近別的樹了';
    for(var di in decors)if(di!==self&&Math.hypot(decors[di].x-x,decors[di].z-z)<rr+(DECOR_R[decors[di].k]||.5)+.15)return '太靠近別的裝飾了';
    return '';
  }
  // 新長大的樹放哪：花園外圈先、再來是新土地外圈，找第一個空位
  function freeSpot(){
    var c=[];for(var k=0;k<spots.length*2;k++)c.push(forestSpot(k));
    LAND_IDS.forEach(function(id){var L=LAND_GEO[id];if(L.open)c=c.concat(L.spots);});
    for(var i=0;i<c.length;i++){var p=c[i],free=true;for(var t in trees)if(Math.hypot(trees[t].x-p.x,trees[t].z-p.z)<.8){free=false;break;}if(free)return {x:Math.round(p.x*10)/10,z:Math.round(p.z*10)/10};}
    return null;
  }
  function forestPos(){var o={};Object.keys(trees).forEach(function(id){o[id]={x:Math.round(trees[id].x*10)/10,z:Math.round(trees[id].z*10)/10};});return o;}

  /* ── 移植：選好要搬的樹（或植物），點空地（或別塊土）；半透明的樹＋綠圈＝可以，紅圈＝不行 ── */
  function ring(col,r){var m=new T.Mesh(new T.RingGeometry(r*.78,r,36),new T.MeshBasicMaterial({color:col,transparent:true,opacity:.9,depthWrite:false}));m.rotation.x=-Math.PI/2;m.renderOrder=5;scene.add(m);return m;}
  function moveStart(kind,id){
    moveEnd();
    if(kind==='decor'||kind==='decorNew'){
      var dk=kind==='decor'?(decors[id]&&decors[id].k):id;if(!dk)return false;var dsrc=kind==='decor'?decors[id]:null;
      mv={kind:kind,id:kind==='decor'?id:null,k:dk,r:DECOR_R[dk]||.5,sel:null,src:dsrc,mark:ring('#F6D27A',(DECOR_R[dk]||.5)+.3)};
      if(dsrc)mv.mark.position.set(dsrc.x,.035,dsrc.z);else mv.mark.visible=false;
      var dg=decorModel(dk);mv.mats=[];dg.traverse(function(o){if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.5;o.material.depthWrite=false;o.castShadow=false;mv.mats.push(o.material);}});
      dg.visible=false;scene.add(dg);mv.ghost=dg;mv.ok=ring('#7BC67E',mv.r+.2);mv.bad=ring('#E2675A',mv.r+.2);mv.ok.visible=mv.bad.visible=false;
      if(el<.95)egoal=.95;return true;
    }
    var src=kind==='tree'?trees[id]:plots.filter(function(p){return p.on&&p.id===id;})[0];if(!src)return false;
    mv={kind:kind,id:id,sel:null,src:src,mark:ring('#F6D27A',.85)};
    mv.mark.position.set(src.x,.035,src.z);
    if(kind==='tree'){
      var gh=plant(src.sp,4),fw=window.SP[src.sp].kind==='flower';gh.scale.setScalar(fw?.85:.72);mv.mats=[];
      gh.traverse(function(o){if(o.isMesh){o.material=o.material.clone();o.material.transparent=true;o.material.opacity=.5;o.material.depthWrite=false;o.castShadow=false;mv.mats.push(o.material);}});
      gh.visible=false;scene.add(gh);mv.ghost=gh;mv.ok=ring('#7BC67E',.75);mv.bad=ring('#E2675A',.75);mv.ok.visible=mv.bad.visible=false;
      if(el<.95)egoal=.95;
    }
    if(lastSt)update(lastSt);
    return true;
  }
  function moveEnd(){
    if(!mv)return;
    [mv.mark,mv.ok,mv.bad,mv.ghost].forEach(function(o){if(o)scene.remove(o);});(mv.mats||[]).forEach(function(m){m.dispose();});
    mv=null;if(lastSt)update(lastSt);
  }
  function movePick(ray){
    var pt=new T.Vector3(),gnd=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),pt);
    if(mv.kind==='plot'){
      // 先看點到地上的哪一塊土（前面那塊的植物比較高，不要擋到後面的土），沒有再看點到哪棵植物
      var p=null,bd=1;if(gnd)plots.forEach(function(q){var d=Math.hypot(q.x-pt.x,q.z-pt.z);if(q.on&&d<bd){bd=d;p=q;}});
      if(!p){var h=ray.intersectObjects(plots.filter(function(q){return q.on;}).map(function(q){return q.coll;}))[0];if(h)p=plots.filter(function(q){return q.coll===h.object;})[0];}
      if(!p||p.id===mv.id)return;
      hooks.moveSel({slot:p.i,swap:p.id||null});return;
    }
    if(!gnd)return;
    var x=Math.round(pt.x*2)/2,z=Math.round(pt.z*2)/2,why=canPlace(x,z,mv.id,mv.r);
    if(!why&&mv.k==='picnic'&&Math.hypot(x,z)>ISL-1.1)why='野餐墊要放在中間的花園裡';
    mv.sel={x:x,z:z,ok:!why,why:why};
    mv.ghost.visible=!why;mv.ghost.position.set(x,0,z);if(mv.k)mv.ghost.rotation.y=Math.atan2(-x,-z);
    mv.ok.visible=!why;mv.bad.visible=!!why;(why?mv.bad:mv.ok).position.set(x,.04,z);
    hooks.moveSel(mv.sel);
  }
  // 鏡頭飛到某塊土地（或回花園中間）
  // 轉方向的時候：鏡頭對準那一個、圈圈一直亮著，點別的東西不會打開卡片
  var rotK=null;
  function focusObj(kind,id){var x,z,t=null;
    if(kind==='decor'&&decors[id]){x=decors[id].x;z=decors[id].z;t={kind:'decor',id:id};}
    else if(kind==='tree'&&trees[id]){x=trees[id].x;z=trees[id].z;t={kind:'tree',id:id};}
    else{var p=plots.filter(function(q){return q.on&&q.id===id;})[0];if(p){x=p.x;z=p.z;t={kind:'plot',p:p};}}
    if(!t)return false;rotK=t;setHL(t,true);hl.hold=1e9;focus(x,z,11,null,.5);idleAt=Date.now()+1e9;return true;}
  function unfocus(){rotK=null;hl.hold=null;setHL(null);idleAt=Date.now();}
  function focus(x,z,r,a,e){tgoal.set(x,.7,z);rgoal=r||0;agoal=a==null?null:a;egoal=e==null?null:e;}
  // 看某塊新土地：鏡頭站在花園這邊往外看，後面是草原和遠山
  function focusLand(id){var L=LAND_GEO[id];if(!L||!L.open){focus(0,0,fitR,.45,.62);return;}var f=L.a+Math.PI+(L.vo||0);focus(L.c.x,L.c.z,16,Math.atan2(Math.cos(f),Math.sin(f)),.78);}

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
    cv.addEventListener('pointerdown',function(e){ptrs[e.pointerId]={x:e.clientX,y:e.clientY};try{cv.setPointerCapture(e.pointerId);}catch(_){}idleAt=Date.now();var ids=Object.keys(ptrs);if(ids.length===1){down={x:e.clientX,y:e.clientY,t:Date.now(),moved:0};if(!mv&&!rotK){down.tg=targetAt(e.clientX,e.clientY);hl.hold=null;setHL(down.tg,true);}}else{down=null;pinch0=dist();rad0=rad;}});
    var hoverT=0;
    cv.addEventListener('pointermove',function(e){var p=ptrs[e.pointerId];
      if(!p){if(e.pointerType==='mouse'&&!mv&&!rotK&&Date.now()-hoverT>60){hoverT=Date.now();var ht=targetAt(e.clientX,e.clientY);if(hl.hold==null)setHL(ht,false);}return;}var dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;idleAt=Date.now();
      var ids=Object.keys(ptrs);if(ids.length>=2){var d=dist();if(pinch0){rad=Math.max(10,Math.min(40,rad0*pinch0/d));rgoal=0;}return;}
      agoal=egoal=null;az-=dx*.006;el=Math.max(.3,Math.min(1.12,el+dy*.0035));if(down){down.moved+=Math.abs(dx)+Math.abs(dy);if(down.moved>=10&&down.tg){down.tg=null;setHL(null);}}});
    cv.addEventListener('pointerleave',function(e){if(e.pointerType==='mouse'&&hl.hold==null)setHL(null);});
    function up(e){var d=down;delete ptrs[e.pointerId];if(Object.keys(ptrs).length<2)pinch0=0;if(d&&d.moved<10&&Date.now()-d.t<1500)pick(e,d.tg);else if(d&&e.pointerType!=='mouse')setHL(null);down=null;}
    cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',function(e){delete ptrs[e.pointerId];down=null;pinch0=0;setHL(null);});
    cv.addEventListener('wheel',function(e){e.preventDefault();rad=Math.max(10,Math.min(40,rad*(1+e.deltaY*.001)));rgoal=0;idleAt=Date.now();},{passive:false});
  }
  function dist(){var p=Object.keys(ptrs).map(function(k){return ptrs[k];});return p.length<2?1:Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);}
  // 點到什麼：小鳥 → 送水、蝴蝶蜜蜂 → 飛走、害蟲 → 抓走、寵物 → 跳一下、人 → 揮手、土 → 種、植物 → 澆水卡片、森林的樹 → 回憶
  /* ── 點到什麼：先找出手指（滑鼠）下面是哪一個東西，再決定要做什麼 ──
     植物和森林的樹最容易點錯：先看名字標籤（畫在最上面，點名字最準）→ 再看植物本身的形狀 → 點到地上就找最近的那塊土或樹幹 */
  function rayAt(cx,cy){var r=R.domElement.getBoundingClientRect(),v=new T.Vector2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1),ray=new T.Raycaster();ray.setFromCamera(v,cam);return ray;}
  var _p1=null,_p2=null;
  function toScreen(v,r){var q=v.clone().project(cam);return {x:r.left+(q.x+1)/2*r.width,y:r.top+(1-q.y)/2*r.height,z:q.z};}
  // 名字標籤（含下面的進度條）：用螢幕上的位置比，手指離哪個標籤中間最近就是哪個
  function labelAt(cx,cy){
    var r=R.domElement.getBoundingClientRect(),best=null,bd=1e9,right=new T.Vector3().setFromMatrixColumn(cam.matrixWorld,0),up=new T.Vector3().setFromMatrixColumn(cam.matrixWorld,1);
    plots.forEach(function(p){
      if(!p.on||!p.lab.visible)return;
      var sx=p.lab.scale.x,sy=p.lab.scale.y,c=p.lab.position.clone().addScaledVector(up,sy*.6),c0=toScreen(c,r);if(c0.z>1)return;
      var ex=toScreen(c.clone().addScaledVector(right,sx*(p.id?.24:.12)),r),ey=toScreen(c.clone().addScaledVector(up,sy*.36),r),hw=Math.abs(ex.x-c0.x),hh=Math.abs(ey.y-c0.y),dx=Math.abs(cx-c0.x)/hw,dy=Math.abs(cy-c0.y)/hh;
      if(dx<=1&&dy<=1){var d=dx*dx+dy*dy+c0.z*.01;if(d<bd){bd=d;best=p;}}
    });
    return best;
  }
  // 植物、森林的樹：射線打到真的形狀；沒打到就看地上最近的土（.9 以內）或樹幹（.7 以內）
  function plantAt(ray){
    var hits=[],hp=null,ht=null,dp=1e9,dt=1e9;
    plots.forEach(function(p){if(p.on&&p.id){var h=ray.intersectObject(p.holder,true)[0];if(h&&h.distance<dp){dp=h.distance;hp=p;}}});
    Object.keys(trees).forEach(function(id){var h=ray.intersectObject(trees[id].g.children[0],true)[0];if(h&&h.distance<dt){dt=h.distance;ht=id;}});
    if(hp||ht)return dp<=dt?{kind:'plot',p:hp}:{kind:'tree',id:ht};
    var pt=new T.Vector3();if(!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),pt))return null;
    var bp=null,bd=.9;plots.forEach(function(p){var d=Math.hypot(p.x-pt.x,p.z-pt.z);if(p.on&&d<bd){bd=d;bp=p;}});if(bp)return {kind:'plot',p:bp};
    var bt=null,bt2=.7;Object.keys(trees).forEach(function(id){var d=Math.hypot(trees[id].x-pt.x,trees[id].z-pt.z);if(d<bt2){bt2=d;bt=id;}});if(bt)return {kind:'tree',id:bt};
    return null;
  }
  function targetAt(cx,cy){
    var ray=rayAt(cx,cy);
    // 信箱上飄的信封最優先（有人、寵物走到前面也點得到）
    if(envS&&envS.visible&&ray.intersectObject(envS)[0])return {kind:'decor',id:envS.userData.id};
    var lh=ray.intersectObjects(LAND_IDS.map(function(id){return LAND_GEO[id].sign.hb;}))[0];if(lh)return {kind:'sign',id:lh.object.userData.land};
    var vh=ray.intersectObjects(visitors.map(function(q){return q.hb;}))[0];if(vh)return {kind:'visitor',v:vh.object.userData.v};
    var lb=labelAt(cx,cy);if(lb)return {kind:'plot',p:lb};
    var pt=ray.intersectObjects(plots.filter(function(p){return p.pest;}).map(function(p){return p.pest.hb;}))[0];if(pt)return {kind:'pest',id:pt.object.userData.pest};
    var ph=ray.intersectObjects(pets.map(function(p){return p.spr;}))[0];if(ph){var pp=pets.filter(function(p){return p.spr===ph.object;})[0];if(pp)return {kind:'pet',p:pp};}
    var hu=ray.intersectObjects(people.map(function(p){return p.g.children[3];}))[0];if(hu){var who=people.filter(function(p){return p.k===hu.object.userData.person;})[0];if(who)return {kind:'person',p:who};}
    if(hol&&hol.hits.length&&ray.intersectObjects(hol.hits)[0])return {kind:'xtree'};
    var ah=ray.intersectObjects((ACTS.hits[phase]||[]).concat(ACTS.hits.all||[]).filter(function(m){return m.parent.visible;}))[0];if(ah)return {kind:'act',k:ah.object.userData.act,o:ah.object};
    var dh=ray.intersectObjects(Object.keys(decors).map(function(id){return decors[id].g.children[decors[id].g.children.length-1];}))[0];if(dh)return {kind:'decor',id:dh.object.userData.decor};
    return plantAt(ray);
  }
  // 亮起來的地方：地上一個圈（滑鼠移過去、手指按下去就亮），植物的名字標籤也放大一點
  var hl={ring:null,lab:null,key:'',t:0,strong:false},flashes=[];
  function hlSpot(t){
    if(!t)return null;
    if(t.kind==='plot')return {x:t.p.x,z:t.p.z,r:.95,lab:t.p.lab};
    if(t.kind==='tree'&&trees[t.id])return {x:trees[t.id].x,z:trees[t.id].z,r:.8};
    if(t.kind==='decor'&&decors[t.id])return {x:decors[t.id].x,z:decors[t.id].z,r:(DECOR_R[decors[t.id].k]||.5)+.25};
    if(t.kind==='pet')return {x:t.p.x,z:t.p.z,r:.5};
    if(t.kind==='person'){var g=t.p.g.position;return {x:g.x,z:g.z,r:.5};}
    if(t.kind==='act'){var w=new T.Vector3();t.o.getWorldPosition(w);return {x:w.x,z:w.z,r:t.o.userData.hr||1.3};}
    if(t.kind==='xtree'&&hol&&hol.tree)return {x:hol.tree.x,z:hol.tree.z,r:1.3};
    return null;
  }
  function setHL(t,strong){
    var sp=hlSpot(t),key=sp?t.kind+':'+(t.id||(t.p&&(t.p.k||t.p.i))||t.k):'';
    if(hl.lab&&hl.lab!==(sp&&sp.lab)){hl.lab.scale.set(hl.lab.userData.sx,hl.lab.userData.sy,1);hl.lab=null;}
    if(!sp){if(hl.ring)hl.ring.visible=false;hl.key='';R.domElement.style.cursor=t?'pointer':'';return;}
    if(!hl.ring){hl.ring=new T.Mesh(new T.RingGeometry(.8,1,40),new T.MeshBasicMaterial({color:'#FFE27A',transparent:true,opacity:.95,depthWrite:false}));hl.ring.rotation.x=-Math.PI/2;hl.ring.renderOrder=6;scene.add(hl.ring);}
    hl.ring.visible=true;hl.ring.position.set(sp.x,.045,sp.z);hl.r=sp.r;hl.strong=!!strong;hl.key=key;hl.t=0;hl.ring.material.color.set(strong?'#FFC93C':'#FFE68A');
    if(sp.lab&&hl.lab!==sp.lab){hl.lab=sp.lab;if(!sp.lab.userData.sx){sp.lab.userData.sx=sp.lab.scale.x;sp.lab.userData.sy=sp.lab.scale.y;}sp.lab.scale.set(sp.lab.userData.sx*1.14,sp.lab.userData.sy*1.14,1);}
    R.domElement.style.cursor='pointer';
  }
  function act(t){
    if(!t)return;
    if(t.kind==='sign'){var L=LAND_GEO[t.id];if(L.open)focusLand(t.id);if(hooks.land)hooks.land(t.id,L.open);return;}
    if(t.kind==='visitor'){var vv=t.v;hearts(vv.g.position.x,vv.g.position.y+.2,vv.g.position.z,vv.kind==='bird'?3:1);if(vv.kind==='bird'){if(vv.state!=='out')hooks.bird();}else SND.sfx('pop');leave(vv);return;}
    if(t.kind==='pest'){hooks.pest(t.id);return;}
    if(t.kind==='pet'){var pp=t.p;pp.hop=.5;SND.sfx('pop');hearts(pp.x,1.2,pp.z,1);return;}
    if(t.kind==='person'){var who=t.p;if(TREE_STATES[who.state]||who.toTree)who.waveT=1.6;else if(who.state!=='play'){who.state='play';who.with=null;who.timer=1.6;who.act=1.2;who.face=Math.atan2(cam.position.x-who.g.position.x,cam.position.z-who.g.position.z);}SND.sfx('tap');return;}
    if(t.kind==='act'){callAct(t.k);return;}
    if(t.kind==='xtree'){giftPop();return;}
    if(t.kind==='decor'){if(hooks.decor){SND.sfx('tap');hooks.decor(t.id);}return;}
    if(t.kind==='tree'){hooks.tree(t.id);return;}
    if(t.kind==='plot'){var p=t.p;if(p.id)hooks.plant(p.id);else hooks.plot(p.i);}
  }
  function pick(e,pre){
    if(mv){movePick(rayAt(e.clientX,e.clientY));return;}
    if(rotK)return;
    var t=pre!==undefined?pre:targetAt(e.clientX,e.clientY);
    setHL(t,true);hl.hold=.7;act(t);
  }
  // 森林分類：讓某幾棵樹在 3D 裡閃幾秒（地上一圈一圈亮）
  function flashTrees(ids){
    flashes.forEach(function(f){scene.remove(f.m);f.m.geometry.dispose();f.m.material.dispose();});flashes=[];
    (ids||[]).forEach(function(id){var t=trees[id];if(!t)return;var m=new T.Mesh(new T.RingGeometry(.62,.8,32),new T.MeshBasicMaterial({color:'#FFD45E',transparent:true,opacity:.95,depthWrite:false}));m.rotation.x=-Math.PI/2;m.renderOrder=6;m.position.set(t.x,.05,t.z);scene.add(m);flashes.push({m:m,t:0});});
  }
  function tickHL(dt){
    if(hl.ring&&hl.ring.visible){hl.t+=dt;var k=1+Math.sin(hl.t*6)*.06;hl.ring.scale.set(hl.r*k,hl.r*k,1);if(hl.hold!=null){hl.hold-=dt;if(hl.hold<=0){hl.hold=null;setHL(null);}}}
    for(var i=flashes.length-1;i>=0;i--){var f=flashes[i];f.t+=dt;var s=1+Math.sin(f.t*5)*.15;f.m.scale.set(s,s,1);f.m.material.opacity=f.t<5?.95:Math.max(0,.95-(f.t-5)*1.5);if(f.t>5.7){scene.remove(f.m);f.m.geometry.dispose();f.m.material.dispose();flashes.splice(i,1);}}
  }

  /* ── 每一格 ── */
  function tick(dt){
    now+=dt;
    var kk=1-Math.exp(-dt*3.2);tgt.lerp(tgoal,kk);if(rgoal)rad+=(rgoal-rad)*kk;
    if(agoal!=null){var dA=angDiff(agoal,az);az+=dA*kk;if(Math.abs(dA)<.002)agoal=null;}if(egoal!=null){el+=(egoal-el)*kk;if(Math.abs(egoal-el)<.002)egoal=null;}
    place();
    if(mv){var pu=1+Math.sin(now*5)*.08;mv.mark.scale.set(pu,pu,pu);if(mv.kind==='plot'){var sp0=mv.src;mv.mark.position.set(sp0.x,.2,sp0.z);}}
    if(Date.now()-skyAt>20000){skyAt=Date.now();sky();}
    clouds.rotation.y+=dt*.012;
    movePets(dt);movePeople(dt);moveVisitors(dt);tickActs(dt);tickWeather(dt);tickDecor(dt);tickParty(dt);tickHol(dt);tickHL(dt);
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
  var lastDraw=0,drawn=0,qTier=0,qLock=-1,qEval={t0:0,n:0,sum:0,last:0};
  function busy(){for(var k in ptrs)return true;return Date.now()-idleAt<1500||agoal!=null||egoal!=null||(!!rgoal&&Math.abs(rgoal-rad)>.05)||tgt.distanceToSquared(tgoal)>1e-4||!!mv||performance.now()-qEval.t0<qEval.win;}
  function setQuality(t){qTier=t;sun.castShadow=t<1;R.setPixelRatio(t>=2?1:Math.min(2,window.devicePixelRatio||1));size();}
  // 開始後先每一格都畫，量 4 秒：平均一格超過 40ms（不到 25 格）就降一級，最多降兩級
  function quality(t){if(qLock>=0||qTier>=2||qEval.done)return;qEval.n++;if(qEval.last)qEval.sum+=t-qEval.last;qEval.last=t;if(t-qEval.t0<qEval.win)return;var avg=qEval.n>1?qEval.sum/(qEval.n-1):0;if(avg>40){setQuality(qTier+1);qEval={t0:t,n:0,sum:0,last:0,win:4000};}else{qEval.done=true;qEval.win=0;}}
  function loop(){
    if(!running)return;requestAnimationFrame(loop);if(!vis||document.hidden){clock.getDelta();return;}
    var t=performance.now();if(!qEval.t0){qEval.t0=t;qEval.win=4000;}
    if(!busy()&&t-lastDraw<31)return;
    lastDraw=t;drawn++;quality(t);
    var dt=Math.min(.05,clock.getDelta())*tScale;tick(dt);R.render(scene,cam);
  }
  // 畫面變大小：直的畫面比較窄，鏡頭退遠一點讓整座島放得下
  function fit(){var a=cam.aspect,t=Math.tan(cam.fov*Math.PI/360)*Math.min(1,a);return Math.max(21,Math.min(31,7.6/t));}
  function size(){var w=box.clientWidth||300,h=box.clientHeight||300,f0=rad===fitR;R.setSize(w,h,false);cam.aspect=w/h;cam.fov=w/h<.8?44:36;cam.updateProjectionMatrix();fitR=fit();if(f0||!rad)rad=fitR;}

  /* ── 給 garden.html 用的 ── */
  function init(el0,hk){
    box=el0;hooks=hk;
    // 載入進度回報給 garden.html 的讀取畫面：lib（three.js 下載好）→ scene（場景蓋好、畫出第一格）→ 回傳的 promise 完成＝寵物也到了
    // 蓋場景之前先讓瀏覽器畫一次，讀取畫面上的字才會先換成「種下樹木和花…」
    return import(SRC).then(function(m){
      T=m;if(hooks.progress)hooks.progress('lib');
      return new Promise(function(ok){requestAnimationFrame(function(){setTimeout(ok,0);});});
    }).then(function(){
      var cv=document.createElement('canvas');box.insertBefore(cv,box.firstChild);
      R=new T.WebGLRenderer({canvas:cv,antialias:true,powerPreference:'low-power'});
      if(!R.getContext())throw new Error('no webgl');
      R.setPixelRatio(Math.min(2,window.devicePixelRatio||1));R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;
      build();addTreehouse();addActs();sky();bakeScene();addPeople();bind(cv);size();
      if(window.ResizeObserver)new ResizeObserver(size).observe(box);else addEventListener('resize',size);
      if(window.IntersectionObserver)new IntersectionObserver(function(es){vis=es[0].isIntersecting;}).observe(box);
      try{var lq=localStorage.getItem('gardenQ');if(lq!=null&&lq!==''){qLock=+lq;setQuality(qLock);}}catch(e){}
      clock=new T.Clock();running=true;rad=fitR;nextVisit=6;place();loop();
      if(hooks.progress)hooks.progress('scene');
      return addPets();
    });
  }
  // st.slots[i]：第 i 塊土 null 或 {id, sp, stage, frac, r, name, ready, thirsty, pest, pkey}；st.open[i]：開了沒
  // st.lands：[{id, name, lv, open}]；st.forest：[{id, sp, pos}]（舊的在前）
  function update(st){
    if(!T)return;
    lastSt=st;if(st.weather)setWeather(st.weather,st.season||'');setDecor(st.decor||[]);mailUp=!!st.mail;if(treeHome)setParty(st.party||null);
    (st.lands||[]).forEach(function(l){
      var L=LAND_GEO[l.id];if(!L)return;
      if(l.open!==L.open){L.open=l.open;L.g.visible=l.open;L.lock.visible=!l.open;if(l.open&&L.seen){growIn(L.g,L.c.x,L.c.z);for(var b=0;b<3;b++)burst(L.c.x+(b-1)*1.6,.5,L.c.z,10);}}
      L.seen=true;drawLabel(L.sign.lb,l.open?{text:'🏡 '+l.name}:{text:'🔒 Lv.'+l.lv+' 新土地',empty:true});
    });
    plots.forEach(function(p,i){
      var open=st.open?!!st.open[i]:i<st.slots.length,s=open?st.slots[i]||null:null;
      if(open!==p.on){p.on=open;p.base.visible=p.lab.visible=open;if(open&&p.key===''&&p.stage===-1&&p.seen){p.grow=0;burst(p.x,.4,p.z,10);}p.seen=true;}
      if(!open){setPest(p,null);return;}
      var key=s?[s.id,s.sp,s.stage].join(':'):'';
      if(key!==p.key){
        var grew=s&&(p.id===s.id?s.stage>p.stage:p.key==='');
        p.key=key;p.id=s?s.id:null;p.stage=s?s.stage:-1;
        while(p.holder.children.length)p.holder.remove(p.holder.children[0]);
        if(s){p.holder.add(plant(s.sp,s.stage));p.holder.scale.setScalar(1);p.top=height(p.holder);if(grew)pop(p);}else p.top=.3;
        p.rot=s?s.rot||0:0;p.holder.rotation.y=p.rot*ROT;
        p.coll.userData=s?{plant:s.id}:{slot:i};
      }
      p.sc=s&&s.stage>0?.9+.1*(s.frac||0):1;
      if(s&&(s.rot||0)!==(p.rot||0)){p.rot=s.rot||0;spinTo(p.holder,p.rot*ROT);}
      p.holder.rotation.z=s&&s.thirsty?.17:0;
      setPest(p,s&&s.pest,s&&s.pkey);
      // 長大了：旁邊繞著四顆小星星
      var want=s&&s.ready?4:0;
      while(p.spk.length<want){var m=new T.Mesh(new T.OctahedronGeometry(.08),new T.MeshBasicMaterial({color:'#F6D27A'}));scene.add(m);p.spk.push(m);}
      while(p.spk.length>want){scene.remove(p.spk.pop());}
      var PN={bug:'🐛',snail:'🐌',beetle:'🪲'};
      var mp=mv&&mv.kind==='plot';
      drawLabel(p.lab,s?{text:(mp&&s.id===mv.id?'🪴 ':s.pest?PN[s.pest]+' ':s.ready?'✨ ':'')+s.name,frac:s.r,ready:s.ready||(mp&&s.id===mv.id),pest:!!s.pest,thirsty:s.thirsty,sub:mp&&s.id!==mv.id?'點這裡交換':s.thirsty&&!s.pest?'口渴了…':''}:{text:mp?'移到這裡':'＋',empty:true});
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
    else if(o&&o.sign&&LAND_GEO[o.sign])v=LAND_GEO[o.sign].sign.hb.position.clone();
    else if(o&&o.at)v=new T.Vector3(o.at[0],0,o.at[1]);
    else if(o&&o.decor&&decors[o.decor])v=decors[o.decor].g.position.clone().setY(.8);
    else if(o&&o.act){var hh=(ACTS.hits[phase]||[]).concat(ACTS.hits.all||[]).filter(function(m){return m.userData.act===o.act;})[0];if(hh){v=new T.Vector3();hh.getWorldPosition(v);}}
    else if(o&&o.env&&envS&&envS.visible)v=envS.position.clone();
    else if(o&&o.xtree&&hol&&hol.tree)v=new T.Vector3(hol.tree.x,1.3,hol.tree.z);
    else if(o&&o.person){var h=people.filter(function(q){return q.k===o.person;})[0];if(h)v=h.g.position.clone().setY(.9);}
    if(!v)return null;v.project(cam);var r=R.domElement.getBoundingClientRect();return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};
  }
  return {resetView:function(){az=.45;el=.62;rad=fitR;rgoal=0;agoal=egoal=null;tgt.set(0,.7,0);tgoal.copy(tgt);idleAt=Date.now();place();},
    move:moveStart,moveEnd:moveEnd,moving:function(){return mv?{kind:mv.kind,id:mv.id,sel:mv.sel}:null;},freeSpot:freeSpot,forestPos:forestPos,canPlace:function(x,z,id){return canPlace(x,z,id);},
    focusLand:focusLand,focusObj:focusObj,unfocus:unfocus,
    // 測試用：每個人、每隻寵物在溪的哪一邊、離水多近、是不是在橋上；叫某個人／寵物走去某個地方
    // 營火有多近（看著遊樂區＝1、很遠＝0）：給環境音調營火聲大小
    fireNear:function(){if(!actG)return 0;var c=AWp(0,.3),d=Math.hypot(tgt.x-c.x,tgt.z-c.z)+Math.max(0,rad-14)*.5;return Math.max(0,Math.min(1,1-(d-3)/12));},
    speed:function(n){tScale=n||1;},treePos:function(id){var t=trees[id];return t?{x:t.x,z:t.z}:null;},rots:function(){var o={};for(var id in decors)o['d:'+id]=+decors[id].g.rotation.y.toFixed(2);for(var t in trees)o['t:'+t]=+trees[t].g.rotation.y.toFixed(2);plots.forEach(function(p){if(p.id)o['p:'+p.id]=+p.holder.rotation.y.toFixed(2);});return o;},hol:function(){return hol?{k:hol.k,objs:hol.objs.length,tree:hol.tree?{x:+hol.tree.x.toFixed(2),z:+hol.tree.z.toFixed(2)}:null,pic:holPic?{x:+holPic.x.toFixed(2),z:+holPic.z.toFixed(2)}:null,hats:people.map(function(p){return [p.santa.visible,p.pomelo.visible];}),moon:moonDisc?[moonDisc.visible,moonDisc.scale.x]:null}:null;},env:function(){return envS&&envS.visible?{on:true,id:envS.userData.id,y:+envS.position.y.toFixed(2)}:{on:false};},hold:function(v){holdAI=!!v;},flashTrees:flashTrees,
    // 卡片上換到別棵的時候，3D 裡也標出現在是哪一棵
    mark:function(kind,id){var t=null;if(kind==='plant'){var p=plots.filter(function(q){return q.on&&q.id===id;})[0];if(p)t={kind:'plot',p:p};}else if(trees[id])t={kind:'tree',id:id};if(t){setHL(t,true);hl.hold=1.6;}},
    // 測試用：螢幕上這一點會點到什麼
    labelScreen:function(i){var p=plots[i];if(!p)return null;var up=new T.Vector3().setFromMatrixColumn(cam.matrixWorld,1);return toScreen(p.lab.position.clone().addScaledVector(up,p.lab.scale.y*.68),R.domElement.getBoundingClientRect());},
    plantScreen:function(i){var p=plots[i];if(!p||!p.id)return null;return toScreen(new T.Vector3(p.x,Math.max(.25,p.top*.55),p.z),R.domElement.getBoundingClientRect());},
    targetAt:function(x,y){var t=targetAt(x,y);return t?{kind:t.kind,id:t.id||(t.p&&(t.p.id||t.p.k))||t.k||null,slot:t.p&&t.p.i!=null?t.p.i:null}:null;},hl:function(){return {on:!!(hl.ring&&hl.ring.visible),key:hl.key};},party:function(){return party?{n:party.objs.length,cake:!!party.cake,hats:people.map(function(p){return p.hat.visible;})}:null;},firework:function(){firework();},decors:function(){return Object.keys(decors).map(function(id){var d=decors[id];return {id:id,k:d.k,x:d.x,z:d.z,flag:d.parts.flag?+d.parts.flag.rotation.z.toFixed(2):null};});},weather:function(){return {w:wx.w,s:wx.s,precip:precip?precip.N:0,drift:drift?drift.N:0,umb:people.map(function(p){return p.umb.visible;})};},setWeather:function(w,s){wx.w='';setWeather(w,s);},frames:function(){return drawn;},quality:function(t){if(t==null)return {tier:qTier,lock:qLock};qLock=t;setQuality(t);return qTier;},
    stats:function(){var n=0,m=0;scene.traverse(function(o){if(o.isMesh||o.isSprite||o.isPoints){n++;if(o.visible)m++;}});return {calls:R.info.render.calls,tris:R.info.render.triangles,objects:n,programs:R.info.programs?R.info.programs.length:0,geos:R.info.memory.geometries};},
    walkers:function(){return people.map(function(p){return {k:p.k,land:p.land?p.land.id:'',st:p.state,a:p.ang,r:p.r,far:far(p.ang,p.r),via:(p.via||[]).length,y:p.g.position.y};}).concat(pets.map(function(p){return {k:p.k,st:p.wait>0?'wait':'walk',a:p.ang,r:p.r,far:far(p.ang,p.r),via:(p.via||[]).length,y:p.spr.position.y-(p.hop>0?Math.sin((1-p.hop/.5)*Math.PI)*.5:0)};}));},
    wet:function(x,z){var d=1e9;for(var j=0;j<flow.length-1;j++)d=Math.min(d,segDist(x,z,flow[j],flow[j+1]));var onB=bridges.some(function(B){return Math.abs((x-B.x)*B.uz-(z-B.z)*B.ux)<.5&&Math.abs((x-B.x)*B.ux+(z-B.z)*B.uz)<.8*B.s;});return {d:d,bridge:onB};},
    bridge:function(){return bridges.map(function(b){return {x:b.x,z:b.z};});},
    goTo:function(k,a,r){var p=people.filter(function(o){return o.k===k;})[0]||pets.filter(function(o){return o.k===k;})[0];if(!p)return false;p.via=[];p.ta=a;p.tr=r;if(p.spr){p.wait=0;}else{p.with=null;p.toTree=false;p.state='walk';}return far(p.ang,p.r)!==far(a,r);},
    lands:function(){return LAND_IDS.map(function(id){var L=LAND_GEO[id];return {id:id,open:L.open,c:L.c,R:L.R,spots:L.spots.length,plots:PLOT.slice(L.p0,L.p0+3)};});},init:init,update:update,water:water,shoo:shoo,hop:hop,active:function(){return !!T&&running;},screen:screen,
    fxCount:function(){return fx.length;},visitors:function(){return visitors.map(function(v){return v.kind+':'+v.state;});},
    spawn:function(k){var v=makeVisitor(k);return visitors.indexOf(v);},goPic:function(k){var p=people.filter(function(o){return o.k===k;})[0];if(!p||p.land||TREE_STATES[p.state]||p.toTree)return false;if(p.state==='act'||p.goAct)endAct(p);return goPic(p);},people:function(){return people.map(function(p){return p.k+':'+p.state+(p.with?'>'+(p.with.k||'?'):'')+(p.land?'@'+p.land.id:'')+(p.A?'#'+p.A.k+'.'+p.A.step:p.goAct?'~'+p.goAct.k:'')+(p.goPic?'~pic':'');});},
    phase:function(){return phase;},setPhase:function(ph){setPhase(ph);},act:function(k){return callAct(k);},
    acts:function(){var TS=ACTS.tswing;return {tswing:TS.occ.map(function(o){return o&&o.k;}),tphi:+TS.phi.toFixed(2),tamp:+TS.amp.toFixed(2),tpush:people.map(function(p){return p.A&&p.A.k==='tswing'&&p.A.i===1?+(p.A.push||0).toFixed(2):null;}),cafe:ACTS.cafe.occ.map(function(o){return o&&o.k;}),cafeSt:people.map(function(p){var A=p.A;return A&&A.k==='cafe'&&A.step==='use'?(A.sip>0?'sip':A.bite>0?(p.feed?'feed':'bite'):'sit'):'';}),gazebo:ACTS.gazebo.visible,slideShown:ACTS.slideG.visible,slide:ACTS.slide.occ&&ACTS.slide.occ.k,swing:ACTS.swing.occ.map(function(o){return o&&o.k;}),phi:ACTS.swing.phi.map(function(v){return +v.toFixed(2);}),bench:ACTS.bench.occ.map(function(o){return o&&o.k;}),fire:ACTS.fire.occ.map(function(o){return o&&o.k;}),light:+fireLight.intensity.toFixed(2),marsh:people.map(function(p){return p.marsh?'#'+p.marsh.material.color.getHexString():'';})};},
    area:function(){return {c:AWp(0,.2),rot:AREA_ROT};},
    goLand:function(k,id){var p=people.filter(function(o){return o.k===k;})[0],L=LAND_GEO[id];if(!p||!L||!L.open||TREE_STATES[p.state]||p.toTree)return false;if(p.land)leaveLand(p);else goLand(p,L);return true;},
    look:function(a,e2,r2,tx,ty,tz){az=a;el=e2;agoal=egoal=null;if(r2){rad=r2;rgoal=0;}if(tx!=null){tgt.set(tx,ty,tz);tgoal.copy(tgt);}idleAt=Date.now()+1e9;},
    toTree:function(k){var p=people.filter(function(o){return o.k===k;})[0],i=treeHome.occ.indexOf(null);if(p&&i>=0&&!TREE_STATES[p.state]&&!p.toTree&&!p.land){p.timer=0;goTree(p,i);}},tree:function(){return {c:treeHome.c,rot:TH_ROT,entry:treeHome.entry,occ:treeHome.occ.map(function(o){return o&&o.k;}),pp:people.map(function(p){return [p.k,p.state,+p.ang.toFixed(2),+p.r.toFixed(2),+p.ta.toFixed(2),+p.tr.toFixed(2),!!p.toTree];})};}};
})();


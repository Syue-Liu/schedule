/* Generate menu previews from garden3d.js's actual decorModel().
 * Requires Node.js, Playwright, Python 3 and Chromium; run from any directory:
 * node scripts/generate-garden-decor-previews.cjs
 * Set CHROME_BIN when Chromium is not at /usr/bin/chromium.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'assets/games/garden/decor');
const port = 18791;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const injected = `
    // Preview generation uses the exact model factory used for placed decorations.
    renderDecorPreviews:function(keys){
      var renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
      renderer.setPixelRatio(1);renderer.setSize(192,192);renderer.setClearColor(0,0);
      renderer.outputColorSpace=T.SRGBColorSpace;var results={};
      keys.forEach(function(k){
        var previewScene=new T.Scene(),model=decorModel(k),parts=model.userData.parts;
        if(parts.flag)parts.flag.rotation.z=-Math.PI/2;
        if(parts.jet)parts.jet.children.forEach(function(m,i){var t=i/10,a=i*2.4;m.position.set(Math.cos(a)*.22*t,1+Math.sin(t*Math.PI)*.5,Math.sin(a)*.22*t);m.scale.setScalar(1-t*.5);});
        previewScene.add(model);previewScene.add(new T.AmbientLight('#FFFFFF',1.15));
        var sun=new T.DirectionalLight('#FFF7EA',1.55);sun.position.set(4,7,5);previewScene.add(sun);
        model.updateMatrixWorld(true);var box=new T.Box3().setFromObject(model),center=box.getCenter(new T.Vector3());
        var camera=new T.OrthographicCamera(-1,1,1,-1,.01,100),direction=new T.Vector3(3.2,2.5,5).normalize();
        camera.position.copy(center).addScaledVector(direction,10);camera.lookAt(center);camera.updateMatrixWorld(true);
        var right=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new T.Vector3().setFromMatrixColumn(camera.matrixWorld,1),extent=0;
        [box.min.x,box.max.x].forEach(function(x){[box.min.y,box.max.y].forEach(function(y){[box.min.z,box.max.z].forEach(function(z){var v=new T.Vector3(x,y,z).sub(center);extent=Math.max(extent,Math.abs(v.dot(right)),Math.abs(v.dot(up)));});});});
        extent=Math.max(.15,extent)*1.18;camera.left=camera.bottom=-extent;camera.right=camera.top=extent;camera.updateProjectionMatrix();
        renderer.render(previewScene,camera);results[k]=renderer.domElement.toDataURL('image/png');
      });renderer.dispose();return results;
    },
`;
(async () => {
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); setTimeout(resolve, 700); });
    browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true });
    await page.route('**/garden3d.js?*', async route => {
      const source = fs.readFileSync(path.join(root, 'games/garden3d.js'), 'utf8');
      const marker = '  return {plantLabels:function(on){';
      if (!source.includes(marker)) throw new Error('Could not find Garden3D preview insertion point');
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: source.replace(marker, '  return {' + injected + 'plantLabels:function(on){') });
    });
    await page.addInitScript(() => { localStorage.setItem('catMe', 'syue'); localStorage.setItem('gardenHelp', '1'); localStorage.setItem('gardenNewSp', '1'); });
    await page.goto(`http://127.0.0.1:${port}/games/garden.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.g3 === true, null, { timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate(() => Garden3D.renderDecorPreviews(Object.keys(DECOR)));
    fs.mkdirSync(out, { recursive: true });
    for (const [key, data] of Object.entries(result)) fs.writeFileSync(path.join(out, key + '.png'), Buffer.from(data.split(',')[1], 'base64'));
    console.log(`Created ${Object.keys(result).length} decor previews in ${out}`);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

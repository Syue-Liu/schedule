/* Browser smoke test for the standalone character prototype.
 * node scripts/test-garden-characters.cjs
 * Requires Playwright, Chromium and Python 3; never loads garden.html or data.
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const port = 18795;
const url = `http://127.0.0.1:${port}/games/characters.html`;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
const errors = [];
const choose = (page, group, value) => page.locator(`[data-group="${group}"] [data-value="${value}"]`).click();
let browser;
async function bonePosition(page, key, bone) {
  return page.evaluate(({ key, bone }) => {
    const c = characterPreview.characters.find(c => c.key === key), v = c.root.position.clone();
    c.bones[bone].getWorldPosition(v); return v.toArray();
  }, { key, bone });
}
(async () => {
  await new Promise((resolve, reject) => { server.once('error', reject); setTimeout(resolve, 500); });
  browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/chromium', headless: true,
    args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.waitForFunction(() => window.characterPreview?.state.loaded, null, { timeout: 60000 });
  assert.equal(await page.locator('#loading').isVisible(), false);
  assert.equal(await page.evaluate(() => characterPreview.characters.length), 2);
  assert.equal(await page.evaluate(() => localStorage.length), 0);
  const info = await page.evaluate(() => ({ calls: characterPreview.renderer.info.render.calls, triangles: characterPreview.renderer.info.render.triangles }));
  assert(info.calls < 80, `Idle view has too many draws: ${JSON.stringify(info)}`);
  assert(info.triangles < 130000, 'Unexpected geometry growth');
  const initial = await page.evaluate(() => characterPreview.camera.position.toArray());
  const box = await page.locator('#viewport').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 12 }); await page.mouse.up();
  await page.waitForTimeout(300);
  assert.notDeepEqual(await page.evaluate(() => characterPreview.camera.position.toArray()), initial, 'Drag should rotate the camera');
  await page.locator('#reset').click();
  await page.waitForTimeout(800);
  for (const key of ['ling', 'syue', 'both']) {
    await choose(page, 'character', key);
    const visible = await page.evaluate(() => characterPreview.characters.filter(c => c.root.visible).map(c => c.key));
    assert.deepEqual(visible, key === 'both' ? ['syue', 'ling'] : [key]);
  }
  await choose(page, 'view', 'back'); await page.waitForFunction(() => characterPreview.camera.position.z < 0, null, { timeout: 10000 });
  assert(await page.evaluate(() => characterPreview.camera.position.z < 0));
  await choose(page, 'view', 'face'); await page.waitForFunction(() => characterPreview.controls.target.y > 2.3, null, { timeout: 10000 });
  assert(await page.evaluate(() => characterPreview.controls.target.y > 2));
  await choose(page, 'view', 'front'); await page.waitForTimeout(850);
  const restHand = await bonePosition(page, 'syue', 'hand_L');
  await choose(page, 'action', 'wave'); await page.waitForTimeout(600);
  const waveHand = await bonePosition(page, 'syue', 'hand_L');
  assert(waveHand[1] > restHand[1] + .4, 'Wave should lift the hand');
  const lingHand = await bonePosition(page, 'ling', 'hand_R');
  assert(lingHand[0] > .9, 'Ling should wave outward, clear of Syue');
  await choose(page, 'action', 'water'); await page.waitForTimeout(600);
  assert(await page.evaluate(() => characterPreview.characters.every(c => c.can.object.visible)));
  const waterHand = await bonePosition(page, 'syue', 'hand_R');
  assert(waterHand[2] > .25, 'Watering should lift the hand forward');
  await choose(page, 'action', 'walk'); await page.waitForTimeout(400);
  const moving = await page.evaluate(() => characterPreview.characters[0].bones.thigh_L.quaternion.toArray());
  await page.waitForFunction(before => characterPreview.characters[0].bones.thigh_L.quaternion.toArray().some((v, i) => v !== before[i]), moving, { timeout: 15000 });
  assert.notDeepEqual(await page.evaluate(() => characterPreview.characters[0].bones.thigh_L.quaternion.toArray()), moving);
  await page.locator('#pause').click();
  await page.waitForTimeout(150);
  const paused = await page.evaluate(() => characterPreview.characters[0].bones.thigh_L.quaternion.toArray());
  const pausedFrame = await page.evaluate(() => characterPreview.renderer.info.render.frame);
  await page.waitForFunction(frame => characterPreview.renderer.info.render.frame > frame + 1, pausedFrame, { timeout: 15000 });
  assert.deepEqual(await page.evaluate(() => characterPreview.characters[0].bones.thigh_L.quaternion.toArray()), paused);
  await choose(page, 'background', 'studio');
  assert.equal(await page.locator('[data-value="studio"]').getAttribute('aria-pressed'), 'true');
  await choose(page, 'action', 'idle');
  await choose(page, 'background', 'garden');
  const downloadEvent = page.waitForEvent('download'); await page.locator('#snapshot').click();
  const download = await downloadEvent, downloaded = fs.readFileSync(await download.path());
  assert.equal(downloaded.subarray(1, 4).toString(), 'PNG'); assert(downloaded.length > 15000);
  console.log('Desktop controls, bone poses and PNG download passed.');
  await page.screenshot({ path: '/tmp/garden-characters-desktop.png', fullPage: true });
  for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(size); await page.waitForTimeout(250);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${size.width}`);
    await choose(page, 'character', 'ling'); await choose(page, 'view', 'face'); await page.waitForTimeout(800);
    const clipped = await page.evaluate(() => {
      const p = characterPreview, v = p.controls.target.clone().set(0, 3.10 * .96, 0).project(p.camera);
      return Math.abs(v.y) > 1;
    });
    assert(!clipped, 'Close view should include the hat');
    await choose(page, 'character', 'both'); await choose(page, 'view', 'front');
    await page.waitForTimeout(800);
    await page.locator('#viewport').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/garden-characters-${size.width}.png`, fullPage: true });
    console.log(`Layout passed: ${size.width} x ${size.height}`);
  }
  const mobile = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const phone = await mobile.newPage(); phone.on('pageerror', e => errors.push(e.message));
  await phone.goto(url); await phone.waitForFunction(() => window.characterPreview?.state.loaded, null, { timeout: 60000 });
  assert(await phone.evaluate(() => characterPreview.state.paused), 'Reduced motion should start paused');
  const cdp = await mobile.newCDPSession(phone), vbox = await phone.locator('#viewport').boundingBox();
  const cx = vbox.x + vbox.width / 2, cy = vbox.y + vbox.height / 2;
  const beforePinch = await phone.evaluate(() => characterPreview.camera.position.distanceTo(characterPreview.controls.target));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 30, y: cy, id: 1 }, { x: cx + 30, y: cy, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 70, y: cy, id: 1 }, { x: cx + 70, y: cy, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert(await phone.evaluate(before => characterPreview.camera.position.distanceTo(characterPreview.controls.target) < before, beforePinch), 'Pinch should zoom in');
  await mobile.close();
  const failure = await context.newPage();
  await failure.route('**/garden-characters.glb?*', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await failure.goto(url); await failure.locator('#load-error').waitFor({ state: 'visible', timeout: 60000 });
  assert(await failure.locator('#retry').isVisible());
  assert.equal(await failure.locator('#loading').isVisible(), false);
  await failure.close();
  assert.deepEqual(errors, []);
  console.log('PASS: models, camera drag, character selection, close/back views, wave/water/walk, pause, backgrounds, PNG download, 3 mobile sizes, pinch zoom, reduced motion, failed-load recovery.');
  console.log('Idle rendering budget:', info);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); server.kill(); });

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright-core');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const url = pathToFileURL(path.join(root, 'dist/architecture-dashboard/index.html')).href;

async function checkFrame(page) {
    const canvas = page.locator('#three-container canvas');
    assert.ok(await canvas.isVisible(), 'The dashboard canvas is hidden');
    const clip = { x: 320, y: 240, width: 384, height: 240 };
    const frame = PNG.sync.read(await page.screenshot({ clip }));
    const backdrop = PNG.sync.read(await page.screenshot({
        clip, style: '#three-container canvas { visibility: hidden !important; }'
    }));
    let lit = 0;
    let dark = 0;
    for (let i = 0; i < frame.data.length; i += 4) {
        const brightness = Math.max(frame.data[i], frame.data[i + 1], frame.data[i + 2]);
        const background = Math.max(backdrop.data[i], backdrop.data[i + 1], backdrop.data[i + 2]);
        if (brightness - background > 48) lit++;
        if (brightness < 32) dark++;
    }
    assert.ok(lit > 100 && dark > 100, `Expected crystal edges and shadow, saw ${lit} lit and ${dark} dark pixels`);
    console.log(`PASS rendered crystal frame (${lit} lit pixels)`);
}

async function checkControls(page) {
    const target = () => page.evaluate(() => architecture3D.controls.target.toArray());
    const camera = () => page.evaluate(() => architecture3D.camera.position.toArray());
    const project = id => page.evaluate(serviceId => {
        const { services, camera, renderer } = architecture3D;
        const { x, y } = services[serviceId].position.clone().project(camera);
        const rect = renderer.domElement.getBoundingClientRect();
        return { x: rect.left + (x + 1) * rect.width / 2, y: rect.top + (1 - y) * rect.height / 2 };
    }, id);
    const initialCamera = await camera();
    await page.evaluate(() => {
        const { camera, controls } = architecture3D;
        camera.position.z = controls.maxDistance;
        controls.update();
    });
    await page.clock.runFor(16);
    // At 1024 x 720 this ray hits memory-api behind the far edge of the fog.
    await page.mouse.click(448, 401);
    assert.deepEqual(await target(), [0, 0, 0], 'Clicking a fully fogged crystal changed focus');

    // View dendrite-api from the side. Its ray is longer than 100, but its depth is under 100.
    await page.evaluate(() => {
        const { camera, controls } = architecture3D;
        controls.target.set(0, 0, -55);
        camera.position.set(controls.maxDistance, 0, -55);
        controls.update();
    });
    await page.clock.runFor(16);
    const offAxis = await project('dendrite-api');
    await page.mouse.click(offAxis.x, offAxis.y);
    assert.deepEqual(await target(), [8, -10, 8], 'Off-axis crystal inside the fog limit should be selectable');

    await page.keyboard.press('Home');
    await page.clock.runFor(16);
    const service = await project('dendrite-api');
    await page.mouse.click(service.x, service.y);
    assert.deepEqual(await target(), [8, -10, 8], 'Click should target the visible crystal');
    await page.mouse.click(25, 195);
    assert.deepEqual(await target(), [8, -10, 8], 'Empty space changed focus');

    await page.keyboard.press('Home');
    assert.deepEqual(await target(), [0, 0, 0]);
    await page.clock.runFor(16);
    const point = await project('dendrite-api');
    await page.mouse.move(point.x - 40, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x, point.y, { steps: 4 });
    await page.mouse.up();
    assert.deepEqual(await target(), [0, 0, 0], 'Drag changed focus');
    assert.notDeepEqual(await camera(), initialCamera, 'Drag should rotate the camera');

    await page.keyboard.press('Home');
    await page.mouse.move(512, 360);
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(600, 360, { steps: 4 });
    await page.mouse.up({ button: 'right' });
    assert.notDeepEqual(await target(), [0, 0, 0], 'Right drag should pan the target');
    await page.clock.runFor(16);
    const afterPan = await project('dendrite-api');
    await page.mouse.click(afterPan.x, afterPan.y);
    assert.equal(await page.locator('#focus-name').innerText(), 'dendrite-api');
    assert.deepEqual(await target(), [8, -10, 8], 'Orbit target should match the crystal immediately after the click');
    await page.clock.runFor(64);
    assert.deepEqual(await target(), [8, -10, 8], 'Orbit target drifted after focusing the crystal');

    await page.keyboard.press('Home');
    await page.mouse.move(512, 360);
    await page.mouse.down();
    await page.mouse.move(565, 360, { steps: 3 });
    await page.mouse.move(512, 360, { steps: 3 });
    await page.mouse.up();
    assert.match(await page.locator('#focus-name').innerText(), /all services/i, 'Returning drag selected the central crystal');

    await page.getByRole('button', { name: /previous/i }).click();
    assert.deepEqual(await target(), [8, -10, 8]);
    await page.keyboard.press('[');
    assert.deepEqual(await target(), [-8, -10, 8]);
    await page.getByRole('button', { name: /next/i }).click();
    assert.deepEqual(await target(), [8, -10, 8]);
    await page.keyboard.press(']');
    assert.match(await page.locator('#focus-name').innerText(), /thalamus/i);
    await page.keyboard.press(']');
    const beforeOrbit = await target();
    await page.clock.runFor(48);
    const movingTarget = await target();
    assert.notDeepEqual(movingTarget, beforeOrbit);
    const lia = await page.evaluate(() => architecture3D.services['lia-cli'].position.toArray());
    assert.ok(movingTarget.every((value, i) => Math.abs(value - lia[i]) < 1e-8), 'Focus lost the orbiting service');
    await page.getByRole('button', { name: /reset view/i }).click();
    assert.deepEqual(await target(), [0, 0, 0]);
    assert.deepEqual(await camera(), initialCamera);
    console.log('PASS click, fog depth, pan then focus, drag, empty space, keyboard and HUD controls');
}

async function checkNarrowView(page) {
    await page.evaluate(() => {
        window.smokeResized = false;
        window.addEventListener('resize', () => { window.smokeResized = true; }, { once: true });
    });
    await page.setViewportSize({ width: 360, height: 640 });
    await page.waitForFunction(() => window.smokeResized, null, { timeout: 5000 });
    assert.equal(await page.evaluate(() => architecture3D.camera.aspect), 360 / 640);
    const cropped = await page.evaluate(() => {
        const { services, camera } = architecture3D;
        const point = new THREE.Vector3();
        return Object.values(services).filter(service => {
            const vertices = service.geometry.getAttribute('position');
            for (let i = 0; i < vertices.count; i++) {
                point.fromBufferAttribute(vertices, i).applyMatrix4(service.matrixWorld).project(camera);
                if (Math.abs(point.x) > 1 || Math.abs(point.y) > 1) return true;
            }
            return false;
        }).map(service => service.userData.serviceId);
    });
    assert.deepEqual(cropped, [], 'Narrow overview crops crystals');
    console.log('PASS narrow-screen framing');
}

async function main() {
    execFileSync(process.env.PYTHON || 'python', [path.join(__dirname, 'smoke_terminal.py')], {
        stdio: ['ignore', 'inherit', 'inherit'], timeout: 30000
    });
    const browser = await chromium.launch({
        channel: process.env.SMOKE_BROWSER_CHANNEL || 'chrome',
        args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
    });
    try {
        const page = await browser.newPage({ viewport: { width: 1024, height: 720 }, offline: true });
        page.setDefaultTimeout(10000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        await page.addInitScript(() => {
            document.addEventListener('DOMContentLoaded', () => {
                window.statusBeforeScene = document.getElementById('render-status').textContent;
            });
            let seed = 7;
            Math.random = () => {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                return seed / 4294967296;
            };
        });
        await page.clock.install({ time: new Date('2025-01-01T00:00:00Z') });
        await page.clock.pauseAt(new Date('2025-01-01T00:01:00Z'));
        await page.goto(url);
        const status = page.locator('#render-status');
        assert.match(await page.evaluate(() => window.statusBeforeScene), /starting/i);
        assert.equal(await status.getAttribute('data-state'), 'active', await status.innerText());
        await checkFrame(page);
        await checkControls(page);
        await checkNarrowView(page);
        assert.deepEqual(errors, [], 'Browser reported a render or script error');

        const sceneScript = '**/assets/js/3d-architecture.js';
        await page.route(sceneScript, route => route.abort());
        await page.reload();
        assert.ok(await status.isVisible());
        assert.equal(await status.getAttribute('data-state'), 'failed', await status.innerText());
        assert.match(await status.innerText(), /scene script.*load/i);
        for (const name of [/previous/i, /next/i, /reset view/i]) {
            assert.ok(await page.getByRole('button', { name }).isDisabled(), `Expected disabled control matching ${name}`);
        }
        console.log('PASS visible scene script load failure with controls disabled');
        await page.unroute(sceneScript);

        await page.addInitScript(() => {
            const getContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                return type.includes('webgl') ? null : getContext.call(this, type, ...args);
            };
        });
        await page.reload();
        assert.ok(await status.isVisible());
        assert.match(await status.innerText(), /failed.*WebGL/i);
        assert.ok(await page.getByRole('button', { name: /next/i }).isDisabled());
        console.log('PASS visible WebGL startup failure');
    } finally {
        await browser.close();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

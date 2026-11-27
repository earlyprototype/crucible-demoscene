const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const dashboard = path.join(__dirname, '..');

test('the scene hint and README describe the available camera controls', () => {
    for (const file of ['index.html', 'README.md']) {
        const text = readFileSync(path.join(dashboard, file), 'utf8');
        assert.match(text, /drag to rotate/i);
        assert.match(text, /scroll to zoom/i);
        assert.doesNotMatch(text, /click to focus/i);
    }
});

test('the memory crystal breathes and keeps its translucency without a status feed', () => {
    const script = readFileSync(path.join(dashboard, 'assets/js/3d-architecture.js'), 'utf8');
    const context = vm.createContext({ document: new EventTarget(), requestAnimationFrame() {} });
    const Architecture3D = vm.runInContext(script + '\nArchitecture3D', context);
    const scene = Object.create(Architecture3D.prototype);
    const edgeMesh = { scale: { setScalar(value) { this.value = value; } }, material: { opacity: 0.9 } };
    const innerMesh = { scale: { setScalar() {} }, material: { opacity: 0.3 } };
    const memory = {
        position: {},
        userData: {
            serviceId: 'memory-api',
            basePosition: { x: -8, y: -10, z: -8 },
            scale: 1,
            breathingPhase: Math.PI / 2,
            edgeMesh,
            innerMesh
        }
    };
    scene.services = { 'memory-api': memory };
    scene.time = 0;
    scene.dataTriangles = [];
    scene.controls = { update() {} };
    scene.renderer = { render() {} };

    scene.animate();
    assert.ok(edgeMesh.scale.value > 1);
    assert.equal(edgeMesh.material.opacity, 0.9);
    assert.equal(innerMesh.material.opacity, 0.3);
});

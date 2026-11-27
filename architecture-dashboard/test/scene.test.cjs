const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const dashboard = path.join(__dirname, '..');
const script = readFileSync(path.join(dashboard, 'assets/js/3d-architecture.js'), 'utf8');

function dashboardFixture(globals = {}) {
    const elements = new Map();
    const document = new EventTarget();
    document.getElementById = (id) => {
        if (!elements.has(id)) elements.set(id, { dataset: {}, textContent: '' });
        return elements.get(id);
    };
    const context = vm.createContext({ document, window: { innerWidth: 800, innerHeight: 600 }, ...globals });
    const Architecture3D = vm.runInContext(script + '\nArchitecture3D', context);
    return { document, Architecture3D };
}

test('the scene hint and README describe the available camera controls', () => {
    for (const file of ['index.html', 'README.md']) {
        const text = readFileSync(path.join(dashboard, file), 'utf8');
        assert.match(text, /drag to rotate/i);
        assert.match(text, /scroll to zoom/i);
        assert.match(text, /click to focus/i);
    }
});

test('only the visible span of a wire is pickable and the nearer surface wins', () => {
    const THREE = require('three');
    const { Architecture3D } = dashboardFixture({ THREE });
    const scene = Object.create(Architecture3D.prototype);
    const bounds = { width: 800, height: 600 };
    scene.camera = new THREE.PerspectiveCamera(90, bounds.width / bounds.height, 1, 20);
    scene.scene = { fog: new THREE.Fog(0, 5, 10) };
    const wire = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(1, 0, -15), new THREE.Vector3(1, 0, 1)
    ]));
    scene.pickableParts = [wire];
    const pick = (x, y) => scene.pickPart(new THREE.Vector2(
        2 * x / bounds.width - 1, 1 - 2 * y / bounds.height
    ), bounds);

    // At x = 1 in camera space, the near and fog planes project to pixels 700 and 430.
    assert.equal(pick(740, 300), null, 'Wire in front of the near plane');
    assert.equal(pick(420, 300), null, 'Wire beyond the fog limit');
    assert.equal(pick(500, 301), wire, 'Visible wire within one CSS pixel');
    assert.equal(pick(500, 304), null, 'Empty space beside the wire');

    const face = new THREE.Mesh(new THREE.PlaneGeometry(8, 8));
    face.position.z = -4;
    face.updateMatrixWorld();
    scene.pickableParts.push(face);
    assert.equal(pick(500, 300), wire, 'Wire at depth 3 is in front of the face');
    assert.equal(pick(450, 300), face, 'Wire at depth 6 is behind the face');
});

for (const [name, libraries, explanation] of [
    ['missing Three.js', {}, /Three\.js/],
    ['missing OrbitControls', { THREE: {} }, /OrbitControls/],
    ['unavailable WebGL', {
        THREE: {
            ...require('three'),
            OrbitControls: class {},
            WebGLRenderer: class { constructor() { throw new Error('WebGL context unavailable'); } }
        }
    }, /WebGL context unavailable/]
]) {
    test(`${name} shows a failed status and the cause`, () => {
        const { document } = dashboardFixture(libraries);
        document.dispatchEvent(new Event('DOMContentLoaded'));

        assert.match(document.getElementById('render-status').textContent, /failed/i);
        assert.match(document.getElementById('render-status').textContent, explanation);
    });
}

test('status turns active after a frame and the render loop stops on failure', () => {
    const frames = [];
    const { Architecture3D, document } = dashboardFixture({ requestAnimationFrame: fn => frames.push(fn) });
    const scene = Object.create(Architecture3D.prototype);
    const status = document.getElementById('render-status');
    status.textContent = 'Starting';
    scene.services = {};
    scene.dataTriangles = [];
    scene.controls = { update() {} };
    scene.renderer = {
        render() { assert.equal(status.textContent, 'Starting'); },
        getContext() { return { isContextLost: () => false }; },
        info: { programs: [], render: { calls: 1 } }
    };
    scene.animate();
    assert.match(status.textContent, /active/i);
    scene.renderer.render = () => { throw new Error('frame interrupted'); };
    frames.shift()();
    assert.match(status.textContent, /failed.*frame interrupted/i);
    assert.equal(frames.length, 0);
});

test('the memory crystal breathes and keeps its translucency without a status feed', () => {
    const { Architecture3D } = dashboardFixture();
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
    scene.updateScene();
    assert.ok(edgeMesh.scale.value > 1);
    assert.equal(edgeMesh.material.opacity, 0.9);
    assert.equal(innerMesh.material.opacity, 0.3);
});

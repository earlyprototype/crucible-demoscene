// 3D Architecture Visualization for Project Crucible v0.7
// Advanced Three.js implementation with monochromatic design and breathing effects

class Architecture3D {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.services = {};
        this.pickableParts = [];
        this.focusedService = null;
        this.lastFocusPosition = new THREE.Vector3();
        this.focusOffset = new THREE.Vector3();
        this.dataTriangles = [];
        this.isInitialized = false;
        this.failed = false;
        this.time = 0;
        
        // Service positions in 3D space - Thalamus centered, others positioned around it
        this.servicePositions = {
            'thalamus-gateway': { x: 0, y: 0, z: 0 }, // Centered, will be 100% larger
            'lia-cli': { x: -24, y: 11, z: 0 }, // Above and to the left of Thalamus - moved higher and further away
            'context-engine': { x: 8, y: 10, z: 0 }, // Above and to the right of Thalamus - reduced separation
            'memory-api': { x: -8, y: -10, z: -8 }, // Below Thalamus, square corner - top left
            'cortex-api': { x: 8, y: -10, z: -8 }, // Below Thalamus, square corner - top right
            'axon-api': { x: -8, y: -10, z: 8 }, // Below Thalamus, square corner - bottom left
            'dendrite-api': { x: 8, y: -10, z: 8 } // Below Thalamus, square corner - bottom right
        };
        
        this.init();
    }
    
    init() {
        this.setupScene();
        this.setupCamera();
        this.setupRenderer();
        this.setupControls();
        this.setupLighting();
        this.createServiceModels();
        this.createDataTriangles();
        this.animate();
    }
    
    setupScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011);
        
        // Add atmospheric fog
        this.scene.fog = new THREE.Fog(0x000011, 30, 100);
    }
    
    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
        this.updateCameraProjection();
        this.camera.position.set(0, 0, 35);
    }

    updateCameraProjection() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        // Keep a 60-degree field of view along the shorter screen dimension.
        const halfHeight = Math.tan(Math.PI / 6) / Math.min(1, this.camera.aspect);
        this.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfHeight));
        this.camera.updateProjectionMatrix();
    }
    
    setupRenderer() {
        const container = document.getElementById('three-container');
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        container.appendChild(this.renderer.domElement);
        this.renderer.domElement.addEventListener('webglcontextlost', () => {
            this.fail('The WebGL context was lost. Reload to start the renderer again.');
        });
    }
    
    setupControls() {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 15;
        this.controls.maxDistance = 100;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.autoRotate = false; // Stop system rotation
        this.controls.autoRotateSpeed = 0.5;

        this.setupPicking();
        this.setupViewControls();
    }

    setupPicking() {
        const canvas = this.renderer.domElement;
        const raycaster = new THREE.Raycaster();
        raycaster.params.Line.threshold = 0.15;
        let press = null;
        canvas.addEventListener('pointerdown', event => {
            press = null;
            if (!event.isPrimary || event.button !== 0 || !this.isInitialized ||
                event.ctrlKey || event.metaKey || event.shiftKey) return;
            press = { id: event.pointerId, x: event.clientX, y: event.clientY };
            canvas.setPointerCapture(event.pointerId);
        });
        const checkDrag = event => {
            if (press && event.pointerId === press.id &&
                Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4) press = null;
        };
        canvas.addEventListener('pointermove', checkDrag);
        canvas.addEventListener('lostpointercapture', () => { press = null; });
        canvas.addEventListener('pointercancel', () => { press = null; });
        canvas.addEventListener('pointerup', event => {
            checkDrag(event);
            if (!press || press.id !== event.pointerId || !this.isInitialized) return;
            press = null;
            const bounds = canvas.getBoundingClientRect();
            const pointer = new THREE.Vector2(
                (event.clientX - bounds.left) / bounds.width * 2 - 1,
                1 - (event.clientY - bounds.top) / bounds.height * 2
            );
            raycaster.setFromCamera(pointer, this.camera);
            const [hit] = raycaster.intersectObjects(this.pickableParts);
            if (hit) this.focusService(this.services[hit.object.userData.serviceId]);
        });
    }

    setupViewControls() {
        document.getElementById('scene-controls').addEventListener('click', event => {
            const button = event.target.closest('button');
            if (button) this.changeView(button.dataset.action);
        });
        const keys = { '[': 'previous', ']': 'next', Home: 'reset' };
        window.addEventListener('keydown', event => {
            if (!this.isInitialized || event.altKey || event.ctrlKey || event.metaKey ||
                event.target.isContentEditable || event.target.matches?.('input, textarea, select')) return;
            if (Object.hasOwn(keys, event.key)) {
                event.preventDefault();
                this.changeView(keys[event.key]);
            }
        });
    }

    changeView(action) {
        if (action === 'reset') {
            this.focusedService = null;
            // Consume any remaining drag momentum before restoring the saved view.
            this.controls.enableDamping = false;
            this.controls.update();
            this.controls.reset();
            this.controls.enableDamping = true;
            document.getElementById('focus-name').textContent = 'All services';
            return;
        }
        const services = Object.values(this.services);
        const step = action === 'next' ? 1 : -1;
        const index = this.focusedService ? services.indexOf(this.focusedService) : (step > 0 ? -1 : 0);
        this.focusService(services[(index + step + services.length) % services.length]);
    }

    focusService(service) {
        this.focusedService = service;
        this.lastFocusPosition.copy(service.position);
        this.camera.position.add(this.focusOffset.subVectors(service.position, this.controls.target));
        this.controls.target.copy(service.position);
        this.controls.update();
        document.getElementById('focus-name').textContent = service.userData.serviceId;
    }
    
    setupLighting() {
        // Ambient light - monochromatic
        const ambientLight = new THREE.AmbientLight(0x404060, 0.3);
        this.scene.add(ambientLight);
        
        // Main directional light - white
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(20, 20, 15);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 100;
        directionalLight.shadow.camera.left = -30;
        directionalLight.shadow.camera.right = 30;
        directionalLight.shadow.camera.top = 30;
        directionalLight.shadow.camera.bottom = -30;
        this.scene.add(directionalLight);
        
        // Monochromatic point lights for each service
        Object.keys(this.servicePositions).forEach(serviceId => {
            const pos = this.servicePositions[serviceId];
            const pointLight = new THREE.PointLight(0xffffff, 0.4, 20);
            pointLight.position.set(pos.x, pos.y, pos.z + 4);
            this.scene.add(pointLight);
        });
    }
    
    getServiceColor(serviceId) {
        // Very slight hues for bottom modules, white for others
        switch(serviceId) {
            case 'memory-api':
                return 0xf0f0ff; // Very slight blue tint
            case 'cortex-api':
                return 0xf0fff0; // Very slight green tint
            case 'axon-api':
                return 0xfff0ff; // Very slight purple tint
            case 'dendrite-api':
                return 0xfffff0; // Very slight yellow tint
            default:
                return 0xffffff; // Pure white for all others
        }
    }
    
    createServiceModels() {
        Object.keys(this.servicePositions).forEach(serviceId => {
            const pos = this.servicePositions[serviceId];
            const model = this.createAdvancedIceModel(serviceId, pos);
            this.services[serviceId] = model;
            this.scene.add(model);
            for (const part of [model, model.userData.edgeMesh, model.userData.innerMesh]) {
                part.userData.serviceId = serviceId;
                this.pickableParts.push(part);
            }
        });
    }
    
         createAdvancedIceModel(serviceId, position) {
         // Create geometry based on service type
         let geometry;
         if (serviceId === 'thalamus-gateway') {
            // Create smaller cube geometry for Thalamus (Nexus) - reduced by 60%
            geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2); // Reduced from 3 to 1.2 (60% smaller)
         } else if (serviceId === 'memory-api' || serviceId === 'cortex-api' || serviceId === 'axon-api' || serviceId === 'dendrite-api') {
             // Create cube shell geometry for bottom 4 modules
             geometry = this.createCubeShellGeometry(serviceId);
         } else if (serviceId === 'lia-cli') {
             // Create simple letterbox rectangle for LIA_CLI
             // Height: 1x triangle side (1.5), Width: 3x triangle side (4.5), Length: 4x triangle side (6)
             geometry = new THREE.BoxGeometry(6, 1.5, 4.5); // Length (X), Height (Y), Width (Z)
             
             // Set pivot point to center of smallest face (Y-axis face)
             // The smallest face is the Y-axis face (height 1.5)
             // We need to move the geometry so that the center of the Y-axis face is at the origin
             geometry.translate(0, -0.75, 0); // Move down by half the height (1.5/2 = 0.75)
         } else {
             // Create complex crystal geometry for other services (Context Engine)
             geometry = this.createComplexCrystalGeometry();
         }
        
        // Create advanced ice material with monochromatic design
        const material = new THREE.MeshPhongMaterial({
            color: this.getServiceColor(serviceId),
            transparent: true,
            flatShading: true,
            depthWrite: false,
            opacity: (serviceId === 'lia-cli' || serviceId === 'thalamus-gateway') ? 0.3 : 0.2, // Partial transparency for LIA_CLI and Thalamus
            shininess: 200,
            specular: 0x888888,
            emissive: 0xffffff,
            emissiveIntensity: 0.1,
            side: THREE.DoubleSide
        });
        // Add a cool grazing-angle highlight before Phong tone mapping and fog.
        material.onBeforeCompile = shader => {
            shader.fragmentShader = shader.fragmentShader.replace('#include <envmap_fragment>', `
                #include <envmap_fragment>
                float rim = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.0);
                outgoingLight += vec3(0.18, 0.65, 0.82) * rim;
                diffuseColor.a += 0.35 * rim;
            `);
        };
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y, position.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Make Thalamus 100% larger than other modules
        const scale = serviceId === 'thalamus-gateway' ? 2.0 : 
                     (serviceId === 'context-engine') ? 1.2 : 1.0; // 100% larger for Context Engine
        mesh.scale.setScalar(scale);
        
        // Move Thalamus cube towards the base of the pyramids
        if (serviceId === 'thalamus-gateway') {
            mesh.position.y = position.y + 1.0; // Move cube UP towards the base (reduced by 50%)
        }
        
        // Apply rotational variations to bottom 4 modules
        if (serviceId === 'memory-api' || serviceId === 'cortex-api' || serviceId === 'axon-api' || serviceId === 'dendrite-api') {
            const rotationAngles = {
                'memory-api': { x: 0, y: 0, z: 0 },                                    // No rotation - baseline (top face up)
                'cortex-api': { x: Math.PI / 2, y: 0, z: 0 },                         // 90° X - front face up
                'axon-api': { x: 0, y: Math.PI / 2, z: 0 },                           // 90° Y - right face up
                'dendrite-api': { x: Math.PI / 2, y: Math.PI / 2, z: 0 }              // 90° X + 90° Y - back face up
            };
            const rotation = rotationAngles[serviceId];
            mesh.rotation.set(rotation.x, rotation.y, rotation.z);
        }
        
        // Add sophisticated edge wireframe
        let edgeGeometry;
        let baseMesh = null; // Declare baseMesh in proper scope
        if (serviceId === 'thalamus-gateway') {
            // Use original pyramid geometry for Thalamus edge wireframe with transparent base
            const pyramidGeometries = this.createPyramidGeometry(3); // Original pyramid size
            edgeGeometry = pyramidGeometries.sideGeometry; // Only use sides for wireframe
            
            // Create transparent base mesh
            const baseMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0.0, // Fully transparent base
                wireframe: true,
                wireframeLinewidth: 2
            });
            baseMesh = new THREE.Mesh(pyramidGeometries.baseGeometry, baseMaterial);
            baseMesh.position.set(position.x, position.y, position.z);
            baseMesh.scale.setScalar(scale * 1.35); // Match edge mesh scale
            this.scene.add(baseMesh);
        } else {
            edgeGeometry = geometry;
        }
        const edgeMaterial = new THREE.LineBasicMaterial({
            color: 0xd3eef6,
            transparent: true,
            opacity: 0.9
        });
        const edgeMesh = new THREE.LineSegments(new THREE.WireframeGeometry(edgeGeometry), edgeMaterial);
        edgeMesh.position.set(position.x, position.y, position.z);
        
        // Apply same rotation to edge mesh for bottom 4 modules
        if (serviceId === 'memory-api' || serviceId === 'cortex-api' || serviceId === 'axon-api' || serviceId === 'dendrite-api') {
            const rotationAngles = {
                'memory-api': { x: 0, y: 0, z: 0 },
                'cortex-api': { x: Math.PI / 2, y: 0, z: 0 },
                'axon-api': { x: 0, y: Math.PI / 2, z: 0 },
                'dendrite-api': { x: Math.PI / 2, y: Math.PI / 2, z: 0 }
            };
            const rotation = rotationAngles[serviceId];
            edgeMesh.rotation.set(rotation.x, rotation.y, rotation.z);
        }
        
        // Move Thalamus edge mesh to match cube position
        if (serviceId === 'thalamus-gateway') {
            edgeMesh.position.y = position.y + 1.0; // Match cube position (reduced by 50%)
            // Also move the base mesh to match
            if (baseMesh) {
                baseMesh.position.y = position.y + 1.0; // Match cube position
            }
        }
        
        // Make Thalamus edge triangles 35% larger, Context Engine 50% bigger
        let edgeScale;
        if (serviceId === 'thalamus-gateway') {
            edgeScale = scale * 1.35; // 35% larger edge triangles
        } else if (serviceId === 'context-engine') {
            edgeScale = scale * 1.5; // 50% bigger for Context Engine
        } else {
            edgeScale = scale;
        }
        edgeMesh.scale.setScalar(edgeScale);
        this.scene.add(edgeMesh);
        
                 // Add inner crystal structure with glimmering colors for Thalamus
         let innerGeometry;
         if (serviceId === 'thalamus-gateway') {
             // Create pyramid inner geometry for Thalamus - another 50% bigger
             const pyramidGeometries = this.createPyramidGeometry(1.35); // Increased from 0.9 to 1.35 (another 50% bigger)
             innerGeometry = pyramidGeometries.sideGeometry; // Use sides for inner mesh
         } else if (serviceId === 'memory-api' || serviceId === 'cortex-api' || serviceId === 'axon-api' || serviceId === 'dendrite-api') {
             // Create cube inner geometry for bottom 4 modules
             innerGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
         } else if (serviceId === 'lia-cli') {
             // Create smaller inner rectangle for LIA_CLI letterbox
             innerGeometry = new THREE.BoxGeometry(3, 0.75, 2.25); // Half the size of the outer rectangle
             
             // Set pivot point to center of smallest face (Y-axis face) - same as outer mesh
             innerGeometry.translate(0, -0.375, 0); // Move down by half the height (0.75/2 = 0.375)
         } else {
             innerGeometry = new THREE.IcosahedronGeometry(0.6, 1);
         }
        
        const innerMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: serviceId === 'thalamus-gateway' ? 1.0 : 0.3
        });
        const innerMesh = new THREE.LineSegments(new THREE.WireframeGeometry(innerGeometry), innerMaterial);
        innerMesh.position.set(position.x, position.y, position.z);
        innerMesh.scale.setScalar(scale);
        
        // Apply same rotation to inner mesh for bottom 4 modules
        if (serviceId === 'memory-api' || serviceId === 'cortex-api' || serviceId === 'axon-api' || serviceId === 'dendrite-api') {
            const rotationAngles = {
                'memory-api': { x: 0, y: 0, z: 0 },
                'cortex-api': { x: Math.PI / 2, y: 0, z: 0 },
                'axon-api': { x: 0, y: Math.PI / 2, z: 0 },
                'dendrite-api': { x: Math.PI / 2, y: Math.PI / 2, z: 0 }
            };
            const rotation = rotationAngles[serviceId];
            innerMesh.rotation.set(rotation.x, rotation.y, rotation.z);
        }
        
        // Move Thalamus inner mesh to match cube position
        if (serviceId === 'thalamus-gateway') {
            innerMesh.position.y = position.y + 1.0; // Match cube position (reduced by 50%)
        }
        
        this.scene.add(innerMesh);
        
        // Store animation data
        mesh.userData = {
            serviceId: serviceId,
            rotationSpeed: serviceId === 'thalamus-gateway' ? 0.02 : 0.003, // Faster rotation for Thalamus
            pulseSpeed: 0.003,
            breathingPhase: Math.random() * Math.PI * 2,
            shapeShiftPhase: Math.random() * Math.PI * 2,
            glimmerPhase: Math.random() * Math.PI * 2,
            basePosition: { ...position },
            scale: scale,
            isOrbiting: serviceId === 'lia-cli' || serviceId === 'context-engine', // LIA_CLI and Context Engine orbit
            orbitRadius: 8.0, // Increased orbit radius for more separation
            orbitSpeed: 0.2,
            orbitPhase: serviceId === 'lia-cli' ? 0 : Math.PI, // Opposite phases for orbiting
            edgeMesh: edgeMesh,
            innerMesh: innerMesh,
            label: null // No labels
        };
        
        return mesh;
    }
    
         createComplexCrystalGeometry() {
         // Create a more complex crystal geometry
         const geometry = new THREE.IcosahedronGeometry(1.5, 2);
         
         // Add more sophisticated randomization
         const vertices = geometry.attributes.position;
         for (let i = 0; i < vertices.count; i++) {
             const x = vertices.getX(i);
             const y = vertices.getY(i);
             const z = vertices.getZ(i);
             
             // Create more organic crystal-like variations
             const noise = Math.sin(i * 0.1) * Math.cos(i * 0.15) * 0.3;
             vertices.setX(i, x + (Math.random() - 0.5) * 0.3 + noise * 0.1);
             vertices.setY(i, y + (Math.random() - 0.5) * 0.3 + noise * 0.1);
             vertices.setZ(i, z + (Math.random() - 0.5) * 0.3 + noise * 0.1);
         }
         
         return geometry;
     }
     
           createCubeShellGeometry(serviceId) {
          // Create a cube shell geometry with triangular faces
          const geometry = new THREE.BoxGeometry(3, 3, 3);
          
          // Add triangular subdivisions to create more complex surface
          const vertices = geometry.attributes.position;
          const newVertices = [];
          const newIndices = [];
          
          // Subdivide each face into smaller triangles
          for (let i = 0; i < vertices.count; i += 3) {
              const x1 = vertices.getX(i);
              const y1 = vertices.getY(i);
              const z1 = vertices.getZ(i);
              const x2 = vertices.getX(i + 1);
              const y2 = vertices.getY(i + 1);
              const z2 = vertices.getZ(i + 1);
              const x3 = vertices.getX(i + 2);
              const y3 = vertices.getY(i + 2);
              const z3 = vertices.getZ(i + 2);
              
              // Simple 2x2 subdivision for consistent triangle density
              const subdivisions = 2;
              for (let j = 0; j < subdivisions; j++) {
                  for (let k = 0; k < subdivisions; k++) {
                      const t1 = j / subdivisions;
                      const t2 = (j + 1) / subdivisions;
                      const s1 = k / subdivisions;
                      const s2 = (k + 1) / subdivisions;
                      
                      // Calculate base positions (no variations yet)
                      const v1x = x1 + (x2 - x1) * t1 + (x3 - x1) * s1;
                      const v1y = y1 + (y2 - y1) * t1 + (y3 - y1) * s1;
                      const v1z = z1 + (z2 - z1) * t1 + (z3 - z1) * s1;
                      
                      const v2x = x1 + (x2 - x1) * t2 + (x3 - x1) * s1;
                      const v2y = y1 + (y2 - y1) * t2 + (y3 - y1) * s1;
                      const v2z = z1 + (z2 - z1) * t2 + (z3 - z1) * s1;
                      
                      const v3x = x1 + (x2 - x1) * t1 + (x3 - x1) * s2;
                      const v3y = y1 + (y2 - y1) * t1 + (y3 - y1) * s2;
                      const v3z = z1 + (z2 - z1) * t1 + (z3 - z1) * s2;
                      
                      // Add triangular subdivisions
                      newVertices.push(
                          v1x, v1y, v1z,
                          v2x, v2y, v2z,
                          v3x, v3y, v3z
                      );
                      
                      const baseIndex = newVertices.length / 3 - 3;
                      newIndices.push(baseIndex, baseIndex + 1, baseIndex + 2);
                  }
              }
          }
          
          const newGeometry = new THREE.BufferGeometry();
          newGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newVertices), 3));
          newGeometry.setIndex(new THREE.BufferAttribute(new Uint16Array(newIndices), 1));
          newGeometry.computeVertexNormals();
          
          return newGeometry;
      }
     
     getVariationSeed(serviceId) {
         // Create unique seed based on service ID
         const seeds = {
             'memory-api': 0.314159,
             'cortex-api': 0.271828,
             'axon-api': 0.577215,
             'dendrite-api': 0.618034
         };
         return seeds[serviceId] || 0.5;
     }
     
           getSubdivisionPattern(serviceId) {
          // All services use 2x2 subdivision for consistent triangle density
          return 2;
      }
     
           applyGeometricVariation(x1, y1, z1, x2, y2, z2, x3, y3, z3, t1, t2, s1, s2, seed, faceIndex) {
          // Apply unique vertex displacement patterns for each service
          const serviceId = this.getServiceIdFromSeed(seed);
          const displacementPattern = this.getDisplacementPattern(serviceId);
          
          // Calculate base positions
          let v1x = x1 + (x2 - x1) * t1 + (x3 - x1) * s1;
          let v1y = y1 + (y2 - y1) * t1 + (y3 - y1) * s1;
          let v1z = z1 + (z2 - z1) * t1 + (z3 - z1) * s1;
          
          let v2x = x1 + (x2 - x1) * t2 + (x3 - x1) * s1;
          let v2y = y1 + (y2 - y1) * t2 + (y3 - y1) * s1;
          let v2z = z1 + (z2 - z1) * t2 + (z3 - z1) * s1;
          
          let v3x = x1 + (x2 - x1) * t1 + (x3 - x1) * s2;
          let v3y = y1 + (y2 - y1) * t1 + (y3 - y1) * s2;
          let v3z = z1 + (z2 - z1) * t1 + (z3 - z1) * s2;
          
          // Apply unique displacement patterns
          const displacement = this.applyDisplacementPattern(v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z, 
                                                           displacementPattern, seed, faceIndex);
          
          return {
              x1: displacement.v1x, y1: displacement.v1y, z1: displacement.v1z,
              x2: displacement.v2x, y2: displacement.v2y, z2: displacement.v2z,
              x3: displacement.v3x, y3: displacement.v3y, z3: displacement.v3z
          };
      }
      
      getServiceIdFromSeed(seed) {
          // Map seed back to service ID
          const seedMap = {
              0.314159: 'memory-api',
              0.271828: 'cortex-api', 
              0.577215: 'axon-api',
              0.618034: 'dendrite-api'
          };
          return seedMap[seed] || 'memory-api';
      }
      
      getDisplacementPattern(serviceId) {
          // Unique displacement patterns for each service
          const patterns = {
              'memory-api': 'spherical',      // Spherical distortion
              'cortex-api': 'angular',        // Angular/geometric distortion  
              'axon-api': 'organic',          // Organic/wavy distortion
              'dendrite-api': 'crystalline'   // Crystalline/faceted distortion
          };
          return patterns[serviceId] || 'spherical';
      }
      
             applyDisplacementPattern(v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z, pattern, seed, faceIndex) {
           const intensity = 0.25; // Moderate displacement intensity to maintain structure
          
          switch(pattern) {
              case 'spherical':
                  // Memory API: Spherical distortion - vertices move towards/away from center
                  const centerX = (v1x + v2x + v3x) / 3;
                  const centerY = (v1y + v2y + v3y) / 3;
                  const centerZ = (v1z + v2z + v3z) / 3;
                  
                  const sphere1 = this.sphericalDisplacement(v1x, v1y, v1z, centerX, centerY, centerZ, seed, faceIndex, intensity);
                  const sphere2 = this.sphericalDisplacement(v2x, v2y, v2z, centerX, centerY, centerZ, seed, faceIndex + 1, intensity);
                  const sphere3 = this.sphericalDisplacement(v3x, v3y, v3z, centerX, centerY, centerZ, seed, faceIndex + 2, intensity);
                  
                  return { v1x: sphere1.x, v1y: sphere1.y, v1z: sphere1.z,
                          v2x: sphere2.x, v2y: sphere2.y, v2z: sphere2.z,
                          v3x: sphere3.x, v3y: sphere3.y, v3z: sphere3.z };
                          
              case 'angular':
                  // Cortex API: Angular distortion - vertices move along geometric lines
                  const angular1 = this.angularDisplacement(v1x, v1y, v1z, seed, faceIndex, intensity);
                  const angular2 = this.angularDisplacement(v2x, v2y, v2z, seed, faceIndex + 1, intensity);
                  const angular3 = this.angularDisplacement(v3x, v3y, v3z, seed, faceIndex + 2, intensity);
                  
                  return { v1x: angular1.x, v1y: angular1.y, v1z: angular1.z,
                          v2x: angular2.x, v2y: angular2.y, v2z: angular2.z,
                          v3x: angular3.x, v3y: angular3.y, v3z: angular3.z };
                          
              case 'organic':
                  // Axon API: Organic distortion - wavy, flowing movement
                  const organic1 = this.organicDisplacement(v1x, v1y, v1z, seed, faceIndex, intensity);
                  const organic2 = this.organicDisplacement(v2x, v2y, v2z, seed, faceIndex + 1, intensity);
                  const organic3 = this.organicDisplacement(v3x, v3y, v3z, seed, faceIndex + 2, intensity);
                  
                  return { v1x: organic1.x, v1y: organic1.y, v1z: organic1.z,
                          v2x: organic2.x, v2y: organic2.y, v2z: organic2.z,
                          v3x: organic3.x, v3y: organic3.y, v3z: organic3.z };
                          
              case 'crystalline':
                  // Dendrite API: Crystalline distortion - sharp, faceted movement
                  const crystalline1 = this.crystallineDisplacement(v1x, v1y, v1z, seed, faceIndex, intensity);
                  const crystalline2 = this.crystallineDisplacement(v2x, v2y, v2z, seed, faceIndex + 1, intensity);
                  const crystalline3 = this.crystallineDisplacement(v3x, v3y, v3z, seed, faceIndex + 2, intensity);
                  
                  return { v1x: crystalline1.x, v1y: crystalline1.y, v1z: crystalline1.z,
                          v2x: crystalline2.x, v2y: crystalline2.y, v2z: crystalline2.z,
                          v3x: crystalline3.x, v3y: crystalline3.y, v3z: crystalline3.z };
                          
              default:
                  return { v1x, v1y, v1z, v2x, v2y, v2z, v3x, v3y, v3z };
          }
      }
      
             sphericalDisplacement(x, y, z, centerX, centerY, centerZ, seed, faceIndex, intensity) {
           // Spherical distortion - subtle bulging while maintaining structure
           const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2 + (z - centerZ) ** 2);
           const sphereNoise = Math.sin(faceIndex * seed * 8) * Math.cos(faceIndex * seed * 5) * intensity * 0.3;
           
           const directionX = (x - centerX) / distance;
           const directionY = (y - centerY) / distance;
           const directionZ = (z - centerZ) / distance;
           
           return {
               x: x + directionX * sphereNoise,
               y: y + directionY * sphereNoise,
               z: z + directionZ * sphereNoise
           };
       }
      
             angularDisplacement(x, y, z, seed, faceIndex, intensity) {
           // Angular distortion - subtle geometric variations
           const angularNoise = Math.sin(faceIndex * seed * 12) * intensity * 0.4;
           const geometricX = Math.cos(faceIndex * seed * 3) * angularNoise;
           const geometricY = Math.sin(faceIndex * seed * 7) * angularNoise;
           const geometricZ = Math.cos(faceIndex * seed * 11) * angularNoise;
           
           return {
               x: x + geometricX,
               y: y + geometricY,
               z: z + geometricZ
           };
       }
      
             organicDisplacement(x, y, z, seed, faceIndex, intensity) {
           // Organic distortion - subtle wavy movement
           const organicNoise = Math.sin(faceIndex * seed * 6) * Math.cos(faceIndex * seed * 9) * intensity * 0.35;
           const waveX = Math.sin(x * seed * 4) * organicNoise;
           const waveY = Math.cos(y * seed * 6) * organicNoise;
           const waveZ = Math.sin(z * seed * 8) * organicNoise;
           
           return {
               x: x + waveX,
               y: y + waveY,
               z: z + waveZ
           };
       }
      
             crystallineDisplacement(x, y, z, seed, faceIndex, intensity) {
           // Crystalline distortion - subtle faceted movement
           const crystallineNoise = Math.abs(Math.sin(faceIndex * seed * 10)) * intensity * 0.45;
           const facetX = Math.sign(Math.sin(faceIndex * seed * 2)) * crystallineNoise;
           const facetY = Math.sign(Math.cos(faceIndex * seed * 4)) * crystallineNoise;
           const facetZ = Math.sign(Math.sin(faceIndex * seed * 6)) * crystallineNoise;
           
           return {
               x: x + facetX,
               y: y + facetY,
               z: z + facetZ
           };
       }
    
    createPyramidGeometry(size = 1.5) {
        // Create a pyramid geometry with separate sides and base
        const sideGeometry = new THREE.BufferGeometry();
        const baseGeometry = new THREE.BufferGeometry();
        
        // Pyramid vertices (4 base vertices + 1 apex)
        const vertices = new Float32Array([
            // Base vertices (counter-clockwise from front)
            -size, -size, -size,  // 0: front-left
            size, -size, -size,   // 1: front-right
            size, -size, size,    // 2: back-right
            -size, -size, size,   // 3: back-left
            // Apex
            0, size, 0            // 4: apex
        ]);
        
        // Side faces (triangles) - for wireframe
        const sideIndices = new Uint16Array([
            0, 1, 4,  // Front face
            1, 2, 4,  // Right face
            2, 3, 4,  // Back face
            3, 0, 4   // Left face
        ]);
        
        // Base face (square made of 2 triangles) - for transparent base
        const baseIndices = new Uint16Array([
            0, 2, 1,  // Base triangle 1
            0, 3, 2   // Base triangle 2
        ]);
        
        sideGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        sideGeometry.setIndex(new THREE.BufferAttribute(sideIndices, 1));
        sideGeometry.computeVertexNormals();
        
        baseGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        baseGeometry.setIndex(new THREE.BufferAttribute(baseIndices, 1));
        baseGeometry.computeVertexNormals();
        
        return { sideGeometry, baseGeometry };
    }
    
    createSaturnLikeLabel(serviceId) {
        // Skip label for Thalamus Gateway
        if (serviceId === 'thalamus-gateway') {
            return null;
        }
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // Transparent background
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Add text with same font as "PROJECT CRUCIBLE V0.7"
        context.fillStyle = '#ffffff';
        context.font = '300 24px Inter'; // Same weight and font as the header
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.shadowColor = '#ffffff';
        context.shadowBlur = 5;
        context.fillText(serviceId.replace('-', ' ').toUpperCase(), canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 0.9
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(4, 1, 1);
        
        return sprite;
    }
    
    createDataTriangles() {
        const connections = [
            ['lia-cli', 'thalamus-gateway'],
            ['context-engine', 'thalamus-gateway'],
            ['thalamus-gateway', 'memory-api'],
            ['thalamus-gateway', 'cortex-api'],
            ['thalamus-gateway', 'axon-api'],
            ['thalamus-gateway', 'dendrite-api'],
            // Bidirectional streams between CLI and Context Engine
            ['lia-cli', 'context-engine'],
            ['context-engine', 'lia-cli'],
            // Midpoint stream from LIA_CLI-Context Engine midpoint to Thalamus center
            ['lia-context-midpoint', 'thalamus-center']
        ];
        
        connections.forEach(([from, to]) => {
            const triangle = this.createDataTriangle(from, to);
            this.dataTriangles.push(triangle);
            this.scene.add(triangle);
        });
    }
    
    createDataTriangle(fromService, toService) {
        let fromPos, toPos;
        
        // Handle special midpoint case
        if (fromService === 'lia-context-midpoint' && toService === 'thalamus-center') {
            // Midpoint between LIA_CLI and Context Engine positions
            const liaPos = this.servicePositions['lia-cli'];
            const contextPos = this.servicePositions['context-engine'];
            fromPos = {
                x: (liaPos.x + contextPos.x) / 2,
                y: (liaPos.y + contextPos.y) / 2,
                z: (liaPos.z + contextPos.z) / 2
            };
            // Thalamus center (the cube position, not the apex)
            toPos = { x: 0, y: 1, z: 0 }; // Thalamus cube is at y=1 (moved up by 1.0)
        } else {
            fromPos = this.servicePositions[fromService];
            toPos = this.servicePositions[toService];
        }
        
        // Calculate direction and distance
        const direction = new THREE.Vector3();
        direction.subVectors(
            new THREE.Vector3(toPos.x, toPos.y, toPos.z),
            new THREE.Vector3(fromPos.x, fromPos.y, fromPos.z)
        );
        const distance = direction.length();
        direction.normalize();
        
        // Create small triangle geometry (same size as module surface triangles)
        const triangleGeometry = new THREE.BufferGeometry();
        
        // Create a small triangle that matches module surface triangle size
        const triangleSize = 0.8; // Bigger triangles (was 0.3)
        
        // Create triangle vertices (proper pointed triangle)
        const vertices = new Float32Array([
            // Front point (pointing towards destination) - sharp point
            triangleSize * 0.6, 0, 0,
            // Back left - wider base
            -triangleSize * 0.4, -triangleSize * 0.5, 0,
            // Back right - wider base
            -triangleSize * 0.4, triangleSize * 0.5, 0
        ]);
        
        // Create faces
        const indices = new Uint16Array([
            0, 1, 2 // Front face
        ]);
        
        triangleGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        triangleGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
        triangleGeometry.computeVertexNormals();
        
        // Determine if this is a CLI-Context Engine stream
        const isCLIContextStream = (fromService === 'lia-cli' && toService === 'context-engine') ||
                                  (fromService === 'context-engine' && toService === 'lia-cli');
        
        // Determine if this is the midpoint stream
        const isMidpointStream = (fromService === 'lia-context-midpoint' && toService === 'thalamus-center');
        
        // Randomly choose between white edge or dark triangle for CLI-Context streams
        const useWhiteEdge = isCLIContextStream ? Math.random() > 0.5 : false;
        
        // Create material matching the module aesthetic
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: useWhiteEdge ? 0.9 : 0.6,
            wireframe: true,
            wireframeLinewidth: useWhiteEdge ? 2 : 1
        });
        
        const triangle = new THREE.Mesh(triangleGeometry, material);
        
        // Position and orient the triangle - for CLI-Context streams, start from center of orb
        if (isCLIContextStream) {
            // Start from the center of the orb (current position of the service)
            triangle.position.set(fromPos.x, fromPos.y, fromPos.z);
        } else {
            triangle.position.set(fromPos.x, fromPos.y, fromPos.z);
        }
        
        // Rotate to point towards destination - fix orientation
        const angle = Math.atan2(direction.x, direction.z);
        triangle.rotation.y = angle;
        
        // For midpoint stream, also rotate around X-axis to point down
        if (isMidpointStream) {
            const verticalAngle = Math.atan2(direction.y, Math.sqrt(direction.x * direction.x + direction.z * direction.z));
            triangle.rotation.x = verticalAngle;
            // Add 54-degree rotation around Z-axis (flat axis)
            triangle.rotation.z = 54 * Math.PI / 180; // Convert 54 degrees to radians
        }
        
        // Store animation data
        triangle.userData = {
            fromService: fromService,
            toService: toService,
            fromPosition: { ...fromPos },
            toPosition: { ...toPos },
            direction: direction,
            distance: distance,
            speed: isCLIContextStream ? 0.08 : (isMidpointStream ? 0.028 : 0.008), // 30% slower for midpoint stream
            progress: 0,
            phase: Math.random() * Math.PI * 2,
            isCLIContextStream: isCLIContextStream,
            isMidpointStream: isMidpointStream,
            useWhiteEdge: useWhiteEdge
        };
        
        return triangle;
    }
    
    animate() {
        if (this.failed) return;
        try {
            this.updateScene();
            if (this.focusedService) {
                const position = this.focusedService.position;
                this.focusOffset.subVectors(position, this.lastFocusPosition);
                this.camera.position.add(this.focusOffset);
                this.controls.target.add(this.focusOffset);
                this.lastFocusPosition.copy(position);
            }
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
            if (!this.isInitialized) {
                if (this.renderer.getContext().isContextLost() || !this.renderer.info.render.calls) {
                    throw new Error('WebGL did not draw the scene.');
                }
                if (this.renderer.info.programs.some(program => program.diagnostics?.runnable === false)) {
                    throw new Error('The crystal shader could not compile.');
                }
                setRenderStatus('active', '3D System Active');
                this.isInitialized = true;
            }
            requestAnimationFrame(() => this.animate());
        } catch (error) {
            this.fail(error.message);
        }
    }

    fail(message) {
        this.failed = true;
        this.isInitialized = false;
        if (this.controls) this.controls.enabled = false;
        showLoadError(message);
    }

    updateScene() {
        this.time += 0.016; // 60fps
        
        // Animate services with sophisticated effects
        Object.values(this.services).forEach(service => {
            const userData = service.userData;
            
            // Complex rotation - Thalamus rotates around all axes with continuous motion
            if (userData.serviceId === 'thalamus-gateway') {
                service.rotation.x += userData.rotationSpeed * 0.5; // X-axis rotation (slower)
                service.rotation.y += userData.rotationSpeed * 1.0; // Y-axis rotation (medium)
                service.rotation.z += userData.rotationSpeed * 0.75; // Z-axis rotation (medium-fast)
            }
            
            // Breathing effect for triangles (edge mesh) - only edge triangles for non-Thalamus modules, but NOT CLI and Context Engine
            if (userData.edgeMesh && userData.serviceId !== 'thalamus-gateway' &&
                userData.serviceId !== 'lia-cli' && userData.serviceId !== 'context-engine') {
                const breathingScale = 1 + Math.sin(this.time * 0.5 + userData.breathingPhase) * 0.5; // 50% breathing
                const minScale = 1.1; // 10% wider than dark triangles at minimum
                const actualScale = Math.max(minScale, breathingScale);
                userData.edgeMesh.scale.setScalar(actualScale * userData.scale);
                // No rotation for non-Thalamus modules
            } else if (userData.edgeMesh && userData.serviceId === 'thalamus-gateway') {
                // Thalamus: no breathing, always at max width (35% larger), just inherit rotation from main mesh
                const edgeScale = userData.scale * 1.35; // 35% larger edge triangles
                userData.edgeMesh.scale.setScalar(edgeScale);
                // No independent rotation - inherits from main mesh
            } else if (userData.edgeMesh && (userData.serviceId === 'lia-cli' || userData.serviceId === 'context-engine')) {
                // CLI and Context Engine: no breathing, static scale
                userData.edgeMesh.scale.setScalar(userData.scale);
                
                // Shape-shifting for Context Engine edge triangles
                if (userData.serviceId === 'context-engine') {
                    const shapeShiftTime = this.time * 0.5 + userData.shapeShiftPhase;
                    // Make glitch occur 5x less often: only 1 out of 5 slots
                    const rawCycle = Math.floor(shapeShiftTime); // advances every ~2s (because *0.5 above)
                    const longCycle = rawCycle % 15; // 15-slot super-cycle (3*5)
                    let shapeCycle;
                    if (longCycle % 5 === 0) {
                        // Every 5th slot → glitch
                        shapeCycle = 2; // glitch
                    } else {
                        // Otherwise alternate sphere/cube deterministically
                        shapeCycle = longCycle % 2; // 0 or 1
                    }
                    
                    // Apply different scaling based on shape cycle
                    let shapeScale = userData.scale;
                    switch (shapeCycle) {
                        case 0: // Sphere - normal
                            shapeScale = userData.scale;
                            userData.edgeMesh.scale.setScalar(shapeScale);
                            break;
                        case 1: // Cube - uniform but larger
                            shapeScale = userData.scale * 1.2;
                            userData.edgeMesh.scale.setScalar(shapeScale);
                            break;
                        case 2: { // Glitch mode - explode, hold, return (fits exactly in this mode)
                            // Each mode lasts 2.0s because shapeShiftTime advances at 0.5 units/sec and we floor by units
                            const secondsInMode = (shapeShiftTime - Math.floor(shapeShiftTime)) * 2.0; // 0..2s within this mode
                            
                            // Durations in seconds (sum to 2.0s to finish before mode switches)
                            const explodeDurationSec = 0.25;  // quick explode
                            const holdDurationSec = 1.10;     // visible hold
                            const returnDurationSec = 0.65;   // smooth return
                            const cycleDurationSec = explodeDurationSec + holdDurationSec + returnDurationSec; // = 2.0s
                            
                            // Clamp to ensure numerical safety
                            const tInCycle = Math.min(secondsInMode, cycleDurationSec);
                            const intensity = 50.0; // explode amount
                            
                            // Smoothstep easing
                            const smoothstep = (t) => t * t * (3 - 2 * t);
                            let alpha; // 0..1 progression
                            if (tInCycle < explodeDurationSec) {
                                // Explode with ease-out (smoothstep)
                                const t = tInCycle / explodeDurationSec;
                                alpha = smoothstep(t);
                            } else if (tInCycle < explodeDurationSec + holdDurationSec) {
                                // Hold at peak
                                alpha = 1.0;
                            } else {
                                // Return with ease-in (reverse smoothstep)
                                const t = (tInCycle - (explodeDurationSec + holdDurationSec)) / returnDurationSec;
                                alpha = 1.0 - smoothstep(t);
                            }
                            const scaleOut = 1.0 + alpha * intensity;
                            userData.edgeMesh.scale.setScalar(userData.scale * scaleOut);

                            // Inner translucent core short bulge during middle of hold window
                            if (userData.innerMesh) {
                                const holdStart = explodeDurationSec;
                                const holdEnd = explodeDurationSec + holdDurationSec;
                                // Define a short sub-window in the middle third of hold
                                const bulgeWindowStart = holdStart + holdDurationSec * 0.33;
                                const bulgeWindowEnd = holdStart + holdDurationSec * 0.66;

                                let innerScale = userData.scale;
                                let innerOpacity = userData.innerMesh.material.opacity;
                                if (tInCycle >= bulgeWindowStart && tInCycle <= bulgeWindowEnd) {
                                    // Map to 0..1 within bulge window
                                    const tBulge = (tInCycle - bulgeWindowStart) / (bulgeWindowEnd - bulgeWindowStart);
                                    // Symmetric ease in/out
                                    const bulgeAlpha = smoothstep(tBulge < 0.5 ? tBulge * 2 : (1 - tBulge) * 2);
                                    // Make inner core grow noticeably; higher than edge base scale
                                    const innerIntensity = 60.0; // slightly larger than edge intensity
                                    innerScale = userData.scale * (1.0 + bulgeAlpha * innerIntensity);
                                    innerOpacity = 0.8; // more visible during bulge
                                } else {
                                    innerScale = userData.scale; // reset
                                    innerOpacity = 0.3; // default subtle wireframe
                                }
                                userData.innerMesh.scale.setScalar(innerScale);
                                userData.innerMesh.material.opacity = innerOpacity;
                            }
                            break;
                        }
                    }
                }
            }
            
            // Animate inner mesh - no rotation for non-Thalamus modules
            if (userData.innerMesh) {
                if (userData.serviceId === 'thalamus-gateway') {
                    // Only Thalamus inner mesh inherits rotation from main mesh
                    // No independent rotation - inherits from main mesh
                    
                    // Fully opaque white color for Thalamus inner triangles (no fading)
                    userData.innerMesh.material.color.setHex(0xffffff);
                    userData.innerMesh.material.opacity = 1.0; // Fully opaque
                } else {
                    userData.innerMesh.material.opacity = 0.3;
                }
                userData.innerMesh.scale.setScalar(userData.scale);
            }
            
            // Orbiting animation for Lia-CLI and Context Engine - ONLY rotation about fixed point centered over Thalamus
            if (userData.isOrbiting) {
                const orbitAngle = this.time * userData.orbitSpeed + userData.orbitPhase;
                const orbitRadius = userData.orbitRadius; // Use the configured orbit radius
                const orbitX = Math.cos(orbitAngle) * orbitRadius;
                const orbitZ = Math.sin(orbitAngle) * orbitRadius;
                
                // Update position to orbit around fixed point centered over Thalamus (on their plane)
                service.position.x = orbitX;
                service.position.y = userData.basePosition.y; // Keep on their plane (y=10)
                service.position.z = orbitZ;
                
                // Update edge mesh and inner mesh positions
                if (userData.edgeMesh) {
                    userData.edgeMesh.position.copy(service.position);
                }
                if (userData.innerMesh) {
                    userData.innerMesh.position.copy(service.position);
                }
                
                // Make LIA_CLI always face Context Engine
                if (userData.serviceId === 'lia-cli') {
                    const contextEngine = this.services['context-engine'];
                    if (contextEngine) {
                        // Calculate direction vector from LIA_CLI to Context Engine
                        const direction = new THREE.Vector3();
                        direction.subVectors(contextEngine.position, service.position);
                        direction.normalize();

                        // For LIA_CLI letterbox shape (6x1.5x4.5), the 2nd smallest face is 6x1.5
                        // This face is perpendicular to the Z-axis (width dimension)
                        // We want this face to face the Context Engine

                        // Calculate the horizontal angle to face Context Engine
                        const horizontalAngle = Math.atan2(direction.x, direction.z);

                        // Apply the rotation around Y-axis to face Context Engine
                        service.rotation.y = horizontalAngle + Math.PI / 2;

                        // Make edge and inner meshes inherit the rotation
                        if (userData.edgeMesh) {
                            userData.edgeMesh.rotation.copy(service.rotation);
                        }
                        if (userData.innerMesh) {
                            userData.innerMesh.rotation.copy(service.rotation);
                        }
                    }
                }
                
                // NO other movements - only position updates for orbiting
            } else {
                // Static positioning for other modules - no floating animation
                service.position.x = userData.basePosition.x;
                service.position.y = userData.basePosition.y;
                service.position.z = userData.basePosition.z;
            }
        });
        
        // Animate data triangles
        this.dataTriangles.forEach(triangle => {
            const userData = triangle.userData;
            
            // Move triangle along the path
            userData.progress += userData.speed;
            if (userData.progress > 1) {
                userData.progress = 0;
            }
            
            // For CLI-Context Engine streams, use current orb positions
            // For triangles going TO Thalamus, start from (0, 0, 0)
            // For midpoint stream, calculate current midpoint between LIA_CLI and Context Engine
            let fromPos, toPos;
            if (userData.isCLIContextStream) {
                // Get current positions of the orbiting services
                const fromService = this.services[userData.fromService];
                const toService = this.services[userData.toService];
                if (fromService && toService) {
                    fromPos = fromService.position;
                    toPos = toService.position;
                } else {
                    fromPos = new THREE.Vector3(userData.fromPosition.x, userData.fromPosition.y, userData.fromPosition.z);
                    toPos = new THREE.Vector3(userData.toPosition.x, userData.toPosition.y, userData.toPosition.z);
                }
            } else if (userData.isMidpointStream) {
                // Calculate current midpoint between LIA_CLI and Context Engine
                const liaService = this.services['lia-cli'];
                const contextService = this.services['context-engine'];
                if (liaService && contextService) {
                    fromPos = new THREE.Vector3(
                        (liaService.position.x + contextService.position.x) / 2,
                        (liaService.position.y + contextService.position.y) / 2,
                        (liaService.position.z + contextService.position.z) / 2
                    );
                } else {
                    fromPos = new THREE.Vector3(userData.fromPosition.x, userData.fromPosition.y, userData.fromPosition.z);
                }
                toPos = new THREE.Vector3(userData.toPosition.x, userData.toPosition.y, userData.toPosition.z);
            } else if (userData.toService === 'thalamus-gateway') {
                // Triangles going TO Thalamus start from (0, 0.5, 0) - moved down a bit more
                fromPos = new THREE.Vector3(0, 0.5, 0);
                toPos = new THREE.Vector3(userData.toPosition.x, userData.toPosition.y, userData.toPosition.z);
            } else {
                fromPos = new THREE.Vector3(userData.fromPosition.x, userData.fromPosition.y, userData.fromPosition.z);
                toPos = new THREE.Vector3(userData.toPosition.x, userData.toPosition.y, userData.toPosition.z);
            }
            
            // Calculate current position along the path (straight line)
            const currentPos = new THREE.Vector3();
            let effectiveProgress = userData.progress;
            
            // For midpoint stream, stop at 100% progress to go all the way to the cube
            if (userData.isMidpointStream) {
                effectiveProgress = Math.min(userData.progress, 1.0);
            }
            
            currentPos.lerpVectors(fromPos, toPos, effectiveProgress);
            
            // Update triangle position (straight line travel)
            triangle.position.copy(currentPos);
            
            // No rotation - keep triangle oriented towards destination
            // The triangle is already oriented correctly when created
            
            // Pulse opacity based on progress
            const pulse = Math.sin(userData.progress * Math.PI * 2 + userData.phase) * 0.3 + 0.7;
            triangle.material.opacity = pulse * (userData.useWhiteEdge ? 0.9 : 0.6);
        });
        
    }
    
    onWindowResize() {
        this.updateCameraProjection();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Initialize 3D architecture when DOM is loaded
let architecture3D = null;

function setRenderStatus(state, message) {
    const status = document.getElementById('render-status');
    status.dataset.state = state;
    status.textContent = message;
    document.getElementById('scene-controls').disabled = state !== 'active';
}

function showLoadError(message) {
    setRenderStatus('failed', '3D renderer failed. ' + message);
    console.error(message);
}

document.addEventListener('DOMContentLoaded', function() {
    try {
        if (typeof THREE === 'undefined') {
            showLoadError('Three.js could not load. Check that the script is available and reload.');
            return;
        }

        if (typeof THREE.OrbitControls === 'undefined') {
            showLoadError('OrbitControls could not load. Check that the script is available and reload.');
            return;
        }

        architecture3D = new Architecture3D();
        window.addEventListener('resize', () => {
            if (architecture3D.isInitialized) {
                architecture3D.onWindowResize();
            }
        });
    } catch (error) {
        showLoadError(error.message);
    }
});

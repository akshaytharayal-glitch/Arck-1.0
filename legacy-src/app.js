import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class ArchitecturalVisualizer {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        
        this.init();
    }
    
    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);
        
        // Setup camera
        this.camera.position.set(50, 50, 50);
        this.camera.lookAt(0, 0, 0);
        
        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        
        // Lights
        const ambient = new THREE.AmbientLight(0x404040, 2);
        this.scene.add(ambient);
        
        const directional = new THREE.DirectionalLight(0xffffff, 1);
        directional.position.set(100, 100, 50);
        directional.castShadow = true;
        this.scene.add(directional);
        
        // Grid
        const gridHelper = new THREE.GridHelper(100, 50);
        this.scene.add(gridHelper);
        
        // Add sample building
        this.createBuilding();
        
        // Window resize handler
        window.addEventListener('resize', () => this.onWindowResize());
        
        // Start animation
        this.animate();
    }
    
    createBuilding() {
        const building = new THREE.Group();
        
        // Base
        const baseGeometry = new THREE.BoxGeometry(20, 5, 20);
        const baseMaterial = new THREE.MeshPhongMaterial({ color: 0x8b7355 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 2.5;
        base.castShadow = true;
        building.add(base);
        
        // Main structure
        const mainGeometry = new THREE.BoxGeometry(15, 30, 15);
        const mainMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc });
        const main = new THREE.Mesh(mainGeometry, mainMaterial);
        main.position.y = 20;
        main.castShadow = true;
        building.add(main);
        
        // Windows
        for (let floor = 0; floor < 6; floor++) {
            for (let i = 0; i < 4; i++) {
                const windowGeometry = new THREE.BoxGeometry(2, 2, 0.2);
                const windowMaterial = new THREE.MeshPhongMaterial({ 
                    color: 0x88ccff,
                    emissive: 0x4488cc,
                    emissiveIntensity: 0.5
                });
                const window = new THREE.Mesh(windowGeometry, windowMaterial);
                
                const angle = (Math.PI * 2 / 4) * i;
                const radius = 7.6;
                window.position.x = Math.cos(angle) * radius;
                window.position.z = Math.sin(angle) * radius;
                window.position.y = 8 + floor * 5;
                window.rotation.y = angle;
                
                building.add(window);
            }
        }
        
        // Roof
        const roofGeometry = new THREE.ConeGeometry(10, 8, 4);
        const roofMaterial = new THREE.MeshPhongMaterial({ color: 0x8b0000 });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 39;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        building.add(roof);
        
        this.scene.add(building);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize
new ArchitecturalVisualizer();

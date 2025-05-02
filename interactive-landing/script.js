import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Renderer und Szene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x5182ed);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Kamera und Steuerung
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(8, 40, 22);
camera.near = 0.1;  // Nahe Clipping-Ebene
camera.far = 500;   // Entfernte Clipping-Ebene

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 10;
controls.maxDistance = 60;
controls.autoRotate = false;
controls.target = new THREE.Vector3(0, 4, 0);
controls.update();

// Beleuchtung
const ambientLight = new THREE.AmbientLight(0xffffff);
scene.add(ambientLight);

const spotLight = new THREE.SpotLight(0xffffff, 3000, 100, 0.22, 1);
spotLight.position.set(0, 50, 0);
spotLight.castShadow = true;
spotLight.shadow.bias = -0.0001;
scene.add(spotLight);

const lightHelper = new THREE.PointLightHelper(spotLight);
scene.add(lightHelper);

const gridHelper = new THREE.GridHelper(200, 200);
scene.add(gridHelper);

// Nur Dateinamen als Liste
const bodyParts = [
  'kopf.glb',
  'koerper.glb',
  'bein-links.glb',
  'bein-rechts.glb',
  'arm-rechts.glb'
];

const loader = new GLTFLoader().setPath('models/');
const meshes = {}; // Key: Dateiname, Value: Mesh

bodyParts.forEach((fileName) => {
  loader.load(fileName, (gltf) => {
    const mesh = gltf.scene;

    mesh.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        // Speichern für Klick-Erkennung
        meshes[fileName] = child;
        child.userData = { fileName };

        mesh.position.set(0, 0, 0);
        scene.add(mesh);
      }
    });

  }, (xhr) => {
    console.log(`Loading ${fileName}: ${xhr.loaded / xhr.total * 100}%`);
  }, (error) => {
    console.error(`Fehler beim Laden von ${fileName}:`, error);
  });
});

// Raycasting für die Klick-Erkennung
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Klick-Listener hinzufügen
window.addEventListener('click', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  raycaster.far = 80;

  const intersects = raycaster.intersectObjects(Object.values(meshes), true);

  if (intersects.length > 0) {
    const object = intersects[0].object;
    const fileName = object.userData.fileName;

    console.log(`GLB-Datei geklickt: ${fileName}`);
    alert(`GLB-Datei: ${fileName}`);
  } else {
    console.log('Kein Objekt getroffen');
  }
});



// Anpassung bei Fenstergrößenänderung
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animationsloop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();

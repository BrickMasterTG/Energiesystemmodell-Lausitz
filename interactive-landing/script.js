import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Renderer und Szene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
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

// Körperteile und die zugehörigen .glb-Dateien
const bodyParts = {
  Kopf: 'kopf.glb',
  Körper: 'koerper.glb',
  BeinLinks: 'bein-links.glb',
  BeinRechts: 'bein-rechts.glb',
  ArmRechts: 'arm-rechts.glb'
};

// GLTFLoader für jedes Körperteil
const loader = new GLTFLoader().setPath('models/');

// Körperteile in der Szene laden und erkennbar machen
const meshes = {}; // Speichert die Meshes der Körperteile für späteres Klick-Handling

Object.entries(bodyParts).forEach(([partName, fileName]) => {
  loader.load(fileName, (gltf) => {
    console.log(`${partName} geladen`);
    const mesh = gltf.scene;

    mesh.traverse((child) => {
      if (child.isMesh) {
        console.log('Mesh:', child.name);
        child.castShadow = true;
        child.receiveShadow = true;

        // Speichern des Meshes für spätere Klick-Erkennung
        meshes[partName] = child;

        // Füge `userData` hinzu, um den Körperteil später zu identifizieren
        child.userData = { partName };

        // Position des Körperteils anpassen
        mesh.position.set(0, 0, 0);
        scene.add(mesh);
      }
    });
    
  }, (xhr) => {
    console.log(`Loading ${partName}: ${xhr.loaded / xhr.total * 100}%`);
  }, (error) => {
    console.error(`Fehler beim Laden von ${partName}:`, error);
  });
});

// Raycasting für die Klick-Erkennung
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Klick-Listener hinzufügen
window.addEventListener('click', (event) => {
  // Normierte Mauskoordinaten
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  // Raycaster aktualisieren
  raycaster.setFromCamera(mouse, camera);

  // Setze die maximale Reichweite des Raycasters
  raycaster.far = 80;  // Hier die Reichweite einstellen

  // Finde alle Meshes, die mit dem Ray interagieren
  const intersects = raycaster.intersectObjects(Object.values(meshes), true);

  if (intersects.length > 0) {
    const object = intersects[0].object;
    const partName = object.userData.partName;

    // Zeige an, welches Körperteil geklickt wurde
    console.log(`${partName} wurde angeklickt!`);

    // Beispielhafte Handhabung nach Klick (hier: Alert)
    switch (partName) {
      case 'Kopf':
        alert('Du hast auf den Kopf geklickt!');
        break;
      case 'Körper':
        alert('Du hast auf den Körper geklickt!');
        break;
      case 'BeinLinks':
        alert('Du hast auf das linke Bein geklickt!');
        break;
      case 'BeinRechts':
        alert('Du hast auf das rechte Bein geklickt!');
        break;
      case 'ArmRechts':
        alert('Du hast auf den rechten Arm geklickt!');
        break;
      default:
        alert(`Kein spezielles Verhalten für ${partName}`);
    }
  } else {
    console.log('Kein Körperteil getroffen');
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

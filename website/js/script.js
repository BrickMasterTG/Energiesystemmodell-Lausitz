import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Renderer und Szene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Kamera und Steuerung
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  1,
  1000
);
//camera.position.set(8, 40, 22);
camera.position.set(3, 1, 2);
camera.near = 0.1; // Nahe Clipping-Ebene
camera.far = 500; // Entfernte Clipping-Ebene

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;

controls.minDistance = 3;
controls.maxDistance = 3;

//controls.minPolarAngle = Math.PI / 2.7;
//controls.maxPolarAngle = 1.2;

controls.autoRotate = false;
controls.target = new THREE.Vector3(0, 0, 0);
controls.update();

const target = new THREE.Object3D();
target.position.set(0, 5, 0); // Zielpunkt
scene.add(target);

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1); // skyColor, groundColor, intensity
hemiLight.position.set(0, 20, 0);
scene.add(hemiLight);

// OR a very soft directional light
const dirLight = new THREE.DirectionalLight(0xffffff, 2);
dirLight.position.set(5, 10, 7);
dirLight.castShadow = false; // Or true, if you want shadows
scene.add(dirLight);

// Nur Dateinamen als Liste
const bodyParts = [
  "Solarkraftwerk.glb",
  "Kohlekraftwerk.glb",
  "Zug.glb",
  "Offshore-Solar.glb",
  "Vorhang.glb",
  "Oberflaeche.glb",
  "Gestell.glb",
  "Bildschrirm.glb",
  "Windpark.glb",
  "Stadt.glb",
];

const loader = new GLTFLoader().setPath("../models/");

const meshes = {}; // Key: Dateiname, Value: Mesh

bodyParts.forEach((fileName) => {
  loader.load(
    fileName,
    (gltf) => {
      const mesh = gltf.scene;

      mesh.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.userData = { fileName };
        }
      });

      // RICHTIG: gesamter Mesh wird gespeichert
      meshes[fileName] = mesh;
      scene.add(mesh);
    },
    (xhr) => {
      console.log(`Loading ${fileName}: ${(xhr.loaded / xhr.total) * 100}%`);
    },
    (error) => {
      console.error(`Fehler beim Laden von ${fileName}:`, error);
    }
  );
});

// Raycasting für die Klick-Erkennung
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Klick-Listener hinzufügen
window.addEventListener("click", (event) => {
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
    const htmlFile = fileName.replace(/\.glb$/i, "").toLowerCase();
    window.location.href = `${htmlFile}.html`;
  } else {
    console.log("Kein Objekt getroffen");
  }
});

// Anpassung bei Fenstergrößenänderung
window.addEventListener("resize", () => {
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

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

function setSpotlightAngleFromDegrees(spotlight, degrees) {
  const radians = THREE.MathUtils.degToRad(degrees);
  spotlight.angle = radians;
}

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
camera.position.set(10, 5, 10);
camera.near = 0.1; // Nahe Clipping-Ebene
camera.far = 500; // Entfernte Clipping-Ebene

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = true;
//controls.enablePan = false;
//controls.minDistance = 15;
//controls.maxDistance = 35;

//controls.minPolarAngle = Math.PI / 2.7;
//controls.maxPolarAngle = Math.PI / 6;

controls.autoRotate = false;
controls.target = new THREE.Vector3(0, 0, 0);
controls.update();

const target = new THREE.Object3D();
target.position.set(0, 5, 0); // Zielpunkt
scene.add(target);

const spotLight = new THREE.SpotLight(0xffffff, 10000, 100, 0.22, 1);
spotLight.position.set(0, 80, 0);
spotLight.castShadow = true;
spotLight.shadow.bias = -0.0001;
//scene.add(spotLight);

const spotLight2 = new THREE.SpotLight(0xffffff, 2500, 100, 0.22, 1);
spotLight2.position.set(-10, 26, 20);
spotLight2.castShadow = true;
spotLight2.shadow.bias = -0.0001;
//scene.add(spotLight2);

const spotLight3 = new THREE.SpotLight(0xffffff, 200, 100, 0.22, 1);
spotLight3.position.set(20, 15, -20);
spotLight3.castShadow = true;
spotLight3.shadow.bias = -0.0001;
//scene.add(spotLight3);

const spotLight4 = new THREE.SpotLight(0xffffff, 500, 100, 0.22, 1);
spotLight4.position.set(-30, 26, 10);
spotLight4.castShadow = true;
spotLight4.shadow.bias = -0.0001;
//scene.add(spotLight4);

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

spotLight.target = target;
spotLight2.target = target;
spotLight3.target = target;
spotLight4.target = target;

setSpotlightAngleFromDegrees(spotLight, 100);
setSpotlightAngleFromDegrees(spotLight2, 140);
setSpotlightAngleFromDegrees(spotLight3, 240);
setSpotlightAngleFromDegrees(spotLight4, 240);

const lightHelper = new THREE.PointLightHelper(spotLight);
//scene.add(lightHelper);
const lightHelper2 = new THREE.PointLightHelper(spotLight2);
//scene.add(lightHelper2);
const lightHelper3 = new THREE.PointLightHelper(spotLight3);
//scene.add(lightHelper3);
const lightHelper4 = new THREE.PointLightHelper(spotLight4);
//scene.add(lightHelper4);

const gridHelper = new THREE.GridHelper(200, 200);
//scene.add(gridHelper);

// Nur Dateinamen als Liste
const bodyParts = [
  //'kopf.glb',
  //'koerper.glb',
  //'bein-links.glb',
  //'bein-rechts.glb',
  //'arm-rechts.glb',
  //'ImageToStl.com_Modelltisch-Basis+v42.glb',
  "tisch-textured-wood.glb",
];

const loader = new GLTFLoader().setPath("models/");
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

      // SCALE THE MODEL HERE
      if (fileName === "Tisch.glb") {
        mesh.scale.set(8, 8, 8); // Beispiel-Skalierung (x, y, z)
        mesh.position.set(0, 0, 0); // Optional: Position anpassen
      }
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

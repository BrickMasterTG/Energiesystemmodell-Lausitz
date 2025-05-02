import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(8, 40, 22);

const controls = new OrbitControls(camera, renderer.domElement);

controls.enableDamping = true;
controls.enablePan = false;
controls.minDistance = 10;

controls.maxDistance = 60;
//controls.minPolarAngle = 0.5;
//controls.maxPolarAngle = 1.5;
controls.autoRotate = false;

controls.target = new THREE.Vector3(0, 4, 0);

controls.update();

const groundGeometry = new THREE.PlaneGeometry(20, 20, 32, 32);
groundGeometry.rotateX(-Math.PI / 2);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x555555,
  side: THREE.DoubleSide
});
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.castShadow = false;
groundMesh.receiveShadow = true;
//cene.add(groundMesh);

const spotLight = new THREE.SpotLight(0xffffff, 3000, 100, 0.22, 1);
spotLight.position.set(0, 50, 0);
spotLight.castShadow = true;
spotLight.shadow.bias = -0.0001;
scene.add(spotLight);

const ambientLight = new THREE.AmbientLight(0xffffff)
scene.add(ambientLight)

const lightHelper = new THREE.PointLightHelper(spotLight)
scene.add(lightHelper)

const gridHelper = new THREE.GridHelper(200, 200)
scene.add(gridHelper)



const loader = new GLTFLoader().setPath('models/');
loader.load('renamed.glb', (gltf) => {
  console.log('loading model');
  const mesh = gltf.scene;

  mesh.traverse((child) => {
    if (child.isMesh) {
      console.log('Mesh:', child.name); // ← Hier passt der Log!
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  mesh.position.set(0, 0, 0);
  scene.add(mesh);

  document.getElementById('progress-container').style.display = 'none';
}, (xhr) => {
  console.log(`loading ${xhr.loaded / xhr.total * 100}%`);
}, (error) => {
  console.error(error);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();


const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const clickableObjects = scene.children.filter(obj =>
    obj.type !== 'GridHelper' &&
    obj.type !== 'PointLightHelper'
  );

  const intersects = raycaster.intersectObjects(clickableObjects, true);

  if (intersects.length > 0) {
    const objName = intersects[0].object.name;

    if (objName && objName.trim() !== '') {
      console.log('Geklickt auf:', objName);

      switch (objName) {
        case 'Kopf':
          alert('Du hast auf den Kopf geklickt!');
          break;
        case 'Knopf1':
          alert('Knopf1 gedrückt!');
          break;
        case 'SchalterXYZ':
          alert('Schalter aktiviert!');
          break;
        default:
          alert(`Kein spezielles Verhalten für ${objName}`);
      }
    }
  }
});

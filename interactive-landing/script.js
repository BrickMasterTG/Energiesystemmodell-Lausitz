// Function to check if a point is too far from any model part
function isClickTooFarFromModel(point) {
  // Maximum distance in world units to allow a click
  const MAX_DISTANCE = 2.0;
  
  // Check distance to each non-proxy mesh
  for (const meshName in meshes) {
    const mesh = meshes[meshName];
    if (!mesh) continue;
    
    // Get world position of mesh
    const meshPosition = new THREE.Vector3();
    mesh.getWorldPosition(meshPosition);
    
    // Calculate distance to click point
    const distance = meshPosition.distanceTo(point);
    
    // If close enough to any mesh, it's valid
    if (distance < MAX_DISTANCE) {
      return false;
    }
  }
  
  // If we get here, the click is too far from any model part
  return true;
}// Toggle for showing debug visuals
const DEBUG_MODE = true;

// Helper function to toggle debug mode
function toggleDebugMode() {
  const newMode = !DEBUG_MODE;
  console.log(`Debug mode ${newMode ? 'enabled' : 'disabled'}`);
  
  // Show/hide all debug elements
  scene.traverse((object) => {
    if (object.name && object.name.startsWith('debug_')) {
      object.visible = newMode;
    }
    
    // Show proxy colliders in wireframe when debug is on
    if (object.name && object.name.startsWith('proxy_')) {
      if (object.material) {
        if (newMode) {
          object.material.wireframe = true;
          object.material.opacity = 0.3;
          object.material.transparent = true;
        } else {
          object.material.wireframe = false;
          object.material.opacity = 0.0;
        }
      }
    }
  });
  
  return newMode;
}

// Add keyboard listener for debug mode toggle
window.addEventListener('keydown', (event) => {
  if (event.key === 'd' || event.key === 'D') {
    toggleDebugMode();
  }
});// Add proxy collision objects for better hit detection
function createProxyColliders() {
  // Check if meshes are loaded
  if (Object.keys(meshes).length === 0) {
    console.log("No meshes available for collision proxies");
    return;
  }

  // For each original mesh, create a slightly larger invisible collision proxy
  Object.entries(meshes).forEach(([name, mesh]) => {
    if (!mesh.geometry || !mesh.geometry.boundingBox) {
      // Make sure we have a bounding box
      if (mesh.geometry) {
        mesh.geometry.computeBoundingBox();
      } else {
        console.log(`No geometry for ${name}`);
        return;
      }
    }

    // Get the size of the mesh from its bounding box
    const boundingBox = mesh.geometry.boundingBox.clone();
    const size = new THREE.Vector3();
    boundingBox.getSize(size);

    // Create a box geometry that's slightly larger than the original
    const scaleFactor = 1.5; // 50% larger than the original
    const boxGeometry = new THREE.BoxGeometry(
      size.x * scaleFactor,
      size.y * scaleFactor,
      size.z * scaleFactor
    );

    // Create an invisible material for the proxy
    const proxyMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.0, // Completely invisible
      depthWrite: false // Don't interfere with rendering
    });

    // Create the proxy mesh
    const proxyMesh = new THREE.Mesh(boxGeometry, proxyMaterial);
    
    // Position the proxy to match the original mesh
    proxyMesh.position.copy(mesh.position);
    proxyMesh.rotation.copy(mesh.rotation);
    proxyMesh.scale.copy(mesh.scale);
    
    // Set the proxy's name to reference the original
    proxyMesh.name = `proxy_${name}`;
    
    // Store the original mesh's friendly name in the proxy's userData
    proxyMesh.userData.friendlyName = mesh.userData.friendlyName;
    proxyMesh.userData.originalMesh = name;
    
    // Add the proxy to the scene
    scene.add(proxyMesh);
    
    // Add to clickable meshes
    clickableMeshes.push(proxyMesh);
    
    console.log(`Created proxy collider for ${name}`);
  });
}import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Store mesh name mappings for click handling
const meshNameMappings = {
  'Body1001': 'Arm-rechts',
  'Bein_l001': 'Bein-links',
  'Bein_r001': 'Bein-rechts',
  'Body1': 'Kopf1',
  'Koerper001': 'Main-Body'
};

// Store references to meshes for easier access
const meshes = {};

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
controls.autoRotate = false;
controls.target = new THREE.Vector3(0, 4, 0);
controls.update();

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

const loader = new GLTFLoader().setPath('models/');
loader.load('renamed.glb', (gltf) => {
  console.log('loading model');
  const mesh = gltf.scene;

  mesh.traverse((child) => {
    if (child.isMesh) {
      console.log('Mesh:', child.name);
      child.castShadow = true;
      child.receiveShadow = true;
      
      // Store mesh for later reference
      meshes[child.name] = child;
      
      // Add user data to store the friendly name
      child.userData.friendlyName = meshNameMappings[child.name] || child.name;
      
      // Optimize the geometry for better raycasting
      if (child.geometry) {
        // Ensure the geometry has a bounding box for faster intersection tests
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
      }
    }
  });

  mesh.position.set(0, 0, 0);
  scene.add(mesh);
  
  // Update the clickable meshes array after the model is loaded
  updateClickableMeshes();
  
  // Create larger collision proxies for better hit detection
  createProxyColliders();

  if (document.getElementById('progress-container')) {
    document.getElementById('progress-container').style.display = 'none';
  }
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
// Adjust the raycaster precision for more accurate detection
//raycaster.params.Line.threshold = 0.2;
//raycaster.params.Points.threshold = 0.2;
// Set a more balanced threshold for mesh detection
//raycaster.params.Mesh.threshold = 0.1;

// Modify the raycaster parameters for better distance detection
raycaster.params.Line.threshold = 0.5;  // Increased from 0.2
raycaster.params.Points.threshold = 0.5;  // Increased from 0.2
raycaster.params.Mesh.threshold = 0.2;  // Increased from 0.1


const mouse = new THREE.Vector2();

// Variable to store all meshes once the model is loaded
const clickableMeshes = [];

// Update the clickable meshes array when model is loaded
function updateClickableMeshes() {
  clickableMeshes.length = 0; // Clear the array
  scene.traverse((object) => {
    if (object.isMesh && 
        object.name !== 'GridHelper' && 
        object.name !== 'PointLightHelper') {
      clickableMeshes.push(object);
    }
  });
  console.log(`Found ${clickableMeshes.length} clickable meshes`);
}

// Add debug visualization for the clicked position and ray
const debugSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.1, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
debugSphere.visible = false;
scene.add(debugSphere);

// Add a debug line to visualize the ray
const rayOrigin = new THREE.Vector3();
const rayDirection = new THREE.Vector3();
const rayLength = 100;
const rayGeometry = new THREE.BufferGeometry();
rayGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Array(6).fill(0), 3));
const rayMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
const rayLine = new THREE.Line(rayGeometry, rayMaterial);
rayLine.visible = false;
scene.add(rayLine);

window.addEventListener('click', (event) => {
  // Get normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the raycaster
  raycaster.setFromCamera(mouse, camera);
  
  // Make sure we have updated our clickable meshes
  if (clickableMeshes.length === 0) {
    updateClickableMeshes();
  }

  // Increase the precision for distant objects
  const cameraDistance = camera.position.distanceTo(controls.target);
  // Much higher scale for distant objects
  const distanceScale = Math.max(1, cameraDistance / 10); 
  
  // Debug information about our ray
  console.log(`Camera position: ${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}`);
  console.log(`Ray direction: ${raycaster.ray.direction.x.toFixed(2)}, ${raycaster.ray.direction.y.toFixed(2)}, ${raycaster.ray.direction.z.toFixed(2)}`);
  
  // Log all meshes and their positions for debugging
  console.log('Available meshes:');
  clickableMeshes.forEach(mesh => {
    console.log(`- ${mesh.name}: pos(${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)})`);
  });
  
  // Perform first pass with original meshes for more precision
  let intersects = raycaster.intersectObjects(clickableMeshes.filter(m => !m.name.startsWith('proxy_')), true);
  
  // If no intersection with original meshes, try the proxy colliders
  if (intersects.length === 0) {
    // Increase threshold for proxy detection
    const originalThreshold = raycaster.params.Mesh.threshold;
    raycaster.params.Mesh.threshold = 0.5;
    
    intersects = raycaster.intersectObjects(clickableMeshes.filter(m => m.name.startsWith('proxy_')), false);
    
    // Restore original threshold
    raycaster.params.Mesh.threshold = originalThreshold;
  }

  // Debug info
  console.log(`Camera distance: ${cameraDistance.toFixed(2)}, Scale: ${distanceScale.toFixed(2)}`);
  console.log(`Testing against ${clickableMeshes.length} meshes`);
  
  // Visualize the ray for debugging
  rayOrigin.copy(raycaster.ray.origin);
  rayDirection.copy(raycaster.ray.direction);
  const positions = rayLine.geometry.attributes.position.array;
  positions[0] = rayOrigin.x;
  positions[1] = rayOrigin.y;
  positions[2] = rayOrigin.z;
  
  rayDirection.multiplyScalar(rayLength);
  positions[3] = rayOrigin.x + rayDirection.x;
  positions[4] = rayOrigin.y + rayDirection.y;
  positions[5] = rayOrigin.z + rayDirection.z;
  
  rayLine.geometry.attributes.position.needsUpdate = true;
  rayLine.visible = true;
  
  // Hide ray line after 2 seconds
  setTimeout(() => {
    rayLine.visible = false;
  }, 2000);
  
  if (intersects.length > 0) {
    const object = intersects[0].object;
    const objName = object.name;
    const friendlyName = object.userData.friendlyName || objName;
    const point = intersects[0].point;

    // Check if the click is too far from any actual model part
    if (objName.startsWith('proxy_') && isClickTooFarFromModel(point)) {
      console.log('Click rejected - too far from model parts');
      return;
    }

    // Show debug sphere at intersection point
    debugSphere.position.copy(point);
    debugSphere.visible = true;
    
    // Hide debug sphere after 2 seconds
    setTimeout(() => {
      debugSphere.visible = false;
    }, 2000);

    console.log('Clicked on:', objName);
    console.log('Friendly name:', friendlyName);
    console.log('Click position:', point);
    
    // If this is a proxy, use the original's friendlyName
    let nameToUse = friendlyName;
    if (objName.startsWith('proxy_') && object.userData.originalMesh) {
      console.log(`This is a proxy for ${object.userData.originalMesh}`);
      const originalMesh = meshes[object.userData.originalMesh];
      if (originalMesh) {
        nameToUse = originalMesh.userData.friendlyName;
      }
    }

    // Handle clicks based on the friendly name (original 3D software name)
    switch (nameToUse) {
      case 'Kopf1':
        alert('Du hast auf den Kopf geklickt!');
        break;
      case 'Bein-links':
        alert('Du hast auf das linke Bein geklickt!');
        break;
      case 'Bein-rechts':
        alert('Du hast auf das rechte Bein geklickt!');
        break;
      case 'Main-Body':
        alert('Du hast auf den Körper geklickt!');
        break;
      case 'Arm-rechts':
        alert('Du hast auf den rechten Arm geklickt!');
        break;
      default:
        alert(`Kein spezielles Verhalten für ${nameToUse}`);
    }
  } else {
    console.log('No intersection found');
  }
});
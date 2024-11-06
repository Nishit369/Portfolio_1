import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { AnimationMixer } from "three";

/**
 * Base
 */
const canvas = document.querySelector("canvas.webgl");
const scene = new THREE.Scene();
const gltfLoader = new GLTFLoader();

// const ambientLight = new THREE.AmbientLight(0xffffff, 1);
// scene.add(ambientLight);

/**
 * Sizes
 */
const modelContainer = document.querySelector(".model-container");

const sizes = {
  width: modelContainer.clientWidth,
  height: modelContainer.clientHeight,
};

const updateSizes = () => {
  sizes.width = modelContainer.clientWidth;
  sizes.height = modelContainer.clientHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
};

window.addEventListener("resize", updateSizes);

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(
  30,
  sizes.width / sizes.height,
  0.1,
  1000
);
camera.position.set(0, 1.2, 2.5);
scene.add(camera);

/**
 * Controls
 */
const controls = new OrbitControls(camera, canvas);
Object.assign(controls, {
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 2,
  maxDistance: 3,
  minPolarAngle: Math.PI / 2.5,
  maxPolarAngle: Math.PI / 1.7,
  minAzimuthAngle: -Math.PI / 6,
  maxAzimuthAngle: Math.PI / 6,
});
controls.target.set(0, 0.8, 0);
controls.update();

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});

renderer.setClearColor("#1d1f2a", 0);
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

/**
 * Material
 */
const random2D = `float random2D(vec2 value)
{
    return fract(sin(dot(value.xy, vec2(12.9898,78.233))) * 43758.5453123);
}`;

const material = new THREE.ShaderMaterial({
  vertexShader: `
    uniform float uTime;
varying vec3 vPosition;
varying vec3 vNormal;

#include <common>
#include <skinning_pars_vertex>
${random2D}

void main() {
    #include <skinbase_vertex>
    #include <begin_vertex>
    #include <skinning_vertex>

    // Position
    vec4 modelPosition = modelMatrix * vec4(transformed, 1.0);

    // Glitch
    float glitchTime = uTime - modelPosition.y;
    float glitchStrength = sin(glitchTime) + sin(glitchTime * 3.45) + 
    sin(glitchTime * 8.76);
    glitchStrength /= 3.0;
    glitchStrength = smoothstep(0.3, 1.0, glitchStrength);
    glitchStrength *= 0.25;
    modelPosition.x += (random2D(modelPosition.xz + uTime) - 0.5) * glitchStrength;
    modelPosition.z += (random2D(modelPosition.zx + uTime) - 0.5) * glitchStrength;

    // Final position
    gl_Position = projectionMatrix * viewMatrix * modelPosition;

    // Model normal
    vec4 modelNormal = modelMatrix * vec4(transformed, 0.0);

    // Varyings
    vPosition = modelPosition.xyz;
    vNormal = modelNormal.xyz;
}
  `,

  fragmentShader: `
    uniform vec3 uColor;
uniform float uTime;
uniform float uOpacity;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
    // Normal
    vec3 normal = normalize(vNormal);
    if(!gl_FrontFacing)
        normal *= -1.0;

    // Stripes
    float stripes = mod((vPosition.y - uTime * 0.02) * 20.0, 1.0);
    stripes = pow(stripes, 3.0);

    // Fresnel
    vec3 viewDirection = normalize(vPosition - cameraPosition);
    float fresnel = dot(viewDirection, normal) + 1.0;
    fresnel = pow(fresnel, 2.0);

    // Falloff
    float falloff = smoothstep(0.8, 0.2, fresnel);

    // Holographic
    float holographic = stripes * fresnel;
    holographic += fresnel * 1.25;
    holographic *= falloff;
    
    // Apply base opacity
    holographic *= uOpacity;

    // Final color with proper alpha handling
    vec4 finalColor = vec4(uColor, holographic);
    
    // Ensure proper depth sorting
    if(finalColor.a < 0.01) discard;
    
    gl_FragColor = finalColor;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`,

  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color("#70c1ff") },
    uOpacity: { value: 2 },
  },
  transparent: true,
  side: THREE.DoubleSide,
  depthWrite: true,
  blending: THREE.AdditiveBlending,
});

/**
 * Model loading
 */
let mixer = null;

gltfLoader.load(
  "/Nishit.glb",
  (gltf) => {
    // Model successfully loaded
    const model = gltf.scene;
    const bbox = new THREE.Box3().setFromObject(model);
    const height = bbox.max.y - bbox.min.y;
    model.position.set(0, -height / 4, 1.15);
    model.position.y -= 0.1;
    model.rotation.y += 0.1;
    model.rotation.x += 0.2;
    controls.enabled = false;

    // Setting up clipping plane
    const clipPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), height / 3);
    material.clippingPlanes = [clipPlane];
    renderer.localClippingEnabled = true;

    // Handling animations if available
    if (gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
    }

    // Apply the material and render order to all meshes within the model
    model.traverse((child) => {
      if (child.isMesh) {
        child.material = material;
        child.renderOrder = 1;
      }
    });

    // Adding the model to the scene
    scene.add(model);
    console.log("Model loaded successfully.");
  },
  (xhr) => {
    // Loading progress
    console.log(`Model loading: ${(xhr.loaded / xhr.total) * 100}% loaded`);
  },
  (error) => {
    // Error occurred while loading
    console.error("An error happened while loading the model:", error);
  }
);

/**
 * Animation
 */
const clock = new THREE.Clock();
const tick = () => {
  const elapsedTime = clock.getElapsedTime();
  material.uniforms.uTime.value = elapsedTime;
  if (mixer) mixer.update(0.01);
  controls.update();
  renderer.render(scene, camera);
  window.requestAnimationFrame(tick);
};

tick();

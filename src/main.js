import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {PointerLockControls} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/PointerLockControls.js';
import {World} from './world.js';

const canvas=document.querySelector('#game');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x87ceeb);
scene.fog=new THREE.Fog(0x87ceeb,35,90);
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,150);
camera.position.set(0,5,8);

const controls=new PointerLockControls(camera,canvas);
const world=new World(scene);

const keys=new Set();
let velocityY=0, grounded=false;
const clock=new THREE.Clock();

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight,false)});
addEventListener('keydown',e=>{keys.add(e.code);if(e.code.startsWith('Digit')){const n=+e.code.slice(5);document.querySelectorAll('.slot').forEach((x,i)=>x.classList.toggle('selected',i===n-1))}});
addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('click',()=>controls.lock());

function update(dt){
  const speed=5;
  const dir=new THREE.Vector3((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),0,(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0));
  if(dir.lengthSq())dir.normalize();
  const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
  const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
  camera.position.addScaledVector(forward,dir.z*speed*dt);
  camera.position.addScaledVector(right,dir.x*speed*dt);
  velocityY-=18*dt; camera.position.y+=velocityY*dt;
  const floor=world.heightAt(camera.position.x,camera.position.z)+1.62;
  if(camera.position.y<=floor){camera.position.y=floor;velocityY=0;grounded=true}else grounded=false;
  if(keys.has('Space')&&grounded){velocityY=7;grounded=false}
  camera.position.x=Math.max(-31,Math.min(31,camera.position.x));
  camera.position.z=Math.max(-31,Math.min(31,camera.position.z));
}
function loop(){requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.05);if(controls.isLocked)update(dt);renderer.render(scene,camera)}
loop();
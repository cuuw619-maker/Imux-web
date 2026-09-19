import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import {PointerLockControls} from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/PointerLockControls.js";
import {World} from "./world.js";
import {HOTBAR,textureUrl} from "./blocks.js";

const canvas=document.querySelector("#game");
const help=document.querySelector("#help");
const targetLabel=document.querySelector("#target");
const slots=[...document.querySelectorAll(".slot")];

const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x87ceeb);

const panoramaUrls=[
  "lakeside_sunset_panorama_0.png",
  "lakeside_sunset_panorama_1.png",
  "lakeside_sunset_panorama_2.png",
  "lakeside_sunset_panorama_3.png",
  "lakeside_sunset_panorama_4.png",
  "lakeside_sunset_panorama_5.png"
].map(name=>new URL(`../${name}`,import.meta.url).href);

new THREE.CubeTextureLoader().load(panoramaUrls,texture=>{
  texture.colorSpace=THREE.SRGBColorSpace;
  scene.background=texture;
});

const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,150);
const controls=new PointerLockControls(camera,canvas);
const world=new World(scene);

camera.position.set(.5,world.heightAt(.5,.5)+1.67,.5);

const keys=new Set();
const raycaster=new THREE.Raycaster();
raycaster.far=8;
let velocityY=0;
let grounded=false;
let selected=0;
let lastLooking="";
const clock=new THREE.Clock();

function selectSlot(index){
  selected=(index+HOTBAR.length)%HOTBAR.length;
  slots.forEach((slot,i)=>slot.classList.toggle("selected",i===selected));
  updateTargetText();
}

slots.forEach((slot,i)=>{
  slot.style.backgroundImage=`url("${textureUrl(HOTBAR[i])}")`;
});

function updateTargetText(looking=lastLooking){
  targetLabel.textContent=`selected: ${HOTBAR[selected]} | looking: ${looking||"air"}`;
}

selectSlot(0);

addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight,false);
});

addEventListener("keydown",event=>{
  if(event.code==="Space")event.preventDefault();
  keys.add(event.code);

  if(event.code.startsWith("Digit")){
    const n=Number(event.code.slice(5));
    if(n>=1&&n<=9)selectSlot(n-1);
  }
  if(event.code==="KeyQ")selectSlot(selected-1);
  if(event.code==="KeyE")selectSlot(selected+1);
});

addEventListener("keyup",event=>keys.delete(event.code));

canvas.addEventListener("click",()=>controls.lock());
canvas.addEventListener("contextmenu",event=>event.preventDefault());

canvas.addEventListener("mousedown",event=>{
  if(!controls.isLocked)return;
  if(event.button===0)breakBlock();
  if(event.button===2)placeBlock();
});

controls.addEventListener("lock",()=>help.classList.add("hidden"));
controls.addEventListener("unlock",()=>help.classList.remove("hidden"));

function isInsidePlayer(x,y,z){
  const minX=camera.position.x-.3,maxX=camera.position.x+.3;
  const minY=camera.position.y-1.62,maxY=camera.position.y+.18;
  const minZ=camera.position.z-.3,maxZ=camera.position.z+.3;
  return x<maxX&&x+1>minX&&y<maxY&&y+1>minY&&z<maxZ&&z+1>minZ;
}

function centerHit(){
  raycaster.setFromCamera({x:0,y:0},camera);
  return raycaster.intersectObjects(Object.values(world.meshes),false)[0]??null;
}

function breakBlock(){
  const hit=centerHit();
  const block=hit&&world.blockFromHit(hit);
  if(block)world.removeBlock(block.x,block.y,block.z);
}

function placeBlock(){
  const hit=centerHit();
  if(!hit?.face)return;

  const block=world.blockFromHit(hit);
  if(!block)return;

  const normal=hit.face.normal;
  const x=block.x+Math.round(normal.x);
  const y=block.y+Math.round(normal.y);
  const z=block.z+Math.round(normal.z);

  if(isInsidePlayer(x,y,z))return;
  world.placeBlock(x,y,z,HOTBAR[selected]);
}

function updateTarget(){
  const hit=centerHit();
  const block=hit&&world.blockFromHit(hit);
  lastLooking=block?world.get(block.x,block.y,block.z):"";
  updateTargetText();
}

function update(dt){
  const speed=5.2;
  const dir=new THREE.Vector3(
    (keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0),
    0,
    (keys.has("KeyS")?1:0)-(keys.has("KeyW")?1:0)
  );

  if(dir.lengthSq())dir.normalize();

  const forward=new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y=0;
  if(forward.lengthSq())forward.normalize();

  const right=new THREE.Vector3().crossVectors(
    forward,new THREE.Vector3(0,1,0)
  ).normalize();

  camera.position.addScaledVector(forward,dir.z*speed*dt);
  camera.position.addScaledVector(right,dir.x*speed*dt);

  velocityY-=18*dt;
  camera.position.y+=velocityY*dt;

  const floor=world.heightAt(camera.position.x,camera.position.z)+1.67;
  if(camera.position.y<=floor){
    camera.position.y=floor;
    velocityY=0;
    grounded=true;
  }else{
    grounded=false;
  }

  if(keys.has("Space")&&grounded){
    velocityY=7;
    grounded=false;
  }

  const limit=31.5;
  camera.position.x=Math.max(-limit,Math.min(limit,camera.position.x));
  camera.position.z=Math.max(-limit,Math.min(limit,camera.position.z));

  updateTarget();
}

function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),.05);
  if(controls.isLocked)update(dt);
  renderer.render(scene,camera);
}

loop();
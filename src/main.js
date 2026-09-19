import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import {PointerLockControls} from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/PointerLockControls.js";
import {textureUrl} from "./blocks.js";
import {World} from "./world.js";

const canvas=document.querySelector("#game");
const help=document.querySelector("#help");
const targetLabel=document.querySelector("#target");
const menu=document.querySelector("#menu");
const menuOverlay=document.querySelector("#menu-overlay");
const playButton=document.querySelector("#play");
const inventoryPanel=document.querySelector("#inventory");
const inventorySlots=document.querySelector("#inventory-slots");
const slots=[...document.querySelectorAll(".slot")];
const hungerIcons=[...document.querySelectorAll(".hunger-icon")];
const attackIndicator=document.querySelector("#attack-indicator");
const attackProgress=document.querySelector("#attack-progress");
const attackFull=document.querySelector("#attack-full");

const renderer=new THREE.WebGLRenderer({
  canvas,
  antialias:false,
  powerPreference:"high-performance"
});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;

const scene=new THREE.Scene();
scene.background=null;

const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,180);
const controls=new PointerLockControls(camera,canvas);
controls.minPolarAngle=.01;
controls.maxPolarAngle=Math.PI-.01;

const world=new World(scene);
world.updateAround(0,0);

const PLAYER_RADIUS=.30;
const PLAYER_HEIGHT=1.80;
const EYE_HEIGHT=1.62;
const SNEAK_HEIGHT=1.50;
const SNEAK_EYE_HEIGHT=1.27;
const WALK_SPEED=4.317;
const SPRINT_SPEED=5.612;
const SNEAK_SPEED=1.295;
const JUMP_SPEED=8.0;
const GRAVITY=32.0;
const STEP_HEIGHT=.6;
const GROUND_ACCELERATION=50;
const AIR_ACCELERATION=12;
const GROUND_FRICTION=12;
const AIR_FRICTION=1.5;
const WORLD_LIMIT=1024;

camera.position.set(.5,world.surfaceAt(.5,.5)+EYE_HEIGHT+.01,.5);
let velocityY=0;
let horizontalVelocity=new THREE.Vector3();
let grounded=true;
let sneaking=false;
let sprinting=false;
let wasSpaceDown=false;

const menuScene=new THREE.Scene();
const menuCamera=new THREE.PerspectiveCamera(100,innerWidth/innerHeight,.1,100);
menuCamera.position.set(0,0,0);
menuCamera.rotation.order="YXZ";

const textureLoader=new THREE.TextureLoader();
const textureRoot=new URL("../assets/minecraft/textures/",import.meta.url);

const loadUITexture=path=>{
  const t=textureLoader.load(new URL(path,textureRoot).href);
  t.colorSpace=THREE.SRGBColorSpace;
  t.magFilter=THREE.LinearFilter;
  t.minFilter=THREE.LinearFilter;
  return t;
};

// BoxGeometry material order:
// +X, -X, +Y, -Y, +Z, -Z.
// With South = +Z the requested mapping is:
// 0=South(+Z), 1=West(-X), 2=North(-Z),
// 3=East(+X), 4=Up(+Y), 5=Down(-Y).
const panoramaFiles=[
  "gui/title/background/lakeside_sunset_panorama_3.png", // +X = East / Left
  "gui/title/background/lakeside_sunset_panorama_1.png", // -X = West / Right
  "gui/title/background/lakeside_sunset_panorama_4.png", // +Y = Up
  "gui/title/background/lakeside_sunset_panorama_5.png", // -Y = Down
  "gui/title/background/lakeside_sunset_panorama_0.png", // +Z = South / Front
  "gui/title/background/lakeside_sunset_panorama_2.png"  // -Z = North / Back
];

const panoramaMaterials=panoramaFiles.map(path=>new THREE.MeshBasicMaterial({
  map:loadUITexture(path),
  side:THREE.BackSide,
  depthWrite:false
}));

const panoramaCube=new THREE.Mesh(
  new THREE.BoxGeometry(2,2,2),
  panoramaMaterials
);
panoramaCube.scale.setScalar(40);
menuScene.add(panoramaCube);

menuOverlay.style.backgroundImage=
  `url("${new URL(
    "gui/title/background/lakeside_sunset_panorama_overlay.png",
    textureRoot
  ).href}")`;

const sky=makeSky();
scene.add(sky);

const keys=new Set();
const raycaster=new THREE.Raycaster();
raycaster.far=7.5;
const inventory=new Array(36).fill(null);

let selected=0;
let lastLooking="";
let menuOpen=true;
let inventoryOpen=false;
let hunger=20;
let hungerEffect=false;
let attackEnd=0;
let attackFlashEnd=0;
let lastChunkX=Infinity;
let lastChunkZ=Infinity;

const clock=new THREE.Clock();
const forward=new THREE.Vector3();
const right=new THREE.Vector3();
const wish=new THREE.Vector3();

function makeSky(){
  const geometry=new THREE.SphereGeometry(100,32,16);
  const material=new THREE.ShaderMaterial({
    side:THREE.BackSide,
    depthWrite:false,
    uniforms:{
      topColor:{value:new THREE.Color(0x4b93d1)},
      horizonColor:{value:new THREE.Color(0xe4f5ff)},
      sunColor:{value:new THREE.Color(0xfff0bd)},
      sunDirection:{value:new THREE.Vector3(-.35,.72,-.45).normalize()}
    },
    vertexShader:`
      varying vec3 vDirection;
      void main(){
        vec4 worldPosition=modelMatrix*vec4(position,1.0);
        vDirection=normalize(worldPosition.xyz-cameraPosition);
        gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
      }
    `,
    fragmentShader:`
      varying vec3 vDirection;
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      void main(){
        float h=clamp(vDirection.y*.5+.5,0.0,1.0);
        vec3 color=mix(horizonColor,topColor,pow(h,.72));
        float sun=max(dot(vDirection,sunDirection),0.0);
        color+=sunColor*pow(sun,180.0)*1.4;
        color+=sunColor*pow(sun,20.0)*.12;
        gl_FragColor=vec4(color,1.0);
      }
    `
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.frustumCulled=false;
  return mesh;
}

function setMenu(open){
  menuOpen=open;
  menu.classList.toggle("hidden",!open);
  help.classList.toggle("hidden",open||inventoryOpen);
  if(open){
    controls.unlock();
  }else{
    controls.lock();
  }
}

function setInventory(open){
  inventoryOpen=open;
  inventoryPanel.classList.toggle("hidden",!open);
  help.classList.toggle("hidden",open||menuOpen);
  if(open){
    controls.unlock();
  }else if(!menuOpen){
    controls.lock();
  }
}

function hotbarItem(index){
  return inventory[27+index];
}

function renderHotbar(){
  slots.forEach((slot,i)=>{
    const item=hotbarItem(i);
    slot.style.backgroundImage=item?
      `url("${textureUrl(item.type)}")`:"none";
    slot.classList.toggle("filled",!!item);
    slot.classList.toggle("selected",i===selected);
  });
}

function buildInventorySlots(){
  inventorySlots.innerHTML="";

  for(let i=0;i<36;i++){
    const slot=document.createElement("div");
    slot.className="inventory-slot";

    const row=i<27?Math.floor(i/9):3;
    const column=i%9;

    slot.style.left=`${8+column*18}px`;
    slot.style.top=`${18+row*18}px`;

    const count=document.createElement("span");
    count.className="item-count";
    slot.append(count);
    inventorySlots.append(slot);
  }
}

function renderInventory(){
  [...inventorySlots.children].forEach((slot,i)=>{
    const item=inventory[i];
    slot.style.backgroundImage=item?
      `url("${textureUrl(item.type)}")`:"none";
    slot.querySelector(".item-count").textContent=
      item&&item.count>1?String(item.count):"";
  });
  renderHotbar();
}

function selectSlot(index){
  selected=(index+9)%9;
  renderHotbar();
  updateTargetText();
}

function nextSlot(direction){
  selected=(selected+direction+9)%9;
  renderHotbar();
  updateTargetText();
}

function addItem(type){
  const existing=inventory.find(item=>item?.type===type);
  if(existing){
    existing.count++;
    renderInventory();
    return true;
  }

  const hotbarEmpty=inventory.findIndex((item,i)=>i>=27&&!item);
  const index=hotbarEmpty>=0?hotbarEmpty:inventory.findIndex(item=>!item);
  if(index<0)return false;

  inventory[index]={type,count:1};
  renderInventory();
  return true;
}

function removeSelected(){
  const index=27+selected;
  const item=inventory[index];
  if(!item)return false;

  item.count--;
  if(item.count<=0)inventory[index]=null;
  renderInventory();
  return true;
}

function updateTargetText(looking=lastLooking){
  targetLabel.textContent=
    `selected: ${hotbarItem(selected)?.type??"empty"} | looking: ${looking||"air"}`;
}

function hitBlock(){
  raycaster.setFromCamera({x:0,y:0},camera);
  return raycaster.intersectObjects(world.raycastObjects,false)[0]??null;
}

function startAttack(){
  const now=performance.now();
  attackEnd=now+260;
  attackFlashEnd=attackEnd+90;
  attackIndicator.classList.remove("hidden");
  attackFull.classList.add("hidden");
}

function updateAttack(){
  const now=performance.now();

  if(now<attackEnd){
    const p=1-(attackEnd-now)/260;
    attackProgress.style.clipPath=
      `inset(${(1-p)*100}% 0 0 0)`;
    return;
  }

  attackProgress.style.clipPath="inset(100% 0 0 0)";

  if(now<attackFlashEnd){
    attackFull.classList.remove("hidden");
    return;
  }

  attackFull.classList.add("hidden");
  attackIndicator.classList.add("hidden");
}

function breakBlock(){
  startAttack();

  const hit=hitBlock();
  const block=hit&&world.blockFromHit(hit);
  if(!block)return;

  const type=world.get(block.x,block.y,block.z);
  if(!type)return;

  if(world.removeBlock(block.x,block.y,block.z)){
    addItem(type);
  }
}

function playerAABB(x=camera.position.x,y=camera.position.y,z=camera.position.z){
  const eye=sneaking?SNEAK_EYE_HEIGHT:EYE_HEIGHT;
  const height=sneaking?SNEAK_HEIGHT:PLAYER_HEIGHT;

  return {
    minX:x-PLAYER_RADIUS,
    maxX:x+PLAYER_RADIUS,
    minY:y-eye,
    maxY:y-eye+height,
    minZ:z-PLAYER_RADIUS,
    maxZ:z+PLAYER_RADIUS
  };
}

function overlapsPlayer(x,y,z,type){
  const box=playerAABB();
  const h=world.blockHeight(type);
  return x<box.maxX&&x+1>box.minX&&
         y<box.maxY&&y+h>box.minY&&
         z<box.maxZ&&z+1>box.minZ;
}

function placeBlock(){
  const item=hotbarItem(selected);
  const hit=hitBlock();
  if(!item||!hit?.face)return;

  const block=world.blockFromHit(hit);
  if(!block)return;

  const normal=hit.face.normal;
  const x=block.x+Math.round(normal.x);
  const y=block.y+Math.round(normal.y);
  const z=block.z+Math.round(normal.z);

  if(overlapsPlayer(x,y,z,item.type))return;
  if(world.placeBlock(x,y,z,item.type)){
    removeSelected();
  }
}

function updateTarget(){
  const hit=hitBlock();
  const block=hit&&world.blockFromHit(hit);
  lastLooking=block?world.get(block.x,block.y,block.z):"";
  updateTargetText();
}

function collides(){
  const eye=sneaking?SNEAK_EYE_HEIGHT:EYE_HEIGHT;
  const height=sneaking?SNEAK_HEIGHT:PLAYER_HEIGHT;
  return world.collidesPlayer(
    camera.position.x,
    camera.position.y,
    camera.position.z,
    PLAYER_RADIUS,
    eye,
    height
  );
}

function tryMoveAxis(delta,axis){
  if(!delta)return;

  const old=camera.position[axis];
  camera.position[axis]=THREE.MathUtils.clamp(
    old+delta,-WORLD_LIMIT,WORLD_LIMIT
  );

  if(!collides())return;

  camera.position[axis]=old;

  if(!grounded)return;

  const oldY=camera.position.y;
  camera.position.y+=STEP_HEIGHT;

  if(collides()){
    camera.position.y=oldY;
    return;
  }

  camera.position[axis]=THREE.MathUtils.clamp(
    old+delta,-WORLD_LIMIT,WORLD_LIMIT
  );

  if(collides()){
    camera.position[axis]=old;
    camera.position.y=oldY;
  }
}

function moveVertical(distance){
  if(!distance)return;

  const oldY=camera.position.y;
  camera.position.y=oldY+distance;

  if(!collides())return false;

  let lo,hi;

  if(distance<0){
    lo=camera.position.y;
    hi=oldY;

    for(let i=0;i<14;i++){
      const mid=(lo+hi)*.5;
      camera.position.y=mid;
      if(collides())lo=mid;
      else hi=mid;
    }

    camera.position.y=hi;
    grounded=true;
  }else{
    lo=oldY;
    hi=camera.position.y;

    for(let i=0;i<14;i++){
      const mid=(lo+hi)*.5;
      camera.position.y=mid;
      if(collides())hi=mid;
      else lo=mid;
    }

    camera.position.y=lo;
  }

  velocityY=0;
  return true;
}

function updatePlayer(dt){
  sneaking=keys.has("ControlLeft")||keys.has("ControlRight");
  sprinting=!sneaking&&
    (keys.has("ShiftLeft")||keys.has("ShiftRight"))&&
    (keys.has("KeyW")||keys.has("KeyS")||keys.has("KeyA")||keys.has("KeyD"));

  const speed=sneaking?SNEAK_SPEED:(sprinting?SPRINT_SPEED:WALK_SPEED);
  const acceleration=grounded?GROUND_ACCELERATION:AIR_ACCELERATION;

  const inputX=(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0);
  const inputZ=(keys.has("KeyW")?1:0)-(keys.has("KeyS")?1:0);

  wish.set(inputX,0,inputZ);
  if(wish.lengthSq()>1)wish.normalize();

  camera.getWorldDirection(forward);
  forward.y=0;
  if(forward.lengthSq())forward.normalize();

  right.crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();

  const targetX=
    (right.x*wish.x+forward.x*wish.z)*speed;
  const targetZ=
    (right.z*wish.x+forward.z*wish.z)*speed;

  horizontalVelocity.x+=THREE.MathUtils.clamp(
    targetX-horizontalVelocity.x,
    -acceleration*dt,
    acceleration*dt
  );
  horizontalVelocity.z+=THREE.MathUtils.clamp(
    targetZ-horizontalVelocity.z,
    -acceleration*dt,
    acceleration*dt
  );

  if(wish.lengthSq()===0){
    const friction=grounded?GROUND_FRICTION:AIR_FRICTION;
    const factor=Math.max(0,1-friction*dt);
    horizontalVelocity.x*=factor;
    horizontalVelocity.z*=factor;
  }

  tryMoveAxis(horizontalVelocity.x*dt,"x");
  tryMoveAxis(horizontalVelocity.z*dt,"z");

  const spaceDown=keys.has("Space");
  if(spaceDown&&!wasSpaceDown&&grounded){
    velocityY=JUMP_SPEED;
    grounded=false;
  }
  wasSpaceDown=spaceDown;

  velocityY-=GRAVITY*dt;
  if(!moveVertical(velocityY*dt)){
    grounded=false;
  }

  world.updateAround(camera.position.x,camera.position.z);
  sky.position.copy(camera.position);
  updateTarget();
}

function updateHunger(){
  hungerIcons.forEach((icon,i)=>{
    const value=hunger-i*2;
    let image="food_empty.png";

    if(value>=2){
      image=hungerEffect?
        "food_full_hunger.png":"food_full.png";
    }else if(value===1){
      image=hungerEffect?
        "food_half_hunger.png":"food_half.png";
    }

    icon.style.backgroundImage=
      `url("${new URL("gui/"+image,textureRoot).href}")`;
  });
}

function animateMenu(){
  const seconds=performance.now()/1000;
  const angle=THREE.MathUtils.degToRad(seconds*2.4);

  menuCamera.rotation.x=-THREE.MathUtils.degToRad(8);
  menuCamera.rotation.y=Math.PI+angle;
  menuCamera.rotation.z=0;
}

addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  menuCamera.aspect=innerWidth/innerHeight;
  menuCamera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight,false);
});

addEventListener("keydown",event=>{
  if(event.code==="Space")event.preventDefault();

  if(event.code==="KeyE"){
    event.preventDefault();
    if(!menuOpen)setInventory(!inventoryOpen);
    return;
  }

  keys.add(event.code);

  if(!inventoryOpen){
    const digit=event.code.match(/^Digit([1-9])$/);
    if(digit)selectSlot(Number(digit[1])-1);
  }
});

addEventListener("keyup",event=>keys.delete(event.code));

canvas.addEventListener("click",()=>{
  if(!menuOpen&&!inventoryOpen)controls.lock();
});

canvas.addEventListener("contextmenu",event=>event.preventDefault());

canvas.addEventListener("mousedown",event=>{
  if(!controls.isLocked||menuOpen||inventoryOpen)return;
  if(event.button===0)breakBlock();
  if(event.button===2)placeBlock();
});

canvas.addEventListener("wheel",event=>{
  if(!controls.isLocked||menuOpen||inventoryOpen)return;
  event.preventDefault();
  nextSlot(event.deltaY>0?1:-1);
},{passive:false});

controls.addEventListener("lock",()=>{
  if(!menuOpen&&!inventoryOpen)help.classList.add("hidden");
  keys.clear();
});

controls.addEventListener("unlock",()=>{
  if(!menuOpen&&!inventoryOpen)help.classList.remove("hidden");
  keys.clear();
});

playButton.addEventListener("click",()=>setMenu(false));

buildInventorySlots();
renderInventory();
updateHunger();
updateTargetText();
setMenu(true);

function renderLoop(){
  requestAnimationFrame(renderLoop);

  const dt=Math.min(clock.getDelta(),.05);
  updateAttack();

  if(menuOpen){
    animateMenu();
    renderer.render(menuScene,menuCamera);
    return;
  }

  if(controls.isLocked&&!inventoryOpen){
    updatePlayer(dt);
  }

  sky.position.copy(camera.position);
  renderer.render(scene,camera);
}

renderLoop();
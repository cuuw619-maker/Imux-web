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
const tuningPanel=document.querySelector("#tuning");
const tuningStatus=document.querySelector("#tuning-status");
const tuningInputs=[...document.querySelectorAll("[data-tune]")];
const tuningReset=document.querySelector("#tuning-reset");

const autoGuiScale=THREE.MathUtils.clamp(
  Math.min(Math.floor(innerWidth/320),Math.floor(innerHeight/240)),
  1,
  4
);

const T={
  renderScale:1,
  guiScale:autoGuiScale,
  gameFov:75,
  menuFov:100,
  menuPitch:-25,
  menuSpeed:2.4,
  playerRadius:.30,
  playerHeight:1.80,
  eyeHeight:1.62,
  sneakHeight:1.50,
  sneakEyeHeight:1.27,
  stepHeight:.60,
  reach:7.5
};

try{
  Object.assign(T,JSON.parse(localStorage.getItem("imux:tuning")||"{}"));
}catch{}

const tuneLimits={
  renderScale:[.5,2],
  guiScale:[1,4],
  gameFov:[50,110],
  menuFov:[75,120],
  menuPitch:[-45,-5],
  menuSpeed:[0,5],
  playerRadius:[.10,.50],
  playerHeight:[1,2.5],
  eyeHeight:[.6,2.2],
  sneakHeight:[.8,2],
  sneakEyeHeight:[.6,1.7],
  stepHeight:[0,1],
  reach:[2,12]
};

for(const [key,[min,max]] of Object.entries(tuneLimits)){
  const value=Number(T[key]);
  T[key]=THREE.MathUtils.clamp(Number.isFinite(value)?value:min,min,max);
}

const renderer=new THREE.WebGLRenderer({
  canvas,
  antialias:false,
  powerPreference:"high-performance"
});
renderer.setPixelRatio(Math.min(devicePixelRatio*T.renderScale,3));
renderer.setSize(innerWidth,innerHeight,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;

const scene=new THREE.Scene();
scene.background=null;

const camera=new THREE.PerspectiveCamera(T.gameFov,innerWidth/innerHeight,.05,180);
const controls=new PointerLockControls(camera,canvas);
controls.minPolarAngle=.01;
controls.maxPolarAngle=Math.PI-.01;

const world=new World(scene);
world.updateAround(0,0);

const WALK_SPEED=4.317;
const SPRINT_SPEED=5.612;
const SNEAK_SPEED=1.295;
const JUMP_SPEED=8.0;
const GRAVITY=32.0;
const GROUND_ACCELERATION=50;
const AIR_ACCELERATION=12;
const GROUND_FRICTION=12;
const AIR_FRICTION=1.5;
const WORLD_LIMIT=8192;

camera.position.set(.5,world.surfaceAt(.5,.5)+T.eyeHeight+.01,.5);
let velocityY=0;
let horizontalVelocity=new THREE.Vector3();
let grounded=true;
let sneaking=false;
let sprinting=false;
let wasSpaceDown=false;

const menuScene=new THREE.Scene();
const menuCamera=new THREE.PerspectiveCamera(T.menuFov,innerWidth/innerHeight,.1,200);
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

// THREE.BoxGeometry material order:
// [ +X, -X, +Y, -Y, +Z, -Z ].
//
// Imux 1.20+/1.21+ panorama files:
// _0 South, _1 West, _2 North, _3 East, _4 Up, _5 Down.
//
// Exact cubemap binding:
// +X <- West(_1)
// -X <- East(_3)
// +Y <- Up(_4)
// -Y <- Down(_5)
// +Z <- South(_0)
// -Z <- North(_2)
//
// The camera is inside the cube. Do not mirror the source images.
// Mirroring here was the previous source of the scrambled orientation.
const panoramaFiles=[
  "gui/title/background/lakeside_sunset_panorama_1.png",
  "gui/title/background/lakeside_sunset_panorama_3.png",
  "gui/title/background/lakeside_sunset_panorama_4.png",
  "gui/title/background/lakeside_sunset_panorama_5.png",
  "gui/title/background/lakeside_sunset_panorama_0.png",
  "gui/title/background/lakeside_sunset_panorama_2.png"
];

const panoramaMaterials=panoramaFiles.map(path=>new THREE.MeshBasicMaterial({
  map:loadUITexture(path),
  side:THREE.BackSide,
  depthWrite:false,
  toneMapped:false
}));

const panoramaCube=new THREE.Mesh(
  new THREE.BoxGeometry(2,2,2),
  panoramaMaterials
);
panoramaCube.scale.setScalar(80);
panoramaCube.frustumCulled=false;
menuScene.add(panoramaCube);

menuOverlay.style.backgroundImage=
  `url("${new URL(
    "gui/title/background/lakeside_sunset_panorama_overlay.png",
    textureRoot
  ).href}")`;

const sky=makeSky();
scene.add(sky);

function updateGuiScale(){
  document.documentElement.style.setProperty("--gui-scale",String(T.guiScale));
}

const keys=new Set();
const raycaster=new THREE.Raycaster();
raycaster.far=T.reach;
const inventory=new Array(36).fill(null);

let selected=0;
let lastLooking="";
let menuOpen=true;
let inventoryOpen=false;
let hunger=20;
let hungerEffect=false;
let attackEnd=0;
let attackFlashEnd=0;
let tuningOpen=false;
let hitboxHelper=null;
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
  help.classList.toggle("hidden",open||inventoryOpen||tuningOpen);
  if(open){
    controls.unlock();
  }else if(!tuningOpen){
    controls.lock();
  }
}

function setInventory(open){
  inventoryOpen=open;
  inventoryPanel.classList.toggle("hidden",!open);
  help.classList.toggle("hidden",open||menuOpen||tuningOpen);
  if(open){
    controls.unlock();
  }else if(!menuOpen&&!tuningOpen){
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

    const column=i%9;
    const row=i<27?Math.floor(i/9):0;
    const left=8+column*18;
    const top=i<27?84+row*18:142;

    slot.style.left=`${left}px`;
    slot.style.top=`${top}px`;

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
  const eye=sneaking?T.sneakEyeHeight:T.eyeHeight;
  const height=sneaking?T.sneakHeight:T.playerHeight;

  return {
    minX:x-T.playerRadius,
    maxX:x+T.playerRadius,
    minY:y-eye,
    maxY:y-eye+height,
    minZ:z-T.playerRadius,
    maxZ:z+T.playerRadius
  };
}

function removeHitboxHelper(){
  if(!hitboxHelper)return;
  scene.remove(hitboxHelper);
  hitboxHelper.geometry.dispose();
  hitboxHelper.material.dispose();
  hitboxHelper=null;
}

function updateHitboxHelper(){
  if(!tuningOpen){
    removeHitboxHelper();
    return;
  }

  const box=playerAABB();
  const source=new THREE.BoxGeometry(
    box.maxX-box.minX,
    box.maxY-box.minY,
    box.maxZ-box.minZ
  );
  const edges=new THREE.EdgesGeometry(source);
  source.dispose();

  removeHitboxHelper();

  hitboxHelper=new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({
      color:0xffffff,
      transparent:true,
      opacity:.8
    })
  );
  hitboxHelper.position.set(
    (box.minX+box.maxX)*.5,
    (box.minY+box.maxY)*.5,
    (box.minZ+box.maxZ)*.5
  );
  scene.add(hitboxHelper);
}

function formatTuneValue(key,value){
  return key==="guiScale"?String(Math.round(value)):value.toFixed(2);
}

function refreshTuningUI(){
  for(const input of tuningInputs){
    const key=input.dataset.tune;
    input.value=String(T[key]);
    const output=input.parentElement.querySelector("output");
    if(output)output.textContent=formatTuneValue(key,T[key]);
  }
}

function saveTuning(){
  try{
    localStorage.setItem("imux:tuning",JSON.stringify(T));
  }catch{}
}

function applyTuning(){
  camera.fov=T.gameFov;
  camera.updateProjectionMatrix();

  menuCamera.fov=T.menuFov;
  menuCamera.updateProjectionMatrix();

  raycaster.far=T.reach;
  renderer.setPixelRatio(Math.min(devicePixelRatio*T.renderScale,3));
  renderer.setSize(innerWidth,innerHeight,false);

  updateGuiScale();
  updateHitboxHelper();
}

function tuningJson(){
  return JSON.stringify({
    format:"imux-tuning-v1",
    renderer:{
      renderScale:T.renderScale,
      gameFov:T.gameFov,
      reach:T.reach
    },
    gui:{
      scale:T.guiScale
    },
    panorama:{
      fov:T.menuFov,
      pitch:T.menuPitch,
      speed:T.menuSpeed,
      yawStart:"south",
      yawDirection:"subtract"
    },
    playerHitbox:{
      radius:T.playerRadius,
      height:T.playerHeight,
      eyeHeight:T.eyeHeight,
      sneakHeight:T.sneakHeight,
      sneakEyeHeight:T.sneakEyeHeight,
      stepHeight:T.stepHeight
    }
  },null,2);
}

async function copyTuningJson(){
  const data=tuningJson();
  try{
    await navigator.clipboard.writeText(data);
    tuningStatus.textContent="JSON copied to clipboard";
  }catch{
    const area=document.createElement("textarea");
    area.value=data;
    area.style.position="fixed";
    area.style.left="-9999px";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
    tuningStatus.textContent="JSON copied to clipboard";
  }
}

function setTuning(open){
  tuningOpen=open;
  tuningPanel.classList.toggle("hidden",!open);
  help.classList.toggle("hidden",open||menuOpen||inventoryOpen);

  if(open){
    if(inventoryOpen)setInventory(false);
    controls.unlock();
    refreshTuningUI();
    updateHitboxHelper();
    tuningStatus.textContent="R close • K copy JSON";
    return;
  }

  removeHitboxHelper();

  if(!menuOpen&&!inventoryOpen){
    controls.lock();
  }
}

for(const input of tuningInputs){
  input.addEventListener("input",()=>{
    const key=input.dataset.tune;
    T[key]=Number(input.value);
    const output=input.parentElement.querySelector("output");
    if(output)output.textContent=formatTuneValue(key,T[key]);
    applyTuning();
    saveTuning();
  });
}

tuningReset.addEventListener("click",()=>{
  Object.assign(T,{
    renderScale:1,
    guiScale:autoGuiScale,
    gameFov:75,
    menuFov:100,
    menuPitch:-25,
    menuSpeed:2.4,
    playerRadius:.30,
    playerHeight:1.80,
    eyeHeight:1.62,
    sneakHeight:1.50,
    sneakEyeHeight:1.27,
    stepHeight:.60,
    reach:7.5
  });
  refreshTuningUI();
  applyTuning();
  saveTuning();
  tuningStatus.textContent="Defaults restored";
});

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
  const eye=sneaking?T.sneakEyeHeight:T.eyeHeight;
  const height=sneaking?T.sneakHeight:T.playerHeight;
  return world.collidesPlayer(
    camera.position.x,
    camera.position.y,
    camera.position.z,
    T.playerRadius,
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
  camera.position.y+=T.stepHeight;

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

function updateSneakState(wantSneak){
  if(wantSneak===sneaking)return;

  const delta=T.eyeHeight-T.sneakEyeHeight;
  const oldY=camera.position.y;

  if(wantSneak){
    camera.position.y-=delta;
    sneaking=true;

    if(collides()){
      camera.position.y=oldY;
      sneaking=false;
    }
    return;
  }

  camera.position.y+=delta;
  sneaking=false;

  if(collides()){
    camera.position.y=oldY;
    sneaking=true;
  }
}

function updatePlayer(dt){
  updateSneakState(
    grounded&&(keys.has("ControlLeft")||keys.has("ControlRight"))
  );

  sprinting=!sneaking&&
    (keys.has("ShiftLeft")||keys.has("ShiftRight"))&&
    keys.has("KeyW");

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
  const angle=THREE.MathUtils.degToRad(seconds*T.menuSpeed);
  const bob=THREE.MathUtils.degToRad(Math.sin(seconds*.55)*.75);

  // Start at South (+Z), then subtract yaw for the modern direction.
  menuCamera.rotation.x=THREE.MathUtils.degToRad(T.menuPitch)+bob;
  menuCamera.rotation.y=Math.PI-angle;
  menuCamera.rotation.z=0;
}

addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  menuCamera.aspect=innerWidth/innerHeight;
  menuCamera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight,false);
  applyTuning();
});

addEventListener("keydown",event=>{
  if(event.code==="Space")event.preventDefault();

  if(event.code==="KeyR"&&!event.repeat){
    event.preventDefault();
    if(!menuOpen)setTuning(!tuningOpen);
    return;
  }

  if(event.code==="KeyK"&&!event.repeat){
    event.preventDefault();
    copyTuningJson();
    return;
  }

  if(tuningOpen)return;

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
  if(!menuOpen&&!inventoryOpen&&!tuningOpen)help.classList.add("hidden");
  keys.clear();
});

controls.addEventListener("unlock",()=>{
  if(!menuOpen&&!inventoryOpen&&!tuningOpen)help.classList.remove("hidden");
  keys.clear();
});

playButton.addEventListener("click",()=>setMenu(false));

buildInventorySlots();
renderInventory();
updateHunger();
updateTargetText();
refreshTuningUI();
applyTuning();
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
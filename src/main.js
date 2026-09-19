import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import {PointerLockControls} from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/PointerLockControls.js";
import {textureUrl} from "./blocks.js";
import {World} from "./world.js";

const canvas=document.querySelector("#game");
const help=document.querySelector("#help");
const targetLabel=document.querySelector("#target");
const menu=document.querySelector("#menu");
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
const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,180);
const controls=new PointerLockControls(camera,canvas);
const world=new World(scene);

const PLAYER_RADIUS=.30;
const PLAYER_HEIGHT=1.80;
const EYE_HEIGHT=1.62;
const MOVE_SPEED=5.2;
const GRAVITY=18;
const JUMP_SPEED=7;
const WORLD_LIMIT=31.5;

camera.position.set(.5,world.surfaceAt(.5,.5)+EYE_HEIGHT+.03,.5);

const menuScene=new THREE.Scene();
const menuCamera=new THREE.PerspectiveCamera(100,innerWidth/innerHeight,.1,20);
menuCamera.rotation.order="YXZ";

const textureLoader=new THREE.TextureLoader();
const textureRoot=new URL("../assets/minecraft/textures/",import.meta.url);
const texture=path=>{
  const t=textureLoader.load(new URL(path,textureRoot).href);
  t.colorSpace=THREE.SRGBColorSpace;
  t.magFilter=THREE.LinearFilter;
  t.minFilter=THREE.LinearFilter;
  return t;
};

const panoramaNames=[
  "gui/title/background/lakeside_sunset_panorama_0.png",
  "gui/title/background/lakeside_sunset_panorama_1.png",
  "gui/title/background/lakeside_sunset_panorama_2.png",
  "gui/title/background/lakeside_sunset_panorama_3.png",
  "gui/title/background/lakeside_sunset_panorama_4.png",
  "gui/title/background/lakeside_sunset_panorama_5.png"
];

const panoramaMaterials=panoramaNames.map(path=>new THREE.MeshBasicMaterial({
  map:texture(path),
  side:THREE.BackSide,
  depthWrite:false
}));

const panoramaCube=new THREE.Mesh(
  new THREE.BoxGeometry(2,2,2),
  panoramaMaterials
);
panoramaCube.scale.set(7,7,7);
menuScene.add(panoramaCube);

const keys=new Set();
const raycaster=new THREE.Raycaster();
raycaster.far=7.5;
const inventory=new Array(36).fill(null);

let selected=0;
let velocityY=0;
let grounded=false;
let spaceWasDown=false;
let lastLooking="";
let menuOpen=true;
let inventoryOpen=false;
let hunger=20;
let hungerEffect=false;
let attackEnd=0;
let attackFlashEnd=0;

const clock=new THREE.Clock();

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
        float s=max(dot(vDirection,sunDirection),0.0);
        color+=sunColor*pow(s,180.0)*1.4;
        color+=sunColor*pow(s,20.0)*.12;
        gl_FragColor=vec4(color,1.0);
      }
    `
  });
  const mesh=new THREE.Mesh(geometry,material);
  mesh.frustumCulled=false;
  return mesh;
}

const sky=makeSky();
scene.add(sky);

function setMenu(open){
  menuOpen=open;
  menu.classList.toggle("hidden",!open);
  help.classList.toggle("hidden",open);
  if(open)controls.unlock();
  else controls.lock();
}

function setInventory(open){
  inventoryOpen=open;
  inventoryPanel.classList.toggle("hidden",!open);
  help.classList.toggle("hidden",open||menuOpen);
  if(open)controls.unlock();
  else if(!menuOpen)controls.lock();
}

function hotbarItem(index){
  return inventory[27+index];
}

function renderHotbar(){
  slots.forEach((slot,i)=>{
    const item=hotbarItem(i);
    slot.style.backgroundImage=item?`url("${textureUrl(item.type)}")`:"none";
    slot.classList.toggle("filled",!!item);
    slot.classList.toggle("selected",i===selected);
  });
}

function buildInventorySlots(){
  inventorySlots.innerHTML="";

  for(let i=0;i<36;i++){
    const slot=document.createElement("div");
    slot.className="inventory-slot";
    slot.dataset.index=String(i);

    if(i<27){
      const row=Math.floor(i/9);
      const column=i%9;
      slot.style.left=`${8+column*18}px`;
      slot.style.top=`${18+row*18}px`;
    }else{
      const column=i-27;
      slot.style.left=`${8+column*18}px`;
      slot.style.top="142px";
    }

    const count=document.createElement("span");
    count.className="item-count";
    slot.append(count);
    inventorySlots.append(slot);
  }
}

function renderInventory(){
  [...inventorySlots.children].forEach((slot,i)=>{
    const item=inventory[i];
    slot.style.backgroundImage=item?`url("${textureUrl(item.type)}")`:"none";
    slot.querySelector(".item-count").textContent=item&&item.count>1?String(item.count):"";
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

function canAddItem(type){
  return inventory.some(item=>item?.type===type)||inventory.some(item=>!item);
}

function addItem(type){
  const existing=inventory.find(item=>item?.type===type);
  if(existing){
    existing.count++;
    renderInventory();
    return true;
  }

  let index=inventory.findIndex((item,i)=>i>=27&&!item);
  if(index<0)index=inventory.findIndex(item=>!item);
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
  targetLabel.textContent=`selected: ${hotbarItem(selected)?.type??"empty"} | looking: ${looking||"air"}`;
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
    attackProgress.style.clipPath=`inset(${(1-p)*100}% 0 0 0)`;
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
  if(!type||!canAddItem(type))return;

  if(world.removeBlock(block.x,block.y,block.z)){
    addItem(type);
  }
}

function playerBox(){
  return {
    minX:camera.position.x-PLAYER_RADIUS,
    maxX:camera.position.x+PLAYER_RADIUS,
    minY:camera.position.y-EYE_HEIGHT,
    maxY:camera.position.y-EYE_HEIGHT+PLAYER_HEIGHT,
    minZ:camera.position.z-PLAYER_RADIUS,
    maxZ:camera.position.z+PLAYER_RADIUS
  };
}

function overlapsPlayer(x,y,z,type){
  const p=playerBox();
  const h=world.blockHeight(type);
  return x<p.maxX&&x+1>p.minX&&y<p.maxY&&y+h>p.minY&&z<p.maxZ&&z+1>p.minZ;
}

function placeBlock(){
  const item=hotbarItem(selected);
  const hit=hitBlock();
  if(!item||!hit?.face)return;

  const block=world.blockFromHit(hit);
  if(!block)return;

  const n=hit.face.normal;
  const x=block.x+Math.round(n.x);
  const y=block.y+Math.round(n.y);
  const z=block.z+Math.round(n.z);

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

function moveHorizontal(dx,dz){
  const oldX=camera.position.x;
  camera.position.x=THREE.MathUtils.clamp(
    camera.position.x+dx,-WORLD_LIMIT,WORLD_LIMIT
  );

  if(world.collidesPlayer(
    camera.position.x,camera.position.y,camera.position.z,
    PLAYER_RADIUS,EYE_HEIGHT,PLAYER_HEIGHT
  )){
    camera.position.x=oldX;
  }

  const oldZ=camera.position.z;
  camera.position.z=THREE.MathUtils.clamp(
    camera.position.z+dz,-WORLD_LIMIT,WORLD_LIMIT
  );

  if(world.collidesPlayer(
    camera.position.x,camera.position.y,camera.position.z,
    PLAYER_RADIUS,EYE_HEIGHT,PLAYER_HEIGHT
  )){
    camera.position.z=oldZ;
  }
}

function moveVertical(dy){
  const oldY=camera.position.y;
  camera.position.y=oldY+dy;

  if(!world.collidesPlayer(
    camera.position.x,camera.position.y,camera.position.z,
    PLAYER_RADIUS,EYE_HEIGHT,PLAYER_HEIGHT
  )){
    return false;
  }

  let lo,hi;

  if(dy<0){
    lo=camera.position.y;
    hi=oldY;

    for(let i=0;i<14;i++){
      const mid=(lo+hi)*.5;
      camera.position.y=mid;

      if(world.collidesPlayer(
        camera.position.x,mid,camera.position.z,
        PLAYER_RADIUS,EYE_HEIGHT,PLAYER_HEIGHT
      )){
        lo=mid;
      }else{
        hi=mid;
      }
    }

    camera.position.y=hi;
    grounded=true;
  }else{
    lo=oldY;
    hi=camera.position.y;

    for(let i=0;i<14;i++){
      const mid=(lo+hi)*.5;
      camera.position.y=mid;

      if(world.collidesPlayer(
        camera.position.x,mid,camera.position.z,
        PLAYER_RADIUS,EYE_HEIGHT,PLAYER_HEIGHT
      )){
        hi=mid;
      }else{
        lo=mid;
      }
    }

    camera.position.y=lo;
  }

  velocityY=0;
  return true;
}

function update(dt){
  const forwardInput=(keys.has("KeyW")?1:0)-(keys.has("KeyS")?1:0);
  const strafeInput=(keys.has("KeyD")?1:0)-(keys.has("KeyA")?1:0);

  const input=new THREE.Vector3(strafeInput,0,forwardInput);
  if(input.lengthSq()>1)input.normalize();

  const forward=new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y=0;
  if(forward.lengthSq())forward.normalize();

  const right=new THREE.Vector3().crossVectors(
    forward,new THREE.Vector3(0,1,0)
  ).normalize();

  moveHorizontal(
    (right.x*input.x+forward.x*input.z)*MOVE_SPEED*dt,
    (right.z*input.x+forward.z*input.z)*MOVE_SPEED*dt
  );

  const spaceDown=keys.has("Space");
  if(spaceDown&&!spaceWasDown&&grounded){
    velocityY=JUMP_SPEED;
    grounded=false;
  }
  spaceWasDown=spaceDown;

  velocityY-=GRAVITY*dt;
  const hitFloor=moveVertical(velocityY*dt);
  if(!hitFloor)grounded=false;

  sky.position.copy(camera.position);
  updateTarget();
}

function updateHunger(){
  hungerIcons.forEach((icon,i)=>{
    const value=hunger-i*2;
    let image="food_empty.png";

    if(value>=2){
      image=hungerEffect?"food_full_hunger.png":"food_full.png";
    }else if(value===1){
      image=hungerEffect?"food_half_hunger.png":"food_half.png";
    }

    icon.style.backgroundImage=`url("${new URL(
      "gui/"+image,textureRoot
    ).href}")`;
  });
}

function buildMenuOverlay(){
  const overlay=document.querySelector("#menu-overlay");
  overlay.style.backgroundImage=`url("${new URL(
    "gui/title/background/lakeside_sunset_panorama_overlay.png",
    textureRoot
  ).href}")`;
}

function animateMenu(){
  const now=performance.now();
  panoramaCube.rotation.y=now*.000025;
  panoramaCube.rotation.x=THREE.MathUtils.degToRad(
    2+Math.sin(now*.00012)*1.25
  );
  menuCamera.aspect=innerWidth/innerHeight;
  menuCamera.updateProjectionMatrix();
}

addEventListener("resize",()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  menuCamera.aspect=innerWidth/innerHeight;
  menuCamera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight,false);
});

addEventListener("keydown",event=>{
  if(event.code==="Space"){
    event.preventDefault();
  }

  if(event.code==="KeyE"){
    event.preventDefault();
    if(!menuOpen){
      setInventory(!inventoryOpen);
    }
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
});

controls.addEventListener("unlock",()=>{
  if(!menuOpen&&!inventoryOpen)help.classList.remove("hidden");
});

playButton.addEventListener("click",()=>setMenu(false));

buildInventorySlots();
renderInventory();
updateHunger();
updateTargetText();
buildMenuOverlay();
setMenu(true);

function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),.05);

  updateAttack();

  if(menuOpen){
    animateMenu();
    renderer.render(menuScene,menuCamera);
    return;
  }

  if(controls.isLocked&&!inventoryOpen)update(dt);
  sky.position.copy(camera.position);
  renderer.render(scene,camera);
}

loop();
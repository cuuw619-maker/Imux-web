import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import {PointerLockControls} from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/PointerLockControls.js";
import {HOTBAR,textureUrl} from "./blocks.js";
import {World} from "./world.js";

const canvas=document.querySelector("#game");
const help=document.querySelector("#help");
const targetLabel=document.querySelector("#target");
const menu=document.querySelector("#menu");
const playButton=document.querySelector("#play");
const slots=[...document.querySelectorAll(".slot")];

const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:"high-performance"});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight,false);
renderer.outputColorSpace=THREE.SRGBColorSpace;

const scene=new THREE.Scene();
scene.background=null;

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

camera.position.set(.5,world.heightAt(.5,.5)+1+EYE_HEIGHT+.05,.5);

const menuScene=new THREE.Scene();
const menuCamera=new THREE.PerspectiveCamera(110,innerWidth/innerHeight,.1,10);
menuCamera.rotation.order="ZYX";

const textureLoader=new THREE.TextureLoader();
const panoramaNames=[
  "lakeside_sunset_panorama_1.png",
  "lakeside_sunset_panorama_3.png",
  "lakeside_sunset_panorama_4.png",
  "lakeside_sunset_panorama_5.png",
  "lakeside_sunset_panorama_0.png",
  "lakeside_sunset_panorama_2.png"
];

const panoramaMaterials=panoramaNames.map(name=>{
  const texture=textureLoader.load(new URL(`../${name}`,import.meta.url).href);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.LinearFilter;
  texture.minFilter=THREE.LinearFilter;
  return new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide});
});

const panoramaCube=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),panoramaMaterials);
panoramaCube.scale.set(5,5,5);
panoramaCube.rotation.order="YXZ";
menuScene.add(panoramaCube);

const keys=new Set();
const raycaster=new THREE.Raycaster();
raycaster.far=8;
const inventory=Array(9).fill(null);
let selected=0;
let velocityY=0;
let grounded=false;
let spaceWasDown=false;
let lastLooking="";
let menuOpen=true;
const clock=new THREE.Clock();

function makeSky(){
  const geometry=new THREE.SphereGeometry(100,32,16);
  const material=new THREE.ShaderMaterial({
    side:THREE.BackSide,
    depthWrite:false,
    uniforms:{
      top:{value:new THREE.Color(0x4b93d1)},
      horizon:{value:new THREE.Color(0xd9f2ff)},
      sunColor:{value:new THREE.Color(0xfff1c2)},
      sunDir:{value:new THREE.Vector3(-.35,.72,-.45).normalize()}
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
      uniform vec3 top;
      uniform vec3 horizon;
      uniform vec3 sunColor;
      uniform vec3 sunDir;
      void main(){
        float h=clamp(vDirection.y*.5+.5,0.0,1.0);
        vec3 color=mix(horizon,top,pow(h,0.72));
        float sun=max(dot(vDirection,sunDir),0.0);
        color+=sunColor*pow(sun,180.0)*1.6;
        color+=sunColor*pow(sun,24.0)*.16;
        gl_FragColor=vec4(color,1.0);
      }
    `
  });
  const sky=new THREE.Mesh(geometry,material);
  sky.frustumCulled=false;
  return sky;
}

const sky=makeSky();
scene.add(sky);

function setMenu(open){
  menuOpen=open;
  menu.classList.toggle("hidden",!open);
  help.classList.toggle("hidden",open);
  if(open){
    controls.unlock();
  }else{
    controls.lock();
  }
}

function renderHotbar(){
  inventory.forEach((item,i)=>{
    const slot=slots[i];
    slot.style.backgroundImage=item?`url("${textureUrl(item.type)}")`:"none";
    slot.classList.toggle("filled",!!item);
    slot.classList.toggle("selected",i===selected);
  });
}

function selectSlot(index){
  selected=(index+inventory.length)%inventory.length;
  renderHotbar();
  updateTargetText();
}

function nextFilled(direction){
  if(!inventory.some(Boolean))return;
  for(let step=1;step<=inventory.length;step++){
    const index=(selected+direction*step+inventory.length*10)%inventory.length;
    if(inventory[index]){
      selected=index;
      renderHotbar();
      updateTargetText();
      return;
    }
  }
}

function addItem(type){
  const existing=inventory.find(item=>item?.type===type);
  if(existing){
    existing.count++;
    renderHotbar();
    return true;
  }

  const empty=inventory.findIndex(item=>!item);
  if(empty<0)return false;
  inventory[empty]={type,count:1};
  selected=empty;
  renderHotbar();
  updateTargetText();
  return true;
}

function removeSelected(){
  const item=inventory[selected];
  if(!item)return false;
  item.count--;
  if(item.count<=0)inventory[selected]=null;
  renderHotbar();
  return true;
}

function updateTargetText(looking=lastLooking){
  targetLabel.textContent=`selected: ${inventory[selected]?.type??"empty"} | looking: ${looking||"air"}`;
}

function centerHit(){
  raycaster.setFromCamera({x:0,y:0},camera);
  return raycaster.intersectObjects(Object.values(world.meshes),false)[0]??null;
}

function breakBlock(){
  const hit=centerHit();
  const block=hit&&world.blockFromHit(hit);
  if(!block)return;
  const type=world.get(block.x,block.y,block.z);
  if(!type||!addItem(type))return;
  if(!world.removeBlock(block.x,block.y,block.z)){
    removeSelected();
  }
}

function overlapsPlayer(x,y,z){
  const minX=camera.position.x-PLAYER_RADIUS;
  const maxX=camera.position.x+PLAYER_RADIUS;
  const minY=camera.position.y-EYE_HEIGHT;
  const maxY=minY+PLAYER_HEIGHT;
  const minZ=camera.position.z-PLAYER_RADIUS;
  const maxZ=camera.position.z+PLAYER_RADIUS;
  return x<maxX&&x+1>minX&&y<maxY&&y+1>minY&&z<maxZ&&z+1>minZ;
}

function placeBlock(){
  const item=inventory[selected];
  const hit=centerHit();
  if(!item||!hit?.face)return;

  const block=world.blockFromHit(hit);
  if(!block)return;

  const normal=hit.face.normal;
  const x=block.x+Math.round(normal.x);
  const y=block.y+Math.round(normal.y);
  const z=block.z+Math.round(normal.z);

  if(overlapsPlayer(x,y,z))return;
  if(world.placeBlock(x,y,z,item.type))removeSelected();
}

function updateTarget(){
  const hit=centerHit();
  const block=hit&&world.blockFromHit(hit);
  lastLooking=block?world.get(block.x,block.y,block.z):"";
  updateTargetText();
}

function collide(){
  return world.collidesPlayer(
    camera.position.x,
    camera.position.y,
    camera.position.z,
    PLAYER_RADIUS,
    EYE_HEIGHT,
    PLAYER_HEIGHT
  );
}

function moveHorizontal(dx,dz){
  const oldX=camera.position.x;
  camera.position.x=Math.max(-WORLD_LIMIT,Math.min(WORLD_LIMIT,camera.position.x+dx));
  if(collide())camera.position.x=oldX;

  const oldZ=camera.position.z;
  camera.position.z=Math.max(-WORLD_LIMIT,Math.min(WORLD_LIMIT,camera.position.z+dz));
  if(collide())camera.position.z=oldZ;
}

function moveVertical(dy){
  const oldY=camera.position.y;
  const nextY=oldY+dy;
  camera.position.y=nextY;

  if(!collide())return {hit:false};

  let lo,hi;
  if(dy<0){
    lo=nextY;
    hi=oldY;
    for(let i=0;i<12;i++){
      const mid=(lo+hi)*.5;
      camera.position.y=mid;
      if(collide())lo=mid;else hi=mid;
    }
    camera.position.y=hi;
    return {hit:true,down:true};
  }

  lo=oldY;
  hi=nextY;
  for(let i=0;i<12;i++){
    const mid=(lo+hi)*.5;
    camera.position.y=mid;
    if(collide())hi=mid;else lo=mid;
  }
  camera.position.y=lo;
  return {hit:true,down:false};
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
  const vertical=moveVertical(velocityY*dt);
  if(vertical.hit){
    if(vertical.down)grounded=true;
    velocityY=0;
  }else{
    grounded=false;
  }

  sky.position.copy(camera.position);
  updateTarget();
}

function animateMenu(dt){
  const time=performance.now();
  panoramaCube.rotation.x=-THREE.MathUtils.degToRad(8+Math.sin(time/4000)*4);
  panoramaCube.rotation.y=THREE.MathUtils.degToRad(-time*.004);
  menuCamera.aspect=innerWidth/innerHeight;
  menuCamera.updateProjectionMatrix();
  void dt;
}

function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),.05);

  if(menuOpen){
    animateMenu(dt);
    renderer.render(menuScene,menuCamera);
    return;
  }

  if(controls.isLocked)update(dt);
  sky.position.copy(camera.position);
  renderer.render(scene,camera);
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
  keys.add(event.code);

  const digit=event.code.match(/^Digit([1-9])$/);
  if(digit)selectSlot(Number(digit[1])-1);
});

addEventListener("keyup",event=>keys.delete(event.code));

canvas.addEventListener("click",()=>{if(!menuOpen)controls.lock()});
canvas.addEventListener("contextmenu",event=>event.preventDefault());

canvas.addEventListener("mousedown",event=>{
  if(!controls.isLocked||menuOpen)return;
  if(event.button===0)breakBlock();
  if(event.button===2)placeBlock();
});

canvas.addEventListener("wheel",event=>{
  if(!controls.isLocked||menuOpen)return;
  event.preventDefault();
  nextFilled(event.deltaY>0?1:-1);
},{passive:false});

controls.addEventListener("lock",()=>{
  if(!menuOpen)help.classList.add("hidden");
});

controls.addEventListener("unlock",()=>{
  if(!menuOpen)help.classList.remove("hidden");
});

playButton.addEventListener("click",()=>setMenu(false));

renderHotbar();
updateTargetText();
setMenu(true);
loop();
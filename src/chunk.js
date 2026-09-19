import {BLOCKS} from "./blocks.js";

export const CHUNK_SIZE=16;
export const WORLD_HEIGHT=40;
export const RENDER_DISTANCE=4;

const IDS=Object.freeze({
  air:0,bedrock:1,stone:2,dirt:3,grass:4,cobblestone:5,
  coarse_dirt:6,rooted_dirt:7,dirt_path:8
});

const TYPES=Object.freeze([
  "air","bedrock","stone","dirt","grass","cobblestone",
  "coarse_dirt","rooted_dirt","dirt_path"
]);

function floorDiv(value,size){
  return Math.floor(value/size);
}

export function chunkCoord(value){
  return floorDiv(value,CHUNK_SIZE);
}

export function localCoord(value){
  return ((value%CHUNK_SIZE)+CHUNK_SIZE)%CHUNK_SIZE;
}

export function chunkKey(cx,cz){
  return `${cx}|${cz}`;
}

function hash2(x,z){
  let n=(Math.imul(x,374761393)^Math.imul(z,668265263))|0;
  n=Math.imul(n^(n>>>13),1274126177);
  n^=n>>>16;
  return (n>>>0)/4294967295;
}

function smooth(t){
  return t*t*(3-2*t);
}

function valueNoise(x,z){
  const x0=Math.floor(x),z0=Math.floor(z);
  const tx=smooth(x-x0),tz=smooth(z-z0);
  const a=hash2(x0,z0);
  const b=hash2(x0+1,z0);
  const c=hash2(x0,z0+1);
  const d=hash2(x0+1,z0+1);
  return a+(b-a)*tx+(c-a)*tz+(a-b-c+d)*tx*tz;
}

function fbm(x,z){
  let total=0;
  let amplitude=.5;
  let frequency=1;
  let normalizer=0;

  for(let i=0;i<5;i++){
    total+=valueNoise(x*frequency,z*frequency)*amplitude;
    normalizer+=amplitude;
    amplitude*=.5;
    frequency*=2;
  }

  return total/normalizer;
}

export function terrainHeight(x,z){
  const broad=fbm(x*.018,z*.018);
  const detail=fbm(x*.055+31.7,z*.055-12.4);
  const hills=Math.pow(broad,.85)*11;
  const small=detail*3;
  return Math.max(2,Math.min(WORLD_HEIGHT-2,3+Math.floor(hills+small)));
}

export class Chunk{
  constructor(cx,cz){
    this.cx=cx;
    this.cz=cz;
    this.key=chunkKey(cx,cz);
    this.blocks=new Uint8Array(CHUNK_SIZE*WORLD_HEIGHT*CHUNK_SIZE);
    this.top=new Int16Array(CHUNK_SIZE*CHUNK_SIZE);
    this.top.fill(-1);
    this.renderObjects=[];
  }

  index(x,y,z){
    return (y*CHUNK_SIZE+z)*CHUNK_SIZE+x;
  }

  getLocal(x,y,z){
    if(x<0||x>=CHUNK_SIZE||y<0||y>=WORLD_HEIGHT||z<0||z>=CHUNK_SIZE)return 0;
    return this.blocks[this.index(x,y,z)];
  }

  setLocal(x,y,z,id){
    if(x<0||x>=CHUNK_SIZE||y<0||y>=WORLD_HEIGHT||z<0||z>=CHUNK_SIZE)return;
    this.blocks[this.index(x,y,z)]=id;
  }

  typeAtLocal(x,y,z){
    return TYPES[this.getLocal(x,y,z)]||"air";
  }

  generate(){
    for(let x=0;x<CHUNK_SIZE;x++){
      for(let z=0;z<CHUNK_SIZE;z++){
        const wx=this.cx*CHUNK_SIZE+x;
        const wz=this.cz*CHUNK_SIZE+z;
        const h=terrainHeight(wx,wz);
        this.top[z*CHUNK_SIZE+x]=h;

        for(let y=0;y<=h;y++){
          let type="stone";
          if(y===0)type="bedrock";
          else if(y===h)type="grass";
          else if(y>=h-2)type="dirt";
          this.setLocal(x,y,z,IDS[type]);
        }
      }
    }
  }
}

export function typeId(type){
  return IDS[type]??0;
}

export function idType(id){
  return TYPES[id]||"air";
}

export function validBlockType(type){
  return !!BLOCKS[type]&&type!=="air";
}
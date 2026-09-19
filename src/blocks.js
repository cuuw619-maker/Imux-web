import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const asset=name=>new URL(`../${name}`,import.meta.url).href;

export const BLOCKS={
  bedrock:{texture:"bedrock.png",breakable:false},
  stone:{texture:"stone.png",breakable:true},
  dirt:{texture:"dirt.png",breakable:true},
  grass:{texture:"dirt.png",color:0x75a94c,breakable:true},
  cobblestone:{texture:"cobblestone.png",breakable:true},
  coarse_dirt:{texture:"coarse_dirt.png",breakable:true},
  rooted_dirt:{texture:"rooted_dirt.png",breakable:true},
  dirt_path:{texture:"dirt_path_top.png",breakable:true}
};

export const HOTBAR=["grass","dirt","stone","cobblestone","coarse_dirt","rooted_dirt","dirt_path","stone","dirt"];

export function createMaterials(){
  const loader=new THREE.TextureLoader();
  const materials={};
  for(const [name,block] of Object.entries(BLOCKS)){
    const texture=loader.load(asset(block.texture));
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.magFilter=THREE.NearestFilter;
    texture.minFilter=THREE.NearestMipmapLinearFilter;
    texture.generateMipmaps=true;
    materials[name]=new THREE.MeshLambertMaterial({map:texture,color:block.color??0xffffff});
  }
  return materials;
}

export function textureUrl(name){return asset(BLOCKS[name].texture);}
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const asset=name=>new URL(`../${name}`,import.meta.url).href;
const embedded=name=>name;

const GRASS_TOP="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAAAAAA6mKC9AAAA8UlEQVR42gUAWW+CMPj7yXuZ0ylHOWwpR6EFC0ERh8gh+ELGEl9mwh8zEC9iv2eaVxwodpoPHxKvlJmeGVp3E4uHXah8xXJIGMbndsRf+gwrm8ooU7hm+pK5jQI/5mgODzI8P/XmrhIfsnR9Q4ckxwkx1ySIQT3WITepZuHfIWokA4ZPbri7WnLEiJVaB00+9wMaj1NvcFsUKkjjz/fSXscR74KJIcgLWRtzIF6bxmREMrDGfSUt7kjubSdNofCUiGaR/U0jqpzrjQTUrriSoeUi2rwk7QOqy2s73WOhJgnuTu4G7ANxrmksgv9dZ4WkeAPz+JNw8txdwAAAAABJRU5ErkJggg==";
const GRASS_SIDE="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAMAAAAoLQ9TAAAAeFBMVEWcy2yXxmeTwmOSwWKQv2CNvF2KuVp/v1V+vlSDslOBsFF2tkx1tUt0tEpzs0lxsUdw sEa5hVxvr0VtrUNsrEJrq0FqqkBpqT9oqD5npz2Hh4dmpjxkpDpiojhhoTdg oDZfnzVXly2WbEpQkCZsbGx0WER5VTpZPSnN78OwAAAAnElEQVR42jWNCw7C MAxDw/8/CBuMbTBGGPb9b4hbQRtZT3Gfaodd0XXnoVrvrk3dv0vbV8vthrfH MJ0XfdVcbEG71zzxsJpN+HrSOJJHkgNLgoFwhkQc0QQBkYISEADN1e2Ak+j yhKHlGDOsJS6FCNZhkg2oZMlLbIfdJfUwrKoZpRCjSnzBj8pKfgg1U6ZYYlA heP/ratuocjvvsNMH5BFYTKgAAAAAElFTkSuQmCC".replace(/\s/g,"");

export const BLOCKS={
  bedrock:{texture:"bedrock.png",breakable:false},
  stone:{texture:"stone.png",breakable:true},
  dirt:{texture:"dirt.png",breakable:true},
  grass:{side:"grass_block_side",top:"grass_block_top",bottom:"dirt.png",breakable:true},
  cobblestone:{texture:"cobblestone.png",breakable:true},
  coarse_dirt:{texture:"coarse_dirt.png",breakable:true},
  rooted_dirt:{texture:"rooted_dirt.png",breakable:true},
  dirt_path:{side:"dirt_path_side.png",top:"dirt_path_top.png",bottom:"dirt_path_top.png",breakable:true}
};

export const HOTBAR=[];

export function createMaterials(){
  const loader=new THREE.TextureLoader();
  const cache=new Map();
  const loadTexture=(source,embeddedData=false)=>{
    const key=embeddedData?source:`asset:${source}`;
    if(cache.has(key))return cache.get(key);
    const texture=loader.load(embeddedData?source:asset(source));
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.magFilter=THREE.NearestFilter;
    texture.minFilter=THREE.NearestMipmapLinearFilter;
    texture.generateMipmaps=true;
    cache.set(key,texture);
    return texture;
  };

  const materials={};
  for(const [name,block] of Object.entries(BLOCKS)){
    if(!block.side){
      const texture=loadTexture(block.texture);
      materials[name]=new THREE.MeshLambertMaterial({map:texture});
      continue;
    }

    const side=block.side==="grass_block_side"?loadTexture(GRASS_SIDE,true):loadTexture(block.side);
    const top=block.top==="grass_block_top"?loadTexture(GRASS_TOP,true):loadTexture(block.top);
    const bottom=block.bottom==="dirt.png"?loadTexture("dirt.png"):loadTexture(block.bottom);
    materials[name]=[
      new THREE.MeshLambertMaterial({map:side}),
      new THREE.MeshLambertMaterial({map:side}),
      new THREE.MeshLambertMaterial({map:top}),
      new THREE.MeshLambertMaterial({map:bottom}),
      new THREE.MeshLambertMaterial({map:side}),
      new THREE.MeshLambertMaterial({map:side})
    ];
  }
  return materials;
}

export function textureUrl(name){
  const block=BLOCKS[name];
  if(!block)return "";
  if(name==="grass")return GRASS_SIDE;
  return asset(block.texture??block.side);
}
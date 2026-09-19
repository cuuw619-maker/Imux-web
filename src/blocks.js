import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const TEXTURE_ROOT=new URL("../assets/minecraft/textures/",import.meta.url);
const asset=path=>new URL(path,TEXTURE_ROOT).href;

export const BLOCKS={
  bedrock:{texture:"block/bedrock.png",breakable:false},
  stone:{texture:"block/stone.png",breakable:true},
  dirt:{texture:"block/dirt.png",breakable:true},
  grass:{
    top:"block/grass_block_top.png",
    side:"block/dirt.png",
    overlay:"block/grass_block_side_overlay.png",
    bottom:"block/dirt.png",
    snow:"block/grass_block_snow.png",
    tint:"grass",
    breakable:true
  },
  cobblestone:{texture:"block/cobblestone.png",breakable:true},
  coarse_dirt:{texture:"block/coarse_dirt.png",breakable:true},
  rooted_dirt:{texture:"block/rooted_dirt.png",breakable:true},
  dirt_path:{
    top:"block/dirt_path_top.png",
    side:"block/dirt_path_side.png",
    bottom:"block/dirt_path_side.png",
    height:15/16,
    breakable:true
  }
};

export const BLOCK_ORDER=[
  "grass","dirt","stone","cobblestone","coarse_dirt","rooted_dirt","dirt_path"
];

function loadTexture(loader,cache,path){
  if(cache.has(path))return cache.get(path);
  const texture=loader.load(asset(path));
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.magFilter=THREE.NearestFilter;
  texture.minFilter=THREE.NearestMipmapLinearFilter;
  texture.generateMipmaps=true;
  texture.wrapS=THREE.ClampToEdgeWrapping;
  texture.wrapT=THREE.ClampToEdgeWrapping;
  cache.set(path,texture);
  return texture;
}

function tintedMaterial(map,grassMap,overlay=false){
  const material=new THREE.MeshLambertMaterial({
    map,
    transparent:overlay,
    depthWrite:!overlay
  });

  material.onBeforeCompile=shader=>{
    shader.uniforms.uGrassMap={value:grassMap};
    shader.vertexShader=
      "attribute vec2 aBiome; varying vec2 vBiome;\n"+
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n vBiome=aBiome;"
      );
    shader.fragmentShader=
      "uniform sampler2D uGrassMap; varying vec2 vBiome;\n"+
      shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        vec3 biomeTint=texture2D(uGrassMap,vBiome).rgb;
        float mask=dot(diffuseColor.rgb,vec3(0.299,0.587,0.114));
        diffuseColor.rgb=mask*biomeTint;`
      );
  };
  return material;
}

export function createMaterials(){
  const loader=new THREE.TextureLoader();
  const cache=new Map();
  const grassMap=loadTexture(loader,cache,"colormap/grass.png");

  const materials={};
  const grassSide=loadTexture(loader,cache,"block/dirt.png");
  const grassTop=loadTexture(loader,cache,"block/grass_block_top.png");
  const grassOverlay=loadTexture(loader,cache,"block/grass_block_side_overlay.png");
  const dirt=loadTexture(loader,cache,"block/dirt.png");

  for(const [name,block] of Object.entries(BLOCKS)){
    if(name==="grass"){
      const side=new THREE.MeshLambertMaterial({map:grassSide});
      const top=tintedMaterial(grassTop,grassMap,false);
      materials[name]=[side,side,top,dirt,side,side];
      continue;
    }

    if(name==="dirt_path"){
      const top=loadTexture(loader,cache,block.top);
      const side=loadTexture(loader,cache,block.side);
      const bottom=loadTexture(loader,cache,block.bottom);
      materials[name]=[
        new THREE.MeshLambertMaterial({map:side}),
        new THREE.MeshLambertMaterial({map:side}),
        new THREE.MeshLambertMaterial({map:top}),
        new THREE.MeshLambertMaterial({map:bottom}),
        new THREE.MeshLambertMaterial({map:side}),
        new THREE.MeshLambertMaterial({map:side})
      ];
      continue;
    }

    const texture=loadTexture(loader,cache,block.texture);
    materials[name]=new THREE.MeshLambertMaterial({map:texture});
  }

  const transparent=new THREE.MeshBasicMaterial({
    transparent:true,opacity:0,depthWrite:false
  });
  const overlay=tintedMaterial(grassOverlay,grassMap,true);
  materials.grassOverlay=[overlay,overlay,transparent,transparent,overlay,overlay];

  return materials;
}

export function textureUrl(name){
  const block=BLOCKS[name];
  if(!block)return "";
  if(name==="grass")return asset("block/grass_block_top.png");
  return asset(block.texture??block.top??block.side);
}

export function blockHeight(name){
  return BLOCKS[name]?.height??1;
}
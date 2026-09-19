import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import {BLOCKS,createMaterials} from "./blocks.js";

export class World{
  constructor(scene){
    this.scene=scene;
    this.size=32;
    this.data=new Map();
    this.top=new Map();
    this.materials=createMaterials();
    this.geometry=new THREE.BoxGeometry(1,1,1);
    this.meshes={};
    this.instanceBlocks={};
    this.build();
    this.rebuildMeshes();
    this.addLighting();
  }

  key(x,y,z){return `${x}|${y}|${z}`}
  columnKey(x,z){return `${x}|${z}`}
  get(x,y,z){return this.data.get(this.key(x,y,z))??null}

  set(x,y,z,type){
    if(BLOCKS[type])this.data.set(this.key(x,y,z),type);
  }

  heightAt(x,z){
    return this.top.get(this.columnKey(Math.floor(x),Math.floor(z)))??-1;
  }

  terrainHeight(x,z){
    return 3+Math.floor((Math.sin(x*.20)+Math.cos(z*.18)+Math.sin((x+z)*.09))*.85);
  }

  build(){
    for(let x=-this.size;x<this.size;x++){
      for(let z=-this.size;z<this.size;z++){
        const h=Math.max(2,this.terrainHeight(x,z));
        for(let y=0;y<=h;y++){
          let type="stone";
          if(y===0)type="bedrock";
          else if(y===h)type="grass";
          else if(y>=h-2)type="dirt";
          this.set(x,y,z,type);
        }
        this.top.set(this.columnKey(x,z),h);
      }
    }
  }

  removeBlock(x,y,z){
    const type=this.get(x,y,z);
    if(!type||!BLOCKS[type].breakable)return false;
    this.data.delete(this.key(x,y,z));
    const column=this.columnKey(x,z);
    let top=this.top.get(column)??-1;
    if(y===top){
      while(top>=0&&!this.get(x,top,z))top--;
      this.top.set(column,top);
    }
    this.rebuildMeshes();
    return true;
  }

  placeBlock(x,y,z,type){
    if(y<1||this.get(x,y,z)||!BLOCKS[type])return false;
    this.set(x,y,z,type);
    const column=this.columnKey(x,z);
    const oldTop=this.top.get(column)??-1;
    if(y>oldTop)this.top.set(column,y);
    this.rebuildMeshes();
    return true;
  }

  rebuildMeshes(){
    for(const mesh of Object.values(this.meshes))this.scene.remove(mesh);
    this.meshes={};
    this.instanceBlocks={};

    const grouped={};
    for(const [key,type] of this.data){
      (grouped[type]??=[]).push(key);
    }

    const matrix=new THREE.Matrix4();
    for(const [type,keys] of Object.entries(grouped)){
      const mesh=new THREE.InstancedMesh(this.geometry,this.materials[type],keys.length);
      mesh.frustumCulled=false;
      mesh.userData.blockType=type;
      this.instanceBlocks[type]=[];

      keys.forEach((key,index)=>{
        const [x,y,z]=key.split("|").map(Number);
        matrix.makeTranslation(x+.5,y+.5,z+.5);
        mesh.setMatrixAt(index,matrix);
        this.instanceBlocks[type][index]={x,y,z};
      });

      mesh.instanceMatrix.needsUpdate=true;
      this.meshes[type]=mesh;
      this.scene.add(mesh);
    }
  }

  blockFromHit(hit){
    const type=hit.object?.userData?.blockType;
    return type?this.instanceBlocks[type]?.[hit.instanceId]??null:null;
  }

  addLighting(){
    this.scene.add(new THREE.HemisphereLight(0xddeeff,0x554433,2.1));
    const sun=new THREE.DirectionalLight(0xffffff,2.4);
    sun.position.set(30,60,20);
    this.scene.add(sun);
  }
}
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import {BLOCKS,createMaterials,blockHeight} from "./blocks.js";

export class World{
  constructor(scene){
    this.scene=scene;
    this.size=32;
    this.data=new Map();
    this.top=new Map();
    this.materials=createMaterials();
    this.cubeGeometry=new THREE.BoxGeometry(1,1,1);
    this.pathGeometry=new THREE.BoxGeometry(1,15/16,1);
    this.meshes={};
    this.grassOverlays=[];
    this.instanceBlocks={};
    this.raycastObjects=[];
    this.build();
    this.rebuildMeshes();
    this.addLighting();
  }

  key(x,y,z){return `${x}|${y}|${z}`}
  columnKey(x,z){return `${x}|${z}`}
  get(x,y,z){return this.data.get(this.key(x,y,z))??null}
  isSolid(x,y,z){return this.data.has(this.key(x,y,z))}
  blockHeight(type){return blockHeight(type)}

  set(x,y,z,type){
    if(BLOCKS[type])this.data.set(this.key(x,y,z),type);
  }

  heightAt(x,z){
    return this.top.get(this.columnKey(Math.floor(x),Math.floor(z)))??-1;
  }

  surfaceAt(x,z){
    const X=Math.floor(x),Z=Math.floor(z);
    const y=this.heightAt(X,Z);
    if(y<0)return 0;
    return y+blockHeight(this.get(X,y,Z));
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

  biomeAt(x,z){
    const temperature=.5+.5*Math.sin(x*.011+z*.007);
    const rainfall=.5+.5*Math.cos(x*.008-z*.013);
    return [
      THREE.MathUtils.clamp(temperature,.01,.99),
      THREE.MathUtils.clamp(rainfall,.01,.99)
    ];
  }

  addBiomeAttribute(geometry,blocks){
    const values=new Float32Array(blocks.length*2);
    for(let i=0;i<blocks.length;i++){
      const [u,v]=this.biomeAt(blocks[i].x,blocks[i].z);
      values[i*2]=u;
      values[i*2+1]=v;
    }
    geometry.setAttribute(
      "aBiome",
      new THREE.InstancedBufferAttribute(values,2)
    );
  }

  collidesPlayer(px,eyeY,pz,radius,heightOffset,height){
    const minX=px-radius,maxX=px+radius;
    const minY=eyeY-heightOffset,maxY=minY+height;
    const minZ=pz-radius,maxZ=pz+radius;

    const x0=Math.floor(minX),x1=Math.floor(maxX-1e-6);
    const y0=Math.floor(minY),y1=Math.floor(maxY-1e-6);
    const z0=Math.floor(minZ),z1=Math.floor(maxZ-1e-6);

    for(let x=x0;x<=x1;x++){
      for(let y=y0;y<=y1;y++){
        for(let z=z0;z<=z1;z++){
          const type=this.get(x,y,z);
          if(!type)continue;
          const h=blockHeight(type);
          if(maxX>x&&minX<x+1&&maxY>y&&minY<y+h&&maxZ>z&&minZ<z+1){
            return true;
          }
        }
      }
    }
    return false;
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
    for(const mesh of this.grassOverlays)this.scene.remove(mesh);

    this.meshes={};
    this.grassOverlays=[];
    this.instanceBlocks={};
    this.raycastObjects=[];

    const grouped={};
    for(const [key,type] of this.data){
      (grouped[type]??=[]).push(key);
    }

    const matrix=new THREE.Matrix4();

    for(const [type,keys] of Object.entries(grouped)){
      const blocks=keys.map(key=>{
        const [x,y,z]=key.split("|").map(Number);
        return {x,y,z};
      });

      const geometry=(type==="dirt_path"?this.pathGeometry:this.cubeGeometry).clone();
      const mesh=new THREE.InstancedMesh(
        geometry,
        this.materials[type],
        blocks.length
      );
      mesh.frustumCulled=false;
      mesh.userData.blockType=type;
      this.instanceBlocks[type]=blocks;

      for(let i=0;i<blocks.length;i++){
        const b=blocks[i];
        matrix.makeTranslation(
          b.x+.5,
          b.y+(blockHeight(type)/2),
          b.z+.5
        );
        mesh.setMatrixAt(i,matrix);
      }

      mesh.instanceMatrix.needsUpdate=true;

      if(type==="grass"){
        this.addBiomeAttribute(geometry,blocks);
      }

      this.meshes[type]=mesh;
      this.raycastObjects.push(mesh);
      this.scene.add(mesh);

      if(type==="grass"){
        const overlayGeometry=this.cubeGeometry.clone();
        this.addBiomeAttribute(overlayGeometry,blocks);

        const overlay=new THREE.InstancedMesh(
          overlayGeometry,
          this.materials.grassOverlay,
          blocks.length
        );
        overlay.frustumCulled=false;
        overlay.renderOrder=2;
        overlay.userData.blockType=type;

        for(let i=0;i<blocks.length;i++){
          const b=blocks[i];
          matrix.makeTranslation(b.x+.5,b.y+.5,b.z+.5);
          overlay.setMatrixAt(i,matrix);
        }

        overlay.instanceMatrix.needsUpdate=true;
        this.grassOverlays.push(overlay);
        this.raycastObjects.push(overlay);
        this.scene.add(overlay);
      }
    }
  }

  blockFromHit(hit){
    const type=hit.object?.userData?.blockType;
    return type?this.instanceBlocks[type]?.[hit.instanceId]??null:null;
  }

  addLighting(){
    this.scene.add(new THREE.HemisphereLight(0xddeeff,0x554433,1.9));
    const sun=new THREE.DirectionalLight(0xffffff,2.25);
    sun.position.set(30,60,20);
    this.scene.add(sun);
  }
}
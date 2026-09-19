import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import {BLOCKS,createMaterials,blockHeight} from "./blocks.js";
import {CHUNK_SIZE,RENDER_DISTANCE,Chunk,chunkCoord,chunkKey,idType,typeId,localCoord,WORLD_HEIGHT} from "./chunk.js";

const AIR="air";

export class World{
  constructor(scene){
    this.scene=scene;
    this.chunks=new Map();
    this.materials=createMaterials();
    this.cubeGeometry=new THREE.BoxGeometry(1,1,1);
    this.pathGeometry=new THREE.BoxGeometry(1,15/16,1);
    this.raycastObjects=[];
    this.centerChunkX=999999;
    this.centerChunkZ=999999;
  }

  key(x,y,z){
    return `${x}|${y}|${z}`;
  }

  getChunk(cx,cz){
    return this.chunks.get(chunkKey(cx,cz))??null;
  }

  ensureChunk(cx,cz){
    const key=chunkKey(cx,cz);
    let chunk=this.chunks.get(key);
    if(chunk)return chunk;
    chunk=new Chunk(cx,cz);
    chunk.generate();
    this.chunks.set(key,chunk);
    this.rebuildChunk(chunk);
    return chunk;
  }

  updateAround(worldX,worldZ){
    const centerX=chunkCoord(worldX);
    const centerZ=chunkCoord(worldZ);

    if(centerX===this.centerChunkX&&centerZ===this.centerChunkZ)return;

    this.centerChunkX=centerX;
    this.centerChunkZ=centerZ;

    for(let dz=-RENDER_DISTANCE;dz<=RENDER_DISTANCE;dz++){
      for(let dx=-RENDER_DISTANCE;dx<=RENDER_DISTANCE;dx++){
        if(dx*dx+dz*dz>RENDER_DISTANCE*RENDER_DISTANCE+RENDER_DISTANCE)continue;
        this.ensureChunk(centerX+dx,centerZ+dz);
      }
    }

    for(const [key,chunk] of [...this.chunks]){
      const dx=chunk.cx-centerX;
      const dz=chunk.cz-centerZ;
      if(dx*dx+dz*dz>RENDER_DISTANCE*RENDER_DISTANCE+RENDER_DISTANCE){
        this.removeChunk(chunk);
        this.chunks.delete(key);
      }
    }

    this.rebuildAllVisibleNeighbors();
  }

  removeChunk(chunk){
    for(const object of chunk.renderObjects)this.scene.remove(object);
    chunk.renderObjects.length=0;
  }

  rebuildAllVisibleNeighbors(){
    for(const chunk of this.chunks.values())this.rebuildChunk(chunk);
    this.rebuildRaycastList();
  }

  get(x,y,z){
    if(y<0||y>=WORLD_HEIGHT)return null;
    const cx=chunkCoord(x);
    const cz=chunkCoord(z);
    const chunk=this.getChunk(cx,cz);
    if(!chunk)return null;
    return idType(chunk.getLocal(localCoord(x),y,localCoord(z)));
  }

  set(x,y,z,type){
    if(y<0||y>=WORLD_HEIGHT||!BLOCKS[type])return false;
    const cx=chunkCoord(x);
    const cz=chunkCoord(z);
    const chunk=this.ensureChunk(cx,cz);
    chunk.setLocal(localCoord(x),y,localCoord(z),typeId(type));
    return true;
  }

  blockHeight(type){
    return blockHeight(type);
  }

  surfaceAt(x,z){
    const cx=chunkCoord(x),cz=chunkCoord(z);
    const chunk=this.getChunk(cx,cz);
    if(!chunk){
      this.ensureChunk(cx,cz);
      return this.surfaceAt(x,z);
    }
    const lx=localCoord(x),lz=localCoord(z);
    const top=chunk.top[lz*CHUNK_SIZE+lx];
    if(top<0)return 0;
    return top+blockHeight(this.get(x,top,z)||"stone");
  }

  hasSolid(x,y,z){
    return !!this.get(x,y,z);
  }

  biomeAt(x,z){
    const temperature=.5+.5*Math.sin(x*.0105+z*.0067);
    const rainfall=.5+.5*Math.cos(x*.0079-z*.0117);
    return [
      THREE.MathUtils.clamp(temperature,.01,.99),
      THREE.MathUtils.clamp(rainfall,.01,.99)
    ];
  }

  addBiomeAttribute(geometry,blocks){
    const values=new Float32Array(blocks.length*2);
    for(let i=0;i<blocks.length;i++){
      const uv=this.biomeAt(blocks[i].x,blocks[i].z);
      values[i*2]=uv[0];
      values[i*2+1]=uv[1];
    }
    geometry.setAttribute("aBiome",new THREE.InstancedBufferAttribute(values,2));
  }

  collidesPlayer(px,eyeY,pz,radius,heightOffset,height){
    const minX=px-radius;
    const maxX=px+radius;
    const minY=eyeY-heightOffset;
    const maxY=minY+height;
    const minZ=pz-radius;
    const maxZ=pz+radius;

    const x0=Math.floor(minX);
    const x1=Math.floor(maxX-1e-6);
    const y0=Math.floor(minY);
    const y1=Math.floor(maxY-1e-6);
    const z0=Math.floor(minZ);
    const z1=Math.floor(maxZ-1e-6);

    for(let x=x0;x<=x1;x++){
      for(let y=y0;y<=y1;y++){
        for(let z=z0;z<=z1;z++){
          const type=this.get(x,y,z);
          if(!type)continue;
          const h=blockHeight(type);
          if(maxX>x&&minX<x+1&&maxY>y&&minY<y+h&&maxZ>z&&minZ<z+1)return true;
        }
      }
    }
    return false;
  }

  isVisibleBlock(x,y,z){
    return [
      [x+1,y,z],[x-1,y,z],[x,y+1,z],
      [x,y-1,z],[x,y,z+1],[x,y,z-1]
    ].some(([nx,ny,nz])=>!this.hasSolid(nx,ny,nz));
  }

  rebuildChunk(chunk){
    this.removeChunk(chunk);

    const groups=new Map();
    for(let y=0;y<WORLD_HEIGHT;y++){
      for(let z=0;z<CHUNK_SIZE;z++){
        for(let x=0;x<CHUNK_SIZE;x++){
          const type=idType(chunk.getLocal(x,y,z));
          if(type===AIR||!this.isVisibleBlock(
            chunk.cx*CHUNK_SIZE+x,y,chunk.cz*CHUNK_SIZE+z
          ))continue;

          if(!groups.has(type))groups.set(type,[]);
          groups.get(type).push({
            x:chunk.cx*CHUNK_SIZE+x,
            y,
            z:chunk.cz*CHUNK_SIZE+z
          });
        }
      }
    }

    const matrix=new THREE.Matrix4();

    for(const [type,blocks] of groups){
      const geometry=(type==="dirt_path"?this.pathGeometry:this.cubeGeometry).clone();
      if(type==="grass")this.addBiomeAttribute(geometry,blocks);

      const mesh=new THREE.InstancedMesh(
        geometry,
        this.materials[type],
        blocks.length
      );
      mesh.userData.blockType=type;
      mesh.userData.blockPositions=blocks;
      mesh.frustumCulled=true;
      mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

      const h=blockHeight(type);
      for(let i=0;i<blocks.length;i++){
        const b=blocks[i];
        matrix.makeTranslation(b.x+.5,b.y+h*.5,b.z+.5);
        mesh.setMatrixAt(i,matrix);
      }

      mesh.instanceMatrix.needsUpdate=true;
      mesh.computeBoundingSphere();
      mesh.computeBoundingBox();

      chunk.renderObjects.push(mesh);
      this.scene.add(mesh);

      if(type==="grass"){
        const overlayGeometry=this.cubeGeometry.clone();
        this.addBiomeAttribute(overlayGeometry,blocks);

        const overlayMaterial=this.materials.grassOverlay;
        const overlay=new THREE.InstancedMesh(
          overlayGeometry,
          overlayMaterial,
          blocks.length
        );
        overlay.userData.blockType=type;
        overlay.userData.blockPositions=blocks;
        overlay.frustumCulled=true;
        overlay.renderOrder=2;
        overlay.instanceMatrix.setUsage(THREE.StaticDrawUsage);

        for(let i=0;i<blocks.length;i++){
          const b=blocks[i];
          matrix.makeTranslation(b.x+.5,b.y+.5,b.z+.5);
          overlay.setMatrixAt(i,matrix);
        }

        overlay.instanceMatrix.needsUpdate=true;
        overlay.computeBoundingSphere();
        overlay.computeBoundingBox();
        chunk.renderObjects.push(overlay);
        this.scene.add(overlay);
      }
    }
  }

  rebuildRaycastList(){
    this.raycastObjects=[];
    for(const chunk of this.chunks.values()){
      for(const object of chunk.renderObjects)this.raycastObjects.push(object);
    }
  }

  updateBlockVisuals(x,y,z){
    const cx=chunkCoord(x),cz=chunkCoord(z);
    for(let dz=-1;dz<=1;dz++){
      for(let dx=-1;dx<=1;dx++){
        const chunk=this.getChunk(cx+dx,cz+dz);
        if(chunk)this.rebuildChunk(chunk);
      }
    }
    this.rebuildRaycastList();
  }

  removeBlock(x,y,z){
    const type=this.get(x,y,z);
    if(!type||!BLOCKS[type].breakable)return false;

    const cx=chunkCoord(x),cz=chunkCoord(z);
    const chunk=this.getChunk(cx,cz);
    if(!chunk)return false;

    chunk.setLocal(localCoord(x),y,localCoord(z),0);
    if(chunk.top[localCoord(z)*CHUNK_SIZE+localCoord(x)]===y){
      let next=y-1;
      while(next>=0&&!chunk.getLocal(localCoord(x),next,localCoord(z)))next--;
      chunk.top[localCoord(z)*CHUNK_SIZE+localCoord(x)]=next;
    }

    this.updateBlockVisuals(x,y,z);
    return true;
  }

  placeBlock(x,y,z,type){
    if(y<1||y>=WORLD_HEIGHT||this.get(x,y,z)||!BLOCKS[type])return false;
    if(!this.set(x,y,z,type))return false;

    const cx=chunkCoord(x),cz=chunkCoord(z);
    const chunk=this.getChunk(cx,cz);
    const idx=localCoord(z)*CHUNK_SIZE+localCoord(x);
    if(y>chunk.top[idx])chunk.top[idx]=y;

    this.updateBlockVisuals(x,y,z);
    return true;
  }

  blockFromHit(hit){
    return hit.object?.userData?.blockPositions?.[hit.instanceId]??null;
  }

  addLighting(){
    this.scene.add(new THREE.HemisphereLight(0xddeeff,0x554433,1.9));
    const sun=new THREE.DirectionalLight(0xffffff,2.2);
    sun.position.set(30,60,20);
    this.scene.add(sun);
  }
}
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {BLOCKS} from './blocks.js';

export class World{
  constructor(scene){this.scene=scene;this.size=32;this.data=new Map();this.materials={};for(const [n,b] of Object.entries(BLOCKS))this.materials[n]=new THREE.MeshLambertMaterial({color:b.color});this.build();this.addLighting()}
  key(x,y,z){return x+'|'+y+'|'+z}
  set(x,y,z,type){this.data.set(this.key(x,y,z),type)}
  heightAt(x,z){const X=Math.floor(x),Z=Math.floor(z);return this.data.has(this.key(X,0,Z))?this.top.get(X+'|'+Z)??0:0}
  build(){
    this.top=new Map();const geo=new THREE.BoxGeometry(1,1,1);
    for(let x=-32;x<32;x++)for(let z=-32;z<32;z++){
      const h=2+Math.floor((Math.sin(x*.22)+Math.cos(z*.19)+Math.sin((x+z)*.11))*0.7);
      this.top.set(x+'|'+z,h);
      for(let y=0;y<=h;y++){const type=y===h?'grass':y>h-3?'dirt':'stone';this.set(x,y,z,type);const m=new THREE.Mesh(geo,this.materials[type]);m.position.set(x+.5,y+.5,z+.5);this.scene.add(m)}
    }
  }
  addLighting(){this.scene.add(new THREE.HemisphereLight(0xddeeff,0x554433,2));const sun=new THREE.DirectionalLight(0xffffff,2);sun.position.set(30,60,20);this.scene.add(sun)}
}
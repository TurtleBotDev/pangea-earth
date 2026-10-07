// GPU rotation of rigid continental pieces, using GPlates finite rotations.
// Input quaternions are [w, x, y, z]; Cesium uses [x, y, z, w].
export function slerp(a,b,t){
 let dot=a.reduce((sum,v,i)=>sum+v*b[i],0),q=b;
 if(dot<0){q=b.map(v=>-v);dot=-dot;}
 if(dot>.9995){const out=a.map((v,i)=>v+(q[i]-v)*t),length=Math.hypot(...out);return out.map(v=>v/length);}
 const theta=Math.acos(Math.max(-1,Math.min(1,dot))),sin=Math.sin(theta),u=Math.sin((1-t)*theta)/sin,v=Math.sin(t*theta)/sin;
 return a.map((value,i)=>value*u+q[i]*v);
}
export function rotationAt(data,pid,age){const samples=data.rotations[String(pid)];if(!samples)throw Error(`Missing plate rotation ${pid}`);const index=Math.min(samples.length-2,Math.floor(Math.max(0,Math.min(300,age))/5));return slerp(samples[index],samples[index+1],(age-data.times[index])/5);}
export function rotatePoint(q,[lon,lat]){const rad=Math.PI/180,x=Math.cos(lat*rad)*Math.cos(lon*rad),y=Math.cos(lat*rad)*Math.sin(lon*rad),z=Math.sin(lat*rad),[w,a,b,c]=q;const tx=2*(b*z-c*y),ty=2*(c*x-a*z),tz=2*(a*y-b*x);const rx=x+w*tx+b*tz-c*ty,ry=y+w*ty+c*tx-a*tz,rz=z+w*tz+a*ty-b*tx;return [Math.atan2(ry,rx)/rad,Math.asin(Math.max(-1,Math.min(1,rz)))/rad];}
const landShader=`
float paleoHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float paleoNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(paleoHash(i),paleoHash(i+vec2(1.,0.)),f.x),mix(paleoHash(i+vec2(0.,1.)),paleoHash(i+vec2(1.,1.)),f.x),f.y);}
czm_material czm_getMaterial(czm_materialInput materialInput){czm_material m=czm_getDefaultMaterial(materialInput);vec2 p=materialInput.st*12.;float n=paleoNoise(p)*.55+paleoNoise(p*3.1)*.3+paleoNoise(p*11.3)*.15;m.diffuse=mix(vec3(.19,.29,.17),vec3(.60,.57,.32),n);m.alpha=1.;m.specular=0.;return m;}`;
export class ContinentalMotion{
 constructor(C,viewer,data,satelliteImage){this.C=C;this.viewer=viewer;this.data=data;this.groups=[];this.visible=false;this.omittedPieces=0;const sphere=new C.Ellipsoid(6428137,6428137,6428137);const groups=new Map();
  for(const f of data.features){const key=`${f.pid}:${f.begin}:${f.end}`;if(!groups.has(key))groups.set(key,{pid:f.pid,begin:f.begin,end:f.end,features:[]});groups.get(key).features.push(f);}
  const material=new C.Material({fabric:{type:'PaleoContinentalSurface',source:landShader}});this.landMaterial=material;this.satelliteMaterial=C.Material.fromType('Image',{image:satelliteImage});
  for(const group of groups.values()){
   const hierarchy=rings=>new C.PolygonHierarchy(rings[0].slice(0,-1).map(p=>C.Cartesian3.fromDegrees(p[0],p[1],0,sphere)),rings.slice(1).map(r=>new C.PolygonHierarchy(r.slice(0,-1).map(p=>C.Cartesian3.fromDegrees(p[0],p[1],0,sphere)))));
   const instances=[];for(const f of group.features){try{const geometry=C.PolygonGeometry.createGeometry(new C.PolygonGeometry({polygonHierarchy:hierarchy(f.rings),ellipsoid:sphere,granularity:C.Math.toRadians(2),vertexFormat:C.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat}));if(geometry){const positions=geometry.attributes.position.values,st=geometry.attributes.st.values,reference=(f.rings[0][0][0]+180)/360;for(let i=0;i<positions.length/3;i++){const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];let u=(Math.atan2(y,x)+Math.PI)/(2*Math.PI);while(u-reference>.5)u-=1;while(u-reference<-.5)u+=1;st[i*2]=u;st[i*2+1]=(Math.asin(z/Math.hypot(x,y,z))+Math.PI/2)/Math.PI;}instances.push(new C.GeometryInstance({geometry}));}else this.omittedPieces++;}catch{this.omittedPieces++;}}if(!instances.length)continue;
   const primitive=viewer.scene.primitives.add(new C.Primitive({geometryInstances:instances,appearance:new C.MaterialAppearance({material,faceForward:true,closed:false,translucent:false}),asynchronous:false,show:false,allowPicking:false}));
   this.groups.push({...group,primitive});
  }
 }
 setSatellite(enabled){for(const g of this.groups)g.primitive.appearance.material=enabled?this.satelliteMaterial:this.landMaterial;this.viewer.scene.requestRender();}
 setVisible(visible){this.visible=visible;if(!visible)this.groups.forEach(g=>g.primitive.show=false);}
 update(age){const C=this.C,matrices=new Map();for(const group of this.groups){let matrix=matrices.get(group.pid);if(!matrix){const [w,x,y,z]=rotationAt(this.data,group.pid,age);const rotation=C.Matrix3.fromQuaternion(new C.Quaternion(x,y,z,w));matrix=C.Matrix4.fromRotationTranslation(rotation);matrices.set(group.pid,matrix);}group.primitive.modelMatrix=matrix;group.primitive.show=this.visible&&age<=group.begin&&age>=group.end;}this.viewer.scene.requestRender();}
 coordinates(i,age,places){return rotatePoint(rotationAt(this.data,this.data.placePids[i],age),[places[i].lon,places[i].lat]);}
 get ready(){return this.groups.filter(g=>g.primitive.show).every(g=>g.primitive.ready);}
}

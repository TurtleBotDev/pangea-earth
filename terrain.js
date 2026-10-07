// Geographic imagery tiles drawn from GPlates polygons. Shading is illustrative,
// never a claim about paleo-elevation or vegetation. No imagery API key required.
const SIZE = 256;
function hash(x,y){let n=Math.imul(x,374761393)+Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=hash(ix,iy),b=hash(ix+1,iy),c=hash(ix,iy+1),d=hash(ix+1,iy+1);return (a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy;}
function relief(lon,lat){return noise(lon*.8,lat*.8)*.5+noise(lon*2.7,lat*2.7)*.28+noise(lon*9.3,lat*9.3)*.14+noise(lon*31,lat*31)*.08;}
export function unwrapRing(ring){let last=ring[0][0];return ring.map(([lon,lat],i)=>{if(i){while(lon-last>180)lon-=360;while(lon-last<-180)lon+=360;}last=lon;return [lon,lat];});}
export function preparePolygons(data){const result=[];for(const f of data.features){const g=f.geometry;if(!g)continue;const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];for(const p of polys){const rings=p.map(unwrapRing);const ext=rings[0];let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;for(const [x,y]of ext){west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,y);north=Math.max(north,y);}result.push({rings,west,east,south,north});}}return result;}
export class PaleoImageryProvider{
 constructor(C,data,style='natural'){this.C=C;this.polygons=preparePolygons(data);this.style=style;this.tileWidth=SIZE;this.tileHeight=SIZE;this.minimumLevel=0;this.maximumLevel=10;this.tilingScheme=new C.GeographicTilingScheme();this.rectangle=this.tilingScheme.rectangle;this.errorEvent=new C.Event();this.credit=new C.Credit('Continental positions: GPlates / Müller et al. (2022). Surface: illustrative.');this.hasAlphaChannel=false;}
 getTileCredits(){return undefined;}
 requestImage(x,y,level){
 const nx=2**(level+1),ny=2**level,w=360/nx,h=180/ny,west=-180+x*w,north=90-y*h,south=north-h,east=west+w;
 const canvas=document.createElement('canvas');canvas.width=SIZE;canvas.height=SIZE;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#000';ctx.fillRect(0,0,SIZE,SIZE);ctx.fillStyle='#fff';
 for(const p of this.polygons){if(p.north<south||p.south>north)continue;for(const shift of [-720,-360,0,360,720]){if(p.east+shift<west||p.west+shift>east)continue;ctx.beginPath();for(const ring of p.rings){ring.forEach(([lon,lat],i)=>{const px=(lon+shift-west)/w*SIZE,py=(north-lat)/h*SIZE;i?ctx.lineTo(px,py):ctx.moveTo(px,py);});ctx.closePath();}ctx.fill('evenodd');}}
 const img=ctx.getImageData(0,0,SIZE,SIZE),d=img.data;
 for(let py=0;py<SIZE;py++){const lat=north-(py+.5)/SIZE*h;for(let px=0;px<SIZE;px++){const i=(py*SIZE+px)*4,land=d[i]/255,lon=west+(px+.5)/SIZE*w;let r,g,b;
 if(land>.05){const n=relief(lon,lat),desert=Math.max(0,1-Math.abs(Math.abs(lat)-25)/18),patch=noise(lon*.13+20,lat*.13);const dry=Math.min(1,desert*.8+patch*.3);const shade=.64+n*.65; r=(65+dry*103)*shade;g=(92+dry*54)*shade;b=(56+dry*38)*shade;const ridge=Math.max(0,(1-Math.abs(n-.54)*17))*.35;r+=ridge*48;g+=ridge*41;b+=ridge*33;const detail=(noise(lon*130,lat*130)-.5)*13+(noise(lon*470,lat*470)-.5)*10+(noise(lon*1700,lat*1700)-.5)*7+(noise(lon*6000,lat*6000)-.5)*4;r+=detail;g+=detail;b+=detail*.8;
 if(Math.abs(lat)>72){const ice=Math.min(1,(Math.abs(lat)-72)/12);r=r*(1-ice)+190*ice;g=g*(1-ice)+204*ice;b=b*(1-ice)+197*ice;}
 }else{const n=noise(lon*.09,lat*.09),fine=noise(lon*.5,lat*.5);r=10+n*8;g=31+n*17+fine*3;b=43+n*18+fine*4;}
 d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255;
 }}ctx.putImageData(img,0,0);return Promise.resolve(canvas);
 }
 pickFeatures(){return undefined;}
}

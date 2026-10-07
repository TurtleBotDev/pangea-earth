"""Build compact, attributed animation data from published GPlates model files.
Usage: python3 scripts/prepare-motion.py /path/to/Muller_etal_2022_SE_v1.2.4.zip
Requires only Python's standard library. Fetches rotations from GPlates.
"""
import concurrent.futures, gzip, json, math, pathlib, sys, urllib.parse, urllib.request, zipfile, xml.etree.ElementTree as ET
NS={'g':'http://www.opengis.net/gml','p':'http://www.gplates.org/gplates'}
ROOT=pathlib.Path(__file__).resolve().parents[1]
def fetch(path,params):
 url='https://gws.gplates.org/'+path+'?'+urllib.parse.urlencode(params)
 for attempt in range(3):
  try:return json.load(urllib.request.urlopen(url,timeout=90))
  except Exception:
   if attempt==2:raise

def simplify(points,tolerance=.00045):
 # Ramer–Douglas–Peucker in unit-sphere Cartesian coordinates, not wrapped longitude.
 vec=[(math.cos(math.radians(lat))*math.cos(math.radians(lon)),math.cos(math.radians(lat))*math.sin(math.radians(lon)),math.sin(math.radians(lat))) for lon,lat in points]
 keep={0,len(points)-1};stack=[(0,len(points)-1)]
 while stack:
  a,b=stack.pop();u=vec[a];delta=tuple(vec[b][i]-u[i] for i in range(3));den=sum(x*x for x in delta);best=0;idx=None
  for j in range(a+1,b):
   v=tuple(vec[j][i]-u[i] for i in range(3));t=max(0,min(1,sum(v[i]*delta[i] for i in range(3))/den)) if den else 0;dist=sum((v[i]-t*delta[i])**2 for i in range(3))
   if dist>best:best,idx=dist,j
  if idx is not None and best>tolerance*tolerance:keep.add(idx);stack.extend([(a,idx),(idx,b)])
 return [points[i] for i in sorted(keep)]

def time_value(s):
 if "distantFuture" in s:return -1e9
 if "distantPast" in s:return 1e9
 return float(s)

def main():
 archive=zipfile.ZipFile(sys.argv[1]);root=ET.fromstring(gzip.decompress(archive.read('Coastlines/shapes_coastlines_Merdith_etal.gpmlz')));features=[];pids=set();imports=set()
 for member in root:
  f=member[0];pid=int(f.findtext('p:reconstructionPlateId/p:ConstantValue/p:value',namespaces=NS));begin=time_value(f.findtext('g:validTime/g:TimePeriod/g:begin/g:TimeInstant/g:timePosition',namespaces=NS));end=time_value(f.findtext('g:validTime/g:TimePeriod/g:end/g:TimeInstant/g:timePosition',namespaces=NS));imp=float(f.findtext('p:geometryImportTime/g:TimeInstant/g:timePosition','0',NS));imports.add(imp)
  if begin<0 or end>300:continue
  for poly in f.findall('.//g:Polygon',NS):
   rings=[]
   for ring in poly.findall('.//g:LinearRing/g:posList',NS):
    vals=list(map(float,ring.text.split()));points=[[round(vals[i+1],4),round(vals[i],4)] for i in range(0,len(vals),2)];simple=simplify(points)
    if len(simple)>=4:rings.append(simple)
   if not rings:continue
   features.append({'pid':pid,'begin':begin,'end':end,'rings':rings});pids.add(pid)
 assert imports=={0},f'Nonzero geometry import times need correction: {imports}'
 places=json.loads((ROOT/'data/places.json').read_text())['places'];assign=fetch('reconstruct/assign_points_plate_ids',{'model':'MULLER2022','lons':','.join(str(p['lon']) for p in places),'lats':','.join(str(p['lat']) for p in places),'with_valid_time':''});print('Place plate IDs:',assign)
 # Valid-time assignments returned as [pid, begin, end]. Keep raw entries for provenance.
 place_pids=[entry["pid"] if isinstance(entry,dict) else entry[0] if isinstance(entry,list) else entry for entry in assign];pids.update(place_pids)
 times=list(range(0,301,5));batches=[sorted(pids)[i:i+40] for i in range(0,len(pids),40)]
 def rotations(batch):
  # Time-keyed response avoids the service's unordered set(times) in grouped arrays.
  result=fetch('rotation/get_quaternions',{'model':'MULLER2022','times':','.join(map(str,times)),'pids':','.join(map(str,batch))})
  keyed={float(age):values for age,values in result.items()}
  return {str(pid):[keyed[age][str(pid)] for age in times] for pid in batch}
 rotations_by_pid={}
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  for result in pool.map(rotations,batches):rotations_by_pid.update(result)
 for pid in pids:assert len(rotations_by_pid[str(pid)])==len(times)
 data={'model':'MULLER2022','source':'https://zenodo.org/records/13636799','license':'CC BY 4.0','times':times,'features':features,'rotations':rotations_by_pid,'placePids':place_pids,'placeAssignments':assign}
 (ROOT/'data/motion.json').write_text(json.dumps(data,separators=(',',':'))+'\n');print('Saved',len(features),'coastline pieces,',len(pids),'plates,',len(times),'rotation samples; bytes:',(ROOT/'data/motion.json').stat().st_size)
if __name__=='__main__':main()

"""Render Scotese & Wright (2018) PaleoDEM grids as attributed globe textures.
Requires netCDF4, numpy, Pillow. Usage: python prepare-paleogeography.py archive.zip
Uses the published filtered 0.2-degree grids; finer spacing does not imply finer evidence.
"""
import io,json,pathlib,sys,zipfile
import numpy as np
from netCDF4 import Dataset
from PIL import Image
root=pathlib.Path(__file__).resolve().parents[1];archive=zipfile.ZipFile(sys.argv[1]);out=root/'assets';out.mkdir(exist_ok=True)
# Elevation palette: deep ocean, shelf, sea level, lowland, upland, mountain.
levels=np.array([-8000,-4000,-1200,-250,-1,0,100,700,1800,3500,5500,8000])
colors=np.array([[8,23,36],[11,39,55],[22,64,78],[47,96,104],[81,127,126],[77,108,62],[100,129,75],[141,148,96],[158,148,105],[163,154,132],[197,194,182],[233,235,223]],dtype=float)
meta={'source':'Scotese & Wright (2018) PALEOMAP PaleoDEMs','license':'CC BY 4.0','url':'https://www.earthbyte.org/paleodem-resource-scotese-and-wright-2018/','gridSpacingDegrees':.2,'limitations':'Published 0.2-degree grids are filtered/resampled from coarse regional reconstructions; file history applies a 400 km Gaussian filter. Grid spacing is not geological accuracy. Shorelines are estimated zero-elevation contours, not precise local reconstructions.','ages':{}}
for age in [0,160,200,240,260,300]:
 name=next(n for n in archive.namelist() if not n.startswith('__MACOSX') and n.endswith(f'_{age}Ma.nc'))
 nc=Dataset('memory',memory=archive.read(name));elev=np.asarray(nc.variables['z'][:])[::-1];history=getattr(nc,'history','');lon=np.asarray(nc.variables['lon'][:]);lat=np.asarray(nc.variables['lat'][:]);assert lon[0]==-180 and lon[-1]==180 and lat[0]==-90 and lat[-1]==90
 rgb=np.stack([np.interp(elev,levels,colors[:,i]) for i in range(3)],axis=-1)
 # Directional relief is computed only from the published reconstructed elevations.
 dy,dx=np.gradient(elev);shade=np.clip(1+(dx-dy)*.00035,.7,1.2);rgb=np.clip(rgb*shade[...,None],0,255).astype('uint8')
 Image.fromarray(rgb).save(out/f'paleogeography-{age}.jpg',quality=94,subsampling=0)
 meta['ages'][str(age)]={'file':name,'width':len(lon),'height':len(lat),'processingHistory':history};nc.close();print('Rendered',age)
(root/'data/paleogeography.json').write_text(json.dumps(meta,indent=2)+'\n')

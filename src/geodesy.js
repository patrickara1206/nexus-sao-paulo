// WGS84 tangent frame shared by the street map and the photogrammetric renderer.
export const origin={lat:-23.5614,lon:-46.6559,height:760};
const rad=Math.PI/180,a=6378137,e2=6.6943799901413165e-3,lat0=origin.lat*rad,lon0=origin.lon*rad;
export function ecef(lat,lon,height=origin.height){lat*=rad;lon*=rad;const n=a/Math.sqrt(1-e2*Math.sin(lat)**2);return [(n+height)*Math.cos(lat)*Math.cos(lon),(n+height)*Math.cos(lat)*Math.sin(lon),(n*(1-e2)+height)*Math.sin(lat)];}
const center=ecef(origin.lat,origin.lon,origin.height);
export function toLocal(lat,lon,height=origin.height){const p=ecef(lat,lon,height),dx=p[0]-center[0],dy=p[1]-center[1],dz=p[2]-center[2];const east=-Math.sin(lon0)*dx+Math.cos(lon0)*dy,north=-Math.sin(lat0)*Math.cos(lon0)*dx-Math.sin(lat0)*Math.sin(lon0)*dy+Math.cos(lat0)*dz,up=Math.cos(lat0)*Math.cos(lon0)*dx+Math.cos(lat0)*Math.sin(lon0)*dy+Math.sin(lat0)*dz;return {x:east,y:up,z:-north};}

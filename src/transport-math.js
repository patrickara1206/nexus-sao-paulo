// Metres and seconds. Independent of rendering so route and braking rules can be checked.
export function makeRoute(points){
 const clean=points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>.01),lengths=[0];
 for(let i=1;i<clean.length;i++)lengths.push(lengths.at(-1)+Math.hypot(clean[i][0]-clean[i-1][0],clean[i][1]-clean[i-1][1]));
 return {points:clean,lengths,length:lengths.at(-1)||0};
}
export function sampleRoute(route,distance,offset=0){
 const d=Math.max(0,Math.min(route.length,distance));let i=1;while(i<route.lengths.length-1&&route.lengths[i]<d)i++;
 const a=route.points[i-1],b=route.points[i],len=route.lengths[i]-route.lengths[i-1],t=len?(d-route.lengths[i-1])/len:0,dx=(b[0]-a[0])/(len||1),dz=(b[1]-a[1])/(len||1);
 return {x:a[0]+(b[0]-a[0])*t+dz*offset,z:a[1]+(b[1]-a[1])*t-dx*offset,dx,dz,yaw:Math.atan2(dx,dz)};
}
export function routeDistance(route,x,z){let best={distance:Infinity,along:0};for(let i=1;i<route.points.length;i++){const a=route.points[i-1],b=route.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(len*len||1))),distance=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);if(distance<best.distance)best={distance,along:route.lengths[i-1]+len*t};}return best;}
export function joinRoads(records){
 const pending=records.map(r=>r.points.map(p=>[...p])),chains=[];
 while(pending.length){let chain=pending.shift(),changed=true;while(changed){changed=false;for(let i=0;i<pending.length;i++){const p=pending[i],near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<.5;if(near(chain.at(-1),p[0]))chain.push(...p.slice(1));else if(near(p.at(-1),chain[0]))chain.unshift(...p.slice(0,-1));else continue;pending.splice(i,1);changed=true;break;}}if(chain.length>1)chains.push(makeRoute(chain));}
 return chains.sort((a,b)=>b.length-a.length);
}
export function signalPhase(time){const phase=((time%30)+30)%30;return phase<18?'green':phase<21?'amber':'red';}
export function stepDrive(car,input,dt){
 dt=Math.min(.05,Math.max(0,dt));let v=car.speed;
 if(input.brake)v*=Math.exp(-dt*8);else if(input.forward>0)v+=dt*(v<0?12:5);else if(input.forward<0)v-=dt*(v>0?12:3);else v*=Math.exp(-dt*.65);
 v=Math.max(-5,Math.min(16.7,v));if(Math.abs(v)<.025)v=0;
 const yaw=car.yaw-input.side*dt*Math.min(Math.abs(v)/3,1.15)*Math.sign(v);
 return {...car,speed:v,yaw,x:car.x+Math.sin(yaw)*v*dt,z:car.z+Math.cos(yaw)*v*dt};
}
// 60 s: approach, dwell with doors open, then depart; stationary at the platform for 18 s.
export function trainMotion(time){const t=((time%60)+60)%60;if(t<18){const u=t/18;return {position:-360*(1-u)*(1-u),doors:0,phase:'approaching',remaining:Math.ceil(18-t)};}if(t<36)return {position:0,doors:Math.min(1,(t-18)*1.5,(36-t)*1.5),phase:'boarding',remaining:Math.ceil(36-t)};const u=(t-36)/24;return {position:460*u*u,doors:0,phase:'departing',remaining:Math.ceil(60-t)};}
export function stationGroundHeight(x,z){const a=Math.abs(z);return a<49?0:Math.min(6,(a-49)*6/16.5);}
export function stationCanMove(x,z){return Math.abs(x)<(Math.abs(z)>49?1.4:4.45)&&Math.abs(z)<72&&![-60,-48,-36,-24,-12,0,12,24,36,48,60].some(cz=>Math.abs(z-cz)<.65&&(Math.abs(x-2.3)<.65||Math.abs(x+2.3)<.65));}

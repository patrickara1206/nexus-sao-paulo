import {canMove,heightAt} from '../src/geography.js';
export const MAX_PLAYERS=16;
export function validRoom(room){return /^[a-zA-Z0-9-]{1,24}$/.test(room);}
export function sanitizeName(value){return String(value||'Explorador').replace(/[<>\u0000-\u001f]/g,'').slice(0,20)||'Explorador';}
export function validateMovement(message,previous,now){
 if(!message||message.type!=='move'||!['x','z','yaw'].every(k=>typeof message[k]==='number'&&Number.isFinite(message[k])))return null;
 if(!canMove(message.x,message.z))return null;
 const elapsed=Math.min(2,Math.max(0,(now-previous.time)/1000));
 if(Math.hypot(message.x-previous.x,message.z-previous.z)>90*elapsed+6)return null;
 return {id:previous.id,name:previous.name,x:message.x,z:message.z,y:heightAt(message.x,message.z),yaw:message.yaw%(Math.PI*2),car:message.car===true,time:now};
}

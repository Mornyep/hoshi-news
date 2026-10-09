import fs from 'node:fs/promises';import {constants} from 'node:fs';import {randomUUID} from 'node:crypto';import path from 'node:path';
export const profileID=v=>typeof v==='string'&&/^[a-f0-9-]{36}$/.test(v);
export class PrivateStore {
 constructor(dir){this.dir=path.resolve(dir);}
 async init(){await fs.mkdir(this.dir,{recursive:true,mode:0o700});const s=await fs.lstat(this.dir);if(s.isSymbolicLink()||!s.isDirectory()||s.uid!==process.getuid())throw Error('Unsafe state directory');await fs.chmod(this.dir,0o700);}
 file(name){if(!/^(host|first-inference|pairings|account-[a-f0-9-]{36})\.json$/.test(name))throw Error('Invalid state name');return path.join(this.dir,name);}
 async read(name){let h;try{h=await fs.open(this.file(name),constants.O_RDONLY|constants.O_NOFOLLOW);const s=await h.stat();if(!s.isFile()||s.uid!==process.getuid()||(s.mode&0o777)!==0o600||s.size>100000)throw Error('Unsafe credential file');return JSON.parse(await h.readFile('utf8'));}catch(e){if(e.code==='ENOENT')return null;throw Error('State unavailable');}finally{await h?.close();}}
 async write(name,value){const target=this.file(name),temp=target+'.'+randomUUID();try{await fs.writeFile(temp,JSON.stringify(value),{flag:'wx',mode:0o600});await fs.rename(temp,target);}finally{await fs.rm(temp,{force:true});}}
 async remove(name){await fs.rm(this.file(name),{force:true});}
 async host(){let h=await this.read('host.json');if(!h){h={id:'urn:uuid:'+randomUUID()};await this.write('host.json',h);}return h.id;}
 async reserveInference(){try{const h=await fs.open(this.file('first-inference.json'),'wx',0o600);await h.writeFile(JSON.stringify({used_at:new Date().toISOString()}));await h.close();}catch(e){if(e.code==='EEXIST')throw Error('initial_validation_limit');throw Error('State unavailable');}}
 accountName(id){if(!profileID(id))throw Error('Invalid profile');return 'account-'+id+'.json';}
}

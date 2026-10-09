// Explicit local start only. Detached child survives the command/task; no OS autostart or authentication.
import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const ADDRESS='http://127.0.0.1:45457';
async function probe(){try{const r=await fetch(ADDRESS+'/health',{signal:AbortSignal.timeout(1000),redirect:'error'});const h=await r.json();if(!r.ok||h.app!=='Starnews'||h.schema!==1||h.transport!=='loopback')throw Error('unexpected_loopback_service');return h;}catch(e){if(e.cause?.code==='ECONNREFUSED')return null;throw Error('loopback_check_failed');}}
export async function startLocal({appDir,stateDir,metadataFile,health=probe,spawnProcess=spawn,wait=ms=>new Promise(r=>setTimeout(r,ms))}){
 appDir=path.resolve(appDir);stateDir=path.resolve(stateDir);metadataFile=path.resolve(metadataFile);
 const info=await fs.lstat(appDir);if(info.isSymbolicLink()||!info.isDirectory()||info.uid!==process.getuid())throw Error('unsafe_runtime');
 // Reuse an existing healthy component without touching pairing or account state.
 if(await health())return {ready:true,address:ADDRESS,reused:true,loginStarted:false};
 const child=spawnProcess(process.execPath,[path.join(appDir,'server.mjs')],{cwd:appDir,detached:true,stdio:'ignore',env:{PATH:process.env.PATH||'',TMPDIR:process.env.TMPDIR||'/tmp',LANG:process.env.LANG||'en_US.UTF-8',STARNEWS_STATE_DIR:stateDir}});
 let spawnFailed=false;child.once('error',()=>{spawnFailed=true;});child.unref();
 for(let i=0;i<15;i++){await wait(200);if(spawnFailed)throw Error('component_start_failed');if(await health()){const version=createHash('sha256').update(await fs.readFile(path.join(appDir,'server.mjs'))).digest('hex');const record={pid:child.pid,started_at:new Date().toISOString(),server_sha256:version};const existing=await fs.lstat(metadataFile).catch(e=>{if(e.code==='ENOENT')return null;throw e;});if(existing&&(existing.isSymbolicLink()||!existing.isFile()||existing.uid!==process.getuid()||(existing.mode&0o777)!==0o600))throw Error('unsafe_runtime_metadata');await fs.writeFile(metadataFile,JSON.stringify(record),{mode:0o600});return {ready:true,address:ADDRESS,reused:false,detached:true,loginStarted:false};}}
 throw Error('component_start_unconfirmed');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const appDir=path.dirname(fileURLToPath(import.meta.url)),stateDir=process.env.STARNEWS_STATE_DIR;if(!stateDir)throw Error('Dedicated STARNEWS_STATE_DIR required');try{console.log(JSON.stringify(await startLocal({appDir,stateDir,metadataFile:path.join(appDir,'..','runtime.json')})));}catch{process.stderr.write('Starnews local start failed; no login attempted.\n');process.exitCode=1;}}

// Provider contracts: no spawn, network, keys or OAuth registration.
// standard-api.mjs implements parsing/cancellation behind an injected, separately approved host transport.
export const providers=Object.freeze({
 chatgpt:{mode:'official_siwc_loopback',enabled:true,guide:'https://developers.openai.com/siwc/token-sharing-open-source/sign-in'},
 claude:{mode:'official_native_pending_approval',enabled:false,guide:'https://code.claude.com/docs/en/legal-and-compliance'},
 grok:{mode:'official_native_acp_pending_approval',enabled:false,guide:'https://docs.x.ai/build/cli/headless-scripting'},
 deepseek:{mode:'standard_api_pending_key_approval',enabled:false,guide:'https://api-docs.deepseek.com/'},
 qianwen:{mode:'regional_standard_api_pending_key_approval',enabled:false,guide:'https://help.aliyun.com/en/model-studio/get-api-key'},
 doubao:{mode:'standard_api_pending_key_approval',enabled:false,guide:'https://www.volcengine.com/docs/82379'},
 kimi:{mode:'standard_api_pending_key_approval',enabled:false,guide:'https://platform.moonshot.cn/docs'},
 zhipu:{mode:'standard_api_pending_key_approval',enabled:false,guide:'https://docs.bigmodel.cn/'},
 yuanbao:{mode:'official_client_manual_only',enabled:false,guide:'https://yuanbao.tencent.com/'}
});
const reading=value=>{if(typeof value!=='string'||!value.trim()||value.length>12000)throw Error('Invalid reading prompt');return value;};
export function claudeNativeContract(prompt){return Object.freeze({executable:'claude',args:['-p','--output-format','json','--tools','','--no-session-persistence','--strict-mcp-config','--mcp-config','{"mcpServers":{}}'],stdin:reading(prompt),shell:false,requiresExplicitNativeApproval:true});}
export async function grokACPContract(rpc,prompt,cwd){reading(prompt);if(typeof rpc!=='function'||typeof cwd!=='string'||!cwd.endsWith('/empty-reading-workspace'))throw Error('Dedicated empty workspace required');const init=await rpc('initialize',{protocolVersion:1,clientCapabilities:{fs:{readTextFile:false,writeTextFile:false},terminal:false}});if(!(init.authMethods||[]).some(m=>m.id==='cached_token'))throw Error('Official native login required');await rpc('authenticate',{methodId:'cached_token',_meta:{headless:true}});const s=await rpc('session/new',{cwd,mcpServers:[]});return rpc('session/prompt',{sessionId:s.sessionId,prompt:[{type:'text',text:prompt}]});}
export function denyNativeCapability(method){if(['fs/read_text_file','fs/write_text_file','terminal/create','terminal/output','terminal/kill','terminal/wait_for_exit','terminal/release','session/request_permission'].includes(method))return {allowed:false,outcome:{outcome:'cancelled'}};throw Error('Unsupported native request');}
export function standardAPIContract(provider,{model,prompt,region}){if(!['deepseek','qianwen'].includes(provider)||typeof model!=='string'||!/^[a-zA-Z0-9._-]{1,100}$/.test(model))throw Error('Unsupported API configuration');let url;if(provider==='deepseek')url='https://api.deepseek.com/chat/completions';else {const regions={beijing:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',singapore:'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions'};url=regions[region];if(!url)throw Error('Select the API key region explicitly');}return {url,method:'POST',redirect:'error',body:{model,messages:[{role:'user',content:reading(prompt)}],stream:false,max_tokens:700},requiresSeparateKeyAndBillingApproval:true};}

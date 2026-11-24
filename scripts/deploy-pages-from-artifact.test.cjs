'use strict';
const assert=require('node:assert/strict');
const deploy=require('./deploy-pages-from-artifact.cjs');
(async()=>{
 const requests=[],outputs={},statuses=['queued','building','succeed'];
 const context={repo:{owner:'owner',repo:'game'},runId:7,sha:'a'.repeat(40)};
 const core={getIDToken:async()=> 'test-oidc',setOutput:(key,value)=>{outputs[key]=value;},info() {}};
 const github={request:async(route,args)=>{requests.push({route,args});return {data:route.startsWith('POST')?{id:42,page_url:'https://example.test/game/'}:{status:statuses.shift()}};}};
 await deploy({github,core,context,artifactId:'123456',sleep:async()=>{}});
 assert.deepEqual(requests[0],{route:'POST /repos/{owner}/{repo}/pages/deployments',args:{...context.repo,artifact_id:123456,pages_build_version:context.sha,oidc_token:'test-oidc'}});
 assert.equal(requests.filter(r=>r.route.startsWith('GET')).length,3);assert.equal(outputs.status,'succeed');
 assert.equal(outputs.page_url,'https://example.test/game/');
 await assert.rejects(deploy({github,core,context,artifactId:'invalid',sleep:async()=>{}}),/valid artifact ID/);
 let lookups=0;
 const fallback={request:async(route,args)=>{
   if(route.includes('/actions/runs/'))return{data:{artifacts:++lookups<2?[]:[{id:789,name:'github-pages',expired:false}]}};
   if(route.startsWith('POST')){assert.equal(args.artifact_id,789);return{data:{id:45}};}
   return{data:{status:'succeed'}};
 }};
 await deploy({github:fallback,core,context,artifactId:'',sleep:async()=>{}});
 assert.equal(lookups,2,'Missing upload output should recover through the current-run artifact API');
 const failed={request:async route=>({data:route.startsWith('POST')?{id:43}:{status:'deployment_content_failed'}})};
 await assert.rejects(deploy({github:failed,core,context,artifactId:'1',sleep:async()=>{}}),/deployment_content_failed/);
 const timed=[];const timeout={request:async(route,args)=>{timed.push(route);return{data:route.startsWith('POST')?{id:44}:{status:'queued'}};}};
 await assert.rejects(deploy({github:timeout,core,context,artifactId:'1',sleep:async()=>{},attempts:2}),/timed out/);
 assert.equal(timed.at(-1),'POST /repos/{owner}/{repo}/pages/deployments/{deploymentId}/cancel');
 const workflow=require('node:fs').readFileSync(require('node:path').join(__dirname,'../.github/workflows/publish.yml'),'utf8');
 assert(/- id: pages-artifact\s+uses: actions\/upload-pages-artifact@v4/.test(workflow),'Upload output is referenced without a step ID');
 assert(workflow.includes('steps.pages-artifact.outputs.artifact_id'));
 console.log('PASS: upload-step wiring, artifact-ID fallback, Pages API payload, success polling, failure handling and timeout cancellation.');
})().catch(error=>{console.error(error);process.exitCode=1;});

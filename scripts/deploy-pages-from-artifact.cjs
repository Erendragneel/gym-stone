/* Use the upload action's artifact ID with the official Pages deployment API.
 * This avoids rediscovering an artifact through the Actions results service.
 * API contract: actions/deploy-pages v4 src/internal/api-client.js and index.js.
 */
'use strict';
module.exports = async function deployPages({github,core,context,artifactId=process.env.PAGES_ARTIFACT_ID,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=120}) {
  if (!/^\d+$/.test(String(artifactId)) || !Number.isSafeInteger(Number(artifactId)) || Number(artifactId)<=0) throw Error('The Pages upload did not return a valid artifact ID.');
  const oidcToken=await core.getIDToken();
  const {data:deployment}=await github.request('POST /repos/{owner}/{repo}/pages/deployments',{
    ...context.repo,artifact_id:Number(artifactId),pages_build_version:context.sha,oidc_token:oidcToken
  });
  if(!deployment.id)throw Error('GitHub did not return a Pages deployment ID.');
  core.setOutput('page_url',deployment.page_url||'');
  const terminal=new Set(['deployment_failed','deployment_perms_error','deployment_content_failed','deployment_cancelled','deployment_lost']);
  for(let attempt=0;attempt<attempts;attempt++){
    await sleep(5000);
    const {data:state}=await github.request('GET /repos/{owner}/{repo}/pages/deployments/{deploymentId}',{
      ...context.repo,deploymentId:deployment.id
    });
    if(state.status==='succeed'){core.setOutput('status','succeed');core.info('GitHub Pages deployment succeeded.');return;}
    if(terminal.has(state.status))throw Error('GitHub Pages reported '+state.status+'.');
    core.info('Pages deployment status: '+state.status);
  }
  await github.request('POST /repos/{owner}/{repo}/pages/deployments/{deploymentId}/cancel',{
    ...context.repo,deploymentId:deployment.id
  });
  throw Error('GitHub Pages deployment timed out after ten minutes.');
};

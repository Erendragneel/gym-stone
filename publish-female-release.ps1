$ErrorActionPreference='Stop'
$env:GIT_TERMINAL_PROMPT='0'
$env:GCM_INTERACTIVE='never'
$taskCredentialLines = "protocol=https`nhost=github.com`n`n" | git credential fill
$taskCredential=@{}
foreach($line in $taskCredentialLines){$parts=$line -split '=',2;if($parts.Count -eq 2){$taskCredential[$parts[0]]=$parts[1]}}
if(!$taskCredential['password']){throw 'GitHub credentials are unavailable'}
$taskHeaders=@{Authorization=('Bearer '+$taskCredential['password']);Accept='application/vnd.github+json';'X-GitHub-Api-Version'='2022-11-28'}
$taskApi='https://api.github.com/repos/Erendragneel/gym-stone'
$taskSha=(git rev-parse HEAD).Trim()
$taskArchive=Join-Path (Split-Path -Parent $PSScriptRoot) 'Gym_Stone_Female_Anime_Exercise_GIF_Library_v1.2.zip'
$taskName=[IO.Path]::GetFileName($taskArchive)
$taskHash=(Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLowerInvariant()
try{$taskRelease=Invoke-RestMethod -Headers $taskHeaders -Uri ($taskApi+'/releases/tags/v1.2.0')}
catch{if([int]$_.Exception.Response.StatusCode -ne 404){throw};$taskRelease=$null}
if(!$taskRelease){
 $taskDescription="Adds a detailed adult female anime counterpart for every one of the 149 catalog exercises. Profile gender switches the exercise cards and preview. Illustrated keyframe GIF/WebP loops retain the original character style and form captions. Online Supabase accounts now sync private player profiles, training goals and calendar entries across devices, with offline edits and explicit conflict review. Birthday-derived age, weight, 1–7 workout days per week, minutes per workout and weekly hours are supported. Watch screenshots and raw OCR stay on the importing device; reviewed activity details sync. Signup is immediate and emails are linked but unverified. Email reminders and password recovery emails remain unavailable. Share QR codes, browser installation and the clean Gym Stone icon remain available. This ZIP contains all 149 decoded female GIFs, their catalog and audit. Male GIFs remain in v1.1. SHA256: $taskHash"
 $taskBody=@{tag_name='v1.2.0';target_commitish=$taskSha;name='Gym Stone v1.2 — Female anime library and online profiles';body=$taskDescription;draft=$false;prerelease=$false}|ConvertTo-Json
 $taskRelease=Invoke-RestMethod -Method Post -Headers $taskHeaders -Uri ($taskApi+'/releases') -ContentType 'application/json' -Body $taskBody
}
$taskAsset=$taskRelease.assets|Where-Object{$_.name -eq $taskName}|Select-Object -First 1
if($taskAsset){
 if($taskAsset.size -ne (Get-Item -LiteralPath $taskArchive).Length){throw 'Existing asset differs; preserved without overwriting'}
}else{
 Write-Output 'Uploading the verified female GIF library.'
 $taskUpload='https://uploads.github.com/repos/Erendragneel/gym-stone/releases/'+$taskRelease.id+'/assets?name='+[Uri]::EscapeDataString($taskName)
 $taskAsset=Invoke-RestMethod -Method Post -Headers $taskHeaders -Uri $taskUpload -ContentType 'application/zip' -InFile $taskArchive -TimeoutSec 900
}
if($taskAsset.digest -and $taskAsset.digest -ne ('sha256:'+$taskHash)){throw 'Release asset digest differs from verified ZIP'}
[pscustomobject]@{release=$taskRelease.html_url;download=$taskAsset.browser_download_url;size=$taskAsset.size;sha256=$taskHash;remoteDigest=$taskAsset.digest}|ConvertTo-Json -Compress

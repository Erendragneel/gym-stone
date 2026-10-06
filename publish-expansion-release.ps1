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
$taskArchive=Join-Path (Split-Path -Parent $PSScriptRoot) 'Gym_Stone_250_New_Exercise_GIFs_v1.6.zip'
$taskName=[IO.Path]::GetFileName($taskArchive)
$taskHash=(Get-FileHash -LiteralPath $taskArchive -Algorithm SHA256).Hash.ToLowerInvariant()
try{$taskRelease=Invoke-RestMethod -Headers $taskHeaders -Uri ($taskApi+'/releases/tags/v1.6.0')}
catch{if([int]$_.Exception.Response.StatusCode -ne 404){throw};$taskRelease=$null}
if(!$taskRelease){
 $taskDescription="Adds 250 distinct exercises across strength, cardio and mobility, bringing the library to 425 moves. Each new exercise has male/female illustrated animations, equipment, level and form cues. Equipment/level filters combine with search; strength starts with blank sets/reps and timed activity with blank minutes. Existing exercise IDs, calendar history and guided warm-up/cooldown/pregnancy sections are preserved. All 500 new GIFs and 500 WebPs were decoded and checked for looping, complete framing, motion and timing; browser checks cover filters, gender switching, logging, persistence and mobile layout. This ZIP contains the 500 new GIFs; previous packs remain available. SHA256: $taskHash"
 $taskBody=@{tag_name='v1.6.0';target_commitish=$taskSha;name='Gym Stone v1.6 — 250 more exercises';body=$taskDescription;draft=$false;prerelease=$false}|ConvertTo-Json
 $taskRelease=Invoke-RestMethod -Method Post -Headers $taskHeaders -Uri ($taskApi+'/releases') -ContentType 'application/json' -Body $taskBody
}
$taskAsset=$taskRelease.assets|Where-Object{$_.name -eq $taskName}|Select-Object -First 1
if($taskAsset){
 if($taskAsset.size -ne (Get-Item -LiteralPath $taskArchive).Length){throw 'Existing asset differs; preserved without overwriting'}
}else{
 Write-Output 'Uploading the verified 250-exercise GIF pack.'
 $taskUpload='https://uploads.github.com/repos/Erendragneel/gym-stone/releases/'+$taskRelease.id+'/assets?name='+[Uri]::EscapeDataString($taskName)
 $taskAsset=Invoke-RestMethod -Method Post -Headers $taskHeaders -Uri $taskUpload -ContentType 'application/zip' -InFile $taskArchive -TimeoutSec 900
}
if($taskAsset.digest -and $taskAsset.digest -ne ('sha256:'+$taskHash)){throw 'Release asset digest differs from verified ZIP'}
[pscustomobject]@{release=$taskRelease.html_url;download=$taskAsset.browser_download_url;size=$taskAsset.size;sha256=$taskHash;remoteDigest=$taskAsset.digest}|ConvertTo-Json -Compress

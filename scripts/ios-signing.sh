#!/usr/bin/env bash
set -euo pipefail
: "${IOS_CERTIFICATE_BASE64:?}" "${IOS_PROFILE_BASE64:?}" "${KEYCHAIN_PASSWORD:?}" "${APPLE_TEAM_ID:?}" "${MOBILE_APP_ID:?}"
printf '%s' "$IOS_CERTIFICATE_BASE64" | base64 --decode > "$RUNNER_TEMP/distribution.p12"
printf '%s' "$IOS_PROFILE_BASE64" | base64 --decode > "$RUNNER_TEMP/profile.mobileprovision"
security create-keychain -p "$KEYCHAIN_PASSWORD" "$RUNNER_TEMP/app-signing.keychain-db"
security set-keychain-settings -lut 21600 "$RUNNER_TEMP/app-signing.keychain-db"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$RUNNER_TEMP/app-signing.keychain-db"
security import "$RUNNER_TEMP/distribution.p12" -P "$IOS_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$RUNNER_TEMP/app-signing.keychain-db"
security set-key-partition-list -S apple-tool:,apple: -k "$KEYCHAIN_PASSWORD" "$RUNNER_TEMP/app-signing.keychain-db"
security list-keychains -d user -s "$RUNNER_TEMP/app-signing.keychain-db" login.keychain-db
security cms -D -i "$RUNNER_TEMP/profile.mobileprovision" > "$RUNNER_TEMP/profile.plist"
python3 - <<'PY'
import os,plistlib,pathlib,shutil
root=pathlib.Path(os.environ['RUNNER_TEMP'])
p=plistlib.loads((root/'profile.plist').read_bytes());uid=p['UUID']
target=pathlib.Path.home()/'Library/MobileDevice/Provisioning Profiles';target.mkdir(parents=True,exist_ok=True)
shutil.copy(root/'profile.mobileprovision',target/f'{uid}.mobileprovision')
with open(os.environ['GITHUB_ENV'],'a') as f:f.write(f'IOS_PROFILE_UUID={uid}\n')
(root/'ExportOptions.plist').write_bytes(plistlib.dumps({'method':'app-store-connect','teamID':os.environ['APPLE_TEAM_ID'],'signingStyle':'manual','provisioningProfiles':{os.environ['MOBILE_APP_ID']:uid}}))
PY

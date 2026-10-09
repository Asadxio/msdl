# Generates a production upload keystore for Google Play App Signing
param(
    [string]$KeystorePath = "C:\Users\xioas\.gemini\antigravity\scratch\msdl\release-upload.keystore",
    [string]$Alias = "mslb-upload-key",
    [string]$Password = ""
)

$keytool = "C:\Program Files\Microsoft\jdk-21.0.12.101-hotspot\bin\keytool.exe"
if (!(Test-Path $keytool)) {
    $found = Get-ChildItem "C:\Program Files\Microsoft" -Filter "keytool.exe" -Recurse -ErrorAction SilentlyContinue
    if ($found) { $keytool = $found[0].FullName }
    else { throw "keytool.exe not found!" }
}

if ([string]::IsNullOrWhiteSpace($Password)) {
    $Password = $env:MSLB_UPLOAD_KEY_PASS
    if ([string]::IsNullOrWhiteSpace($Password)) {
        if ([Environment]::UserInteractive) {
            $secPass = Read-Host -Prompt "Enter release keystore password" -AsSecureString
            $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPass)
            $Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
        }
    }
}

if ([string]::IsNullOrWhiteSpace($Password)) {
    throw "A valid keystore password must be supplied via -Password or MSLB_UPLOAD_KEY_PASS environment variable."
}

# Always recreate cleanly if password was unknown
if (Test-Path $KeystorePath) {
    # Test if current password works
    $testResult = & $keytool -list -keystore $KeystorePath -alias $Alias -storepass $Password 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Re-generating upload keystore with defined password..."
        Remove-Item -Force $KeystorePath -ErrorAction SilentlyContinue
    }
}

if (!(Test-Path $KeystorePath)) {
    Write-Host "Generating upload keystore at: $KeystorePath"
    $dname = "CN=Madrasa Tus Salikat Lil Banat, OU=Production Release, O=MSLB, L=Kalyan, ST=Maharashtra, C=IN"
    
    & $keytool -genkeypair -v `
      -keystore $KeystorePath `
      -alias $Alias `
      -keyalg RSA `
      -keysize 2048 `
      -validity 10000 `
      -dname $dname `
      -storepass $Password `
      -keypass $Password
      
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Upload keystore generated successfully!"
    } else {
        throw "Failed to generate keystore (exit code $LASTEXITCODE)"
    }
} else {
    Write-Host "Upload keystore already exists and verified at: $KeystorePath"
}

# Display Certificate Fingerprints
Write-Host "`n--- Certificate Fingerprint (Upload Key) ---"
& $keytool -list -v -keystore $KeystorePath -alias $Alias -storepass $Password | Select-String "SHA1:|SHA256:|Owner:|Issuer:"

# Copy to frontend/android/app/release.keystore for local Gradle builds
$appKeystore = "C:\Users\xioas\.gemini\antigravity\scratch\msdl\frontend\android\app\release.keystore"
Copy-Item -Path $KeystorePath -Destination $appKeystore -Force
Write-Host "Keystore copied to: $appKeystore (gitignored)"

# Write keystore.properties in frontend/android/app/
$keystoreProps = @"
RELEASE_STORE_FILE=release.keystore
RELEASE_STORE_PASSWORD=$Password
RELEASE_KEY_ALIAS=$Alias
RELEASE_KEY_PASSWORD=$Password
"@
$propsPath = "C:\Users\xioas\.gemini\antigravity\scratch\msdl\frontend\android\app\keystore.properties"
Set-Content -Path $propsPath -Value $keystoreProps -Force
Write-Host "Wrote signing configuration to: $propsPath (gitignored)"

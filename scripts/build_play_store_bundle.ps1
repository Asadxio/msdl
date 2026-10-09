# Madrasa Tus Salikat Lil Banat - Google Play Store AAB Bundle Build Script
# Builds signed Android App Bundle (.aab) for Google Play Console submission.

param(
    [string]$KeystorePath = "",
    [string]$KeystorePassword = "",
    [string]$KeyAlias = "",
    [string]$KeyPassword = ""
)

# Map short virtual drive X: to bypass Windows MAX_PATH (260 char) limit for CMake/Ninja
if (!(Test-Path "X:\")) {
    subst X: "C:\Users\xioas\.gemini\antigravity\scratch\msdl"
}

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
if (!(Test-Path $env:JAVA_HOME)) {
    # Fallback to OpenJDK 21 if JDK 17 is in a different directory
    $possibleJdks = Get-ChildItem "C:\Program Files\Microsoft" -Filter "jdk*" -ErrorAction SilentlyContinue
    if ($possibleJdks) {
        $env:JAVA_HOME = $possibleJdks[0].FullName
    }
}
$env:ANDROID_HOME = "C:\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

Write-Host "JAVA_HOME: $env:JAVA_HOME"
Write-Host "ANDROID_HOME: $env:ANDROID_HOME"

Set-Location "X:\frontend\android"
Write-Host "Working Directory: $(Get-Location)"

# Optional custom release keystore environment variables
if ($KeystorePath -and (Test-Path $KeystorePath)) {
    $env:RELEASE_STORE_FILE = $KeystorePath
    $env:RELEASE_STORE_PASSWORD = $KeystorePassword
    $env:RELEASE_KEY_ALIAS = $KeyAlias
    $env:RELEASE_KEY_PASSWORD = $KeyPassword
    Write-Host "Configured custom release signing keystore: $KeystorePath"
}

# Clean old bundle outputs
if (Test-Path "app\build\outputs\bundle\release\app-release.aab") {
    Remove-Item -Force "app\build\outputs\bundle\release\app-release.aab" -ErrorAction SilentlyContinue
}

Write-Host "Starting Gradle bundleRelease..."
.\gradlew.bat bundleRelease --daemon --build-cache

$aabSource = "X:\frontend\android\app\build\outputs\bundle\release\app-release.aab"
if (Test-Path $aabSource) {
    $aabItem = Get-Item $aabSource
    Write-Host "Bundle Build Successful! AAB size: $($aabItem.Length) bytes, timestamp: $($aabItem.LastWriteTime)"
    
    $targetLocal = "C:\Users\xioas\.gemini\antigravity\scratch\msdl\app-release.aab"
    Copy-Item $aabSource $targetLocal -Force
    
    $hash = Get-FileHash -Algorithm SHA256 $targetLocal
    Write-Host "SHA-256: $($hash.Hash)"
    Write-Host "Artifact ready for Google Play upload at: $targetLocal"
} else {
    Write-Error "Gradle build finished but app-release.aab was not found!"
}

# Map short virtual drive X: to bypass Windows MAX_PATH (260 char) limit for CMake/Ninja
if (!(Test-Path "X:\")) {
    subst X: "C:\Users\xioas\.gemini\antigravity\scratch\msdl"
}

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "C:\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

Write-Host "JAVA_HOME: $env:JAVA_HOME"
Write-Host "ANDROID_HOME: $env:ANDROID_HOME"

Set-Location "X:\frontend\android"
Write-Host "Working Directory: $(Get-Location)"

# Clean old .cxx cache if present to ensure clean short-path CMake generation
if (Test-Path "app\.cxx") {
    Remove-Item -Recurse -Force "app\.cxx" -ErrorAction SilentlyContinue
}

# Remove existing release apk to ensure fresh build verification
if (Test-Path "app\build\outputs\apk\release\app-release.apk") {
    Remove-Item -Force "app\build\outputs\apk\release\app-release.apk" -ErrorAction SilentlyContinue
}

Write-Host "Starting Gradle assembleRelease..."
.\gradlew.bat assembleRelease --daemon --build-cache

$apkSource = "X:\frontend\android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apkSource) {
    $apkItem = Get-Item $apkSource
    Write-Host "Build Successful! APK size: $($apkItem.Length) bytes, timestamp: $($apkItem.LastWriteTime)"
    
    $targetArtifact = "C:\Users\xioas\.gemini\antigravity\brain\16e00e45-d040-413f-b760-5793b5956f07\scratch\mslb-release-v46.apk"
    $targetLocal = "C:\Users\xioas\.gemini\antigravity\scratch\msdl\mslb-release-v46.apk"
    
    Copy-Item $apkSource $targetArtifact -Force
    Copy-Item $apkSource $targetLocal -Force
    
    $hash = Get-FileHash -Algorithm SHA256 $targetArtifact
    Write-Host "SHA-256: $($hash.Hash)"
    Write-Host "Artifact copied to: $targetArtifact"
} else {
    Write-Error "Gradle build finished but app-release.apk was not found!"
}

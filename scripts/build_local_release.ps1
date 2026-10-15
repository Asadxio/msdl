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
    
    $targetLocal = "C:\Users\xioas\.gemini\antigravity\scratch\msdl\mslb-release-v50.apk"
    
    Copy-Item $apkSource $targetLocal -Force

    # Automatically copy to Google Drive if available
    $googleDriveReleases = "G:\My Drive\MSLB_App_Releases"
    if (Test-Path "G:\My Drive") {
        if (!(Test-Path $googleDriveReleases)) {
            New-Item -ItemType Directory -Path $googleDriveReleases -Force | Out-Null
        }
        Copy-Item $apkSource "$googleDriveReleases\mslb-app-latest.apk" -Force
        Copy-Item $apkSource "$googleDriveReleases\mslb-app-v1.0.13-b50.apk" -Force
        Write-Host "✓ Automatically copied to Google Drive: $googleDriveReleases\mslb-app-latest.apk"
    }
    
    $hash = Get-FileHash -Algorithm SHA256 $apkSource
    Write-Host "SHA-256: $($hash.Hash)"
} else {
    Write-Error "Gradle build finished but app-release.apk was not found!"
}

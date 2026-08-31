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

Write-Host "Starting Gradle assembleRelease..."
.\gradlew.bat assembleRelease --daemon --build-cache

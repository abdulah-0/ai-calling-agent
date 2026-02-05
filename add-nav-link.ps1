$testFeaturesLink = @'
                <a href="test-features.html" class="nav-item">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                    </svg>
                    <span>Test Features</span>
                </a>
'@

$files = @(
    "dashboard\public\index.html",
    "dashboard\public\campaigns.html",
    "dashboard\public\logs.html",
    "dashboard\public\settings.html"
)

foreach ($file in $files) {
    $content = Get-Content $file -Raw
    
    # Check if Test Features link already exists
    if ($content -notmatch "test-features.html") {
        # Find the Call Logs link and add Test Features after it
        $pattern = '(<span>Call Logs</span>\s*</a>)'
        $replacement = "`$1`n$testFeaturesLink"
        
        $newContent = $content -replace $pattern, $replacement
        
        Set-Content -Path $file -Value $newContent -NoNewline
        Write-Host "Updated $file"
    } else {
        Write-Host "$file already has Test Features link"
    }
}

Write-Host "`nDone! All files updated."

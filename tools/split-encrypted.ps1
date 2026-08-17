param(
    [Parameter(Mandatory = $false)]
    [string]$InputFile = ".\recruiter-brief.enc",

    [Parameter(Mandatory = $false)]
    [string]$OutputDirectory = ".\assets",

    [Parameter(Mandatory = $false)]
    [int]$ChunkSizeMiB = 55
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $InputFile -PathType Leaf)) {
    throw "Input file not found: $InputFile"
}

if ($ChunkSizeMiB -le 0 -or $ChunkSizeMiB -ge 100) {
    throw "ChunkSizeMiB must be greater than 0 and less than 100."
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$chunkSize = [int64]$ChunkSizeMiB * 1MB
$input = [System.IO.File]::OpenRead((Resolve-Path -LiteralPath $InputFile))
$buffer = New-Object byte[] (4MB)
$partNumber = 1

try {
    while ($input.Position -lt $input.Length) {
        $partPath = Join-Path $OutputDirectory ("recruiter-brief.enc.part{0}" -f $partNumber)
        $output = [System.IO.File]::Create($partPath)
        $writtenThisPart = [int64]0

        try {
            while ($writtenThisPart -lt $chunkSize -and $input.Position -lt $input.Length) {
                $remaining = $chunkSize - $writtenThisPart
                $toRead = [int][Math]::Min($buffer.Length, $remaining)
                $read = $input.Read($buffer, 0, $toRead)
                if ($read -le 0) { break }

                $output.Write($buffer, 0, $read)
                $writtenThisPart += $read
            }
        }
        finally {
            $output.Dispose()
        }

        $sizeMiB = [Math]::Round((Get-Item -LiteralPath $partPath).Length / 1MB, 2)
        Write-Host ("Created {0} ({1} MiB)" -f $partPath, $sizeMiB)
        $partNumber++
    }
}
finally {
    $input.Dispose()
}

Write-Host ""
Write-Host "Done. Commit the generated recruiter-brief.enc.part* files in the assets folder."
Write-Host "Do NOT commit the original MP4 or your access phrase."

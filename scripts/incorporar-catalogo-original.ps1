param(
  [Parameter(Mandatory = $false)]
  [string]$ZipPath = ".\svg e imagenes.zip"
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$Destino = Join-Path $RepoRoot "apps\web\public\catalogo-original"

$esperados = [ordered]@{
  "083288f88e6b2efbf89d1962ca9d761caa64b3d96a63a0dec2f9957c0bf4ab95" = "chorizo-coctelero.png"
  "e25eea18bda040bf79016ade8f4de1e10dece42f3f04a20e32bcfc8353270a66" = "chorizo-parrillero.png"
  "e9b85fedb35dd52cddce38dbaef3dad6bdd5953cb871ac818b2dd369d697df7a" = "chorizo-precocido.png"
  "9a7a743d4f9b7531ed07dd45f76e5bb557e6bc1a742071ad52c15a0f9c0d196d" = "chorizo-tipo-espanol.png"
  "ce338a28dd3b93269503a30c903a3530c99d3a59b7c99935d0412d9924ffd882" = "jamon-cocido-light.png"
  "c971d0e386ea5d64286fc33ef6733b5c9139f91820558fca098824d98f148c15" = "morcilla-artesanal.png"
  "19277c5585983881ae3de6baf20be6c192ce29fd86eb01f8218585f91aa93ab3" = "mortadela-jamonada.png"
  "bf655eba9d41d298f83dd710e9658359f2d7dac079c98c114955be698bc716ef" = "mortadela-primavera.png"
  "376f0ba872f33aa5daf039dc4069a18c434693e5e4ccb2edfee4989ee35e2f2e" = "mortadela-tradicional.png"
  "41fec00c48789346b0934a93cb5b934f305b187478b267523d33f456b134f8e2" = "queso-de-chancho.png"
  "bde86ffa121b79aeb77120be47a0729de37dc45dd7fd68474558846743a7ead3" = "salchicha-tipo-super-pancho.png"
  "1b3fb4f07cd4296eeee283c17e6f1aec14df47614a0e3a74e0f5314ae40bd354" = "salchicha-tipo-viena.png"
  "88d67e8f29272d710d513e4d521000fa79747546e523e9ca2b568d2a06b2f390" = "tocino-ahumado.png"
}

if (-not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) {
  throw "No se encontró el ZIP: $ZipPath"
}

New-Item -ItemType Directory -Force -Path $Destino | Out-Null
$temp = Join-Path ([System.IO.Path]::GetTempPath()) ("zav-catalogo-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $temp | Out-Null

Add-Type -AssemblyName System.IO.Compression.FileSystem

$encontrados = @{}

try {
  $zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ZipPath).Path)
  try {
    foreach ($entrada in $zip.Entries) {
      if (-not $entrada.Name.ToLowerInvariant().EndsWith(".png")) { continue }

      $temporal = Join-Path $temp ([Guid]::NewGuid().ToString("N") + ".png")
      [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entrada, $temporal, $true)
      $hash = (Get-FileHash -LiteralPath $temporal -Algorithm SHA256).Hash.ToLowerInvariant()

      if ($esperados.Contains($hash)) {
        $nombreFinal = $esperados[$hash]
        $salida = Join-Path $Destino $nombreFinal
        Copy-Item -LiteralPath $temporal -Destination $salida -Force
        $encontrados[$hash] = $nombreFinal
        Write-Host ("OK  " + $nombreFinal + "  " + $hash) -ForegroundColor Green
      }

      Remove-Item -LiteralPath $temporal -Force
    }
  }
  finally {
    $zip.Dispose()
  }

  $faltantes = @()
  foreach ($hash in $esperados.Keys) {
    $nombre = $esperados[$hash]
    $ruta = Join-Path $Destino $nombre
    if (-not (Test-Path -LiteralPath $ruta -PathType Leaf)) {
      $faltantes += $nombre
      continue
    }
    $hashActual = (Get-FileHash -LiteralPath $ruta -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hashActual -ne $hash) {
      throw "El archivo $nombre no coincide con el SHA-256 original."
    }
  }

  if ($faltantes.Count -gt 0) {
    throw ("Faltan " + $faltantes.Count + " imágenes originales: " + ($faltantes -join ", "))
  }

  Write-Host ""
  Write-Host "Catálogo original verificado: 13/13 PNG sin conversión, recomprensión ni retoque." -ForegroundColor Cyan
  Write-Host "Destino: $Destino"
  Write-Host "Siguiente verificación: git status --short"
}
finally {
  if (Test-Path -LiteralPath $temp) {
    Remove-Item -LiteralPath $temp -Recurse -Force
  }
}

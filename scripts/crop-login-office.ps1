Add-Type -AssemblyName System.Drawing
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$src = Join-Path $root "public\login-office.jpg"
$out = Join-Path $root "public\login-office-scene.jpg"
$img = [System.Drawing.Image]::FromFile($src)
$x = 0
$y = [int]($img.Height * 0.30)
$cropW = [int]($img.Width * 0.58)
$cropH = [int]($img.Height * 0.48)
$rect = New-Object System.Drawing.Rectangle $x, $y, $cropW, $cropH
$bmp = New-Object System.Drawing.Bitmap $cropW, $cropH
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$dest = New-Object System.Drawing.Rectangle 0, 0, $cropW, $cropH
$g.DrawImage($img, $dest, $rect, [System.Drawing.GraphicsUnit]::Pixel)
$encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$quality = New-Object System.Drawing.Imaging.EncoderParameters 1
$quality.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, 88L)
$bmp.Save($out, $encoder, $quality)
$g.Dispose()
$bmp.Dispose()
$img.Dispose()
Write-Output ("saved scene " + $cropW + "x" + $cropH)

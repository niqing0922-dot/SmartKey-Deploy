$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName WindowsBase

$root = Resolve-Path "$PSScriptRoot\.."
$buildDir = Join-Path $root 'desktop\build'
$svgPath = Join-Path $buildDir 'icon.svg'
$pngPath = Join-Path $buildDir 'icon.png'
$icoPath = Join-Path $buildDir 'icon.ico'

New-Item -ItemType Directory -Force $buildDir | Out-Null

$svg = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 42" fill="none">
  <rect x="1" y="1" width="40" height="40" rx="12" fill="#0F172A"/>
  <rect x="1" y="1" width="40" height="40" rx="12" stroke="#3B82F6" stroke-width="2"/>
  <path d="M12 22.5h11.2c3.1 0 5.3-2 5.3-4.8S26.3 13 23.2 13H12v16h5v-11h5.6c.7 0 1.2.4 1.2 1s-.5 1-1.2 1H12v2.5Z" fill="#F8FAFC"/>
  <path d="M21.7 29 31 13h-5.4l-9.3 16h5.4Z" fill="#60A5FA"/>
</svg>
'@
Set-Content -Path $svgPath -Value $svg -Encoding utf8

function New-SolidBrush([byte]$r, [byte]$g, [byte]$b) {
  return [System.Windows.Media.SolidColorBrush]::new([System.Windows.Media.Color]::FromRgb($r, $g, $b))
}

function Write-Png($path, $size) {
  $canvas = 42.0
  $scale = $size / $canvas
  $visual = [System.Windows.Media.DrawingVisual]::new()
  $context = $visual.RenderOpen()
  $context.PushTransform([System.Windows.Media.ScaleTransform]::new($scale, $scale))

  $backgroundBrush = New-SolidBrush 0x0F 0x17 0x2A
  $borderBrush = New-SolidBrush 0x3B 0x82 0xF6
  $whiteBrush = New-SolidBrush 0xF8 0xFA 0xFC
  $blueBrush = New-SolidBrush 0x60 0xA5 0xFA

  $borderPen = [System.Windows.Media.Pen]::new($borderBrush, 2)
  $context.DrawRoundedRectangle($backgroundBrush, $borderPen, [System.Windows.Rect]::new(1, 1, 40, 40), 12, 12)

  $primaryGeometry = [System.Windows.Media.Geometry]::Parse('M12 22.5h11.2c3.1 0 5.3-2 5.3-4.8S26.3 13 23.2 13H12v16h5v-11h5.6c.7 0 1.2.4 1.2 1s-.5 1-1.2 1H12v2.5Z')
  $accentGeometry = [System.Windows.Media.Geometry]::Parse('M21.7 29 31 13h-5.4l-9.3 16h5.4Z')
  $context.DrawGeometry($whiteBrush, $null, $primaryGeometry)
  $context.DrawGeometry($blueBrush, $null, $accentGeometry)
  $context.Pop()
  $context.Close()

  $bitmap = [System.Windows.Media.Imaging.RenderTargetBitmap]::new($size, $size, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
  $bitmap.Render($visual)
  $encoder = [System.Windows.Media.Imaging.PngBitmapEncoder]::new()
  $encoder.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
  $stream = [System.IO.File]::Create($path)
  try {
    $encoder.Save($stream)
  } finally {
    $stream.Dispose()
  }
}

function Write-IcoFromPng($pngSourcePath, $icoTargetPath) {
  [byte[]]$pngBytes = [System.IO.File]::ReadAllBytes($pngSourcePath)
  $stream = [System.IO.File]::Create($icoTargetPath)
  $writer = [System.IO.BinaryWriter]::new($stream)
  try {
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]1)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$pngBytes.Length)
    $writer.Write([UInt32]22)
    $writer.Write($pngBytes)
  } finally {
    $writer.Dispose()
    $stream.Dispose()
  }
}

$tmpPng = Join-Path $buildDir 'icon-256.png'
Write-Png -path $pngPath -size 512
Write-Png -path $tmpPng -size 256
Write-IcoFromPng -pngSourcePath $tmpPng -icoTargetPath $icoPath
Remove-Item $tmpPng -Force

Write-Output "Generated desktop icons:"
Write-Output " - $svgPath"
Write-Output " - $pngPath"
Write-Output " - $icoPath"

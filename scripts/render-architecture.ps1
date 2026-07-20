param(
    [string]$OutputPath = (Join-Path $PSScriptRoot '..\docs\images\supplyswarm-architecture.png')
)

Add-Type -AssemblyName System.Drawing

$width = 1800
$height = 1100
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
$graphics.Clear([System.Drawing.Color]::FromArgb(247, 250, 255))

function New-Brush([string]$hex) {
    return New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function New-Pen([string]$hex, [float]$size = 2) {
    $pen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml($hex), $size)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    return $pen
}

function Draw-RoundedRect($g, $pen, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [float]$r = 18) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    if ($brush) { $g.FillPath($brush, $path) }
    if ($pen) { $g.DrawPath($pen, $path) }
    $path.Dispose()
}

function Draw-Text([string]$text, $font, $brush, [float]$x, [float]$y, [float]$w, [float]$h, [string]$align = 'Near') {
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::$align
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
    $graphics.DrawString($text, $font, $brush, (New-Object System.Drawing.RectangleF($x, $y, $w, $h)), $format)
    $format.Dispose()
}

function Draw-Arrow([float]$x1, [float]$y1, [float]$x2, [float]$y2, [string]$hex = '#3976D9', [float]$size = 4) {
    $pen = New-Pen $hex $size
    $pen.CustomEndCap = New-Object System.Drawing.Drawing2D.AdjustableArrowCap(5, 7, $true)
    $graphics.DrawLine($pen, $x1, $y1, $x2, $y2)
    $pen.Dispose()
}

$titleFont = New-Object System.Drawing.Font('Segoe UI', 34, [System.Drawing.FontStyle]::Bold)
$subtitleFont = New-Object System.Drawing.Font('Segoe UI', 16, [System.Drawing.FontStyle]::Regular)
$sectionFont = New-Object System.Drawing.Font('Segoe UI', 17, [System.Drawing.FontStyle]::Bold)
$boxTitleFont = New-Object System.Drawing.Font('Segoe UI', 14, [System.Drawing.FontStyle]::Bold)
$boxFont = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Regular)
$smallFont = New-Object System.Drawing.Font('Segoe UI', 11, [System.Drawing.FontStyle]::Regular)

$ink = New-Brush '#10264B'
$muted = New-Brush '#52647F'
$blue = New-Brush '#1769E0'
$blueSoft = New-Brush '#E7F0FF'
$blueLine = New-Pen '#3976D9' 2
$cloudSoft = New-Brush '#EAF8F5'
$cloudLine = New-Pen '#22A581' 2
$qwenSoft = New-Brush '#F0EAFE'
$qwenLine = New-Pen '#7C56D9' 2
$white = New-Brush '#FFFFFF'
$neutralLine = New-Pen '#CBD7E8' 2
$darkBlue = New-Brush '#0B4DB8'

Draw-Text 'SupplySwarm system architecture' $titleFont $ink 70 34 1660 58 'Near'
Draw-Text 'Track 3: Agent Society | Qwen Cloud reasoning and search | Alibaba Cloud deployment' $subtitleFont $muted 72 90 1650 36 'Near'

# Clients
Draw-RoundedRect $graphics $blueLine $blueSoft 70 170 300 770 24
Draw-Text 'USER EXPERIENCES' $sectionFont $darkBlue 95 190 250 40 'Near'

Draw-RoundedRect $graphics $neutralLine $white 100 270 240 130 16
Draw-Text 'Browser console' $boxTitleFont $ink 120 282 200 32 'Near'
Draw-Text "Typed or voice brief`nLive agent dialogue`nEvidence-linked results" $boxFont $muted 120 318 200 70 'Near'

Draw-RoundedRect $graphics $neutralLine $white 100 445 240 130 16
Draw-Text 'WebXR operations room' $boxTitleFont $ink 120 457 200 34 'Near'
Draw-Text "VR / AR agents`nController-ray input`nAutonomy mode picker" $boxFont $muted 120 493 200 72 'Near'

Draw-RoundedRect $graphics $neutralLine $white 100 620 240 130 16
Draw-Text 'Paired phone' $boxTitleFont $ink 120 632 200 32 'Near'
Draw-Text "5-letter pairing code`nInspect + request`nDownload PDF" $boxFont $muted 120 668 200 70 'Near'

# Alibaba Cloud boundary
Draw-RoundedRect $graphics $cloudLine $cloudSoft 445 145 770 835 28
Draw-Text 'ALIBABA CLOUD - SINGAPORE' $sectionFont (New-Brush '#08715A') 475 170 700 38 'Near'
Draw-Text 'Simple Application Server | Ubuntu 24.04 | Docker | public HTTPS' $smallFont $muted 477 207 700 28 'Near'

Draw-RoundedRect $graphics $neutralLine $white 485 260 690 92 16
Draw-Text 'Caddy HTTPS gateway' $boxTitleFont $ink 510 272 280 30 'Near'
Draw-Text 'Public HTTPS  ->  Docker port 3000' $boxFont $muted 510 303 620 32 'Near'

Draw-RoundedRect $graphics $blueLine $white 485 385 690 535 20
Draw-Text 'Node.js / Express application container' $boxTitleFont $darkBlue 515 400 620 36 'Near'

Draw-RoundedRect $graphics $neutralLine $blueSoft 520 465 270 100 14
Draw-Text 'API + WebSocket hub' $boxTitleFont $ink 540 474 230 28 'Near'
Draw-Text "/api/plan, speech, image`nLive session pairing + relay" $boxFont $muted 540 506 230 48 'Near'

Draw-RoundedRect $graphics $neutralLine $blueSoft 835 465 300 100 14
Draw-Text 'Persistent swarm memory' $boxTitleFont $ink 855 474 260 28 'Near'
Draw-Text "Per-role mission facts`nDeterministic recall" $boxFont $muted 855 506 260 48 'Near'

Draw-RoundedRect $graphics $blueLine $white 520 615 615 245 16
Draw-Text 'Agent Society orchestrator' $boxTitleFont $ink 545 626 565 32 'Near'

Draw-RoundedRect $graphics $null $blueSoft 545 685 130 62 12
Draw-Text 'Coordinator' $boxFont $ink 550 690 120 52 'Center'
Draw-RoundedRect $graphics $null $blueSoft 705 685 170 62 12
Draw-Text "Specialists x N`nparallel search" $boxFont $ink 710 685 160 52 'Center'
Draw-RoundedRect $graphics $null $blueSoft 905 685 190 62 12
Draw-Text "Solo-agent control`nparallel baseline" $boxFont $ink 910 685 180 52 'Center'

Draw-Arrow 675 716 705 716 '#3976D9' 3
Draw-Arrow 875 716 905 716 '#3976D9' 3

Draw-RoundedRect $graphics $null (New-Brush '#FFF5DA') 605 785 450 50 12
Draw-Text 'Deterministic validators -> Critic -> budget-valid plan' $boxFont $ink 620 790 420 40 'Center'

# Qwen Cloud
Draw-RoundedRect $graphics $qwenLine $qwenSoft 1290 170 440 770 24
Draw-Text 'QWEN CLOUD / DASHSCOPE' $sectionFont (New-Brush '#6240B5') 1320 190 380 40 'Near'

Draw-RoundedRect $graphics $neutralLine $white 1330 280 360 110 16
Draw-Text 'Qwen 3.7 Plus' $boxTitleFont $ink 1355 292 310 30 'Near'
Draw-Text "Coordinator, negotiation, Critic`nJSON role planning" $boxFont $muted 1355 325 310 50 'Near'

Draw-RoundedRect $graphics $neutralLine $white 1330 430 360 120 16
Draw-Text 'Qwen live web search' $boxTitleFont $ink 1355 442 310 30 'Near'
Draw-Text "Forced search + cited sources`nAlibaba listing evidence allow-list" $boxFont $muted 1355 475 310 58 'Near'

Draw-RoundedRect $graphics $neutralLine $white 1330 590 360 105 16
Draw-Text 'Qwen ASR' $boxTitleFont $ink 1355 602 310 30 'Near'
Draw-Text 'Voice brief transcription' $boxFont $muted 1355 635 310 40 'Near'

Draw-RoundedRect $graphics $neutralLine $white 1330 735 360 105 16
Draw-Text 'Qwen Image' $boxTitleFont $ink 1355 747 310 30 'Near'
Draw-Text 'Business concept visual' $boxFont $muted 1355 780 310 40 'Near'

# Inter-system flows
Draw-Arrow 370 510 445 510 '#3976D9' 5
Draw-Text 'HTTPS + WSS' $smallFont $muted 373 475 70 28 'Center'
Draw-Arrow 1215 500 1290 500 '#7C56D9' 5
Draw-Text 'Qwen API' $smallFont $muted 1217 465 70 28 'Center'

Draw-Text 'Transparent agent dialogue' $smallFont $muted 76 965 300 32 'Center'
Draw-Text 'Hosted backend + deterministic controls' $smallFont $muted 480 995 700 32 'Center'
Draw-Text 'Model reasoning + grounded search' $smallFont $muted 1315 965 390 32 'Center'

$outputDirectory = Split-Path -Parent $OutputPath
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$titleFont.Dispose(); $subtitleFont.Dispose(); $sectionFont.Dispose(); $boxTitleFont.Dispose(); $boxFont.Dispose(); $smallFont.Dispose()
$ink.Dispose(); $muted.Dispose(); $blue.Dispose(); $blueSoft.Dispose(); $blueLine.Dispose(); $cloudSoft.Dispose(); $cloudLine.Dispose(); $qwenSoft.Dispose(); $qwenLine.Dispose(); $white.Dispose(); $neutralLine.Dispose(); $darkBlue.Dispose()
$graphics.Dispose(); $bitmap.Dispose()

Write-Output $OutputPath

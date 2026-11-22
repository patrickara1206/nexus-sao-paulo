param([Parameter(Mandatory)][string]$Source)

Add-Type -AssemblyName System.Drawing
$scan = [System.Drawing.Bitmap]::new((Resolve-Path -LiteralPath $Source).Path)
$atlas = [System.Drawing.Bitmap]::new(512, 512)
$size = 256

# Cut leaf silhouettes from the CC0 Poly Haven diffuse texture at its 1K size.
function Get-Leaf($outline) {
    $x = [int]($outline.x | Measure-Object -Minimum).Minimum
    $y = [int]($outline.y | Measure-Object -Minimum).Minimum
    $w = [int]($outline.x | Measure-Object -Maximum).Maximum - $x + 1
    $h = [int]($outline.y | Measure-Object -Maximum).Maximum - $y + 1
    $leaf = [System.Drawing.Bitmap]::new($w, $h)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddPolygon([System.Drawing.Point[]]($outline | ForEach-Object {
        [System.Drawing.Point]::new($_.x - $x, $_.y - $y)
    }))
    for ($row = 0; $row -lt $h; $row++) {
        for ($col = 0; $col -lt $w; $col++) {
            if (!$path.IsVisible($col, $row)) { continue }
            $p = $scan.GetPixel($x + $col, $y + $row)
            $alpha = [int][Math]::Clamp(($p.G - 19) * 8, 0, 255)
            $leaf.SetPixel($col, $row, [System.Drawing.Color]::FromArgb($alpha, $p.R, $p.G, $p.B))
        }
    }
    $path.Dispose()
    $leaf
}

function Get-Outline([int[]]$points) {
    for ($i = 0; $i -lt $points.Length; $i += 2) {
        [System.Drawing.Point]::new($points[$i], $points[$i + 1])
    }
}

$leaves = @(
    Get-Leaf (Get-Outline @(63,69,78,58,99,56,130,60,154,71,173,86,184,107,183,123,166,132,142,132,114,123,94,111,73,92))
    Get-Leaf (Get-Outline @(222,85,246,77,274,69,305,73,327,82,342,94,342,107,318,119,288,125,263,118,240,106))
    Get-Leaf (Get-Outline @(33,260,53,237,84,212,113,200,147,190,173,187,188,199,181,217,162,239,128,264,82,282,52,285,34,277))
)
$paint = [System.Drawing.Graphics]::FromImage($atlas)
$paint.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$paint.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$random = [System.Random]::new(521)
$twig = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(220, 83, 94, 53), 1.5)

for ($tile = 0; $tile -lt 4; $tile++) {
    $originX = $size * ($tile % 2) + $size / 2
    $originY = $size * [Math]::Floor($tile / 2) + $size / 2
    for ($stem = 0; $stem -lt 14; $stem++) {
        $angle = $stem * 2.399963 + $random.NextDouble() * .35
        $reach = 54 + $random.NextDouble() * 43
        $axisX = [Math]::Cos($angle)
        $axisY = [Math]::Sin($angle)
        $start = 3 + $random.NextDouble() * 22
        $paint.DrawLine($twig, [single]($originX + $axisX * $start), [single]($originY + $axisY * $start),
            [single]($originX + $axisX * $reach), [single]($originY + $axisY * $reach))
        for ($pair = 0; $pair -lt 6; $pair++) {
            $distance = $start + ($reach - $start) * ($pair / 5)
            $lean = ((-1) * ($pair % 2 * 2 - 1)) * (.46 + $random.NextDouble() * .77)
            $leafAngle = $angle + $lean
            $width = 20 + $random.NextDouble() * 20 - $pair
            $height = $width * (.42 + $random.NextDouble() * .2)
            $paint.TranslateTransform([single]($originX + $axisX * $distance), [single]($originY + $axisY * $distance))
            $paint.RotateTransform([single]($leafAngle * 180 / [Math]::PI))
            $paint.DrawImage($leaves[$random.Next($leaves.Length)], [single]-3, [single](-$height / 2), [single]$width, [single]$height)
            $paint.ResetTransform()
        }
    }
}

$out = Join-Path (Resolve-Path 'public/assets/props').Path 'tree-crown.png'
$atlas.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$twig.Dispose()
$paint.Dispose()
foreach ($leaf in $leaves) { $leaf.Dispose() }
$atlas.Dispose()
$scan.Dispose()

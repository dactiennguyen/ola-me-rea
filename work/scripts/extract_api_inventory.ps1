param(
  [string]$DartRoot = "work/dae-aot-20261102/dart",
  [string]$Output = "work/api_inventory.csv"
)

$rows = @()
$endpointPattern = '"((?:faApi2|napi)/[^"\r\n]+)"'
$methodPattern = 'Dio[^\r\n]*(?:_)?(get|post|put|patch|delete)\s*\('
$keyPattern = '"([A-Za-z][A-Za-z0-9_:-]{1,48})"'

Get-ChildItem -LiteralPath $DartRoot -Filter '*.dart' -File | ForEach-Object {
  $file = $_
  $lines = Get-Content -LiteralPath $file.FullName
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $m = [regex]::Match($lines[$i], $endpointPattern)
    if (-not $m.Success) { continue }
    $endpoint = $m.Groups[1].Value
    $method = 'unknown'
    for ($j = $i; $j -le [Math]::Min($i + 12, $lines.Count - 1); $j++) {
      $mm = [regex]::Match($lines[$j], $methodPattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
      if ($mm.Success) { $method = $mm.Groups[1].Value.ToUpperInvariant(); break }
    }
    $keys = [System.Collections.Generic.List[string]]::new()
    $lo = [Math]::Max(0, $i - 80); $hi = [Math]::Min($lines.Count - 1, $i + 8)
    for ($j = $lo; $j -le $hi; $j++) {
      $km = [regex]::Matches($lines[$j], $keyPattern)
      foreach ($k in $km) {
        $v = $k.Groups[1].Value
        if ($v -notmatch '^(faApi2|napi|Dio|Object|Function|Type|Field|String|ImmutableArray|Map|data|json|true|false|null)$' -and $v -notmatch '^0x[0-9a-f]+$') {
          if (-not $keys.Contains($v)) { $keys.Add($v) }
        }
      }
    }
    $rows += [pscustomobject]@{
      Endpoint = $endpoint
      Method = $method
      File = $file.Name
      Line = $i + 1
      CandidateKeys = ($keys -join ';')
    }
  }
}

$rows | Sort-Object Endpoint, File, Line | Export-Csv -LiteralPath $Output -NoTypeInformation -Encoding utf8
Write-Output ("Wrote {0} rows to {1}" -f $rows.Count, $Output)

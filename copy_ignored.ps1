$source = "C:\Users\Steve\Downloads\dl_m\database"
$dest = "c:\Users\Steve\Desktop\databasemain\database"
$items = @(
  ".claude/skills/build",
  ".claude/skills/loki-mode/examples/todo-app-generated/backend/package-lock.json",
  ".claude/skills/loki-mode/examples/todo-app-generated/frontend/package-lock.json",
  ".claude/skills/ui-ux-pro-max/scripts/__pycache__",
  "backend/.env",
  "backend/app/__pycache__",
  "backend/app/api/__pycache__",
  "backend/app/api/endpoints/__pycache__",
  "backend/app/core/__pycache__",
  "backend/app/models/__pycache__",
  "backend/app/services/__pycache__",
  "backend/venv",
  "frontend/.env.local",
  "frontend/.next",
  "frontend/next-env.d.ts",
  "frontend/node_modules",
  "frontend/package-lock.json",
  "frontend/tsconfig.tsbuildinfo",
  "serviceAccountKey.json"
)

foreach ($item in $items) {
  $srcItem = Join-Path $source $item
  $destItem = Join-Path $dest $item
  
  if (Test-Path $srcItem) {
    $parent = Split-Path $destItem -Parent
    if (-not (Test-Path $parent)) {
      New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    Copy-Item -Path $srcItem -Destination $destItem -Recurse -Force
    Write-Output "Copied $item"
  } else {
    Write-Output "Skipped $item (not found)"
  }
}

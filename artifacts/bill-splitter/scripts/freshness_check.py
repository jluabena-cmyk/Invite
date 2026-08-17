#!/usr/bin/env python3
"""
freshness_check.py — Check that key source files are not stale.

Usage:
    python3 freshness_check.py <app_dir> <max_age_hours> <strict>

Arguments:
    app_dir        Root directory that contains the key source files.
    max_age_hours  Staleness threshold in hours (float).
    strict         "true" to exit 1 on stale files; any other value to warn only.

Exit codes:
    0  All files are fresh (or stale files found but strict=false).
    1  Stale files found AND strict=true.

Key files checked:
    app.json, app.config.js, app/_layout.tsx, app/index.tsx
"""
import os
import sys
import time

app_dir = sys.argv[1]
max_age_h = float(sys.argv[2])
strict = sys.argv[3].lower() == "true"
max_age_s = max_age_h * 3600
now = time.time()

KEY_FILES = [
    "app.json",
    "app.config.js",
    "app/_layout.tsx",
    "app/index.tsx",
]

stale = []
ok = []
missing = []

for rel in KEY_FILES:
    path = os.path.join(app_dir, rel)
    if not os.path.exists(path):
        missing.append(rel)
        continue
    age_s = now - os.path.getmtime(path)
    age_h = age_s / 3600
    age_min = age_s / 60
    if age_h >= 1:
        age_str = f"{age_h:.1f}h ago"
    else:
        age_str = f"{age_min:.0f}m ago"
    if age_s > max_age_s:
        stale.append((rel, age_str, age_h))
    else:
        ok.append((rel, age_str))

# Print table
print(f"  {'File':<35} {'Last Modified':<14} Status")
print(f"  {'-'*35} {'-'*14} ------")
for rel, age_str in ok:
    print(f"  {rel:<35} {age_str:<14} OK")
for rel, age_str, _ in stale:
    print(f"  {rel:<35} {age_str:<14} *** STALE ***")
for rel in missing:
    print(f"  {rel:<35} {'(not found)':<14} MISSING")

if stale:
    print("")
    print("  !! STALE SOURCE FILES DETECTED !!")
    print("  ==================================")
    print(f"  {len(stale)} file(s) are older than the {max_age_h:.0f}h freshness threshold.")
    print("")
    print("  This likely means you are building from a Mac folder that has not been")
    print("  synced with the latest Replit code.  Previous builds have been wasted")
    print("  this way (wrong build number, missing fixes, hours of debugging).")
    print("")
    print("  To sync the latest code from Replit before building, run:")
    print("    bash scripts/sync-from-replit.sh")
    print("")
    if strict:
        print("  --strict-freshness is set: aborting build.")
        sys.exit(1)
    else:
        print("  Continuing anyway (pass --strict-freshness to abort on stale files).")
        print("  Override threshold: --max-age-hours=N  or  FRESHNESS_WARN_HOURS=N")
else:
    print(f"  All {len(ok)} key source files are fresh (within {max_age_h:.0f}h). ✓")

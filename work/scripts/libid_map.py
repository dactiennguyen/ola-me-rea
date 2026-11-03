import re, sys, collections
src, out = sys.argv[1], sys.argv[2]
groups = collections.defaultdict(set)
for line in open(src, encoding='utf-8', errors='replace'):
    for m in re.finditer(r'([A-Za-z_$][A-Za-z0-9_$&]*)@(\d{6,10})', line):
        groups[m.group(2)].add(m.group(1))
with open(out, 'w', encoding='utf-8') as f:
    for lid, names in sorted(groups.items(), key=lambda kv: -len(kv[1])):
        f.write(f"@{lid} ({len(names)}): {' '.join(sorted(names))}\n")
print(len(groups), "libraries")

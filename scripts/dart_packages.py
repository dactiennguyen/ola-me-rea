import re, sys, collections

data = open(sys.argv[1], 'rb').read()
pkgs = collections.Counter()
for m in re.finditer(rb'package:([a-z0-9_]+)/([A-Za-z0-9_/\.]+\.dart)', data):
    pkgs[m.group(1).decode()] += 1
for name, n in sorted(pkgs.items()):
    print(f"{n:6d}  {name}")
print("TOTAL packages:", len(pkgs), file=sys.stderr)

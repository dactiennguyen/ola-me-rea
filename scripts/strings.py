import re, sys

data = open(sys.argv[1], 'rb').read()
minlen = int(sys.argv[2]) if len(sys.argv) > 2 else 4
with open(sys.argv[3] if len(sys.argv) > 3 else '/dev/stdout', 'w', encoding='utf-8') as out:
    for m in re.finditer(rb'[\x20-\x7e]{%d,}' % minlen, data):
        out.write(m.group().decode('ascii') + '\n')

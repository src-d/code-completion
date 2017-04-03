import re


NAME_BREAKUP_RE = re.compile(r"[^a-zA-Z]+")


def extract_names(token):
    token = token.strip()
    prev_p = [""]

    def ret(name):
        r = name.lower()
        if len(name) >= 3:
            yield r
            if prev_p[0]:
                yield prev_p[0] + r
                prev_p[0] = ""
        else:
            prev_p[0] = r

    for part in NAME_BREAKUP_RE.split(token):
        if not part:
            continue
        prev = part[0]
        pos = 0
        for i in range(1, len(part)):
            this = part[i]
            if prev.islower() and this.isupper():
                yield from ret(part[pos:i])
                pos = i
            elif prev.isupper() and this.islower():
                if 0 < i - 1 - pos <= 3:
                    yield from ret(part[pos:i - 1])
                    pos = i - 1
                elif i - 1 > pos:
                    yield from ret(part[pos:i])
                    pos = i
            prev = this
        last = part[pos:]
        if last:
            yield from ret(last)

import numpy


class VariadicToken(object):
    def __init__(self, name):
        self.name = name

    def __repr__(self):
        return self.name

    def __hash__(self):
        return hash(self.name)


ID_LIT_BOOL = VariadicToken("ID_LIT_BOOL")
ID_LIT_CHAR = VariadicToken("ID_LIT_CHAR")
ID_LIT_FLOAT = VariadicToken("ID_LIT_FLOAT")
ID_LIT_IMAG = VariadicToken("ID_LIT_IMAG")
ID_LIT_INT = VariadicToken("ID_LIT_INT")
ID_LIT_STR = VariadicToken("ID_LIT_STR")
ID_S = VariadicToken("ID_S")


_tokens = [
    "!", "!=", "%", "&", "&&", "&=", "&^", "&^=", "(", ")", "*", "*=", "+",
    "++", "+=", ",", "-", "--", "-=", ".", "...", "/", "/=", ":", ":=", ";",
    "<", "<-", "<<", "<<=", "<=", "=", "==", ">", ">=", ">>", ">>=", "[", "]",
    "^", "^=", "break", "case", "chan", "const", "continue", "default",
    "defer", "else", "err", "fallthrough", "for", "func", "go", "goto", "if",
    "import", "interface", "map", "nil", "package", "range", "return",
    "select", "struct", "switch", "type", "var", "{", "|", "|=", "||", "}",
    ID_LIT_BOOL, ID_LIT_CHAR, ID_LIT_FLOAT, ID_LIT_IMAG, ID_LIT_INT,
    ID_LIT_STR, ID_S
]


def _index2array(i):
    arr = numpy.zeros(len(_tokens), dtype=numpy.float32)
    arr[i] = 1
    return arr


token_map = {t: _index2array(i) for i, t in enumerate(_tokens)}


def prediction2token(preds, number):
    indices = numpy.argsort(preds)[::-1][:number]
    return [_tokens[i] for i in indices]

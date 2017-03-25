import argparse
import os
import pickle
import re
import sys

from keras import models, layers, regularizers, optimizers
import numpy

from tokens import ID_S


NAME_BREAKUP_RE = re.compile(r"[^a-zA-Z]+")


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--maxlines", type=int, default=0)
    parser.add_argument("--maxlen", type=int, default=100)
    parser.add_argument("--start-offset", type=int, default=1)
    parser.add_argument("--neurons", type=int, default=128)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--type", default="LSTM")
    parser.add_argument("--dropout", type=float, default=0)
    parser.add_argument("--regularization", type=float, default=0)
    parser.add_argument("--recurrent-dropout", type=float, default=0)
    parser.add_argument("--activation", default="sigmoid")
    parser.add_argument("--optimizer", default="rmsprop")
    parser.add_argument("--batch_size", type=int, default=128)
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--cache", action="store_true")
    return parser.parse_args()


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


def main():
    args = parse_args()
    maxlen = args.maxlen
    maxlines = args.maxlines
    start_offset = args.start_offset

    if os.path.exists(args.input + ".pickle"):
        print("loading the cached dataset...")
        with open(args.input + ".pickle", "rb") as fin:
            x, y = pickle.load(fin)
    else:
        x = []
        y = []
        vocabulary = {}
        with open(args.input) as fin:
            for lineno, line in enumerate(fin):
                if lineno % 1000 == 0:
                    print("line #%d" % lineno)
                if lineno > maxlines > 0:
                    break
                ctx = eval(line)
                word = False
                for c in ctx:
                    if c == ID_S:
                        word = True
                    elif word:
                        for part in extract_names(c):
                            vocabulary.setdefault(part, len(vocabulary))
        with open(args.input) as fin:
            for lineno, line in enumerate(fin):
                if lineno % 1000 == 0:
                    print("line #%d" % lineno)
                if lineno > maxlines > 0:
                    break
                ctx = eval(line)
                word = False
                words = []
                for c in ctx:
                    if c == ID_S:
                        word = True
                    elif word:
                        words.append(tuple(
                            vocabulary[p] for p in extract_names(c)))
                for i in range(start_offset, len(words)):
                    sample = numpy.zeros((maxlen, len(vocabulary)),
                                         dtype=numpy.float32)
                    for j in range(maxlen):
                        k = i - maxlen + j
                        if k >= 0:
                            for c in words[k]:
                                sample[j, c] = 1
                    x.append(sample)
                    myy = numpy.zeros(len(vocabulary), dtype=numpy.float32)
                    for c in words[i]:
                        myy[c] = 1
                    myy /= len(words[i])
                    y.append(myy)
        x = numpy.array(x, dtype=numpy.float32)
        y = numpy.array(y, dtype=numpy.float32)
        if args.cache:
            print("saving the cache...")
            try:
                with open(args.input + ".pickle", "wb") as fout:
                    pickle.dump((x, y), fout, protocol=-1)
            except Exception as e:
                print(type(e), e)
    print("x:", x.shape)
    print("y:", y.shape)
    model = train(x, y, **args.__dict__)
    model.save(args.output, overwrite=True)


def train(x, y, **kwargs):
    neurons = kwargs.get("neurons", 128)
    learning_rate = kwargs.get("learning_rate", 0.001)
    dropout = kwargs.get("dropout", 0)
    recurrent_dropout = kwargs.get("recurrent_dropout", 0)
    activation = kwargs.get("activation", "sigmoid")
    optimizer = kwargs.get("optimizer", "rmsprop")
    regularization = kwargs.get("regularization", 0)
    batch_size = kwargs.get("batch_size", 128)
    epochs = kwargs.get("epochs", 50)
    layer_type = kwargs.get("type", "LSTM")
    model = models.Sequential()
    model.add(getattr(layers, layer_type)(
        neurons, dropout=dropout, recurrent_dropout=recurrent_dropout,
        kernel_regularizer=regularizers.l2(regularization),
        input_shape=x[0].shape))
    model.add(layers.Dense(x[0].shape[-1], activation=activation))
    optimizer = getattr(optimizers, optimizer)(lr=learning_rate, clipnorm=1.)
    model.compile(loss="categorical_crossentropy",
                  optimizer=optimizer, metrics=["accuracy"])
    model.fit(x, y, batch_size=batch_size, epochs=epochs)
    return model


if __name__ == "__main__":
    sys.exit(main())

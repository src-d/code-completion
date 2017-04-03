import argparse
import os
import pickle
import sys

from keras import models, layers, regularizers, optimizers

from tokens import *
from common import extract_names


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--maxlines", type=int, default=0)
    parser.add_argument("--maxlen", type=int, default=100)
    parser.add_argument("--start-offset", type=int, default=4)
    parser.add_argument("--validation", type=float, default=0)
    parser.add_argument("--neurons", type=int, default=128)
    parser.add_argument("--dense-neurons", type=int, default=0)
    parser.add_argument("--learning-rate", type=float, default=0.001)
    parser.add_argument("--type", default="LSTM")
    parser.add_argument("--dropout", type=float, default=0)
    parser.add_argument("--regularization", type=float, default=0)
    parser.add_argument("--recurrent-dropout", type=float, default=0)
    parser.add_argument("--activation", default="tanh")
    parser.add_argument("--optimizer", default="rmsprop")
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--cache", action="store_true")
    parser.add_argument("--unified", action="store_true",
                        help="The input format is the same as in train_ids.py")
    parser.add_argument("--word2vec", help="Use word2vec embeddings from the "
                                           "specified pickle file.")
    return parser.parse_args()


def main():
    args = parse_args()
    maxlen = args.maxlen
    maxlines = args.maxlines
    start_offset = args.start_offset
    args.unified |= bool(args.word2vec)

    if args.word2vec:
        print("reading word2vec...")
        with open(args.word2vec, "rb") as fin:
            w2v = pickle.load(fin)
        words = w2v[0]
        embeddings = w2v[-1]
        word_map = {w: i for i, w in enumerate(words)}
        del words

    if os.path.exists(args.input + ".pickle"):
        print("loading the cached dataset...")
        with open(args.input + ".pickle", "rb") as fin:
            x, y = pickle.load(fin)
    else:
        x = []
        y = []
        dims = len(token_map)
        if args.word2vec:
            dims += len(embeddings[0])
        with open(args.input, errors="ignore") as fin:
            for lineno, line in enumerate(fin):
                if lineno % 1000 == 0:
                    print("line #%d" % lineno)
                if lineno > maxlines > 0:
                    break
                ctx = eval(line)
                if args.unified:
                    if not args.word2vec:
                        ctx = [c for i, c in enumerate(ctx)
                               if i == 0 or ctx[i - 1] != ID_S]
                    else:
                        new_ctx = []
                        for i, c in enumerate(ctx):
                            if i == 0 or (ctx[i - 1] != ID_S and ctx[i] != ID_S):
                                new_ctx.append(c)
                                continue
                            if ctx[i] == ID_S:
                                continue
                            id_s_inserted = False
                            for part in extract_names(c):
                                pi = word_map.get(part)
                                if pi is not None:
                                    if not id_s_inserted:
                                        new_ctx.append(ID_S)
                                        id_s_inserted = True
                                    else:
                                        new_ctx.append(ID_SS)
                                    new_ctx.append(pi)
                        ctx = new_ctx
                for i in range(start_offset, len(ctx)):
                    if ctx[i - 1] in (ID_S, ID_SS) or ctx[i] == ID_SS:
                        continue
                    sample = numpy.zeros((maxlen, dims), dtype=numpy.float32)
                    j = maxlen
                    k = i
                    while j >= 0 and k >= 0:
                        k -= 1
                        if ctx[k] in (ID_S, ID_SS) and args.unified:
                            continue
                        j -= 1
                        if ctx[k - 1] in (ID_S, ID_SS) and args.unified:
                            sample[j][:len(token_map)] = token_map[ctx[k - 1]]
                            if args.word2vec:
                                sample[j][len(token_map):] = embeddings[ctx[k]]
                            continue
                        sample[j][:len(token_map)] = token_map[ctx[k]]
                    x.append(sample)
                    y.append(token_map[ctx[i]])
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
    dense_neurons = kwargs.get("dense_neurons", 0)
    learning_rate = kwargs.get("learning_rate", 0.001)
    dropout = kwargs.get("dropout", 0)
    recurrent_dropout = kwargs.get("recurrent_dropout", 0)
    activation = kwargs.get("activation", "tanh")
    optimizer = kwargs.get("optimizer", "rmsprop")
    regularization = kwargs.get("regularization", 0)
    batch_size = kwargs.get("batch_size", 128)
    epochs = kwargs.get("epochs", 50)
    layer_type = kwargs.get("type", "LSTM")
    validation = kwargs.get("validation", 0)
    model = models.Sequential()
    model.add(getattr(layers, layer_type)(
        neurons, dropout=dropout, recurrent_dropout=recurrent_dropout,
        activation=activation,
        kernel_regularizer=regularizers.l2(regularization),
        input_shape=x[0].shape, return_sequences=True))
    model.add(getattr(layers, layer_type)(
        neurons // 2, dropout=dropout, recurrent_dropout=recurrent_dropout,
        kernel_regularizer=regularizers.l2(regularization),
        input_shape=x[0].shape, activation=activation))
    if dense_neurons > 0:
        model.add(layers.Dense(dense_neurons))
        model.add(layers.normalization.BatchNormalization())
        model.add(layers.advanced_activations.PReLU())
    model.add(layers.Dense(y[0].shape[-1], activation="softmax"))
    optimizer = getattr(optimizers, optimizer)(lr=learning_rate, clipnorm=1.)
    model.compile(loss="categorical_crossentropy", optimizer=optimizer,
                  metrics=["accuracy", "top_k_categorical_accuracy"])
    model.fit(x, y, batch_size=batch_size, epochs=epochs,
              validation_split=validation)
    return model


if __name__ == "__main__":
    sys.exit(main())

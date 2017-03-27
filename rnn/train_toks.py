import argparse
import os
import pickle
import sys

from keras import models, layers, regularizers, optimizers

from tokens import *


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
    parser.add_argument("--batch_size", type=int, default=128)
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--cache", action="store_true")
    return parser.parse_args()


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
        with open(args.input) as fin:
            for lineno, line in enumerate(fin):
                if lineno % 1000 == 0:
                    print("line #%d" % lineno)
                if lineno > maxlines > 0:
                    break
                ctx = eval(line)
                for i in range(start_offset, len(ctx)):
                    sample = numpy.zeros((maxlen, len(token_map)),
                                         dtype=numpy.float32)
                    for j in range(maxlen):
                        k = i - maxlen + j
                        if k >= 0:
                            sample[j] = token_map[ctx[k]]
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
        model.add(layers.Dense(dense_neurons, activation="prelu"))
        model.add(layers.normalization.BatchNormalization())
    model.add(layers.Dense(x[0].shape[-1], activation="softmax"))
    optimizer = getattr(optimizers, optimizer)(lr=learning_rate, clipnorm=1.)
    model.compile(loss="categorical_crossentropy", optimizer=optimizer,
                  metrics=["accuracy", "top_k_categorical_accuracy"])
    model.fit(x, y, batch_size=batch_size, epochs=epochs,
              validation_split=validation)
    return model


if __name__ == "__main__":
    sys.exit(main())

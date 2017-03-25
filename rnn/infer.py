import argparse
import sys

from keras import models

from tokens import *


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--diversity", type=float, default=1.0)
    return parser.parse_args()


def main():
    args = parse_args()
    model = models.load_model(args.model)
    maxlen = model.inputs[0].shape[1]
    x = numpy.zeros((maxlen, len(token_map)))
    for line in sys.stdin:
        ctx = eval(line)
        x[:] = 0
        for i in range(maxlen):
            k = len(ctx) - maxlen + i
            if k >= 0:
                x[i] = token_map[ctx[k]]
        pred = prediction2token(model.predict(x, verbose=0)[0], args.diversity)
        sys.stdout.write("%r\n" % pred)

if __name__ == "__main__":
    sys.exit(main())
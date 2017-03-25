import argparse
import os
import sys

os.putenv("TF_CPP_MIN_LOG_LEVEL", os.getenv("TF_CPP_MIN_LOG_LEVEL", "2"))
with open("/dev/null", "w") as devnull:
    stderr = sys.stderr
    sys.stderr = devnull
    from keras import models, backend
    sys.stderr = stderr

from tokens import *


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    model = models.load_model(args.model)
    maxlen = model.inputs[0].shape[1].value
    x = numpy.zeros((1, maxlen, len(token_map)))
    for line in sys.stdin:
        ctx = eval(line)
        x[:] = 0
        for i in range(maxlen):
            k = len(ctx) - maxlen + i
            if k >= 0:
                x[0, i] = token_map[ctx[k]]
        pred = prediction2token(model.predict(x, verbose=0)[0])
        sys.stdout.write("%r\n" % pred)
    backend.clear_session()

if __name__ == "__main__":
    sys.exit(main())

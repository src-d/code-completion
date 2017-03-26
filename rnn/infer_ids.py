import argparse
import os
import pickle
import sys

os.putenv("TF_CPP_MIN_LOG_LEVEL", os.getenv("TF_CPP_MIN_LOG_LEVEL", "2"))
with open("/dev/null", "w") as devnull:
    stderr = sys.stderr
    sys.stderr = devnull
    from keras import models, backend
    sys.stderr = stderr
    del stderr

from tokens import *
from train_ids import extract_names


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--number", type=int, default=5)
    return parser.parse_args()


def main():
    args = parse_args()
    model = models.load_model(args.model)
    with open(args.model + ".voc", "rb") as fin:
        vocabulary = pickle.load(fin)
    ivoc = [None] * len(vocabulary)
    for key, val in vocabulary.items():
        ivoc[val] = key
    maxlen = model.inputs[0].shape[1].value
    x = numpy.zeros((1, maxlen, len(vocabulary)))
    for line in sys.stdin:
        try:
          ctx = eval(line)
          x[:] = 0
          word = False
          words = []
          for c in ctx:
              if c == ID_S:
                  word = True
              elif word:
                  word = False
                  wadd = tuple(vocabulary[p] for p in extract_names(c))
                  if wadd:
                      words.append(wadd)
          for i, w in enumerate(words):
              for c in w:
                  x[0, maxlen - len(words) + i, c] = 1
          preds = model.predict(x, verbose=0)[0]
          best = numpy.argsort(preds)[::-1][:args.number]
          preds /= preds[best[0]]
          sys.stdout.write(
            " ".join("%s@%.3f" % (ivoc[i], preds[i]) for i in best))
          sys.stdout.flush()
        except:
          sys.stdout.write("\n")
          sys.stdout.flush()
    backend.clear_session()

if __name__ == "__main__":
    sys.exit(main())

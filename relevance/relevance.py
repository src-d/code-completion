from __future__ import print_function, with_statement
import pickle
from os.path import join, dirname, abspath
import numpy
from sys import stdin

with open(join(dirname(abspath(__file__)), "dataset.pickle"), "rb") as f:
    words, _, embeddings = pickle.load(f)

word_map = {w: i for i, w in enumerate(words)}


def dist(w1, w2):
  return numpy.linalg.norm(embeddings[word_map[w1]] - embeddings[word_map[w2]])


def main():
  while True:
    try:
      line = stdin.readline()
      if len(line.strip()) == 0:
        return

      words = line.strip().split(',')
      ident, words = words[0], words[1:]
      words = sorted(words, key=lambda x: dist(ident, x))
      print(','.join(words))
    except:
      print('')


if __name__ == '__main__':
  main()

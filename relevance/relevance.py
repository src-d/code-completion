from __future__ import print_function, with_statement
import pickle
from os.path import join, dirname, abspath
import numpy
from sys import stdin, stdout

with open(join(dirname(abspath(__file__)), "dataset.pickle"), "rb") as f:
    words, _, embeddings = pickle.load(f)

word_map = {w: i for i, w in enumerate(words)}


def dist(w1, w2):
  w1 = w1.lower()
  w2 = w2.lower()
  try:
    v1 = embeddings[word_map[w1]]
  except:
    return 1000

  try:
    v2 = embeddings[word_map[w2]]
  except:
    return 1000

  return numpy.linalg.norm(v1 - v2)


def main():
  while True:
    try:
      line = stdin.readline()
      if len(line.strip()) == 0:
        return

      words = line.strip().split(',')
      idents, words = words[0].split('@'), words[1:]

      if len(idents) > 0:
        words = filter(lambda w: w not in idents, words)

      words = sorted(words, key=lambda x: sum([dist(ident, x) for ident in idents]))
      print(','.join(words))
      stdout.flush()
    except:
      # if there is any error print an empty line, the extension
      # will handle the lack of relevance sorting
      print('')
      stdout.flush()


if __name__ == '__main__':
  main()

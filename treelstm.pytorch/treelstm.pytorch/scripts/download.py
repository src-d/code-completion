"""
Downloads the following:
- Stanford parser
- Stanford POS tagger
- Glove vectors
- SICK dataset (semantic relatedness task)
"""

from __future__ import print_function
import urllib.request
import sys
import os
import zipfile

POS_TAGGER_LOC = 'http://nlp.stanford.edu/software/stanford-postagger-2015-01-29.zip'
PARSER_LOC = 'http://nlp.stanford.edu/software/stanford-parser-full-2015-01-29.zip'
GLOVE_WORD2VEC_LOC = 'http://www-nlp.stanford.edu/data/glove.840B.300d.zip'


def download(url, dirpath):
    filename = url.split('/')[-1]
    filepath = os.path.join(dirpath, filename)
    try:
        with urllib.request.urlopen(url) as site:
            u = site.read()
    except:
        print("URL %s failed to open" % url)
        raise Exception

    with open(filepath, 'wb') as f:
        try:
            filesize = int(site.headers["Content-Length"])
        except:
            print("URL %s failed to report length" % url)
            raise Exception
        print("Downloading: %s Bytes: %s" % (filename, filesize))

        f.write(u)
    return filepath


def unzip(filepath):
    print("Extracting: " + filepath)
    dirpath = os.path.dirname(filepath)
    with zipfile.ZipFile(filepath) as zf:
        zf.extractall(dirpath)
    os.remove(filepath)


def download_tagger(dirpath):
    tagger_dir = 'stanford-tagger'
    if os.path.exists(os.path.join(dirpath, tagger_dir)):
        print('Found Stanford POS Tagger - skip')
        return
    url = POS_TAGGER_LOC
    filepath = download(url, dirpath)
    with zipfile.ZipFile(filepath) as zf:
        zip_dir = zf.namelist()[0]
        zf.extractall(dirpath)
    os.remove(filepath)
    os.rename(os.path.join(dirpath, zip_dir), os.path.join(dirpath, tagger_dir))


def download_parser(dirpath):
    parser_dir = 'stanford-parser'
    if os.path.exists(os.path.join(dirpath, parser_dir)):
        print('Found Stanford Parser - skip')
        return
    url = PARSER_LOC
    filepath = download(url, dirpath)
    with zipfile.ZipFile(filepath) as zf:
        zip_dir = zf.namelist()[0]
        zf.extractall(dirpath)
    os.remove(filepath)
    os.rename(os.path.join(dirpath, zip_dir), os.path.join(dirpath, parser_dir))


def download_wordvecs(dirpath):
    if os.path.exists(dirpath):
        print('Found Glove vectors - skip')
        return
    else:
        os.makedirs(dirpath)
    unzip(download(GLOVE_WORD2VEC_LOC, dirpath))


def download_sick(dirpath):
    if os.path.exists(dirpath):
        print('Found SICK dataset - skip')
        return
    else:
        os.makedirs(dirpath)
    train_url = 'http://alt.qcri.org/semeval2014/task1/data/uploads/sick_train.zip'
    trial_url = 'http://alt.qcri.org/semeval2014/task1/data/uploads/sick_trial.zip'
    test_url = 'http://alt.qcri.org/semeval2014/task1/data/uploads/sick_test_annotated.zip'
    unzip(download(train_url, dirpath))
    unzip(download(trial_url, dirpath))
    unzip(download(test_url, dirpath))

if __name__ == '__main__':
    base_dir = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))

    # data
    data_dir = os.path.join(base_dir, 'data')
    wordvec_dir = os.path.join(data_dir, 'glove')
    sick_dir = os.path.join(data_dir, 'sick')

    # libraries
    lib_dir = os.path.join(base_dir, 'lib')

    # download dependencies
    download_tagger(lib_dir)
    download_parser(lib_dir)
    download_wordvecs(wordvec_dir)
    download_sick(sick_dir)

    print("+" * 20)
    print("Downloading is finished!")

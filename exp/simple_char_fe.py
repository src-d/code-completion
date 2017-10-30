"""
Baseline code cropper - select one line as snippet (y) and several lines before and after as X.
"""

import glob

import numpy as np
from numpy.random import randint

SNIPPET_LEN = 50
MAX_LEN = 200
N_LINES = 4  # number of lines to use before and after snippet


def random_crop_lines(text_lines, max_len=MAX_LEN, snippet_len=SNIPPET_LEN, n_lines=N_LINES):
    """
    Random text selector - select line as snippet and some lines before and after

    :param text_lines: text splitted into lines
    :param max_len: maximum character length of text before and after snippet
    :param snippet_len: maximum length of snippet
    :param n_lines: number of lines before and after snippet
    :return: [text before, text after], snippet
    """
    start_pos = randint(len(text_lines) - (n_lines * 2 + 1))

    before = text_lines[start_pos:start_pos + n_lines]
    before = "\n".join(map(str.strip, before))

    snippet = text_lines[start_pos + n_lines]

    after = text_lines[start_pos + n_lines + 1:start_pos + n_lines * 2 + 1]
    after = "\n".join(map(str.strip, after))

    if len(before) > max_len:
        before = before[-max_len:]
    if len(after) > max_len:
        after = after[-max_len:]
    if len(snippet) > snippet_len:
        snippet = snippet[-snippet_len:]

    return [before, after], snippet


def estimate_n_samples(text_lines, n_lines=N_LINES, func=lambda x: x):
    if len(text_lines) <= (n_lines * 2 + 1):
        return 0
    n_start_pos = len(text_lines) - (n_lines * 2 + 1)
    return int(func(n_start_pos))


def text_crop_pipeline(folder_loc, n_lines, max_len=MAX_LEN, snippet_len=SNIPPET_LEN,
                       func=lambda x: x, max_n_samples=None):
    un_chars = set()

    before, snippets, after = [], [], []

    for filename in glob.iglob(folder_loc + "**/*.py", recursive=True):
        with open(filename, errors="ignore") as f:
            content = []
            for l in f.readlines():
                l = l.strip()
                un_chars.update(l)
                content.append(l)

            for _ in range(estimate_n_samples(content, n_lines=n_lines, func=func)):
                res = random_crop_lines(content, max_len=max_len, snippet_len=snippet_len)
                if res[1].strip() != "" or res[0][0].strip() != "":
                    # to avoid empty samples
                    before.append(res[0][0])
                    snippets.append(res[1])
                    after.append(res[0][1])

            if max_n_samples is not None and len(snippets) >= max_n_samples:
                break

    print("number of unique chars:", len(un_chars))
    print("number of samples:", len(snippets))

    un_chars.add("\n")
    char_id = dict((c, i) for i, c in enumerate(sorted(un_chars)))
    if "\t" not in char_id:
        char_id["\t"] = len(char_id)

    return before, after, snippets, char_id


def text2vec(texts, char_ind, add_start_end=True, max_len=None, to_ind=False):
    assert isinstance(texts, list)
    n_samples = len(texts)
    if max_len is None:
        max_len = max(map(len, texts))

    unseen = "NEVER_SEEN_CHARACTER"
    if unseen not in char_ind:
        char_ind[unseen] = len(char_ind)

    n_tokens = len(char_ind)
    if add_start_end:
        n_tokens += 2  # add start and end tokens
        start_token = "START"
        end_token = "END"
        if start_token not in char_ind:
            char_ind[start_token] = len(char_ind)
        if end_token not in char_ind:
            char_ind[end_token] = len(char_ind)

        max_len += 2

    if not to_ind:
        text_vec = np.zeros((n_samples, max_len, n_tokens))
        for i, text in enumerate(texts):
            offset = 0
            if add_start_end:
                text_vec[i, 0, char_ind[start_token]] = 1
                offset += 1

            for j, ch in enumerate(text):
                ind = char_ind[ch] if ch in char_ind else char_ind[unseen]
                text_vec[i, j + offset, ind] = 1
    else:
        text_vec = np.zeros((n_samples, max_len))
        for i, text in enumerate(texts):
            offset = 0
            if add_start_end:
                text_vec[i, 0] = char_ind[start_token]
                offset += 1

            for j, ch in enumerate(text):
                ind = char_ind[ch] if ch in char_ind else char_ind[unseen]
                text_vec[i, j + offset] = ind

    return text_vec


def stat(folder, estimator_n_samples=lambda x: x):
    n_files = 0
    n_lines = 0
    for file in glob.iglob(folder + "**/*.py", recursive=True):
        n_files += 1
        with open(file, errors="ignore") as f:
            n_lines += int(estimator_n_samples(len(f.readlines())))
    print("number of files:", n_files, "; number of lines:", n_lines)


def feature_extraction_pipe(folder_loc, max_len=MAX_LEN, snippet_len=SNIPPET_LEN, n_lines=N_LINES,
                            text_to_ind_vec=False, estimator_n_samples=lambda x: x,
                            token_ind=None, max_n_samples=None, snippet_start="|"):
    """
    Simple pipeline to extract features from python code.

    :param folder_loc: location of folder with python code
    :param max_len: max length (characters) of code before and after snippet
    :param snippet_len: length of snippet in char
    :param n_lines: number of lines to use before and after snippet
    :param text_to_ind_vec: if False convert to (n_samples, len, n_unique chars),
                            if True: (n_samples, len, 1)
    :param estimator_n_samples: how to estimate number of samples based on number of lines
    :param token_ind: mapping from token to index
    :param max_n_samples: maximum number of samples to keep
    :param snippet_start: starting character to augment snippet
    :return: [before_vec, after_vec], snippet_vec, char_id:
             before_vec, after_vec - feature vectors for code before and after snippet;
             snippet_vec - feature vector for snippet;
             char_id - character to index mapping

    """
    before, after, snippets, char_id = text_crop_pipeline(folder_loc, n_lines=n_lines,
                                                          max_len=max_len,
                                                          snippet_len=snippet_len,
                                                          func=estimator_n_samples,
                                                          max_n_samples=max_n_samples)
    if snippet_start is not None:
        for i in range(len(snippets)):
            # augment with start character
            snippets[i] = snippet_start + snippets[i]

    if token_ind is not None:
        char_id = token_ind

    before_vec = text2vec(before, char_ind=char_id, add_start_end=False, max_len=max_len,
                          to_ind=text_to_ind_vec)
    after_vec = text2vec(after, char_ind=char_id, add_start_end=False, max_len=max_len,
                         to_ind=text_to_ind_vec)
    snippet_vec = text2vec(snippets, char_ind=char_id, add_start_end=False,
                           max_len=snippet_len + 1, to_ind=text_to_ind_vec)

    return [before_vec, after_vec], snippet_vec, char_id

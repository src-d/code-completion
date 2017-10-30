"""
Base class for processing big/long-to-compute datasets.
Main goal of this class - persistant storage of data chunks.
"""

import gc

import numpy as np
from sklearn.externals.joblib import Memory


def _get_data(i, unid, data=None):
    """
    Helper function for memoization.
    :param i: index
    :param unid: unique identifier
    :param data: data for caching
    :return: data
    """
    return data


class BaseDataset(object):
    def __init__(self, unid="", mem=None):
        """
        :param unid: unique id to differentiate one cache dataset from another
        :param mem: instance for caching
        """
        self.unid = unid
        self.n_chunks = 0
        
        assert mem is not None, "mem should be object that is used for caching!"
        self.mem = mem

        self.get_data = self.mem.cache(_get_data, ignore=["data"])

    def __iter__(self):
        for i in range(self.n_chunks):
            yield self.get_data(i=i, unid=self.unid)

    def __len__(self):
        return self.n_chunks

    def __getitem__(self, key):
        return self.get_data(i=key, unid=self.unid)

    def append(self, data):
        """
        Add piece of data to cache.
        :param data: data to store
        """
        # Caching
        data_ = self.get_data(unid=self.unid, i=self.n_chunks, data=data)
        del data_
        gc.collect()
        self.n_chunks += 1


class BaseTransformer:
    """
    Online transformation of dataset
    """

    def __init__(self, dataset=None, chunk_func=None):
        """
        :param dataset: chunked dataset
        :param chunk_func: function applied to each chunk
        """
        self.dataset = dataset
        self.chunk_func = chunk_func

    def __iter__(self):
        for chunk in self.dataset:
            yield self.chunk_func(chunk)


class ZipDataset:
    """
    Online zipping of several cached datasets
    """

    def __init__(self, datasets=None):
        """
        :param datasets: datasets to zip
        """
        self._check_datasets(datasets)
        self.datasets = datasets

    def _check_datasets(self, datasets):
        len_d = None
        for d in datasets:
            if len_d is None:
                len_d = len(d)
            else:
                assert len_d == len(d), "Datasets have different len: {}" % ([len(d_)
                                                                              for d_ in datasets])
        self.n_chunks = len_d

    def __iter__(self):
        for chunk in zip(*self.datasets):
            yield np.hstack(chunk)


if __name__ == "__main__":
    d_shape = (2, 2)
    n_chunks = 2
    dataset = np.zeros(d_shape)

    mem = Memory(cachedir="/tmp")
    mem_ds = BaseDataset(mem=mem)

    for i in range(n_chunks):
        mem_ds.append(dataset)

    # Check correctness
    del dataset

    # BaseDataset
    assert len(mem_ds) == n_chunks
    for d in mem_ds:
        assert d.shape == d_shape

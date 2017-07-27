from copy import deepcopy
import time

import torch
from torch.autograd import Variable as Var
import torch.optim as optim
import torch.multiprocessing as _mp
mp = _mp.get_context('spawn')
# https://gist.github.com/colesbury/bda55436e67da38c4027459f6d4ab42a
from torch.utils.data import DataLoader
from tqdm import tqdm

from utils import map_label_to_target


def timeit(f):

    def timed(*args, **kw):

        ts = time.time()
        result = f(*args, **kw)
        te = time.time()

        print("func:%r args:[%r, %r] took: %2.4f sec" % (f.__name__, args, kw, te-ts))
        return result

    return timed


class Trainer(object):
    def __init__(self, args, model, criterion, optimizer):
        super(Trainer, self).__init__()
        self.args = args
        self.model = model
        self.criterion = criterion
        self.optimizer = optimizer
        self.epoch = 0

    # helper function for training
    @timeit
    def train(self, dataset):
        self.model.train()
        self.optimizer.zero_grad()
        loss = 0.0
        indices = torch.randperm(len(dataset))
        for idx in tqdm(range(len(dataset)), desc=('Training epoch ' + str(self.epoch + 1) + '')):
            ltree, lsent, rtree, rsent, label = dataset[indices[idx]]
            linput, rinput = Var(lsent), Var(rsent)
            target = Var(map_label_to_target(label, dataset.num_classes))
            if self.args.cuda:
                linput, rinput = linput.cuda(), rinput.cuda()
                target = target.cuda()
            output = self.model(ltree, linput, rtree, rinput)
            err = self.criterion(output, target)
            loss += err.data[0]
            err.backward()
            if (idx + 1) % self.args.batchsize == 0:
                self.optimizer.step()
                self.optimizer.zero_grad()
        self.epoch += 1
        return loss / len(dataset)

    # helper function for testing
    def test(self, dataset):
        self.model.eval()
        loss = 0
        predictions = torch.zeros(len(dataset))
        indices = torch.arange(1, dataset.num_classes + 1)
        for idx in tqdm(range(len(dataset)), desc=('Testing epoch  ' + str(self.epoch) + '')):
            ltree, lsent, rtree, rsent, label = dataset[idx]
            linput, rinput = Var(lsent, volatile=True), Var(rsent, volatile=True)
            target = Var(map_label_to_target(label, dataset.num_classes), volatile=True)
            if self.args.cuda:
                linput, rinput = linput.cuda(), rinput.cuda()
                target = target.cuda()
            output = self.model(ltree,linput,rtree,rinput)
            err = self.criterion(output, target)
            loss += err.data[0]
            predictions[idx] = torch.dot(indices,torch.exp(output.data.cpu()))
        return loss / len(dataset), predictions


class TrainerMP(object):
    def __init__(self, args, model, criterion, optimizer, num_processes=4):
        super(TrainerMP , self).__init__()
        self.args = args
        self.model = model
        self.criterion = criterion
        self.optimizer = optimizer
        self.num_processes = num_processes
        self.epoch = 0

    def prepare_dataloader(self, dataset, n_chunks=None):
        # split dataset into n_chunks
        if n_chunks is None:
            n_chunks = self.num_processes

        n_samples = len(dataset)
        indices = torch.randperm(n_samples)
        chunk_sz = n_samples // self.num_processes

        chunks = []

        for i in range(n_chunks):
            if i == n_chunks - 1:
                ds = DataLoader(self._slice_dataset(dataset, indices[i * chunk_sz:]),
                                collate_fn=not_default_collate)
                ds.num_classes = dataset.num_classes
                chunks.append(ds)
            else:
                ds = DataLoader(self._slice_dataset(dataset,
                                                    indices[i * chunk_sz:(i + 1) * chunk_sz]),
                                collate_fn=not_default_collate)
                ds.num_classes = dataset.num_classes
                chunks.append(ds)
        return chunks

    @timeit
    def train(self, dataset):
        tr = self._train

        # split dataset into n_processes chunks
        if isinstance(dataset[0], DataLoader):
            chunks = dataset
        else:
            chunks = self.prepare_dataloader(dataset)

        # prepare parameters for parallel training
        optimizer = self.optimizer
        args = self.args
        criterion = self.criterion
        epoch = 0
        model = self.model
        # NOTE: this is required for the ``fork`` method to work
        # model.share_memory()
        processes = []
        for i in range(self.num_processes):
            p = mp.Process(target=tr, args=(model, optimizer, args, criterion, chunks[i], epoch))
            p.start()
            processes.append(p)
        for p in processes:
            p.join()
        pass

    # helper function for testing
    def test(self, dataset):
        self.model.eval()
        loss = 0
        predictions = torch.zeros(len(dataset))
        indices = torch.arange(1, dataset.num_classes + 1)
        for idx in tqdm(range(len(dataset)), desc=('Testing epoch  ' + str(self.epoch) + '')):
            ltree, lsent, rtree, rsent, label = dataset[idx]
            linput, rinput = Var(lsent, volatile=True), Var(rsent, volatile=True)
            target = Var(map_label_to_target(label, dataset.num_classes), volatile=True)
            if self.args.cuda:
                linput, rinput = linput.cuda(), rinput.cuda()
                target = target.cuda()
            output = self.model(ltree, linput, rtree, rinput)
            err = self.criterion(output, target)
            loss += err.data[0]
            predictions[idx] = torch.dot(indices, torch.exp(output.data.cpu()))
        return loss / len(dataset), predictions

    # helper function for training
    @staticmethod
    def _train(model, optimizer, args, criterion, dataset, epoch):
        model.train()
        # construct optimizer
        optimizer = optim.Adam(model.parameters(), lr=args.lr, weight_decay=args.wd)
        optimizer.zero_grad()
        loss = 0.0
        indices = torch.randperm(len(dataset))
        for idx, data in enumerate(dataset):
            # ltree, lsent, rtree, rsent, label = dataset[indices[idx]]
            ltree, lsent, rtree, rsent, label = data
            linput, rinput = Var(lsent), Var(rsent)
            target = Var(map_label_to_target(label, dataset.num_classes))
            if args.cuda:
                linput, rinput = linput.cuda(), rinput.cuda()
                target = target.cuda()
            output = model(ltree, linput, rtree, rinput)
            err = criterion(output, target)
            loss += err.data[0]
            err.backward()
            if (idx + 1) % args.batchsize == 0:
                optimizer.step()
                optimizer.zero_grad()
        epoch += 1
        return loss / len(dataset)

    @staticmethod
    def _slice_dataset(dataset, indices):
        d = deepcopy(dataset)

        d.lsentences = [dataset.lsentences[ind] for ind in indices]
        d.rsentences = [dataset.rsentences[ind] for ind in indices]
        d.ltrees = [dataset.ltrees[ind] for ind in indices]
        d.rtrees = [dataset.rtrees[ind] for ind in indices]
        d.labels = torch.Tensor([dataset.labels[ind] for ind in indices])

        d.size = d.labels.size(0)

        return d


def not_default_collate(batch):
    return batch[0]

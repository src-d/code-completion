Tokens
======

Blows up on epoch #4
```
TF_CPP_MIN_LOG_LEVEL=1 python3 train.py --input /media/disk/go_tokens_clean_docker_only.tsv --output ../model_docker_full.hdf --epochs 8 --neurons 200 --maxlen 50 --regularization 0.000001
```

Generates `docker_toks_11000_GRU_0.8265.hdf`
```

```

Identifiers
===========

Generates `docker_ids_6000_0.50.hdf`
```
python3 train_ids.py --input docker_ids.tsv --output docker_ids.hdf --maxlen 50 --maxlines 6000 --epochs 30
```
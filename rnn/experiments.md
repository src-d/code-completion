Tokens
======

Blows up on epoch #4
```
TF_CPP_MIN_LOG_LEVEL=1 python3 train.py --input docker_toks.tsv --output model_docker_LSTM.hdf --epochs 8 --neurons 200 --maxlen 50 --regularization 0.000001
```

Generates `docker_toks_11000_GRU_0.8265.hdf`
```
TF_CPP_MIN_LOG_LEVEL=1 python3 train_toks.py --input docker_toks.tsv --output model_docker_GRU.hdf --type GRU --epochs 12 --neurons 256 --maxlen 100
```

Changing `maxlen` to 50 results in 0.8234. Even `1e-5` regularization reduces the
accuracy by 2-3%. LSTM is unstable, GRU never blows up.

```
python3 train_toks.py --input docker.tsv --output docker_11000_160.hdf --type GRU --neurons 200  --epochs 12

Epoch 2/12
1298287/1298287 [==============================] - 2691s - loss: 0.6188 - acc: 0.7844 - top_k_categorical_accuracy: 0.9869 - val_loss: 0.7376 - val_acc: 0.7500 - val_top_k_categorical_accuracy: 0.9804
Epoch 3/12
1298287/1298287 [==============================] - 2696s - loss: 0.5759 - acc: 0.7985 - top_k_categorical_accuracy: 0.9887 - val_loss: 0.7385 - val_acc: 0.7528 - val_top_k_categorical_accuracy: 0.9807
Epoch 4/12
1298287/1298287 [==============================] - 2701s - loss: 0.5512 - acc: 0.8071 - top_k_categorical_accuracy: 0.9896 - val_loss: 0.7407 - val_acc: 0.7522 - val_top_k_categorical_accuracy: 0.9808
Epoch 5/12
1298287/1298287 [==============================] - 2700s - loss: 0.5351 - acc: 0.8126 - top_k_categorical_accuracy: 0.9902 - val_loss: 0.7345 - val_acc: 0.7559 - val_top_k_categorical_accuracy: 0.9803
Epoch 6/12
1298287/1298287 [==============================] - 2702s - loss: 0.5240 - acc: 0.8163 - top_k_categorical_accuracy: 0.9905 - val_loss: 0.7259 - val_acc: 0.7566 - val_top_k_categorical_accuracy: 0.9813
Epoch 7/12
1298287/1298287 [==============================] - 2698s - loss: 0.5142 - acc: 0.8199 - top_k_categorical_accuracy: 0.9909 - val_loss: 0.7281 - val_acc: 0.7572 - val_top_k_categorical_accuracy: 0.9811
Epoch 8/12
1298287/1298287 [==============================] - 2703s - loss: 0.5064 - acc: 0.8225 - top_k_categorical_accuracy: 0.9912 - val_loss: 0.7356 - val_acc: 0.7570 - val_top_k_categorical_accuracy: 0.9805
Epoch 9/12
1298287/1298287 [==============================] - 2705s - loss: 0.5007 - acc: 0.8246 - top_k_categorical_accuracy: 0.9913 - val_loss: 0.7352 - val_acc: 0.7568 - val_top_k_categorical_accuracy: 0.9807
Epoch 10/12
1298287/1298287 [==============================] - 2705s - loss: 0.4958 - acc: 0.8263 - top_k_categorical_accuracy: 0.9915 - val_loss: 0.7304 - val_acc: 0.7593 - val_top_k_categorical_accuracy: 0.9813
Epoch 11/12
1298287/1298287 [==============================] - 2624s - loss: 0.4910 - acc: 0.8279 - top_k_categorical_accuracy: 0.9917 - val_loss: 0.7352 - val_acc: 0.7594 - val_top_k_categorical_accuracy: 0.9810
Epoch 12/12
1298287/1298287 [==============================] - 2603s - loss: 0.4872 - acc: 0.8292 - top_k_categorical_accuracy: 0.9917 - val_loss: 0.7419 - val_acc: 0.7578 - val_top_k_categorical_accuracy: 0.9799
```

Identifiers
===========

Generates `docker_ids_6000_0.50.hdf`
```
python3 train_ids.py --input docker_ids.tsv --output docker_ids.hdf --maxlen 50 --maxlines 6000 --epochs 30
```
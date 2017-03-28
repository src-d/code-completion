Tokens
======

```
TF_CPP_MIN_LOG_LEVEL=1 python3 train_toks.py --input maximo_toks.tsv --output maximo_toks_0.81.hdf --type GRU --neurons 200 --epochs 10 --maxlen 50

Epoch 1/10
1459845/1459845 [==============================] - 1460s - loss: 0.8993 - acc: 0.7073 - top_k_categorical_accuracy: 0.9636           
Epoch 2/10
1459845/1459845 [==============================] - 1443s - loss: 0.7043 - acc: 0.7621 - top_k_categorical_accuracy: 0.9804     
Epoch 3/10
1459845/1459845 [==============================] - 1447s - loss: 0.6563 - acc: 0.7791 - top_k_categorical_accuracy: 0.9827     
Epoch 4/10
1459845/1459845 [==============================] - 1452s - loss: 0.6278 - acc: 0.7887 - top_k_categorical_accuracy: 0.9840     
Epoch 5/10
1459845/1459845 [==============================] - 1452s - loss: 0.6087 - acc: 0.7956 - top_k_categorical_accuracy: 0.9850     
Epoch 6/10
1459845/1459845 [==============================] - 1455s - loss: 0.5956 - acc: 0.8001 - top_k_categorical_accuracy: 0.9854     
Epoch 7/10
1459845/1459845 [==============================] - 1452s - loss: 0.5851 - acc: 0.8035 - top_k_categorical_accuracy: 0.9858     
Epoch 8/10
1459845/1459845 [==============================] - 1458s - loss: 0.5774 - acc: 0.8057 - top_k_categorical_accuracy: 0.9862     
Epoch 9/10
1459845/1459845 [==============================] - 1462s - loss: 0.5705 - acc: 0.8081 - top_k_categorical_accuracy: 0.9865     
Epoch 10/10
1459845/1459845 [==============================] - 1432s - loss: 0.5646 - acc: 0.8099 - top_k_categorical_accuracy: 0.9867
```

Identifiers
===========

Generates `docker_ids_6000_0.50.hdf`
```
TF_CPP_MIN_LOG_LEVEL=1 python3 train_ids.py --input maximo_ids.tsv --output maximo_ids.hdf --epochs 30 --maxlen 50 --maxlines 7500 --neurons 200

Epoch 8/30
293209/293209 [==============================] - 431s - loss: 3.1250 - acc: 0.2159 - top_k_categorical_accuracy: 0.3943     
Epoch 9/30
293209/293209 [==============================] - 424s - loss: 3.0727 - acc: 0.2230 - top_k_categorical_accuracy: 0.4033     
Epoch 10/30
293209/293209 [==============================] - 429s - loss: 3.0172 - acc: 0.2309 - top_k_categorical_accuracy: 0.4132     
Epoch 11/30
293209/293209 [==============================] - 459s - loss: 2.9661 - acc: 0.2374 - top_k_categorical_accuracy: 0.4194     
Epoch 12/30
293209/293209 [==============================] - 490s - loss: 2.9288 - acc: 0.2446 - top_k_categorical_accuracy: 0.4271     
Epoch 13/30
293209/293209 [==============================] - 487s - loss: 2.8793 - acc: 0.2503 - top_k_categorical_accuracy: 0.4332     
Epoch 14/30
293209/293209 [==============================] - 489s - loss: 2.8572 - acc: 0.2553 - top_k_categorical_accuracy: 0.4385     
Epoch 15/30
293209/293209 [==============================] - 490s - loss: 2.8120 - acc: 0.2601 - top_k_categorical_accuracy: 0.4436     
Epoch 16/30
293209/293209 [==============================] - 489s - loss: 2.7874 - acc: 0.2647 - top_k_categorical_accuracy: 0.4477     
Epoch 17/30
293209/293209 [==============================] - 489s - loss: 2.7572 - acc: 0.2703 - top_k_categorical_accuracy: 0.4534     
Epoch 18/30
293209/293209 [==============================] - 485s - loss: 2.7459 - acc: 0.2738 - top_k_categorical_accuracy: 0.4558     
Epoch 19/30
293209/293209 [==============================] - 484s - loss: 2.7313 - acc: 0.2773 - top_k_categorical_accuracy: 0.4590     
Epoch 20/30
293209/293209 [==============================] - 485s - loss: 2.7150 - acc: 0.2811 - top_k_categorical_accuracy: 0.4623     
Epoch 21/30
293209/293209 [==============================] - 489s - loss: 2.6856 - acc: 0.2845 - top_k_categorical_accuracy: 0.4660     
Epoch 22/30
293209/293209 [==============================] - 485s - loss: 2.6711 - acc: 0.2873 - top_k_categorical_accuracy: 0.4688     
Epoch 23/30
293209/293209 [==============================] - 489s - loss: 2.6774 - acc: 0.2898 - top_k_categorical_accuracy: 0.4704     
Epoch 24/30
293209/293209 [==============================] - 487s - loss: 2.6625 - acc: 0.2924 - top_k_categorical_accuracy: 0.4728     
Epoch 25/30
293209/293209 [==============================] - 486s - loss: 2.6295 - acc: 0.2955 - top_k_categorical_accuracy: 0.4760     
Epoch 26/30
293209/293209 [==============================] - 483s - loss: 2.6104 - acc: 0.2987 - top_k_categorical_accuracy: 0.4788     
Epoch 27/30
293209/293209 [==============================] - 486s - loss: 2.6086 - acc: 0.3003 - top_k_categorical_accuracy: 0.4803     
Epoch 28/30
293209/293209 [==============================] - 489s - loss: 2.5884 - acc: 0.3027 - top_k_categorical_accuracy: 0.4828     
Epoch 29/30
293209/293209 [==============================] - 486s - loss: 2.5741 - acc: 0.3048 - top_k_categorical_accuracy: 0.4846     
Epoch 30/30
293209/293209 [==============================] - 492s - loss: 2.5672 - acc: 0.3063 - top_k_categorical_accuracy: 0.4856
```
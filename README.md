# autocompletion prototype

## Requirements

* Go installed and setup
* Python (`python` or `python3` and `pip` in the path) installed
* Visual Studio Code installed and binary `code` in path.

## Install

```
mkdir -p $GOPATH/src/github.com/src-d
cd $GOPATH/src/github.com/src-d
git clone git@github.com/src-d/code-completion.git
cd code-completion
cd tokenizer && go install ./...
cd ../rnn && pip install -r requirements.txt
cd ../vscode-ext && code .
```

Run `F5` to start testing the extension.

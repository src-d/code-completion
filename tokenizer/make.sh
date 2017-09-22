#!/bin/sh

export GOPATH=$(pwd)
mkdir -p src/github.com/src-d/code-completion/tokenizer/
ln -fs ../../../../../tokenize src/github.com/src-d/code-completion/tokenizer
GOOS=darwin GOARCH=amd64 go build -o ../bin/tokenizer_darwin tokenizer.go
GOOS=windows GOARCH=amd64 go build -o ../bin/tokenizer_win32.exe tokenizer.go
GOOS=linux GOARCH=amd64 go build -o ../bin/tokenizer_linux tokenizer.go

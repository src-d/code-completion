#!/bin/sh

go get -u github.com/nsf/gocode/...
go get -u golang.org/x/tools/cmd/guru/...

if [ $(id|cut -d= -f 2|cut -d\( -f 1) == 0 ]; then
	sudo=sudo
else
 	sudo=""
fi

if [ -f $(which pip3) ]; then
        $sudo pip3 install -r rnn/requirements.txt
else
        $sudo pip install -r rnn/requirements.txt
fi

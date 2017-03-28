
GOOS=darwin GOARCH=amd64 go build -o ../bin/tokenizer_darwin tokenizer.go
GOOS=windows GOARCH=amd64 go build -o ../bin/tokenizer_win32.exe tokenizer.go
GOOS=linux GOARCH=amd64 go build -o ../bin/tokenizer_linux tokenizer.go

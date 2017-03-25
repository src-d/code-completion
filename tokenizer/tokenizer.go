package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"os"

	"github.com/src-d/code-completion/tokenizer/tokenize"
)

func main() {
	var pos = flag.Int("pos", 0, "position of the cursor in the file")
	flag.Parse()

	var err error
	var content []byte
	if content, err = ioutil.ReadAll(os.Stdin); err != nil {
		writeErrorResponse(err)
		return
	}

	tokens := tokenize.TokenizeScope(content, *pos)
	fmt.Println(tokens)
}

func writeErrorResponse(err error) {
	fmt.Printf("!ERR: %s", err)
}

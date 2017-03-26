package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"strings"

	"github.com/src-d/code-completion/tokenizer/tokenize"
)

func main() {
	var (
		pos    = flag.Int("pos", 0, "position of the cursor in the file")
		idents = flag.Bool("idents", false, "scan only idents in given text")
		full   = flag.Bool("full", false, "return idents as well as ID_S")
	)
	flag.Parse()

	content, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		writeErrorResponse(err)
		return
	}

	if *idents {
		fmt.Println(strings.Join(tokenize.Identifiers(content), ","))
	} else {
		tokens := tokenize.TokenizeScope(content, *pos, *full)
		fmt.Println(tokens)
	}
}

func writeErrorResponse(err error) {
	fmt.Printf("!ERR: %s", err)
}

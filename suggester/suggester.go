package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"os"
	"strings"

	"github.com/src-d/code-completion/suggester/tokenize"
)

func main() {
	var pos = flag.Int("pos", 0, "position of the cursor in the file")
	flag.Parse()

	content, err := ioutil.ReadAll(os.Stdin)
	if err != nil {
		writeErrorResponse(err)
		return
	}

	tokens, err := tokenize.TokenizeScope(content, *pos)
	if err != nil {
		writeErrorResponse(err)
		return
	}

	suggestionsForTokens(tokens)
}

func writeErrorResponse(err error) {
	fmt.Printf("!ERR: %s", err)
}

func writeOkResponse(suggestions ...string) {
	fmt.Print(strings.Join(suggestions, ","))
}

func suggestionsForTokens(tokens tokenize.TokenList) {
	// TODO: mocked for now, when the suggestion neural network is ready
	// this should be changed

	writeOkResponse("if", "for")
}

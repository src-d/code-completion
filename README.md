# autocompletion prototype

## Requirements

* Go installed and setup.
  * Make sure `GOPATH` environment variable is set and `$GOPATH/bin` is in your `PATH` environment variable.
* Python (`python` or `python3` and `pip` or `pip3` in the path) installed. **NOTE:** pip must be able to run without sudo. If that's not the case, use `install_sudo.sh`.
* Visual Studio Code installed.

## Install

```
git clone git@github.com/src-d/code-completion.git
cd code-completion
./install.sh
```

## Install extension

* Download [latest version](https://github.com/src-d/code-completion/releases/latest) of the extension.
* Load the extension.
  * Open the extensions panel (Cmd + shift + x or Ctrl + shift + x.
  * Click the three dots to show options. 
  * Click "Install from VSIX..." and select the extension file you just downloaded.
  * Activate the extension and reload.
* Start using with any Go program.

**NOTE:** make sure your golang VSCode extension is not installed or active so they don't compete against each other to offer completions.

'use strict';

import { 
    DocumentFilter, languages, ExtensionContext,
} from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import GoCompletionProvider from './autocompletion';
import { LineExchangeProcess, binPath } from './process';

const GO_CODE: DocumentFilter = { language: 'go', scheme: 'file' };
const TRIGGER_CHARS: string[] = ['.', ' ', '\n', '(', ')', '\t', ',', '[', ']'];
const python = binPath('python3') || binPath('python');
const tokenModel = 'docker_toks_11000_GRU_0.8265.hdf';
const idModel = 'docker_ids_6000_0.50.hdf';

let relevanceProc: ChildProcess;
let tokenProc: ChildProcess;
let idProc: ChildProcess;

export function activate(context: ExtensionContext) {
    console.log('Extension has been activated');
    const extPath = context.extensionPath;
    relevanceProc = spawnPythonProc('relevance', extPath, 'relevance/relevance.py');

    tokenProc = spawnPythonProc('nextToken', extPath, 'rnn/infer_toks.py', [
        '--model', 
        `${extPath}/rnn/${tokenModel}`,
        '--number',
        '10',
    ]);

    idProc = spawnPythonProc('ids', extPath, 'rnn/infer_ids.py', [
        '--model', 
        `${extPath}/rnn/${idModel}`,
    ]);
 
    context.subscriptions.push(languages.registerCompletionItemProvider(
        GO_CODE,
        new GoCompletionProvider(
            context.extensionPath,
            new LineExchangeProcess(relevanceProc),
            new LineExchangeProcess(tokenProc),
            new LineExchangeProcess(idProc),
        ),
        ...TRIGGER_CHARS,
    ));
}

export function deactivate() {
    console.log('Extension has been deactivated');
    killProcs(relevanceProc, tokenProc, idProc);
}

function killProcs(...procs: ChildProcess[]) {
    procs.forEach(proc => {
        if (proc) {
            console.log('killed process', proc.pid);
            proc.kill();
        }
    });
}

function spawnPythonProc(name: string, extPath: string, script: string, args: string[] = []): ChildProcess {
    const proc = spawn(python, [`${extPath}/${script}`].concat(args));
    proc.stderr.on('data', (data) => {
        console.error(data.toString());
    });

    proc.on('close', (code, signal) => {
        console.error('relevance process died', code, signal);
    });

    return proc;
}
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
const tokenModel = 'maximo_toks_0.81.hdf';
const idModel = 'maximo_ids_public.hdf';

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
        '--only-public',
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

/**
 * Kills the given processes.
 * @param procs processes to kill
 */
function killProcs(...procs: ChildProcess[]) {
    procs.forEach(proc => {
        if (proc) {
            console.log('killed process', proc.pid);
            proc.kill();
        }
    });
}

/**
 * Spawns a python script in the extension path and prints to console all 
 * errors that may occur.
 * @param name name of the process, only for log purposes
 * @param extPath path of the extension
 * @param script script to run
 * @param args arguments of the script
 */
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
'use strict';

import { 
    DocumentFilter, languages, ExtensionContext,
} from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import GoCompletionProvider from './autocompletion';
import { LineExchangeProcess, binPath } from './process';

const GO_CODE: DocumentFilter = { language: 'go', scheme: 'file' };
const TRIGGER_CHARS: string[] = ['.', ' ', '\n', '(', ')', '\t', ',', '[', ']'];
let relevanceProc: ChildProcess;
let rnnProc: ChildProcess;
const python = binPath('python3') || binPath('python');

export function activate(context: ExtensionContext) {
    console.log('Extension has been activated');
    relevanceProc = spawn(python, [`${context.extensionPath}/../relevance/relevance.py`]);
    relevanceProc.stderr.on('data', (data) => {
        console.error(data.toString());
    });

    relevanceProc.on('close', (code, signal) => {
        console.error('relevance process died', code, signal);
    });

    rnnProc = spawn(python, [
        `${context.extensionPath}/../rnn/infer.py`, 
        '--model', 
        `${context.extensionPath}/../rnn/docker_toks_11000_GRU_0.8265.hdf`,
        '--number',
        '10',
    ]);
    rnnProc.stderr.on('data', (data) => {
        console.error(data.toString());
    });

    rnnProc.on('close', (code, signal) => {
        console.error('rnn process died', code, signal);
    });
 
    context.subscriptions.push(languages.registerCompletionItemProvider(
        GO_CODE,
        new GoCompletionProvider(
            new LineExchangeProcess(relevanceProc),
            new LineExchangeProcess(rnnProc),
        ),
        ...TRIGGER_CHARS,
    ));
}

export function deactivate() {
    console.log('Extension has been deactivated');
    if (relevanceProc) {
        relevanceProc.kill();
    }

    if (rnnProc) {
        rnnProc.kill();
    }
}
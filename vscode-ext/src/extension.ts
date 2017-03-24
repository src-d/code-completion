'use strict';

import { 
    DocumentFilter, languages, ExtensionContext
} from 'vscode';
import GoCompletionProvider from './autocompletion';

const GO_CODE: DocumentFilter = { language: 'go', scheme: 'file' };
const TRIGGER_CHARS: string[] = ['.', ' ', '\n', '(', ')', '\t', ','];

export function activate(context: ExtensionContext) {
    console.log('Extension has been activated');

    context.subscriptions.push(languages.registerCompletionItemProvider(
        GO_CODE,
        new GoCompletionProvider(),
        ...TRIGGER_CHARS,
    ));
}

export function deactivate() {
    console.log('Extension has been deactivated');
}
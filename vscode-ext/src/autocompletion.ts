'use strict';

import {
	CompletionItemProvider,
	TextDocument, Position, CancellationToken,
	CompletionItem, CompletionItemKind,
} from 'vscode';
import { exec, binPath } from './process';

export default class GoCompletionProvider implements CompletionItemProvider {
	private configured: boolean;
	
	provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): Thenable<CompletionItem[]> {
		console.log('completion requested');
		const text = document.getText();
		const pos = document.offsetAt(position);
		return this.ensureConfigured().then(() => {
			console.log('was configured');
			return Promise.all([
				autocompleteSymbol(pos, text),
				suggestNextTokens(pos, text),
			]).then(processSuggestions);
		});
	}

	ensureConfigured(): Thenable<void> {
		const config = new Promise<void>((resolve, reject) => {
			if (this.configured) {
				return resolve();
			}

			const gocode = binPath('gocode');
			return Promise.all([
				exec(gocode, ['set', 'propose-builtins', 'false']),
				exec(gocode, ['set', 'autobuild', 'true']),
			]).then(_ => {
				this.configured = true;
			});
		});

		return Promise.all([config])
			.then(_ => Promise.resolve());
	}
}

function autocompleteSymbol(position: number, text: string): Thenable<CompletionItem[]> {
	console.log('autocompleting symbols');
	const gocode = binPath('gocode');
	return exec(gocode, ['-f=json', 'autocomplete', 'c'+position], text)
		.then(output => {
			console.log('autocompleted symbols');
			const suggestions = <[number, GocodeSuggestion[]]>JSON.parse(output.stdout);
			return suggestions[1].map(s => {
				return {
					label: s.name,
					kind: classToKind(s.class),
					detail: s.type,
				};
			}).filter(s => s.kind != null);
		});
}

function suggestNextTokens(position: number, text: string): Thenable<string[]> {
	console.log('suggesting next tokens');
	const suggester = binPath('suggester');
	return new Promise<string[]>((resolve, reject) => {
		exec(suggester, [`-pos=${position}`], text)
			.then(out => {
				console.log('suggested next tokens');
				if (out.stdout.startsWith('!ERR')) {
					console.log(out.stdout);
					reject(out.stdout.substr(out.stdout.indexOf(':')));
				} else {
					resolve(out.stdout.split(','));
				}
			});
	});
}

interface GocodeSuggestion {
	class: string;
	name: string;
	type: string;
}

function classToKind(cls: string): CompletionItemKind {
	switch (cls) {
		case 'func':
			return CompletionItemKind.Function;
		case 'package':
			return CompletionItemKind.Module;
		case 'var':
			return CompletionItemKind.Variable;
		case 'type':
			return CompletionItemKind.Class;
		case 'const':
			return CompletionItemKind.Variable;
		default:
			return null;
	}
}

function processSuggestions([completions, suggestions]: [CompletionItem[], string[]]): CompletionItem[] {
	console.log('suggestions', suggestions);
	console.log('completions', completions.map(c => c.label));
	if (suggestions.length === 0) {
		return completions;
	}

	const result = [];
	let completionsAdded = false;
	let i = 0;
	for (const s of suggestions) {
		if (s === 'ID_S' && !completionsAdded) {
			result.push(...completions.map((c, j) => {
				c.sortText = `${i}${j}`;
				return c;
			}));
			completionsAdded = true;
		} else if (s.startsWith('ID_LIT_') && !completionsAdded) {
			// TODO: limit suggestions to variables of the same type
			result.push(...completions.map((c, j) => {
				c.sortText = `${i}${j}`;
				return c;
			}));
			completionsAdded = true;
		} else {
			result.push({
				label: s,
				insertText: s + " ",
				sortText: `${i}`,
				kind: CompletionItemKind.Keyword,
			});
		}
		i++;
	}

	return result;
}
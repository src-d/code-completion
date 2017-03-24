'use strict';

import {
	CompletionItemProvider,
	TextDocument, Position, CancellationToken,
	CompletionItem, CompletionItemKind, Uri, Range,
} from 'vscode';
import { exec, binPath, ReadlineProcess } from './process';

const assignRegex = /([a-zA-Z][a-zA-Z0-9]*) *:?= *$/;
const methodRegex = /([a-zA-Z][a-zA-Z0-9]*)\.$/;

export default class GoCompletionProvider implements CompletionItemProvider {
	private configured: boolean;
	private relevanceSorter: ReadlineProcess;

	constructor(relevanceSorter: ReadlineProcess) {
		this.relevanceSorter = relevanceSorter;
	}

	provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken): Thenable<CompletionItem[]> {
		console.log('completion requested');
		const text = document.getText();
		const pos = document.offsetAt(position);
		const line = document.getText(document.lineAt(position.line).range);
		if (inString(line, position.character)) {
			return Promise.resolve([]);
		}

		// TODO: get the current word and decide if it should be sorted or not

		document.lineAt(position.line).firstNonWhitespaceCharacterIndex;
		const word = document.getText(document.getWordRangeAtPosition(position));
		return this.ensureConfigured().then(() => {
			console.log('was configured');
			return Promise.all([
				autocompleteSymbol(pos, text)
					.then(items => this.sortedCompletions(line, position.character, items)),
				suggestNextTokens(pos, text),
			]).then(([completions, suggestions]) => {
				return processSuggestions(
					document.uri,
					position,
					completions,
					suggestions,
				);
			});
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

	sortByRelevance(ident: string, items: CompletionItem[]): Thenable<CompletionItem[]> {
		this.relevanceSorter.write([ident, ...items.map(c => c.label)].join(','));
		return this.relevanceSorter.next().then(line => {
			if (line) {
				const sorted = line.split(',');
				return items
					.sort((a, b) => sorted.indexOf(a.label) - sorted.indexOf(b.label));
			}

			return items;
		});
	}

	sortedCompletions(line: string, pos: number, items: CompletionItem[]): Thenable<CompletionItem[]> {
		const lineTilPos = line.substring(0, pos).trim();
		let ident;
		if (methodRegex.test(lineTilPos)) {
			ident = methodRegex.exec(lineTilPos)[1];
		} else if (assignRegex.test(lineTilPos)) {
			ident = assignRegex.exec(lineTilPos)[1];
		}

		if (ident) {
			console.log('sorting by relevance for', ident);
			return this.sortByRelevance(ident, items);
		}

		return Promise.resolve(items);
	}
}

function autocompleteSymbol(position: number, text: string): Thenable<CompletionItem[]> {
	console.log('autocompleting symbols');
	const gocode = binPath('gocode');
	return exec(gocode, ['-f=json', 'autocomplete', 'c' + position], text)
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

function isAlpha(code: number): boolean {
	return (code > 47 && code < 58) ||
		(code > 64 && code < 91) ||
		(code > 96 && code < 123);
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

function processSuggestions(uri: Uri, position: Position, completions: CompletionItem[], suggestions: string[]): CompletionItem[] {
	console.log('suggestions', suggestions);
	console.log('completions', completions.map(c => c.label));
	if (suggestions.length === 0) {
		return completions;
	}

	const result = [];
	let completionsAdded = false;
	suggestions.forEach((s, i) => {
		if (s === 'ID_S' && !completionsAdded) {
			result.push(...completions.map((c, j) => withSortKey(c, i, j)));
			completionsAdded = true;
		} else if (s.startsWith('ID_LIT_') && !completionsAdded) {
			// TODO: limit suggestions to variables of the same type
			result.push(...completions.map((c, j) => withSortKey(c, i, j)));
			completionsAdded = true;
		} else {
			result.push(withSortKey({
				label: s,
				insertText: s,
				kind: CompletionItemKind.Keyword,
			}, i));
		}
	});

	return result;
}

function withSortKey(item: CompletionItem, i: number, j: number = 0): CompletionItem {
	item.sortText = `${i}${j}`;
	return item;
}

function inString(line: string, pos: number): boolean {
	let idx;
	if (inQuoted(line, pos, '"') || inQuoted(line, pos, "'")) {
		return true;
	} else if ((idx = line.indexOf('`')) < pos) {
		const n = Array.from(line.substring(idx, pos)).filter(c => c === '`').length;
		return n % 2 > 0;
	}

	return false;
}

function inQuoted(line: string, pos: number, quote: string): boolean {
	let idx = line.indexOf(quote);
	let inStr = false;
	if (idx >= 0 && idx < pos) {
		inStr = true;
		while (idx >= 0 && idx < pos) {
			idx = line.indexOf(quote, idx+1);
			if (idx-1 >= 0 && line.charAt(idx-1) != '\\') {
				inStr = !inStr;
			}
		}
	}
	return inStr;
}
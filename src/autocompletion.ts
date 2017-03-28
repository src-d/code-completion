'use strict';

import {
	CompletionItemProvider,
	TextDocument, Position, CancellationToken,
	CompletionItem, CompletionItemKind, Uri, Range, TextEdit,
} from 'vscode';
import { exec, binPath, LineExchangeProcess, binName } from './process';
import * as path from 'path';

const mainPkgRegex = /package main/g;
const funcRegex = /^func *$/;
const mainFuncRegex = /func main()/g;

export default class GoCompletionProvider implements CompletionItemProvider {
	private extPath: string;
	private configured: boolean;
	private relevanceSorter: LineExchangeProcess;
	private suggester: LineExchangeProcess;
	private idGuesser: LineExchangeProcess;

	constructor(
		extPath: string,
		relevanceSorter: LineExchangeProcess,
		suggester: LineExchangeProcess,
		idGuesser: LineExchangeProcess,
	) {
		this.extPath = extPath;
		this.relevanceSorter = relevanceSorter;
		this.suggester = suggester;
		this.idGuesser = idGuesser;
	}

	provideCompletionItems(
		document: TextDocument,
		position: Position,
		token: CancellationToken,
	): Thenable<CompletionItem[]> {
		const text = document.getText();
		const pos = document.offsetAt(position);

		// don't suggest tokens if the previous line has text but the current one is empty
		// and is at the top level
		if (!document.lineAt(position.line - 1).isEmptyOrWhitespace
			&& document.lineAt(position.line).range.end.character === 0) {
			return Promise.resolve([]);
		}

		const line = document.getText(document.lineAt(position.line).range);
		if (inString(line, position.character)) {
			return Promise.resolve([]);
		}

		if (mainPkgRegex.test(text)
			&& !mainFuncRegex.test(text)
			&& funcRegex.test(line)) {
			return Promise.resolve([{
				label: 'main',
				kind: CompletionItemKind.Variable,
				insertText: 'main() {\n\t',
				detail: 'func main()',
				additionalTextEdits: [TextEdit.insert(new Position(position.line + 1, 0), "}\n")],
			}]);
		}

		const lastFuncIdx = text.substring(0, pos).lastIndexOf('\nfunc');
		const lastFunc = text.substring(
			text.indexOf(' ', lastFuncIdx), 
			text.indexOf('(', lastFuncIdx),
		).trim();

		return this.ensureConfigured().then(() => {
			return Promise.all([
				Promise.all([
					this.extractRelevantIdentifiers(document, position, text),
					autocomplete(pos, text)
						.then(items => items.filter(c => c.label !== 'main' && c.label !== lastFunc)),
					this.tokenize(pos, text, true),
				]).then(([idents, items, tokens]) => this.getCompletions(
					idents, items, tokens, line, position,
				)),
				this.tokenize(pos, text)
					.then(tokens => this.suggestNextTokens(tokens, line)),
			]).then(([completions, suggestions]) => this.processSuggestions(
				document,
				position,
				completions,
				suggestions,
			));
		});
	}

	/**
	 * Returns the list of completions sorted by their relevance.
	 * @param idents relevant identifiers concatenated with @
	 * @param items autocompletions suggested by gocode
	 * @param tokens tokens of the code
	 * @param line current line content
	 * @param position current position
	 */
	getCompletions(
		idents: string,
		items: CompletionItem[],
		tokens: string,
		line: string,
		position: Position,
	): Thenable<CompletionItem[]> {
		return this.guessIdentifiers(tokens, items)
			.then(suggestedItems => {
				if (!suggestedItems || suggestedItems.length === 0) {
					return this.sortedCompletions(
						line, position.character, items, idents,
					);
				}

				return suggestedItems;
			});
	}

	/**
	 * Ensures gocode is configured.
	 */
	ensureConfigured(): Thenable<void> {
		return new Promise<void>((resolve, reject) => {
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
	}

	/**
	 * Runs the word2vec model to sort the completions based on their distance
	 * from the ident.
	 * @param ident list of identifiers concatenated by @
	 * @param items list of completions suggested by gocode
	 */
	sortByRelevance(ident: string, items: CompletionItem[]): Thenable<CompletionItem[]> {
		items = items.filter(c => c.label !== ident);
		return this.relevanceSorter
			.write([ident, ...items.map(c => c.label)].join(','))
			.then(line => {
				if (line) {
					return sortedItems(items, line.split(','));
				}

				return items;
			});
	}

	/**
	 * Runs the word2vec model to sort the completions based on their distance
	 * from the relevantIdents. If there are no relevant idents, the items will
	 * be returned directly.
	 * @param line current line of text
	 * @param pos current position
	 * @param items completion items suggested by gocode
	 * @param relevantIdents relevant identifiers to analyze distance from
	 */
	sortedCompletions(
		line: string,
		pos: number,
		items: CompletionItem[],
		relevantIdents: string | string[] | undefined,
	): Thenable<CompletionItem[]> {
		if (!relevantIdents) {
			return Promise.resolve(items);
		}

		return this.sortByRelevance(
			(Array.isArray(relevantIdents) ? relevantIdents : [relevantIdents]).join('@'),
			items,
		);
	}

	/**
	 * Returns the tokens from the start of the scope until the current position.
	 * @param position current position
	 * @param text text to extract tokens from
	 * @param full return identifier names as well
	 */
	tokenize(position: number, text: string, full: boolean = false): Thenable<string> {
		const tokenizer = path.join(this.extPath, 'bin', platformBin(process.platform, 'tokenizer'));
		return new Promise<string>((resolve, reject) => {
			exec(tokenizer, [`-pos=${position+1}`].concat(full ? ['-full=true'] : []), text + ' ')
				.then(out => {
					if (out.stdout.startsWith('!ERR')) {
						reject(out.stdout.substr(out.stdout.indexOf(':')));
					} else {
						resolve(out.stdout);
					}
				});
		});
	}

	/**
	 * Runs the token model and returns the list of possible next tokens.
	 * @param tokens list of tokens in a format used by the token model
	 */
	suggestNextTokens(tokens: string, line: string): Thenable<string[]> {
		tokens = tokens.trim();
		if (!line.trim()) {
			tokens.substring(0, tokens.length - 1) + ', ";"]';
		}

		return this.suggester.write(tokens.trim())
			.then(line => {
				const suggestions = line.trim().split(' ');
				if (suggestions[0].startsWith("';'")) {
					const nextTokens = tokens.substring(0, tokens.length - 1) + ', ";"]';
					return this.suggestNextTokens(nextTokens, line);
				}

				return suggestions;
			});
	}

	/**
	 * Runs the identifier model to infer identifiers based on the tokens.
	 * After that, the result is filtered and ranked.
	 * @param tokens list of tokens in a format required by the model
	 * @param items autocompletion items suggested by gocode
	 */
	guessIdentifiers(tokens: string, items: CompletionItem[]): Thenable<CompletionItem[] | undefined> {
		return this.idGuesser.write(tokens)
			.then(line => {
				if (!line.trim()) return items;

				const confidences = {};
				line.trim()
					.split(' ')
					.forEach(p => {
						const [ident, confidence] = p.split('@');
						items.filter(it => it.label.toLowerCase().indexOf(ident) >= 0)
							.forEach(m => {
								confidences[m.label] += confidence;
							});
					});

				return items
					.filter(it => (confidences[it.label] || 0) > 0.4)
					.sort((a, b) => (confidences[a.label] || 0) - (confidences[b.label] || 0));
			});
	}

	/**
	 * Processes all the completions and suggestions and returns a final list
	 * of the autocompletion to be suggested by the editor.
	 * The returned list of completions will be the list of suggested tokens,
	 * and if one of them is an identifier the completions offered by intellisense
	 * and word2vec neural network will be appended to the final list. Same with
	 * literals, but filtering them by their type to match the correct literal
	 * type.
	 * @param document complete document instance
	 * @param pos current position
	 * @param completions list of identifiers to autocomplete the current position
	 * after going through a process of sorting by their relevance using the ident
	 * model and/or the word2vec model.
	 * @param suggestions list of suggested tokens by the token model
	 */
	processSuggestions(
		document: TextDocument,
		pos: Position,
		completions: CompletionItem[],
		suggestions: string[],
	): CompletionItem[] {
		if (suggestions.length === 0) {
			return completions;
		}

		const line = document.getText(document.lineAt(pos.line).range);

		const result = [];
		let completionsAdded = [];
		suggestions.forEach((suggestion, i) => {
			let [s, confidence] = suggestion.split('@');
			s = s.startsWith("'") ? s.substring(1, s.length - 1) : s;
			if (line.trim().length > 0 && Number(confidence) < 0.3) {
				return;
			}

			if (s === 'ID_S' && completionsAdded.length < completions.length) {
				result.push(...completions
					.filter(c => completionsAdded.indexOf(c.label) < 0)
					.map((c, j) => withSortKey(c, i, j)));
				completionsAdded.push(...completions.map(c => c.label));
			} else if (s.startsWith('ID_LIT_')) {
				if (s === 'ID_LIT_BOOL') {
					result.push(...[
						{ label: 'true', insertText: 'true', kind: CompletionItemKind.Keyword },
						{ label: 'false', insertText: 'false', kind: CompletionItemKind.Keyword },
					].map((c, j) => withSortKey(c, i, j)));
				}

				if (completionsAdded.length !== completions.length) {
					const toAdd = completions.filter(c => completionsAdded.indexOf(c.label) < 0)
						.filter(isOfType(s.substring(s.lastIndexOf('_') + 1).toLowerCase()))
						.map((c, j) => withSortKey(c, i, s === 'ID_LIT_BOOL' ? j + 2 : j));
					result.push(...toAdd);
					completionsAdded.push(...toAdd.map(c => c.label));
				}
			} else if (s === '{') {
				const lineIndent = document.getText(new Range(
					new Position(pos.line, 0),
					new Position(pos.line, document.lineAt(pos.line).firstNonWhitespaceCharacterIndex)
				));
				const nextLineRange = document.lineAt(pos.line + 1).range;
				const nextLine = document.getText(nextLineRange);
				result.push(
					withSortKey({
						label: s,
						kind: CompletionItemKind.Keyword,
						insertText: s,
					}, i, 0),
					withSortKey({
						label: s + " block",
						kind: CompletionItemKind.Unit,
						insertText: s + '\n\t',
						additionalTextEdits: [TextEdit.replace(nextLineRange, `${lineIndent}}\n${nextLine}`)],
					}, i, 1),
				);
			} else if (!s.startsWith('ID_')) {
				const prefix = requiresNewLine(s, document.lineAt(pos.line).isEmptyOrWhitespace) ? '\n' : '';
				result.push(withSortKey({
					label: s,
					insertText: prefix + s,
					kind: CompletionItemKind.Keyword,
				}, i));
			}
		});

		if (result.length === 0) {
			return completions;
		}

		return result;
	}

	/**
	 * Returns the tokens that are relevant for the autocompletion.
	 * @param doc complete document
	 * @param pos current position
	 * @param text text in the document
	 */
	extractRelevantIdentifiers(
		doc: TextDocument,
		pos: Position,
		text: string,
	): Thenable<string | undefined> {
		const currPos = doc.offsetAt(pos);
		return runGuru('what', currPos, text, doc.uri.fsPath).then(out => {
			if (!out) return out;

			const fcall = out['enclosing']
				.find(c => c['desc'].startsWith('function call'));
			const assignment = out['enclosing']
				.find(c => c['desc'] === 'assignment');

			if (fcall && fcall.start < currPos && fcall.end > currPos) {
				const start: number = fcall['start'];
				const end: number = fcall['end'] || doc.offsetAt(doc.lineAt(pos.line).range.end);
				const call = doc.getText(new Range(doc.positionAt(start), doc.positionAt(end)));

				const lparen = call.indexOf('(');
				const argNum = findArgNum(call.substring(lparen), currPos - start);

				return runGuru('describe', start + lparen - 1, text, doc.uri.fsPath)
					.then(funcData => {
						if (!funcData) return undefined;
						return getFuncArg(funcData, argNum);
					});
			} else if (assignment && assignment.start < currPos && assignment.end > currPos) {
				const start: number = assignment['start'];
				const end: number = assignment['end'] || doc.offsetAt(doc.lineAt(pos.line).range.end);
				const assign = doc.getText(new Range(doc.positionAt(start), doc.positionAt(end)));
				return this.extractIdents(assign);
			}

			return undefined;
		});
	}

	/**
	 * Returns a list of identifiers in the given text.
	 * @param text text to extract identifiers from
	 */
	extractIdents(text: string): Thenable<string[]> {
		const tokenizer = path.join(this.extPath, 'bin', platformBin(process.platform, 'tokenizer'));
		return new Promise<string[]>((resolve, reject) => {
			exec(tokenizer, ['-idents=true'], text)
				.then(out => {
					if (out.stdout.startsWith('!ERR')) {
						reject(out.stdout.substr(out.stdout.indexOf(':')));
					} else {
						resolve(out.stdout.trim().split(','));
					}
				});
		});
	}
}

/**
 * Returns the minimum position between a and b. If one of them is -1,
 * (it's not present) the other is returned. If both of them are present,
 * the minimum of the two is returned.
 * @param a 
 * @param b 
 */
function minPos(a: number, b: number): number {
	if (a < 0) {
		return b;
	} else if (b < 0) {
		return a;
	} else {
		return Math.min(a, b);
	}
}

/**
 * Returns the name of the desired function argument, given a function data.
 * Returns undefined if there is no such argument.
 * @param funcData data about a function
 * @param argNum argument number
 */
export function getFuncArg(funcData: any, argNum: number): string | undefined {
	const type = (funcData.value && funcData.value.type) || '';
	if (type.endsWith('()')) return undefined;

	if (type.startsWith('func')) {
		const lparen = type.indexOf('(');
		const argsStr = type.substring(lparen + 1, type.lastIndexOf(')')).trim();
		const args = [];

		let ident = '', inName = true, depth = 0;
		for (let i = 0, len = argsStr.length; i < len; i++) {
			const ch = argsStr.charAt(i);
			if (inName) {
				const spacePos = argsStr.indexOf(' ', i + 1);
				const commaPos = argsStr.indexOf(',', i + 1);
				const idx = minPos(spacePos, commaPos);
				args.push(argsStr.substring(i, idx).trim());

				i = idx;
				if (idx === spacePos) {
					inName = false;
				}
			} else if (ch === '(') {
				depth++;
			} else if (ch === ')') {
				depth--;
			} else if (ch === ',' && depth === 0) {
				inName = true;
			}
		}

		if (args.length >= argNum) {
			return args[argNum - 1];
		}
	}

	return undefined;
}

/**
 * Runs gocode and finds the suggested autocompletions for the current position
 * and returns a list of completion items.
 * @param position current position in text (character based)
 * @param text complete text of the file
 */
function autocomplete(position: number, text: string): Thenable<CompletionItem[]> {
	const gocode = binPath('gocode');
	return exec(gocode, ['-f=json', 'autocomplete', 'c' + position], text)
		.then(output => {
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

/**
 * Runs guru tool and returns an object with the result or undefined
 * in a promise.
 * @param mode mode to run gocode (what, describe, ...)
 * @param pos current position
 * @param text text in the file
 * @param file file name
 */
function runGuru(
	mode: string,
	pos: number,
	text: string,
	file: string,
): Thenable<any | undefined> {
	const guru = binPath('guru');
	return exec(
		guru,
		['-json', '-modified', mode, `${file}:#${pos}`],
		`${file}\n${text.length}\n${text}`,
	).then(out => {
		try {
			return JSON.parse(out.stdout);
		} catch (e) {
			return undefined;
		}
	});
}

/**
 * Reports whether the character code is alphanumeric or not.
 * @param code character code
 */
function isAlpha(code: number): boolean {
	return (code > 47 && code < 58) ||
		(code > 64 && code < 91) ||
		(code > 96 && code < 123);
}

interface GocodeSuggestion {
	class: string;
	name: string;
	type: string;
}

/**
 * Converts a suggestion class returned by gocode to CompletionItemKind.
 * @param cls class of the suggestion
 */
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

const newLineKeywords = ['if', 'for', 'select', 'switch', 'defer', 'go'];

/**
 * Reports if the suggested token would require a new line to be inserted.
 * @param suggestion name of the suggested token
 * @param isEmpty if the line is empty or not
 */
function requiresNewLine(suggestion: string, isEmpty: boolean): boolean {
	return newLineKeywords.indexOf(suggestion) >= 0 && !isEmpty;
}

/**
 * Returns a completion item with a sort key added.
 * @param item completion item to update
 * @param i first number of the sort key
 * @param j second number of the sort key
 */
function withSortKey(item: CompletionItem, i: number, j: number = 0): CompletionItem {
	item.sortText = `${i}${j}`;
	return item;
}

/**
 * Reports whether the current position of a line is inside a string.
 * @param line current complete line
 * @param pos current position in line
 */
export function inString(line: string, pos: number): boolean {
	let inStr = false, quoted = false, quote = '';
	for (let i = 0, len = line.length; i < len; i++) {
		if (i >= pos) {
			break;
		}

		const ch = line.charAt(i);
		if (
			(ch === '\'' || ch === '"')
			&& !quoted
			&& (quote === ch || !inStr)
		) {
			inStr = !inStr;
			quote = ch;
		} else if (
			ch === '`'
			&& (quote === ch || !inStr)
		) {
			inStr = !inStr;
			quote = ch;
		} else if (ch === '\\') {
			quoted = true;
		} else if (quoted) {
			quoted = false;
		}
	}

	return inStr;
}

const typeMapping: { [k: string]: string[] | string } = {
	'int': ['uint8', 'byte', 'int8', 'int16', 'uint16', 'int32', 'uint32', 'int', 'uint', 'int64', 'uint64', 'uintptr'],
	'imag': ['complex128', 'complex256'],
	'string': 'string',
	'char': 'rune',
	'bool': 'bool',
	'float': ['float32', 'float64'],
};

/**
 * Returns a function to check if a completion item is of a given type or not.
 * @param typ type of literal
 */
function isOfType(typ: string): (CompletionItem) => boolean {
	const t = typeMapping[typ];
	if (Array.isArray(t)) {
		return c => t.indexOf(c.detail) >= 0;
	}
	return (c) => c.detail === t;
}

const openers = ['(', '[', '{'];
const closers = [')', ']', '}'];

/**
 * Returns the number of the argument for the current position in a function
 * call.
 * @param call function call without the function name e.g. `(a, b, 1)`
 * @param pos current position from the start of the `call`
 */
export function findArgNum(call: string, pos: number): number {
	let depth = 0, argNum = 1;
	for (let i = 0, len = call.length; i < len; i++) {
		const ch = call.charAt(i);
		if (i >= pos) {
			return argNum;
		} else if (openers.indexOf(ch) >= 0) {
			depth++;
		} else if (closers.indexOf(ch) >= 0) {
			depth--;
		} else if (ch === ',' && depth === 1) {
			argNum++;
		}
	}
	return argNum;
}

/**
 * Returns the correct name of a binary for the current platform.
 * This is only for internal bundled binaries such as the tokenizer.
 * @param name name of the binary without extension
 */
export function platformBin(platform: string, name: string): string {
	return binName(`${name}_${platform}`);
}

/**
 * Returns the items present in sortedIdents ordered by their position in
 * sortedIdents.
 * @param items autocompletion items
 * @param sortedIdents identifiers sorted
 */
export function sortedItems(
	items: CompletionItem[],
	sortedIdents: string[],
): CompletionItem[] {
	return items
		.filter(c => sortedIdents.indexOf(c.label) >= 0)
		.sort((a, b) => (
			sortedIdents.indexOf(a.label) - sortedIdents.indexOf(b.label)
		));
}
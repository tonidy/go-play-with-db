import type * as monaco from 'monaco-editor'
import type { StateDispatch } from '~/store'
import type { GoCompletionService, SuggestionContext, SuggestionQuery } from '~/services/completion'
import { asyncDebounce } from '../../utils'
import snippets from './snippets'
import { parseExpression } from './parse'
import { CacheBasedCompletionProvider } from '../base'
import type { DocumentMetadataCache } from '../cache'

const SUGGESTIONS_DEBOUNCE_DELAY = 500

/**
 * Provides completion for symbols such as variables and functions.
 */
export class GoSymbolsCompletionItemProvider extends CacheBasedCompletionProvider<SuggestionQuery> {
  triggerCharacters = Array.from('.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
  private readonly metadataCache: DocumentMetadataCache
  private readonly getSuggestionFunc = asyncDebounce(
    async (query) => await this.completionSvc.getSymbolSuggestions(query),
    SUGGESTIONS_DEBOUNCE_DELAY,
  )

  constructor(dispatch: StateDispatch, compSvc: GoCompletionService, metadataCache: DocumentMetadataCache) {
    super(dispatch, compSvc)
    this.metadataCache = metadataCache
  }

  protected getFallbackSuggestions(query: SuggestionQuery): monaco.languages.CompletionList {
    if ('packageName' in query) {
      return { suggestions: [] }
    }

    // filter snippets by prefix.
    // usually monaco does that but not always in right way
    const { value } = query
    const items = value ? snippets.filter((s) => s.label.startsWith(value)) : snippets

    return {
      suggestions: items,
    }
  }

  protected parseCompletionQuery(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    _context: monaco.languages.CompletionContext,
    _token: monaco.CancellationToken,
  ) {
    const val = model
      .getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 0,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      })
      .trim()

    const query = parseExpression(val)
    if (!query) {
      return null
    }

    const word = model.getWordUntilPosition(position)
    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    }

    const imports = this.metadataCache.getMetadata(model.uri.path, model)
    const context: SuggestionContext = {
      range,
      imports,
    }

    return { ...query, context }
  }

  protected async querySuggestions(query: SuggestionQuery) {
    const { suggestions: relatedSnippets } = this.getFallbackSuggestions(query)
    const results = await this.getSuggestionFunc(query)
    if (!results?.length) {
      return relatedSnippets
    }

    return relatedSnippets.length ? relatedSnippets.concat(results) : results
  }
}

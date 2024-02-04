import * as axios from 'axios'
import { type languages } from 'monaco-editor'
import {
  Backend,
  type VersionResponse,
  type RunResponse,
  type BuildResponse,
  type Snippet,
  type ShareResponse,
  type VersionsInfo,
  type FormatResponse,
} from './models'
import { type IAPIClient } from './interface'

export class Client implements IAPIClient {
  private readonly client: axios.AxiosInstance

  get axiosClient() {
    return this.client
  }

  constructor(private readonly baseUrl: string) {
    this.client = axios.default.create({ baseURL: baseUrl })
  }

  async getVersion(): Promise<VersionResponse> {
    return await this.get<VersionResponse>(`/version?=${Date.now()}`)
  }

  async getSuggestions(query: { packageName?: string; value?: string }): Promise<languages.CompletionList> {
    const queryParams = Object.keys(query)
      .map((k) => `${k}=${query[k]}`)
      .join('&')
    return await this.get<languages.CompletionList>(`/suggest?${queryParams}`)
  }

  async build(code: string, format: boolean): Promise<BuildResponse> {
    return await this.post<BuildResponse>(`/compile?format=${Boolean(format)}`, code)
  }

  async getArtifact(fileName: string): Promise<Response> {
    const resp = await fetch(`${this.baseUrl}/artifacts/${fileName}`)
    if (resp.status >= 400) {
      const err = await resp.json()
      throw new Error(err.message ?? resp.statusText)
    }

    return resp
  }

  async run(files: Record<string, string>, vet: boolean, backend = Backend.Default): Promise<RunResponse> {
    return await this.post<RunResponse>(`/v2/run?vet=${Boolean(vet)}&backend=${backend}`, { files })
  }

  async format(files: Record<string, string>, backend = Backend.Default): Promise<FormatResponse> {
    return await this.post<FormatResponse>(`/v2/format?backend=${backend}`, { files })
  }

  async getSnippet(id: string): Promise<Snippet> {
    return await this.get<Snippet>(`/snippet/${id}`)
  }

  async shareSnippet(code: string): Promise<ShareResponse> {
    return await this.post<ShareResponse>('/share', code)
  }

  async getBackendVersions(): Promise<VersionsInfo> {
    return await this.get<VersionsInfo>('/backends/info')
  }

  private async get<T>(uri: string): Promise<T> {
    try {
      const resp = await this.client.get<T>(uri)
      return resp.data
    } catch (err) {
      throw Client.extractAPIError(err)
    }
  }

  private async post<T>(uri: string, data: any, cfg?: axios.AxiosRequestConfig): Promise<T> {
    try {
      const resp = await this.client.post<T>(uri, data, cfg)
      return resp.data
    } catch (err) {
      throw Client.extractAPIError(err)
    }
  }

  private static extractAPIError(err: any): Error {
    return new Error(err?.response?.data?.error ?? err.message)
  }
}

import type { ProviderEndpoint } from '../types/generation'

function parseModelId(modelId: string): { author: string; slug: string } | null {
  const normalized = modelId.trim()
  const [author, ...slugParts] = normalized.split('/')
  if (!author || slugParts.length === 0) {
    return null
  }

  return {
    author,
    slug: slugParts.join('/'),
  }
}

function parseEndpoint(item: Record<string, unknown>): ProviderEndpoint | null {
  const providerName = item.provider_name
  if (typeof providerName !== 'string' || !providerName.trim()) {
    return null
  }

  const pricing = item.pricing && typeof item.pricing === 'object'
    ? (item.pricing as Record<string, unknown>)
    : null

  const inputPrice = pricing && typeof pricing.prompt === 'string' ? pricing.prompt : '0'
  const outputPrice = pricing && typeof pricing.completion === 'string' ? pricing.completion : '0'

  return {
    providerName: providerName.trim(),
    modelId: typeof item.model_id === 'string' ? item.model_id : '',
    quantization: typeof item.quantization === 'string' ? item.quantization : null,
    uptimeLast30m: typeof item.uptime_last_30m === 'number' ? item.uptime_last_30m : null,
    inputPrice,
    outputPrice,
  }
}

function extractEndpointRecords(payload: unknown): Record<string, unknown>[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const root = payload as Record<string, unknown>

  if (Array.isArray(root.endpoints)) {
    return root.endpoints.filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object',
    )
  }

  if (
    root.data &&
    typeof root.data === 'object' &&
    !Array.isArray(root.data) &&
    Array.isArray((root.data as Record<string, unknown>).endpoints)
  ) {
    const nestedEndpoints = (root.data as Record<string, unknown>).endpoints as unknown[]
    return nestedEndpoints.filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object',
    )
  }

  if (Array.isArray(root.data)) {
    return root.data.filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object',
    )
  }

  if (Array.isArray(payload)) {
    return payload.filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object',
    )
  }

  return []
}

async function fetchProviderEndpoints(modelId: string): Promise<ProviderEndpoint[]> {
  const parsed = parseModelId(modelId)
  if (!parsed) {
    return []
  }

  const url = `https://openrouter.ai/api/v1/models/${encodeURIComponent(parsed.author)}/${encodeURIComponent(parsed.slug)}/endpoints`

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return []
    }

    const payload = (await response.json()) as unknown
    const endpoints = extractEndpointRecords(payload)
      .map(parseEndpoint)
      .filter((item): item is ProviderEndpoint => item !== null)

    const seen = new Set<string>()
    return endpoints.filter((endpoint) => {
      if (seen.has(endpoint.providerName)) {
        return false
      }
      seen.add(endpoint.providerName)
      return true
    })
  } catch {
    return []
  }
}

export { fetchProviderEndpoints }

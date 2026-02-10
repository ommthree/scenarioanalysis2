/**
 * Fetch with custom timeout for long-running operations
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @param timeout - Timeout in milliseconds (default: 10 minutes)
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 600000 // 10 minutes default
): Promise<Response> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout / 1000} seconds`)
    }
    throw error
  }
}

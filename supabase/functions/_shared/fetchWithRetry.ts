/**
 * Fetch with timeout - prevents hanging requests to external APIs
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with retry and exponential backoff.
 * - Retries on 5xx errors and network failures
 * - Does NOT retry on 4xx errors (client errors) unless retryOn4xx is true
 * - Exponential backoff: 1s, 2s, 4s
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: {
    maxRetries?: number;
    timeoutMs?: number;
    retryOn4xx?: boolean;
  } = {}
): Promise<Response> {
  const { maxRetries = 3, timeoutMs = 5000, retryOn4xx = false } = config;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

      // Success
      if (response.ok) return response;

      // Don't retry client errors unless explicitly asked
      if (response.status >= 400 && response.status < 500 && !retryOn4xx) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
    }

    // Exponential backoff before retry (skip on last attempt)
    if (attempt < maxRetries) {
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`Retry ${attempt + 1}/${maxRetries} for ${url} in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error(`Failed after ${maxRetries} retries: ${url}`);
}

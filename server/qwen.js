const BASE_URL = process.env.QWEN_BASE_URL || 'https://dashscope-intl.aliyuncs.com';
const API_KEY = process.env.DASHSCOPE_API_KEY;

export const MODELS = {
  text: process.env.QWEN_TEXT_MODEL || 'qwen3.7-plus',
  asr: process.env.QWEN_ASR_MODEL || 'qwen3-asr-flash',
  image: process.env.QWEN_IMAGE_MODEL || 'qwen-image-2.0-pro'
};

export const liveMode = () => Boolean(API_KEY);

class QwenError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'QwenError';
    this.status = status;
  }
}
export { QwenError };

async function post(path, body, { timeoutMs = 90000 } = {}) {
  if (!API_KEY) throw new QwenError('DASHSCOPE_API_KEY is not configured', 503);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const text = await response.text();
    if (!response.ok) {
      let detail = text.slice(0, 400);
      try {
        const parsed = JSON.parse(text);
        detail = parsed.error?.message || parsed.message || detail;
      } catch {}
      throw new QwenError(`Qwen API ${response.status}: ${detail}`, 502);
    }
    return JSON.parse(text);
  } catch (err) {
    if (err.name === 'AbortError') throw new QwenError('Qwen API timed out', 504);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Chat completion that must return a JSON object. */
export async function chatJSON({ system, user, temperature = 0.4, maxTokens = 3500 }) {
  const data = await post('/compatible-mode/v1/chat/completions', {
    model: MODELS.text,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    temperature,
    max_tokens: maxTokens,
    enable_thinking: false,
    response_format: { type: 'json_object' }
  });
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new QwenError('Qwen returned an empty completion');
  try {
    return JSON.parse(content);
  } catch {
    // Some models wrap JSON in code fences despite response_format.
    const match = content.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new QwenError('Qwen returned malformed JSON');
  }
}

/** Transcribe a short base64-encoded audio clip. */
export async function transcribe({ base64, mime = 'audio/wav' }) {
  const data = await post('/compatible-mode/v1/chat/completions', {
    model: MODELS.asr,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: { data: `data:${mime};base64,${base64}` }
          }
        ]
      }
    ],
    stream: false,
    asr_options: { enable_itn: true }
  });
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) return content.map(part => part.text || '').join('').trim();
  throw new QwenError('Qwen ASR returned no transcript');
}

/** Generate one image, returns a hosted URL (expires ~24h). */
export async function generateImage({ prompt, size }) {
  const parameters = { n: 1, watermark: false, prompt_extend: true };
  const configuredSize = size || process.env.QWEN_IMAGE_SIZE;
  if (configuredSize) parameters.size = configuredSize;
  const data = await post('/api/v1/services/aigc/multimodal-generation/generation', {
    model: MODELS.image,
    input: { messages: [{ role: 'user', content: [{ text: prompt }] }] },
    parameters
  }, { timeoutMs: 150000 });
  const content = data.output?.choices?.[0]?.message?.content;
  const image = Array.isArray(content) ? content.find(part => part.image)?.image : null;
  if (!image) throw new QwenError('Qwen image generation returned no image');
  return image;
}

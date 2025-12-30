import { ApiConfig } from '../types';

// 定义模型类型
type ModelType = 'gemini' | 'claude' | 'deepseek' | 'qwen' | 'openai' | 'custom';

// 模型配置接口
interface ModelConfig {
  maxTokens: number;
  baseUrl: string;
  apiKey: string;
  textModel: string;
}

// 获取模型类型
const getModelType = (baseUrl: string, provider?: string): ModelType => {
  // 优先根据 provider 参数判断
  if (provider === 'google') {
    return 'gemini';
  } else if (provider === 'claude') {
    return 'claude';
  } else if (provider === 'deepseek') {
    return 'deepseek';
  } else if (provider === 'openai') {
    return 'openai';
  } else if (provider === 'qwen') {
    return 'qwen';
  }

  // 如果没有 provider 参数,则根据 URL 判断
  if (baseUrl.includes('generativelanguage.googleapis.com') || baseUrl.includes('gemini')) {
    return 'gemini';
  } else if (baseUrl.includes('anthropic.com')) {
    return 'claude';
  } else if (baseUrl.includes('deepseek.com')) {
    return 'deepseek';
  } else if (baseUrl.includes('openai.com')) {
    return 'openai';
  } else if (baseUrl.includes('dashscope.aliyuncs.com')) {
    return 'qwen';
  } else {
    return 'custom';
  }
};

// 构建API请求URL
const buildApiUrl = (
  modelType: ModelType,
  baseUrl: string,
  textModel: string,
  apiKey: string
): string => {
  const cleanBase = baseUrl.replace(/\/+$/, '');

  switch (modelType) {
    case 'gemini':
      return `${cleanBase}/v1beta/models/${textModel}:generateContent?key=${apiKey}`;
    case 'claude':
      if (cleanBase.endsWith('/v1/messages')) {
        return cleanBase;
      } else if (cleanBase.endsWith('/v1')) {
        return `${cleanBase}/messages`;
      } else {
        return `${cleanBase}/v1/messages`;
      }
    default: // openai, deepseek, custom
      if (cleanBase.endsWith('/chat/completions')) {
        return cleanBase;
      } else if (cleanBase.endsWith('/v1')) {
        return `${cleanBase}/chat/completions`;
      } else {
        return `${cleanBase}/v1/chat/completions`;
      }
  }
};

// 构建请求头
const buildHeaders = (modelType: ModelType, apiKey: string): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  switch (modelType) {
    case 'gemini':
      // Gemini API在URL中包含API密钥，不需要Authorization头
      break;
    case 'claude':
      // Claude API需要Authorization和x-api-key头
      headers['Authorization'] = `Bearer ${apiKey}`;
      headers['x-api-key'] = apiKey;
      break;
    default: // openai, deepseek, custom
      // OpenAI兼容API只需要Authorization头
      headers['Authorization'] = `Bearer ${apiKey}`;
      break;
  }

  return headers;
};

// 获取最大令牌数
const getMaxTokens = (modelType: ModelType): number => {
  switch (modelType) {
    case 'deepseek':
      return 8192; // DeepSeek模型max_tokens限制为8192
    case 'claude':
    case 'gemini':
    case 'openai':
    case 'custom':
      return 32768; // Claude、Gemini、OpenAI和Custom模型支持32768
    default:
      return 8192; // 其他模型默认使用8192
  }
};

// 构建请求体
const buildRequestBody = (
  modelType: ModelType,
  systemPrompt: string,
  userPrompt: string,
  textModel: string,
  maxTokens: number,
  temperature: number = 0.7,
  wordCount?: number
) => {
  // 根据wordCount动态调整maxTokens（如果提供了wordCount）
  let adjustedMaxTokens = maxTokens;
  if (wordCount) {
    // 优化tokens计算：大幅增加缓冲，避免创作长文时被截断
    // 使用 5.0 倍系数，对于长窗口模型（如Gemini 32k）提供充足空间
    // 对于短窗口模型（如DeepSeek 8k），后续的Math.min会确保不超限
    const estimatedTokens = Math.round(wordCount * 5.0);
    // 确保不超过模型的最大限制
    adjustedMaxTokens = Math.min(estimatedTokens, maxTokens);
    // 为确保内容完整性，设置最小tokens限制
    adjustedMaxTokens = Math.max(adjustedMaxTokens, Math.round(wordCount * 1.2));
  }

  switch (modelType) {
    case 'gemini':
      return {
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          maxOutputTokens: adjustedMaxTokens,
          temperature: temperature,
        },
      };
    case 'claude':
      return {
        model: textModel,
        max_tokens: adjustedMaxTokens,
        temperature: temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      };
    default: // openai, deepseek, custom
      return {
        model: textModel,
        max_tokens: adjustedMaxTokens,
        temperature: temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      };
  }
};

// 解析API响应
const parseApiResponse = (modelType: ModelType, data: any): string => {
  switch (modelType) {
    case 'gemini':
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No content generated.';
    case 'claude':
      // Claude API 响应格式：{ content: [{ type: 'text', text: '...' }], ... }
      if (data.content && data.content.length > 0) {
        const message = data.content[0];
        if (message.type === 'text') {
          return message.text || 'No content generated.';
        }
      }
      return 'No content generated.';
    default: // openai, deepseek, custom
      // OpenAI兼容API响应格式
      return data.choices?.[0]?.message?.content || 'No content generated.';
  }
};

export const generateContent = async (
  systemPrompt: string,
  userPrompt: string,
  config?: ApiConfig,
  wordCount?: number
) => {
  // 确保config有合理的默认值
  const safeConfig = (config || {}) as ApiConfig;
  const apiKeyToUse = safeConfig?.apiKey?.trim() || '';
  const baseUrl = safeConfig?.baseUrl?.trim() || 'https://gemini.txtbg.cn';

  // 检查API密钥是否为空
  if (!apiKeyToUse) {
    throw new Error('API密钥不能为空，请检查API配置。');
  }

  // Use the stable alias 'gemini-2.5-flash' as default
  const textModel =
    safeConfig?.textModel === 'custom'
      ? safeConfig.customTextModel || 'gpt-4o'
      : safeConfig?.textModel?.trim() || 'gemini-2.5-flash';

  // 获取模型类型
  const modelType = getModelType(baseUrl, safeConfig?.provider);
  // 获取最大令牌数
  const maxTokens = getMaxTokens(modelType);

  // Optimized retry settings for better performance
  const maxRetries = 3; // Reduced from 5 to 3 retries
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      // 构建API请求URL
      const url = buildApiUrl(modelType, baseUrl, textModel, apiKeyToUse);

      // 构建请求头
      const headers = buildHeaders(modelType, apiKeyToUse);

      // 构建请求体，传递wordCount参数以动态调整maxTokens
      const body = buildRequestBody(
        modelType,
        systemPrompt,
        userPrompt,
        textModel,
        maxTokens,
        undefined,
        wordCount
      );

      // [DEBUG] 输出发送给AI的完整Prompt信息，用于排查变量替换问题
      console.log('[API DEBUG] Request Body:', {
        systemPrompt,
        userPrompt,
        modelType,
        textModel,
      });

      // 记录请求开始时间
      const startTime = Date.now();

      // 为不同模型设置差异化超时时间
      let timeout = 60000; // 默认60秒
      if (modelType === 'deepseek') {
        timeout = 120000; // DeepSeek模型增加到120秒
      } else if (modelType === 'claude') {
        timeout = 90000; // Claude模型增加到90秒
      }

      // 添加超时机制
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeout),
      });

      console.log(
        `[Generate Content] API request completed in ${
          Date.now() - startTime
        }ms for ${modelType} model`
      );

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(
          `API Error: ${response.status} ${response.statusText} - ${errorText}`
        );

        // Only retry for server errors (5xx) and timeout errors
        if (response.status >= 500 && response.status < 600) {
          // Server error, retry
          attempt++;
          console.warn(`Attempt ${attempt} failed (server error): ${error.message}`);
          if (attempt >= maxRetries) throw error;
          // Use linear backoff with jitter for faster recovery: 1s, 2s, 3s + random 0-500ms
          const delay = 1000 * attempt + Math.random() * 500;
          await new Promise((r) => setTimeout(r, delay));
          continue;
        } else {
          // Client error (4xx), don't retry
          throw error;
        }
      }

      const data = await response.json();

      // 解析API响应
      return parseApiResponse(modelType, data);
    } catch (e: any) {
      // 提取统一的重试延迟计算函数
      const calculateDelay = (errorType: string) => {
        // 基础延迟时间（毫秒）
        let baseDelay = 1000;

        // 根据错误类型调整基础延迟
        switch (errorType) {
          case 'timeout':
            baseDelay = 2000;
            break;
          case 'network':
            baseDelay = 2500;
            break;
          default:
            baseDelay = 1500;
        }

        // 线性退避 + 抖动
        const linearDelay = baseDelay * attempt;
        const jitter = Math.random() * 500; // 添加0-500ms的抖动
        return Math.min(linearDelay + jitter, 10000); // 最大延迟不超过10秒
      };

      // 统一的重试逻辑
      const handleRetry = async (errorType: string, errorMessage: string) => {
        attempt++;
        console.warn(`Attempt ${attempt} failed (${errorType}): ${errorMessage}`);

        if (attempt >= maxRetries) {
          return false; // 达到最大重试次数
        }

        // 计算延迟
        const delay = calculateDelay(errorType);
        await new Promise((r) => setTimeout(r, delay));
        return true; // 继续重试
      };

      // 检查是否是超时导致的AbortError
      if (e.name === 'AbortError') {
        const modelName =
          modelType === 'deepseek' ? 'DeepSeek' : modelType === 'claude' ? 'Claude' : '此模型';
        const shouldRetry = await handleRetry('timeout', '生成超时，正在重试...');
        if (!shouldRetry) {
          throw new Error(
            `生成超时：${modelName}模型生成内容需要较长时间，请尝试使用更快的模型（如Gemini 2.5 Flash或GPT-4o），或检查网络连接后重试。`
          );
        }
        continue;
      }

      // 检查是否是其他类型的超时错误
      if (e.name === 'TimeoutError' || e.message.includes('timeout')) {
        const shouldRetry = await handleRetry('timeout', e.message);
        if (!shouldRetry) {
          throw new Error('生成超时：网络连接不稳定或API响应过慢，请稍后重试。');
        }
        continue;
      }

      // 检查是否是网络错误
      if (
        e.name === 'TypeError' ||
        e.message.includes('network') ||
        e.message.includes('Failed to fetch')
      ) {
        const shouldRetry = await handleRetry('network', e.message);
        if (!shouldRetry) {
          throw new Error('网络错误：无法连接到API服务器，请检查网络连接后重试。');
        }
        continue;
      }

      // 其他错误（客户端错误、无效API密钥等）- 不重试
      console.error(`Request failed without retry: ${e.message}`);

      // 提供更友好的错误信息
      if (e.message.includes('401') || e.message.includes('API key')) {
        throw new Error('API密钥错误：请检查API密钥是否正确配置。');
      } else if (e.message.includes('404')) {
        throw new Error('模型不存在：请检查模型名称是否正确。');
      } else if (e.message.includes('503') || e.message.includes('Service Unavailable')) {
        throw new Error('服务不可用：API服务暂时不可用，请稍后重试。');
      }

      throw e;
    }
  }
};

export const generateSpeech = async (text: string, config?: ApiConfig) => {
  const apiKeyToUse = config?.apiKey?.trim() || '';

  // 检查API密钥是否为空
  if (!apiKeyToUse) {
    throw new Error('语音生成失败：API密钥不能为空，请检查API配置。');
  }

  // 检查文本是否为空
  if (!text || text.trim() === '') {
    throw new Error('语音生成失败：请输入要转换为语音的文本。');
  }

  // TTS is strictly Gemini for now in this app structure
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const response = await fetch(
        `https://gemini.txtbg.cn/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKeyToUse}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: text }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`语音生成失败：${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error('语音生成失败：未收到音频数据，请重试。');
      }

      return base64Audio;
    } catch (e: any) {
      attempt++;

      // 提供更具体的错误信息
      if (e.name === 'AbortError') {
        if (attempt >= maxRetries) {
          throw new Error('语音生成超时：请检查网络连接后重试。');
        }
      } else if (e.message.includes('401') || e.message.includes('API key')) {
        throw new Error('语音生成失败：API密钥错误，请检查API配置。');
      } else if (e.message.includes('404')) {
        throw new Error('语音生成失败：TTS模型不存在，请检查模型名称是否正确。');
      } else if (e.message.includes('503') || e.message.includes('Service Unavailable')) {
        throw new Error('语音生成失败：TTS服务暂时不可用，请稍后重试。');
      }

      if (attempt >= maxRetries) {
        throw new Error(`语音生成失败：${e.message}`);
      }

      // 使用指数退避策略
      const delay = 1000 * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return '';
};

export const formatPrompt = (template: string, variables: Record<string, any>) => {
  return template.replace(/\{\s*([a-zA-Z0-9_]+)\s*\}/g, (match, key) => {
    const value = variables[key];
    return value !== undefined && value !== null ? String(value) : match;
  });
};

export const cleanAIResponse = (text: string) => {
  const titleRegex = /^##\s*第[0-9一二三四五六七八九十百千]+章/m;
  const match = text.match(titleRegex);

  if (match) {
    return text.substring(match.index!);
  }

  // Remove reasoning logs if present (often starting with | for tabular data or just messy logs)
  if (text.trim().startsWith('|')) {
    return text.replace(/^([|].*[\r\n]+)+/gm, '').trim();
  }

  return text;
};

// 测试连接函数
export const testConnection = async (
  config: ApiConfig
): Promise<{ success: boolean; message: string }> => {
  try {
    const apiKeyToUse = config.apiKey?.trim() || '';
    const baseUrl = config.baseUrl?.trim() || '';

    if (!apiKeyToUse) {
      return { success: false, message: 'API密钥不能为空' };
    }

    if (!baseUrl) {
      return { success: false, message: '基本网址不能为空' };
    }

    // Use the stable alias 'gemini-2.5-flash' as default for testing
    const textModel =
      config.textModel === 'custom'
        ? config.customTextModel || 'gpt-4o'
        : config.textModel?.trim() || 'gemini-2.5-flash';

    // 获取模型类型
    const modelType = getModelType(baseUrl, config.provider);

    // 构建API请求URL
    const url = buildApiUrl(modelType, baseUrl, textModel, apiKeyToUse);

    // 构建请求头
    const headers = buildHeaders(modelType, apiKeyToUse);

    // Simple test prompt that should return a short response quickly
    const testSystemPrompt =
      "You are a helpful assistant. Please respond with 'OK' if you can understand this message.";
    const testUserPrompt = 'Test connection';

    // 构建请求体，使用较小的maxTokens进行测试
    const body = buildRequestBody(modelType, testSystemPrompt, testUserPrompt, textModel, 10, 0.0);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000), // 10秒超时
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        message: `连接失败: ${response.status} ${response.statusText} - ${errorText}`,
      };
    }

    const data = await response.json();

    // 解析API响应
    const responseText = parseApiResponse(modelType, data);

    if (responseText && responseText !== 'No content generated.') {
      return {
        success: true,
        message: `连接成功！模型返回: ${responseText.trim()}`,
      };
    } else {
      // 调试信息，帮助理解响应结构
      console.log('Test connection response:', data);
      return {
        success: true,
        message: '连接成功！API返回了有效响应。',
      };
    }
  } catch (error: any) {
    return { success: false, message: `连接失败: ${error.message}` };
  }
};

export const pcmToWav = (base64PCM: string) => {
  const binaryString = atob(base64PCM);
  const pcmData = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    pcmData[i] = binaryString.charCodeAt(i);
  }

  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;

  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, (sampleRate * numChannels * bitsPerSample) / 8, true);
  view.setUint16(32, (numChannels * bitsPerSample) / 8, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcmData.length, true);

  const wavBody = new Uint8Array(header.byteLength + pcmData.length);
  wavBody.set(new Uint8Array(header), 0);
  wavBody.set(pcmData, header.byteLength);

  return new Blob([wavBody], { type: 'audio/wav' });
};

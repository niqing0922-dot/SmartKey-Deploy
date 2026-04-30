import type { AIProvider } from '@/types'

export type GuideContent = {
  officialUrl: string
  keyHint: string
  billingNote: string
  steps: string[]
}

export const AI_PROVIDER_GUIDES: Record<AIProvider, GuideContent> = {
  gemini: {
    officialUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza...',
    billingNote: 'Google AI Studio offers a free tier with usage limits.',
    steps: [
      'Sign in to Google AI Studio with your Google account.',
      'Open API Keys and click Create API key.',
      'Copy the generated key and paste it in this page.',
    ],
  },
  minimax: {
    officialUrl: 'https://www.minimax.io/platform',
    keyHint: 'sk-...',
    billingNote: 'Check your workspace quota and billing plan before production use.',
    steps: [
      'Sign in to MiniMax Platform and open API management.',
      'Create a new key for your workspace/project.',
      'Copy the key and save it here.',
    ],
  },
  openai: {
    officialUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-...',
    billingNote: 'API usage is billed by model and token consumption.',
    steps: [
      'Open OpenAI Platform and go to API Keys.',
      'Click Create new secret key.',
      'Copy the key once and store it in this settings page.',
    ],
  },
  anthropic: {
    officialUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-...',
    billingNote: 'Billing and rate limits depend on your Anthropic workspace plan.',
    steps: [
      'Open Anthropic Console and sign in.',
      'Go to API Keys and create a new key.',
      'Copy the key and paste it here.',
    ],
  },
  deepseek: {
    officialUrl: 'https://platform.deepseek.com/api_keys',
    keyHint: 'sk-...',
    billingNote: 'Check balance and package limits in DeepSeek console.',
    steps: [
      'Sign in to DeepSeek Platform.',
      'Open API Keys and generate a key.',
      'Copy and save the key in this page.',
    ],
  },
  qwen: {
    officialUrl: 'https://bailian.console.aliyun.com/',
    keyHint: 'sk-...',
    billingNote: 'Qwen API is managed in Alibaba Cloud Bailian / DashScope billing.',
    steps: [
      'Sign in to Alibaba Cloud and open Bailian / DashScope.',
      'Create or view your API key.',
      'Copy the key and paste it here.',
    ],
  },
  moonshot: {
    officialUrl: 'https://platform.moonshot.cn/console/api-keys',
    keyHint: 'sk-...',
    billingNote: 'Moonshot billing depends on account balance and model usage.',
    steps: [
      'Sign in to Moonshot Platform console.',
      'Open API Keys and create one key.',
      'Copy the key and add it in this settings page.',
    ],
  },
  grok: {
    officialUrl: 'https://console.x.ai/',
    keyHint: 'xai-...',
    billingNote: 'xAI API availability and billing vary by account region/plan.',
    steps: [
      'Sign in to xAI console.',
      'Open API credentials and create a key.',
      'Copy and store the key in this page.',
    ],
  },
  cohere: {
    officialUrl: 'https://dashboard.cohere.com/api-keys',
    keyHint: 'co-...',
    billingNote: 'Cohere usage is billed based on selected plan and token usage.',
    steps: [
      'Open Cohere Dashboard and sign in.',
      'Create an API key in the API Keys section.',
      'Copy the key and paste it here.',
    ],
  },
}

export const SERPAPI_GUIDE: GuideContent = {
  officialUrl: 'https://serpapi.com/manage-api-key',
  keyHint: '... (SerpAPI key)',
  billingNote: 'SerpAPI provides a limited free plan and paid tiers for higher volume.',
  steps: [
    'Sign in to SerpAPI dashboard.',
    'Open API Key in account settings.',
    'Copy the key and paste it in this page.',
  ],
}

export const INDEXING_GUIDE = {
  officialUrl: 'https://console.cloud.google.com/',
  steps: [
    'Create or select a Google Cloud project and enable Search Console API / Indexing API.',
    'Create a service account and download the JSON credentials file.',
    'Grant this service account owner/full permission in Google Search Console.',
    'Paste the local JSON path into Google Credentials Path and save.',
  ],
}

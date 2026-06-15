export interface ModelField {
  type: 'select' | 'number' | 'image' | 'image[]'
  values?: (string | number)[]
  min?: number
  required?: boolean
}

export interface ModelDef {
  id: string
  name: string
  supportsImageInput?: boolean
  payload: Record<string, unknown>
  fields: Record<string, ModelField>
  unsupported?: string[]
}

export const IMAGE_MODELS: ModelDef[] = [
  {
    id: 'nano_banana_2',
    name: 'Nano Banana Pro',
    supportsImageInput: true,
    payload: { aspect_ratio: '1:1', resolution: '2k' },
    fields: {
      aspect_ratio: {
        type: 'select',
        values: ['auto', '1:1', '3:2', '2:3', '4:3', '3:4', '4:5', '5:4', '9:16', '16:9', '21:9'],
      },
      resolution: { type: 'select', values: ['1k', '2k', '4k'] },
    },
  },
  {
    id: 'cinematic_studio_2_5',
    name: 'Cinematic Studio 2.5',
    supportsImageInput: true,
    payload: { aspect_ratio: '1:1', resolution: '1k' },
    fields: {
      aspect_ratio: { type: 'select', values: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
      resolution: { type: 'select', values: ['1k', '2k', '4k'] },
    },
  },
  {
    id: 'flux_2',
    name: 'FLUX.2',
    supportsImageInput: true,
    payload: { aspect_ratio: '1:1', resolution: '1k', model: 'pro' },
    fields: {
      aspect_ratio: { type: 'select', values: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
      resolution: { type: 'select', values: ['1k', '2k'] },
      model: { type: 'select', values: ['pro', 'flex', 'max'] },
    },
  },
  {
    id: 'flux_kontext',
    name: 'Flux Kontext',
    supportsImageInput: true,
    payload: { aspect_ratio: '1:1' },
    fields: {
      aspect_ratio: { type: 'select', values: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    },
  },
  {
    id: 'gpt_image_2',
    name: 'GPT Image 2',
    supportsImageInput: true,
    payload: { aspect_ratio: '1:1', resolution: '1k', quality: 'low', batch_size: 1 },
    fields: {
      aspect_ratio: { type: 'select', values: ['1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3'] },
      resolution: { type: 'select', values: ['1k', '2k', '4k'] },
      quality: { type: 'select', values: ['low', 'medium', 'high'] },
      batch_size: { type: 'number', min: 1 },
    },
  },
  {
    id: 'grok_image',
    name: 'Grok Image',
    supportsImageInput: true,
    payload: { aspect_ratio: '1:1', mode: 'std' },
    fields: {
      aspect_ratio: { type: 'select', values: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
      mode: { type: 'select', values: ['std', 'pro'] },
    },
  },
  {
    id: 'image_auto',
    name: 'Image Auto',
    supportsImageInput: true,
    payload: { aspect_ratio: '1:1' },
    fields: {
      aspect_ratio: { type: 'select', values: ['1:1', '4:3', '3:4', '16:9', '9:16'] },
    },
  },
  {
    id: 'kling_omni_image',
    name: 'Kling O1 Image',
    supportsImageInput: true,
    payload: { aspect_ratio: '1:1', resolution: '1k' },
    fields: {
      aspect_ratio: { type: 'select', values: ['1:1', 'auto', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'] },
      resolution: { type: 'select', values: ['1k', '2k'] },
    },
  },
]

export const VIDEO_MODELS: ModelDef[] = [
  {
    id: 'kling3_0',
    name: 'Kling 3.0',
    payload: { aspect_ratio: '16:9', duration: 5, mode: 'std' },
    fields: {
      aspect_ratio: { type: 'select', values: ['16:9', '9:16', '1:1'] },
      duration: { type: 'select', values: [5, 10] },
      mode: { type: 'select', values: ['std', 'pro'] },
    },
    unsupported: ['resolution'],
  },
  {
    id: 'kling2_6',
    name: 'Kling 2.6',
    payload: { aspect_ratio: '16:9', duration: 5, mode: 'std' },
    fields: {
      aspect_ratio: { type: 'select', values: ['16:9', '9:16', '1:1'] },
      duration: { type: 'select', values: [5, 10] },
      mode: { type: 'select', values: ['std', 'pro'] },
    },
  },
  {
    id: 'seedance_2_0',
    name: 'Seedance 2.0',
    payload: { aspect_ratio: '16:9', duration: 5 },
    fields: {
      aspect_ratio: { type: 'select', values: ['16:9', '9:16', '1:1', '4:3', '3:4'] },
      duration: { type: 'select', values: [5, 10, 15] },
    },
  },
  {
    id: 'seedance1_5',
    name: 'Seedance 1.5',
    payload: { aspect_ratio: '16:9', duration: 5 },
    fields: {
      aspect_ratio: { type: 'select', values: ['16:9', '9:16', '1:1'] },
      duration: { type: 'select', values: [5, 10] },
    },
  },
  {
    id: 'veo3_1',
    name: 'Veo 3.1',
    payload: { aspect_ratio: '16:9', duration: 5 },
    fields: {
      aspect_ratio: { type: 'select', values: ['16:9', '9:16', '1:1'] },
      duration: { type: 'select', values: [5, 10] },
    },
  },
  {
    id: 'veo3_1_lite',
    name: 'Veo 3.1 Lite',
    payload: { aspect_ratio: '16:9', duration: 5 },
    fields: {
      aspect_ratio: { type: 'select', values: ['16:9', '9:16', '1:1'] },
      duration: { type: 'select', values: [5, 10] },
    },
  },
  {
    id: 'wan2_7',
    name: 'Wan 2.7',
    payload: { aspect_ratio: '16:9', resolution: '720p', duration: 5 },
    fields: {
      aspect_ratio: { type: 'select', values: ['16:9', '9:16', '1:1'] },
      resolution: { type: 'select', values: ['720p', '1080p'] },
      duration: { type: 'select', values: [5, 10] },
    },
  },
  {
    id: 'wan2_6',
    name: 'Wan 2.6',
    payload: { aspect_ratio: '16:9', quality: '720p', duration: 5 },
    fields: {
      aspect_ratio: { type: 'select', values: ['16:9', '9:16', '1:1'] },
      quality: { type: 'select', values: ['720p', '1080p'] },
      duration: { type: 'select', values: [5, 10] },
    },
  },
  {
    id: 'minimax_hailuo',
    name: 'Hailuo',
    payload: { aspect_ratio: '16:9', duration: 5 },
    fields: {
      aspect_ratio: { type: 'select', values: ['16:9', '9:16', '1:1'] },
      duration: { type: 'select', values: [5, 10] },
    },
  },
]

export function findImageModel(id: string): ModelDef | undefined {
  return IMAGE_MODELS.find((m) => m.id === id)
}

export function findVideoModel(id: string): ModelDef | undefined {
  return VIDEO_MODELS.find((m) => m.id === id)
}

// Fields that should never be shown in UI controls (handled by pipeline)
export const RESERVED_FIELDS = new Set(['prompt', 'image', 'start_image', 'end_image'])

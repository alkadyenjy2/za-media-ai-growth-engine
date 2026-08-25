import { ContentPost, ContentStatus } from '../types';
import {
  fetchContentPostsFromSupabase,
  insertContentPostToSupabase,
  updateContentPostStatusInSupabase,
  deleteContentPostFromSupabase
} from '../lib/supabase';
import { authenticatedFetch } from '../lib/api';

export interface GenerateContentParams {
  niche: string;
  goal: string;
  targetAudience: string;
  tone: string;
  customPrompt?: string;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`AI content response is missing required field: ${field}`);
  }
  return value.trim();
}

function requireHashtags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string')) {
    throw new Error('AI content response is missing required field: hashtags');
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

/**
 * Generate a Facebook marketing post through the authenticated backend AI route.
 * This service intentionally fails closed when the backend or AI provider fails;
 * it must never present template copy as a successful AI result.
 */
export async function generateContentWithAi(params: GenerateContentParams): Promise<Omit<ContentPost, 'id' | 'createdAt'>> {
  const res = await authenticatedFetch('/api/generate-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });

  let payload: { success?: boolean; data?: Record<string, unknown>; error?: string };
  try {
    payload = await res.json();
  } catch {
    throw new Error(`Content generation failed: backend returned non-JSON response (${res.status})`);
  }

  if (!res.ok || !payload.success || !payload.data) {
    throw new Error(payload.error || `Content generation failed (${res.status})`);
  }

  return {
    niche: requireString(payload.data.niche ?? params.niche, 'niche'),
    headline: requireString(payload.data.headline, 'headline'),
    post: requireString(payload.data.post, 'post'),
    cta: requireString(payload.data.cta, 'cta'),
    targetAudience: requireString(payload.data.targetAudience ?? params.targetAudience, 'targetAudience'),
    imagePrompt: requireString(payload.data.imagePrompt, 'imagePrompt'),
    hashtags: requireHashtags(payload.data.hashtags),
    status: 'Draft'
  };
}

export async function getContentPosts(): Promise<ContentPost[] | null> {
  return await fetchContentPostsFromSupabase();
}

export async function createContentPost(post: ContentPost): Promise<boolean> {
  return await insertContentPostToSupabase(post);
}

export async function updateContentPostStatus(id: string, status: ContentStatus): Promise<boolean> {
  return await updateContentPostStatusInSupabase(id, status);
}

export async function deleteContentPost(id: string): Promise<boolean> {
  return await deleteContentPostFromSupabase(id);
}

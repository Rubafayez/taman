import { UserProfile } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getDeviceId } from './itemsService';

const STORAGE_KEY = 'taman:profile';
export const DEFAULT_DISPLAY_NAME = 'طالب/ة في جامعة الملك سعود';

export const profileService = {
  getDeviceId(): string {
    return getDeviceId();
  },

  /**
   * Synchronously retrieves the cached profile from localStorage.
   */
  getLocalProfile(): UserProfile {
    const deviceId = getDeviceId();
    let localProfile: UserProfile = {
      deviceId,
      displayName: DEFAULT_DISPLAY_NAME,
      contactName: '',
      contactPhone: '',
      contactEmail: '',
    };

    try {
      const stored =
        localStorage.getItem(`${STORAGE_KEY}:${deviceId}`) ||
        localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        localProfile = { ...localProfile, ...parsed, deviceId };
      }
    } catch {
      // Ignore localStorage errors
    }

    return localProfile;
  },

  /**
   * Retrieves the current user's profile.
   * Checks Supabase `profiles` table with immediate fallback to localStorage.
   */
  async getProfile(): Promise<UserProfile> {
    const deviceId = getDeviceId();
    let localProfile = this.getLocalProfile();

    if (!isSupabaseConfigured) {
      return localProfile;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (!error && data) {
        const remoteProfile: UserProfile = {
          deviceId,
          displayName: data.display_name || localProfile.displayName || DEFAULT_DISPLAY_NAME,
          contactName: data.contact_name || localProfile.contactName || '',
          contactPhone: data.contact_phone || localProfile.contactPhone || '',
          contactEmail: data.contact_email || localProfile.contactEmail || '',
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        try {
          localStorage.setItem(`${STORAGE_KEY}:${deviceId}`, JSON.stringify(remoteProfile));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteProfile));
        } catch {}
        return remoteProfile;
      }
    } catch (err) {
      console.warn('Supabase profiles query error (using local profile):', err);
    }

    return localProfile;
  },

  /**
   * Updates display name or contact details.
   * Persists immediately to localStorage and upserts to Supabase `profiles`.
   */
  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const deviceId = getDeviceId();
    const current = await this.getProfile();

    const merged: UserProfile = {
      ...current,
      ...updates,
      deviceId,
      updatedAt: new Date().toISOString(),
    };

    // 1. Save locally first for instant response
    try {
      localStorage.setItem(`${STORAGE_KEY}:${deviceId}`, JSON.stringify(merged));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {}

    // 2. Persist to Supabase if configured
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('profiles').upsert(
          {
            device_id: deviceId,
            display_name: merged.displayName,
            contact_name: merged.contactName || null,
            contact_phone: merged.contactPhone || null,
            contact_email: merged.contactEmail || null,
            updated_at: merged.updatedAt,
          },
          { onConflict: 'device_id' }
        );

        if (error) {
          console.warn('Could not upsert to profiles table in Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Error saving profile to Supabase:', err);
      }
    }

    return merged;
  },
};

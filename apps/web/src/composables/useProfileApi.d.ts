import type { Profile, UpsertProfileInput } from '../types/profile.js';
export declare function useProfileApi(): {
    isLoading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    getProfile: () => Promise<Profile | null>;
    saveProfile: (payload: UpsertProfileInput) => Promise<Profile | null>;
};

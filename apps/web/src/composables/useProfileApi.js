import { ref } from 'vue';
const API_URL = import.meta.env.VITE_API_URL ?? '';
export function useProfileApi() {
    const isLoading = ref(false);
    const error = ref(null);
    async function getProfile() {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await fetch(`${API_URL}/api/profile`);
            if (!response.ok) {
                throw new Error('Failed to load profile');
            }
            const json = (await response.json());
            return json.data;
        }
        catch (_err) {
            error.value = 'Unable to load profile.';
            return null;
        }
        finally {
            isLoading.value = false;
        }
    }
    async function saveProfile(payload) {
        isLoading.value = true;
        error.value = null;
        try {
            const response = await fetch(`${API_URL}/api/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                throw new Error('Failed to save profile');
            }
            const json = (await response.json());
            return json.data;
        }
        catch (_err) {
            error.value = 'Unable to save profile.';
            return null;
        }
        finally {
            isLoading.value = false;
        }
    }
    return {
        isLoading,
        error,
        getProfile,
        saveProfile
    };
}

<template>
  <div class="shell">
    <aside class="rail">
      <div class="logo">QJFit</div>
      <button class="rail-btn active" aria-label="Profile">
        <span>◌</span>
      </button>
      <button class="rail-btn" aria-label="Jobs"><span>≡</span></button>
      <button class="rail-btn" aria-label="Settings"><span>⚙</span></button>
    </aside>

    <main class="content">
      <header class="topbar">
        <div>
          <h1>Your profile</h1>
          <p>QJFit uses your profile to score and rank every offer.</p>
        </div>
        <div class="badge">Parsed from CV</div>
      </header>

      <section class="grid">
        <article class="card cv-card">
          <h2>CV upload</h2>
          <div class="dropzone">Drop your CV here, or click to browse</div>
          <pre class="cv-preview">{{ cvPreview }}</pre>
        </article>

        <article class="card">
          <h2>Role & experience</h2>

          <label class="field">
            <span>Target role</span>
            <input v-model="form.targetRole" type="text" />
          </label>

          <div class="field">
            <span>Experience range (years)</span>
            <div class="range-row">
              <input v-model.number="form.seniorityMin" type="number" min="0" />
              <input v-model.number="form.seniorityMax" type="number" min="0" />
            </div>
          </div>

          <div class="field">
            <span>Tech stack</span>
            <div class="chip-wrap">
              <button
                v-for="item in form.techStack"
                :key="`tech-${item}`"
                type="button"
                class="chip blue"
                @click="removeTech(item)"
              >
                {{ item }}
              </button>
              <input
                v-model="techDraft"
                class="chip-input"
                placeholder="+ add skill"
                @keyup.enter="addTech"
              />
            </div>
          </div>
        </article>

        <article class="card">
          <h2>Location & contract</h2>

          <label class="field">
            <span>Location</span>
            <input v-model="form.location" type="text" />
          </label>

          <div class="field">
            <span>Contract types</span>
            <div class="chip-wrap">
              <button
                v-for="contract in contractOptions"
                :key="contract"
                type="button"
                class="chip"
                :class="{ active: form.contractTypes.includes(contract) }"
                @click="toggleContract(contract)"
              >
                {{ contract }}
              </button>
            </div>
          </div>

          <label class="field">
            <span>Min salary (€/year, optional)</span>
            <input v-model.number="salaryDraft" type="number" min="0" />
          </label>
        </article>

        <article class="card">
          <h2>Excluded keywords</h2>
          <div class="chip-wrap">
            <button
              v-for="item in form.excludedKeywords"
              :key="`excluded-${item}`"
              type="button"
              class="chip red"
              @click="removeExcluded(item)"
            >
              {{ item }}
            </button>
            <input
              v-model="excludedDraft"
              class="chip-input"
              placeholder="+ add keyword"
              @keyup.enter="addExcluded"
            />
          </div>
        </article>
      </section>

      <footer class="actions">
        <button class="save-btn" :disabled="isLoading" @click="save">Save profile</button>
        <span v-if="error" class="error">{{ error }}</span>
        <span v-else-if="savedAt" class="saved">Last updated {{ savedAt }}</span>
      </footer>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useProfileApi } from './composables/useProfileApi';
import type { ContractType, Profile, UpsertProfileInput } from './types/profile';

const contractOptions: ContractType[] = ['CDI', 'CDD', 'Freelance', 'Internship', 'Apprenticeship', 'Other'];

const cvPreview = ref('Julien Morel - Senior Backend Engineer · Paris · Python · FastAPI · PostgreSQL · Docker · 6 years exp.');
const techDraft = ref('');
const excludedDraft = ref('');
const salaryDraft = ref<number | null>(null);
const savedAt = ref<string | null>(null);

const form = reactive<UpsertProfileInput>({
  targetRole: 'Senior Backend Engineer',
  targetCompanyIndustry: ['Tech'],
  techStack: ['Python', 'FastAPI', 'PostgreSQL', 'Docker', 'Redis'],
  seniorityMin: 3,
  seniorityMax: 8,
  location: 'Paris',
  excludedKeywords: ['PHP', 'WordPress', 'Java'],
  contractTypes: ['CDI', 'CDD', 'Freelance'],
  salaryMin: 58000,
  bio: null,
  availability: null
});

const { isLoading: profileLoading, error, getProfile, saveProfile } = useProfileApi();

function hydrate(profile: Profile) {
  form.targetRole = profile.targetRole;
  form.targetCompanyIndustry = [...profile.targetCompanyIndustry];
  form.techStack = [...profile.techStack];
  form.seniorityMin = profile.seniorityMin;
  form.seniorityMax = profile.seniorityMax;
  form.location = profile.location;
  form.excludedKeywords = [...profile.excludedKeywords];
  form.contractTypes = [...profile.contractTypes];
  form.salaryMin = profile.salaryMin;
  form.bio = profile.bio;
  form.availability = profile.availability;
  salaryDraft.value = profile.salaryMin;
}

function addTech() {
  const value = techDraft.value.trim();
  if (value.length === 0 || form.techStack.includes(value)) {
    return;
  }
  form.techStack = [...form.techStack, value];
  techDraft.value = '';
}

function removeTech(value: string) {
  form.techStack = form.techStack.filter((item) => item !== value);
}

function addExcluded() {
  const value = excludedDraft.value.trim();
  if (value.length === 0 || form.excludedKeywords.includes(value)) {
    return;
  }
  form.excludedKeywords = [...form.excludedKeywords, value];
  excludedDraft.value = '';
}

function removeExcluded(value: string) {
  form.excludedKeywords = form.excludedKeywords.filter((item) => item !== value);
}

function toggleContract(contract: ContractType) {
  if (form.contractTypes.includes(contract)) {
    form.contractTypes = form.contractTypes.filter((value) => value !== contract);
    return;
  }

  form.contractTypes = [...form.contractTypes, contract];
}

async function save() {
  form.salaryMin = salaryDraft.value;
  const profile = await saveProfile(form);
  if (profile) {
    savedAt.value = new Date(profile.updatedAt).toLocaleString();
    hydrate(profile);
  }
}

onMounted(async () => {
  const profile = await getProfile();
  if (profile) {
    hydrate(profile);
    savedAt.value = new Date(profile.updatedAt).toLocaleString();
  }
});

const isLoading = computed(() => profileLoading.value);
</script>

<style scoped>
:global(body) {
  margin: 0;
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
  background: #f6f6f4;
  color: #101827;
}

:global(*),
:global(*::before),
:global(*::after) {
  box-sizing: border-box;
}

.shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 72px 1fr;
}

.rail {
  background: #f2f2f1;
  border-right: 1px solid #e2e4e8;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding-top: 18px;
}

.logo {
  min-width: 40px;
  padding: 0 8px;
  height: 40px;
  border-radius: 12px;
  background: #0d5cab;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 700;
  font-size: 12px;
}

.rail-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #8b93a3;
}

.rail-btn.active {
  background: #deebfa;
  color: #0d5cab;
}

.content {
  padding: 28px;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 22px;
}

h1 {
  margin: 0;
  font-size: 36px;
  line-height: 1.05;
}

p {
  margin: 8px 0 0;
  color: #8f95a2;
}

.badge {
  background: #e8f4da;
  color: #2f6f1f;
  border-radius: 999px;
  padding: 8px 14px;
  font-size: 14px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.card {
  border: 1px solid #dcdfe4;
  border-radius: 16px;
  background: #fff;
  padding: 18px;
}

.card h2 {
  margin: 0 0 12px;
  font-size: 26px;
}

.cv-card {
  min-height: 280px;
}

.dropzone {
  border: 1px dashed #cdd1d8;
  border-radius: 12px;
  min-height: 80px;
  display: grid;
  place-items: center;
  color: #72798a;
  margin-bottom: 14px;
}

.cv-preview {
  background: #f8fafb;
  border: 1px solid #dde3ea;
  border-radius: 10px;
  padding: 14px;
  line-height: 1.5;
  color: #334155;
  white-space: pre-wrap;
  font-size: 14px;
}

.field {
  display: grid;
  gap: 7px;
  margin-bottom: 14px;
}

.field span {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 12px;
  font-weight: 700;
  color: #9198a5;
}

input {
  width: 100%;
  border: 1px solid #d7dce4;
  border-radius: 10px;
  padding: 11px 12px;
  font-size: 15px;
  background: #fcfdfd;
}

.range-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.range-row input {
  min-width: 0;
}

.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px;
  border: 1px solid #d7dce4;
  border-radius: 10px;
  min-height: 44px;
}

.chip {
  border: 1px solid #cfd5df;
  border-radius: 999px;
  background: #f6f7f9;
  color: #4a5568;
  padding: 6px 12px;
  font-size: 14px;
}

.chip.active,
.chip.blue {
  border-color: #87afe0;
  background: #e8f1ff;
  color: #23599c;
}

.chip.red {
  border-color: #f1c6c6;
  background: #fff0f0;
  color: #b23a3a;
}

.chip-input {
  border: none;
  padding: 6px;
  min-width: 130px;
  flex: 1;
}

.chip-input:focus {
  outline: none;
}

.actions {
  margin-top: 18px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.save-btn {
  border: none;
  border-radius: 10px;
  background: #165fa7;
  color: #fff;
  font-weight: 700;
  padding: 11px 18px;
}

.save-btn:disabled {
  opacity: 0.65;
}

.saved {
  color: #8a93a1;
}

.error {
  color: #b42318;
}

@media (max-width: 1020px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .shell {
    grid-template-columns: 1fr;
  }

  .rail {
    display: none;
  }
}
</style>

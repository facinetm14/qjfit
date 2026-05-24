<template>
  <div class="shell">
    <aside class="rail">
      <div class="logo">QJFit</div>
      <button class="rail-btn" aria-label="Jobs">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 8h12M6 12h12M6 16h12" />
        </svg>
      </button>
      <button class="rail-btn active" aria-label="Profile">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="8.5" r="2.7" />
          <path d="M6.8 17.6c.9-2.8 2.9-4.3 5.2-4.3s4.3 1.5 5.2 4.3" />
        </svg>
      </button>
      <button class="rail-btn" aria-label="Settings">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="1.1" />
          <circle cx="6.5" cy="12" r="1.1" />
          <circle cx="17.5" cy="12" r="1.1" />
        </svg>
      </button>
      <button class="rail-btn" aria-label="History">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="6.6" />
          <path d="M12 8.8v3.6l2.2 1.4" />
        </svg>
      </button>
    </aside>

    <main class="content">
      <header class="topbar">
        <div>
          <h1>Your profile</h1>
          <p>JobRadar uses your profile to score and rank every offer.</p>
        </div>
      </header>

      <section class="grid">
        <article class="card cv-card">
          <h2>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 3.8h7.1L19 8.6v11.6H7z" />
              <path d="M14.1 3.8v4.8H19" />
            </svg>
            <span>CV upload</span>
          </h2>
          <div class="dropzone">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 15V8.5" />
              <path d="M9.6 10.9 12 8.5l2.4 2.4" />
              <path d="M6.3 15.7A3.8 3.8 0 1 1 7 8.2a4.9 4.9 0 0 1 9.6 1.3 3.2 3.2 0 0 1 .3 6.3" />
            </svg>
            <strong>Drop your CV here, or <span>click to browse</span></strong>
            <small>PDF or DOCX · max 5 MB</small>
          </div>
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
  display: grid;
  place-items: center;
  padding: 0;
}

.rail-btn svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rail-btn.active {
  background: #deebfa;
  color: #0d5cab;
}

.content {
  padding: 22px 24px;
}

.topbar {
  margin-bottom: 14px;
}

h1 {
  margin: 0;
  font-size: 38px;
  line-height: 1.06;
  letter-spacing: -0.03em;
}

p {
  margin: 8px 0 0;
  color: #b4bcc7;
  font-size: 13px;
  font-weight: 600;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.card {
  border: 1px solid #dbdee4;
  border-radius: 14px;
  background: #fff;
  padding: 18px;
}

.card h2 {
  margin: 0 0 12px;
  font-size: 26px;
}

.cv-card {
  min-height: 300px;
}

.cv-card h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 30px;
}

.cv-card h2 svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: #8f969f;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dropzone {
  border: 1px dashed #d2d7de;
  border-radius: 12px;
  min-height: 124px;
  display: grid;
  place-items: center;
  color: #72798a;
  margin-bottom: 14px;
  text-align: center;
  padding: 14px;
}

.dropzone svg {
  width: 26px;
  height: 26px;
  fill: none;
  stroke: #c7ccd4;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  margin-bottom: 6px;
}

.dropzone strong {
  font-size: 13px;
  font-weight: 600;
  color: #657083;
}

.dropzone strong span {
  color: #5f6d82;
}

.dropzone small {
  margin-top: 2px;
  font-size: 13px;
  color: #aab3bf;
}

.cv-preview {
  background: #f8f9fb;
  border: 1px solid #dde1e7;
  border-radius: 10px;
  padding: 14px;
  line-height: 1.5;
  color: #5b6778;
  white-space: pre-wrap;
  font-size: 14px;
  margin: 0;
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

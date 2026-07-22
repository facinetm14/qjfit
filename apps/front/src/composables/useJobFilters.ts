import { computed, ref, type Ref } from 'vue';
import { filterAndSortJobs, type SortOrder } from '../utils/job-filters.js';
import type { ContractType, JobSource, MatchedJob, RemotePolicy } from '../types/job.js';

const ALL_SOURCES: JobSource[] = ['France Travail', 'WTTJ'];
const ALL_CONTRACTS: ContractType[] = ['CDI', 'CDD', 'Freelance'];
const ALL_REMOTE: RemotePolicy[] = ['Full', 'Hybrid', 'On-site'];

function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export function useJobFilters(jobs: Ref<readonly MatchedJob[]>) {
  const minScore = ref(0);
  const sources = ref<JobSource[]>([...ALL_SOURCES]);
  const contracts = ref<ContractType[]>([...ALL_CONTRACTS]);
  const remotePolicies = ref<RemotePolicy[]>([...ALL_REMOTE]);
  const sortOrder = ref<SortOrder>('score');

  const filteredJobs = computed(() =>
    filterAndSortJobs(jobs.value, {
      minScore: minScore.value,
      sources: sources.value,
      contracts: contracts.value,
      remotePolicies: remotePolicies.value,
      sortOrder: sortOrder.value
    })
  );

  function toggleSource(value: JobSource) {
    sources.value = toggled(sources.value, value);
  }
  function toggleContract(value: ContractType) {
    contracts.value = toggled(contracts.value, value);
  }
  function toggleRemote(value: RemotePolicy) {
    remotePolicies.value = toggled(remotePolicies.value, value);
  }

  return {
    minScore,
    sources,
    contracts,
    remotePolicies,
    sortOrder,
    filteredJobs,
    toggleSource,
    toggleContract,
    toggleRemote
  };
}

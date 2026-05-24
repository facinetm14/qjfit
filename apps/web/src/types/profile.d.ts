export type ContractType = 'CDI' | 'CDD' | 'Freelance' | 'Internship' | 'Apprenticeship' | 'Other';
export interface Profile {
    id: string;
    targetRole: string;
    targetCompanyIndustry: string[];
    techStack: string[];
    seniorityMin: number;
    seniorityMax: number;
    location: string;
    excludedKeywords: string[];
    contractTypes: ContractType[];
    salaryMin: number | null;
    bio: string | null;
    availability: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface UpsertProfileInput {
    targetRole: string;
    targetCompanyIndustry: string[];
    techStack: string[];
    seniorityMin: number;
    seniorityMax: number;
    location: string;
    excludedKeywords: string[];
    contractTypes: ContractType[];
    salaryMin: number | null;
    bio: string | null;
    availability: string | null;
}

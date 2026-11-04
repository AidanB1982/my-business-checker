import { tools } from '@/content/tools';
export const usagePreferenceKey = 'mbc-usage-consent-v1';
export const usagePreferenceEvent = 'mbc-usage-preference';
export function usagePage(path: string): string | null {
 const sections: Record<string,string> = { '/account':'workspace','/projects':'projects','/bookkeeping':'bookkeeping','/tools':'tools','/guides':'guides','/sole-traders':'sole-traders','/landlords':'landlords' };
 if (sections[path]) return sections[path];
 const tool = tools.find(t => path === `/tools/${t.slug}`);
 return tool?.slug ?? null;
}
export function validUsagePage(page: unknown): page is string {
 return typeof page === 'string' && usagePage(page === 'workspace' ? '/account' : tools.some(t => t.slug === page) ? `/tools/${page}` : `/${page}`) === page;
}
export type OwnerStats = {
 registeredUsers:number;newUsers30:number;advancedMembers:number;activeUsers7:number;activeUsers30:number;
 recordingSince:string|null;topTools:{page:string;users:number}[];dailyActivity:{day:string;users:number}[];
};

export type IconName='grid'|'calculator'|'chart'|'wallet'|'file'|'shield'|'arrow'|'check'|'search'|'user'|'spark'|'car'|'book'|'clock'|'plus'|'logout';
const paths:Record<IconName,string>={
 grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 calculator:'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M8 7h8 M8 11h1 M12 11h1 M16 11h.1 M8 15h1 M12 15h1 M16 15h.1 M8 18h1 M12 18h1 M16 18h.1',
 chart:'M4 4v16h17 M8 15l4-5 4 2 5-8',wallet:'M20 8V5H5a2 2 0 0 0 0 4h15v12H5a2 2 0 0 1-2-2V7 M20 13h-5v4h5',
 file:'M14 3H5v18h14V8z M14 3v6h5 M8 13h8 M8 17h5',shield:'M12 3l8 3v6c0 4-4 7-8 9-4-2-8-5-8-9V6z M8 12l3 3 5-6',arrow:'M4 12h16 M14 6l6 6-6 6',check:'M5 12l4 4L19 6',search:'M20 20l-5-5 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
 user:'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2 M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',spark:'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',car:'M5 17H3v-6l3-6h12l3 6v6h-2 M5 17h14 M7 17v3H4v-3 M20 17v3h-3v-3 M3 11h18 M6 14h2 M16 14h2',book:'M12 5v16 M12 5C9 3 5 3 2 4v15c3-1 7-1 10 2 3-3 7-3 10-2V4c-3-1-7-1-10 1',clock:'M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',plus:'M12 5v14 M5 12h14',logout:'M9 4H4v16h5 M9 12h12 M16 7l5 5-5 5',
};
export function Icon({name,size=20,className=''}:{name:IconName;size?:number;className?:string}){return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;}
export function toolIcon(slug:string):IconName{return slug.includes('pension')?'chart':slug.includes('mileage')?'car':slug.includes('mtd')?'file':slug.includes('vat')?'wallet':'calculator';}

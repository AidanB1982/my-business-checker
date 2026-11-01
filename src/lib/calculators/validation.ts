import { z } from 'zod';
export const pounds = z.number().finite().min(0).max(10_000_000).refine(value=>Math.abs(value*100-Math.round(value*100))<0.00001,'Use no more than two decimal places.');
export const taxYearSchema=z.enum(['2025/26','2026/27']);
export const pence=(amount:number)=>Math.round(amount*100);

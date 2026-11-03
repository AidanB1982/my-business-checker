'use client';
import { useFormStatus } from 'react-dom';
export function AuthSubmit({children}:{children:React.ReactNode}){const {pending}=useFormStatus();return <button className="button" type="submit" disabled={pending}>{pending?'Please wait…':children}</button>;}

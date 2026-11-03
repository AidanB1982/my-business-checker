export const AUTH_RECOVERY_COOKIE='mbc_password_recovery';
export const AUTH_RETURN_COOKIE='mbc_sign_in_return';
export function authReturnPath(value:unknown):'/pricing'|'/account'|'/projects'|'/projects/join'|'/bookkeeping'|`/learn/${string}`{
 if(value==='/pricing')return '/pricing';
 if(value==='/projects'||value==='/projects/join'||value==='/bookkeeping')return value;
 if(typeof value==='string'&&/^\/learn\/[a-z0-9-]{1,100}$/.test(value))return value as `/learn/${string}`;
 return '/account';
}
export function signInUrl(status:string,returnTo:unknown){const query=new URLSearchParams({status,next:authReturnPath(returnTo)});return `/sign-in?${query.toString()}`;}

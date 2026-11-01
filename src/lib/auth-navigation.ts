export const AUTH_RETURN_COOKIE='mbc_sign_in_return';
export function authReturnPath(value:unknown):'/pricing'|'/account'{return value==='/pricing'?'/pricing':'/account';}
export function signInUrl(status:string,returnTo:unknown){const query=new URLSearchParams({status,next:authReturnPath(returnTo)});return `/sign-in?${query.toString()}`;}

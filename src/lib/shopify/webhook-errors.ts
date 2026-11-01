// Only match known database errors. Never expose arbitrary provider messages or row data.
export function webhookDatabaseCode(error:{code?:string;message?:string}){
 if(['PGRST301','PGRST302','PGRST303'].includes(error.code??''))return 'WH_DB_AUTH';
 if(['PGRST202','PGRST204','PGRST205','42P01','42883','42703'].includes(error.code??''))return 'WH_DB_SCHEMA';
 if(error.code==='42501')return 'WH_DB_PERMISSION';
 if(error.code==='P0001'){
  if(error.message==='Missing or expired account link')return 'WH_DB_ACCOUNT_LINK';
  if(['Customer belongs to another account','Customer already linked'].includes(error.message??''))return 'WH_DB_CUSTOMER_CONFLICT';
  if(error.message==='Invalid paid period')return 'WH_DB_PAID_PERIOD';
 }
 return 'WH_DB_WRITE';
}

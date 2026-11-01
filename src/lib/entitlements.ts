export type Subscription = {status:string;current_period_end:string|null};
export function hasAdvanced(subscription:Subscription|null|undefined,now=new Date()) {
 return Boolean(subscription && ["active","trialing"].includes(subscription.status) && subscription.current_period_end && new Date(subscription.current_period_end).getTime()>now.getTime());
}

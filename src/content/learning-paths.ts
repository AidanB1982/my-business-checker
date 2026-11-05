export const learningPaths = [
 {slug:'sole-trader-foundations',audience:'sole-traders',title:'Get confident with sole-trader accounts',summary:'Understand profit, drawings, business costs and the balance sheet before building a month-end routine.',lessons:['profit-cash-and-drawings','reading-your-profit-and-loss','understanding-your-balance-sheet','business-and-private-expenses','sole-trader-bank-review','sole-trader-year-end']},
 {slug:'landlord-foundations',audience:'landlords',title:'Get your rental records organised',summary:'Follow gross rent, separate arrears, understand borrowing and plan future property spending.',lessons:['gross-rent-and-agent-statements','arrears-advance-rent-and-deposits','rental-yield-and-borrowing','property-costs-and-ownership','property-reserves-and-lifecycle','landlord-accountant-handover']},
 {slug:'personal-finance-foundations',audience:'personal',title:'Understand your pay and pension',summary:'Read your take-home estimate, plan around cash and recognise the assumptions in a pension projection.',lessons:['understand-your-payslip','planning-your-personal-cash','understand-pension-scenarios']},
] as const;
export type WorkspaceFocus='sole-traders'|'landlords'|'personal';
export type KnowledgeCheck={question:string;options:string[];correct:number;explanation:string;version:number};
const q=(question:string,options:string[],correct:number,explanation:string):KnowledgeCheck=>({question,options,correct,explanation,version:1});
export const knowledgeChecks:Record<string,KnowledgeCheck>={
 'profit-cash-and-drawings':q('Do owner drawings reduce business profit?',['Yes, they are a running expense','No, they reduce cash and owner equity'],1,'Drawings are an owner movement, not a business running expense.'),
 'reading-your-profit-and-loss':q('In accrual accounts, a valid issued invoice can affect profit before it is paid.',['True','False'],0,'Revenue and cash collection can occur in different periods. The accounting basis matters.'),
 'understanding-your-balance-sheet':q('A loan received into the bank normally creates…',['Income and profit','Cash and a liability'],1,'Borrowing increases cash and the amount owed; it is not ordinary sales income.'),
 'business-and-private-expenses':q('A £60 bill has a supported 70% business share. What is that share?',['£18','£42','£60'],1,'£60 × 70% = £42. Deductibility still depends on the applicable rules.'),
 'sole-trader-bank-review':q('An unrecorded £25 bank fee should be…',['Recorded once with supporting evidence','Ignored if the difference is small'],0,'Correct the omitted transaction, then compare the records with the statement again.'),
 'sole-trader-year-end':q('Is every equipment purchase an ordinary running expense?',['Always','No, review capital and tax treatment separately'],1,'Keep the evidence and distinguish assets, accounting depreciation and tax adjustments.'),
 'gross-rent-and-agent-statements':q('Should you record only the net rent remittance?',['Yes','No, preserve gross rent and agent deductions'],1,'The bank remittance alone hides fees, costs and money retained by the agent.'),
 'arrears-advance-rent-and-deposits':q('Can future advance rent simply cancel old arrears in the control?',['Yes','No, track the periods separately'],1,'Arrears and advances relate to different rental periods; preserve both balances.'),
 'rental-yield-and-borrowing':q('Does mortgage borrowing change the property’s net operating yield?',['Yes, always','No, finance cash flow is a separate measure'],1,'Net operating yield excludes borrowing costs. Cash after mortgage payments is a different measure.'),
 'property-costs-and-ownership':q('A £900 mortgage payment contains £300 principal. Is all £900 a running expense?',['Yes','No, separate principal and interest'],1,'Principal reduces the liability. Interest has its own accounting and tax treatment.'),
 'property-reserves-and-lifecycle':q('Can an affordable long-term average hide an immediate funding gap?',['Yes','No'],0,'A bill due before contributions arrive still needs funding at that date.'),
 'landlord-accountant-handover':q('What should happen to an unexplained £45 agent difference?',['Hide it in expenses','Keep it as an open, evidenced query'],1,'A clear outstanding query is better than an unsupported balancing entry.'),
 'understand-your-payslip':q('Are employer pension contributions normally part of your payslip take-home?',['Yes','No'],1,'They fund the pension; they are separate from the cash paid to you.'),
 'planning-your-personal-cash':q('Should an annual insurance bill be ignored in a monthly budget?',['Yes','No, plan for its timing'],1,'A monthly provision helps you prepare, but the actual bill still needs cash on its due date.'),
 'understand-pension-scenarios':q('Is an illustrated pension growth rate a guaranteed return?',['Yes','No'],1,'Growth, fees, inflation and contributions are assumptions; compare alternative scenarios.'),
};

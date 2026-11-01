"use client";
export default function ErrorPage({reset}:{reset:()=>void}) {return <div className="wrap narrow section"><h1>Something went wrong.</h1><p>Please try again. No calculation has been saved.</p><button className="button" onClick={reset}>Try again</button></div>;}

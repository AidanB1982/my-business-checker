'use client';
import { useEffect,useRef,useState,type ReactNode } from 'react';
import { toolExamples } from '@/content/tool-journeys';
export function ToolExperience({slug,children}:{slug:string;children:ReactNode}) {
 const [version,setVersion]=useState(0),[message,setMessage]=useState('');const container=useRef<HTMLDivElement>(null);const example=toolExamples[slug];
 useEffect(()=>{if(!version||!example)return;const form=container.current?.querySelector('form');if(!form)return;
 for(const [name,value] of Object.entries(example.fields)){const element=form.elements.namedItem(name);if(!(element instanceof HTMLInputElement||element instanceof HTMLSelectElement))continue;const proto=element instanceof HTMLInputElement?HTMLInputElement.prototype:HTMLSelectElement.prototype;Object.getOwnPropertyDescriptor(proto,'value')?.set?.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));}
 },[version,example]);
 return <>{example&&<section className="tool-example"><details><summary>Learn with a worked example</summary><h2>{example.title}</h2><p>{example.explanation}</p><p className="fine">Loading replaces the current entries and clears the result. It never submits the form, accepts eligibility statements or saves your figures.</p><button type="button" className="button secondary" onClick={()=>{setVersion(v=>v+1);setMessage('Example loaded. Review the assumptions and choose Calculate when you are ready. Nothing has been saved.');}}>Load this example</button><p role="status">{message}</p></details></section>}<div key={version} ref={container}>{children}</div></>;
}

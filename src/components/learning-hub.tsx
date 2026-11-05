import Link from 'next/link';
import { learningPaths } from '@/content/learning-paths';
export function LearningHub(){return <div className="guide-grid">{learningPaths.map(path=><Link className="guide-card" key={path.slug} href={`/learn/paths/${path.slug}`}><p className="eyebrow">{path.lessons.length} short lessons</p><h2>{path.title}</h2><p>{path.summary}</p><span className="text-link">Start this learning path →</span></Link>)}</div>;}

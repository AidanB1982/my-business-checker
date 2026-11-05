import { ImageResponse } from 'next/og';
export const alt='My Business Checker — Clear UK tools, practical learning and better everyday decisions';
export const size={width:1200,height:630};
export const contentType='image/png';
export default function Image(){return new ImageResponse(<div style={{display:'flex',flexDirection:'column',justifyContent:'center',width:'100%',height:'100%',background:'#f7faf7',padding:90,color:'#173c35',fontFamily:'sans-serif'}}><div style={{fontSize:30,marginBottom:35}}>my business checker.</div><div style={{display:'flex',flexDirection:'column',fontSize:76,lineHeight:1.08,fontWeight:700}}><span>Clearer numbers.</span><span>More confident decisions.</span></div><div style={{fontSize:28,marginTop:40,color:'#137d60'}}>Free UK calculators · Practical learning · Your next step</div></div>,size);}

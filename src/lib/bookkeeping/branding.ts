export const LOGO_MAX_BYTES=32768;
export function validLogo(data:string){
 if(data==='')return true;if(!/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(data))return false;
 try{const raw=atob(data.slice(22));if(raw.length>LOGO_MAX_BYTES||raw.length<45)return false;const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer);
  return [137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)&&view.getUint32(8)===13&&raw.slice(12,16)==='IHDR'&&view.getUint32(16)>0&&view.getUint32(16)<=256&&view.getUint32(20)>0&&view.getUint32(20)<=256&&raw.slice(-8,-4)==='IEND';
 }catch{return false;}
}
export function brandStyle(color:unknown){const background=typeof color==='string'&&/^#[0-9a-fA-F]{6}$/.test(color)?color:'#24574a';const rgb=[1,3,5].map(i=>parseInt(background.slice(i,i+2),16)/255).map(n=>n<=0.04045?n/12.92:Math.pow((n+0.055)/1.055,2.4));const luminance=rgb[0]*0.2126+rgb[1]*0.7152+rgb[2]*0.0722;return {backgroundColor:background,color:1.05/(luminance+0.05)>=4.5?'#ffffff':'#000000'};}
export async function prepareLogo(file:File){
 if(file.type!=='image/png'||file.size>262144)throw new Error('Choose a PNG logo up to 256 KB.');
 const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.length<24||bytes[0]!==137||bytes[1]!==80)throw new Error('Choose a valid PNG logo.');const v=new DataView(bytes.buffer),w=v.getUint32(16),h=v.getUint32(20);if(!w||!h||w>1024||h>1024)throw new Error('The PNG must be no more than 1024 × 1024 pixels.');
 const image=await createImageBitmap(file);try{const scale=Math.min(1,256/image.width,256/image.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);const output=canvas.toDataURL('image/png');if(!validLogo(output))throw new Error('This logo is too detailed. Use a simpler PNG; the saved logo must fit within 32 KB.');return output;}finally{image.close();}
}

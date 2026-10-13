import sharp from 'sharp';
import {readFile,readdir,writeFile} from 'node:fs/promises';
const icon=await readFile('apps/web/public/favicon.svg');
async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=dir+'/'+item.name;if(item.isDirectory())await walk(path);else if(path.endsWith('.png')){
 const {width,height}=await sharp(path).metadata();
 const image=await sharp(icon).resize(path.includes('splash')?Math.round(Math.min(width,height)*.22):width).png().toBuffer();
 const result=path.includes('splash')?sharp({create:{width,height,channels:4,background:'#ffffff'}}).composite([{input:image,gravity:'centre'}]):sharp(image).flatten({background:'#17274c'});
 await writeFile(path,await result.png().toBuffer());
}}}
await walk('apps/web/android/app/src/main/res');await walk('apps/web/ios/App/App/Assets.xcassets');

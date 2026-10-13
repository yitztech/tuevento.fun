if(!/^\d+\.\d+\.\d+$/.test(process.env.APP_VERSION||''))throw new Error('APP_VERSION must be x.y.z');
if(!/^[1-9]\d*$/.test(process.env.BUILD_NUMBER||''))throw new Error('BUILD_NUMBER must be a positive integer');
const url=new URL(process.env.VITE_PUBLIC_ORIGIN);
if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||url.username||url.password)throw new Error('Set VITE_PUBLIC_ORIGIN to your HTTPS origin');
if(!/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(process.env.MOBILE_APP_ID||''))throw new Error('Set MOBILE_APP_ID');

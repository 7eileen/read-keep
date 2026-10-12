const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
// Local development convenience. Only explicitly public fields are emitted.
const envPath=path.join(root,'.env');
if(fs.existsSync(envPath))for(const line of fs.readFileSync(envPath,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){
  const m=line.match(/^([A-Z_]+)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
}
const url=process.env.SUPABASE_URL||'',publishableKey=process.env.SUPABASE_PUBLISHABLE_KEY||'';
if(Boolean(url)!==Boolean(publishableKey))throw new Error('Set both SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY');
if(url&&!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url))throw new Error('Invalid Supabase project URL');
if(publishableKey&&!publishableKey.startsWith('sb_publishable_'))throw new Error('Only a Supabase publishable key may be shipped to the browser');
if(process.env.NETLIFY==='true'&&!url)throw new Error('Configure Supabase public build variables before publishing');
require('esbuild').buildSync({entryPoints:[path.join(root,'src/supabase-client.js')],bundle:true,format:'iife',platform:'browser',target:'es2020',minify:true,outfile:path.join(root,'dist/vendor/supabase.js'),legalComments:'eof'});
fs.writeFileSync(path.join(root,'dist/config.js'),'window.READ_KEEP_CONFIG = '+JSON.stringify({url,publishableKey})+';\n');
console.log('Built Supabase SDK and public configuration. Cloud '+(url?'enabled':'not configured (guest mode only)')+'.');

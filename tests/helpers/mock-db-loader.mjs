export async function resolve(specifier,context,nextResolve){
  if(specifier==='./database.mjs')return {url:new URL('./mock-database.mjs',import.meta.url).href,shortCircuit:true};
  return nextResolve(specifier,context);
}

// Consulta o identificador de alteração a cada leitura; o conteúdo só é
// reutilizado quando o banco confirma que a linha continua igual.
export function createMainDataReader(query){
  let cached=null,inflight=null;
  async function load(){
    if(!inflight){
      inflight=(async()=>{
        const result=await query("select data, xmin::text as revision from app_documents where key='main-data'");
        const row=result.rows[0];cached=row?{revision:row.revision,data:row.data}:null;
        return cached;
      })().finally(()=>{inflight=null;});
    }
    return inflight;
  }
  return async function read(fallback){
    if(!cached){const result=await load();return result?result.data:fallback;}
    const result=await query("select xmin::text as revision from app_documents where key='main-data'");
    if(!result.rows.length){cached=null;return fallback;}
    if(cached&&result.rows[0].revision===cached.revision)return cached.data;
    const fresh=await load();return fresh?fresh.data:fallback;
  };
}

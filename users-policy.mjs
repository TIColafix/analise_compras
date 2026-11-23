export const MODULES=['materia-prima','insumos','manutencao','diesel','areiaamigos','cimento-granel','cimento-ensacado','fornecedores'];
export const ROOT_USER='diego';
export const isProtectedUser=user=>String(user||'').toLowerCase()===ROOT_USER;
export function userRole(user){return isProtectedUser(user.user)||user.role==='admin'?'admin':user.role==='operator'?'operator':'limited';}
export function validateModules(value){
  if(!Array.isArray(value)||value.some(x=>!MODULES.includes(x)&&x!=='areiaadmin')||value.includes('areiaadmin')&&!value.includes('areiaamigos'))throw Error('Selecione módulos válidos; administrar Areia Amigos exige acesso ao módulo.');
  return [...new Set(value)];
}
export function sanitizeUser(user){const {passwordHash,...safe}=user;return {...safe,role:userRole(user),protected:isProtectedUser(user.user)};}
export function hasModule(account,module){return account?.role==='admin'||account?.role==='operator'||!!account?.permissions?.includes(module);}
export function categoryModule(category){return category==='MP'?'materia-prima':'manutencao';}
export function cementModule(kind){return kind==='granel'?'cimento-granel':kind==='ensacado'?'cimento-ensacado':null;}

// Rotas protegidas por padrão. As coleções compartilhadas de cimento e
// manutenção são filtradas e validadas no servidor por tipo de registro.
export function routeModules(path){
  if(path==='/data.json'||path==='/api/parameters'||path.startsWith('/api/import/'))return ['materia-prima'];
  if(path.startsWith('/api/indirect-materials'))return ['insumos'];
  if(path.startsWith('/api/maintenance-deadlines'))return ['manutencao'];
  if(path.startsWith('/api/maintenance'))return ['manutencao','materia-prima'];
  if(path.startsWith('/api/deadlines'))return ['materia-prima'];
  if(path.startsWith('/api/diesel'))return ['diesel'];
  if(path.startsWith('/api/cement-bag-'))return ['cimento-ensacado'];
  if(path==='/api/cement-monthly-order')return ['cimento-granel'];
  if(path==='/api/cement'||path.startsWith('/api/cement/'))return ['cimento-granel','cimento-ensacado'];
  if(path.startsWith('/api/supplier-'))return ['fornecedores'];
  if(path.startsWith('/api/areia-'))return ['areiaamigos'];
  if(['/api/me','/api/health','/api/external-summary'].includes(path))return [];
  return null;
}
export function routeAllowed(account,path){
  if(account?.role==='admin'||account?.role==='operator')return true;
  const modules=routeModules(path);
  return modules!==null&&(modules.length===0||modules.some(m=>hasModule(account,m)));
}

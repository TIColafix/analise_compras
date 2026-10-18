import sys,json,re
from pypdf import PdfReader

def number(s):
    return float(s.replace('.','').replace(',','.'))
def date(s):
    m=re.search(r'(\d{2})/(\d{2})/(\d{4})',s)
    return f'{m[3]}-{m[2]}-{m[1]}' if m else None

def parse(path,kind):
    reader=PdfReader(path)
    pages=[p.extract_text(extraction_mode='layout') for p in reader.pages]
    full='\n'.join(pages)
    if kind=='profile':
        if 'Perfil de Itens' not in full or 'Tempo Reposição' not in full:raise ValueError('PDF não é Perfil de Itens RPLA0300')
        records=[]
        category=''
        for page in pages:
            for chunk in re.split(r'(?=\bItem:\s*NE\d{4})',page):
                m=re.search(r'Item:\s*(NE\d{4})\s+(.+?)\s+UM:\s*(\w+)',chunk)
                if not m:continue
                def field(pattern):
                    v=re.search(pattern,chunk,re.I)
                    return number(v[1]) if v else None
                records.append(dict(code=m[1],description=m[2].strip(),unit=m[3],lead=field(r'Tempo Reposição:\s*([\d.,]+)'),safety=field(r'Est\. Segurança:\s*([\d.,]+)'),consumption=field(r'Consumo Médio:\s*([\d.,]+)'),initial=field(r'Estoque Inicial:\s*([\d.,]+)'),minLot=field(r'Lote Minímo:\s*([\d.,]+)')))
        if not records:raise ValueError('Nenhum item NE encontrado no perfil')
    else:
        if 'Relatório de Saldo dos Itens' not in full or 'Almoxarifados' not in full:raise ValueError('PDF não é relatório de saldo REST0331')
        records=[]
        for page in pages:
            for line in page.splitlines():
                m=re.match(r'^\s*(NE\d{4})\s+(.+?)\s+(UN|FD|KG|CX|PC|PCT|LT|M|PAR|RL)\s+(.*)$',line)
                if not m:continue
                tail=m[4]
                nums=re.findall(r'-?[\d.]+,\d{4}',tail)
                if not nums:continue
                # Last numeric column is Saldo Atual, never a purchase order quantity
                records.append(dict(code=m[1],description=m[2].strip(),unit=m[3],stock=number(nums[-1])))
        if not records:raise ValueError('Nenhum saldo NE identificado. Verifique o layout REST0331')
    return dict(kind=kind,date=date(full[:1100]),items=records,count=len(records),pages=len(pages))
if __name__=='__main__':
    try:print(json.dumps(parse(sys.argv[1],sys.argv[2]),ensure_ascii=False))
    except Exception as e:print(json.dumps({'error':str(e)},ensure_ascii=False));sys.exit(1)

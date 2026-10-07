"""Extrai um pedido de compra FoccoERP RPDC0250 para o controle de prazos."""
import sys,json,re
from datetime import datetime
from pypdf import PdfReader

def iso_date(s):
    s=s.strip()
    for fmt in ("%d/%m/%Y","%d/%m/%y"):
        try:return datetime.strptime(s,fmt).date().isoformat()
        except ValueError:pass
    return ""

def clean_spaces(s): return re.sub(r"\s+"," ",s or "").strip()

def parse(path):
    pages=[p.extract_text(extraction_mode="layout") or "" for p in PdfReader(path).pages]
    text="\n".join(pages)
    if "Emissão dos Pedidos de Compra" not in text or "Pedido Compra" not in text:
        raise ValueError("O PDF não parece ser um pedido de compra FoccoERP RPDC0250.")
    def one(pattern,default="",flags=0):
        m=re.search(pattern,text,flags)
        return clean_spaces(m.group(1)) if m else default
    order=one(r"Pedido Compra\s*:\s*(\d+)")
    buyer=one(r"Comprador\s*:\s*(.*?)\s+Contato\s*:")
    contact=one(r"Contato\s*:\s*([^\n]+)")
    freight=one(r"Tipo de Frete\s*:\s*([^\n]*?)(?=Tipo de Valor|Valor Frete|\n)")
    supplier=""
    m=re.search(r"Fornecedor\s*:\s*(.*)",text)
    if m:
        line=clean_spaces(m.group(1))
        sm=re.search(r"(\d+)\s+(.+?)(?:\s+[A-Z]{2})?$",line)
        supplier=clean_spaces(sm.group(2) if sm else line)
    header_delivery=iso_date(one(r"PRAZO DE ENTREGA:\s*(\d{2}/\d{2}/\d{4})"))
    payment=one(r"Condição Pgto\.\s*:\s*([^\n]+)")
    items=[]
    lines=pages[0].splitlines() if pages else []
    i=0
    while i<len(lines):
        line=lines[i]
        # Aceita códigos alfanuméricos e também somente numéricos (ex.: código 2 = GESSO).
        m=re.match(r"\s*\d+\s+\d+\s+([A-Z0-9][A-Z0-9._/-]*)\s+(.+?)\s+(KG|UN|SC|MT|PC|CX|FD|L|TON|PCT|RL|BD|PAR)\s+([\d.]+,\d+)\s+",line,re.I)
        if not m:
            i+=1;continue
        code,desc,unit,qty=m.groups();desc=clean_spaces(desc);delivery="";j=i+1
        while j<len(lines) and j<=i+4:
            nxt=lines[j]
            dm=re.search(r"(\d{2}/\d{2}/\d{2,4})",nxt)
            if dm: delivery=iso_date(dm.group(1))
            elif nxt.strip() and not re.match(r"\s*\d+\s+\d+\s+[A-Z0-9][A-Z0-9._/-]*\s+",nxt,re.I) and not any(x in nxt for x in ["Emp.","Obs.:","Preço","Qtde."]):
                continuation=clean_spaces(nxt)
                continuation=re.sub(r"\s+\d+(?:\s+[\d.,]+){1,3}\s*$","",continuation).strip()
                if continuation: desc=clean_spaces(desc+" "+continuation)
            if dm: break
            j+=1
        items.append({"code":code,"product":desc,"quantity":qty,"unit":unit,"deliveryDate":delivery or header_delivery})
        i=max(i+1,j)
    if not order: raise ValueError("Não foi possível identificar o número do pedido.")
    if not supplier: raise ValueError("Não foi possível identificar o fornecedor.")
    if not items: raise ValueError("Não foi possível identificar os itens do pedido.")
    dates=sorted({x["deliveryDate"] for x in items if x["deliveryDate"]})
    return {"purchaseOrder":order,"contact":buyer or contact,"buyer":buyer,"supplier":supplier,"freight":freight,"paymentTerms":payment,
            "deliveryDate":dates[0] if len(dates)==1 else (header_delivery or (dates[0] if dates else "")),
            "headerDeliveryDate":header_delivery,"items":items,
            "warning":("O cabeçalho e os itens possuem datas de entrega diferentes; serão usadas as datas de cada item." if header_delivery and any(x["deliveryDate"] and x["deliveryDate"]!=header_delivery for x in items) else "")}

if __name__=="__main__":
    try: print(json.dumps(parse(sys.argv[1]),ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error":str(e)},ensure_ascii=False));sys.exit(1)

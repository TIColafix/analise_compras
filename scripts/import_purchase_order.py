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
    lines=text.splitlines()
    units="KG|UN|SC|MT|PC|CX|FD|L|TON|PCT|RL|BD|PAR|MI"

    # Layout normal do Focco: Emp / Linha / Codigo / Descricao / UM / Quantidade.
    for i,line in enumerate(lines):
        s=clean_spaces(line)
        patterns=[
            r"^\d+\s+\d+\s+([A-Z0-9][A-Z0-9._/-]*)\s+(.+?)\s+("+units+r")\s+([\d.]+,\d+)(?:\s|$)",
            r"^\d+\s+([A-Z0-9][A-Z0-9._/-]*)\s+(.+?)\s+("+units+r")\s+([\d.]+,\d+)(?:\s|$)"
        ]
        m=None
        for pattern in patterns:
            m=re.search(pattern,s,re.I)
            if m: break
        if not m:
            # Versão FoccoERP 3.184: a quantidade antecede a unidade e pode estar colada.
            extra=[
                r"^\d+\s+\d+\s+([A-Z0-9][A-Z0-9._/-]*)\s+(.+?)\s+([\d.]+,\d+)\s*("+units+r")(?=\s|$)",
                r"^\d+\s+([A-Z0-9][A-Z0-9._/-]*)\s+(.+?)\s+([\d.]+,\d+)\s*("+units+r")(?=\s|$)"
            ]
            for pattern in extra:
                m=re.search(pattern,s,re.I)
                if m: break
            if not m: continue
            code,desc,qty,unit=m.groups()
        else:
            code,desc,unit,qty=m.groups()
        # Alguns códigos longos são quebrados em duas linhas no PDF.
        next_line=clean_spaces(lines[i+1]) if i+1<len(lines) else ""
        if len(code)>8 and re.fullmatch(r"\d{1,3}",next_line):
            code+=next_line
        delivery=""
        for nxt in lines[i+1:i+8]:
            dm=re.search(r"\b(\d{2}/\d{2}/\d{2,4})\b",nxt)
            if dm:
                delivery=iso_date(dm.group(1));break
        items.append({"code":code,"product":clean_spaces(desc),"quantity":float(qty.replace(".","").replace(",",".")),"unit":unit.upper(),"deliveryDate":delivery or header_delivery})

    # Fallback: alguns RPDC0250 saem com a tabela desmontada pelo pypdf.
    # Procura explicitamente blocos como "2 GESSO SC 150,000" no texto extraido.
    if not items:
        flat=clean_spaces(" ".join(lines))
        table_pos=flat.find("Qtde Total")
        tail=flat[table_pos:] if table_pos>=0 else flat
        pattern=r"(?:^|\s)([A-Z0-9][A-Z0-9._/-]*)\s+([A-Z][A-Z0-9 ._/-]{1,80}?)\s+("+units+r")\s+([\d.]+,\d+)(?:\s|$)"
        for m in re.finditer(pattern,tail,re.I):
            code,desc,unit,qty=m.groups()
            if code.upper() in {"TOTAL","EMP","LINHA","PEDIDO","CODIGO"}: continue
            after=tail[m.end():m.end()+250]
            dm=re.search(r"\b(\d{2}/\d{2}/\d{2,4})\b",after)
            delivery=iso_date(dm.group(1)) if dm else header_delivery
            items.append({"code":code,"product":clean_spaces(desc),"quantity":float(qty.replace(".","").replace(",",".")),"unit":unit.upper(),"deliveryDate":delivery})
            break

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

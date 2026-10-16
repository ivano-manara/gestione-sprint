import json, sys, html, re
import unicodedata
COL={'claude':'#d97757','success':'#4eba65','error':'#ff6b80','warning':'#ffc107','suggestion':'#b1b9f9','permission':'#b1b9f9','subtle':'#777','text':'#ddd'}
def W(s): return len(s)
# segment = (text, style dict)
def segs_of(node, st):
    out=[]
    if isinstance(node,str): return [(node,st)]
    if node is None: return []
    t=node.get('type'); p=node.get('props',{}) or {}
    s=dict(st)
    for k in ('color','bold','dimColor','underline','strikethrough','italic'):
        if k in p: s[k]=p[k]
    if t=='Button':
        lab=p.get('label')
        ch=node.get('children') or []
        inner=[]
        if ch:
            for c in ch: inner+=segs_of(c,s)
        elif lab: inner=[(lab,s)]
        pre=[]
        if p.get('plain'):
            if p.get('hotkey'): pre=[(p['hotkey']+': ',{**s,'color':'claude'})]
            ds={**s}; 
            if p.get('dimColor'): ds['dimColor']=True
            return pre+[(x,{**ds,**y}) if False else (x,({**y,'dimColor':True} if p.get('dimColor') and 'color' not in y else y)) for x,y in inner]
        col='claude' if p.get('variant')=='primary' else None
        b={**s}; 
        if col: b['color']=col
        hk=(p['hotkey']+': ') if p.get('hotkey') else ''
        return [('[ '+hk,b)]+inner+[(' ]',b)]
    for c in node.get('children') or []:
        out+=segs_of(c,s)
    return out
def wrap(segs, width, mode):
    # split to lines on \n, then wrap
    lines=[[]]
    for txt,st in segs:
        parts=txt.split('\n')
        for i,pt in enumerate(parts):
            if i>0: lines.append([])
            if pt: lines[-1].append((pt,st))
    out=[]
    for ln in lines:
        total=sum(W(t) for t,_ in ln)
        if total<=width: out.append(ln); continue
        if mode and mode.startswith('truncate'):
            acc=[];n=0
            for t,st in ln:
                if n+W(t)>width-1: acc.append((t[:max(0,width-1-n)]+'…',st)); break
                acc.append((t,st)); n+=W(t)
            out.append(acc); continue
        cur=[];n=0
        for t,st in ln:
            for word in re.split(r'(\s+)',t):
                if not word: continue
                if n+W(word)>width and n>0:
                    out.append(cur); cur=[]; n=0
                    if word.isspace(): continue
                while W(word)>width:
                    cur.append((word[:width],st)); out.append(cur); cur=[]; word=word[width:]
                cur.append((word,st)); n+=W(word)
        out.append(cur)
    return out
def llen(l): return sum(W(t) for t,_ in l)
def pad(l,w): return l+[(' '*(w-llen(l)),{})] if llen(l)<w else l
def sp(n): return [(' '*n,{})] if n>0 else []
def num(v):
    m={'xs':0,'sm':1,'md':1,'lg':2,'xl':3}
    return m.get(v,v) if v is not None else 0
def render(node, width):
    if isinstance(node,str): return wrap([(node,{})],width,None)
    t=node.get('type'); p=node.get('props',{}) or {}
    if t in ('Text','Button'):
        return wrap(segs_of(node,{}),width,p.get('wrap'))
    if t=='Input':
        lab=p.get('label','')
        return [[(lab,{}),('['+(p.get('placeholder') or '')[:width-len(lab)-4]+']',{'dimColor':True})]]+([[('',{})]]*((p.get('rows') or 1)-1))
    if t!='Box': return []
    border=p.get('borderStyle'); bc=p.get('borderColor')
    px=num(p.get('paddingX',p.get('padding',0))); 
    inner=width-(2 if border else 0)-2*px
    kids=[c for c in (node.get('children') or []) if c is not None and c!='' and c is not False]
    lines=[]
    if p.get('flexDirection')=='column':
        gap=num(p.get('rowGap',p.get('gap',0)))
        for i,c in enumerate(kids):
            mt=num((c.get('props') or {}).get('marginTop',0)) if isinstance(c,dict) else 0
            if i>0: lines+=[[]]*gap
            lines+=[[]]*mt
            lines+=render(c,inner)
    else:
        gap=num(p.get('columnGap',p.get('gap',0)))
        blocks=[render(c,inner) for c in kids]
        if p.get('justifyContent')=='space-between' and len(blocks)==2 and all(len(b)==1 for b in blocks):
            a,b=blocks[0][0],blocks[1][0]
            if llen(a)+llen(b)+1<=inner: lines=[a+sp(inner-llen(a)-llen(b))+b]
            else: lines=[a,b]
        else:
            row=[];rowh=[]
            cur=[] # list of blocks
            curw=0
            rows=[]
            for b in blocks:
                bw=max([llen(l) for l in b]+[0])
                if cur and curw+gap+bw>inner and p.get('flexWrap')=='wrap':
                    rows.append(cur); cur=[]; curw=0
                cur.append((b,bw)); curw+= (gap if len(cur)>1 else 0)+bw
            if cur: rows.append(cur)
            for r in rows:
                h=max(len(b) for b,_ in r)
                for i in range(h):
                    ln=[]
                    for j,(b,bw) in enumerate(r):
                        if j>0: ln+=sp(gap)
                        piece=b[i] if i<len(b) else []
                        ln+=pad(piece,bw) if j<len(r)-1 else piece
                    lines.append(ln)
    if px: lines=[sp(px)+pad(l,inner)+sp(px) for l in lines]
    if border:
        ch={'round':'╭╮╰╯─│','double':'╔╗╚╝═║'}.get(border,'┌┐└┘─│')
        bs={'color':bc} if bc else {}
        w=inner+2*px
        lines=[[(ch[0]+ch[4]*w+ch[1],bs)]]+[[(ch[5],bs)]+pad(l,w)+[(ch[5],bs)] for l in lines]+[[(ch[2]+ch[4]*w+ch[3],bs)]]
    return lines
def to_html(lines):
    out=[]
    for l in lines:
        row=''
        for t,st in l:
            css=[]
            c=st.get('color')
            if c: css.append('color:'+COL.get(c,c))
            if st.get('dimColor'): css.append('opacity:.55')
            if st.get('bold'): css.append('font-weight:700')
            if st.get('underline'): css.append('text-decoration:underline')
            if st.get('strikethrough'): css.append('text-decoration:line-through')
            row+=f'<span style="{";".join(css)}">{html.escape(t)}</span>'
        out.append(row)
    return '\n'.join(out)
raw=open(sys.argv[1]).read().strip().split('\n')
parts=[]
for r in raw:
    m=re.match(r'@@(.+?)@@(.*)',r)
    name,js=m.group(1),m.group(2)
    tree=json.loads(js)
    width=120 if name=="banda" else 80 if name=="banda80" else 46 if name=="stretto" else 72
    lines=render(tree,width)
    parts.append((name,lines,width))
    print('=====',name); print('\n'.join(''.join(t for t,_ in l) for l in lines))
doc='<html><body style="background:#1e1e1e;color:#ddd;font:13px/1.3 DejaVu Sans Mono,monospace;padding:12px;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">'
for name,lines,w in parts:
    doc+=f'<div><div style="color:#888">{name}</div><pre style="margin:4px 0;background:#141414;padding:10px;width:{w}ch;border:1px solid #333">{to_html(lines)}</pre></div>'
open(sys.argv[2],'w').write(doc+'</body></html>')

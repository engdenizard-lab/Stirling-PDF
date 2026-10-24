import { useRef, useState } from "react";
import { Modal, Button, Group, Stack, Text } from "@mantine/core";
import type { ImagePixels } from "@editor/tools/pdfTextEditor/util/imagePixels";

type Bounds = { l:number;t:number;r:number;b:number };
type Corner = "tl"|"tr"|"bl"|"br";
const limit=(x:number)=>Math.max(0,Math.min(1,x));

export function ImageCropDialog({pixels,onApply,onClose}:{pixels:ImagePixels;onApply:(p:ImagePixels)=>void;onClose:()=>void}) {
  const [bounds,setBounds]=useState<Bounds>({l:0,t:0,r:1,b:1});
  const active=useRef<Corner|null>(null);
  const source=useRef<HTMLCanvasElement|null>(null);
  const size={w:Math.min(600,pixels.width),h:Math.min(600,pixels.width)*pixels.height/pixels.width};
  const render=(canvas:HTMLCanvasElement|null)=>{
    if(!canvas)return;
    if(!source.current){
      const original=document.createElement("canvas");
      original.width=pixels.width;original.height=pixels.height;
      original.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(pixels.rgba),pixels.width,pixels.height),0,0);
      source.current=original;
    }
    const ctx=canvas.getContext("2d");if(!ctx)return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(source.current,0,0,canvas.width,canvas.height);
    const x=bounds.l*canvas.width,y=bounds.t*canvas.height,w=(bounds.r-bounds.l)*canvas.width,h=(bounds.b-bounds.t)*canvas.height;
    ctx.fillStyle="rgba(0,0,0,.5)";
    ctx.fillRect(0,0,canvas.width,y);ctx.fillRect(0,y+h,canvas.width,canvas.height-y-h);
    ctx.fillRect(0,y,x,h);ctx.fillRect(x+w,y,canvas.width-x-w,h);
    ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);
    for(const [cx,cy] of [[x,y],[x+w,y],[x,y+h],[x+w,y+h]]){
      ctx.fillStyle="#fff";ctx.fillRect(cx-5,cy-5,10,10);
      ctx.strokeStyle="#2563eb";ctx.strokeRect(cx-5,cy-5,10,10);
    }
  };
  const point=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    const rect=e.currentTarget.getBoundingClientRect();
    return {x:limit((e.clientX-rect.left)/rect.width),y:limit((e.clientY-rect.top)/rect.height)};
  };
  const begin=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    const p=point(e);
    const corners:[Corner,number,number][]=[["tl",bounds.l,bounds.t],["tr",bounds.r,bounds.t],["bl",bounds.l,bounds.b],["br",bounds.r,bounds.b]];
    corners.sort((a,b)=>Math.hypot(a[1]-p.x,a[2]-p.y)-Math.hypot(b[1]-p.x,b[2]-p.y));
    if(Math.hypot(corners[0][1]-p.x,corners[0][2]-p.y)>0.12)return;
    active.current=corners[0][0];e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move=(e:React.PointerEvent<HTMLCanvasElement>)=>{
    const c=active.current;if(!c)return;
    const p=point(e);setBounds(b=>({
      l:c.endsWith("l")?Math.min(p.x,b.r-.03):b.l,
      r:c.endsWith("r")?Math.max(p.x,b.l+.03):b.r,
      t:c.startsWith("t")?Math.min(p.y,b.b-.03):b.t,
      b:c.startsWith("b")?Math.max(p.y,b.t+.03):b.b,
    }));
  };
  const apply=()=>{
    const x=Math.floor(bounds.l*pixels.width),y=Math.floor(bounds.t*pixels.height);
    const w=Math.max(1,Math.ceil(bounds.r*pixels.width)-x),h=Math.max(1,Math.ceil(bounds.b*pixels.height)-y);
    const rgba=new Uint8Array(w*h*4);
    for(let row=0;row<h;row++)rgba.set(pixels.rgba.subarray(((y+row)*pixels.width+x)*4,((y+row)*pixels.width+x+w)*4),row*w*4);
    onApply({width:w,height:h,rgba});
  };
  return <Modal opened onClose={onClose} title="Recortar imagem" centered size="lg">
    <Stack gap="sm">
      <Text size="sm">Arraste os quatro cantos para selecionar a área que deseja manter.</Text>
      <canvas width={size.w} height={size.h} ref={render} onPointerDown={begin} onPointerMove={move}
        onPointerUp={()=>{active.current=null;}} onPointerCancel={()=>{active.current=null;}}
        style={{width:"100%",height:"auto",cursor:"crosshair",touchAction:"none"}} aria-label="Seleção de recorte"/>
      <Group justify="end"><Button variant="default" onClick={onClose}>Cancelar</Button><Button onClick={apply}>Aplicar</Button></Group>
    </Stack>
  </Modal>;
}

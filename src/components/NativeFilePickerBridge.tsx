import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import NativeGalleryModal from "./NativeGalleryModal";
export default function NativeFilePickerBridge(){
 const [open,setOpen]=useState(false),[multiple,setMultiple]=useState(false);
 const pending=useRef<HTMLInputElement|null>(null);
 useEffect(()=>{if(Capacitor.getPlatform()!=="android")return;const onClick=(e:MouseEvent)=>{const el=e.target;if(!(el instanceof HTMLInputElement)||el.type!=="file"||!(el.accept||"").toLowerCase().includes("image/"))return;if(el.hasAttribute("capture")||el.dataset.nativePickerBypass==="true")return;e.preventDefault();e.stopImmediatePropagation();if(pending.current)return;pending.current=el;setMultiple(el.multiple);setOpen(true)};document.addEventListener("click",onClick,true);return()=>document.removeEventListener("click",onClick,true)},[]);
 const close=()=>{pending.current=null;setOpen(false)};
 const select=(files:File[])=>{const el=pending.current;if(!el||!document.contains(el)||!files.length){close();return}const dt=new DataTransfer();for(const f of(el.multiple?files:files.slice(0,1)))dt.items.add(f);el.files=dt.files;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));close()};
 return open?<NativeGalleryModal multiple={multiple} onClose={close} onSelect={select}/>:null;
}
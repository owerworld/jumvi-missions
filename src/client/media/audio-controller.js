// One media element per explicit request. Stale promises can only pause their own element.
export class AudioController {
 constructor({createMedia=url=>new Audio(url),onChange=()=>{}}={}){this.createMedia=createMedia;this.onChange=onChange;this.generation=0;this.preference=false;this.playback='idle';this.current=null;}
 snapshot(){return {preference:this.preference,playback:this.playback};}
 emit(){this.onChange(this.snapshot());}
 cancel({off=false}={}) {this.generation++;const old=this.current;this.current=null;if(old){old.pause();old.onended=null;old.onerror=null;}if(off)this.preference=false;this.playback='idle';this.emit();}
 async request(source,context){
 this.cancel();const generation=this.generation;
 if(!source?.url || source.context!==context){this.preference=false;this.playback='unavailable';this.emit();return false;}
 const media=this.createMedia(source.url);this.current=media;this.playback='pending';this.emit();
 const valid=()=>this.generation===generation&&this.current===media;
 media.onended=()=>{if(valid()){this.playback='ended';this.emit();}};
 media.onerror=()=>{if(valid()){this.cancel({off:true});this.playback='unavailable';this.emit();}};
 try{await media.play();if(!valid()){media.pause();return false;}this.preference=true;this.playback=media.ended?'ended':'playing';this.emit();return true;}
 catch {media.pause();if(valid()){this.cancel({off:true});this.playback='unavailable';this.emit();}return false;}
 }
 toggle(source,context){if(this.preference||this.playback==='pending'){this.cancel({off:true});return Promise.resolve(false);}return this.request(source,context);}
 replay(source,context){return this.preference?this.request(source,context):Promise.resolve(false);}
}

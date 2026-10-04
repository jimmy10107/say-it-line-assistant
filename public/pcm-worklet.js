class PCMRecorder extends AudioWorkletProcessor {
 constructor(){super();this.samples=[];this.phase=0;}
 process(inputs){const input=inputs[0]?.[0];if(input){for(const value of input){this.phase+=16000;if(this.phase>=sampleRate){this.phase-=sampleRate;this.samples.push(Math.round(Math.max(-1,Math.min(1,value))*32767));}if(this.samples.length===2048){const bytes=new ArrayBuffer(4096),view=new DataView(bytes);this.samples.forEach((sample,index)=>view.setInt16(index*2,sample,true));this.port.postMessage(bytes,[bytes]);this.samples=[];}}}return true;}
}
registerProcessor('pcm-recorder',PCMRecorder);

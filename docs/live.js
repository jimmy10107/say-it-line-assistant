export class LiveVoice {
 constructor(options){this.options=options;this.connected=false;this.sources=new Set();this.nextAudio=0;this.ended=false;}
 send(message){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(JSON.stringify(message));}
 sendText(text){this.send({realtimeInput:{text}});}
 async start(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('此瀏覽器無法使用麥克風，請改用文字或新版 Chrome／Safari。');
  this.options.onStatus('正在連接語音…',true);
  const auth=await this.options.getToken();
  this.audio=new AudioContext({sampleRate:24000});await this.audio.resume();
  this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},video:false});
  await this.audio.audioWorklet.addModule('./pcm-worklet.js');
  const names=this.options.contacts().filter(c=>c.active).map(c=>({id:c.id,name:c.nickname||c.name}));
  this.socket=new WebSocket('wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained?access_token='+encodeURIComponent(auth.token));
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('語音連線逾時，請重新開啟。')),20000);
   this.socket.onopen=()=>this.send({setup:{model:'models/'+auth.model,generationConfig:{responseModalities:['AUDIO']},systemInstruction:{parts:[{text:'你是說一聲，私人 LINE 提醒助手。使用自然的台灣繁體中文。現在時間 '+new Date().toISOString()+'；時區 Asia/Taipei（UTC+8）。可用聯絡人 '+JSON.stringify(names)+'。啟動先主動問好。建立提醒前口頭確認內容、收件人與時間。對方確認後呼叫 prepare_reminder，畫面將出現最後確認表單，只有使用者按確認後才真正排程。絕不可宣稱已建立、已發送；prepare_reminder 只是草稿。計算提醒時間前先呼叫 current_time 取得即時時間，再計算相對時間。時間需輸出含 +08:00 或 Z 的 ISO 格式。未提收件人時詢問，或選暱稱「我自己」的聯絡人。不要虛構收件人。賀卡功能只透過 prepare_card 填寫描述，使用者會自行決定是否付費生成。'}]},inputAudioTranscription:{},outputAudioTranscription:{},tools:[{functionDeclarations:[{name:'current_time',description:'取得目前時間，計算任何提醒時間前必須呼叫。',behavior:'NON_BLOCKING',parameters:{type:'OBJECT',properties:{}}},{name:'prepare_reminder',description:'口頭確認後準備提醒草稿，畫面仍需使用者確認。',behavior:'NON_BLOCKING',parameters:{type:'OBJECT',properties:{message:{type:'STRING'},contactId:{type:'STRING'},dueAt:{type:'STRING'}},required:['message','contactId','dueAt']}},{name:'prepare_card',description:'準備賀卡描述。需由使用者按生成按鈕才能呼叫圖片服務。',behavior:'NON_BLOCKING',parameters:{type:'OBJECT',properties:{prompt:{type:'STRING'}},required:['prompt']}}]}]}});
   this.socket.onmessage=async event=>{
    try{const text=typeof event.data==='string'?event.data:await event.data.text();const msg=JSON.parse(text);
     if(msg.setupComplete){clearTimeout(timer);this.connected=true;this.options.onStatus('正在聽你說 · 再按一下結束',true);this.startMic();this.sendText('請向我打招呼，問我今天想提醒什麼。');resolve();}
     if(msg.error){clearTimeout(timer);reject(new Error('Gemini 無法連接，請確認模型與 API 額度。'));this.options.onError('Gemini 無法連接，請確認模型與 API 額度。');await this.stop();return;}
     const content=msg.serverContent;if(content?.interrupted)this.clearAudio();
     for(const part of content?.modelTurn?.parts||[])if(part.inlineData?.data)this.play(part.inlineData.data);
     if(content?.inputTranscription?.text)this.options.onTranscript('你：'+content.inputTranscription.text);
     if(content?.outputTranscription?.text)this.options.onTranscript('助手：'+content.outputTranscription.text);
     if(msg.toolCall){const responses=[];for(const fn of msg.toolCall.functionCalls||[]){let result;
      if(fn.name==='current_time')result={now:new Date().toISOString(),timeZone:'Asia/Taipei'};
      else if(fn.name==='prepare_reminder'){const contact=this.options.contacts().find(c=>c.id===fn.args?.contactId&&c.active);if(!contact||!fn.args?.message||!Number.isFinite(Date.parse(fn.args?.dueAt)))result={error:'收件人或時間無效，請詢問使用者。'};else{this.options.onDraft(fn.args);result={status:'draft_only',message:'已顯示確認表單，尚未排程。請使用者檢查並按確認。'};}}
      else if(fn.name==='prepare_card'){this.options.onCard(fn.args?.prompt||'');result={status:'draft_only',message:'描述已填入賀卡頁，尚未生成。'};}
      else result={error:'不支援的操作'};
      responses.push({id:fn.id,name:fn.name,response:result});}
      this.send({toolResponse:{functionResponses:responses}});
     }
     if(msg.goAway){this.options.onError('語音連線即將結束，請再次按麥克風開啟新對話。');await this.stop();}
    }catch{this.options.onError('語音回應處理失敗，請重新開啟對話。');await this.stop();}
   };
   this.socket.onerror=()=>{clearTimeout(timer);reject(new Error('語音服務連線失敗，請檢查網路。'));};
   this.socket.onclose=()=>{clearTimeout(timer);if(!this.connected)reject(new Error('語音連線已關閉，請確認模型設定。'));this.stop();};
  });
  this.expiry=setTimeout(()=>{this.options.onError('本次語音對話已滿 9 分鐘，請重新開啟。');this.stop();},540000);
 }
 startMic(){
  this.source=this.audio.createMediaStreamSource(this.stream);
  this.worklet=new AudioWorkletNode(this.audio,'pcm-recorder');
  this.worklet.port.onmessage=event=>{if(!this.connected)return;const bytes=new Uint8Array(event.data);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);this.send({realtimeInput:{audio:{data:btoa(binary),mimeType:'audio/pcm;rate=16000'}}});};
  this.source.connect(this.worklet);this.worklet.connect(this.audio.destination);
 }
 play(encoded){if(!this.audio||this.ended)return;const binary=atob(encoded),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);const data=new DataView(bytes.buffer),buffer=this.audio.createBuffer(1,Math.floor(bytes.length/2),24000),channel=buffer.getChannelData(0);for(let i=0;i<channel.length;i++)channel[i]=data.getInt16(i*2,true)/32768;const source=this.audio.createBufferSource();source.buffer=buffer;source.connect(this.audio.destination);this.nextAudio=Math.max(this.audio.currentTime,this.nextAudio);source.start(this.nextAudio);this.nextAudio+=buffer.duration;this.sources.add(source);source.onended=()=>this.sources.delete(source);}
 clearAudio(){for(const source of this.sources){try{source.stop();}catch{}}this.sources.clear();this.nextAudio=0;}
 async stop(){if(this.ended)return;this.ended=true;clearTimeout(this.expiry);this.send({realtimeInput:{audioStreamEnd:true}});this.connected=false;this.socket?.close();this.stream?.getTracks().forEach(track=>track.stop());this.source?.disconnect();this.worklet?.disconnect();this.clearAudio();if(this.audio&&this.audio.state!=='closed')await this.audio.close();this.options.onStatus('準備好聽你說',false);}
}

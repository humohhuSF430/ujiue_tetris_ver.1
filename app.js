'use strict';
const COLS=10, ROWS=20;
const COLORS={I:'#22d3ee',J:'#3b82f6',L:'#fb923c',O:'#facc15',S:'#22c55e',T:'#a855f7',Z:'#ef4444',X:'#64748b'};
const SHAPES={
 I:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
 J:[[1,0,0],[1,1,1],[0,0,0]], L:[[0,0,1],[1,1,1],[0,0,0]],
 O:[[1,1],[1,1]], S:[[0,1,1],[1,1,0],[0,0,0]],
 T:[[0,1,0],[1,1,1],[0,0,0]], Z:[[1,1,0],[0,1,1],[0,0,0]]
};
const TYPES=Object.keys(SHAPES);
const $=s=>document.querySelector(s);
const canvas=$('#game'),ctx=canvas.getContext('2d');
const pcanvas=$('#preview'),pctx=pcanvas.getContext('2d');
let board, current=null, timer=null, prepNext=null, exclusionChoice=null;
let state=load()||{
 phase:'setup',tickets:0,area:'未設定',areaId:1,items:[],draws:[],foodsByArea:{},
 settings:{startRows:10,aceCount:1,jokerCount:1},bottomCleared:false
};
function emptyBoard(){return Array.from({length:ROWS},()=>Array(COLS).fill(null));}
function save(){localStorage.setItem('blockFeastState',JSON.stringify({...state,board}));}
function load(){try{const s=JSON.parse(localStorage.getItem('blockFeastState')); if(s?.board) board=s.board; return s}catch{return null}}
if(!board)board=emptyBoard();
function resetBoard(){board=emptyBoard();current=null;stopTimer();}
function randomType(){return TYPES[Math.floor(Math.random()*TYPES.length)]}
function cloneShape(s){return s.map(r=>[...r])}
function makePiece(type){return {type,shape:cloneShape(SHAPES[type]),x:Math.floor((COLS-SHAPES[type][0].length)/2),y:0}}
function collide(piece,dx=0,dy=0,shape=piece.shape){for(let y=0;y<shape.length;y++)for(let x=0;x<shape[y].length;x++)if(shape[y][x]){const nx=piece.x+x+dx,ny=piece.y+y+dy;if(nx<0||nx>=COLS||ny>=ROWS||(ny>=0&&board[ny][nx]))return true}return false}
function merge(){current.shape.forEach((r,y)=>r.forEach((v,x)=>{if(v&&current.y+y>=0)board[current.y+y][current.x+x]=current.type}));current=null;const cleared=clearLines();save();draw();return cleared}
function clearLines(){let cleared=0,bottomWasFull=board[ROWS-1].every(Boolean);for(let y=ROWS-1;y>=0;y--){if(board[y].every(Boolean)){board.splice(y,1);board.unshift(Array(COLS).fill(null));cleared++;y++}}if(state.phase==='quest'&&bottomWasFull&&cleared){state.bottomCleared=true;state.phase='won';stopTimer();toast('成功！最下段を消しました 🎉')}return cleared}
function rotate(shape){return shape[0].map((_,i)=>shape.map(r=>r[i]).reverse())}
function move(action){if(!current)return;if(action==='left'&&!collide(current,-1,0))current.x--;if(action==='right'&&!collide(current,1,0))current.x++;if(action==='down'){if(!collide(current,0,1))current.y++;else lockCurrent()}if(action==='rotate'){const r=rotate(current.shape);if(!collide(current,0,0,r))current.shape=r;else if(!collide(current,-1,0,r)){current.x--;current.shape=r}else if(!collide(current,1,0,r)){current.x++;current.shape=r}}if(action==='drop'){while(!collide(current,0,1))current.y++;lockCurrent()}draw()}
function lockCurrent(){merge();if(state.phase==='prep')spawnPrep();else if(state.phase==='quest')stopTimer();updateUI()}
function spawnPrep(){current=makePiece(prepNext||randomType());prepNext=randomType();if(collide(current)){current=null;stopTimer();state.phase='prepOver';toast('ゲームオーバー。この盤面を初期配置にできます');save();updateUI();draw();return}startTimer();drawPreview(prepNext);draw()}
function startTimer(){stopTimer();timer=setInterval(()=>{if(current)move('down')},650)}function stopTimer(){if(timer)clearInterval(timer);timer=null}
function addGarbage(rows){for(let y=ROWS-rows;y<ROWS;y++){let hole=Math.floor(Math.random()*COLS);for(let x=0;x<COLS;x++)board[y][x]=x===hole?null:'X'}}
function startPrep(){resetBoard();addGarbage(Number(state.settings.startRows));state.phase='prep';state.bottomCleared=false;prepNext=randomType();spawnPrep();save();updateUI()}
function startQuest(){state.phase='quest';current=null;stopTimer();state.bottomCleared=false;save();updateUI();drawPreview(null);draw();toast('本編開始。飲食して抽選券を集めよう')}
function deck(excluded=null){let d=TYPES.filter(t=>t!==excluded);for(let i=0;i<state.settings.aceCount;i++)d.push('ACE');for(let i=0;i<state.settings.jokerCount;i++)d.push('JOKER');return d}
function performDraw(excluded=null,cost=1){if(state.phase!=='quest')return toast('先に本編を開始してください');if(current)return toast('今のブロックを置いてください');if(state.tickets<cost)return toast(`抽選券が${cost}枚必要です`);state.tickets-=cost;const d=deck(excluded);const result=d[Math.floor(Math.random()*d.length)];state.draws.unshift({time:Date.now(),result,excluded,cost});if(result==='JOKER'){toast('ジョーカー…何も獲得できません');current=null;drawPreview(null)}else if(result==='ACE'){toast('エース！好きなブロックを選べます');showPieceChoice('エース：獲得するブロックを選択',type=>spawnQuest(type));}else{spawnQuest(result);toast(`${result}ブロックを獲得`)}save();updateUI()}
function spawnQuest(type){current=makePiece(type);if(collide(current)){current=null;toast('置ける空間がありません');return}drawPreview(type);draw();updateUI()}
function showPieceChoice(title,onChoose,excludeMode=false){$('#choiceTitle').textContent=title;const box=$('#pieceChoices');box.innerHTML='';TYPES.forEach(t=>{const b=document.createElement('button');b.type='button';b.className='piece-choice';b.innerHTML=`${t}<small>ブロック</small>`;b.onclick=()=>{if(excludeMode){exclusionChoice=t;[...box.children].forEach(x=>x.classList.remove('excluded'));b.classList.add('excluded');setTimeout(()=>{$('#choiceDialog').close();onChoose(t)},180)}else{$('#choiceDialog').close();onChoose(t)}};box.appendChild(b)});$('#choiceDialog').showModal()}
function addItem(){const type=$('#itemType').value,name=$('#itemName').value.trim();$('#foodWarning').textContent='';if(!name)return $('#foodWarning').textContent='品名を入力してください';if(state.area==='未設定')return $('#foodWarning').textContent='先に飲食エリアを設定してください';const key=String(state.areaId);state.foodsByArea[key]??=[];if(type==='food'&&state.foodsByArea[key].map(x=>x.toLowerCase()).includes(name.toLowerCase()))return $('#foodWarning').textContent='このエリアでは同じ食べ物を再登録できません';if(type==='food')state.foodsByArea[key].push(name);state.items.unshift({type,name,area:state.area,time:Date.now()});state.tickets++;$('#itemName').value='';toast('抽選券を1枚獲得');save();updateUI()}
function changeArea(){ $('#newAreaName').value=state.area==='未設定'?'':state.area; $('#areaDialog').showModal() }
function setArea(){const n=$('#newAreaName').value.trim();if(!n)return;state.area=n;state.areaId++;state.foodsByArea[String(state.areaId)]=[];save();updateUI();toast('エリア変更：食べ物の重複制限をリセット')}
function resetAll(){if(!confirm('盤面・抽選券・飲食記録をすべて削除しますか？'))return;localStorage.removeItem('blockFeastState');location.reload()}
function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);const cw=canvas.width/COLS,ch=canvas.height/ROWS;ctx.fillStyle='#080c17';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#18223a';ctx.lineWidth=1;for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ctx.strokeRect(x*cw,y*ch,cw,ch);if(board[y][x])cell(ctx,x*cw,y*ch,cw,ch,COLORS[board[y][x]])}if(current)current.shape.forEach((r,y)=>r.forEach((v,x)=>v&&cell(ctx,(current.x+x)*cw,(current.y+y)*ch,cw,ch,COLORS[current.type])));if(state.phase==='quest'){ctx.strokeStyle='#f8fafc';ctx.lineWidth=3;ctx.strokeRect(1,canvas.height-ch+1,canvas.width-2,ch-2)}}
function cell(c,x,y,w,h,color){c.fillStyle=color;c.fillRect(x+2,y+2,w-4,h-4);c.fillStyle='#ffffff35';c.fillRect(x+4,y+4,w-8,4)}
function drawPreview(type){pctx.clearRect(0,0,pcanvas.width,pcanvas.height);$('#pieceName').textContent=type||'-';if(!type||!SHAPES[type])return;const s=SHAPES[type],size=24,ox=(120-s[0].length*size)/2,oy=(120-s.length*size)/2;s.forEach((r,y)=>r.forEach((v,x)=>v&&cell(pctx,ox+x*size,oy+y*size,size,size,COLORS[type])))}
function updateUI(){const labels={setup:'初期設定',prep:'初期盤面づくり中',prepOver:'初期盤面完成',quest:'飲食テトリス本編',won:'クリア！'};$('#phaseLabel').textContent=labels[state.phase]||state.phase;$('#tickets').textContent=state.tickets;$('#areaName').textContent=state.area;$('#goalText').textContent=state.phase==='won'?'達成！':state.phase==='quest'?'最下段を消す':'盤面作成';$('#startPrep').classList.toggle('hidden',state.phase==='prep');$('#startPrep').textContent=['prepOver','quest','won'].includes(state.phase)?'初期盤面を作り直す':'初期盤面づくり開始';$('#startQuest').classList.toggle('hidden',state.phase!=='prepOver');['drawPiece','drawExclude'].forEach(id=>$('#'+id).classList.toggle('hidden',state.phase!=='quest'));$('#drawPiece').disabled=state.tickets<1||!!current;$('#drawExclude').disabled=state.tickets<3||!!current;$('#itemLog').innerHTML=state.items.slice(0,20).map(i=>`<li><span>${i.type==='drink'?'🥤':'🍽️'} ${escapeHtml(i.name)}</span><small>${escapeHtml(i.area)}</small></li>`).join('')||'<li><small>まだ記録がありません</small></li>';$('#drawLog').innerHTML=state.draws.slice(0,20).map(d=>`<li><span>${d.result==='ACE'?'🅰️ ACE':d.result==='JOKER'?'🃏 JOKER':'🧱 '+d.result}</span><small>${d.excluded?`${d.excluded}除外・`:''}${d.cost}枚</small></li>`).join('')||'<li><small>まだ抽選していません</small></li>';$('#startRows').value=state.settings.startRows;$('#aceCount').value=state.settings.aceCount;$('#jokerCount').value=state.settings.jokerCount;draw()}
function escapeHtml(s){return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
let toastTimer;function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2200)}
$('#startPrep').onclick=startPrep;$('#startQuest').onclick=startQuest;$('#drawPiece').onclick=()=>performDraw(null,1);$('#drawExclude').onclick=()=>showPieceChoice('抽選から除外する1種を選択',t=>performDraw(t,3),true);$('#addItem').onclick=addItem;$('#itemName').addEventListener('keydown',e=>{if(e.key==='Enter')addItem()});$('#changeArea').onclick=changeArea;$('#saveArea').onclick=setArea;$('#openSettings').onclick=()=>$('#settingsDialog').showModal();$('#saveSettings').onclick=()=>{state.settings.startRows=Number($('#startRows').value);state.settings.aceCount=Math.max(0,Number($('#aceCount').value)||0);state.settings.jokerCount=Math.max(0,Number($('#jokerCount').value)||0);save();toast('設定を保存しました')};$('#resetAll').onclick=resetAll;document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>move(b.dataset.action));
let sx=0,sy=0;canvas.addEventListener('touchstart',e=>{sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});canvas.addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;if(Math.abs(dx)<20&&Math.abs(dy)<20)move('rotate');else if(Math.abs(dx)>Math.abs(dy))move(dx>0?'right':'left');else move(dy>0?'down':'rotate')},{passive:true});
updateUI();drawPreview(prepNext);

// QR algorithm structure adapted from Kazuhiko Arase qrcode-generator (MIT).
// Upstream notice retained in QR-LICENSE.txt. Local canvas API reused from Language Miner.
// Compact offline QR encoder for Gym Stone share links.
// Byte mode, error correction level L, QR versions 1-10 (up to 271 URL bytes).
(()=>{
  'use strict';

  const BLOCKS=[null,
    [[1,26,19]],[[1,44,34]],[[1,70,55]],[[1,100,80]],[[1,134,108]],
    [[2,86,68]],[[2,98,78]],[[2,121,97]],[[2,146,116]],[[2,86,68],[2,87,69]]
  ];
  const ALIGN=[null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
  const EXP=new Uint8Array(512),LOG=new Uint8Array(256);
  for(let value=1,index=0;index<255;index+=1){EXP[index]=value;LOG[value]=index;value<<=1;if(value&0x100)value^=0x11d;}
  for(let index=255;index<512;index+=1)EXP[index]=EXP[index-255];

  const multiply=(left,right)=>left&&right?EXP[LOG[left]+LOG[right]]:0;
  const utf8=value=>typeof TextEncoder==='function'?[...new TextEncoder().encode(String(value))]:[...unescape(encodeURIComponent(String(value)))].map(char=>char.charCodeAt(0));
  const appendBits=(bits,value,length)=>{for(let bit=length-1;bit>=0;bit-=1)bits.push(((value>>>bit)&1)===1);};
  const blockDataCount=version=>BLOCKS[version].reduce((sum,[count,,data])=>sum+count*data,0);
  const expandedBlocks=version=>BLOCKS[version].flatMap(([count,total,data])=>Array.from({length:count},()=>({total,data})));

  function selectVersion(byteLength){
    for(let version=1;version<=10;version+=1){const lengthBits=version<10?8:16;if(4+lengthBits+byteLength*8<=blockDataCount(version)*8)return version;}
    throw new Error('Share link is too long for the bundled QR encoder.');
  }
  function generator(degree){
    let result=[1];
    for(let power=0;power<degree;power+=1){const next=new Array(result.length+1).fill(0);for(let index=0;index<result.length;index+=1){next[index]^=result[index];next[index+1]^=multiply(result[index],EXP[power]);}result=next;}
    return result;
  }
  function errorCorrection(data,count){
    const divisor=generator(count),result=data.concat(new Array(count).fill(0));
    for(let offset=0;offset<data.length;offset+=1){const factor=result[offset];if(!factor)continue;for(let index=0;index<divisor.length;index+=1)result[offset+index]^=multiply(divisor[index],factor);}
    return result.slice(data.length);
  }
  function makeCodewords(value,version){
    const bytes=utf8(value),bits=[];appendBits(bits,4,4);appendBits(bits,bytes.length,version<10?8:16);bytes.forEach(byte=>appendBits(bits,byte,8));
    const capacity=blockDataCount(version)*8;for(let count=0;count<4&&bits.length<capacity;count+=1)bits.push(false);while(bits.length%8)bits.push(false);
    const data=[];for(let offset=0;offset<bits.length;offset+=8){let byte=0;for(let bit=0;bit<8;bit+=1)if(bits[offset+bit])byte|=1<<(7-bit);data.push(byte);}
    for(let pad=0;data.length<capacity/8;pad+=1)data.push(pad%2?0x11:0xec);
    const blocks=expandedBlocks(version),dataBlocks=[],errorBlocks=[];let offset=0;
    blocks.forEach(block=>{const chunk=data.slice(offset,offset+block.data);offset+=block.data;dataBlocks.push(chunk);errorBlocks.push(errorCorrection(chunk,block.total-block.data));});
    const output=[],maxData=Math.max(...dataBlocks.map(block=>block.length)),maxError=Math.max(...errorBlocks.map(block=>block.length));
    for(let index=0;index<maxData;index+=1)dataBlocks.forEach(block=>{if(index<block.length)output.push(block[index]);});
    for(let index=0;index<maxError;index+=1)errorBlocks.forEach(block=>{if(index<block.length)output.push(block[index]);});
    return output;
  }
  function bchRemainder(value,polynomial){
    const degree=number=>{let result=0;while(number){result+=1;number>>>=1;}return result;},target=degree(polynomial);let current=value;
    while(degree(current)>=target)current^=polynomial<<(degree(current)-target);
    return current;
  }
  const formatBits=mask=>{const data=(1<<3)|mask;return ((data<<10)|bchRemainder(data<<10,0x537))^0x5412;};
  const versionBits=version=>(version<<12)|bchRemainder(version<<12,0x1f25);
  const maskAt=(pattern,row,column)=>[
    (row+column)%2===0,row%2===0,column%3===0,(row+column)%3===0,
    (Math.floor(row/2)+Math.floor(column/3))%2===0,row*column%2+row*column%3===0,
    (row*column%2+row*column%3)%2===0,((row*column)%3+(row+column)%2)%2===0
  ][pattern];

  function probe(matrix,row,column){
    const size=matrix.length;
    for(let y=-1;y<=7;y+=1)for(let x=-1;x<=7;x+=1){if(row+y<0||column+x<0||row+y>=size||column+x>=size)continue;matrix[row+y][column+x]=(y>=0&&y<=6&&(x===0||x===6)||x>=0&&x<=6&&(y===0||y===6)||y>=2&&y<=4&&x>=2&&x<=4);}
  }
  function reservePatterns(matrix,version,test,mask){
    const size=matrix.length;probe(matrix,0,0);probe(matrix,size-7,0);probe(matrix,0,size-7);
    for(const row of ALIGN[version])for(const column of ALIGN[version]){if(matrix[row][column]!==null)continue;for(let y=-2;y<=2;y+=1)for(let x=-2;x<=2;x+=1)matrix[row+y][column+x]=Math.max(Math.abs(y),Math.abs(x))!==1;}
    for(let index=8;index<size-8;index+=1){if(matrix[index][6]===null)matrix[index][6]=index%2===0;if(matrix[6][index]===null)matrix[6][index]=index%2===0;}
    const format=formatBits(mask);for(let index=0;index<15;index+=1){const dark=!test&&((format>>>index)&1)===1;if(index<6)matrix[index][8]=dark;else if(index<8)matrix[index+1][8]=dark;else matrix[size-15+index][8]=dark;if(index<8)matrix[8][size-index-1]=dark;else if(index===8)matrix[8][7]=dark;else matrix[8][15-index-1]=dark;}matrix[size-8][8]=!test;
    if(version>=7){const encoded=versionBits(version);for(let index=0;index<18;index+=1){const dark=!test&&((encoded>>>index)&1)===1;matrix[Math.floor(index/3)][index%3+size-11]=dark;matrix[index%3+size-11][Math.floor(index/3)]=dark;}}
  }
  function mapCodewords(matrix,codewords,mask){
    const size=matrix.length;let row=size-1,direction=-1,byteIndex=0,bitIndex=7;
    for(let column=size-1;column>0;column-=2){if(column===6)column-=1;while(true){for(let offset=0;offset<2;offset+=1){const targetColumn=column-offset;if(matrix[row][targetColumn]!==null)continue;let dark=byteIndex<codewords.length&&((codewords[byteIndex]>>>bitIndex)&1)===1;if(maskAt(mask,row,targetColumn))dark=!dark;matrix[row][targetColumn]=dark;bitIndex-=1;if(bitIndex<0){byteIndex+=1;bitIndex=7;}}row+=direction;if(row<0||row>=size){row-=direction;direction=-direction;break;}}}
  }
  function score(matrix){
    const size=matrix.length;let total=0;
    for(let row=0;row<size;row+=1){let run=1;for(let column=1;column<size;column+=1){if(matrix[row][column]===matrix[row][column-1])run+=1;else{if(run>=5)total+=run-2;run=1;}}if(run>=5)total+=run-2;}
    for(let column=0;column<size;column+=1){let run=1;for(let row=1;row<size;row+=1){if(matrix[row][column]===matrix[row-1][column])run+=1;else{if(run>=5)total+=run-2;run=1;}}if(run>=5)total+=run-2;}
    for(let row=0;row<size-1;row+=1)for(let column=0;column<size-1;column+=1){const value=matrix[row][column];if(value===matrix[row+1][column]&&value===matrix[row][column+1]&&value===matrix[row+1][column+1])total+=3;}
    const finder=[true,false,true,true,true,false,true];
    const linePenalty=line=>{let amount=0;for(let start=0;start<=line.length-7;start+=1){if(finder.every((value,index)=>line[start+index]===value)){const before=line.slice(Math.max(0,start-4),start),after=line.slice(start+7,start+11);if(before.length===4&&before.every(value=>!value)||after.length===4&&after.every(value=>!value))amount+=40;}}return amount;};
    for(let index=0;index<size;index+=1){total+=linePenalty(matrix[index]);total+=linePenalty(matrix.map(row=>row[index]));}
    const dark=matrix.reduce((sum,row)=>sum+row.filter(Boolean).length,0),percent=dark*100/(size*size);total+=Math.floor(Math.abs(percent-50)/5)*10;return total;
  }
  function build(value){
    const version=selectVersion(utf8(value).length),size=version*4+17,codewords=makeCodewords(value,version);let best=null,bestScore=Infinity,bestMask=0;
    for(let mask=0;mask<8;mask+=1){const matrix=Array.from({length:size},()=>new Array(size).fill(null));reservePatterns(matrix,version,true,mask);mapCodewords(matrix,codewords,mask);const current=score(matrix);if(current<bestScore){bestScore=current;bestMask=mask;best=matrix;}}
    const matrix=Array.from({length:size},()=>new Array(size).fill(null));reservePatterns(matrix,version,false,bestMask);mapCodewords(matrix,codewords,bestMask);return matrix;
  }
  function draw(canvas,value,{size=288,quiet=4,dark='#08101f',light='#ffffff'}={}){
    const matrix=build(value),modules=matrix.length+quiet*2,scale=Math.max(1,Math.floor(size/modules)),pixels=modules*scale;canvas.width=pixels;canvas.height=pixels;canvas.style.width=`${size}px`;canvas.style.height=`${size}px`;const context=canvas.getContext('2d');context.imageSmoothingEnabled=false;context.fillStyle=light;context.fillRect(0,0,pixels,pixels);context.fillStyle=dark;matrix.forEach((row,y)=>row.forEach((cell,x)=>{if(cell)context.fillRect((x+quiet)*scale,(y+quiet)*scale,scale,scale);}));return {matrix,pixels,version:(matrix.length-17)/4};
  }

  window.GymStoneQR=Object.freeze({build,draw});
})();

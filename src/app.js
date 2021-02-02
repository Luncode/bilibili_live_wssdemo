const WebSocket = require('ws');
const pako=require('pako');

let ws = new WebSocket('wss://broadcastlv.chat.bilibili.com/sub');

ws.on('open', function () {
    console.log(`[CLIENT] open()`);
    ws.send(encode(JSON.stringify({
        roomid: 393778 //修改直播间id
      }), 7));
});

ws.onmessage = async (msgEvent) => {
  const packet = await decode(msgEvent.data);
  switch (packet.op) {
    case 8:
      console.log('加入房间');
      break;
    case 3:
      console.log("人气："+packet.body.count);
      break;
    case 5:
      packet.body.forEach((body, i) => {
        body.id = Date.now().toString() + `_${i}_` + Math.round(Math.random() * 8000 + 1000);
         //console.log(body);
        switch (body.cmd) {
          case 'DANMU_MSG':
             console.log(`${body.info[3][1]}|${body.info[3][0]}]${body.info[2][1]}: ${body.info[1]}`);
            break;
          case 'SEND_GIFT':
             console.log(`${body.data.uname} ${body.data.action} ${body.data.num} 个 ${body.data.giftName}`);
            break;
          case 'WELCOME':
                 console.log(`欢迎 ${body.data.uname}`);
                 break;
          default:
            console.log('body ->', body);
        }
      });
      break;
    default:
      console.log(packet);
  }
}

ws.on('close',function(){
    console.log(`[CLIENT] close()`);
})

ws.on('error',function(err){
    console.log(`[CLIENT] error()`);
})

const textEncoder = new TextEncoder('utf-8');
const textDecoder = new TextDecoder('utf-8');

const readInt = function (buffer, start, len) {
    let result = 0;
    for (let i = len - 1; i >= 0; i--) {
        result += Math.pow(256, len - i - 1) * buffer[start + i];
    }
    return result;
};

const writeInt = function (buffer, start, len, value) {
    let i = 0;
    while (i < len) {
        buffer[start + i] = value / Math.pow(256, len - i - 1);
        i++;
    }
};

const encode = function (str, op) {
  let data = textEncoder.encode(str);
  let packetLen = 16 + data.byteLength;
  let header = [0, 0, 0, 0, 0, 16, 0, 1, 0, 0, 0, op, 0, 0, 0, 1];
  writeInt(header, 0, 4, packetLen);
  return (new Uint8Array(header.concat(...data))).buffer;
};

const decode = function (blob) {
  return new Promise(function (resolve) {
          let buffer = new Uint8Array(blob);
          let result = {};
          result.packetLen = readInt(buffer, 0, 4);
          result.headerLen = readInt(buffer, 4, 2);
          result.ver = readInt(buffer, 6, 2);
          result.op = readInt(buffer, 8, 4);
          result.seq = readInt(buffer, 12, 4);
          if (result.op === 5) {
              result.body = [];
              let offset = 0;
              while (offset < buffer.length) {
                  let packetLen = readInt(buffer, offset, 4);
                  let headerLen = 16; //readInt(buffer,offset + 4,4)
                  let data = buffer.slice(offset + headerLen, offset + packetLen);
                   //console.log(data);
                  let body;
                  try {
                      body = textDecoder.decode(pako.inflate(data));
                  } catch (e) {
                       //console.log(e);
                  }
                  if (body) {
                      const group = body.split(/[\x00-\x1f]+/);
                      group.forEach(item => {
                          try {
                              if (item && item.includes('{'))
                                  result.body.push(JSON.parse(item));
                          } catch (e) {
                              // 忽略非 JSON 字符串，通常情况下为分隔符
                          }
                      });
                  }
                  offset += packetLen;
              }
          } else if (result.op === 3) {
              result.body = {
                  count: readInt(buffer, 16, 4)
              };
          }
          resolve(result);
  });
};

setInterval(function () {
  ws.send(encode('', 2));
}, 30000);
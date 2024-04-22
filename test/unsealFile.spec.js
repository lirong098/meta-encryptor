import {Sealer} from "../src/Sealer"
import {FileProvider} from "../src/FileProvider.js"
import path from "path";
import crypto from "crypto";
import fs from "fs";


function calculateMD5(filePath) {
    return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath);
        const hash = crypto.createHash('md5');

        stream.on('data', chunk => {
            hash.update(chunk, 'utf8');
        });

        stream.on('error', err => {
            reject(err);
        });

        stream.on('end', () => {
            const md5 = hash.digest('hex');
            resolve(md5);
        });
    });
}
let key_pair = {
    private_key:
      "60d61a1d92b26608016dba8cb8e8e96fd44d5dee0a0415a024657e47febcced8",
    public_key:
      "731234931a081e9beae856318a9bf32ac3698ea8215bf74f517f8377cc6ba8740e28ed87c97d0ee8775bc83505867b0bc34a66adc91f0ea9b44c80533f1a3dca",
};

async function sealAndUnsealFile(src){
  let readSize = 0;
  let dst = path.join(path.dirname(src), path.basename(src) + ".sealed");
  let ret_src = path.join(path.dirname(src), path.basename(src) + ".sealed.ret");

  let rs
  let ws
  function seal(readByte = 0) {
    console.log("readByte", readByte);
    rs = fs.createReadStream(src, {
      start: readByte,
    })
    ws = fs.createWriteStream(dst, { flags: !readByte ? "w" : "a" });
    rs.on("data", (chunk) => {
      readSize += chunk.length;
    });
    rs.pipe(new Sealer({keyPair: key_pair})).pipe(ws)
  }

  seal(0);

  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      clearTimeout(timer);
      resolve();
    }, 500);
  })

  rs.pause();
  rs.unpipe();
  const bytesRead = rs.bytesRead
  rs = null;
  ws = null;

  console.log("unpipe", readSize, bytesRead);

  await Promise.resolve();

  seal(bytesRead)


  // log.info("readStream.bytesRead", readSize, readStream.bytesRead);
  await new Promise((resolve)=>{
    ws && ws.on('finish', ()=>{
      resolve();
    });
  });
  // console.timeEnd(tag)

  let unsealer = new FileProvider(key_pair, dst, ret_src);
  let promise1 = unsealer.unsealFile()
  await promise1;
  let m1 = await calculateMD5(src)
  let m2 = await calculateMD5(ret_src);
  expect(m1.length > 0).toBe(true)
  expect(m1).toStrictEqual(m2);
  fs.unlinkSync(dst);
  fs.unlinkSync(ret_src);
}


function generateFileWithSize(fp, size){
  let b = Buffer.alloc(1024 * 64);
  for(let i = 0; i < 1024 * 64; i++){
    b[i] = i%256
  }

  for (let i = 0; i < size/(1024 * 64); i++) {
    fs.writeFileSync(fp,
      b,
      {
        flag: "a+",
        mode: 0o666
      });
  }

  console.log("done generate file")
}

test('unpipe seal', async()=>{
  let src = "large_unpipe.file";
  try{
    fs.unlinkSync(src)
  }catch(error){

  }
  //300MB
  generateFileWithSize(src,  300 * 1024 * 1024)
  await sealAndUnsealFile(src);
  fs.unlinkSync(src)
})

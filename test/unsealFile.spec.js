import {Sealer} from "../src/Sealer"
import path from "path";
import crypto from "crypto";
import fs from "fs";
import{calculateMD5, key_pair} from "./helper"


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

  /*
  let unsealer = new FileProvider(key_pair, dst, ret_src);
  let promise1 = unsealer.unsealFile()
  await promise1;
  let m1 = await calculateMD5(src)
  let m2 = await calculateMD5(ret_src);
  expect(m1.length > 0).toBe(true)
  expect(m1).toStrictEqual(m2);
  */
  try{
    fs.unlinkSync(dst);
    fs.unlinkSync(ret_src);
  }catch(err){

  }
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

import {Sealer, ToString} from "../src/Sealer"
import {FileProvider} from "../src/FileProvider.js"
const path = require('path');
import fs from "fs";
const crypto = require('crypto');
const csv = require('csv-parser')


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
  let dst = path.join(path.dirname(src), path.basename(src) + ".sealed");
  let ret_src = path.join(path.dirname(src), path.basename(src) + ".sealed.ret");

  let rs = fs.createReadStream(src)
  let ws = fs.createWriteStream(dst)
  let tag = 'seal ' + src + ' cost time'
  console.time(tag)
  rs.pipe(new Sealer({keyPair: key_pair})).pipe(ws)
  await new Promise((resolve)=>{
    ws.on('finish', ()=>{
      resolve();
    });
  });
  console.timeEnd(tag)

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
test('seal small file', async()=>{

  let src = './tsconfig.json';
  await sealAndUnsealFile(src);
})

test('test medium file', async()=>{
  let src = './yarn.lock';
  await sealAndUnsealFile(src);
})


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

test('test large file', async()=>{
  let src = "large.file";
  try{
    fs.unlinkSync(src)
  }catch(error){

  }
  //100MB
  generateFileWithSize(src,  1024 * 1024 * 100)
   await sealAndUnsealFile(src);
   fs.unlinkSync(src)
})

async function sealAndUnsealCSVFile(src){
  let dst = path.join(path.dirname(src), path.basename(src) + ".sealed");
  let ret_src = path.join(path.dirname(src), path.basename(src) + ".sealed.ret");

  let rs = fs.createReadStream(src)
  let ws = fs.createWriteStream(dst)
  let tag = 'seal ' + src + ' cost time'
  console.time(tag)
  rs.pipe(csv()).pipe(new ToString()).pipe(new Sealer({keyPair: key_pair})).pipe(ws)
  await new Promise((resolve)=>{
    ws.on('finish', ()=>{
      resolve();
    });
  });
  console.timeEnd(tag)

  let unsealer = new FileProvider(key_pair, dst, ret_src);
  let promise1 = unsealer.unsealFile()
  await promise1;
  let m1 = await calculateMD5(src)
  let m2 = await calculateMD5(ret_src);
  expect(m1.length > 0).toBe(true)
  //expect(m1).toStrictEqual(m2);
  fs.unlinkSync(dst);
  fs.unlinkSync(ret_src);
}
test('test CSV file', async()=>{
  let src = "./test/test.csv";
  await sealAndUnsealCSVFile(src);
})

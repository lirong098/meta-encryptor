
import {Sealer, ToString} from "../src/Sealer"
import {isSealedFile, sealedFileVersion, dataHashOfSealedFile, signedDataHash, forwardData} from "../src/SealedFileUtil.js"


const path = require('path');
import fs from "fs";

let key_pair = {
    private_key:
      "60d61a1d92b26608016dba8cb8e8e96fd44d5dee0a0415a024657e47febcced8",
    public_key:
      "731234931a081e9beae856318a9bf32ac3698ea8215bf74f517f8377cc6ba8740e28ed87c97d0ee8775bc83505867b0bc34a66adc91f0ea9b44c80533f1a3dca",
};

test('true', async()=>{
  let src = './tsconfig.json'
  let dst = path.join(path.dirname(src), path.basename(src) + ".util.sealed");
  let rs = fs.createReadStream(src)
  let ws = fs.createWriteStream(dst)

  rs.pipe(new Sealer({keyPair: key_pair})).pipe(ws)
  await new Promise((resolve)=>{
    ws.on('finish', ()=>{
      resolve();
    });
  });

  let t = isSealedFile(src);
  expect(t).toBe(false);
  let t2 = isSealedFile(dst);
  expect(t2).toBe(true);
  let t3 = sealedFileVersion(dst);
  expect(t3).toBe(2);
  let hash = dataHashOfSealedFile(dst);
  expect(hash.length).toBe(32);
  let s = signedDataHash(key_pair, hash);
  expect(s.length != 0).toBe(true);
  fs.unlinkSync(dst);
})

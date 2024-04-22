const meta = require("../src/index.js");
const ByteBuffer = require("bytebuffer");
var streams = require('memory-streams');
import DP from "../src/Dataprovider.js"
const {headerAndBlockBufferFromBuffer} = DP

const BlockNumLimit = 1024 * 1024;

let key_pair = {
    private_key:
      "60d61a1d92b26608016dba8cb8e8e96fd44d5dee0a0415a024657e47febcced8",
    public_key:
      "731234931a081e9beae856318a9bf32ac3698ea8215bf74f517f8377cc6ba8740e28ed87c97d0ee8775bc83505867b0bc34a66adc91f0ea9b44c80533f1a3dca",
};

test('test dataprovider basic', async ()=>{

  let dp = new meta.DataProvider(key_pair);

  let ds = new streams.WritableStream()

  let ntbytes = meta.YPCNtObject.autoGenerateBytes(["1", 2, 3, "2020/10/01"])
  dp.sealData(ntbytes, ds)
  const sealData = dp.sealData(null, ds, true);
  let expect_hash = sealData.data_hash;
  let b2 = ds.toBuffer();
  let all = b2
  //check data
  let ks = new streams.ReadableStream(all)
  let headerAndBlockBuffer = headerAndBlockBufferFromBuffer(all)
  let r = await meta.checkSealedData(key_pair, ks, headerAndBlockBuffer, expect_hash);
  expect(r).toBe(true)
  expect(all.length < 32 * BlockNumLimit).toBeTruthy();

  let ss = new streams.ReadableStream(all)
  let rs = new streams.WritableStream();
  let rhash = await meta.unsealData(key_pair, ss, headerAndBlockBuffer, rs, null, (total, count)=>{
    expect(total).toBe(1);
    expect(count).toBe(1);
  });
  let res_ntbytes = rs.toBuffer()
  expect(ntbytes).toStrictEqual(res_ntbytes);
  expect(rhash.toString('hex')).toStrictEqual(expect_hash);
})


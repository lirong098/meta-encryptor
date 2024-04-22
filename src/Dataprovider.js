import ByteBuffer, {
  LITTLE_ENDIAN
} from "bytebuffer";
import {
  header_t,
  header_t2buffer,
  buffer2header_t,
  block_info_t2buffer,
  buffer2block_info_t,
  ntpackage2batch,
  toNtInput,
  fromNtInput,
  batch2ntpackage
} from "./header_util.js"
//const {header_t, header_t2buffer, buffer2header_t, block_info_t2buffer, buffer2block_info_t, ntpackage2batch, batch2ntpackage} = HeaderUtil;
import {
  decode
} from "iconv-lite";
import {
  detect
} from "jschardet";
import keccak256 from "keccak256";
import {
  keccak256 as _keccak256
} from "js-sha3";
import YPCCryptoFun from "./ypccrypto.js";
import YPCNtObjectFun from "./ypcntobject.js";
import {
  parse
} from "./sync.js";
const fs = require('fs');
import BlockFileFun from "./blockfile.js";
var log = require("loglevel").getLogger("meta-encryptor/dataprovider");
const YPCCrypto = YPCCryptoFun();
const YPCNtObject = YPCNtObjectFun();
const EventEmitter = require('events');

const BlockNumLimit = 1024 * 1024;
const max_item_size = 64 * 1024;
let HeaderSize = 64;

const BlockFile = BlockFileFun(
  Buffer.from("1fe2ef7f3ed18847", "hex"),
  BlockNumLimit,
  256
);
const DataProvider = function(_key) {
  if (new.target === undefined) {
    throw new Error('DataProvider(_filename, _key) must be called with the new keyword.');
  }
  this.header = new header_t(0, 0, 0, 0);
  this.header.version_number = 2;
  this.block_meta_info = [];
  this.sealed_data = [];
  this.data_lines = [];
  this.counter = 0;

  this.key_pair = _key;
  this.data_hash = _keccak256.digest(Buffer.from("Fidelius", "utf-8"));
  this.all_line_num = 0,
    this.now_line_num = 0;
  this.sealBatch = [];
  this.sealBatchSize = 0;
}

DataProvider.prototype.write_batch = function(batch, public_key, writable_stream) {
  let pkg_bytes = batch2ntpackage(batch);
  const ots = YPCCrypto.generatePrivateKey();
  let s = YPCCrypto._encryptMessage(
    Buffer.from(public_key, "hex"),
    ots,
    pkg_bytes,
    0x2
  );
  let all = BlockFile.append_item(s, this.header, this.block_meta_info);
  this.header = all[0];
  this.block_meta_info = all[1];
  let data = new ByteBuffer(8 + s.length, LITTLE_ENDIAN);
  data.writeUint64(s.length, 0);
  data.append(s, 8);
  if (writable_stream !== undefined && writable_stream !== null) {
    //console.log("writable_stream ", writable_stream)
    //console.log("data", data)
    writable_stream.write(data.toBuffer());
  }
}

DataProvider.prototype.sealData = function(input,
  writable_stream = null,
  is_end = false) {
  let ntInput = null;
  input && (ntInput = toNtInput(input));
  ntInput && this.sealBatch.push(ntInput);
  ntInput && (this.sealBatchSize += ntInput.length);

  if (this.sealBatchSize >= max_item_size || (is_end && this.sealBatchSize > 0)) {
    this.write_batch(this.sealBatch, this.key_pair["public_key"], writable_stream);
    this.sealBatch = [];
    this.sealBatchSize = 0;
  }

  if (ntInput) {
    let k = Buffer.concat([Buffer.from(this.data_hash), ntInput]);
    this.data_hash = _keccak256.digest(k);
  }

  if (!is_end) return null;

  const headerAndMeta = this.setHeaderAndMeta();
  if (writable_stream !== undefined &&
    writable_stream !== null) {
    let ret = writable_stream.write(headerAndMeta.blockInfo);
    ret = writable_stream.write(headerAndMeta.headerInfo);
  }
  return headerAndMeta.meta;
};

DataProvider.prototype.setHeaderAndMeta = function() {
  //let block_start_offset = 32 + 32 * BlockNumLimit;
  let block_start_offset = 32 * this.header.block_number;
  let fileMeta = new ByteBuffer(block_start_offset, LITTLE_ENDIAN);
  let offset = 0;
  //set header
  this.header.data_hash = Buffer.from(this.data_hash);
  let buf_header = header_t2buffer(this.header);
  //fileMeta.append(buf_header, offset);
  //offset += 32;
  //set block meta
  for (let i = 0; i < this.header.block_number; i++) {
    let bi = this.block_meta_info[i];
    let buf_bi = block_info_t2buffer(bi);
    fileMeta.append(buf_bi, offset);
    offset += 32;
  }
  let b_skey = Buffer.from(this.key_pair["private_key"], "hex");
  let hash_sig = YPCCrypto.signMessage(b_skey, Buffer.from(this.data_hash));
  let meta = {
    data_hash: Buffer.from(this.data_hash).toString("hex"),
    shu_public_key: this.key_pair["public_key"],
    hash_sig: Buffer.from(hash_sig).toString("hex"),
  };
  buf_header.reset();
  fileMeta.reset();
  return {
    headerInfo: buf_header.toBuffer(),
    blockInfo: fileMeta.toBuffer(),
    meta,
  };
};

const headerAndBlockBufferFromFile = function(fp) {
  const srcStat = fs.statSync(fp);
  if (srcStat.size <= HeaderSize) {
    return null;
  }

  const fd = fs.openSync(fp, 'r');
  const buffer = Buffer.alloc(HeaderSize);
  let readLen = fs.readSync(fd, buffer, 0, 64, srcStat.size - 64);
  if (readLen != HeaderSize) {
    fs.closeSync(fd);
    return null;
  }
  const header = buffer2header_t(ByteBuffer.wrap(buffer, LITTLE_ENDIAN));
  if (header.version_number != 2) {
    throw new Error("only support version 2, yet got ", header.version_number);
  }

  const blkBuffer = Buffer.alloc(32 * header.block_number);
  readLen = fs.readSync(fd, blkBuffer, 0, 32 * header.block_number, srcStat.size - HeaderSize - 32 * header.block_number);
  if (readLen != 32 * header.block_number) {
    fs.closeSync(fd);
    return null;
  }
  fs.closeSync(fd);
  return {
    header: buffer,
    block: blkBuffer
  }
}

const headerAndBlockBufferFromBuffer = function(buf) {
  if (buf.length <= HeaderSize) {
    return null;
  }
  const buffer = buf.subarray(buf.length - HeaderSize);
  const header = buffer2header_t(ByteBuffer.wrap(buffer, LITTLE_ENDIAN));
  if (header.version_number != 2) {
    throw new Error("only support version 2, yet got ", header.version_number);
  }

  if (buf.length <= HeaderSize + 32 * header.block_number) {
    return null;
  }

  const blkBuffer = buf.subarray(buf.length - HeaderSize - 32 * header.block_number, buf.length - HeaderSize);

  return {
    header: buffer,
    block: blkBuffer
  }
}

const readFromInputStream = async function(inputStream, size) {
  let ret = []
  let left = size;
  while (true) {
    if (inputStream.readableLength == 0) {
      await new Promise((resolve) => {
        inputStream.on('readable', () => resolve());
      });
    }
    let t = inputStream.readableLength
    let b;
    if (left > t) {
      b = inputStream.read();
    } else {
      b = inputStream.read(left);
    }
    ret.push(b)
    left = left - b.length;
    if (left == 0) {
      break;
    }
  }
  return Buffer.concat(ret);
}
const unsealData = async function(keyPair, inputStream, headerAndBlockBuffer, outputStream, decoder, progressHandler = undefined, errorHandler = undefined) {
  let skey = Buffer.from(keyPair["private_key"], "hex");

  let data_hash = keccak256(Buffer.from("Fidelius", "utf-8"));
  let headBuf = ByteBuffer.wrap(headerAndBlockBuffer.header, LITTLE_ENDIAN);
  let hd = buffer2header_t(headBuf);
  if (hd.version_number != 2) {
    throw new Error("unsealData only support version 2, yet got ", hd.version_number);
  }

  //read all block info
  let block_info_buf = headerAndBlockBuffer.block;
  let total_item = hd.item_number;
  let item_count = 0;

  let handleBlock = function(block_info, tbuf) {
    let block_buf = ByteBuffer.wrap(tbuf, LITTLE_ENDIAN)
    let offset = 0;
    for (let j = block_info.start_item_index; j < block_info.end_item_index; j++) {
      let item_size = block_buf.readUint64(offset).toNumber();
      offset += 8;
      let cipher = Buffer.from(
        block_buf.buffer.slice(offset, offset + item_size)
      );

      let msg = YPCCrypto.decryptMessage(skey, cipher);
      let batch = ntpackage2batch(msg);
      for (let i = 0; i < batch.length; i++) {
        let b = fromNtInput(batch[i]);
        if (outputStream !== undefined && outputStream !== null) {
          if (decoder) {
            outputStream.write(decoder(b))
          } else {
            outputStream.write(b)
          }
        }
        let k = Buffer.from(
          data_hash.toString("hex") + Buffer.from(batch[i]).toString("hex"),
          "hex"
        );
        data_hash = keccak256(k);
      }

      item_count += 1;
      if (progressHandler !== undefined && progressHandler !== null) {
        progressHandler(total_item, item_count);
      }
      offset += item_size;
    }
  };

  let block_index = 0;
  let chunks = []
  let chunk_length = 0;
  let cur_block_info = buffer2block_info_t(ByteBuffer.wrap(block_info_buf.subarray(block_index * 32, (block_index + 1) * 32), LITTLE_ENDIAN))
  let block_buf_size = cur_block_info.end_file_pos - cur_block_info.start_file_pos;
  let block_buf = null;

  const emitter = new EventEmitter();
  let tk = new Promise(resolve => {
    inputStream.on('end', () => {
      resolve();
    });
    emitter.on('end', (msg) => {
      resolve();
    });
    inputStream.on('error', (error) => {
      if (errorHandler) {
        errorHandler(error);
        reject();
      }
    });
  });

  inputStream.on('readable', () => {
    let t = inputStream.readableLength
    let b;
    if (block_buf_size - chunk_length > t) {
      b = inputStream.read();
    } else {
      b = inputStream.read(block_buf_size - chunk_length);
    }
    if (b === null) {
      return;
    }
    chunks.push(b)
    chunk_length += b.length;
    if (chunk_length == block_buf_size) {
      block_buf = Buffer.concat(chunks);
      handleBlock(cur_block_info, block_buf);
      block_index += 1;
      if (block_index >= hd.block_number) {
        emitter.emit('end', null);
        return;
      }
      chunks = []
      chunk_length = 0;
      cur_block_info = buffer2block_info_t(ByteBuffer.wrap(block_info_buf.subarray(block_index * 32, (block_index + 1) * 32), LITTLE_ENDIAN))
      block_buf_size = cur_block_info.end_file_pos - cur_block_info.start_file_pos;
      block_buf = null;
      
      if(inputStream.readable){
        b = inputStream.read();
        if (b === null) {
          return;
        }
        chunks.push(b)
        chunk_length += b.length;
      }
    } else {}
  });
  await tk;

  return data_hash;
}

const checkSealedData = async function(keyPair, inputStream, headerAndBlockBuffer, expectedHash) {
  let dhash = await unsealData(keyPair, inputStream, headerAndBlockBuffer, null)
  if (typeof expectedHash === 'string') {
    return dhash.toString('hex') === expectedHash;
  } else {
    return dhash.equals(expectedHash);
  }
}


export default {
  DataProvider,
  checkSealedData,
  unsealData,
  headerAndBlockBufferFromBuffer,
  headerAndBlockBufferFromFile
};

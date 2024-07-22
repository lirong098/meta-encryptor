# meta-encryptor

**中文** | [English](./README.en.md)

#### 介绍

在[典枢](https://doc-dianshu.yeez.tech/index.php)的流程中，用户需要托管数据，供[Fidelius](https://github.com/YeeZTech/YeeZ-Privacy-Computing)解密、计算保证数据的正确性和隐私性，但是，用户不希望暴露源数据。因此，用户需要在本地完成加密，同样的，用户获得数据时，需要在本地进行解密（注意，此处的本地可以是网页，也可以是客户端）。meta-encryptor 就是提供给用户的加解密工具。


#### 软件架构

使用 crypto 等加密算法。

#### 安装教程

npm

```base
npm install @yeez-tech/meta-encryptor --save
```

yarn

```base
yarn add @yeez-tech/meta-encryptor
```
#### 构建及测试
```base
yarn install
yarn test
```

#### API

##### crypto.generatePrivateKey

生成私钥

```js
import { crypto } from "@yeez-tech/meta-encryptor";

const sKey = crypto.generatePrivateKey();

console.log("私钥=", sKey);
const pKey = meta.crypto.generatePublicKeyFromPrivateKey(sKey);
useStore().commit(ConfigMutationTypes.SET_ENCRYPTION_CONFIG, {
  privateKey: sKey.toString("hex"),
  publicKey: pKey.toString("hex"),
});
const ypcName = meta.crypto.generateFileNameFromPKey(pKey);
const ypcJson = meta.crypto.generateFileContentFromSKey(sKey);

```

##### crypto.generatePublicKeyFromPrivateKey

通过私钥生成公钥

```js
import { crypto } from "@yeez-tech/meta-encryptor";
const pKey = crypto.generatePublicKeyFromPrivateKey(sKey);
console.log("公钥钥=", pKey);
```

##### crypto.generateFileNameFromPKey

通过公钥生成文件名

```js
import { crypto } from "@yeez-tech/meta-encryptor";
const ypcName = crypto.generateFileNameFromPKey(pKey);
console.log("文件名=", ypcName);
```

##### crypto.generateFileContentFromSKey

通过私钥获取密钥文件内容

```js
import { crypto } from "@yeez-tech/meta-encryptor";
const ypcJson = crypto.generateFileContentFromSKey(sKey);
console.log("文件内容=", ypcJson);
```


##### Sealer
推荐使用Sealer加密流，该方法支持多种格式，包括CSV，Excel，下面是对CSV的例子，其中使用了`ToString`将`csv()`产生的对象转换为`Buffer`。

```js
import {Sealer, ToString} from "@yeez-tech/meta-encryptor"

let rs = fs.createReadStream(src)
let ws = fs.createWriteStream(dst)

rs.pipe(csv())
  .pipe(new ToString())
  .pipe(new Sealer({keyPair:key_pair))
  .pipe(ws);
```
##### Unsealer
Unsealer用来解密流，并且将结果输出到流.

```js
import {Sealer, Unsealer, SealedFileStream} from "@yeez-tech/meta-encryptor";

/*
let src = "./tsconfig.json"
let dst = "./tsconfig.json.encrypted";
let rs = fs.createReadStream(src)
let ws = fs.createWriteStream(dst)

rs.pipe(csv())
  .pipe(new Sealer({keyPair:key_pair))
  .pipe(ws);
await new Promise(resolve=>{
  ws.on('finish', ()=>resolve());
});
*/

let unsealer = new Unsealer({keyPair:key_pair});
let rrs = new SealedFileStream(dst);
let wws = fs.createWriteStream(src + ".new")

rrs.pipe(unsealer).pipe(wws);
await new Promise(resolve=>{
  wws.on('finish', ()=>resolve());
})

```

##### isSealedFile
用于判断一个文件是否为一个有效的封装文件，如果为真，返回`true`，否则，返回`false`。
```js
import {isSealedFile} from "@yeez-tech/meta-encryptor";

let r = isSealedFile(path);
```

##### sealedFileVersion
返回封装文件的版本号。

```js
import {sealedFileVersion} from "@yeez-tech/meta-encryptor";

let r = sealedFileVersion(path);
```
##### dataHashOfSealedFile
返回封装文件对应的原始数据的hash。注意，该函数直接读取的是记录在文件头的hash，如果文件被篡改，该函数有可能返回错误的hash，因此，如果有可能，应该在解密之后，对hash进行校验。

```js
import {dataHashOfSealedFile} from "@yeez-tech/meta-encryptor";

let r = dataHashOfSealedFile(path);
```

##### signedDataHash
对数据hash进行签名。
```js
import {signedDataHash} from "@yeez-tech/meta-encryptor";

//keyPair应该是{'private-key':'hex string of private key',
//dataHash应该是一个Buffer，长度为32字节
let r = signedDataHash(keyPair, dataHash);
```

##### forwardSkey
生成转发枢私钥的信息。
```js
import {forwardSkey} from "@yeez-tech/meta-encryptor";

//keyPair应该是{'private-key':'hex string of private key',
//dianPKey应该是一个Buffer，包含了典公钥，
//enclaveHash应该是一个Buffer，包含了keyMgr的hash，可以为null，如果为null，则意味着可以被转发到任意的enclave中；
let r = forwardSkey(keyPair, dianPKey, enclaveHash);
```
返回如下对象，
```js
{
  encrypted_skey:Buffer,
  forward_sig: Buffer
}
```



#### Author

contact@yeez.tech

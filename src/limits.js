const BlockNumLimit = 1024 * 1024;
const MaxItemSize = 64 * 1024;
const HeaderSize = 64;
const MagicNum =
  Buffer.from("1fe2ef7f3ed18847", "hex");

export {
  BlockNumLimit,
  MaxItemSize,
  HeaderSize,
  MagicNum
}

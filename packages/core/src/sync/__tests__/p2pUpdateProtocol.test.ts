import {
  P2PUpdateReassembler,
  createP2PUpdateMessages,
  parseP2PUpdateProtocolMessage,
} from '../p2pUpdateProtocol'

const smallUpdate = new Uint8Array([0, 1, 2, 3, 250, 251, 252, 253, 254, 255])
const [singleMessage] = createP2PUpdateMessages({
  documentId: 'doc-1',
  updateId: 'update-1',
  update: smallUpdate,
  maxChunkBytes: 64,
})

if (!singleMessage || singleMessage.type !== 'yjs-update') {
  throw new Error('Small update should be encoded as a single update message.')
}

const parsedSingle = parseP2PUpdateProtocolMessage(JSON.parse(JSON.stringify(singleMessage)))
if (!parsedSingle || parsedSingle.type !== 'yjs-update') {
  throw new Error('Single update message should parse after JSON round-trip.')
}

const singleResult = new P2PUpdateReassembler().ingest(parsedSingle)
if (!singleResult || !equalBytes(singleResult.update, smallUpdate)) {
  throw new Error('Single update message should reassemble to the original bytes.')
}

const largeUpdate = new Uint8Array(Array.from({ length: 35 }, (_, index) => index + 1))
const chunkMessages = createP2PUpdateMessages({
  documentId: 'doc-2',
  updateId: 'update-2',
  update: largeUpdate,
  maxChunkBytes: 8,
})

if (chunkMessages.length !== 5 || chunkMessages.some((message) => message.type !== 'yjs-update-chunk')) {
  throw new Error('Large update should be split into ordered chunk messages.')
}

const chunkReassembler = new P2PUpdateReassembler()
let chunkResult = null as ReturnType<P2PUpdateReassembler['ingest']>
for (const message of [...chunkMessages].reverse()) {
  const parsed = parseP2PUpdateProtocolMessage(JSON.parse(JSON.stringify(message)))
  if (!parsed) throw new Error('Chunk message should parse after JSON round-trip.')
  chunkResult = chunkReassembler.ingest(parsed)
}

if (!chunkResult || chunkResult.documentId !== 'doc-2' || !equalBytes(chunkResult.update, largeUpdate)) {
  throw new Error('Chunk messages should reassemble out of order to the original update.')
}

if (parseP2PUpdateProtocolMessage({ type: 'yjs-update', documentId: 'doc', payloadBase64: 'AA==' }) !== null) {
  throw new Error('Invalid update message missing fields should be rejected.')
}

const tampered = {
  ...chunkMessages[0],
  byteLength: 999,
}
const tamperedParsed = parseP2PUpdateProtocolMessage(tampered)
if (!tamperedParsed || new P2PUpdateReassembler().ingest(tamperedParsed) !== null) {
  throw new Error('Tampered chunk byteLength should not reassemble.')
}

const invalidBase64 = {
  ...singleMessage,
  payloadBase64: 'not-valid-base64!',
}
const invalidBase64Parsed = parseP2PUpdateProtocolMessage(invalidBase64)
if (!invalidBase64Parsed || new P2PUpdateReassembler().ingest(invalidBase64Parsed) !== null) {
  throw new Error('Invalid base64 payload should not reassemble.')
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

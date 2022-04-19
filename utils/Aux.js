import { eip712Domain, structHash, signHash } from "./eip712"

export default class Aux {
  ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
  ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
  NULL_SIG = { v: 27, r: this.ZERO_BYTES32, s: this.ZERO_BYTES32 };
  CHAIN_ID = 4;

  constructor(provider) {
    this.eip712Order = {
      name: 'Order',
      fields: [
        { name: 'registry', type: 'address' },
        { name: 'maker', type: 'address' },
        { name: 'staticTarget', type: 'address' },
        { name: 'staticSelector', type: 'bytes4' },
        { name: 'staticExtradata', type: 'bytes' },
        { name: 'maximumFill', type: 'uint256' },
        { name: 'listingTime', type: 'uint256' },
        { name: 'expirationTime', type: 'uint256' },
        { name: 'salt', type: 'uint256' }
      ]
    }
    this.web3 = provider
    this.web3 = this.web3.extend({
      methods: [{
        name: 'signTypedData',
        call: 'eth_signTypedData',
        params: 2,
        inputFormatter: [this.web3.extend.formatters.inputAddressFormatter, null]
      }]
    })
  }

  // Truffle does not expose chai so it is impossible to add chai-as-promised.
  // This is a simple replacement function.
  // https://github.com/trufflesuite/truffle/issues/2090
  assertIsRejected = (promise, error_match, message) => {
    let passed = false
    return promise
      .then(() => {
        passed = true
        return assert.fail()
      })
      .catch(error => {
        if (passed)
          return assert.fail(message || 'Expected promise to be rejected')
        if (error_match) {
          if (typeof error_match === 'string')
            return assert.equal(error_match, error.message, message);
          if (error_match instanceof RegExp)
            return error.message.match(error_match) || assert.fail(error.message, error_match.toString(), `'${error.message}' does not match ${error_match.toString()}: ${message}`);
          return assert.instanceOf(error, error_match, message);
        }
      })
  }

  increaseTime = seconds => {
    return new Promise(resolve =>
      web3.currentProvider.send({
        jsonrpc: '2.0',
        method: 'evm_increaseTime',
        params: [seconds],
        id: 0
      }, resolve)
    )
  }

  hashOrder = (order) => {
    return '0x' + structHash(this.eip712Order.name, this.eip712Order.fields, order).toString('hex')
  }

  structToSign = (order, exchange) => {
    return {
      name: this.eip712Order.name,
      fields: this.eip712Order.fields,
      domain: {
        name: 'Wyvern Exchange',
        version: '3.1',
        chainId: 4,
        verifyingContract: exchange
      },
      data: order
    }
  }

  hashToSign = (order, exchange) => {
    return '0x' + signHash(this.structToSign(order, exchange)).toString('hex')
  }

  parseSig = (bytes) => {
    bytes = bytes.substr(2)
    const r = '0x' + bytes.slice(0, 64)
    const s = '0x' + bytes.slice(64, 128)
    const v = parseInt('0x' + bytes.slice(128, 130), 16)
    return { v, r, s }
  }

  wrap = (inst) => {
    var obj = {
      inst: inst,
      hashOrder: (order) => inst.hashOrder_.call(order.registry, order.maker, order.staticTarget, order.staticSelector, order.staticExtradata, order.maximumFill, order.listingTime, order.expirationTime, order.salt),
      hashToSign: (order) => {
        return inst.hashOrder_.call(order.registry, order.maker, order.staticTarget, order.staticSelector, order.staticExtradata, order.maximumFill, order.listingTime, order.expirationTime, order.salt).then(hash => {
          return inst.hashToSign_.call(hash)
        })
      },
      validateOrderParameters: (order) => inst.validateOrderParameters_.call(order.registry, order.maker, order.staticTarget, order.staticSelector, order.staticExtradata, order.maximumFill, order.listingTime, order.expirationTime, order.salt),
      validateOrderAuthorization: (hash, maker, sig, misc) => inst.validateOrderAuthorization_.call(hash, maker, web3.eth.abi.encodeParameters(['uint8', 'bytes32', 'bytes32'], [sig.v, sig.r, sig.s]) + (sig.suffix || ''), misc),
      approveOrderHash: (hash) => inst.approveOrderHash_(hash),
      approveOrder: (order, inclusion, misc) => inst.approveOrder_(order.registry, order.maker, order.staticTarget, order.staticSelector, order.staticExtradata, order.maximumFill, order.listingTime, order.expirationTime, order.salt, inclusion, misc),
      setOrderFill: (order, fill) => inst.setOrderFill_(hashOrder(order), fill),
      atomicMatch: (order, sig, call, counterorder, countersig, countercall, metadata) => inst.atomicMatch_(
        [order.registry, order.maker, order.staticTarget, order.maximumFill, order.listingTime, order.expirationTime, order.salt, call.target,
        counterorder.registry, counterorder.maker, counterorder.staticTarget, counterorder.maximumFill, counterorder.listingTime, counterorder.expirationTime, counterorder.salt, countercall.target],
        [order.staticSelector, counterorder.staticSelector],
        order.staticExtradata, call.data, counterorder.staticExtradata, countercall.data,
        [call.howToCall, countercall.howToCall],
        metadata,
        web3.eth.abi.encodeParameters(['bytes', 'bytes'], [
          web3.eth.abi.encodeParameters(['uint8', 'bytes32', 'bytes32'], [sig.v, sig.r, sig.s]) + (sig.suffix || ''),
          web3.eth.abi.encodeParameters(['uint8', 'bytes32', 'bytes32'], [countersig.v, countersig.r, countersig.s]) + (countersig.suffix || '')
        ])
      ),
      atomicMatchWith: (order, sig, call, counterorder, countersig, countercall, metadata, misc) => inst.atomicMatch_(
        [order.registry, order.maker, order.staticTarget, order.maximumFill, order.listingTime, order.expirationTime, order.salt, call.target,
        counterorder.registry, counterorder.maker, counterorder.staticTarget, counterorder.maximumFill, counterorder.listingTime, counterorder.expirationTime, counterorder.salt, countercall.target],
        [order.staticSelector, counterorder.staticSelector],
        order.staticExtradata, call.data, counterorder.staticExtradata, countercall.data,
        [call.howToCall, countercall.howToCall],
        metadata,
        web3.eth.abi.encodeParameters(['bytes', 'bytes'], [
          web3.eth.abi.encodeParameters(['uint8', 'bytes32', 'bytes32'], [sig.v, sig.r, sig.s]) + (sig.suffix || ''),
          web3.eth.abi.encodeParameters(['uint8', 'bytes32', 'bytes32'], [countersig.v, countersig.r, countersig.s]) + (countersig.suffix || '')
        ]),
        misc
      )
    }
    obj.sign = (order, account) => {
      const str = this.structToSign(order, inst.address)
      return this.web3.signTypedData(account, {
        types: {
          EIP712Domain: eip712Domain.fields,
          Order: this.eip712Order.fields
        },
        domain: str.domain,
        primaryType: 'Order',
        message: order
      }).then(sigBytes => {
        const sig = this.parseSig(sigBytes)
        return sig
      })
    }
    obj.personalSign = (order, account) => {
      const calculatedHashToSign = this.hashToSign(order, inst.address)
      return this.web3.eth.sign(calculatedHashToSign, account).then(sigBytes => {
        let sig = this.parseSig(sigBytes)
        sig.v += 27
        sig.suffix = '03' // EthSign suffix like 0xProtocol
        return sig
      })
    }
    return obj
  }

  randomUint = () => {
    return Math.floor(Math.random() * 1e10)
  }
}
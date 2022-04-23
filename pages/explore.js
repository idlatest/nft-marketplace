import { useEffect, useState, Fragment } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { TailSpin } from 'react-loader-spinner';
import { Dialog, Transition } from '@headlessui/react';
import { XIcon } from '@heroicons/react/outline';
import Moralis from 'moralis';
import { useAppContext } from '../context/AppContext';
import {
  nftContractABI,
  registryABI,
  registryAddress,
  staticAddress,
  tokenABI,
  tokenAddress,
  exchangeAddress,
  nftContractAddress,
  exchangeABI
} from '../utils/constants';
import Aux from '../utils/Aux';
import { eip712Domain } from '../utils/eip712';
import BigNumber from 'bignumber.js';

let iziToast;
if (typeof window !== 'undefined') {
  import('izitoast').then(module => {
    iziToast = module;
  });
}

Moralis.start({
  serverUrl: process.env.NEXT_PUBLIC_MORALIS_SERVER_URL,
  appId: process.env.NEXT_PUBLIC_MORALIS_APP_ID
});

export default function Collections() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [txError, setTxError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const {
    currentAccount,
    getProvider,
    balance,
    connectWallet
  } = useAppContext();

  const web3 = getProvider();

  const aux = new Aux(web3);

  const getContract = (contractAddress, contractABI) => {
    const contract = new web3.eth.Contract(contractABI, contractAddress);

    return contract
  }

  const submit = async (e) => {
    e.preventDefault()

    const exchange = getContract(exchangeAddress, exchangeABI);
    const registry = getContract(registryAddress, registryABI);
    const nft = getContract(nftContractAddress, nftContractABI);
    const token = getContract(tokenAddress, tokenABI);

    const gasLimit = 285000;

    try {
      if (!currentAccount) {
        await connectWallet()
      }

      if (new BigNumber(selectedOrder.attributes.price).isGreaterThan(balance)) {
        return iziToast.error({ message: "Insufficient balance" })
      }

      const proxyCheck = await registry.methods.proxies(currentAccount).call({
        from: currentAccount
      });

      if (new BigNumber(proxyCheck).isZero()) {
        // Register user account on proxy
        // allow proxy to carry out tx for user
        await registry.methods.registerProxy().send({
          from: currentAccount,
          gasLimit
        });
      }

      const proxy = await registry.methods.proxies(currentAccount).call({
        from: currentAccount
      });
      // localStorage.setItem("proxy", proxy);
      console.log("proxy", proxy);

      // set approval on nft contract to allow the proxy to make transaction on behalf of the owner
      await token.methods.approve(proxy, selectedOrder.attributes.price).send({
        from: currentAccount,
        gasLimit
      });
      console.log("approve");


      const selector = web3.eth.abi.encodeFunctionSignature('any(bytes,address[7],uint8[2],uint256[6],bytes,bytes)');

      const params = web3.eth.abi.encodeParameters(
        ['address[2]', 'uint256[2]'],
        [[tokenAddress, nftContractAddress], [selectedOrder.attributes.metadata.tokenId, selectedOrder.attributes.price]]
      );

      const order = selectedOrder.attributes.order;

      const counterOrder = {
        registry: registryAddress,
        maker: currentAccount,
        staticTarget: staticAddress,
        staticSelector: selector,
        staticExtradata: params,
        maximumFill: selectedOrder.attributes.price,
        listingTime: "0",
        expirationTime: "10000000000",
        salt: aux.randomUint(),
      };

      const str = aux.structToSign(counterOrder, exchangeAddress);

      web3.currentProvider.send({
        method: 'eth_signTypedData_v3',
        params: [currentAccount, JSON.stringify({
          types: {
            EIP712Domain: eip712Domain.fields,
            Order: aux.eip712Order.fields
          },
          primaryType: 'Order',
          domain: str.domain,
          message: counterOrder
        })],
        from: currentAccount
      }, async (error, response) => {
        if (error) return console.error(error);
        if (response.error) {
          return console.error(response.error.message);
        }

        const signature = aux.parseSig(response.result);

        const isValidParameter = await exchange.methods
          .validateOrderParameters_(order.registry, order.maker, order.staticTarget, order.staticSelector, order.staticExtradata, order.maximumFill, order.listingTime, order.expirationTime, order.salt)
          .call({
            from: currentAccount
          });

        if (!isValidParameter) {
          return console.error("invalid order authorization");
        }

        const hash = await exchange.methods
          .hashOrder_(order.registry, order.maker, order.staticTarget, order.staticSelector, order.staticExtradata, order.maximumFill, order.listingTime, order.expirationTime, order.salt)
          .call({
            from: currentAccount
          });

        const orderAuthorization = await exchange.methods
          .validateOrderAuthorization_(hash, currentAccount, web3.eth.abi.encodeParameters(['uint8', 'bytes32', 'bytes32'], [signature.v, signature.r, signature.s]))
          .call({
            from: currentAccount
          });

        if (!orderAuthorization) {
          return console.error("invalid order authorization");
        }


        const firstData = nft.methods.transferFrom(order.maker, counterOrder.maker, selectedOrder.attributes.metadata.tokenId).encodeABI();
        console.log("firstData", firstData);

        const secondData = token.methods.transferFrom(counterOrder.maker, order.maker, selectedOrder.attributes.price).encodeABI();
        console.log("secondData", secondData);

        const firstCall = { target: nftContractAddress, howToCall: 0, data: firstData };
        console.log("firstCall", firstCall);

        const secondCall = { target: tokenAddress, howToCall: 0, data: secondData };
        console.log("secondCall", secondCall);

        const res = await exchange.methods.atomicMatch_(
          [
            order.registry,
            order.maker,
            order.staticTarget,
            order.maximumFill,
            order.listingTime,
            order.expirationTime,
            order.salt,
            firstCall.target,
            counterOrder.registry,
            counterOrder.maker,
            counterOrder.staticTarget,
            counterOrder.maximumFill,
            counterOrder.listingTime,
            counterOrder.expirationTime,
            counterOrder.salt,
            secondCall.target
          ],
          [
            order.staticSelector,
            counterOrder.staticSelector
          ],
          order.staticExtradata,
          firstCall.data,
          counterOrder.staticExtradata,
          secondCall.data,
          [
            firstCall.howToCall,
            secondCall.howToCall
          ],
          '0x0000000000000000000000000000000000000000000000000000000000000000',
          web3.eth.abi.encodeParameters(["bytes", "bytes"], [
            web3.eth.abi.encodeParameters(['uint8', 'bytes32', 'bytes32'], [selectedOrder.attributes.signature.v, selectedOrder.attributes.signature.r, selectedOrder.attributes.signature.s]) + (selectedOrder.attributes.signature.suffix || ''),
            web3.eth.abi.encodeParameters(['uint8', 'bytes32', 'bytes32'], [signature.v, signature.r, signature.s]) + (signature.suffix || '')
          ])
        )
          .send({
            from: currentAccount,
            gasLimit,
          });

        selectedOrder.set("cancelledOrFinalized", true);

        await selectedOrder.save();

        setOrders(
          orders.filter(orderState => orderState.id != selectedOrder.id)
        )

        iziToast.success({ message: "Item bought successfully" })
      })
    } catch (error) {
      console.log("error", error);
      return iziToast.error({ message: error.message })
    } finally {
      setModalOpen(false);
    }
  }

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);

      try {
        const OrderObj = Moralis.Object.extend("Order");
        const query = new Moralis.Query(OrderObj);

        query.equalTo("cancelledOrFinalized", false);

        const results = await query.find();

        setOrders(results);
      } catch (error) {
        console.log('Error fetching orders', error);
        setTxError(error.message);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  return (
    <div>
      <Head>
        <title>Wyvern NFT Exchange</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="bg-white">
        <div className="max-w-2xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:max-w-7xl lg:px-8">

          {!currentAccount ? (
            <div className='flex flex-col justify-center items-center mb-20 font-bold text-2xl gap-y-3'>
              <div>----------------------------------------</div>
              <div>Please connect wallet</div>
              <div>----------------------------------------</div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Explore</h2>

              {loading ? (
                <div className='flex flex-col justify-center items-center'>
                  <TailSpin
                    className='flex justify-center items-center pt-12'
                    color='#d3d3d3'
                    height={40}
                    width={40}
                  />
                </div>
              ) : (
                <div className="mt-6 grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-4 xl:gap-x-8">
                  {orders.map((order, orderIndex) => (
                    <div key={orderIndex} className="group relative">
                      <div className="w-full min-h-80 bg-gray-200 aspect-w-1 aspect-h-1 rounded-md overflow-hidden group-hover:opacity-75 lg:h-80 lg:aspect-none">
                        <img
                          src={order.attributes.metadata.image}
                          alt={order.attributes.metadata.description}
                          // loader={imageLoader}
                          // unoptimized={true}
                          // layout="raw"
                          className="w-full h-full object-center object-cover lg:w-full lg:h-full"
                        />
                      </div>
                      <div className="mt-4 flex justify-between">
                        <div>
                          <h3 className="text-sm text-gray-700">
                            <a href="#" onClick={(e) => {
                              e.preventDefault();
                              setSelectedOrder(order);
                              setModalOpen(true);
                            }}>
                              <span aria-hidden="true" className="absolute inset-0" />
                              {order.attributes.metadata.name}
                            </a>
                          </h3>
                          <p className="mt-1 text-sm text-gray-500">#{order.attributes.metadata.tokenId}</p>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{order.attributes.price} {order.attributes.currency}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

        </div>

        {modalOpen && (
          <Transition.Root show={modalOpen} as={Fragment}>
            <Dialog as="div" className="fixed z-10 inset-0 overflow-y-auto" onClose={setModalOpen}>
              <div className="flex min-h-screen text-center md:block md:px-2 lg:px-4" style={{ fontSize: 0 }}>
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <Dialog.Overlay className="hidden fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity md:block" />
                </Transition.Child>

                <span className="hidden md:inline-block md:align-middle md:h-screen" aria-hidden="true">
                  &#8203;
                </span>
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 translate-y-4 md:translate-y-0 md:scale-95"
                  enterTo="opacity-100 translate-y-0 md:scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 translate-y-0 md:scale-100"
                  leaveTo="opacity-0 translate-y-4 md:translate-y-0 md:scale-95"
                >
                  <div className="flex text-base text-left transform transition w-full md:inline-block md:max-w-2xl md:px-4 md:my-8 md:align-middle lg:max-w-4xl">
                    <div className="w-full relative flex items-center bg-white px-4 pt-14 pb-8 overflow-hidden shadow-2xl sm:px-6 sm:pt-8 md:p-6 lg:p-8">
                      <button
                        type="button"
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-500 sm:top-8 sm:right-6 md:top-6 md:right-6 lg:top-8 lg:right-8"
                        onClick={() => setModalOpen(false)}
                      >
                        <span className="sr-only">Close</span>
                        <XIcon className="h-6 w-6" aria-hidden="true" />
                      </button>

                      <div className="w-full grid grid-cols-1 gap-y-8 gap-x-6 items-start sm:grid-cols-12 lg:gap-x-8">
                        <div className="aspect-w-2 aspect-h-3 rounded-lg bg-gray-100 overflow-hidden sm:col-span-4 lg:col-span-5">
                          <img src={selectedOrder.attributes.metadata.image} alt={selectedOrder.attributes.metadata.description} className="object-center object-cover" />
                        </div>
                        <div className="sm:col-span-8 lg:col-span-7">
                          <h2 className="text-2xl font-extrabold text-gray-900 sm:pr-12">#{selectedOrder.attributes.metadata.tokenId} - {selectedOrder.attributes.metadata.name}</h2>

                          <section aria-labelledby="information-heading" className="mt-2">
                            <h3 id="information-heading" className="sr-only">
                              Product information
                            </h3>

                            <p className="text-2xl text-gray-900">{selectedOrder.attributes.currency} {selectedOrder.attributes.price}</p>
                          </section>

                          <section aria-labelledby="options-heading" className="mt-10">
                            <h3 id="options-heading" className="sr-only">
                              Product options
                            </h3>

                            <div className="mt-10">
                              <div className="mt-4 space-y-6">
                                <p className="text-sm text-gray-600">{selectedOrder.attributes.metadata.description}</p>
                              </div>
                            </div>

                            <form onSubmit={submit} className="mt-10">
                              <button
                                type="submit"
                                className="mt-6 w-full bg-indigo-600 border border-transparent rounded-md py-3 px-8 flex items-center justify-center text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                Buy NFT
                              </button>
                            </form>
                          </section>
                        </div>
                      </div>
                    </div>
                  </div>
                </Transition.Child>
              </div>
            </Dialog>
          </Transition.Root>
        )}
      </main>
    </div>
  )
}

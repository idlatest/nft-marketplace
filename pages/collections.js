import { useEffect, useState, Fragment } from 'react';
import Head from 'next/head';
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
  tokenAddress
} from '../utils/constants';
import Aux from '../utils/Aux';
import { eip712Domain } from '../utils/eip712';

Moralis.start({
  serverUrl: process.env.NEXT_PUBLIC_MORALIS_SERVER_URL,
  appId: process.env.NEXT_PUBLIC_MORALIS_APP_ID
});

export default function Collections() {
  const [NFTs, setAccountNFTs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [txError, setTxError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState(null);
  const [price, setPrice] = useState(0);
  const [currency, setCurrency] = useState("SB");

  const {
    currentAccount,
    nftContractAddress,
    exchangeABI,
    exchangeAddress,
    getProvider,
    getContract
  } = useAppContext();

  const web3 = getProvider();

  const aux = new Aux(web3);

  const parseURI = (URI) => {
    const parsedURI = URI.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${URI.substring(7)}` : URI;

    return parsedURI
  }

  const handleOnPriceChange = (e) => {
    setPrice(e.target.value);
  }

  const handleOnCurrencyChange = (e) => {
    setCurrency(e.target.value);
  }

  const submit = async (e) => {
    e.preventDefault()

    const exchange = getContract(exchangeAddress, exchangeABI);
    const registry = getContract(registryAddress, registryABI);
    const nft = getContract(nftContractAddress, nftContractABI);

    const gasLimit = 285000;

    try {
      // Register user account on proxy
      // allow proxy to carry out tx for user
      await registry.methods.registerProxy().send({
        from: currentAccount,
        gasLimit: 285000
      });

      const proxy = await registry.methods.proxies(currentAccount).call({
        from: currentAccount
      });
      // localStorage.setItem("proxy", proxy);
      console.log("proxy", proxy);

      // set approval on nft contract to allow the proxy to make transaction on behalf of the owner
      await nft.methods.setApprovalForAll(proxy, true).send({
        from: currentAccount,
        gasLimit
      });
      console.log("setApprovalForAll");


      const selector = web3.eth.abi.encodeFunctionSignature('any(bytes,address[7],uint8[2],uint256[6],bytes,bytes)');

      const params = web3.eth.abi.encodeParameters(
        ['address[2]', 'uint256[2]'],
        [[nftContractAddress, tokenAddress], [selectedNFT.tokenId, price]]
      );

      const order = {
        registry: registryAddress,
        maker: currentAccount,
        staticTarget: staticAddress,
        staticSelector: selector,
        staticExtradata: params,
        maximumFill: "1",
        listingTime: "0",
        expirationTime: "10000000000",
        salt: aux.randomUint(),
      };

      const str = aux.structToSign(order, exchangeAddress);

      web3.currentProvider.send({
        method: 'eth_signTypedData_v3',
        params: [currentAccount, JSON.stringify({
          types: {
            EIP712Domain: eip712Domain.fields,
            Order: aux.eip712Order.fields
          },
          primaryType: 'Order',
          domain: str.domain,
          message: order
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

        const OrderObj = Moralis.Object.extend("Order");
        const orderObj = new OrderObj();

        await orderObj.save({
          order,
          signature,
          metadata: selectedNFT,
          orderHash: hash,
          price,
          currency,
        });


        console.log("the end");
      })
    } catch (error) {
      console.log("error", error);
    } finally {
      setModalOpen(false);
    }
  }

  useEffect(() => {
    const fetchNFTs = async () => {
      if (currentAccount) {
        setLoading(true);

        try {
          const AccountNfts = await Moralis.Web3API.account.getNFTs({
            chain: "rinkeby",
            address: currentAccount,
            token_addresses: nftContractAddress
          });

          const NFTArr = [];

          AccountNfts.result.forEach((NFT) => {
            const parsedMetadata = JSON.parse(NFT.metadata);
            const NFTObj = {};
            NFTObj.tokenId = NFT.token_id;
            NFTObj.name = NFT.name;
            NFTObj.amount = NFT.amount;
            NFTObj.symbol = NFT.symbol;
            NFTObj.description = parsedMetadata.description;
            NFTObj.externalURL = parsedMetadata.external_url;
            NFTObj.image = parseURI(parsedMetadata.image);

            NFTArr.push(NFTObj);
          });

          setAccountNFTs(NFTArr);
        } catch (error) {
          console.log('Error fetching account NFTs', error);
          setTxError(error.message);
        } finally {
          setLoading(false);
        }
      }
    }
    fetchNFTs();
  }, [currentAccount, nftContractAddress]);

  return (
    <div>
      <Head>
        <title>Wyvern NFT Exchange</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="bg-white">
        <div className="max-w-2xl mx-auto py-16 px-4 sm:py-24 sm:px-6 lg:max-w-7xl lg:px-8">
          <h2 className="text-2xl font-extrabold tracking-tight text-gray-900">Collections</h2>

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
              {NFTs.map((NFT) => (
                <div key={NFT.tokenId} className="group relative">
                  <div className="w-full min-h-80 bg-gray-200 aspect-w-1 aspect-h-1 rounded-md overflow-hidden group-hover:opacity-75 lg:h-80 lg:aspect-none">
                    <img
                      src={NFT.image}
                      alt={NFT.description}
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
                          setSelectedNFT(NFT);
                          setModalOpen(true);
                        }}>
                          <span aria-hidden="true" className="absolute inset-0" />
                          {NFT.name}
                        </a>
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">#{NFT.tokenId}</p>
                    </div>
                    {/* <p className="text-sm font-medium text-gray-900">#{NFT.tokenId}</p> */}
                  </div>
                </div>
              ))}
            </div>
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
                          <img src={selectedNFT.image} alt={selectedNFT.description} className="object-center object-cover" />
                        </div>
                        <div className="sm:col-span-8 lg:col-span-7">
                          <h2 className="text-2xl font-extrabold text-gray-900 sm:pr-12">{selectedNFT.name}</h2>

                          <section aria-labelledby="information-heading" className="mt-2">
                            <h3 id="information-heading" className="sr-only">
                              Product information
                            </h3>

                            <p className="text-2xl text-gray-900">#{selectedNFT.tokenId}</p>
                          </section>

                          <section aria-labelledby="options-heading" className="mt-10">
                            <h3 id="options-heading" className="sr-only">
                              Product options
                            </h3>

                            <div className="mt-10">
                              <div className="mt-4 space-y-6">
                                <p className="text-sm text-gray-600">{selectedNFT.description}</p>
                              </div>
                            </div>

                            <form onSubmit={submit} className="mt-10">
                              <div>
                                <label htmlFor="price" className="block text-sm font-medium text-gray-700">
                                  Price
                                </label>
                                <div className="mt-1 relative rounded-md shadow-sm">
                                  {/* <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="text-gray-500 sm:text-sm">$</span>
                                  </div> */}
                                  <input
                                    type="text"
                                    name="price"
                                    value={price}
                                    onChange={handleOnPriceChange}
                                    id="price"
                                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                                    placeholder="0.00"
                                  />
                                  <div className="absolute inset-y-0 right-0 flex items-center">
                                    <label htmlFor="currency" className="sr-only">
                                      Currency
                                    </label>
                                    <select
                                      id="currency"
                                      name="currency"
                                      onChange={handleOnCurrencyChange}
                                      value={currency}
                                      className="focus:ring-indigo-500 focus:border-indigo-500 h-full py-0 pl-2 pr-7 border-transparent bg-transparent text-gray-500 sm:text-sm rounded-md"
                                    >
                                      <option>SB</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                              <button
                                type="submit"
                                className="mt-6 w-full bg-indigo-600 border border-transparent rounded-md py-3 px-8 flex items-center justify-center text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                              >
                                List NFT
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

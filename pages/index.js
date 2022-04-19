import { useState } from 'react';
import Head from 'next/head';
import Image from "next/image";
import { TailSpin } from 'react-loader-spinner';
import { ethers } from 'ethers';
import axios from 'axios';
import { useAppContext } from '../context/AppContext';

export default function Home() {
  const [mintedNFT, setMintedNFT] = useState(null)
  const [loading, setLoading] = useState(false)
  const [txError, setTxError] = useState(null)
  const {
    currentAccount,
    nftContractAddress,
    nftContractABI,
    correctNetwork,
    connectWallet,
    getProvider,
  } = useAppContext();

  const getNftContract = () => {
    const provider = getProvider();
    const signer = provider.getSigner();
    const contract = new ethers.Contract(nftContractAddress, nftContractABI, signer);

    return contract
  }

  const imageLoader = ({ src }) => {
    return src
  }

  const parseURI = (URI) => {
    const parsedURI = URI.startsWith("ipfs://") ? `https://ipfs.io/ipfs/${URI.substring(7)}` : URI;

    return parsedURI
  }

  const getMintedNFT = async (tokenId) => {
    try {
      const nft = getNftContract();
      const tokenUri = await nft.tokenURI(tokenId);
      const parsedTokenURI = parseURI(tokenUri)
      const response = await axios.get(parsedTokenURI);
      const meta = response.data;
      const parsedImageURI = parseURI(meta.image)

      setLoading(false);
      setMintedNFT(parsedImageURI);
    } catch (error) {
      console.log(error);
      setTxError(error.message);
      throw new Error(error.message);
    }
  }

  const mint = async () => {
    try {
      const nft = getNftContract();
      const nftTx = await nft.mint(1, {
        gasLimit: 25000
      });

      console.log("Minting...", nftTx.hash);
      setLoading(true);

      const tx = await nftTx.wait();

      console.log("Mined!", tx);

      const event = tx.events[0];
      const value = event.args[2];
      const tokenId = value.toNumber();

      console.log(
        `Mined, see transaction: https://rinkeby.etherscan.io/tx/${nftTx.hash}`
      )

      getMintedNFT(tokenId);
    } catch (error) {
      console.log('Error minting', error);
      setLoading(false);
      setTxError(error.message);
    }
  }

  return (
    <div>
      <Head>
        <title>Wyvern NFT Exchange</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="bg-white">
        <div className="flex flex-col items-center pt-32 text-gray-900 min-h-screen">
          <div className='trasition hover:rotate-180 hover:scale-105 transition duration-500 ease-in-out'>
            <svg
              xmlns='http://www.w3.org/2000/svg'
              width='60'
              height='60'
              fill='currentColor'
              viewBox='0 0 16 16'
            >
              <path d='M8.186 1.113a.5.5 0 0 0-.372 0L1.846 3.5 8 5.961 14.154 3.5 8.186 1.113zM15 4.239l-6.5 2.6v7.922l6.5-2.6V4.24zM7.5 14.762V6.838L1 4.239v7.923l6.5 2.6zM7.443.184a1.5 1.5 0 0 1 1.114 0l7.129 2.852A.5.5 0 0 1 16 3.5v8.662a1 1 0 0 1-.629.928l-7.185 2.874a.5.5 0 0 1-.372 0L.63 13.09a1 1 0 0 1-.63-.928V3.5a.5.5 0 0 1 .314-.464L7.443.184z' />
            </svg>
          </div>

          <h2 className='text-3xl font-bold mb-20 mt-12'>
            Mint your Sway Bot NFT!
          </h2>


          {!currentAccount ? (
            <button
              className='text-2xl font-bold py-3 px-12 bg-black shadow-lg shadow-[#6FFFE9] rounded-lg mb-10 hover:scale-105 transition duration-500 ease-in-out'
              onClick={connectWallet}
            >
              Connect Wallet
            </button>
          ) : correctNetwork ? (
            <button className='text-2xl font-bold py-3 px-12 bg-black shadow-lg shadow-[#6FFFE9] rounded-lg mb-10 hover:scale-105 transition duration-500 ease-in-out' onClick={mint}>
              Mint NFT
            </button>
          ) : (
            <div className='flex flex-col justify-center items-center mb-20 font-bold text-2xl gap-y-3'>
              <div>----------------------------------------</div>
              <div>Please connect to the Rinkeby Testnet</div>
              <div>and reload the page</div>
              <div>----------------------------------------</div>
            </div>
          )}

          <div className='text-xl font-semibold mb-20 mt-4'>
            <a
              href={`https://rinkeby.rarible.com/collection/${nftContractAddress}`}
              target='_blank'
              rel="noreferrer"
            >
              <span className='hover:underline hover:underline-offset-8 '>
                View Collection on Rarible
              </span>
            </a>
          </div>

          {loading ? (
            <div className='flex flex-col justify-center items-center'>
              <div className='text-lg font-bold'>
                Processing your transaction
              </div>
              <TailSpin
                className='flex justify-center items-center pt-12'
                color='#d3d3d3'
                height={40}
                width={40}
              />
            </div>
          ) : (
            txError !== null ? (
              <div className='text-lg text-red-600 font-semibold'>{txError}</div>
            ) : mintedNFT === null ? (
              <div></div>
            ) : (
              <div className='flex flex-col justify-center items-center'>
                <div className='font-semibold text-lg text-center mb-4'>
                  Your Eternal Domain Character
                </div>
                <Image
                  loader={imageLoader}
                  unoptimized={true}
                  src={mintedNFT}
                  height="300"
                  width="300"
                  alt=''
                  className='h-60 w-60 rounded-lg shadow-2xl shadow-[#6FFFE9] hover:scale-105 transition duration-500 ease-in-out'
                />
              </div>
            )
          )}
        </div>
      </main>
    </div>
  )
}

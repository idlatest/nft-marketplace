import { createContext, useContext, useEffect, useState } from 'react';
import Web3 from 'web3';
import {
  exchangeABI,
  exchangeAddress,
  nftContractABI,
  nftContractAddress,
  tokenABI,
  tokenAddress
} from '../utils/constants';

const AppContext = createContext();

let ethereum
if (typeof window !== 'undefined') {
  ethereum = window.ethereum;
}


export function AppWrapper({ children }) {
  const [currentAccount, setCurrentAccount] = useState("");
  const [correctNetwork, setCorrectNetwork] = useState(false)

  const checkIfWalletIsConnected = async () => {
    if (!ethereum) return alert("Please install metamask");

    try {
      const accounts = await ethereum.request({ method: 'eth_accounts' });

      if (accounts.length) {
        setCurrentAccount(accounts[0]);
      }
    } catch (error) {
      console.log(error);

      throw new Error("No ethereum object!");
    }
  }

  const connectWallet = async () => {
    if (!ethereum) return alert("Please install metamask");

    try {
      const chainId = await ethereum.request({ method: 'eth_chainId' })

      if (chainId !== '0x4') {
        return alert("Please switch to Rinkeby Testnet!")
      }

      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

      setCurrentAccount(accounts[0]);

      // Add listeners start
      ethereum.on("accountsChanged", (accounts) => {
        setCurrentAccount(accounts[0]);
      });
      ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    } catch (error) {
      console.log(error);

      throw new Error("No ethereum object!");
    }
  }

  const checkCorrectNetwork = async () => {
    if (!ethereum) return alert("Please install metamask");

    try {
      const chainId = await ethereum.request({ method: 'eth_chainId' })

      if (chainId !== '0x4') {
        setCorrectNetwork(false);
      } else {
        setCorrectNetwork(true);
      }
    } catch (error) {
      console.log(error);

      throw new Error("No ethereum object!");
    }
  }

  const getProvider = () => {
    let web3 = new Web3(ethereum);
    web3 = web3.extend({
      methods: [{
        name: 'signTypedData',
        call: 'eth_signTypedData',
        params: 2,
        inputFormatter: [web3.extend.formatters.inputAddressFormatter, null]
      }]
    });

    return web3;
  }

  useEffect(() => {
    checkIfWalletIsConnected();
    checkCorrectNetwork();
  })

  return (
    <AppContext.Provider
      value={{
        currentAccount,
        connectWallet,
        correctNetwork,
        nftContractAddress,
        nftContractABI,
        exchangeABI,
        exchangeAddress,
        getProvider,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}

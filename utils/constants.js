import exchange from './WyvernExchange.json';
import registry from './WyvernRegistry.json';
import statici from './WyvernStatic.json';
import atomicizer from './WyvernAtomicizer.json';
import nft from './SwayBotFree.json';
import token from './SwayCoin.json';

export const exchangeABI = exchange.abi;
export const nftContractABI = nft.abi;
export const tokenABI = token.abi;
export const registryABI = registry.abi;
export const staticABI = statici.abi;
export const atomicizerABI = atomicizer.abi;
export const exchangeAddress = "0x8Ce1A397639BdB10262036925cc57886bC095324";
export const nftContractAddress = "0x60735D512ddfAF40512e013398fFFc6B428F2F63";
export const tokenAddress = "0xF6436e7EF8C879F97e4B28De5Fd00d9c003A8FC5";
export const registryAddress = "0xbb036f8b125EFd51884Cd281384E93F80AADB3Be";
export const staticAddress = "0x1958861493c4F556e3E0156C7853452d06aC2417";
export const atomicizerAddress = "0x6a3205bc25AEEBA205310Ba4689f08828DB91C79";
import { useEffect, useRef } from 'react';
import Link from 'next/link'
import { useRouter } from 'next/router';
import { Disclosure } from '@headlessui/react'
import { MenuIcon, XIcon, ExclamationCircleIcon } from '@heroicons/react/outline'
import { renderIcon } from '@download/blockies';
import { useAppContext } from '../context/AppContext'

const navigation = [
  { name: 'Mint NFT', href: '/', current: true },
  { name: 'Explore', href: '/explore', current: false },
  { name: 'Collected', href: '/collected', current: false },
]

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function Example() {
  const canvasRef = useRef(null);
  const { currentAccount, connectWallet, correctNetwork, balance } = useAppContext();
  const router = useRouter();

  const truncateAddress = (address) => {
    const truncateRegex = /^(0x[a-zA-Z0-9]{4})[a-zA-Z0-9]+([a-zA-Z0-9]{4})$/;

    const match = address.match(truncateRegex);
    if (!match) return address;
    return `${match[1]}…${match[2]}`;
  }

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas) {
      renderIcon({
        seed: currentAccount.toLowerCase(),
        size: 6, // width/height of the icon in blocks, default: 10
        scale: 3
      }, canvas);
    }
  }, [currentAccount])

  return (
    <Disclosure as="nav" className="bg-gray-800">
      {({ open }) => (
        <>
          <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
            <div className="relative flex items-center justify-between h-16">
              <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
                {/* Mobile menu button*/}
                <Disclosure.Button className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <MenuIcon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
              <div className="flex-1 flex items-center justify-center sm:items-stretch sm:justify-start">
                <div className="flex-shrink-0 flex items-center">
                  <Link href="/" passHref>
                    <a>
                      <img
                        className="h-8 w-auto"
                        src="https://tailwindui.com/img/logos/workflow-mark-indigo-500.svg"
                        alt="Workflow"
                      />
                    </a>
                  </Link>
                </div>
                <div className="hidden sm:block sm:ml-6">
                  <div className="flex space-x-4">
                    {navigation.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                      >
                        <a
                          className={classNames(
                            router.pathname === item.href ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                            'px-3 py-2 rounded-md text-sm font-medium'
                          )}
                          aria-current={item.current ? 'page' : undefined}
                        >
                          {item.name}
                        </a>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                {/* Profile dropdown */}

                {!currentAccount ? (
                  <button onClick={connectWallet} className="bg-indigo-500 px-3 py-1 rounded-full text-white font-semibold">Connect</button>
                ) : (
                  <div className="flex items-center">
                    <span className="font-medium mr-3 md:mr-6 text-sm text-white">{balance} SB</span>
                    <span className="flex items-center text-white px-1 md:px-3 py-1 bg-gray-700 rounded-md">
                      <span className="hidden md:inline">
                        {truncateAddress(currentAccount)}
                      </span>
                      <canvas ref={canvasRef} className="md:ml-1" />
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div >

          {!correctNetwork && (
            <div className="px-3 py-1 bg-orange-500 text-slate-800 text-center flex justify-center items-center">
              <ExclamationCircleIcon className="block h-6 w-6 mr-2" aria-hidden="true" /> We are only supporting <span className="font-medium mx-1">Rinkeby</span> testnet!</div>
          )}

          <Disclosure.Panel className="sm:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => (
                <Disclosure.Button
                  key={item.name}
                  as="a"
                  href={item.href}
                  className={classNames(
                    item.current ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white',
                    'block px-3 py-2 rounded-md text-base font-medium'
                  )}
                  aria-current={item.current ? 'page' : undefined}
                >
                  {item.name}
                </Disclosure.Button>
              ))}
            </div>
          </Disclosure.Panel>
        </>
      )
      }
    </Disclosure >
  )
}

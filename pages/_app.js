import '../styles/globals.css'
import 'izitoast/dist/css/iziToast.min.css'
import { AppWrapper } from '../context/AppContext'
import Header from '../components/Header';

function MyApp({ Component, pageProps }) {
  return (
    <AppWrapper>
      <Header />
      <Component {...pageProps} />
    </AppWrapper>
  )
}

export default MyApp
